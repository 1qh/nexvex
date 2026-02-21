import ConvexShared
import Foundation
import Observation

internal enum BlogFormMode {
    case create
    case edit(Blog)
}

@MainActor
@Observable
internal final class BlogFormViewModel {
    var title = ""

    var content = ""

    var category = "tech"

    var published = false

    var tags = [String]()

    var newTag = ""

    var isSaving = false

    var isUploadingCover = false

    var coverImageID: String?

    var selectedCoverURL: URL?

    let categories = ["tech", "life", "tutorial"]

    let mode: BlogFormMode

    private var lastSavedTitle = ""

    private var lastSavedContent = ""

    var errorMessage: String?

    var autoSaveMessage: String?

    var isValid: Bool {
        !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
            content.trimmingCharacters(in: .whitespacesAndNewlines).count >= 3
    }

    private var autoSaveTask: Task<Void, Never>?

    init(mode: BlogFormMode) {
        self.mode = mode
        if case let .edit(blog) = mode {
            title = blog.title
            content = blog.content
            category = blog.category
            published = blog.published
            tags = blog.tags ?? []
            coverImageID = blog.coverImage
            lastSavedTitle = blog.title
            lastSavedContent = blog.content
        }
    }

    func uploadCoverImage() {
        guard let url = selectedCoverURL else {
            return
        }

        isUploadingCover = true
        errorMessage = nil
        Task {
            do {
                coverImageID = try await FileService.shared.uploadImage(url: url)
            } catch {
                errorMessage = error.localizedDescription
            }
            isUploadingCover = false
        }
    }

    func removeCoverImage() {
        coverImageID = nil
        selectedCoverURL = nil
    }

    func addTag() {
        let trimmed = newTag.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if !trimmed.isEmpty, !tags.contains(trimmed), tags.count < 5 {
            tags.append(trimmed)
        }
        newTag = ""
    }

    func removeTag(_ tag: String) {
        tags.removeAll { $0 == tag }
    }

    func save(onDone: @escaping () -> Void) {
        guard isValid else {
            return
        }

        isSaving = true
        errorMessage = nil

        Task {
            do {
                switch mode {
                case .create:
                    var args: [String: Any] = [
                        "title": title.trimmingCharacters(in: .whitespacesAndNewlines),
                        "content": content.trimmingCharacters(in: .whitespacesAndNewlines),
                        "category": category,
                        "published": published,
                    ]
                    if !tags.isEmpty {
                        args["tags"] = tags
                    }
                    if let coverID = coverImageID {
                        args["coverImage"] = coverID
                    }
                    try await ConvexService.shared.mutate("blog:create", args: args)

                case let .edit(blog):
                    var args: [String: Any] = [
                        "id": blog._id,
                        "title": title.trimmingCharacters(in: .whitespacesAndNewlines),
                        "content": content.trimmingCharacters(in: .whitespacesAndNewlines),
                        "category": category,
                        "published": published,
                    ]
                    if !tags.isEmpty {
                        args["tags"] = tags
                    }
                    if let coverID = coverImageID {
                        args["coverImage"] = coverID
                    }
                    args["expectedUpdatedAt"] = blog.updatedAt
                    try await ConvexService.shared.mutate("blog:update", args: args)
                }
                onDone()
            } catch {
                errorMessage = error.localizedDescription
            }
            isSaving = false
        }
    }

    func scheduleAutoSave(blog: Blog) {
        autoSaveTask?.cancel()
        guard title != lastSavedTitle || content != lastSavedContent else {
            return
        }

        autoSaveMessage = "Saving..."
        autoSaveTask = Task {
            try? await Task.sleep(nanoseconds: 2_000_000_000)
            guard !Task.isCancelled else {
                return
            }

            do {
                var args: [String: Any] = [
                    "id": blog._id,
                    "title": title.trimmingCharacters(in: .whitespacesAndNewlines),
                    "content": content.trimmingCharacters(in: .whitespacesAndNewlines),
                    "category": category,
                    "published": published,
                ]
                if !tags.isEmpty {
                    args["tags"] = tags
                }
                try await ConvexService.shared.mutate("blog:update", args: args)
                lastSavedTitle = title
                lastSavedContent = content
                autoSaveMessage = "Saved"
            } catch {
                autoSaveMessage = "Save failed"
            }
        }
    }
}
