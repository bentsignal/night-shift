import { defineConfig } from "vitest/config";

import { effectReact } from "@night-shift/effect-react-compiler";

export default defineConfig({
  plugins: [effectReact({ failOnDiagnostics: false, scanRoots: ["example"] })],
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
  },
});
