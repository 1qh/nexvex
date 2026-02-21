import ConvexShared
import Foundation
import Observation

@MainActor
@Observable
internal final class BlogDetailViewModel {
    var isLoading = true

    var blog: Blog?

    var errorMessage: String?

    private var subscriptionID: String?

    func startSubscription(blogID: String) {
        stopSubscription()
        isLoading = true
        errorMessage = nil

        #if !SKIP
        subscriptionID = ConvexService.shared.subscribe(
            to: "blog:read",
            args: ["id": blogID],
            type: Blog.self,
            onUpdate: { [weak self] (result: Blog) in
                self?.blog = result
                self?.isLoading = false
            },
            onError: { [weak self] error in
                self?.errorMessage = error.localizedDescription
                self?.isLoading = false
            }
        )
        #else
        subscriptionID = ConvexService.shared.subscribeBlog(
            to: "blog:read",
            args: ["id": blogID],
            onUpdate: { result in
                self.blog = result
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

    func deleteBlog() {
        guard let blog else {
            return
        }

        Task {
            do {
                try await ConvexService.shared.mutate("blog:rm", args: ["id": blog._id])
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }
}
