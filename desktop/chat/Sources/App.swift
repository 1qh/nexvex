import ConvexCore
import DefaultBackend
import DesktopShared
import SwiftCrossUI

let client = ConvexClient(deploymentURL: convexBaseURL)
let auth = AuthClient(convexURL: convexBaseURL)

@main
struct ChatApp: App {
    @State var path = NavigationPath()
    @State var isAuthenticated = false

    var body: some Scene {
        WindowGroup("Chat") {
            VStack {
                if isAuthenticated {
                    HStack {
                        Button("Chats") {
                            path = NavigationPath()
                        }
                        Button("Sign Out") {
                            auth.signOut()
                            client.setAuth(token: nil)
                            isAuthenticated = false
                        }
                    }
                    .padding(.bottom, 4)

                    NavigationStack(path: $path) {
                        ListView(path: $path)
                    }
                    .navigationDestination(for: String.self) { chatID in
                        MessageView(chatID: chatID, path: $path)
                    }
                } else {
                    AuthView(onAuth: {
                        isAuthenticated = true
                        client.setAuth(token: auth.token)
                    })
                }
            }
            .padding(10)
        }
        .defaultSize(width: 900, height: 700)
    }
}
