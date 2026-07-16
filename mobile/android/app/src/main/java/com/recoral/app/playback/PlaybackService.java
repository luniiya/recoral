package com.recoral.app.playback;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.graphics.Color;
import android.os.Binder;
import android.os.Build;
import android.os.IBinder;
import androidx.core.app.NotificationCompat;
import androidx.media.app.NotificationCompat.MediaStyle;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;
import com.recoral.app.R;

// Real Android system media notification ("media card") for playback, same
// foreground-service-with-persistent-notification mechanism RecorderService
// uses for recording. This exists because a bare embedded WebView does NOT
// surface the Web Media Session API to the OS the way the Chrome app does
// (that integration is Chrome's own native code, not something any WebView
// host gets for free) — confirmed by checking dumpsys notification while
// playing with only the Web Media Session API wired up: no notification
// channel for playback ever got created. This service is the actual fix.
//
// The <audio> element itself still lives and plays entirely in the WebView;
// this service only owns the MediaSessionCompat + notification, and relays
// notification/lock-screen button taps back to JS via the Listener, which
// PlaybackPlugin forwards on as a plugin event. JS confirms the resulting
// play/pause/position back via update(), which is what actually keeps the
// notification's state in sync (not the tap handlers alone).
public class PlaybackService extends Service {

    public static final String CHANNEL_ID = "recoral_playback";
    private static final int NOTIFICATION_ID = 4202;

    private static final String ACTION_PLAY_PAUSE = "com.recoral.app.playback.PLAY_PAUSE";
    private static final String ACTION_SEEK_BACKWARD = "com.recoral.app.playback.SEEK_BACKWARD";
    private static final String ACTION_SEEK_FORWARD = "com.recoral.app.playback.SEEK_FORWARD";

    public interface Listener {
        // positionMs is only meaningful for "seekTo" (an absolute drag on the
        // notification/lock-screen's progress bar), -1 for every other action.
        void onPlaybackAction(String action, long positionMs);
    }

    private final IBinder binder = new LocalBinder();
    private MediaSessionCompat mediaSession;
    private Listener listener;
    private String title = "recoral";
    private boolean playing = false;
    private long positionMs = 0;
    private long durationMs = 0;
    private int accentColor = Color.parseColor("#e2664a");

    public class LocalBinder extends Binder {

        public PlaybackService getService() {
            return PlaybackService.this;
        }
    }

    @Override
    public IBinder onBind(Intent intent) {
        return binder;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : null;
        if (ACTION_PLAY_PAUSE.equals(action)) {
            notifyListener(playing ? "pause" : "play", -1);
        } else if (ACTION_SEEK_BACKWARD.equals(action)) {
            notifyListener("seekBackward", -1);
        } else if (ACTION_SEEK_FORWARD.equals(action)) {
            notifyListener("seekForward", -1);
        }
        return START_NOT_STICKY;
    }

    public void setListener(Listener listener) {
        this.listener = listener;
    }

    // Takes the full initial state (not just a title) so the very first
    // notification posted is already correct — leaving playing/position out
    // here meant the first frame always showed "Paused" even mid-playback,
    // since nothing had told the service otherwise yet.
    public void start(String initialTitle, boolean isPlaying, long initialPositionMs, long initialDurationMs, String colorHex) {
        this.title = initialTitle;
        this.playing = isPlaying;
        this.positionMs = initialPositionMs;
        this.durationMs = initialDurationMs;
        applyColor(colorHex);
        ensureSession();
        updateSessionState();
        createNotificationChannel();
        startForeground(NOTIFICATION_ID, buildNotification());
    }

    // Called whenever the web player's own state changes (play/pause, a new
    // recording selected, or a position sync tick), the single source of
    // truth for what the notification/lock-screen actually show, not the
    // optimistic tap handlers in onStartCommand above.
    public void update(String newTitle, boolean isPlaying, long newPositionMs, long newDurationMs, String colorHex) {
        if (newTitle != null) this.title = newTitle;
        this.playing = isPlaying;
        this.positionMs = newPositionMs;
        this.durationMs = newDurationMs;
        applyColor(colorHex);
        ensureSession();
        updateSessionState();
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) manager.notify(NOTIFICATION_ID, buildNotification());
    }

    public void stop() {
        stopForegroundCompat();
        if (mediaSession != null) {
            mediaSession.setActive(false);
            mediaSession.release();
            mediaSession = null;
        }
        stopSelf();
    }

    private void applyColor(String colorHex) {
        if (colorHex == null || colorHex.isEmpty()) return;
        try {
            accentColor = Color.parseColor(colorHex);
        } catch (IllegalArgumentException ignored) {
            // Keep whatever color was already set.
        }
    }

    private void notifyListener(String action, long position) {
        if (listener != null) listener.onPlaybackAction(action, position);
    }

    private void ensureSession() {
        if (mediaSession != null) return;
        mediaSession = new MediaSessionCompat(this, "RecoralPlayback");
        mediaSession.setFlags(
            MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS | MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS
        );
        // Hardware/Bluetooth/Android-Auto transport buttons and the
        // notification's own draggable progress bar (onSeekTo) route here,
        // not through the notification's action PendingIntents (those go
        // straight to onStartCommand above), so both paths reach the same
        // listener either way.
        mediaSession.setCallback(
            new MediaSessionCompat.Callback() {
                @Override
                public void onPlay() {
                    notifyListener("play", -1);
                }

                @Override
                public void onPause() {
                    notifyListener("pause", -1);
                }

                @Override
                public void onRewind() {
                    notifyListener("seekBackward", -1);
                }

                @Override
                public void onFastForward() {
                    notifyListener("seekForward", -1);
                }

                @Override
                public void onSeekTo(long pos) {
                    notifyListener("seekTo", pos);
                }
            }
        );
        mediaSession.setActive(true);
    }

    private void updateSessionState() {
        long actions =
            PlaybackStateCompat.ACTION_PLAY |
            PlaybackStateCompat.ACTION_PAUSE |
            PlaybackStateCompat.ACTION_PLAY_PAUSE |
            PlaybackStateCompat.ACTION_REWIND |
            PlaybackStateCompat.ACTION_FAST_FORWARD |
            // Without this, the notification/lock-screen never show a
            // draggable progress bar at all, regardless of position/duration
            // being set, confirmed against the real Android media-notification
            // redesign's requirements.
            PlaybackStateCompat.ACTION_SEEK_TO;

        PlaybackStateCompat state = new PlaybackStateCompat.Builder()
            .setActions(actions)
            .setState(
                playing ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED,
                positionMs,
                playing ? 1.0f : 0f
            )
            .build();
        mediaSession.setPlaybackState(state);

        MediaMetadataCompat metadata = new MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, title)
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, "recoral")
            .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, durationMs)
            .build();
        mediaSession.setMetadata(metadata);
    }

    private PendingIntent actionIntent(String action, int requestCode) {
        Intent intent = new Intent(this, PlaybackService.class).setAction(action);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0);
        return PendingIntent.getService(this, requestCode, intent, flags);
    }

    private Notification buildNotification() {
        NotificationCompat.Action rewind = new NotificationCompat.Action(
            R.drawable.ic_media_rewind,
            "Back 10s",
            actionIntent(ACTION_SEEK_BACKWARD, 1)
        );
        NotificationCompat.Action playPause = new NotificationCompat.Action(
            playing ? R.drawable.ic_media_pause : R.drawable.ic_media_play,
            playing ? "Pause" : "Play",
            actionIntent(ACTION_PLAY_PAUSE, 2)
        );
        NotificationCompat.Action forward = new NotificationCompat.Action(
            R.drawable.ic_media_forward,
            "Forward 10s",
            actionIntent(ACTION_SEEK_FORWARD, 3)
        );

        MediaStyle style = new MediaStyle().setShowActionsInCompactView(0, 1, 2);
        if (mediaSession != null) style.setMediaSession(mediaSession.getSessionToken());

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText("recoral")
            .setSmallIcon(R.drawable.ic_notification)
            // A MediaStyle notification with a session token auto-colorizes on
            // its own (confirmed: Android O+ colorizes any notification with
            // setMediaSession() attached unless explicitly opted out), but
            // without setColor() it picks its own default rather than ours,
            // which is the "wrong color" this fixes.
            .setColor(accentColor)
            .setColorized(true)
            .setOngoing(playing)
            .setOnlyAlertOnce(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .addAction(rewind)
            .addAction(playPause)
            .addAction(forward)
            .setStyle(style)
            .build();
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
                NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Playback", NotificationManager.IMPORTANCE_LOW);
                channel.setDescription("Shown while recoral is playing a recording.");
                manager.createNotificationChannel(channel);
            }
        }
    }

    @Override
    public void onDestroy() {
        if (mediaSession != null) {
            mediaSession.release();
            mediaSession = null;
        }
        super.onDestroy();
    }
}
