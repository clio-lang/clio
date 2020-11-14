# Coding guidelines

These general guidelines are supposed to assist you as a developer.

## Deep Equality checks

You should always prefer using deep equality checks `===` over regular equality checks `==` in comparisons.

#### Do:

```js
if (name === "conditional") {
  // ...
}
```

#### Don't:

```js
if (name == "conditional") {
  // ...
}
```
