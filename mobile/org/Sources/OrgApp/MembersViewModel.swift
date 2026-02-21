import ConvexShared
import Foundation
import Observation

@MainActor
@Observable
internal final class MembersViewModel {
    var members = [OrgMemberEntry]()

    var invites = [OrgInvite]()

    var isLoading = true

    var errorMessage: String?

    private var membersSubID: String?

    private var invitesSubID: String?

    func startSubscription(orgID: String) {
        stopSubscription()
        isLoading = true

        #if !SKIP
        membersSubID = ConvexService.shared.subscribe(
            to: "org:members",
            args: ["orgId": orgID],
            type: [OrgMemberEntry].self,
            onUpdate: { [weak self] (result: [OrgMemberEntry]) in
                self?.members = result
                self?.isLoading = false
            },
            onError: { [weak self] error in
                self?.errorMessage = error.localizedDescription
                self?.isLoading = false
            }
        )
        invitesSubID = ConvexService.shared.subscribe(
            to: "org:pendingInvites",
            args: ["orgId": orgID],
            type: [OrgInvite].self,
            onUpdate: { [weak self] (result: [OrgInvite]) in
                self?.invites = result
            },
            onError: { [weak self] error in
                self?.errorMessage = error.localizedDescription
            }
        )
        #else
        membersSubID = ConvexService.shared.subscribeOrgMembers(
            to: "org:members",
            args: ["orgId": orgID],
            onUpdate: { result in
                self.members = Array(result)
                self.isLoading = false
            },
            onError: { error in
                self.errorMessage = error.localizedDescription
                self.isLoading = false
            }
        )
        invitesSubID = ConvexService.shared.subscribeInvites(
            to: "org:pendingInvites",
            args: ["orgId": orgID],
            onUpdate: { result in
                self.invites = Array(result)
            },
            onError: { error in
                self.errorMessage = error.localizedDescription
            }
        )
        #endif
    }

    func stopSubscription() {
        cancelSubscription(&membersSubID)
        cancelSubscription(&invitesSubID)
    }

    func inviteMember(orgID: String, email: String) {
        Task {
            do {
                try await ConvexService.shared.mutate("org:invite", args: [
                    "orgId": orgID,
                    "email": email,
                    "isAdmin": false,
                ])
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    func revokeInvite(orgID: String, inviteID: String) {
        Task {
            do {
                try await ConvexService.shared.mutate("org:revokeInvite", args: [
                    "orgId": orgID,
                    "inviteId": inviteID,
                ])
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    func setAdmin(orgID: String, userID: String, isAdmin: Bool) {
        Task {
            do {
                try await ConvexService.shared.mutate("org:setAdmin", args: [
                    "orgId": orgID,
                    "userId": userID,
                    "isAdmin": isAdmin,
                ])
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    func removeMember(orgID: String, userID: String) {
        Task {
            do {
                try await ConvexService.shared.mutate("org:removeMember", args: [
                    "orgId": orgID,
                    "userId": userID,
                ])
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }
}
