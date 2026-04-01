import Foundation
import SwiftUI

class AuthManager: ObservableObject {
    @Published var isLoggedIn = false
    @Published var userName: String = ""
    @Published var userEmail: String = ""

    private let sessionKey = "whistle_session_token"

    var sessionToken: String? {
        get { UserDefaults.standard.string(forKey: sessionKey) }
        set {
            UserDefaults.standard.set(newValue, forKey: sessionKey)
            isLoggedIn = newValue != nil
        }
    }

    init() {
        isLoggedIn = UserDefaults.standard.string(forKey: sessionKey) != nil
        if isLoggedIn {
            Task { await checkSession() }
        }
    }

    func checkSession() async {
        guard let token = sessionToken else { return }
        guard let url = URL(string: "\(APIConfig.baseURL)/api/auth/me") else { return }

        var request = URLRequest(url: url)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        do {
            let (data, _) = try await URLSession.shared.data(for: request)
            let response = try JSONDecoder().decode(MeResponse.self, from: data)

            await MainActor.run {
                if let user = response.user {
                    self.userName = user.name ?? ""
                    self.userEmail = user.email
                    self.isLoggedIn = true
                } else {
                    self.sessionToken = nil
                }
            }
        } catch {
            await MainActor.run {
                self.sessionToken = nil
            }
        }
    }

    func login(email: String, password: String) async throws -> String? {
        guard let url = URL(string: "\(APIConfig.baseURL)/api/auth/login") else {
            return "Invalid URL"
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body = ["email": email, "password": password]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, httpResponse) = try await URLSession.shared.data(for: request)

        guard let response = httpResponse as? HTTPURLResponse else {
            return "Login failed. Please try again."
        }

        let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any]

        if response.statusCode == 200, let token = json?["session_token"] as? String {
            await MainActor.run {
                self.sessionToken = token
            }
            await checkSession()
            return nil
        }

        if let error = json?["error"] as? String {
            return error
        }

        return "Login failed. Please try again."
    }

    func logout() async {
        guard let token = sessionToken else { return }
        guard let url = URL(string: "\(APIConfig.baseURL)/api/auth/logout") else { return }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        _ = try? await URLSession.shared.data(for: request)

        await MainActor.run {
            self.sessionToken = nil
            self.userName = ""
            self.userEmail = ""
        }
    }
}

struct MeResponse: Codable {
    let user: MeUser?
}

struct MeUser: Codable {
    let id: Int
    let email: String
    let name: String?
    let cute_id: String?
}
