import Foundation

class TimeManager: ObservableObject {
    @Published var isWorking = false
    @Published var sessionStartTime: Date?
    @Published var elapsedSeconds: Int = 0
    @Published var yearTotalHours: Double = 0
    @Published var restriction: String?
    @Published var restrictionMessage: String?
    @Published var isLoading = true
    @Published var errorMessage: String?

    private var timer: Timer?
    private let sessionToken: String

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

    var canPunch: Bool {
        return currentRestriction == nil && !isLoading
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
                self.isLoading = false

                if response.is_working, let session = response.current_session {
                    let formatter = ISO8601DateFormatter()
                    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
                    if let start = formatter.date(from: session.start_time) {
                        self.sessionStartTime = start
                        self.startTimer()
                    } else {
                        // Try without fractional seconds
                        formatter.formatOptions = [.withInternetDateTime]
                        if let start = formatter.date(from: session.start_time) {
                            self.sessionStartTime = start
                            self.startTimer()
                        }
                    }
                } else {
                    self.sessionStartTime = nil
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

        let body: [String: Any] = [:]
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)

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
}

struct StatusResponse: Codable {
    let is_working: Bool
    let current_session: CurrentSession?
    let year_total_hours: Double
    let restriction: String?
    let restriction_message: String?
    let daily_limit_reached: Bool?
}

struct CurrentSession: Codable {
    let id: Int
    let start_time: String
    let timezone: String
    let elapsed_seconds: Int
}
