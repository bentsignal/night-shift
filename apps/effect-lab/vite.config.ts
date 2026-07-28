import type { PluginOption } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

interface CompilerModule {
  readonly effectReact: (options: {
    readonly include: readonly string[];
  }) => PluginOption;
}

export default defineConfig(async () => ({
  server: {
    host: true,
    port: process.env.PORT ? Number(process.env.PORT) : 3010,
  },
  plugins: [
    await loadEffectReactCompiler(),
    tsconfigPaths(),
    tanstackStart({
      srcDirectory: "src",
      router: {
        generatedRouteTree: "../.tanstack/routeTree.gen.ts",
        routesDirectory: "app",
      },
    }),
    viteReact({
      babel: {
        plugins: ["babel-plugin-react-compiler"],
      },
    }),
    nitro(),
  ],
}));

/**
 * The compiler is optional only while its workspace package is developed in
 * parallel. Once present, this app exercises it without generated source files.
 */
async function loadEffectReactCompiler() {
  const packageName = "@night-shift/effect-react-compiler";
  try {
    const compiler = (await import(
      /* @vite-ignore */ packageName
    )) as CompilerModule;
    return compiler.effectReact({ include: ["src/**/*.tsx"] });
  } catch (error) {
    if (isMissingCompilerPackage(error)) {
      return null;
    }
    throw error;
  }
}

function isMissingCompilerPackage(error: unknown) {
  return (
    error instanceof Error &&
    "code" in error &&
    error.code === "ERR_MODULE_NOT_FOUND" &&
    error.message.includes("@night-shift/effect-react-compiler")
  );
}
