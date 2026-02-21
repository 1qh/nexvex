import ConvexShared
import Foundation
import Observation

@MainActor
@Observable
internal final class ChatListViewModel {
    var chats = [Chat]()

    var isLoading = false

    var errorMessage: String?

    private var subscriptionID: String?

    func startSubscription() {
        stopSubscription()
        isLoading = true
        errorMessage = nil

        let args: [String: Any] = [
            "paginationOpts": ["cursor": NSNull(), "numItems": 50] as [String: Any],
            "where": ["own": true] as [String: Any],
        ]

        #if !SKIP
        subscriptionID = ConvexService.shared.subscribe(
            to: "chat:list",
            args: args,
            type: PaginatedResult<Chat>.self,
            onUpdate: { [weak self] (result: PaginatedResult<Chat>) in
                guard let self else {
                    return
                }

                chats = result.page
                isLoading = false
            },
            onError: { [weak self] error in
                self?.errorMessage = error.localizedDescription
                self?.isLoading = false
            }
        )
        #else
        subscriptionID = ConvexService.shared.subscribePaginatedChats(
            to: "chat:list",
            args: args,
            onUpdate: { result in
                self.chats = Array(result.page)
                self.isLoading = false
            },
            onError: { error in
                self.errorMessage = error.localizedDescription
                self.isLoading = false
            }
        )
        #endif
    }

    func stopSubscription() {
        cancelSubscription(&subscriptionID)
    }

    func createChat() {
        Task {
            do {
                try await ConvexService.shared.mutate("chat:create", args: [
                    "title": "New Chat",
                    "isPublic": false,
                ])
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    func deleteChat(id: String) {
        Task {
            do {
                try await ConvexService.shared.mutate("chat:rm", args: ["id": id])
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }
}
