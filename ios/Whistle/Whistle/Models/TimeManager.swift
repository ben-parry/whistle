import Foundation

class TimeManager: ObservableObject {
    @Published var isWorking = false
    @Published var sessionStartTime: Date?
    @Published var sessionEndTime: Date?
    @Published var completedToday = false
    @Published var elapsedSeconds: Int = 0
    @Published var yearTotalHours: Double = 0
    @Published var restriction: String?
    @Published var restrictionMessage: String?
    @Published var dailyLimitReached = false
    @Published var isLoading = true
    @Published var errorMessage: String?

    private var timer: Timer?
    private let sessionToken: String

    static let annualGoal: Double = 2333

    init(sessionToken: String) {
        self.sessionToken = sessionToken
    }

    // MARK: - Time restriction check (client-side)

    var currentRestriction: String? {
        let now = Date()
        let calendar = Calendar.current
        let weekday = calendar.component(.weekday, from: now) // 1=Sun
        let hour = calendar.component(.hour, from: now)

        if weekday == 1 { return "sunday" }
        if hour < 5 { return "before_hours" }
        if hour >= 21 { return "after_hours" }
        return nil
    }

    var currentRestrictionMessage: String? {
        guard let r = currentRestriction else { return nil }
        switch r {
        case "sunday": return "It is Sunday, let us seize the means of relaxation."
        case "before_hours": return "Clock in/out is available from 5:00 AM."
        case "after_hours": return "Clock in/out is not available after 9:00 PM."
        default: return nil
        }
    }

    var isSunday: Bool {
        currentRestriction == "sunday"
    }

    var canPunch: Bool {
        currentRestriction == nil && !isLoading && !completedToday && !dailyLimitReached
    }

    var yearProgress: Double {
        min(yearTotalHours / Self.annualGoal, 1.0)
    }

    // MARK: - Load status

    func loadStatus() async {
        guard let url = URL(string: "\(APIConfig.baseURL)/api/time/status") else { return }

        var request = URLRequest(url: url)
        request.setValue("Bearer \(sessionToken)", forHTTPHeaderField: "Authorization")

        do {
            let (data, _) = try await URLSession.shared.data(for: request)
            let response = try JSONDecoder().decode(StatusResponse.self, from: data)

            await MainActor.run {
                self.isWorking = response.is_working
                self.yearTotalHours = response.year_total_hours
                self.restriction = response.restriction
                self.restrictionMessage = response.restriction_message
                self.dailyLimitReached = response.daily_limit_reached ?? false
                self.isLoading = false
                self.errorMessage = nil

                if response.is_working, let session = response.current_session {
                    self.sessionStartTime = Self.parseISO8601(session.start_time)
                    self.sessionEndTime = nil
                    self.completedToday = false
                    self.startTimer()
                } else if let today = response.today_session {
                    self.sessionStartTime = Self.parseISO8601(today.start_time)
                    self.sessionEndTime = today.end_time.flatMap { Self.parseISO8601($0) }
                    self.completedToday = self.sessionEndTime != nil
                    self.stopTimer()
                } else {
                    self.sessionStartTime = nil
                    self.sessionEndTime = nil
                    self.completedToday = false
                    self.stopTimer()
                }
            }
        } catch {
            await MainActor.run {
                self.isLoading = false
                self.errorMessage = "Failed to load status"
            }
        }
    }

    // MARK: - Clock in

    func clockIn() async {
        guard let url = URL(string: "\(APIConfig.baseURL)/api/time/clock-in") else { return }

        let timezone = TimeZone.current.identifier

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(sessionToken)", forHTTPHeaderField: "Authorization")

        let body: [String: String] = ["timezone": timezone]
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)

        do {
            let (data, httpResponse) = try await URLSession.shared.data(for: request)

            if let response = httpResponse as? HTTPURLResponse, response.statusCode == 201 {
                await loadStatus()
            } else if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                      let error = json["error"] as? String {
                await MainActor.run { self.errorMessage = error }
            }
        } catch {
            await MainActor.run { self.errorMessage = "Failed to clock in" }
        }
    }

    // MARK: - Clock out

    func clockOut() async {
        guard let url = URL(string: "\(APIConfig.baseURL)/api/time/clock-out") else { return }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(sessionToken)", forHTTPHeaderField: "Authorization")

        request.httpBody = try? JSONSerialization.data(withJSONObject: [:] as [String: String])

        do {
            let (data, httpResponse) = try await URLSession.shared.data(for: request)

            if let response = httpResponse as? HTTPURLResponse, response.statusCode == 200 {
                await loadStatus()
            } else if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                      let error = json["error"] as? String {
                await MainActor.run { self.errorMessage = error }
            }
        } catch {
            await MainActor.run { self.errorMessage = "Failed to clock out" }
        }
    }

    // MARK: - Timer

    func startTimer() {
        stopTimer()
        updateElapsed()
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            self?.updateElapsed()
        }
    }

    func stopTimer() {
        timer?.invalidate()
        timer = nil
        elapsedSeconds = 0
    }

    private func updateElapsed() {
        guard let start = sessionStartTime else { return }
        elapsedSeconds = Int(Date().timeIntervalSince(start))
    }

    var elapsedFormatted: String {
        let h = elapsedSeconds / 3600
        let m = (elapsedSeconds % 3600) / 60
        let s = elapsedSeconds % 60
        return String(format: "%02d:%02d:%02d", h, m, s)
    }

    // MARK: - Helpers

    static func parseISO8601(_ string: String) -> Date? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: string) { return date }
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.date(from: string)
    }

    static func formatTime(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "h:mm a"
        return formatter.string(from: date)
    }
}

// MARK: - Response types

struct StatusResponse: Codable {
    let is_working: Bool
    let current_session: CurrentSession?
    let today_session: TodaySession?
    let year_total_hours: Double
    let restriction: String?
    let restriction_message: String?
    let daily_limit_reached: Bool?
}

struct CurrentSession: Codable {
    let id: Int
    let start_time: String
    let timezone: String
}

struct TodaySession: Codable {
    let id: Int
    let start_time: String
    let end_time: String?
    let timezone: String
}
