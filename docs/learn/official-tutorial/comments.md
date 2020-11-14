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
Clio ignores the comments \(doesn't transfer them to the compiled files\)
{% endhint %}
