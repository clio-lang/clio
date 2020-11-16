# Range

Clio supports range literals. To define them, you can write:

```text
export fn main argv:
  [start:end:step]
```

with `start`, `end` and `step` being optional.

{% hint style="warning" %}
Syntax for range is implemented, but semantics aren't present in the current version of Clio. This is a work in progress.
{% endhint %}
