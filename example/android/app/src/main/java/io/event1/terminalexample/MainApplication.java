package io.event1.terminalexample;

import android.app.Application;

import com.stripe.stripeterminal.TerminalApplicationDelegate;

/**
 * Required by the Stripe Terminal Android SDK (and therefore by Apps on
 * Devices): it must hear about the application's lifecycle. Registered on
 * <application android:name=".MainApplication"> in AndroidManifest.xml.
 * https://docs.stripe.com/terminal/features/apps-on-devices/build
 */
public class MainApplication extends Application {

    @Override
    public void onCreate() {
        super.onCreate();
        TerminalApplicationDelegate.onCreate(this);
    }
}
