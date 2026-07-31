import type ts from "typescript";

import { createEffectReactLanguageService } from "./language-service.js";

function initialize({ typescript }: { readonly typescript: typeof ts }) {
  return {
    create(info: ts.server.PluginCreateInfo) {
      if (!usesEffectReact(info)) {
        return info.languageService;
      }

      return createEffectReactLanguageService({
        languageService: info.languageService,
        languageServiceHost: info.languageServiceHost,
        typescript,
      });
    },
  } satisfies ts.server.PluginModule;
}

function usesEffectReact(info: ts.server.PluginCreateInfo) {
  const isConfigured =
    info.project
      .getCompilerOptions()
      .plugins?.some(
        (plugin) => plugin.name === "@night-shift/effect-react-compiler",
      ) ?? false;
  if (isConfigured) {
    return true;
  }

  try {
    require.resolve("@night-shift/effect-react", {
      paths: [info.project.getCurrentDirectory()],
    });
    return true;
  } catch {
    // A global editor registration stays inert outside Effect React projects.
  }

  return info.project.getFileNames().some((fileName) => {
    if (
      fileName.includes("/node_modules/") ||
      !/\.[cm]?[jt]sx?$/u.test(fileName)
    ) {
      return false;
    }
    const snapshot = info.languageServiceHost.getScriptSnapshot(fileName);
    return snapshot
      ?.getText(0, snapshot.getLength())
      .includes("@night-shift/effect-react");
  });
}

export = initialize;
