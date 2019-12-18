const { IO } = require("./lazy");

class Array {
  constructor(...items) {
    this.items = items;
  }
  valueOf() {
    return this.items.map(item => item.valueOf());
  }
  map(...args) {
    const items = this.items.map(...args);
    for (const item of items) {
      if (item instanceof IO) {
        item.valueOf();
      }
    }
    return new Array(...items);
  }
}

module.exports = {
  Array
};
