const fs = require("node:fs");
const path = require("node:path");
const {
  IOSConfig,
  withInfoPlist,
  withXcodeProject,
} = require("expo/config-plugins");

const SCENE_DELEGATE_FILE = "SceneDelegate.swift";

function withIosSceneLifecycle(config) {
  config = withInfoPlist(config, (config) => {
    config.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: "Default Configuration",
            UISceneDelegateClassName: "$(PRODUCT_MODULE_NAME).SceneDelegate",
          },
        ],
      },
    };
    return config;
  });

  return withXcodeProject(config, (config) => {
    const projectName = IOSConfig.XcodeUtils.getProjectName(
      config.modRequest.projectRoot,
    );
    const sceneDelegatePath = path.join(
      config.modRequest.platformProjectRoot,
      projectName,
      SCENE_DELEGATE_FILE,
    );
    fs.writeFileSync(sceneDelegatePath, createSceneDelegateSource());
    IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
      filepath: `${projectName}/${SCENE_DELEGATE_FILE}`,
      groupName: projectName,
      project: config.modResults,
    });
    return config;
  });
}

function createSceneDelegateSource() {
  return `import React
import UIKit

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene else { return }
    guard let appDelegate = UIApplication.shared.delegate as? AppDelegate else {
      return
    }

    let window = appDelegate.window ?? UIWindow(windowScene: windowScene)
    window.windowScene = windowScene
    window.makeKeyAndVisible()
    appDelegate.window = window
    self.window = window
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    _ = RCTLinkingManager.application(
      UIApplication.shared,
      continue: userActivity,
      restorationHandler: { _ in })
  }

  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    URLContexts.forEach { context in
      _ = RCTLinkingManager.application(
        UIApplication.shared,
        open: context.url,
        options: [
          .sourceApplication: context.options.sourceApplication as Any,
          .annotation: context.options.annotation as Any,
        ])
    }
  }
}
`;
}

module.exports = withIosSceneLifecycle;
