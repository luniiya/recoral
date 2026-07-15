package com.recoral.app.recorder;

import android.Manifest;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.os.Build;
import android.os.IBinder;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

// JS-facing side of the custom foreground-service recorder. Binds to
// RecorderService (which does the actual recording) and forwards calls to it,
// same start/stop/pause/resume/permission/amplitude shape as a typical
// Capacitor audio recorder plugin so the web layer doesn't need to know this
// is a hand-written plugin rather than an installed package.
@CapacitorPlugin(
    name = "RecoralRecorder",
    permissions = {
        @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO }),
        // Android 13+ requires this at runtime for the foreground-service
        // notification to actually be visible; without it the service still
        // runs (recording isn't blocked) but silently, with no indicator.
        @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS }),
    }
)
public class RecorderPlugin extends com.getcapacitor.Plugin {

    private RecorderService service;
    private boolean bound = false;
    private PluginCall pendingStartCall;

    private final ServiceConnection connection = new ServiceConnection() {
        @Override
        public void onServiceConnected(ComponentName name, IBinder binder) {
            service = ((RecorderService.LocalBinder) binder).getService();
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

    @PluginMethod
    public void startRecording(PluginCall call) {
        if (!ensurePermission(call)) return;
        beginStart(call);
    }

    @PermissionCallback
    private void permissionStartCallback(PluginCall call) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            call.reject("Microphone permission not granted.");
            return;
        }
        // Notification permission is best-effort: recording still works
        // without it, just invisibly (matches real Android behavior), so a
        // denial there shouldn't block starting.
        beginStart(call);
    }

    private boolean ensurePermission(PluginCall call) {
        if (getPermissionState("microphone") == PermissionState.GRANTED) {
            return true;
        }
        requestPermissionForAliases(new String[] { "microphone", "notifications" }, call, "permissionStartCallback");
        return false;
    }

    private void beginStart(PluginCall call) {
        Intent intent = new Intent(getContext(), RecorderService.class);
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
        try {
            int bitRate = call.getInt("bitRate", 192000);
            int sampleRate = call.getInt("sampleRate", 44100);
            service.startRecording(bitRate, sampleRate);
            call.resolve();
        } catch (Exception ex) {
            call.reject("Unable to start recording.", ex);
        }
    }

    @PluginMethod
    public void pauseRecording(PluginCall call) {
        if (service == null) {
            call.reject("No active recording to pause.");
            return;
        }
        try {
            service.pauseRecording();
            call.resolve();
        } catch (Exception ex) {
            call.reject("Failed to pause recording.", ex);
        }
    }

    @PluginMethod
    public void resumeRecording(PluginCall call) {
        if (service == null) {
            call.reject("No paused recording to resume.");
            return;
        }
        try {
            service.resumeRecording();
            call.resolve();
        } catch (Exception ex) {
            call.reject("Failed to resume recording.", ex);
        }
    }

    @PluginMethod
    public void stopRecording(PluginCall call) {
        if (service == null) {
            call.reject("No active recording to stop.");
            return;
        }
        try {
            RecorderService.StopResult result = service.stopRecording();
            JSObject ret = new JSObject();
            ret.put("uri", result.uri);
            ret.put("duration", result.duration);
            call.resolve(ret);
            unbindIfBound();
        } catch (Exception ex) {
            call.reject("Failed to stop recording cleanly.", ex);
        }
    }

    @PluginMethod
    public void cancelRecording(PluginCall call) {
        if (service != null) {
            service.cancelRecording();
            unbindIfBound();
        }
        call.resolve();
    }

    @PluginMethod
    public void getRecordingStatus(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("status", service != null ? service.getStatus().name() : "INACTIVE");
        call.resolve(ret);
    }

    @PluginMethod
    public void getCurrentAmplitude(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("value", service != null ? service.getCurrentAmplitude() : 0.0);
        call.resolve(ret);
    }

    @PluginMethod
    public void checkPermissions(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("recordAudio", toPermissionString(getPermissionState("microphone")));
        call.resolve(ret);
    }

    @PluginMethod
    public void requestPermissions(PluginCall call) {
        if (getPermissionState("microphone") == PermissionState.GRANTED) {
            JSObject ret = new JSObject();
            ret.put("recordAudio", "granted");
            call.resolve(ret);
            return;
        }
        requestPermissionForAlias("microphone", call, "microphoneRequestCallback");
    }

    @PermissionCallback
    private void microphoneRequestCallback(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("recordAudio", toPermissionString(getPermissionState("microphone")));
        call.resolve(ret);
    }

    private void unbindIfBound() {
        if (bound) {
            getContext().unbindService(connection);
            bound = false;
            service = null;
        }
    }

    private String toPermissionString(PermissionState state) {
        if (state == null) return "prompt";
        switch (state) {
            case GRANTED:
                return "granted";
            case DENIED:
                return "denied";
            case PROMPT_WITH_RATIONALE:
                return "prompt-with-rationale";
            default:
                return "prompt";
        }
    }
}
