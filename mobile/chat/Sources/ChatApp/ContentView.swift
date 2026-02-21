import ConvexShared
import SwiftUI

internal struct ContentView: View {
    var body: some View {
        AuthenticatedView { signOut in
            NavigationStack {
                ChatListView()
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) {
                            Button(action: signOut) {
                                Image(systemName: "rectangle.portrait.and.arrow.right")
                                    .accessibilityHidden(true)
                            }
                        }
                    }
                    .navigationDestination(for: String.self) { chatID in
                        ChatMessageView(chatID: chatID)
                    }
            }
        }
    }
}
