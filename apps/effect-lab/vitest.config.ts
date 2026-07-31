import viteReact from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

import { effectReact } from "@night-shift/effect-react-compiler";

const effectReactSources = [
  "src",
  "../../shared/effect-react/example/props.tsx",
];

export default defineConfig({
  plugins: [
    effectReact({ scanRoots: effectReactSources }),
    tsconfigPaths(),
    viteReact({
      babel: {
        plugins: ["babel-plugin-react-compiler"],
      },
    }),
  ],
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/test/setup.ts"],
  },
});
