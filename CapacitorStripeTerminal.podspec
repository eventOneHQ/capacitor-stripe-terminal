
  Pod::Spec.new do |s|
    s.name = 'CapacitorStripeTerminal'
    s.version = '0.0.1'
    s.summary = 'Capacitor plugin for Stripe Terminal (credit card readers).'
    s.license = 'MIT'
    s.homepage = 'https://github.com/eventOneHQ/capacitor-stripe-terminal'
    s.author = 'eventOne Labs <opensource@event1.io>'
    s.source = { :git => 'https://github.com/eventOneHQ/capacitor-stripe-terminal', :tag => s.version.to_s }
    s.source_files = 'ios/Sources/StripeTerminalPlugin/**/*.{swift,h,m,c,cc,mm,cpp}'
    s.ios.deployment_target  = '15.0'
    s.dependency 'Capacitor'
    s.dependency 'StripeTerminal', '5.8.0'
  end