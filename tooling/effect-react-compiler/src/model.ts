import type ts from "typescript";

import type { SourceLocation } from "./types.js";

export type SymbolReference = {
  readonly fileName: string;
  readonly location: SourceLocation;
  readonly name: string;
};

export type ImportBinding = {
  readonly exportedName: string;
  readonly fileName: string;
};

export type StoreDeclaration = {
  readonly fileName: string;
  readonly location: SourceLocation;
  readonly name: string;
  readonly serviceName: string;
};

export type ComponentDeclaration = {
  readonly childReferences: readonly SymbolReference[];
  readonly fileName: string;
  readonly initializerEnd: number;
  readonly kind: "component" | "provided";
  readonly jsxChildReferences: readonly SymbolReference[];
  readonly location: SourceLocation;
  readonly name: string;
  readonly providedStoreReference: SymbolReference | undefined;
  readonly serviceReferences: readonly SymbolReference[];
};

export type OrdinaryJsxBoundary = {
  readonly componentReference: SymbolReference;
  readonly ownerName: string;
};

export type SourceModel = {
  readonly components: Map<string, ComponentDeclaration>;
  readonly exports: Map<string, SymbolReference>;
  readonly fileName: string;
  readonly imports: Map<string, ImportBinding>;
  readonly ordinaryBoundaries: readonly OrdinaryJsxBoundary[];
  readonly sourceFile: ts.SourceFile;
  readonly stores: Map<string, StoreDeclaration>;
};

export type GraphComponent = {
  readonly declaration: ComponentDeclaration;
  readonly dependencies: Set<string>;
  readonly directRequirements: Set<string>;
  readonly id: string;
  readonly providedRequirements: Set<string>;
};
