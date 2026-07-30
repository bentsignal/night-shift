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

export type ChildReference = {
  readonly component: SymbolReference;
  readonly providers: readonly SymbolReference[];
};

export type ComponentDeclaration = {
  readonly childReferences: readonly ChildReference[];
  readonly fileName: string;
  readonly initializerEnd: number;
  readonly kind: "component";
  readonly jsxChildReferences: readonly ChildReference[];
  readonly location: SourceLocation;
  readonly name: string;
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
  readonly dependencies: GraphDependency[];
  readonly directRequirements: Set<string>;
  readonly id: string;
  readonly providedRequirements: Set<string>;
};

export type GraphDependency = {
  readonly id: string;
  readonly providedRequirements: ReadonlySet<string>;
};
