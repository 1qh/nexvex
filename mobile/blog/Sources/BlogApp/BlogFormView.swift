import ConvexShared
import SkipKit
import SwiftUI

internal struct BlogFormView: View {
    let onDone: () -> Void

    @State private var viewModel: BlogFormViewModel

    @State private var showCoverPicker = false

    @Environment(\.dismiss)
    private var dismiss

    private var isEditMode: Bool {
        if case .edit = viewModel.mode {
            return true
        }
        return false
    }

    var body: some View {
        Form {
            Section("Title") {
                TextField("My awesome post", text: $viewModel.title)
                    .onChange(of: viewModel.title) { _, _ in handleAutoSave() }
            }

            Section("Category") {
                Picker("Category", selection: $viewModel.category) {
                    ForEach(viewModel.categories, id: \.self) { cat in
                        Text(cat.capitalized).tag(cat)
                    }
                }
                .pickerStyle(.segmented)
            }

            Section("Content") {
                TextEditor(text: $viewModel.content)
                    .frame(minHeight: 150)
                    .onChange(of: viewModel.content) { _, _ in handleAutoSave() }
            }

            Section("Cover Image") {
                if viewModel.isUploadingCover {
                    ProgressView("Uploading...")
                } else if viewModel.coverImageID != nil {
                    HStack {
                        Image(systemName: "photo.fill")
                            .foregroundStyle(.green)
                            .accessibilityHidden(true)
                        Text("Cover image set")
                        Spacer()
                        Button("Remove") { viewModel.removeCoverImage() }
                            .foregroundStyle(.red)
                    }
                }
                Button(viewModel.coverImageID != nil ? "Change Cover" : "Select Cover Image") {
                    showCoverPicker = true
                }
                .withMediaPicker(type: .library, isPresented: $showCoverPicker, selectedImageURL: $viewModel.selectedCoverURL)
                .onChange(of: viewModel.selectedCoverURL) { _, _ in viewModel.uploadCoverImage() }
            }

            Section("Tags") {
                HStack {
                    TextField("Add tag...", text: $viewModel.newTag)
                    Button("Add") { viewModel.addTag() }
                        .disabled(viewModel.newTag.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
                if !viewModel.tags.isEmpty {
                    HStack(spacing: 6) {
                        ForEach(viewModel.tags, id: \.self) { tag in
                            HStack(spacing: 2) {
                                Text("#\(tag)")
                                    .font(.caption)
                                Button(action: { viewModel.removeTag(tag) }) {
                                    Image(systemName: "xmark.circle.fill")
                                        .font(.caption2)
                                        .accessibilityHidden(true)
                                }
                            }
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(Color.blue.opacity(0.1))
                            .clipShape(Capsule())
                        }
                    }
                }
            }

            Section {
                Toggle("Published", isOn: $viewModel.published)
                    .accessibilityIdentifier("publishToggle")
            }

            if viewModel.errorMessage != nil {
                Section {
                    ErrorBanner(message: viewModel.errorMessage)
                }
            }

            if let autoSaveMessage = viewModel.autoSaveMessage {
                Section {
                    Text(autoSaveMessage)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .navigationTitle(isEditMode ? "Edit Post" : "New Post")
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancel") {
                    dismiss()
                    onDone()
                }
            }
            ToolbarItem(placement: .confirmationAction) {
                Button(isEditMode ? "Save" : "Create") {
                    viewModel.save(onDone: onDone)
                }
                .disabled(!viewModel.isValid || viewModel.isSaving || viewModel.isUploadingCover)
            }
        }
    }

    init(mode: BlogFormMode, onDone: @escaping () -> Void) {
        _viewModel = State(initialValue: BlogFormViewModel(mode: mode))
        self.onDone = onDone
    }

    private func handleAutoSave() {
        if case let .edit(blog) = viewModel.mode {
            viewModel.scheduleAutoSave(blog: blog)
        }
    }
}
