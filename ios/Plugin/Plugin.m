#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

// Define the plugin using the CAP_PLUGIN Macro, and
// each method the plugin supports using the CAP_PLUGIN_METHOD macro.
CAP_PLUGIN(StripeTerminal, "StripeTerminal",
           CAP_PLUGIN_METHOD(initialize, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(setConnectionToken, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(discoverReaders, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(connectReader, CAPPluginReturnPromise);
)
