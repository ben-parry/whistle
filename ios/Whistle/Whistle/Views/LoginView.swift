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
                    .font(.custom("PlayfairDisplay-Bold", size: 48, relativeTo: .largeTitle))
                    .foregroundColor(Color(hex: "332F35"))

                Text("Your Personal Punch Clock")
                    .font(.subheadline)
                    .foregroundColor(Color(hex: "9D8F86"))
                    .italic()
            }
            .padding(.bottom, 40)

            // Login form
            VStack(spacing: 20) {
                if let error = errorMessage {
                    Text(error)
                        .font(.footnote)
                        .foregroundColor(Color(hex: "D38370"))
                        .padding(12)
                        .frame(maxWidth: .infinity)
                        .background(Color(hex: "D38370").opacity(0.1))
                        .overlay(
                            RoundedRectangle(cornerRadius: 0)
                                .stroke(Color(hex: "D38370").opacity(0.3), lineWidth: 1)
                        )
                }

                VStack(alignment: .leading, spacing: 6) {
                    Text("Email")
                        .font(.footnote)
                        .fontWeight(.medium)
                        .foregroundColor(Color(hex: "332F35"))
                    TextField("you@example.com", text: $email)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .autocapitalization(.none)
                        .disableAutocorrection(true)
                        .padding(12)
                        .background(Color(hex: "F0EAD9"))
                        .overlay(
                            Rectangle().stroke(Color(hex: "C2CDCD"), lineWidth: 1)
                        )
                }

                VStack(alignment: .leading, spacing: 6) {
                    Text("Password")
                        .font(.footnote)
                        .fontWeight(.medium)
                        .foregroundColor(Color(hex: "332F35"))
                    SecureField("Your password", text: $password)
                        .textContentType(.password)
                        .padding(12)
                        .background(Color(hex: "F0EAD9"))
                        .overlay(
                            Rectangle().stroke(Color(hex: "C2CDCD"), lineWidth: 1)
                        )
                }

                Button(action: login) {
                    if isLoading {
                        ProgressView()
                            .tint(Color(hex: "F0EAD9"))
                            .frame(maxWidth: .infinity)
                            .padding(12)
                    } else {
                        Text("Sign In")
                            .fontWeight(.medium)
                            .frame(maxWidth: .infinity)
                            .padding(12)
                    }
                }
                .background(Color(hex: "332F35"))
                .foregroundColor(Color(hex: "F0EAD9"))
                .disabled(isLoading || email.isEmpty || password.isEmpty)
                .opacity((isLoading || email.isEmpty || password.isEmpty) ? 0.6 : 1)
            }
            .padding(24)
            .background(Color(hex: "E3D7BF"))
            .overlay(
                Rectangle().stroke(Color(hex: "C2CDCD"), lineWidth: 1)
            )
            .padding(.horizontal, 20)

            // Create account link
            VStack(spacing: 8) {
                Text("Don't have an account?")
                    .font(.footnote)
                    .foregroundColor(Color(hex: "9D8F86"))

                Link("Create one at whistle on the web",
                     destination: URL(string: "\(APIConfig.baseURL)")!)
                    .font(.footnote)
                    .foregroundColor(Color(hex: "4380A4"))
            }
            .padding(.top, 24)

            Spacer()

            // Ornament
            Text("\u{2726}")
                .font(.title2)
                .foregroundColor(Color(hex: "C2CDCD"))
                .padding(.bottom, 20)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(hex: "F0EAD9"))
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
