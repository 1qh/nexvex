import ConvexShared
import Foundation
import Observation

@MainActor
@Observable
internal final class WikiListViewModel {
    var wikis = [Wiki]()

    var isLoading = true

    var errorMessage: String?

    private var subscriptionID: String?

    func startSubscription(orgID: String) {
        stopSubscription()
        isLoading = true

        let args: [String: Any] = [
            "orgId": orgID,
            "paginationOpts": ["cursor": NSNull(), "numItems": 50] as [String: Any],
        ]

        #if !SKIP
        subscriptionID = ConvexService.shared.subscribe(
            to: "wiki:list",
            args: args,
            type: PaginatedResult<Wiki>.self,
            onUpdate: { [weak self] (result: PaginatedResult<Wiki>) in
                self?.wikis = result.page
                self?.isLoading = false
            },
            onError: { [weak self] error in
                self?.errorMessage = error.localizedDescription
                self?.isLoading = false
            }
        )
        #else
        subscriptionID = ConvexService.shared.subscribePaginatedWikis(
            to: "wiki:list",
            args: args,
            onUpdate: { result in
                self.wikis = Array(result.page)
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

    func createWiki(orgID: String, title: String, slug: String) {
        Task {
            do {
                try await ConvexService.shared.mutate("wiki:create", args: [
                    "orgId": orgID,
                    "title": title,
                    "slug": slug,
                    "status": "draft",
                    "content": "",
                ])
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    func deleteWiki(orgID: String, id: String) {
        Task {
            do {
                try await ConvexService.shared.mutate("wiki:rm", args: [
                    "orgId": orgID,
                    "id": id,
                ])
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    func restoreWiki(orgID: String, id: String) {
        Task {
            do {
                try await ConvexService.shared.mutate("wiki:restore", args: [
                    "orgId": orgID,
                    "id": id,
                ])
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }
}
