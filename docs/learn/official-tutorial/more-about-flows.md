# More about flows

## Maps

Previously we talked about flows and we said there are more advanced uses that we'll discuss further in the manual. One of these advanced features is mapping. You can easily map a function to a list or generator in a flow.

```text
fn double n:
  n * 2

[1 2 3 4 5] -> * double -> * print
```

In the above example, we used `-> *` operator to map `double` to our list, and then we piped its result to print function. Note that whitespace in `-> *` is optional.

## Positional Arguments

We said it's possible to change position of arguments in a function call, let's see how.

```text
'hello' 'world' -> print
'hello' 'world' -> print @1 @0
```

The symbol we use to refer to a specific argument at a specific location is `@`, if used without and index it refers to first argument that is piped to the function, otherwise it refers to the provided index.

When ready, please proceed to [next part](/docs/learn/) of this article.
