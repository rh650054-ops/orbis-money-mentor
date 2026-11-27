// swift-tools-version: 5.9
import PackageDescription

// VANT's own bridge to StoreKit 2. A local Capacitor plugin: `npx cap sync ios` adds it to
// ios/App/CapApp-SPM/Package.swift and registers VantStorekitPlugin in the app.
let package = Package(
    name: "VantStorekit",
    platforms: [.iOS(.v15)],
    products: [
        .library(name: "VantStorekit", targets: ["VantStorekitPlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0")
    ],
    targets: [
        .target(
            name: "VantStorekitPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm")
            ],
            path: "ios/Sources/VantStorekitPlugin"),
        .testTarget(
            name: "VantStorekitPluginTests",
            dependencies: ["VantStorekitPlugin"],
            path: "ios/Tests/VantStorekitPluginTests",
            resources: [.copy("Produtos.storekit")])
    ]
)
