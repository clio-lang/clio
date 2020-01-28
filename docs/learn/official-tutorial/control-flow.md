# Control flow

To control the flow of your programs, Clio provides if/elif/else statements.

```text
fn check n:
  if   n > 0: #positive
  elif n < 0: #negative
        else: #zero

[1 0 -1] -> * print @ #is (transform n: check)
```

Body of a if/elif/else statement can be either a single expression or a block of expressions. In Clio, conditional statements are functions and can be used inside a flow, for example we can re-write the above example like this:

```text
fn check n:
  n -> if > 0: #positive
     elif < 0: #negative
         else: #zero

[1 0 -1] -> * print @ #is (transform n: check)
```

Clio also supports event-based control flow, but we will discuss this later.

