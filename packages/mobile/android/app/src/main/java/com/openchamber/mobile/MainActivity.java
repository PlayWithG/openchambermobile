package com.openchamber.mobile;

import android.os.Bundle;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

/**
 * MainActivity - OpenChamber Mobile entry point.
 *
 * Extends BridgeActivity to integrate Capacitor with the WebView.
 * Hardware acceleration is enabled for smooth 120Hz rendering.
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Enable hardware acceleration for 120Hz displays
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
            // On Android 11+, let the system handle it automatically
            // but we can still ensure it's not explicitly disabled
        } else {
            // For older versions, explicitly enable hardware acceleration
            getWindow().setFlags(
                WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
                WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED
            );
        }
    }
}