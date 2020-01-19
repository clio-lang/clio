const { IO } = require("./io");

class Array {
  constructor(...items) {
    this.items = items;
  }
  valueOf() {
    return this.items.map(item => item.valueOf());
  }
  map(...args) {
    const items = this.items
      .map(...args)
      .map(item => (item instanceof IO ? item.valueOf() : item));
    return new Array(...items);
  }
}

module.exports = {
  Array
};
