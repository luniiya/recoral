package com.recoral.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.recoral.app.playback.PlaybackPlugin;
import com.recoral.app.recorder.RecorderPlugin;
import com.recoral.app.systemcolor.SystemColorPlugin;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(RecorderPlugin.class);
        registerPlugin(SystemColorPlugin.class);
        registerPlugin(PlaybackPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
