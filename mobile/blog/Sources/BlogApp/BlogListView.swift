import ConvexShared
import SwiftUI

internal struct BlogCardView: View {
    let blog: Blog

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                if let authorName = blog.author?.name {
                    Text(authorName)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Text(blog.category)
                    .font(.caption2)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Color.secondary.opacity(0.15))
                    .clipShape(Capsule())
            }

            if let coverImageURL = blog.coverImageURL, let url = URL(string: coverImageURL) {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case let .success(image):
                        image
                            .resizable()
                            .aspectRatio(1.78, contentMode: .fill)
                            .frame(maxHeight: 180)
                            .clipShape(RoundedRectangle(cornerRadius: 8))

                    default:
                        EmptyView()
                    }
                }
            }

            Text(blog.title)
                .font(.headline)
                .lineLimit(2)

            Text(blog.content)
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(3)

            if let tags = blog.tags, !tags.isEmpty {
                HStack(spacing: 4) {
                    ForEach(tags, id: \.self) { tag in
                        Text("#\(tag)")
                            .font(.caption2)
                            .foregroundStyle(.blue)
                    }
                }
            }

            HStack {
                Text(blog.published ? "Published" : "Draft")
                    .font(.caption2)
                    .foregroundStyle(blog.published ? .green : .orange)
                Spacer()
                Text(formatTimestamp(blog.updatedAt))
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 4)
    }
}

internal struct BlogListView: View {
    @State private var viewModel = BlogListViewModel()
    @State private var showCreateSheet = false

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(.secondary)
                    .accessibilityHidden(true)
                TextField("Search blogs...", text: $viewModel.searchQuery)
                #if !SKIP
                    .textFieldStyle(.roundedBorder)
                    .autocorrectionDisabled()
                #endif
            }
            .padding()

            if viewModel.isLoading, viewModel.blogs.isEmpty {
                Spacer()
                ProgressView()
                Spacer()
            } else if viewModel.errorMessage != nil {
                Spacer()
                ErrorBanner(message: viewModel.errorMessage)
                    .padding()
                Spacer()
            } else if viewModel.displayedBlogs.isEmpty {
                Spacer()
                Text("No posts yet")
                    .foregroundStyle(.secondary)
                Spacer()
            } else {
                List(viewModel.displayedBlogs) { blog in
                    NavigationLink(value: blog._id) {
                        BlogCardView(blog: blog)
                    }
                }
                .listStyle(.plain)
            }
        }
        .navigationTitle("Blog")
        .navigationDestination(for: String.self) { blogID in
            BlogDetailView(blogID: blogID)
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
                BlogFormView(mode: .create) {
                    showCreateSheet = false
                }
            }
        }
        .task {
            viewModel.startSubscription()
        }
        .onDisappear {
            viewModel.stopSubscription()
        }
    }
}
