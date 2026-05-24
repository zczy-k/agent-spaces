// swift-tools-version: 5.9
// The swift-tools-version declares the minimum version of Swift required to build this package.
//
// Generated file. Do not edit.
//

import PackageDescription

let package = Package(
    name: "FlutterGeneratedPluginSwiftPackage",
    platforms: [
        .macOS("10.15")
    ],
    products: [
        .library(name: "FlutterGeneratedPluginSwiftPackage", type: .static, targets: ["FlutterGeneratedPluginSwiftPackage"])
    ],
    dependencies: [
        .package(name: "window_manager", path: "../.packages/window_manager-0.5.1"),
        .package(name: "url_launcher_macos", path: "../.packages/url_launcher_macos-3.2.5"),
        .package(name: "shared_preferences_foundation", path: "../.packages/shared_preferences_foundation-2.5.6"),
        .package(name: "package_info_plus", path: "../.packages/package_info_plus-9.0.1"),
        .package(name: "share_plus", path: "../.packages/share_plus-10.1.4"),
        .package(name: "path_provider_foundation", path: "../.packages/path_provider_foundation-2.5.1"),
        .package(name: "file_selector_macos", path: "../.packages/file_selector_macos-0.9.5"),
        .package(name: "desktop_drop", path: "../.packages/desktop_drop-0.7.1"),
        .package(name: "FlutterFramework", path: "../.packages/FlutterFramework")
    ],
    targets: [
        .target(
            name: "FlutterGeneratedPluginSwiftPackage",
            dependencies: [
                .product(name: "window-manager", package: "window_manager"),
                .product(name: "url-launcher-macos", package: "url_launcher_macos"),
                .product(name: "shared-preferences-foundation", package: "shared_preferences_foundation"),
                .product(name: "package-info-plus", package: "package_info_plus"),
                .product(name: "share-plus", package: "share_plus"),
                .product(name: "path-provider-foundation", package: "path_provider_foundation"),
                .product(name: "file-selector-macos", package: "file_selector_macos"),
                .product(name: "desktop-drop", package: "desktop_drop"),
                .product(name: "FlutterFramework", package: "FlutterFramework")
            ]
        )
    ]
)
