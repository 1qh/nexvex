import ConvexShared
import Foundation
import Observation

@MainActor
@Observable
internal final class MovieDetailViewModel {
    var isLoading = false

    var movie: Movie?

    var errorMessage: String?

    func loadMovie(tmdbID: Int) async {
        isLoading = true
        errorMessage = nil
        do {
            #if !SKIP
            let loaded: Movie = try await ConvexService.shared.action(
                "movie:load",
                args: ["tmdb_id": Double(tmdbID)],
                returning: Movie.self
            )
            #else
            let loaded: Movie = try await ConvexService.shared.actionMovie(
                name: "movie:load",
                args: ["tmdb_id": Double(tmdbID)]
            )
            #endif
            movie = loaded
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    func fetchByID(_ idText: String) async {
        guard let tmdbID = Int(idText), tmdbID > 0 else {
            errorMessage = "Enter a valid TMDB ID"
            return
        }

        await loadMovie(tmdbID: tmdbID)
    }
}
