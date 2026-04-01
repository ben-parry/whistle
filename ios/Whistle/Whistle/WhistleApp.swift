import SwiftUI

@main
struct WhistleApp: App {
    @StateObject private var authManager = AuthManager()

    var body: some Scene {
        WindowGroup {
            if authManager.isLoggedIn, let token = authManager.sessionToken {
                PunchClockView(sessionToken: token)
                    .environmentObject(authManager)
                    .id(token)
            } else {
                LoginView()
                    .environmentObject(authManager)
            }
        }
    }
}
