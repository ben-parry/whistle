import SwiftUI

struct PunchClockView: View {
    @EnvironmentObject var authManager: AuthManager
    @StateObject private var timeManager: TimeManager

    @State private var showLogoutConfirm = false

    init() {
        // We'll set the actual token in onAppear
        _timeManager = StateObject(wrappedValue: TimeManager(sessionToken: ""))
    }

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Text("Whistle")
                    .font(.custom("PlayfairDisplay-Bold", size: 24, relativeTo: .title))
                    .foregroundColor(Color(hex: "332F35"))

                Spacer()

                Button("Sign Out") {
                    showLogoutConfirm = true
                }
                .font(.subheadline)
                .foregroundColor(Color(hex: "D38370"))
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 16)
            .overlay(
                Rectangle()
                    .frame(height: 1)
                    .foregroundColor(Color(hex: "C2CDCD")),
                alignment: .bottom
            )

            Spacer()

            if timeManager.isLoading {
                ProgressView()
                    .tint(Color(hex: "9D8F86"))
                Spacer()
            } else {
                // Status display
                VStack(spacing: 12) {
                    if let restriction = timeManager.currentRestriction {
                        Text(timeManager.currentRestrictionMessage ?? "")
                            .font(.custom("PlayfairDisplay-Regular", size: 20, relativeTo: .title3))
                            .foregroundColor(Color(hex: "9D8F86"))
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 20)

                        if restriction == "sunday" {
                            Link("@lavitalenta", destination: URL(string: "https://x.com/lavitalenta")!)
                                .font(.footnote)
                                .foregroundColor(Color(hex: "D38370"))
                        }
                    } else if timeManager.isWorking {
                        Text("Currently Working")
                            .font(.custom("PlayfairDisplay-SemiBold", size: 22, relativeTo: .title3))
                            .foregroundColor(Color(hex: "D38370"))

                        Text(timeManager.elapsedFormatted)
                            .font(.system(size: 44, weight: .bold, design: .monospaced))
                            .foregroundColor(Color(hex: "332F35"))
                            .tracking(2)
                    } else {
                        Text("Not Working")
                            .font(.custom("PlayfairDisplay-Regular", size: 22, relativeTo: .title3))
                            .foregroundColor(Color(hex: "9D8F86"))
                    }
                }
                .padding(.bottom, 32)

                // Punch button
                Button(action: punch) {
                    Text(timeManager.isWorking ? "Clock Out" : "Clock In")
                        .font(.custom("PlayfairDisplay-SemiBold", size: 20, relativeTo: .title3))
                        .foregroundColor(Color(hex: "F5F0E3"))
                        .frame(width: 200, height: 60)
                        .background(timeManager.isWorking
                            ? Color(hex: "D38370")
                            : Color(hex: "D38370"))
                }
                .disabled(!timeManager.canPunch)
                .opacity(timeManager.canPunch ? 1 : 0.6)

                if let error = timeManager.errorMessage {
                    Text(error)
                        .font(.footnote)
                        .foregroundColor(Color(hex: "D38370"))
                        .padding(.top, 16)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 20)
                }

                Spacer()

                // Web prompt
                VStack(spacing: 8) {
                    Rectangle()
                        .frame(height: 1)
                        .foregroundColor(Color(hex: "C2CDCD"))
                        .padding(.horizontal, 40)

                    Text("Visit Whistle on the web for stats, history, and more.")
                        .font(.footnote)
                        .foregroundColor(Color(hex: "9D8F86"))
                        .multilineTextAlignment(.center)

                    Link(APIConfig.baseURL.replacingOccurrences(of: "https://", with: ""),
                         destination: URL(string: APIConfig.baseURL)!)
                        .font(.footnote)
                        .foregroundColor(Color(hex: "D38370"))
                }
                .padding(.bottom, 20)

                // Ornament
                Text("\u{2726}")
                    .font(.title2)
                    .foregroundColor(Color(hex: "C2CDCD"))
                    .padding(.bottom, 20)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(hex: "F5F0E3"))
        .onAppear {
            if let token = authManager.sessionToken {
                let manager = TimeManager(sessionToken: token)
                // We need to replace the timeManager — but since it's a @StateObject
                // we initialized with empty token, so we load status via a task
                Task {
                    await loadWithToken(token)
                }
            }
        }
        .alert("Sign Out?", isPresented: $showLogoutConfirm) {
            Button("Cancel", role: .cancel) {}
            Button("Sign Out", role: .destructive) {
                Task { await authManager.logout() }
            }
        }
    }

    private func loadWithToken(_ token: String) async {
        // Create a new time manager with the correct token and load
        let manager = TimeManager(sessionToken: token)
        await manager.loadStatus()

        await MainActor.run {
            // Since we can't reassign @StateObject, we need a different approach
            // We'll work around this by making TimeManager update from token
        }
    }

    private func punch() {
        guard let token = authManager.sessionToken else { return }
        let manager = TimeManager(sessionToken: token)

        Task {
            if timeManager.isWorking {
                await manager.clockOut()
            } else {
                await manager.clockIn()
            }
            // Reload status in the actual timeManager
            await reloadStatus()
        }
    }

    private func reloadStatus() async {
        guard let token = authManager.sessionToken else { return }
        guard let url = URL(string: "\(APIConfig.baseURL)/api/time/status") else { return }

        var request = URLRequest(url: url)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        do {
            let (data, _) = try await URLSession.shared.data(for: request)
            let response = try JSONDecoder().decode(StatusResponse.self, from: data)

            await MainActor.run {
                timeManager.isWorking = response.is_working
                timeManager.yearTotalHours = response.year_total_hours
                timeManager.restriction = response.restriction
                timeManager.restrictionMessage = response.restriction_message
                timeManager.isLoading = false
                timeManager.errorMessage = nil

                if response.is_working, let session = response.current_session {
                    let formatter = ISO8601DateFormatter()
                    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
                    if let start = formatter.date(from: session.start_time) {
                        timeManager.sessionStartTime = start
                        timeManager.startTimer()
                    } else {
                        formatter.formatOptions = [.withInternetDateTime]
                        if let start = formatter.date(from: session.start_time) {
                            timeManager.sessionStartTime = start
                            timeManager.startTimer()
                        }
                    }
                } else {
                    timeManager.sessionStartTime = nil
                    timeManager.stopTimer()
                }
            }
        } catch {
            await MainActor.run {
                timeManager.isLoading = false
            }
        }
    }
}
