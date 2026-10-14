/** Bounded inspection without invoking getters, toJSON, or user coercion methods. */
export function display(value: unknown, limit = 4000): string {
  let remaining = limit;
  const seen = new Set<object>();
  let nodes = 0;
  const take = (text: string) => {
    const result = text.slice(0, remaining);
    remaining -= result.length;
    return result;
  };
  const visit = (item: unknown, depth: number): string => {
    if (remaining <= 0 || ++nodes > 200) return "";
    if (typeof item === "string")
      return take(JSON.stringify(item.slice(0, remaining)));
    if (item === null || typeof item !== "object")
      return take(
        typeof item === "number" && Object.is(item, -0)
          ? "-0"
          : typeof item === "function"
            ? "[Function]"
            : String(item),
      );
    if (seen.has(item)) return take("[Circular]");
    if (depth > 4) return take("[…]");
    seen.add(item);
    const array = Array.isArray(item);
    let result = take(array ? "[" : "{");
    const keys = Object.keys(item).slice(0, 30);
    for (const [index, key] of keys.entries()) {
      if (remaining <= 0) break;
      if (index) result += take(", ");
      if (!array) result += take(key + ": ");
      const field = Object.getOwnPropertyDescriptor(item, key);
      result +=
        field && "value" in field
          ? visit(field.value, depth + 1)
          : take("[Getter]");
    }
    result += take(array ? "]" : "}");
    seen.delete(item);
    return result;
  };
  try {
    return visit(value, 0) + (remaining === 0 || nodes > 200 ? "…" : "");
  } catch {
    return "[Unprintable value]";
  }
}
