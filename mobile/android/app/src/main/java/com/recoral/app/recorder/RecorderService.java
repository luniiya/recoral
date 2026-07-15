package com.recoral.app.recorder;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.MediaRecorder;
import android.net.Uri;
import android.os.Binder;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.SystemClock;
import androidx.core.app.NotificationCompat;
import com.recoral.app.R;
import java.io.File;
import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

// Owns the MediaRecorder from inside a real foreground service (startForeground +
// a persistent notification), which is the actual mechanism that keeps Android from
// suspending the recording once the app backgrounds or the screen locks. A plain
// MediaRecorder tied to the Activity/plugin lifecycle (what most drop-in Capacitor
// recorder plugins do) does not survive that, and defeats the point.
public class RecorderService extends Service {

    public static final String CHANNEL_ID = "recoral_recording";
    private static final int NOTIFICATION_ID = 4201;

    public enum RecordingStatus {
        INACTIVE,
        RECORDING,
        PAUSED
    }

    public static class StopResult {

        public final String uri;
        public final long duration;

        public StopResult(String uri, long duration) {
            this.uri = uri;
            this.duration = duration;
        }
    }

    private final IBinder binder = new LocalBinder();
    private MediaRecorder mediaRecorder;
    private File outputFile;
    private RecordingStatus status = RecordingStatus.INACTIVE;
    private long recordingStartTime = 0L;
    private long pauseStartTime = 0L;
    private long accumulatedPauseDuration = 0L;

    // Ticks the notification's text with live elapsed time (e.g. "Recording — 0:23")
    // once a second while actually recording, so the persistent notification reads
    // as "this is actively happening" rather than a static, possibly-stale label.
    private final Handler tickerHandler = new Handler(Looper.getMainLooper());
    private final Runnable ticker = new Runnable() {
        @Override
        public void run() {
            if (status != RecordingStatus.RECORDING) return;
            updateNotification("Recording — " + formatDuration(calculateDuration()));
            tickerHandler.postDelayed(this, 1000);
        }
    };

    public class LocalBinder extends Binder {

        public RecorderService getService() {
            return RecorderService.this;
        }
    }

    @Override
    public IBinder onBind(Intent intent) {
        return binder;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        return START_NOT_STICKY;
    }

    public void startRecording(int bitRate, int sampleRate) throws IOException {
        if (status != RecordingStatus.INACTIVE) {
            throw new IllegalStateException("Recording already in progress.");
        }

        createNotificationChannel();
        Notification notification = buildNotification("Recording…");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }

        mediaRecorder = new MediaRecorder();
        mediaRecorder.setAudioSource(MediaRecorder.AudioSource.MIC);
        mediaRecorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);
        mediaRecorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);
        mediaRecorder.setAudioEncodingBitRate(bitRate);
        mediaRecorder.setAudioSamplingRate(sampleRate);

        // Internal app storage (not cache), so a locally-saved-but-not-yet-synced
        // recording survives OS storage pressure until the outbox actually uploads it.
        File outputDirectory = new File(getFilesDir(), "recordings");
        if (!outputDirectory.exists()) {
            //noinspection ResultOfMethodCallIgnored
            outputDirectory.mkdirs();
        }
        String fileName = "recording-" + new SimpleDateFormat("yyyyMMdd-HHmmss-SSS", Locale.US).format(new Date()) + ".m4a";
        outputFile = new File(outputDirectory, fileName);
        mediaRecorder.setOutputFile(outputFile.getAbsolutePath());

        try {
            mediaRecorder.prepare();
            mediaRecorder.start();
        } catch (IOException | IllegalStateException ex) {
            releaseRecorder();
            stopForegroundCompat();
            throw new IOException("Unable to start recording.", ex);
        }

        recordingStartTime = SystemClock.elapsedRealtime();
        accumulatedPauseDuration = 0;
        pauseStartTime = 0;
        status = RecordingStatus.RECORDING;
        tickerHandler.post(ticker);
    }

    public void pauseRecording() {
        if (status != RecordingStatus.RECORDING || mediaRecorder == null) {
            throw new IllegalStateException("No active recording to pause.");
        }
        mediaRecorder.pause();
        pauseStartTime = SystemClock.elapsedRealtime();
        status = RecordingStatus.PAUSED;
        tickerHandler.removeCallbacks(ticker);
        updateNotification("Paused");
    }

    public void resumeRecording() {
        if (status != RecordingStatus.PAUSED || mediaRecorder == null) {
            throw new IllegalStateException("No paused recording to resume.");
        }
        mediaRecorder.resume();
        if (pauseStartTime > 0) {
            accumulatedPauseDuration += SystemClock.elapsedRealtime() - pauseStartTime;
        }
        pauseStartTime = 0;
        status = RecordingStatus.RECORDING;
        tickerHandler.post(ticker);
    }

    public StopResult stopRecording() {
        if (status == RecordingStatus.INACTIVE || mediaRecorder == null) {
            throw new IllegalStateException("No active recording to stop.");
        }
        try {
            mediaRecorder.stop();
        } catch (RuntimeException ex) {
            deleteOutputFile();
            releaseRecorder();
            stopForegroundCompat();
            stopSelf();
            throw ex;
        }

        long duration = calculateDuration();
        String uri = outputFile != null ? Uri.fromFile(outputFile).toString() : "";
        releaseRecorder();
        stopForegroundCompat();
        stopSelf();
        return new StopResult(uri, duration);
    }

    public void cancelRecording() {
        if (mediaRecorder != null) {
            try {
                mediaRecorder.stop();
            } catch (RuntimeException ignored) {}
        }
        deleteOutputFile();
        releaseRecorder();
        stopForegroundCompat();
        stopSelf();
    }

    public RecordingStatus getStatus() {
        return status;
    }

    public double getCurrentAmplitude() {
        if (mediaRecorder == null || status != RecordingStatus.RECORDING) {
            return 0.0;
        }
        try {
            int peak = mediaRecorder.getMaxAmplitude();
            return Math.max(0.0, Math.min(1.0, peak / 32767.0));
        } catch (IllegalStateException ex) {
            return 0.0;
        }
    }

    private String formatDuration(long millis) {
        long totalSeconds = millis / 1000;
        long minutes = totalSeconds / 60;
        long seconds = totalSeconds % 60;
        return String.format(Locale.US, "%d:%02d", minutes, seconds);
    }

    private long calculateDuration() {
        long endTime = SystemClock.elapsedRealtime();
        if (pauseStartTime > 0) {
            accumulatedPauseDuration += endTime - pauseStartTime;
        }
        return Math.max(endTime - recordingStartTime - accumulatedPauseDuration, 0);
    }

    private void releaseRecorder() {
        tickerHandler.removeCallbacks(ticker);
        if (mediaRecorder != null) {
            try {
                mediaRecorder.reset();
            } catch (RuntimeException ignored) {}
            mediaRecorder.release();
        }
        mediaRecorder = null;
        status = RecordingStatus.INACTIVE;
        recordingStartTime = 0;
        pauseStartTime = 0;
        accumulatedPauseDuration = 0;
    }

    private void deleteOutputFile() {
        if (outputFile != null && outputFile.exists()) {
            //noinspection ResultOfMethodCallIgnored
            outputFile.delete();
        }
        outputFile = null;
    }

    private void stopForegroundCompat() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(Service.STOP_FOREGROUND_REMOVE);
        } else {
            stopForeground(true);
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = getSystemService(NotificationManager.class);
            NotificationChannel existing = manager.getNotificationChannel(CHANNEL_ID);
            if (existing == null) {
                NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Recording", NotificationManager.IMPORTANCE_LOW);
                channel.setDescription("Shown while recoral is recording audio.");
                manager.createNotificationChannel(channel);
            }
        }
    }

    private Notification buildNotification(String text) {
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("recoral")
            .setContentText(text)
            .setSmallIcon(R.drawable.ic_notification)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build();
    }

    private void updateNotification(String text) {
        NotificationManager manager = getSystemService(NotificationManager.class);
        manager.notify(NOTIFICATION_ID, buildNotification(text));
    }

    @Override
    public void onDestroy() {
        releaseRecorder();
        super.onDestroy();
    }
}
