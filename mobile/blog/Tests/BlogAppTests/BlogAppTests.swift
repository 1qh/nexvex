@testable import BlogApp
import Foundation
import OSLog
import XCTest

internal let logger = Logger(subsystem: "BlogApp", category: "Tests")

@available(macOS 13, *)
internal final class BlogAppTests: XCTestCase {
    func testBlogApp() {
        logger.log("running testBlogApp")
        XCTAssertEqual(1 + 2, 3, "basic test")
    }

    func testDecodeType() throws {
        // load the TestData.json file from the Resources folder and decode it into a struct
        let resourceURL: URL = try XCTUnwrap(Bundle.module.url(forResource: "TestData", withExtension: "json"))
        let testData = try JSONDecoder().decode(TestData.self, from: Data(contentsOf: resourceURL))
        XCTAssertEqual("BlogApp", testData.testModuleName)
    }
}

internal struct TestData: Codable, Hashable {
    var testModuleName: String
}
