import type { Linter } from "eslint";
import { defineConfig } from "eslint/config";

const envSyntaxSelector = {
  selector:
    "MemberExpression[object.type='MetaProperty'][object.meta.name='import'][object.property.name='meta'][property.name='env']",
  message:
    "Use `import { env } from '~/env'` instead to ensure validated types.",
} as const;

const envPropertyRestriction = {
  object: "process",
  property: "env",
  message:
    "Use `import { env } from '~/env'` instead to ensure validated types.",
} as const;

const envImportRestriction = {
  name: "process",
  importNames: ["env"],
  message:
    "Use `import { env } from '~/env'` instead to ensure validated types.",
} as const;

const strictTsSyntaxSelectors = [
  {
    selector:
      ":matches(FunctionDeclaration, FunctionExpression, ArrowFunctionExpression)[params.length>4]",
    message:
      "If a function requires more than 4 parameters, use a single object parameter instead.",
  },
  {
    selector:
      "FunctionDeclaration[returnType]:not([returnType.typeAnnotation.type='TSTypePredicate'])",
    message:
      "Do not annotate return types. Let TypeScript infer them so the types stay in sync with the implementation.",
  },
  {
    selector:
      "ArrowFunctionExpression[returnType][parent.type='VariableDeclarator']:not([returnType.typeAnnotation.type='TSTypePredicate'])",
    message:
      "Do not annotate return types. Let TypeScript infer them so the types stay in sync with the implementation.",
  },
  {
    selector:
      "VariableDeclarator[init][id.type='Identifier'][id.typeAnnotation]",
    message:
      "Do not annotate variable types when the initializer already provides the type. Let TypeScript infer it so the types stay in sync with the implementation.",
  },
] as const;

const strictReactSyntaxSelectors = [
  {
    selector: "TryStatement[finalizer]",
    message:
      "Do not use `finally` blocks. The React Compiler cannot optimize components and hooks that use `finally` with try/catch blocks..",
  },
  {
    selector: "CallExpression[callee.name='useContext']",
    message:
      "useContext does not support fine-grained selection and causes re-renders on every context change. Use a Rostra store with a selector instead. Use the rostra skill for more information.",
  },
  {
    selector: "CallExpression[callee.name='useEffect']",
    message:
      "useEffect is banned by default. If you genuinely need an effect to sync with an external system and no better solution exists, add an eslint-disable comment with an explanation of why an effect is necessary. For more information on why you should typically avoid useEffect, see: https://react.dev/learn/you-might-not-need-an-effect",
  },
  {
    selector:
      ":function VariableDeclarator[init.type='JSXElement'], :function VariableDeclarator[init.type='JSXFragment']",
    message:
      "Do not assign JSX to a variable inside a component or hook. Extract it to its own component function so the React Compiler can optimize it.",
  },
  {
    selector:
      "ReturnStatement :matches(JSXElement, JSXFragment) > JSXExpressionContainer > ConditionalExpression",
    message:
      "Do not conditionally render JSX inside return statements. Make sure this conditional rendering is in its own separate component with an early return instead.",
  },
  {
    selector:
      "ReturnStatement :matches(JSXElement, JSXFragment) > JSXExpressionContainer > LogicalExpression[operator='&&']",
    message:
      "Do not conditionally render JSX inside return statements. Make sure this conditional rendering is in its own separate component with an early return instead.",
  },
] as const;

const reactImportRestrictions = [
  {
    name: "react",
    importNames: ["useMemo", "useCallback", "memo"],
    message:
      "React Compiler handles memoization automatically. Only use manual memoization as an escape hatch with a comment explaining why.",
  },
] as const;

const webSyntaxSelectors = [
  {
    selector:
      "CallExpression:matches([callee.name='useSuspenseQuery'], [callee.property.name='useSuspenseQuery']):not(:has(Property[key.name='select']))",
    message:
      "useSuspenseQuery must include a `select` option so the component only subscribes to the data it needs.",
  },
  {
    selector:
      "CallExpression:matches([callee.name='useQuery'], [callee.property.name='useQuery']):not(:has(Property[key.name='select']))",
    message:
      "useQuery must include a `select` option so the component only subscribes to the data it needs. ",
  },
  {
    selector:
      "CallExpression:matches([callee.name='useSearch'], [callee.property.name='useSearch']):not(:has(Property[key.name='select']))",
    message:
      "useSearch must include a `select` option so the component only re-renders when the selected slice changes.",
  },
  {
    selector:
      "CallExpression:matches([callee.name='useRouteContext'], [callee.property.name='useRouteContext']):not(:has(Property[key.name='select']))",
    message:
      "useRouteContext must include a `select` option so the component only re-renders when the selected slice changes.",
  },
  {
    selector:
      "CallExpression:matches([callee.name='useLoaderData'], [callee.property.name='useLoaderData']):not(:has(Property[key.name='select']))",
    message:
      "useLoaderData must include a `select` option so the component only re-renders when the selected slice changes.",
  },
] as const;

const webImportRestrictions = [
  {
    name: "convex/react",
    importNames: ["useQuery"],
    message:
      "Use TanStack Query's `useQuery` with `convexQuery` instead (`import { useQuery } from '@tanstack/react-query'` + `import { convexQuery } from '@convex-dev/react-query'`). This integrates with the route loader cache and supports `select`.",
  },
  {
    name: "@tanstack/react-query",
    importNames: ["useQuery"],
    message:
      "Prefer `useSuspenseQuery` with data preloaded via `ensureQueryData` in the route loader. If `useQuery` is genuinely needed (e.g. conditional fetching), add an eslint-disable comment explaining why.",
  },
  {
    name: "@tanstack/react-router",
    importNames: ["Link"],
    message:
      "Use `QuickLink` from `~/features/quick-link/quick-link` instead. It has the same API as `Link` but with optimizations. If `Link` is genuinely needed, add an eslint-disable comment explaining why.",
  },
] as const;

const mobileSyntaxSelectors = [
  {
    selector:
      "CallExpression[callee.object.name='StyleSheet'][callee.property.name='create']",
    message:
      "Do not use StyleSheet.create in the mobile app. Use Tailwind/Uniwind className styles instead.",
  },
  {
    selector:
      "JSXOpeningElement[name.name='TextInput'] JSXAttribute[name.name='value']",
    message:
      "Do not pass `value` to React Native TextInput. Use an uncontrolled TextInput with `defaultValue` to avoid typing lag.",
  },
] as const;

const mobileImportRestrictions = [
  {
    name: "react-native",
    importNames: ["StyleSheet"],
    message:
      "Do not use StyleSheet in the mobile app. Use Tailwind/Uniwind className styles instead.",
  },
] as const;

export function createStrictSyntax(options: {
  ts?: boolean;
  react?: boolean;
  env?: boolean;
  web?: boolean;
  mobile?: boolean;
}) {
  const syntaxSelectors = [];
  const importPaths = [];

  if (options.ts) {
    syntaxSelectors.push(...strictTsSyntaxSelectors);
  }

  if (options.react) {
    syntaxSelectors.push(...strictReactSyntaxSelectors);
    importPaths.push(...reactImportRestrictions);
  }

  if (options.web) {
    syntaxSelectors.push(...webSyntaxSelectors);
    importPaths.push(...webImportRestrictions);
  }

  if (options.env) {
    syntaxSelectors.push(envSyntaxSelector);
    importPaths.push(envImportRestriction);
  }

  if (options.mobile) {
    syntaxSelectors.push(...mobileSyntaxSelectors);
    importPaths.push(...mobileImportRestrictions);
  }

  const rules: Partial<Record<string, Linter.RuleEntry>> = {};

  if (syntaxSelectors.length > 0) {
    rules["no-restricted-syntax"] = ["error", ...syntaxSelectors];
  }

  if (importPaths.length > 0) {
    rules["no-restricted-imports"] = ["error", { paths: importPaths }];
  }

  if (options.env) {
    rules["no-restricted-properties"] = ["error", envPropertyRestriction];
  }

  return defineConfig(
    ...(options.env
      ? [
          {
            ignores: ["**/env.ts"],
          },
        ]
      : []),
    {
      files: ["**/*.js", "**/*.ts", "**/*.tsx"],
      rules,
    },
  );
}
