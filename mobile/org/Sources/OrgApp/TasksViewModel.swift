import ConvexShared
import Foundation
import Observation

@MainActor
@Observable
internal final class TasksViewModel {
    var tasks = [TaskItem]()

    var isLoading = true

    var errorMessage: String?

    private var subscriptionID: String?

    func startSubscription(orgID: String, projectID: String) {
        stopSubscription()
        isLoading = true

        #if !SKIP
        subscriptionID = ConvexService.shared.subscribe(
            to: "task:byProject",
            args: ["orgId": orgID, "projectId": projectID],
            type: [TaskItem].self,
            onUpdate: { [weak self] (result: [TaskItem]) in
                self?.tasks = result
                self?.isLoading = false
            },
            onError: { [weak self] error in
                self?.errorMessage = error.localizedDescription
                self?.isLoading = false
            }
        )
        #else
        subscriptionID = ConvexService.shared.subscribeTasks(
            to: "task:byProject",
            args: ["orgId": orgID, "projectId": projectID],
            onUpdate: { result in
                self.tasks = Array(result)
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

    func createTask(orgID: String, projectID: String, title: String) {
        Task {
            do {
                try await ConvexService.shared.mutate("task:create", args: [
                    "orgId": orgID,
                    "projectId": projectID,
                    "title": title,
                ])
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    func toggleTask(orgID: String, taskID: String) {
        Task {
            do {
                try await ConvexService.shared.mutate("task:toggle", args: [
                    "orgId": orgID,
                    "id": taskID,
                ])
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    func deleteTask(orgID: String, id: String) {
        Task {
            do {
                try await ConvexService.shared.mutate("task:rm", args: [
                    "orgId": orgID,
                    "id": id,
                ])
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }
}
