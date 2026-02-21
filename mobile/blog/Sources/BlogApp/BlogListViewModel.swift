import ConvexShared
import Foundation
import Observation

@MainActor
@Observable
internal final class BlogListViewModel {
    var blogs = [Blog]()

    var isLoading = false

    var searchQuery = ""

    var errorMessage: String?

    var displayedBlogs: [Blog] {
        if searchQuery.isEmpty {
            return blogs
        }
        let q = searchQuery.lowercased()
        var filtered = [Blog]()
        for b in blogs {
            if b.title.lowercased().contains(q) || b.content.lowercased().contains(q) {
                filtered.append(b)
            } else if let tags = b.tags {
                var tagMatch = false
                for t in tags where t.lowercased().contains(q) {
                    tagMatch = true
                    break
                }
                if tagMatch {
                    filtered.append(b)
                }
            }
        }
        return filtered
    }

    private var subscriptionID: String?

    func startSubscription() {
        stopSubscription()
        isLoading = true
        errorMessage = nil

        let args: [String: Any] = [
            "paginationOpts": ["cursor": NSNull(), "numItems": 50] as [String: Any],
            "where": ["or": [["published": true], ["own": true]] as [[String: Any]]] as [String: Any],
        ]

        #if !SKIP
        subscriptionID = ConvexService.shared.subscribe(
            to: "blog:list",
            args: args,
            type: PaginatedResult<Blog>.self,
            onUpdate: { [weak self] (result: PaginatedResult<Blog>) in
                guard let self else {
                    return
                }

                blogs = result.page
                isLoading = false
            },
            onError: { [weak self] error in
                self?.errorMessage = error.localizedDescription
                self?.isLoading = false
            }
        )
        #else
        subscriptionID = ConvexService.shared.subscribePaginatedBlogs(
            to: "blog:list",
            args: args,
            onUpdate: { result in
                self.blogs = Array(result.page)
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

    func deleteBlog(id: String) {
        Task {
            do {
                try await ConvexService.shared.mutate("blog:rm", args: ["id": id])
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    func togglePublished(id: String, published: Bool) {
        Task {
            do {
                try await ConvexService.shared.mutate("blog:update", args: [
                    "id": id,
                    "published": !published,
                ])
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }
}
