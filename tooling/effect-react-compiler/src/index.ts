// eslint-disable-next-line @typescript-eslint/triple-slash-reference -- Registers the erased ambient Vite virtual-module declaration for package consumers.
/// <reference path="./virtual.d.ts" />

export { analyzeEffectReact } from "./analyzer";
export {
  createAnalysisModule,
  effectReact,
  effectReactAnalysisModuleId,
  effectReactCompiler,
  formatEffectReactDiagnostics,
} from "./vite";
export type { EffectReactCompilerPluginOptions } from "./vite";
export type {
  AnalyzeEffectReactOptions,
  AnalyzedComponent,
  AnalyzedComponentKind,
  BoundaryKind,
  EffectReactAnalysis,
  EffectReactDiagnostic,
  EffectReactDiagnosticCode,
  EffectReactRoot,
  EffectReactSource,
  ReactBoundary,
  SourceLocation,
} from "./types";
