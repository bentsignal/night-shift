import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "night shift",
  slug: "night-shift",
  scheme: "night-shift",
  version: "0.1.0",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  ios: {
    bundleIdentifier: "dev.shawn.nightshift",
    supportsTablet: true,
    infoPlist: { ITSAppUsesNonExemptEncryption: false },
  },
  android: {
    package: "dev.shawn.nightshift",
  },
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  plugins: [
    "expo-router",
    [
      "expo-build-properties",
      {
        ios: {
          deploymentTarget: "16.4",
          usePrecompiledModules: false,
        },
      },
    ],
    "./expo-plugins/with-ios-scene-lifecycle.cjs",
    "./expo-plugins/with-ios-pods-deployment-target.cjs",
    [
      "expo-splash-screen",
      {
        backgroundColor: "#0b0e14",
        resizeMode: "contain",
      },
    ],
  ],
});
