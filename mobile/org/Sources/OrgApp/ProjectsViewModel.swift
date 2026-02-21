import ConvexShared
import Foundation
import Observation

@MainActor
@Observable
internal final class ProjectsViewModel {
    var projects = [Project]()

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
            to: "project:list",
            args: args,
            type: PaginatedResult<Project>.self,
            onUpdate: { [weak self] (result: PaginatedResult<Project>) in
                self?.projects = result.page
                self?.isLoading = false
            },
            onError: { [weak self] error in
                self?.errorMessage = error.localizedDescription
                self?.isLoading = false
            }
        )
        #else
        subscriptionID = ConvexService.shared.subscribePaginatedProjects(
            to: "project:list",
            args: args,
            onUpdate: { result in
                self.projects = Array(result.page)
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

    func createProject(orgID: String, name: String, description: String) {
        Task {
            do {
                try await ConvexService.shared.mutate("project:create", args: [
                    "orgId": orgID,
                    "name": name,
                    "description": description,
                ])
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    func deleteProject(orgID: String, id: String) {
        Task {
            do {
                try await ConvexService.shared.mutate("project:rm", args: [
                    "orgId": orgID,
                    "id": id,
                ])
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }
}
