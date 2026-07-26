---
name: code-expo-build
description: Build, install, and test the Code Expo app with local EAS development-client workflows, including the iOS 27 scene-lifecycle accommodations.
---

# Code Expo Build

Treat `apps/mobile` as an Expo-managed app. Build native binaries through
Expo and local EAS. Do not edit generated `apps/mobile/ios` or
`apps/mobile/android` projects as source.

Before a native build, run:

```bash
pnpm --filter @code/mobile lint
pnpm --filter @code/mobile typecheck
```

Build an iOS Simulator development client locally:

```bash
cd apps/mobile
pnpm exec eas build --local --platform ios --profile development:client:sim \
  --output ./build/code-development-client-simulator.tar.gz
```

Use XcodeBuildMCP after extracting the artifact to install, launch, inspect,
and interact with the app. Run Metro with:

```bash
pnpm --filter @code/mobile dev
```

For Android, use the same local profile with
`--platform android --output ./build/code-development-client.apk`.

The Expo config plugins preserve the iOS scene lifecycle and force a consistent
pods deployment target for builds made with Xcode/macOS 27 beta. The checked-in
`expo-modules-jsi` patch preserves the upstream build diagnostics and Swift
compatibility accommodations used by the source scaffold.
