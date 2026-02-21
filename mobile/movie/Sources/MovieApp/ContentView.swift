import ConvexShared
import SwiftUI

internal enum AppTab: String, Hashable {
    case fetch
    case search
}

internal struct ContentView: View {
    @State private var selectedTab = AppTab.search

    var body: some View {
        TabView(selection: $selectedTab) {
            NavigationStack {
                SearchView()
                    .navigationDestination(for: Int.self) { tmdbID in
                        DetailView(tmdbID: tmdbID)
                    }
            }
            .tabItem { Label("Search", systemImage: "magnifyingglass") }
            .tag(AppTab.search)

            NavigationStack {
                FetchByIDView()
            }
            .tabItem { Label("Fetch", systemImage: "arrow.down.circle") }
            .tag(AppTab.fetch)
        }
    }
}
