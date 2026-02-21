import ConvexShared
import SwiftUI

internal struct MovieResultRow: View {
    let result: SearchResult

    private let tmdbImg = "https://image.tmdb.org/t/p/w200"

    private var placeholderView: some View {
        RoundedRectangle(cornerRadius: 4)
            .fill(Color.secondary.opacity(0.2))
            .frame(width: 60, height: 90)
            .overlay {
                Text("No\nImage")
                    .font(.system(size: 10))
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
    }

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            if let posterPath = result.poster_path {
                AsyncImage(url: URL(string: "\(tmdbImg)\(posterPath)")) { phase in
                    switch phase {
                    case let .success(image):
                        image
                            .resizable()
                            .aspectRatio(contentMode: .fill)

                    case .failure:
                        placeholderView

                    default:
                        ProgressView()
                    }
                }
                .frame(width: 60, height: 90)
                .clipShape(RoundedRectangle(cornerRadius: 4))
            } else {
                placeholderView
            }

            VStack(alignment: .leading, spacing: 4) {
                Text(result.title)
                    .font(.headline)
                    .lineLimit(2)

                HStack(spacing: 4) {
                    if let releaseDate = result.release_date, !releaseDate.isEmpty {
                        Text(String(releaseDate.prefix(4)))
                    }
                    Text("•")
                    Text(String(format: "%.1f", result.vote_average))
                        .foregroundStyle(.orange)
                }
                .font(.caption)
                .foregroundStyle(.secondary)

                Text(result.overview)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
        }
        .padding(.vertical, 4)
    }
}

internal struct SearchView: View {
    @State private var viewModel = MovieSearchViewModel()

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                TextField("Search movies...", text: $viewModel.query)
                #if !SKIP
                    .textFieldStyle(.roundedBorder)
                    .autocorrectionDisabled()
                #endif
                    .onSubmit { viewModel.search() }

                Button(action: { viewModel.search() }) {
                    if viewModel.isLoading {
                        ProgressView()
                    } else {
                        Image(systemName: "magnifyingglass")
                            .accessibilityHidden(true)
                    }
                }
                .disabled(viewModel.query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || viewModel.isLoading)
            }
            .padding()

            if viewModel.errorMessage != nil {
                ErrorBanner(message: viewModel.errorMessage)
                    .padding(.horizontal)
            }

            if viewModel.results.isEmpty, !viewModel.isLoading {
                Spacer()
                Text("Search for movies by title")
                    .foregroundStyle(.secondary)
                Spacer()
            } else {
                List(viewModel.results) { result in
                    NavigationLink(value: result.id) {
                        MovieResultRow(result: result)
                    }
                }
                .listStyle(.plain)
            }
        }
        .navigationTitle("Movie Search")
    }
}
