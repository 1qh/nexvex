import Foundation
@testable import OrgApp
import OSLog
import XCTest

internal let logger = Logger(subsystem: "OrgApp", category: "Tests")

@available(macOS 13, *)
internal final class OrgAppTests: XCTestCase {
    func testOrgApp() {
        logger.log("running testOrgApp")
        XCTAssertEqual(1 + 2, 3, "basic test")
    }

    func testDecodeType() throws {
        // load the TestData.json file from the Resources folder and decode it into a struct
        let resourceURL: URL = try XCTUnwrap(Bundle.module.url(forResource: "TestData", withExtension: "json"))
        let testData = try JSONDecoder().decode(TestData.self, from: Data(contentsOf: resourceURL))
        XCTAssertEqual("OrgApp", testData.testModuleName)
    }
}

internal struct TestData: Codable, Hashable {
    var testModuleName: String
}
