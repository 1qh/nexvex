import ConvexCore
import DesktopShared
import Foundation
import SwiftCrossUI

enum FormMode {
    case create
    case edit(Blog)
}

final class FormViewModel: SwiftCrossUI.ObservableObject {
    @SwiftCrossUI.Published var title = ""
    @SwiftCrossUI.Published var content = ""
    @SwiftCrossUI.Published var category = "tech"
    @SwiftCrossUI.Published var published = false
    @SwiftCrossUI.Published var isSaving = false
    @SwiftCrossUI.Published var errorMessage: String?

    let mode: FormMode

    var isValid: Bool {
        !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
            content.trimmingCharacters(in: .whitespacesAndNewlines).count >= 3
    }

    init(mode: FormMode) {
        self.mode = mode
        if case let .edit(blog) = mode {
            title = blog.title
            content = blog.content
            category = blog.category
            published = blog.published
        }
    }

    @MainActor
    func save(onDone: @escaping () -> Void) async {
        guard isValid else { return }
        isSaving = true
        errorMessage = nil

        do {
            switch mode {
            case .create:
                let args: [String: Any] = [
                    "title": title.trimmingCharacters(in: .whitespacesAndNewlines),
                    "content": content.trimmingCharacters(in: .whitespacesAndNewlines),
                    "category": category,
                    "published": published,
                ]
                try await client.mutation("blog:create", args: args)

            case let .edit(blog):
                let args: [String: Any] = [
                    "id": blog._id,
                    "title": title.trimmingCharacters(in: .whitespacesAndNewlines),
                    "content": content.trimmingCharacters(in: .whitespacesAndNewlines),
                    "category": category,
                    "published": published,
                    "expectedUpdatedAt": blog.updatedAt,
                ]
                try await client.mutation("blog:update", args: args)
            }
            onDone()
        } catch {
            errorMessage = error.localizedDescription
        }
        isSaving = false
    }
}

struct FormView: View {
    let onDone: () -> Void
    @State var viewModel: FormViewModel

    var body: some View {
        VStack {
            Text(isEditMode ? "Edit Post" : "New Post")
                .padding(.bottom, 8)

            TextField("Title", text: $viewModel.title)
            TextField("Content", text: $viewModel.content)
            TextField("Category (tech/life/tutorial)", text: $viewModel.category)

            Toggle("Published", isOn: $viewModel.published)

            if let msg = viewModel.errorMessage {
                Text(msg)
                    .foregroundColor(.red)
            }

            HStack {
                Button("Cancel") {
                    onDone()
                }
                Button(isEditMode ? "Save" : "Create") {
                    Task { await viewModel.save(onDone: onDone) }
                }
            }
            .padding(.top, 4)

            if viewModel.isSaving {
                Text("Saving...")
            }
        }
    }

    init(mode: FormMode, onDone: @escaping () -> Void) {
        self.onDone = onDone
        _viewModel = State(wrappedValue: FormViewModel(mode: mode))
    }

    private var isEditMode: Bool {
        if case .edit = viewModel.mode {
            return true
        }
        return false
    }
}
