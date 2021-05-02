const { Range } = require("./range");

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
    .replace(/\[|object\s|\]/g, "")
    .toLowerCase();

const isNumber = (o) => checkType(o) === "number";
const isRange = (o) => o instanceof Range;

const slice = (arr, slicers) => {
  if (isRange(slicers)) return rangeSlice(arr, slicers);
  if (slicers.length === 1 && isNumber(slicers[0]))
    return numberSlice(arr, slicers[0]);
  return arraySlice(arr, slicers);
};

module.exports = slice;
