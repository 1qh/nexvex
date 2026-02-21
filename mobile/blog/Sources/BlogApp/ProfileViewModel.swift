import ConvexShared
import Foundation
import Observation

@MainActor
@Observable
internal final class ProfileViewModel {
    var displayName = ""

    var bio = ""

    var theme = "system"

    var notifications = true

    var isLoading = true

    var isSaving = false

    var isUploadingAvatar = false

    var avatarID: String?

    var selectedAvatarURL: URL?

    let themes = ["light", "dark", "system"]

    var profile: ProfileData?

    var errorMessage: String?

    private var subscriptionID: String?

    func startSubscription() {
        stopSubscription()
        isLoading = true

        #if !SKIP
        subscriptionID = ConvexService.shared.subscribe(
            to: "blogProfile:get",
            args: [:],
            type: ProfileData.self,
            onUpdate: { [weak self] (result: ProfileData) in
                guard let self else {
                    return
                }

                profile = result
                displayName = result.displayName
                bio = result.bio ?? ""
                theme = result.theme
                notifications = result.notifications
                avatarID = result.avatar
                isLoading = false
            },
            onError: { [weak self] error in
                self?.errorMessage = error.localizedDescription
                self?.isLoading = false
            }
        )
        #else
        subscriptionID = ConvexService.shared.subscribeProfileData(
            to: "blogProfile:get",
            args: [:],
            onUpdate: { result in
                self.profile = result
                self.displayName = result.displayName
                self.bio = result.bio ?? ""
                self.theme = result.theme
                self.notifications = result.notifications
                self.avatarID = result.avatar
                self.isLoading = false
            },
            onError: { error in
                self.errorMessage = error.localizedDescription
                self.isLoading = false
            },
            onNull: {
                self.isLoading = false
            }
        )
        #endif
    }

    func stopSubscription() {
        cancelSubscription(&subscriptionID)
    }

    func uploadAvatar() {
        guard let url = selectedAvatarURL else {
            return
        }

        isUploadingAvatar = true
        errorMessage = nil
        Task {
            do {
                avatarID = try await FileService.shared.uploadImage(url: url)
            } catch {
                errorMessage = error.localizedDescription
            }
            isUploadingAvatar = false
        }
    }

    func removeAvatar() {
        avatarID = nil
        selectedAvatarURL = nil
    }

    func save() {
        guard !displayName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            errorMessage = "Display name is required"
            return
        }

        isSaving = true
        errorMessage = nil

        Task {
            do {
                var args: [String: Any] = [
                    "displayName": displayName.trimmingCharacters(in: .whitespacesAndNewlines),
                    "theme": theme,
                    "notifications": notifications,
                ]
                if !bio.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    args["bio"] = bio.trimmingCharacters(in: .whitespacesAndNewlines)
                }
                if let aid = avatarID {
                    args["avatar"] = aid
                }
                try await ConvexService.shared.mutate("blogProfile:upsert", args: args)
            } catch {
                errorMessage = error.localizedDescription
            }
            isSaving = false
        }
    }
}
