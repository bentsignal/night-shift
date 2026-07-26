export const defaultDevelopmentWebUrl = "http://localhost:3000";

export function resolveConvexUrl(value = process.env.VITE_CONVEX_URL) {
  return value ?? "https://example.invalid";
}
