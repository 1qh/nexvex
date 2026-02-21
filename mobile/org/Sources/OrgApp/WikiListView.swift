import ConvexShared
import SwiftUI

internal struct WikiListView: View {
    let orgID: String

    let role: String

    @State private var viewModel = WikiListViewModel()

    @State private var showCreateSheet = false

    @State private var newWikiTitle = ""

    @State private var newWikiSlug = ""

    var body: some View {
        Group {
            if viewModel.isLoading, viewModel.wikis.isEmpty {
                ProgressView()
            } else if viewModel.wikis.isEmpty {
                VStack(spacing: 12) {
                    Text("No wiki pages yet")
                        .foregroundStyle(.secondary)
                    Button("Create Page") {
                        showCreateSheet = true
                    }
                }
            } else {
                List {
                    Section {
                        let activeWikis = viewModel.wikis.filter { w in w.deletedAt == nil }
                        if activeWikis.isEmpty {
                            Text("No active pages")
                                .foregroundStyle(.secondary)
                        }
                        ForEach(activeWikis) { wiki in
                            NavigationLink(value: wiki._id) {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(wiki.title)
                                        .font(.headline)
                                    HStack {
                                        Text(wiki.slug)
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                        Spacer()
                                        Text(wiki.status.capitalized)
                                            .font(.caption2)
                                            .padding(.horizontal, 6)
                                            .padding(.vertical, 2)
                                            .background(wiki.status == "published" ? Color.green.opacity(0.1) : Color.orange.opacity(0.1))
                                            .clipShape(Capsule())
                                    }
                                }
                                .padding(.vertical, 2)
                            }
                        }
                    }

                    let deletedWikis = viewModel.wikis.filter { w in w.deletedAt != nil }
                    if !deletedWikis.isEmpty {
                        Section("Recently Deleted") {
                            ForEach(deletedWikis) { wiki in
                                HStack {
                                    VStack(alignment: .leading) {
                                        Text(wiki.title)
                                            .font(.headline)
                                            .strikethrough()
                                            .foregroundStyle(.secondary)
                                        Text(wiki.slug)
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                    }
                                    Spacer()
                                    Button("Restore") {
                                        viewModel.restoreWiki(orgID: orgID, id: wiki._id)
                                    }
                                    .buttonStyle(.bordered)
                                    .font(.caption)
                                }
                            }
                        }
                    }
                }
                .listStyle(.plain)
            }
        }
        .navigationDestination(for: String.self) { wikiID in
            WikiEditView(orgID: orgID, wikiID: wikiID, role: role)
        }
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button(action: { showCreateSheet = true }) {
                    Image(systemName: "plus")
                        .accessibilityHidden(true)
                }
            }
        }
        .sheet(isPresented: $showCreateSheet) {
            NavigationStack {
                Form {
                    TextField("Page Title", text: $newWikiTitle)
                    TextField("Slug (URL-friendly)", text: $newWikiSlug)
                }
                .navigationTitle("New Wiki Page")
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancel") { showCreateSheet = false }
                    }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Create") {
                            viewModel.createWiki(orgID: orgID, title: newWikiTitle, slug: newWikiSlug)
                            newWikiTitle = ""
                            newWikiSlug = ""
                            showCreateSheet = false
                        }
                        .disabled(newWikiTitle.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || newWikiSlug
                            .trimmingCharacters(in: .whitespacesAndNewlines)
                            .isEmpty)
                    }
                }
            }
        }
        .task {
            viewModel.startSubscription(orgID: orgID)
        }
        .onDisappear {
            viewModel.stopSubscription()
        }
    }
}
