import type ts from "typescript";

import { createEffectReactLanguageService } from "./language-service.js";

function initialize({ typescript }: { readonly typescript: typeof ts }) {
  return {
    create(info: ts.server.PluginCreateInfo) {
      return createEffectReactLanguageService({
        languageService: info.languageService,
        languageServiceHost: info.languageServiceHost,
        typescript,
      });
    },
  } satisfies ts.server.PluginModule;
}

export = initialize;
