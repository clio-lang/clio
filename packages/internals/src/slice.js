const { Range } = require("./range");

const getIndex = (item, index) =>
  item instanceof Range ? item.get(index) : item[index];

const numberSlice = (item, number) => getIndex(item, number);

const rangeSlice = (item, range) => {
  const result = [];
  for (const index of range) {
    if (index > item.length) return result;
    result.push(getIndex(item, index));
  }
  return result;
};

const objectSlice = (item, object) => {
  // this needs to be improved
  const keys = Object.keys(object)
    .map((key) => {
      if (key.match(/\[.*?:.*?:.*?\]/)) {
        const [_, start, end, step] = key.match(/\[(.*?):(.*?):(.*?)\]/);
        return {
          key: new Range(Number(start), Number(end), Number(step)),
          rawKey: key,
        };
      }
      if (key.includes(",")) return { key: eval(`[${key}]`), rawKey: key };
      return { key: Number(key), rawKey: key };
    })
    .filter(({ rawKey }) => !!rawKey);
  if (!keys.length)
    throw new Error(`Slicing by ${typeof slicer} is not supported.`);
  const result = [];
  for (const { key, rawKey } of keys) {
    const nextSlicer = isNumber(key) ? [key] : key;
    const next = slice(item, nextSlicer);
    const value = object[rawKey];
    const itemSlicer = isNumber(value)
      ? [value]
      : isRange(value)
      ? value
      : [value];
    const doSlice = (arr) =>
      isNumber(value) ? [slice(arr, itemSlicer)] : slice(arr, itemSlicer);
    const sliced = isNumber(key) ? [doSlice(next)] : next.map(doSlice);
    result.push(...sliced);
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
    .replace(/\[|object\s|\]/g, "")
    .toLowerCase();

const isNumber = (o) => checkType(o) === "number";
const isObject = (o) => checkType(o) === "object";
const isRange = (o) => o instanceof Range;

const slice = (arr, slicers) => {
  if (isRange(slicers)) return rangeSlice(arr, slicers);
  if (slicers.length == 1 && isNumber(slicers[0]))
    return numberSlice(arr, slicers[0]);
  if (slicers.length == 1 && !isRange(slicers[0]) && isObject(slicers[0]))
    return objectSlice(arr, slicers[0]);
  return arraySlice(arr, slicers);
};

module.exports = slice;
