import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

import { effectReact } from "@night-shift/effect-react-compiler";

const effectReactSources = [
  "src",
  // The live lab imports this source file directly, so it must stay in the
  // same compiler graph before and after a hot update.
  "../../shared/effect-react/example/props.tsx",
];

export default defineConfig({
  server: {
    host: "127.0.0.1",
  },
  plugins: [
    effectReact({ scanRoots: effectReactSources, transformUnscanned: true }),
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
});
