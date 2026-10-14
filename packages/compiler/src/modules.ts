/** Explicit JavaScript package interop. Unprefixed names remain Kalandra package names. */
export interface ExternalImport {
  readonly kind: "esm" | "cjs";
  readonly specifier: string;
}
export function externalImport(path: string): ExternalImport | null {
  const match = /^(esm|cjs):(.+)$/.exec(path);
  if (!match) return null;
  const specifier = match[2]!;
  // Package names, subpaths, and explicit host builtins; no implicit files or URLs.
  if (
    /\s|\\|\0|[?#]/.test(specifier) ||
    specifier.startsWith(".") ||
    specifier.startsWith("/")
  )
    return null;
  if (specifier.includes(":") && !/^node:[a-zA-Z0-9_/-]+$/.test(specifier))
    return null;
  const segments = specifier.split("/");
  if (
    segments.some((part) => !part || part === "." || part === "..") ||
    (specifier.startsWith("@") && segments.length < 2)
  )
    return null;
  return { kind: match[1] as "esm" | "cjs", specifier };
}
