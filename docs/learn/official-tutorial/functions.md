# Functions

<<<<<<< HEAD
In Clio, functions are pure and lazy. But before we get into the details, let's define a simple function together.

```text
fn hello person:
  'hello' person -> print
```

In the above example, we defined a function named hello, it accepts a single argument _person_ and says hello to that person. Let's see what happens if we run this function:

```text
fn hello person:
  'hello' person -> print

'Pouya' -> hello
```

If you run the above code, you will not see any output in the console. This is because all the functions you define are _lazy_ by default. That means a call to the function will only be evaluated if the result of it is needed.

Some functions aren't lazy, for example the built-in `print` function is not lazy, that's why you were able to run the _hello world_ example. Eager is opposite of lazy, when a function is eager the evaluation of the function call will be immediate.

To make a function `eager` we decorate our definition with the built-in `eager` function:

```text
@eager
fn hello person:
  'hello' person -> print

'Pouya' -> hello
```

Now if you run the code you will see the results in the console. Functions in Clio have implicit returns, it means the last evaluated expression will be returned from the function, for example:

```text
fn double n:
  n * 2

2 -> double -> print
```

You don't need to explicitly write return in your function body. Functions are pure, they have access to outside scope, but the outside scope is frozen for them, that means if you change value of a variable after you define a function, that function will still have the old value of this variable.

```text
10 => x

fn add_to_x n:
    x + n => x

20 => x
2 -> add_to_x
```

Functions should have at least one argument, value of a function call only depends on its arguments so a function with no arguments is going to be a constant. Since the value a function returns depends only on its arguments, it makes sense to cache the results and speed-up our function calls. This way instead of re-executing the function for same arguments, the function remembers the previous results and returns them.

# We'll talk more about functions in the future.

Functions, are everything in Clio. In fact in your program's body you can only use functions \(and function imports\). here's how we define them:

```text
fn add a b:
  a + b
```

In above code we define a function named `add`, this function accepts two parameters: `a` and `b`, what it does is adding `a` and `b` together. We don't have a `return` keyword in Clio, all functions return the last evaluated expression.

> > > > > > > develop
