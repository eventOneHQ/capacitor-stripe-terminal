#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

// Define the plugin using the CAP_PLUGIN Macro, and
// each method the plugin supports using the CAP_PLUGIN_METHOD macro.
CAP_PLUGIN(StripeTerminal, "StripeTerminal",
           CAP_PLUGIN_METHOD(initialize, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(setConnectionToken, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(discoverReaders, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(connectBluetoothReader, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(connectInternetReader, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(getConnectionStatus, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(getConnectedReader, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(cancelDiscoverReaders, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(disconnectReader, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(installAvailableUpdate, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(cancelInstallUpdate, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(cancelCollectPaymentMethod, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(retrievePaymentIntent, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(collectPaymentMethod, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(processPayment, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(clearCachedCredentials, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(getPermissions, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(checkPermissions, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(requestPermissions, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(setReaderDisplay, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(clearReaderDisplay, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(listLocations, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(getSimulatorConfiguration, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(setSimulatorConfiguration, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(connectLocalMobileReader, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(cancelAutoReconnect, CAPPluginReturnPromise);
)

