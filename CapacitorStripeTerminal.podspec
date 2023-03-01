
  Pod::Spec.new do |s|
    s.name = 'CapacitorStripeTerminal'
    s.version = '0.0.1'
    s.summary = 'Capacitor plugin for Stripe Terminal (credit card readers).'
    s.license = 'MIT'
    s.homepage = 'https://github.com/eventOneHQ/capacitor-stripe-terminal'
    s.author = 'eventOne Labs <opensource@event1.io>'
    s.source = { :git => 'https://github.com/eventOneHQ/capacitor-stripe-terminal', :tag => s.version.to_s }
    s.source_files = 'ios/Plugin/**/*.{swift,h,m,c,cc,mm,cpp}'
    s.ios.deployment_target  = '13.0'
    s.dependency 'Capacitor'
    s.dependency 'StripeTerminal', '2.17.1'
  end