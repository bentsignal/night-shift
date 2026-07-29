export { analyzeEffectReact } from "./analyzer.js";
export {
  createAnalysisModule,
  effectReact,
  effectReactAnalysisModuleId,
  effectReactCompiler,
  formatEffectReactDiagnostics,
} from "./vite.js";
export {
  lowerEffectReactSources,
  loweredToOriginalPosition,
  originalToLoweredPosition,
  type LoweredEffectReactSource,
  type SourceInsertion,
} from "./lowering.js";
export { createEffectReactLanguageService } from "./language-service.js";
export type { EffectReactCompilerPluginOptions } from "./vite.js";
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
} from "./types.js";
