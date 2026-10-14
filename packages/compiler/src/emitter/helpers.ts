import { eventHelpersSource } from "./events.js";
import { recordHelpersSource } from "./records.js";
/** Clio compatibility helpers; see NOTICE. Embedded in standalone output on demand.
 * This is trusted JavaScript parsed by the emitter, never evaluated by the compiler.
 * Historical edge cases are intentional until the compatibility pass is complete.
 */
export const helperSource = `(() => {
class Range {
  constructor(start = 0, end = Infinity, step, mapfn) {
    this.start = start;
    this.end = end;
    this.step = step || (end > start ? 1 : -1);
    this.mapfn = mapfn;
    this.index = 0;
  }
  get length() {
    return Math.floor((this.end - this.start) / this.step);
  }
  map(fn) {
    const mapfn = this.mapfn
      ? (item, index, range) => fn(this.mapfn(item, index, range), index, range)
      : fn;
    return new Range(this.start, this.end, this.step, mapfn);
  }
  get(index) {
    const value = this.start + this.step * index;
    if (value > this.end) return undefined; // JS arrays do the same
    return this.mapfn ? this.mapfn(value, index, this) : value;
  }
  take(n) {
    return new Range(
      this.start,
      this.start + n * this.step,
      this.step,
      this.mapfn
    );
  }
  skip(n) {
    return new Range(
      this.start + n * this.step,
      this.end,
      this.step,
      this.mapfn
    );
  }
  slice(start, end) {
    return this.skip(start).take(end - start);
  }
  toArray() {
    return [...this];
  }
  toString() {
    return \`[\${this.start}:\${this.end}:\${this.step}]\`;
  }
  next() {
    const value = this.start + this.step * this.index;
    const done = value >= this.end;
    const mapped = this.mapfn ? this.mapfn(value, this.index, this) : value;
    if (done) this.index = 0;
    else this.index++;
    return { value: mapped, done };
  }
  [Symbol.iterator]() {
    return this;
  }
}

const range = (start, end, step) => new Range(start, end, step);


const getIndex = (item, index) => {
  const isRange = item instanceof Range;
  index = index >= 0 ? index : item.length - index;
  return isRange ? item.get(index) : item[index];
};

const numberSlice = (item, number) => getIndex(item, number);

const rangeSlice = (item, range) => {
  const result = [];
  for (const index of range) {
    if (index > item.length) return result;
    result.push(getIndex(item, index));
  }
  return result;
};

const arraySlice = (arr, slicers) => {
  return slicers.map((slicer, index) => {
    if (isNumber(slicer)) return getIndex(arr, slicer);
    else return slice(arr[index], slicer);
  });
};

const checkType = (o) =>
  Object.prototype.toString
    .call(o)
    .replace(/\\[|object\\s|\\]/g, "")
    .toLowerCase();

const isNumber = (o) => checkType(o) === "number";
const isRange = (o) => o instanceof Range;

const slice = (arr, slicers) => {
  if (isRange(slicers)) return rangeSlice(arr, slicers);
  if (slicers.length === 1 && isNumber(slicers[0]))
    return numberSlice(arr, slicers[0]);
  return arraySlice(arr, slicers);
};

const f = (...args) => args.map((arg) => \`\${arg}\`).join("");

const Any = Symbol("Any");

const help = (fn) => console.log(fn.__doc__);

const describe = (description, fn) => {
  fn.__doc__ = description;
  return fn;
};

const returns = (type, fn) => {
  fn.__returns__ = type;
  return fn;
};

const params = (...params) => {
  const fn = params.pop();
  fn.__accepts__ = params;
  return fn;
};

const checkDecoratedType = (value, type) => {
  if (Array.isArray(type)) {
    if (!Array.isArray(value)) {
      return false;
    }
    return value.every((item) => checkDecoratedType(item, type[0]));
  }
  if (type === Number) {
    return typeof value === "number" || value instanceof Number;
  }
  if (type === String) {
    return typeof value === "string" || value instanceof String;
  }
  return value instanceof type;
};

const nameOfType = (value) =>
  Array.isArray(value)
    ? \`Array[\${nameOfType(value[0])}]\`
    : value?.constructor?.name ||
      Object.prototype.toString.call(value).slice(8, -1);

const typeName = (type) =>
  Array.isArray(type)
    ? \`Array[\${typeName(type[0])}]\`
    : type?.name || Object.prototype.toString.call(type).slice(8, -1);

const check = (fn) => {
  const wrapped = (...args) => {
    if (wrapped.__accepts__) {
      for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        const paramType = wrapped.__accepts__[i];
        const match = checkDecoratedType(arg, paramType);
        if (!match) {
          const vTypeName = nameOfType(arg);
          const pTypeName = typeName(paramType);
          throw new Error(
            \`Argument of type \${vTypeName} at position \${i} does not satisfy parameter of type \${pTypeName}\`
          );
        }
      }
    }
    const result = fn(...args);
    if (wrapped.__returns__) {
      const match = checkDecoratedType(result, wrapped.__returns__);
      if (!match) {
        const rTypeName = typeName(wrapped.__returns__);
        const vTypeName = nameOfType(result);
        throw new Error(
          \`Returned value \${result} with type \${vTypeName} does not satisfy return type of \${rTypeName}\`
        );
      }
    }
    return result;
  };
  wrapped.__accepts__ = fn.__accepts__;
  wrapped.__doc__ = fn.__doc__;
  wrapped.__returns__ = fn.__returns__;
  return wrapped;
};

return { range, slice, f, Any, help, describe, returns, params, check, ...${recordHelpersSource}, ...${eventHelpersSource} };
})()`;
