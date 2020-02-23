# Rule

`Rule` class is used to create generator rules. `Rule`
needs to be subclassed and `parseCST` should be overridden:

```JavaScript
const { Rule } = require("clio-core/generator/rule");
const arr = require("clio-core/generator/arr");

const make = items => arr`new Array(${items.join(", ")})`;

class array extends Rule {
  parseCST() {
    const { items } = this.cst;
    const processedItems = items.map(item => this.generate(item));
    return make(processedItems);
  }
}

module.exports = { array };

```

Each `Rule` instance has a `.generate` method that can be used to
generate code for the subparts of the CST (Array items in the above example).

`.cst` contains the current node's CST. `parseCST` method should return a
string, a `SourceNode` item, or an array of strings and `SourceNode`s.

`generator/arr` can be used as a template tag to make generating these arrays easier:

```JavaScript
arr`new Array(${item1}, ${item2})` // yields
["new Array(", item1, ",", item2, ")"]
```
