# Functions

Functions the most important concept in Clio. here's how we define them:

```text
fn add a b:
  a + b
```

In above code we define a function named `add`, this function accepts two parameters: `a` and `b`, what it does is adding `a` and `b` together. We don't have a `return` keyword in Clio, all functions return the last evaluated expression.

A function's body can be either a block just like above, or an expression:

```text
fn add a b: a + b
```

### Anonymous Functions

Clio has a unique way of defining anonymous functions. In Clio, anonymous function parameters are implicit:

```text
add = (@a + @b)
```

The code above makes an anonymous function that accepts two parameters `a` and `b` . Please note that anonymous functions should be wrapped in parentheses. These functions are very useful when filtering out an array, mapping or reducing one.

