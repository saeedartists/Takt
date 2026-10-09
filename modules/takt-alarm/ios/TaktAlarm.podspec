Pod::Spec.new do |s|
  s.name           = 'TaktAlarm'
  s.version        = '1.0.0'
  s.summary        = 'Dose alarms through AlarmKit (iOS 26+): ring through silent mode and Focus.'
  s.description    = s.summary
  s.license        = 'UNLICENSED'
  s.author         = 'Actimi GmbH'
  s.homepage       = 'https://actimi.com'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  # Weak link: the app still launches on iOS 16.4–25, where AlarmKit does not exist.
  s.weak_frameworks = 'AlarmKit'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = '**/*.swift'
end
