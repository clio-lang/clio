# Flows

## Flows

We introduced the pipe operator `->` in the previous section and we saw how we can pipe results of a function into another one. Using the pipe operator, you can chain as many function calls as you want:

```text
fn add a b:
  a + b

fn mul a b:
  a * b

export fn main argv:
  add 2 3 -> mul 4 -> console.log
```

[Try on playground.](https://clio-playground.pouyae.vercel.app/?code=fn%20add%20a%20b%3A%0A%20%20a%20%2B%20b%0A%0Afn%20mul%20a%20b%3A%0A%20%20a%20*%20b%0A%0Aexport%20fn%20main%20argv%3A%0A%20%20add%202%203%20-%3E%20mul%204%20-%3E%20console.log%0A)

The above adds `2` and `3` first, then multiplies them by `4`, then prints out the result. To format your code you can put indents before the `->` operator, for example:

```text
fn add a b:
  a + b

fn mul a b:
  a * b

export fn main argv:
  add 2 3
    -> mul 4
    -> console.log
```

[Try on playground.](https://clio-playground.pouyae.vercel.app/?code=fn%20add%20a%20b%3A%0A%20%20a%20%2B%20b%0A%0Afn%20mul%20a%20b%3A%0A%20%20a%20*%20b%0A%0Aexport%20fn%20main%20argv%3A%0A%20%20add%202%203%0A%20%20%20%20-%3E%20mul%204%0A%20%20%20%20-%3E%20console.log%0A)

### Map

Using pipes, you can also map a function to a value, for example, to print an array we can write:

```text
export fn main argv:
  [1 2 3] -> console.log
```

[Try on playground.](https://clio-playground.pouyae.vercel.app/?code=export%20fn%20main%20argv%3A%0A%20%20%5B1%202%203%5D%20-%3E%20console.log%0A)

and to print each item in the array, we can map the `console.log` function to the array:

```text
export fn main argv:
  [1 2 3] -> * console.log
```

[Try on playground.](https://clio-playground.pouyae.vercel.app/?code=export%20fn%20main%20argv%3A%0A%20%20%5B1%202%203%5D%20-%3E%20*%20console.log%0A)

As you see, in Clio we use `-> *` to map functions to values. This operator can be used in a flow:

```text
fn add a b:
  a + b

fn mul a b:
  a * b

export fn main argv:
  [1 2 3]
    -> * mul 2
    -> * add 1
    -> console.log
```

[Try on playground.](https://clio-playground.pouyae.vercel.app/?code=fn%20add%20a%20b%3A%0A%20%20a%20%2B%20b%0A%0Afn%20mul%20a%20b%3A%0A%20%20a%20*%20b%0A%0Aexport%20fn%20main%20argv%3A%0A%20%20%5B1%202%203%5D%0A%20%20%20%20-%3E%20*%20mul%202%0A%20%20%20%20-%3E%20*%20add%201%0A%20%20%20%20-%3E%20console.log%0A)

### Methods

We can call methods in flows, using the pipe operator:

```text
export fn main argv:
  "hello" -> .toUpperCase -> console.log
```

[Try on playground.](https://clio-playground.pouyae.vercel.app/?code=export%20fn%20main%20argv%3A%0A%20%20%22hello%22%20-%3E%20.toUpperCase%20-%3E%20console.log)

This will call `toUpperCase` method of `"hello"`, and then pipe the result to `console.log`!

### Branching

You can use branches in Clio flows. Branching is useful when you want to call several functions on the same data, for example:

```text
fn add a b:
  a + b

fn mul a b:
  a * b

export fn main argv:
  [1 2 3] -> *
    add 1 -> console.log
    mul 2 -> console.log
```

[Try on playground.](https://clio-playground.pouyae.vercel.app/?code=fn%20add%20a%20b%3A%0A%20%20a%20%2B%20b%0A%0Afn%20mul%20a%20b%3A%0A%20%20a%20*%20b%0A%0Aexport%20fn%20main%20argv%3A%0A%20%20%5B1%202%203%5D%20-%3E%20*%0A%20%20%20%20add%201%20-%3E%20console.log%0A%20%20%20%20mul%202%20-%3E%20console.log%0A)

Branches return an array, containing the results of each branch:

```text
fn add a b:
  a + b

fn mul a b:
  a * b

export fn main argv:
  [1 2 3]
    -> *
      add 2
      mul 3
    -> console.log
```

[Try on playground.](https://clio-playground.pouyae.vercel.app/?code=fn%20add%20a%20b%3A%0A%20%20a%20%2B%20b%0A%0Afn%20mul%20a%20b%3A%0A%20%20a%20*%20b%0A%0Aexport%20fn%20main%20argv%3A%0A%20%20%5B1%202%203%5D%0A%20%20%20%20-%3E%20*%0A%20%20%20%20%20%20add%202%0A%20%20%20%20%20%20mul%203%0A%20%20%20%20-%3E%20console.log)

Should print out `[[3, 3], [4, 6], [5, 9]]`.

## Assignments

You can assign constants in a flow:

```text
fn add a b:
  a + b

fn mul a b:
  a * b

export fn main argv:
  2 -> add 1 => three
    -> mul 2 => six
  console.log "Three equals" three
  console.log "Six equals" six
```

[Try on playground.](https://clio-playground.pouyae.vercel.app/?code=fn%20add%20a%20b%3A%0A%20%20a%20%2B%20b%0A%0Afn%20mul%20a%20b%3A%0A%20%20a%20*%20b%0A%0Aexport%20fn%20main%20argv%3A%0A%20%202%20-%3E%20add%201%20%3D%3E%20three%0A%20%20%20%20-%3E%20mul%202%20%3D%3E%20six%0A%20%20console.log%20%22Three%20equals%22%20three%0A%20%20console.log%20%22Six%20equals%22%20six)

