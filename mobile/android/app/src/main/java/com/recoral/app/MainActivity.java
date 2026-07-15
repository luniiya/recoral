package com.recoral.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.recoral.app.recorder.RecorderPlugin;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(RecorderPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
