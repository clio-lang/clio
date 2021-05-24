# Comments

Clio supports line comments, block comments, and nested block comments:

```text
-- This is a line comment

+-
  This one is a block comment
  +- This is another, nested in the previous one -+
-+
```

{% hint style="warning" %}
Clio ignores comments \(doesn't transfer them to the compiled files\)
{% endhint %}

## Documenting Functions

Functions can be documented, simply add a comment before a function's definition and it will be recognized as its documentation. This documentation can be printed or accessed in an IDE, additionally it can be displayed on the terminal using the `clio docs` command:

```text
+-
@name fib
@params {Number} n
@description Calculates the nth fibonacci number
-+
fn fib n:
  if n < 2: n
  else: (fib n - 1)
      + (fib n - 2)

export fn main argv:
  doc fib
  -- or
  console.log fib.__doc__
```

[Try on playground.](https://playground.clio-lang.org/?code=%2B-%0A%40name%20fib%0A%40params%20%7BNumber%7D%20n%0A%40description%20Calculates%20the%20nth%20fibonacci%20number%0A-%2B%0Afn%20fib%20n%3A%0A%20%20if%20n%20%3C%202%3A%20n%0A%20%20else%3A%20%28fib%20n%20-%201%29%0A%20%20%20%20%20%20%2B%20%28fib%20n%20-%202%29%0A%0Aexport%20fn%20main%20argv%3A%0A%20%20doc%20fib%0A%20%20--%20or%0A%20%20console.log%20fib.__doc__)

