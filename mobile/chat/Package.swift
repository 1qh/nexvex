// swift-tools-version: 6.1
// This is a Skip (https://skip.dev) package.
import PackageDescription

internal let package = Package(
    name: "chat-app",
    defaultLocalization: "en",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [
        .library(name: "ChatApp", type: .dynamic, targets: ["ChatApp"]),
    ],
    dependencies: [
        .package(url: "https://source.skip.tools/skip.git", from: "1.7.2"),
        .package(url: "https://source.skip.tools/skip-ui.git", from: "1.0.0"),
        .package(path: "../convex-shared"),
    ],
    targets: [
        .target(name: "ChatApp", dependencies: [
            .product(name: "SkipUI", package: "skip-ui"),
            .product(name: "ConvexShared", package: "convex-shared"),
        ], resources: [.process("Resources")], plugins: [.plugin(name: "skipstone", package: "skip")]),
        .testTarget(name: "ChatAppTests", dependencies: [
            "ChatApp",
            .product(name: "SkipTest", package: "skip"),
        ], resources: [.process("Resources")], plugins: [.plugin(name: "skipstone", package: "skip")]),
    ]
)
