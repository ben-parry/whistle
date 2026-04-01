import SwiftUI

struct LoginView: View {
    @EnvironmentObject var authManager: AuthManager

    @State private var email = ""
    @State private var password = ""
    @State private var errorMessage: String?
    @State private var isLoading = false

    var body: some View {
        VStack(spacing: 0) {
            Spacer()

            // Logo
            VStack(spacing: 8) {
                Text("Whistle")
                    .font(.system(size: 48, weight: .bold, design: .serif))
                    .foregroundColor(Color(hex: "1A1714"))

                Text("Your Personal Punch Clock")
                    .font(.subheadline)
                    .foregroundColor(Color(hex: "8A7D73"))
                    .italic()
            }
            .padding(.bottom, 40)

            // Login form
            VStack(spacing: 20) {
                if let error = errorMessage {
                    Text(error)
                        .font(.footnote)
                        .foregroundColor(Color(hex: "8F3416"))
                        .padding(12)
                        .frame(maxWidth: .infinity)
                        .background(Color(hex: "8F3416").opacity(0.08))
                        .overlay(
                            RoundedRectangle(cornerRadius: 4)
                                .stroke(Color(hex: "8F3416").opacity(0.25), lineWidth: 1)
                        )
                }

                VStack(alignment: .leading, spacing: 6) {
                    Text("Email")
                        .font(.footnote)
                        .fontWeight(.medium)
                        .foregroundColor(Color(hex: "1A1714"))
                    TextField("you@example.com", text: $email)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .autocapitalization(.none)
                        .disableAutocorrection(true)
                        .padding(12)
                        .background(Color(hex: "F5DCC3"))
                        .overlay(
                            RoundedRectangle(cornerRadius: 4)
                                .stroke(Color(hex: "C4956A").opacity(0.5), lineWidth: 1)
                        )
                }

                VStack(alignment: .leading, spacing: 6) {
                    Text("Password")
                        .font(.footnote)
                        .fontWeight(.medium)
                        .foregroundColor(Color(hex: "1A1714"))
                    SecureField("Your password", text: $password)
                        .textContentType(.password)
                        .padding(12)
                        .background(Color(hex: "F5DCC3"))
                        .overlay(
                            RoundedRectangle(cornerRadius: 4)
                                .stroke(Color(hex: "C4956A").opacity(0.5), lineWidth: 1)
                        )
                }

                Button(action: login) {
                    if isLoading {
                        ProgressView()
                            .tint(.white)
                            .frame(maxWidth: .infinity)
                            .padding(12)
                    } else {
                        Text("Sign In")
                            .font(.system(size: 16, weight: .semibold, design: .serif))
                            .frame(maxWidth: .infinity)
                            .padding(12)
                    }
                }
                .background(Color(hex: "8F3416"))
                .foregroundColor(.white)
                .cornerRadius(4)
                .disabled(isLoading || email.isEmpty || password.isEmpty)
                .opacity((isLoading || email.isEmpty || password.isEmpty) ? 0.6 : 1)
            }
            .padding(24)
            .background(Color(hex: "EBCAA0"))
            .cornerRadius(6)
            .overlay(
                RoundedRectangle(cornerRadius: 6)
                    .stroke(Color(hex: "C4956A").opacity(0.4), lineWidth: 1)
            )
            .padding(.horizontal, 24)

            // Create account link
            VStack(spacing: 6) {
                Text("Don't have an account?")
                    .font(.footnote)
                    .foregroundColor(Color(hex: "8A7D73"))

                Link("Create one on the web",
                     destination: URL(string: "\(APIConfig.baseURL)")!)
                    .font(.footnote)
                    .foregroundColor(Color(hex: "8F3416"))
            }
            .padding(.top, 24)

            Spacer()

            Text("\u{2726}")
                .font(.title2)
                .foregroundColor(Color(hex: "C4956A").opacity(0.5))
                .padding(.bottom, 20)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(hex: "F5DCC3"))
    }

    private func login() {
        isLoading = true
        errorMessage = nil

        Task {
            let error = try? await authManager.login(email: email, password: password)
            await MainActor.run {
                isLoading = false
                errorMessage = error
            }
        }
    }
}

// MARK: - Color extension for hex values

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 6:
            (a, r, g, b) = (255, (int >> 16) & 0xFF, (int >> 8) & 0xFF, int & 0xFF)
        case 8:
            (a, r, g, b) = ((int >> 24) & 0xFF, (int >> 16) & 0xFF, (int >> 8) & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}
