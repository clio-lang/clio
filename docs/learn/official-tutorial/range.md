# Range

Clio supports range literals. To define them, you can write:

```text
export fn main argv:
  start..end by step
```

with `start`, `end` and `step` being optional:

```text
export fn main argv:
  0..4 -> .toArray -> console.log
  0..10 by 2 -> .toArray -> console.log
  ..4 -> .toArray -> console.log
```

[Try on playground.](https://playground.clio-lang.org/?code=export%20fn%20main%20argv%3A%0A%20%200..4%20-%3E%20.toArray%20-%3E%20console.log%0A%20%200..10%20by%202%20-%3E%20.toArray%20-%3E%20console.log%0A%20%20..4%20-%3E%20.toArray%20-%3E%20console.log)

{% hint style="warning" %}
Ranges are lazy, you can define infinite ranges and map functions to them, however a proper `take` function isn't implemented yet.
{% endhint %}

