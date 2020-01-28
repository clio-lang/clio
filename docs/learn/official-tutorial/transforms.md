# Transforms

Clio doesn't support passing anonymous functions as arguments, but instead Clio introduces the concept of _transforms_. A transform can be used to transform arguments of a function call _before_ calling the function. Transforms are lazy and are evaluated on function call evaluation.

```text
[1 2 3 4 5] -> * print #twice @ #is (transform n: n * 2)
```

In the above example, `#twice` and `#is` are _words_. A word is a string that is only one word. Transforms are defined similar to functions, but with one argument and only one statement in the body.

To specify the position of argument passed to transform we can use `@`:

```text
2 3 4 -> print 'twice 2nd arg is' (transform @1 as n: n * 2)
```

To help with readability, Clio syntax enforces a few rules:

1. A single function call is no more than a single line
2. Transforms are only one line

