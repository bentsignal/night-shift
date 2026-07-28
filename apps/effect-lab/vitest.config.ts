import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

import { effectReact } from "@night-shift/effect-react-compiler";

export default defineConfig({
  plugins: [effectReact({ scanRoots: ["src"] }), tsconfigPaths()],
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/test/setup.ts"],
  },
});
