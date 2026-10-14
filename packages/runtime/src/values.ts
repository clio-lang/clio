/** Deliberately smaller than structured clone: no implicit prototype loss or closures. */
export type TaskValue =
  | undefined
  | null
  | boolean
  | number
  | string
  | bigint
  | Uint8Array
  | TaskValue[]
  | { [key: string]: TaskValue };
export interface ValueLimits {
  readonly maxDataBytes: number;
  readonly maxDepth: number;
  readonly maxNodes: number;
}
export const defaultValueLimits: ValueLimits = {
  maxDataBytes: 8 * 1024 * 1024,
  maxDepth: 64,
  maxNodes: 100_000,
};

/** Validate and snapshot before queuing, without invoking property getters. */
export function snapshotValue(
  input: unknown,
  limits: ValueLimits = defaultValueLimits,
): TaskValue {
  const ancestors = new Set<object>();
  let nodes = 0,
    bytes = 0;
  const charge = (n: number) => {
    bytes += n;
    if (bytes > limits.maxDataBytes)
      throw new TypeError("Task data exceeds maxDataBytes");
  };
  const visit = (value: unknown, depth: number): TaskValue => {
    if (++nodes > limits.maxNodes || depth > limits.maxDepth)
      throw new TypeError("Task data exceeds structural limits");
    charge(8);
    if (
      value === undefined ||
      value === null ||
      typeof value === "boolean" ||
      typeof value === "number"
    )
      return value;
    if (typeof value === "string") {
      charge(value.length * 2);
      return value;
    }
    if (typeof value === "bigint") {
      charge(value.toString().length);
      return value;
    }
    if (typeof value !== "object")
      throw new TypeError("Task data cannot contain functions or symbols");
    if (
      value instanceof Uint8Array &&
      Object.getPrototypeOf(value) === Uint8Array.prototype
    ) {
      if (!(value.buffer instanceof ArrayBuffer))
        throw new TypeError("Shared buffers are not task data");
      charge(value.byteLength);
      return value.slice();
    }
    if (ancestors.has(value))
      throw new TypeError("Task data cannot contain cycles");
    if (
      !Array.isArray(value) &&
      ![Object.prototype, null].includes(Object.getPrototypeOf(value))
    )
      throw new TypeError(
        "Task data must use plain objects, arrays, or Uint8Array",
      );
    if (Object.getOwnPropertySymbols(value).length)
      throw new TypeError("Task data cannot contain symbol keys");
    ancestors.add(value);
    const properties = Object.getOwnPropertyDescriptors(value);
    let result: TaskValue;
    if (Array.isArray(value)) {
      if (Object.keys(properties).length !== value.length + 1)
        throw new TypeError(
          "Task arrays must be dense and have no extra properties",
        );
      const array: TaskValue[] = [];
      for (let index = 0; index < value.length; index++) {
        const property = properties[String(index)];
        if (!property || !("value" in property) || !property.enumerable)
          throw new TypeError("Task arrays cannot contain getters or holes");
        array.push(visit(property.value, depth + 1));
      }
      result = array;
    } else {
      const object: { [key: string]: TaskValue } = {};
      for (const [key, property] of Object.entries(properties)) {
        if (!("value" in property) || !property.enumerable)
          throw new TypeError(
            "Task objects cannot contain getters or hidden properties",
          );
        charge(key.length * 2);
        Object.defineProperty(object, key, {
          value: visit(property.value, depth + 1),
          enumerable: true,
          writable: true,
          configurable: true,
        });
      }
      result = object;
    }
    ancestors.delete(value);
    return result;
  };
  return visit(input, 0);
}
