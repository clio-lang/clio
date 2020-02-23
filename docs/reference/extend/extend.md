# Extending the language

To extend the language, there are a few steps we need to take.
First step is to make sure the lexer recognizes all the symbols we need.
Next is to add parsing rules, then we should define the generator rules
to translate the CST (parsing result) into target code. Last step,
is to make sure our runtime provides everything needed to run the added feature.

As an example, let's add the bitwise and operator `&` to Clio:

## Extending the lexer

To extend the recognized symbols, we need to add our definitions to `core/patterns.js`.
Let's add our `&` symbol to the mentioned file:

```JavaScript
const patterns = {

  bitwiseAndOp: /^&/,

  // rest of the patterns
}
```

## Adding parsing rules

Clio uses Bean parser, which is a binary parsing engine. All rules in Bean
are binary, which means they're made of exactly two nodes. They're referred to
as left and right.

To add a parsing rule we should modify `core/clio.beef` file. Let's add the rules
for the bitwise and operator:

```beef
symbol|number bitwiseAndOp => bitwiseAndStart { lhs: left, location: left.location }
```

Above rule matches if left side is one of `symbol` or `number`, and right side is a `bitwiseAndOp`.
it results in a `bitwiseAndStart` token, with a lhs value of `left` (which refers to the left matched token),
and a location of `left.location`.

Now we need to add another rule, to match our rhs:

```beef
bitwiseAndStart symbol|number => bitwiseAndExpr { lhs: left.lhs, rhs: right, location: left.location }
```

Never forget to add the `location` key to your definitions. Most of the time this is the location of the left token.

## Adding generator rules

To add a generator rule, we need to use the [Rule](./rule.md) class. We make a new file for our rule in
`core/generator/rules`, let's call it `bitwise-and.js`:

```JavaScript
const { Rule } = require("../rule");
const arr = require("../arr");

const make = (left, right) => arr`builtins.bitwiseAnd(${left}, ${right})`;

class bitwiseAnd extends Rule {
  parseCST() {
    const { lhs, rhs } = this.cst;
    const left = this.generate(lhs);
    const right = this.generate(rhs);
    return make(left, right);
  }
}

module.exports = { bitwiseAnd };
```

Now we need to add it to the list of rules in `core/generator/rules.js`:

```JavaScript
module.exports = {
  ...require("./rules/bitwise-and"),
  // rest of the rules
}
```

## The required runtime

Our bitwise operator calls the `builtins.bitwiseAnd` function on runtime, which needs to be defined.
Let's add this function to `internals/src/builtins.js`:

```JavaScript
// ... builtins
const bitwiseAnd = wrapLazy((scope, a, b) => a.valueOf() & b.valueOf());
// ... rest of the builtins
module.exports = {
  // ... exports,
  bitwiseAnd
};

```

This should be enough to add a bitwise and operator to our language.
