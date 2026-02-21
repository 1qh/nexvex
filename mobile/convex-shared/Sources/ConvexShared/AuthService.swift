import Foundation
import SkipKeychain
#if !SKIP
import AuthenticationServices
#else
import SkipAuthenticationServices
#endif

public enum AppAuthState {
    case authenticated(String)
    case loading
    case unauthenticated
}

public final class AuthService: @unchecked Sendable {
    nonisolated(unsafe) public static let shared = AuthService()

    public var authState = AppAuthState.unauthenticated

    public var currentToken: String?

    public var authError: String?

    public var isAuthenticated: Bool {
        if case .authenticated = authState {
            return true
        }
        return false
    }

    private let tokenKey = "convex_auth_token"

    private let keychain = Keychain.shared

    private init() {
        _ = ()
    }

    public func restoreFromCache() async {
        authState = .loading
        do {
            if let token = try keychain.string(forKey: tokenKey) {
                currentToken = token
                try await ConvexService.shared.setAuth(token: token)
                authState = .authenticated(token)
                return
            }
        } catch {
            authError = error.localizedDescription
        }
        authState = .unauthenticated
    }

    public func signInWithPassword(email: String, password: String, convexURL: String) async throws {
        authState = .loading
        authError = nil
        do {
            let token = try await performPasswordAuth(
                email: email,
                password: password,
                flow: "signIn",
                convexURL: convexURL
            )
            try keychain.set(token, forKey: tokenKey)
            currentToken = token
            authState = .authenticated(token)
        } catch {
            authState = .unauthenticated
            authError = error.localizedDescription
            throw error
        }
    }

    public func signUpWithPassword(email: String, password: String, convexURL: String) async throws {
        authState = .loading
        authError = nil
        do {
            let token = try await performPasswordAuth(
                email: email,
                password: password,
                flow: "signUp",
                convexURL: convexURL
            )
            try keychain.set(token, forKey: tokenKey)
            currentToken = token
            authState = .authenticated(token)
        } catch {
            authState = .unauthenticated
            authError = error.localizedDescription
            throw error
        }
    }

    #if !SKIP
    public func signInWithGoogle(
        convexURL: String,
        callbackScheme: String = "dev.lazyconvex"
    ) async throws {
        authState = .loading
        authError = nil
        do {
            let (redirectURLString, verifier) = try await startOAuth(convexURL: convexURL)
            guard let redirectURL = URL(string: redirectURLString) else {
                throw ConvexError.serverError("Invalid redirect URL")
            }

            let callbackURL = try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<URL, Error>) in
                let session = ASWebAuthenticationSession(
                    url: redirectURL,
                    callbackURLScheme: callbackScheme
                ) { url, sessionError in
                    if let sessionError {
                        continuation.resume(throwing: sessionError)
                    } else if let url {
                        continuation.resume(returning: url)
                    } else {
                        continuation.resume(throwing: ConvexError.serverError("No callback URL"))
                    }
                }
                session.prefersEphemeralWebBrowserSession = false
                session.start()
            }
            let code = try extractCode(from: callbackURL)
            let extractedToken = try await finishOAuth(convexURL: convexURL, code: code, verifier: verifier)
            try keychain.set(extractedToken, forKey: tokenKey)
            currentToken = extractedToken
            try await ConvexService.shared.setAuth(token: extractedToken)
            authState = .authenticated(extractedToken)
        } catch {
            authState = .unauthenticated
            authError = error.localizedDescription
            throw error
        }
    }
    #else
    public func signInWithGoogle(
        session: WebAuthenticationSession,
        convexURL: String,
        callbackScheme: String = "dev.lazyconvex"
    ) async throws {
        authState = .loading
        authError = nil
        do {
            let (redirectURLString, verifier) = try await startOAuth(convexURL: convexURL)
            guard let redirectURL = URL(string: redirectURLString) else {
                throw ConvexError.serverError("Invalid redirect URL")
            }

            let callbackURL = try await session.authenticate(
                using: redirectURL,
                callbackURLScheme: callbackScheme
            )
            let code = try extractCode(from: callbackURL)
            let extractedToken = try await finishOAuth(convexURL: convexURL, code: code, verifier: verifier)
            try keychain.set(extractedToken, forKey: tokenKey)
            currentToken = extractedToken
            try await ConvexService.shared.setAuth(token: extractedToken)
            authState = .authenticated(extractedToken)
        } catch {
            authState = .unauthenticated
            authError = error.localizedDescription
            throw error
        }
    }
    #endif

    public func signOut() async {
        do {
            try keychain.removeValue(forKey: tokenKey)
            try await ConvexService.shared.setAuth(token: nil)
        } catch {
            authError = error.localizedDescription
        }
        currentToken = nil
        authState = .unauthenticated
    }

    private func extractCode(from url: URL) throws -> String {
        let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
        if let items = components?.queryItems {
            for item in items where item.name == "code" {
                if let value = item.value {
                    return value
                }
            }
        }
        throw ConvexError.serverError("No code in callback URL")
    }

    private func startOAuth(convexURL: String) async throws -> (String, String) {
        guard let url = URL(string: "\(convexURL)/api/auth/signin") else {
            throw ConvexError.serverError("Invalid auth URL")
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let params = ["redirectTo": "dev.lazyconvex://auth"]
        let body: [String: Any] = ["provider": "google", "params": params]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, _) = try await URLSession.shared.data(for: request)
        guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let redirect = json["redirect"] as? String,
              let verifier = json["verifier"] as? String else {
            throw ConvexError.decodingError("No redirect/verifier in response")
        }

        return (redirect, verifier)
    }

    private func finishOAuth(convexURL: String, code: String, verifier: String) async throws -> String {
        guard let url = URL(string: "\(convexURL)/api/auth/signin") else {
            throw ConvexError.serverError("Invalid auth URL")
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let params: [String: String] = ["code": code]
        let body: [String: Any] = ["params": params, "verifier": verifier]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, _) = try await URLSession.shared.data(for: request)
        guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let token = json["token"] as? String else {
            throw ConvexError.decodingError("No token in verification response")
        }

        return token
    }

    private func performPasswordAuth(
        email: String,
        password: String,
        flow: String,
        convexURL: String
    ) async throws -> String {
        guard let url = URL(string: "\(convexURL)/api/auth/signin") else {
            throw ConvexError.serverError("Invalid auth URL")
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let params: [String: String] = [
            "email": email,
            "password": password,
            "flow": flow,
        ]
        let body: [String: Any] = [
            "provider": "password",
            "params": params,
        ]

        let bodyData = try JSONSerialization.data(withJSONObject: body)
        request.httpBody = bodyData

        let (data, response) = try await URLSession.shared.data(for: request)

        #if !SKIP
        guard let httpResponse = response as? HTTPURLResponse else {
            throw ConvexError.serverError("Invalid response")
        }
        guard httpResponse.statusCode == 200 else {
            let errorBody = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw ConvexError.serverError("Auth failed: \(errorBody)")
        }

        #endif

        guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw ConvexError.decodingError("Invalid JSON response")
        }
        guard let token = json["token"] as? String else {
            throw ConvexError.decodingError("No token in response")
        }

        return token
    }
}
