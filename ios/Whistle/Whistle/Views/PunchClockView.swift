import SwiftUI

struct PunchClockView: View {
    @EnvironmentObject var authManager: AuthManager
    @StateObject private var timeManager: TimeManager
    @State private var showLogoutConfirm = false

    init(sessionToken: String) {
        _timeManager = StateObject(wrappedValue: TimeManager(sessionToken: sessionToken))
    }

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Text("Whistle")
                    .font(.system(size: 24, weight: .bold, design: .serif))
                    .foregroundColor(Color(hex: "1A1714"))

                Spacer()

                Button("Sign Out") {
                    showLogoutConfirm = true
                }
                .font(.footnote)
                .foregroundColor(Color(hex: "8A7D73"))
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 16)
            .overlay(
                Rectangle()
                    .frame(height: 1)
                    .foregroundColor(Color(hex: "C4956A").opacity(0.3)),
                alignment: .bottom
            )

            if timeManager.isLoading {
                Spacer()
                ProgressView()
                    .tint(Color(hex: "8A7D73"))
                Spacer()
            } else if timeManager.isSunday {
                sundayView
            } else {
                clockView
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(hex: "F5DCC3"))
        .onAppear {
            Task { await timeManager.loadStatus() }
        }
        .alert("Sign Out?", isPresented: $showLogoutConfirm) {
            Button("Cancel", role: .cancel) {}
            Button("Sign Out", role: .destructive) {
                Task { await authManager.logout() }
            }
        }
    }

    // MARK: - Sunday view

    private var sundayView: some View {
        VStack(spacing: 16) {
            Spacer()

            Text("It is Sunday, let us seize\nthe means of relaxation.")
                .font(.system(size: 20, weight: .regular, design: .serif))
                .foregroundColor(Color(hex: "8A7D73"))
                .multilineTextAlignment(.center)
                .lineSpacing(4)

            Link("lavitalenta.substack.com",
                 destination: URL(string: "https://lavitalenta.substack.com/")!)
                .font(.footnote)
                .foregroundColor(Color(hex: "8F3416"))

            Spacer()

            ornament
        }
    }

    // MARK: - Clock view

    private var clockView: some View {
        VStack(spacing: 0) {
            Spacer()

            // Restriction message
            if let restriction = timeManager.currentRestriction {
                VStack(spacing: 8) {
                    Text(timeManager.currentRestrictionMessage ?? "")
                        .font(.system(size: 18, weight: .regular, design: .serif))
                        .foregroundColor(Color(hex: "8A7D73"))
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 32)
                }
            }
            // Currently working
            else if timeManager.isWorking {
                workingView
            }
            // Completed for today
            else if timeManager.completedToday {
                completedView
            }
            // Ready to clock in
            else {
                readyView
            }

            Spacer()

            // Year progress
            if timeManager.currentRestriction == nil {
                yearProgressView
                    .padding(.bottom, 16)
            }

            // Error message
            if let error = timeManager.errorMessage {
                Text(error)
                    .font(.footnote)
                    .foregroundColor(Color(hex: "8F3416"))
                    .padding(.horizontal, 20)
                    .padding(.bottom, 12)
                    .multilineTextAlignment(.center)
            }

            // Web link
            HStack(spacing: 4) {
                Text("Stats & history on")
                    .font(.caption2)
                    .foregroundColor(Color(hex: "8A7D73"))
                Link("the web", destination: URL(string: APIConfig.baseURL)!)
                    .font(.caption2)
                    .foregroundColor(Color(hex: "8F3416"))
            }
            .padding(.bottom, 12)

            ornament
        }
    }

    // MARK: - Working state

    private var workingView: some View {
        VStack(spacing: 16) {
            Text(timeManager.elapsedFormatted)
                .font(.system(size: 52, weight: .light, design: .monospaced))
                .foregroundColor(Color(hex: "1A1714"))
                .tracking(2)

            if let start = timeManager.sessionStartTime {
                Text("Clocked in at \(TimeManager.formatTime(start))")
                    .font(.footnote)
                    .foregroundColor(Color(hex: "8A7D73"))
            }

            Button(action: { Task { await timeManager.clockOut() } }) {
                Text("Clock Out")
                    .font(.system(size: 17, weight: .semibold, design: .serif))
                    .foregroundColor(.white)
                    .frame(width: 200, height: 52)
                    .background(Color(hex: "8F3416"))
                    .cornerRadius(6)
            }
            .padding(.top, 8)
        }
    }

    // MARK: - Completed state

    private var completedView: some View {
        VStack(spacing: 16) {
            Text("See you tomorrow")
                .font(.system(size: 22, weight: .regular, design: .serif))
                .foregroundColor(Color(hex: "1A1714"))

            if let start = timeManager.sessionStartTime,
               let end = timeManager.sessionEndTime {
                HStack(spacing: 16) {
                    VStack(spacing: 2) {
                        Text("In")
                            .font(.caption2)
                            .foregroundColor(Color(hex: "8A7D73"))
                        Text(TimeManager.formatTime(start))
                            .font(.system(size: 15, weight: .medium, design: .monospaced))
                            .foregroundColor(Color(hex: "1A1714"))
                    }

                    Rectangle()
                        .frame(width: 1, height: 28)
                        .foregroundColor(Color(hex: "C4956A").opacity(0.3))

                    VStack(spacing: 2) {
                        Text("Out")
                            .font(.caption2)
                            .foregroundColor(Color(hex: "8A7D73"))
                        Text(TimeManager.formatTime(end))
                            .font(.system(size: 15, weight: .medium, design: .monospaced))
                            .foregroundColor(Color(hex: "1A1714"))
                    }
                }
                .padding(16)
                .background(Color(hex: "EBCAA0"))
                .cornerRadius(6)
                .overlay(
                    RoundedRectangle(cornerRadius: 6)
                        .stroke(Color(hex: "C4956A").opacity(0.3), lineWidth: 1)
                )
            }
        }
    }

    // MARK: - Ready state

    private var readyView: some View {
        VStack(spacing: 20) {
            if timeManager.dailyLimitReached {
                Text("Daily limit reached (12 hours)")
                    .font(.system(size: 16, weight: .regular, design: .serif))
                    .foregroundColor(Color(hex: "8A7D73"))
            } else {
                Button(action: { Task { await timeManager.clockIn() } }) {
                    Text("Clock In")
                        .font(.system(size: 17, weight: .semibold, design: .serif))
                        .foregroundColor(.white)
                        .frame(width: 200, height: 52)
                        .background(Color(hex: "7D8F67"))
                        .cornerRadius(6)
                }
            }
        }
    }

    // MARK: - Year progress

    private var yearProgressView: some View {
        VStack(spacing: 6) {
            HStack {
                Text(String(format: "%.0f hours", timeManager.yearTotalHours))
                    .font(.caption)
                    .foregroundColor(Color(hex: "1A1714"))
                Spacer()
                Text(String(format: "%.0f goal", TimeManager.annualGoal))
                    .font(.caption)
                    .foregroundColor(Color(hex: "8A7D73"))
            }

            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 3)
                        .fill(Color(hex: "EBCAA0"))
                        .frame(height: 6)

                    RoundedRectangle(cornerRadius: 3)
                        .fill(Color(hex: "6C7A61"))
                        .frame(width: geo.size.width * timeManager.yearProgress, height: 6)
                }
            }
            .frame(height: 6)
        }
        .padding(.horizontal, 32)
    }

    // MARK: - Ornament

    private var ornament: some View {
        Text("\u{2726}")
            .font(.title2)
            .foregroundColor(Color(hex: "C4956A").opacity(0.4))
            .padding(.bottom, 20)
    }
}
