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

The above calls the `add` function with two arguments: `2` and `3`. However, there is another way to call a function, and
that's using pipes:

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

The above example calls `add` with `2` and `3`, then passes the results to `console.log`. If you run the above example you will see a 5 in your console! You can also use parenthesis to pass the results of a function call to another:

```text
fn add a b:
  a + b

export fn main argv:
  console.log (add 2 3)
```

However, using this syntax is discouraged, specially when there are more than two nested calls as it can lead to unreadable, confusing pieces of code!

Finally, if you want to call a function with no arguments, simply do:

```text
export fn main argv:
  functionToCall ()
```

The above code calls `functionToCall` with no arguments.