@testable import ChatApp
import Foundation
import OSLog
import XCTest

internal let logger = Logger(subsystem: "ChatApp", category: "Tests")

@available(macOS 13, *)
internal final class ChatAppTests: XCTestCase {
    func testChatApp() {
        logger.log("running testChatApp")
        XCTAssertEqual(1 + 2, 3, "basic test")
    }

    func testDecodeType() throws {
        // load the TestData.json file from the Resources folder and decode it into a struct
        let resourceURL: URL = try XCTUnwrap(Bundle.module.url(forResource: "TestData", withExtension: "json"))
        let testData = try JSONDecoder().decode(TestData.self, from: Data(contentsOf: resourceURL))
        XCTAssertEqual("ChatApp", testData.testModuleName)
    }
}

internal struct TestData: Codable, Hashable {
    var testModuleName: String
}
