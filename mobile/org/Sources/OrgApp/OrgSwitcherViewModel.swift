import ConvexShared
import Foundation
import Observation

@MainActor
@Observable
internal final class OrgSwitcherViewModel {
    var orgs = [OrgWithRole]()

    var isLoading = true

    var errorMessage: String?

    private var subscriptionID: String?

    func startSubscription() {
        stopSubscription()
        isLoading = true

        #if !SKIP
        subscriptionID = ConvexService.shared.subscribe(
            to: "org:myOrgs",
            type: [OrgWithRole].self,
            onUpdate: { [weak self] (result: [OrgWithRole]) in
                self?.orgs = result
                self?.isLoading = false
            },
            onError: { [weak self] error in
                self?.errorMessage = error.localizedDescription
                self?.isLoading = false
            }
        )
        #else
        subscriptionID = ConvexService.shared.subscribeOrgsWithRole(
            to: "org:myOrgs",
            onUpdate: { result in
                self.orgs = Array(result)
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

    func createOrg(name: String, slug: String) {
        Task {
            do {
                try await ConvexService.shared.mutate("org:create", args: [
                    "data": [
                        "name": name,
                        "slug": slug,
                    ] as [String: Any],
                ])
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }
}
