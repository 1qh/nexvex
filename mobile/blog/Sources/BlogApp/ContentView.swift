import ConvexShared
import SwiftUI

internal enum BlogTab: String, Hashable {
    case posts
    case profile
}

internal struct ContentView: View {
    @State private var selectedTab = BlogTab.posts

    var body: some View {
        AuthenticatedView { signOut in
            TabView(selection: $selectedTab) {
                NavigationStack {
                    BlogListView()
                }
                .tabItem { Label("Posts", systemImage: "doc.text") }
                .tag(BlogTab.posts)

                NavigationStack {
                    ProfileView()
                }
                .tabItem { Label("Profile", systemImage: "person.circle") }
                .tag(BlogTab.profile)
            }
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button(action: signOut) {
                        Image(systemName: "rectangle.portrait.and.arrow.right")
                            .accessibilityHidden(true)
                    }
                }
            }
        }
    }
}
