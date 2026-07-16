package com.recoral.app.systemcolor;

import android.os.Build;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// Reads Android 12+'s Material You dynamic system accent color, so the app's
// own accent (normally per-user, see web/src/lib/accent.ts) can follow the
// user's phone/wallpaper palette instead when they opt into that in Account
// Settings (see web/src/lib/systemAccent.svelte.ts). Below API 31, or if an
// OEM build doesn't populate the resource, this just resolves { hex: null }
// and the web side falls back to the per-user color, same as the toggle
// being off.
@CapacitorPlugin(name = "SystemColor")
public class SystemColorPlugin extends Plugin {

    @PluginMethod
    public void getAccentColor(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("hex", readSystemAccentHex());
        call.resolve(ret);
    }

    private String readSystemAccentHex() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return null;
        try {
            int color = ContextCompat.getColor(getContext(), android.R.color.system_accent1_500);
            return String.format("#%06X", color & 0xFFFFFF);
        } catch (Exception ex) {
            return null;
        }
    }
}
