import Foundation
@testable import MovieApp
import OSLog
import XCTest

internal let logger = Logger(subsystem: "MovieApp", category: "Tests")

@available(macOS 13, *)
internal final class MovieAppTests: XCTestCase {
    func testMovieApp() {
        logger.log("running testMovieApp")
        XCTAssertEqual(1 + 2, 3, "basic test")
    }

    func testDecodeType() throws {
        // load the TestData.json file from the Resources folder and decode it into a struct
        let resourceURL: URL = try XCTUnwrap(Bundle.module.url(forResource: "TestData", withExtension: "json"))
        let testData = try JSONDecoder().decode(TestData.self, from: Data(contentsOf: resourceURL))
        XCTAssertEqual("MovieApp", testData.testModuleName)
    }
}

internal struct TestData: Codable, Hashable {
    var testModuleName: String
}
