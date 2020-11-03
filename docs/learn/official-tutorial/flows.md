# Flows

We introduced the pipe operator `->` in the previous section and we saw how we can pipe results of a function to another. Using the pipe operator, you can chain as many function calls as you want:

```text
fn add a b:
  a + b

fn mul a b:
  a * b

export fn main argv:
  add 2 3 -> mul 4 -> console.log
```

The above adds `2` and `3` first, then mutiplies them by `4`, then prints out the result. To format your code you can put indents before the `->` operator, for example:

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

## Map

Using pipes, you can also map a function to a value, for example, to print an array we can write:

```text
export fn main argv:
  [1 2 3] -> console.log
```

and to print each item in the array, we can map the `console.log` function to the array:

```text
export fn main argv:
  [1 2 3] -> * console.log
```

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

## Methods

We can call methods in flows, using the pipe operator:

```text
export fn main argv:
  "hello" -> .toUpperCase -> console.log
```

This will call `toUpperCase` method of `"hello"`, and then pipe the result to `console.log`!

## Branching

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

Should print out `[[3, 3], [4, 6], [5, 9]]`.

# Assignments

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