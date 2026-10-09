import ExpoModulesCore

#if canImport(AlarmKit)
import ActivityKit
import AlarmKit
import AppIntents
import SwiftUI

/// Takt alarms carry no extra data; the notification scheduled for the same dose holds the details.
@available(iOS 26.0, *)
struct TaktAlarmMetadata: AlarmMetadata {}

/// "Open" on the alarm: brings Takt to the foreground so the dose can be confirmed.
@available(iOS 26.0, *)
struct OpenTaktFromAlarmIntent: LiveActivityIntent {
  static var title: LocalizedStringResource = "Open Takt"
  static var openAppWhenRun: Bool = true

  @Parameter(title: "alarmId")
  var alarmId: String

  init() {}
  init(alarmId: String) { self.alarmId = alarmId }

  func perform() async throws -> some IntentResult { .result() }
}
#endif

struct TaktAlarmOptions: Record {
  @Field var epochSeconds: Double = 0
  @Field var title: String = ""
  @Field var stopLabel: String = "Done"
  @Field var openLabel: String = "Open"
  @Field var soundName: String?
  @Field var tintHex: String = "#B4611C"
}

private func color(_ hex: String) -> (Double, Double, Double) {
  var value: UInt64 = 0
  Scanner(string: hex.replacingOccurrences(of: "#", with: "")).scanHexInt64(&value)
  return (Double((value >> 16) & 0xFF) / 255, Double((value >> 8) & 0xFF) / 255, Double(value & 0xFF) / 255)
}

/*
 * TaktAlarm — dose alarms through AlarmKit. Unlike notifications they ring through silent mode
 * and Focus, full screen on the lock screen, like the Clock app. iOS 26+ only; every function
 * answers "unavailable" / no-ops elsewhere so JS can fall back to plain notifications.
 */
public class TaktAlarmModule: Module {
  public func definition() -> ModuleDefinition {
    Name("TaktAlarm")

    Function("isAvailable") { () -> Bool in
      if #available(iOS 26.0, *) { return true }
      return false
    }

    AsyncFunction("getAuthorizationStatus") { () -> String in
      #if canImport(AlarmKit)
      if #available(iOS 26.0, *) {
        switch AlarmManager.shared.authorizationState {
        case .authorized: return "authorized"
        case .denied: return "denied"
        case .notDetermined: return "notDetermined"
        @unknown default: return "notDetermined"
        }
      }
      #endif
      return "unavailable"
    }

    AsyncFunction("requestAuthorization") { () async -> String in
      #if canImport(AlarmKit)
      if #available(iOS 26.0, *) {
        do {
          switch try await AlarmManager.shared.requestAuthorization() {
          case .authorized: return "authorized"
          case .denied: return "denied"
          case .notDetermined: return "notDetermined"
          @unknown default: return "notDetermined"
          }
        } catch {
          return "denied"
        }
      }
      #endif
      return "unavailable"
    }

    /// Schedules one alarm; returns its id, or nil when AlarmKit is unavailable or refuses.
    AsyncFunction("schedule") { (options: TaktAlarmOptions) async -> String? in
      #if canImport(AlarmKit)
      if #available(iOS 26.0, *) {
        let id = UUID()
        let (r, g, b) = color(options.tintHex)
        let alert = AlarmPresentation.Alert(
          title: LocalizedStringResource(stringLiteral: options.title),
          stopButton: AlarmButton(
            text: LocalizedStringResource(stringLiteral: options.stopLabel),
            textColor: .white,
            systemImageName: "checkmark"
          ),
          secondaryButton: AlarmButton(
            text: LocalizedStringResource(stringLiteral: options.openLabel),
            textColor: .white,
            systemImageName: "arrow.up.forward.app"
          ),
          secondaryButtonBehavior: .custom
        )
        let attributes = AlarmAttributes<TaktAlarmMetadata>(
          presentation: AlarmPresentation(alert: alert),
          metadata: TaktAlarmMetadata(),
          tintColor: Color(red: r, green: g, blue: b)
        )
        let sound: AlertConfiguration.AlertSound =
          (options.soundName?.isEmpty == false) ? .named(options.soundName!) : .default
        let configuration = AlarmManager.AlarmConfiguration<TaktAlarmMetadata>(
          schedule: .fixed(Date(timeIntervalSince1970: options.epochSeconds)),
          attributes: attributes,
          secondaryIntent: OpenTaktFromAlarmIntent(alarmId: id.uuidString),
          sound: sound
        )
        do {
          _ = try await AlarmManager.shared.schedule(id: id, configuration: configuration)
          return id.uuidString
        } catch {
          return nil
        }
      }
      #endif
      return nil
    }

    /// Ids of the alarms still scheduled (fired and stopped alarms drop out).
    AsyncFunction("list") { () async -> [String] in
      #if canImport(AlarmKit)
      if #available(iOS 26.0, *) {
        return ((try? AlarmManager.shared.alarms) ?? []).map { $0.id.uuidString }
      }
      #endif
      return []
    }

    AsyncFunction("cancel") { (id: String) async in
      #if canImport(AlarmKit)
      if #available(iOS 26.0, *), let uuid = UUID(uuidString: id) {
        try? AlarmManager.shared.cancel(id: uuid)
      }
      #endif
    }

    /// Cancels every alarm this app has scheduled; returns how many.
    AsyncFunction("cancelAll") { () async -> Int in
      #if canImport(AlarmKit)
      if #available(iOS 26.0, *) {
        let alarms = (try? AlarmManager.shared.alarms) ?? []
        for alarm in alarms { try? AlarmManager.shared.cancel(id: alarm.id) }
        return alarms.count
      }
      #endif
      return 0
    }
  }
}
