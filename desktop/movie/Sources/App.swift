import ConvexCore
import DefaultBackend
import DesktopShared
import SwiftCrossUI

let client = ConvexClient(deploymentURL: convexBaseURL)

@main
struct MovieApp: App {
    @State private var path = NavigationPath()

    var body: some Scene {
        WindowGroup("Movie") {
            NavigationStack(path: $path) {
                SearchView(path: $path)
            }
            .navigationDestination(for: Int.self) { tmdbID in
                DetailView(tmdbID: tmdbID, path: $path)
            }
            .padding(10)
        }
        .defaultSize(width: 900, height: 700)
    }
}
