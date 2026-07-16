package com.recoral.app.playback;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.os.Build;
import android.os.IBinder;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// JS-facing side of the native Android media notification (see
// PlaybackService for why this exists: a bare WebView doesn't surface the
// Web Media Session API to the OS the way the Chrome app does). AudioPlayer
// calls start()/update()/stop() to keep the notification in sync with
// whatever the <audio> element is actually doing, and listens for the
// "playbackAction" plugin event to react to notification/lock-screen taps.
@CapacitorPlugin(name = "Playback")
public class PlaybackPlugin extends com.getcapacitor.Plugin implements PlaybackService.Listener {

    private PlaybackService service;
    private boolean bound = false;
    private PluginCall pendingStartCall;

    private final ServiceConnection connection = new ServiceConnection() {
        @Override
        public void onServiceConnected(ComponentName name, IBinder binder) {
            service = ((PlaybackService.LocalBinder) binder).getService();
            service.setListener(PlaybackPlugin.this);
            bound = true;
            if (pendingStartCall != null) {
                PluginCall call = pendingStartCall;
                pendingStartCall = null;
                completeStart(call);
            }
        }

        @Override
        public void onServiceDisconnected(ComponentName name) {
            service = null;
            bound = false;
        }
    };

    @Override
    public void onPlaybackAction(String action, long positionMs) {
        JSObject ret = new JSObject();
        ret.put("action", action);
        // Seconds, matching how the web AudioPlayer already tracks time.
        if (positionMs >= 0) ret.put("position", positionMs / 1000.0);
        notifyListeners("playbackAction", ret);
    }

    @PluginMethod
    public void start(PluginCall call) {
        Intent intent = new Intent(getContext(), PlaybackService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getContext().startForegroundService(intent);
        } else {
            getContext().startService(intent);
        }

        if (bound && service != null) {
            completeStart(call);
            return;
        }
        pendingStartCall = call;
        getContext().bindService(intent, connection, Context.BIND_AUTO_CREATE);
    }

    private void completeStart(PluginCall call) {
        String title = call.getString("title", "recoral");
        boolean playing = Boolean.TRUE.equals(call.getBoolean("playing", false));
        long position = Math.round(call.getDouble("position", 0.0) * 1000);
        long duration = Math.round(call.getDouble("duration", 0.0) * 1000);
        String color = call.getString("color", null);
        service.start(title, playing, position, duration, color);
        call.resolve();
    }

    @PluginMethod
    public void update(PluginCall call) {
        if (service == null) {
            call.resolve();
            return;
        }
        String title = call.getString("title", null);
        boolean playing = Boolean.TRUE.equals(call.getBoolean("playing", false));
        long position = Math.round(call.getDouble("position", 0.0) * 1000);
        long duration = Math.round(call.getDouble("duration", 0.0) * 1000);
        String color = call.getString("color", null);
        service.update(title, playing, position, duration, color);
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        if (service != null) service.stop();
        if (bound) {
            getContext().unbindService(connection);
            bound = false;
            service = null;
        }
        call.resolve();
    }
}
