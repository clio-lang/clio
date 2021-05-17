# Calls

In previous section, we defined an add function:

```text
fn add a b:
  a + b
```

We can run call this function in two different ways. You saw the first form in the Hello World! section:

```text
export fn main argv:
  add 2 3
```

The above code calls the `add` function with two arguments: `2` and `3`. However, there is another way to call a function, and that's using pipes:

```text
export fn main argv:
  2 -> add 3
```

The above piece of code is equivalent to the previous one, now you might ask why would I want to use this syntax instead? Well it's because this syntax allows chaining function calls. Let's say you want to add `2` and `3`, and then print out the results, you can use pipes to chain the calls:

```text
fn add a b:
  a + b

export fn main argv:
  add 2 3 -> console.log
```

[Try on playground.](https://clio-playground.pouyae.vercel.app/?code=fn%20add%20a%20b%3A%0A%20%20a%20%2B%20b%0A%0Aexport%20fn%20main%20argv%3A%0A%20%20add%202%203%20-%3E%20console.log%0A)

The above example calls `add` with `2` and `3`, then passes the results to `console.log`. If you run the above example you will see a 5 in your console! You can also use parenthesis to pass the results of a function call to another:

```text
fn add a b:
  a + b

export fn main argv:
  console.log (add 2 3)
```

[Try on playground.](https://clio-playground.pouyae.vercel.app/?code=fn%20add%20a%20b%3A%0A%20%20a%20%2B%20b%0A%0Aexport%20fn%20main%20argv%3A%0A%20%20console.log%20%28add%202%203%29)

However, using this syntax is discouraged \(but justified in some cases\), specially when there are more than two nested calls as it can lead to unreadable, confusing pieces of code!

Finally, if you want to call a function with no arguments, simply do:

```text
export fn main argv:
  functionToCall ()
```

The above code calls `functionToCall` with no arguments.

