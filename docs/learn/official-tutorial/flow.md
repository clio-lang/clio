# Flow

In Clio, all function calls and variable declarations happen inside a flow. Simplest form of flow is a flow that starts with some static data and calls a single function with no arguments. Let's write a simple hello world program together.

```text
'hello world' -> print
```

Strings are defined by single-quotes, whether they're single line or not. `->` is the pipe operator, and `print` is the function we're calling. If you run the above program you should see `hello world` printed in the console.

Assignments and variable declarations also happen in a flow, for example in the above example if we want to put our string in a variable, and then print it, we can write:

```text
'hello world' => message
message -> print
```

As you see, we use `=>` to assign to a variable to declare a new one. Lets move to a more complicated example, lets learn how to pass extra arguments to functions. This is possible in two ways, first one is done like this:

```text
'hello' 'world' -> print
```

This is simple, but it's not that convenient to use, for example when we want to chain functions and add extra argument to the next one. The second way can is done like this:

```text
'hello' -> print 'world'
```

Data is always passed as first argument to the function you call, although this behaviour can be changed using a specific symbol, but we're going to skip this for now. Let's learn how to chain the functions together, let's print an uppercase hello world!

```text
'hello world' -> upper -> print
```

As you can see, result of a function call can be _piped_ to more functions to create a chain. Here the order of execution is from left to right, as opposed to languages that use braces for function calls, in those languages the order is from inner to outer which leads to confusion and makes the code less readable.

Although there's more about flows to learn, but we will skip them for now.
