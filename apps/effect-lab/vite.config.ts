import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

import { effectReact } from "@night-shift/effect-react-compiler";

export default defineConfig({
  server: {
    host: true,
    port: process.env.PORT ? Number(process.env.PORT) : 3010,
  },
  plugins: [
    effectReact({ scanRoots: ["src"] }),
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
