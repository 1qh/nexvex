import ConvexCore
import DefaultBackend
import DesktopShared
import SwiftCrossUI

let client = ConvexClient(deploymentURL: convexBaseURL)
let auth = AuthClient(convexURL: convexBaseURL)
let fileClient = FileClient(client: client)

@main
struct BlogApp: App {
    @State var path = NavigationPath()
    @State var isAuthenticated = false
    @State var showCreateForm = false

    var body: some Scene {
        WindowGroup("Blog") {
            VStack {
                if isAuthenticated {
                    HStack {
                        Button("Posts") {
                            path = NavigationPath()
                        }
                        Button("Profile") {
                            path = NavigationPath()
                            path.append(BlogRoute.profile)
                        }
                        Button("New Post") {
                            showCreateForm = true
                        }
                        Button("Sign Out") {
                            auth.signOut()
                            client.setAuth(token: nil)
                            isAuthenticated = false
                        }
                    }
                    .padding(.bottom, 4)

                    if showCreateForm {
                        FormView(mode: .create) {
                            showCreateForm = false
                        }
                    } else {
                        NavigationStack(path: $path) {
                            ListView(path: $path)
                        }
                        .navigationDestination(for: String.self) { blogID in
                            DetailView(blogID: blogID, path: $path)
                        }
                        .navigationDestination(for: BlogRoute.self) { route in
                            switch route {
                            case .profile:
                                ProfileView()
                            }
                        }
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

enum BlogRoute: Codable {
    case profile
}
