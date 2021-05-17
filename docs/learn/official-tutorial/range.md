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

{% hint style="warning" %}
Ranges are lazy, you can define infinite ranges and map functions to them, however a proper `take` function isn't implemented yet.
{% endhint %}

{% hint style="danger" %}
A bug in latest release prevents the above examples to run, this will be fixed in the next release.
{% endhint %}

