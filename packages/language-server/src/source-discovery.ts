/** Discovery must fail explicitly instead of silently omitting possible importers. */
export class SourceDiscoveryError extends Error {}

/** Root-relative patterns: *, ?, and **; matching directories prune their subtree. */
export function sourceExclusions(value: unknown): (path: string) => boolean {
  if (value === undefined) return () => false;
  if (!Array.isArray(value) || value.length > 100)
    throw new SourceDiscoveryError(
      "sourceExcludes must be an array of at most 100 glob strings.",
    );
  const patterns = value.map((pattern: unknown) => {
    if (
      typeof pattern !== "string" ||
      !pattern ||
      pattern.length > 512 ||
      /[\\\0\[\]{}!]/.test(pattern) ||
      pattern.startsWith("/") ||
      pattern
        .split("/")
        .some((part) => part === "." || part === ".." || part === "")
    )
      throw new SourceDiscoveryError(
        "sourceExcludes accepts root-relative globs with *, ? and **; absolute paths, empty segments, negation and braces/classes are unsupported.",
      );
    let regex = "^";
    for (let index = 0; index < pattern.length; index++) {
      const char = pattern[index]!;
      if (char === "*" && pattern[index + 1] === "*") {
        if (
          (index > 0 && pattern[index - 1] !== "/") ||
          (index + 2 < pattern.length && pattern[index + 2] !== "/")
        )
          throw new SourceDiscoveryError(
            "** must occupy a complete sourceExcludes path segment.",
          );
        index++;
        if (pattern[index + 1] === "/") {
          regex += "(?:[^/]+/)*";
          index++;
        } else regex += ".*";
      } else if (char === "*") regex += "[^/]*";
      else if (char === "?") regex += "[^/]";
      else regex += char.replace(/[.*+?^$()|\\]/g, "\\$&");
    }
    return new RegExp(regex + "$");
  });
  return (path) => patterns.some((pattern) => pattern.test(path));
}
