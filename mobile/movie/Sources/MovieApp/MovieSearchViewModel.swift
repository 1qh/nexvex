import ConvexShared
import Foundation
import Observation

@MainActor
@Observable
internal final class MovieSearchViewModel {
    var query = ""
    var results = [SearchResult]()
    var isLoading = false
    var errorMessage: String?
    private var searchTask: Task<Void, Never>?

    func search() {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            results = []
            return
        }

        searchTask?.cancel()
        searchTask = Task {
            isLoading = true
            errorMessage = nil
            do {
                #if !SKIP
                let found: [SearchResult] = try await ConvexService.shared.action(
                    "movie:search",
                    args: ["query": trimmed],
                    returning: [SearchResult].self
                )
                #else
                let found: [SearchResult] = try await ConvexService.shared.actionSearchResults(
                    name: "movie:search",
                    args: ["query": trimmed]
                )
                #endif
                if !Task.isCancelled {
                    results = found
                }
            } catch {
                if !Task.isCancelled {
                    errorMessage = error.localizedDescription
                }
            }
            if !Task.isCancelled {
                isLoading = false
            }
        }
    }
}
