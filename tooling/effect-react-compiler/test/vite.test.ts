import { describe, expect, it } from "vitest";

import {
  createAnalysisModule,
  effectReactAnalysisModuleId,
  effectReactCompiler,
  formatEffectReactDiagnostics,
} from "../src";

describe("effectReactCompiler", () => {
  it("exposes analysis through a zero-codegen virtual module", () => {
    const plugin = effectReactCompiler({ failOnDiagnostics: false });
    expect(plugin.name).toBe("@night-shift/effect-react-compiler");
    expect(plugin.resolveId).toBeTypeOf("function");
    expect(effectReactAnalysisModuleId).toBe("virtual:effect-react-analysis");

    const module = createAnalysisModule({
      boundaries: [],
      components: [],
      diagnostics: [],
      hasErrors: false,
    });
    expect(module).toContain("export const analysis =");
    expect(module).toContain("export default analysis");
  });

  it("formats actionable build diagnostics", () => {
    const output = formatEffectReactDiagnostics([
      {
        code: "unresolved-root",
        fileName: "/project/app.tsx",
        location: { column: 14, line: 7 },
        message: "Auth is unresolved.",
      },
    ]);

    expect(output).toContain(
      "/project/app.tsx:7:14 [unresolved-root] Auth is unresolved.",
    );
  });
});
