import ConvexShared
import SwiftUI

internal struct WikiEditView: View {
    let orgID: String

    let wikiID: String

    let role: String

    @State private var title = ""

    @State private var slug = ""

    @State private var content = ""

    @State private var status = "draft"

    @State private var isLoading = true

    @State private var saveStatus = ""

    @State private var errorMessage: String?

    @State private var autoSaveTask: Task<Void, Never>?

    var body: some View {
        Group {
            if isLoading {
                ProgressView()
            } else {
                Form {
                    Section("Details") {
                        TextField("Title", text: $title)
                            .onChange(of: title) { scheduleSave() }
                        TextField("Slug", text: $slug)
                            .onChange(of: slug) { scheduleSave() }
                        Picker("Status", selection: $status) {
                            Text("Draft").tag("draft")
                            Text("Published").tag("published")
                        }
                        .onChange(of: status) { scheduleSave() }
                    }

                    Section("Content") {
                        TextEditor(text: $content)
                            .frame(minHeight: 200)
                            .onChange(of: content) { scheduleSave() }
                    }

                    if !saveStatus.isEmpty {
                        Section {
                            Text(saveStatus)
                                .font(.caption)
                                .foregroundStyle(saveStatus == "Error saving" ? .red : .secondary)
                        }
                    }

                    if role == "owner" || role == "admin" {
                        Section("Danger Zone") {
                            Button("Delete Page", role: .destructive) {
                                deleteWiki()
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle("Edit Wiki")
        .task {
            await loadWiki()
        }
    }

    private func scheduleSave() {
        autoSaveTask?.cancel()
        saveStatus = "Editing..."
        autoSaveTask = Task {
            try? await Task.sleep(nanoseconds: 2_000_000_000)
            if !Task.isCancelled {
                await saveWiki()
            }
        }
    }

    private func saveWiki() async {
        saveStatus = "Saving..."
        do {
            try await ConvexService.shared.mutate("wiki:update", args: [
                "orgId": orgID,
                "id": wikiID,
                "title": title,
                "slug": slug,
                "content": content,
                "status": status,
            ])
            saveStatus = "Saved"
        } catch {
            saveStatus = "Error saving"
            errorMessage = error.localizedDescription
        }
    }

    private func loadWiki() {
        isLoading = false
    }

    private func deleteWiki() {
        Task {
            do {
                try await ConvexService.shared.mutate("wiki:rm", args: [
                    "orgId": orgID,
                    "id": wikiID,
                ])
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }
}
