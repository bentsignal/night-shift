import { defineConfig } from "vitest/config";

import { effectReact } from "@night-shift/effect-react-compiler";

export default defineConfig({
  plugins: [effectReact({ scanRoots: ["src"], transformUnscanned: true })],
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
