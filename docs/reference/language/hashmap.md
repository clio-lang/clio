# Hashmaps

Clio recognizes `#` and `hash` keywords for defining hash maps.

## Syntax

Syntax for a hashmap, using `#` is:

```clio
# key value
```

or

```clio
#
  key value
```

Using `hash`:

```clio
hash key value
```

or

```clio
hash
  key value
```

## Sub-hashes

It is possible to define nested hash maps using indents.
Each indent after a key marks the start of an inner hash map
and a dedent marks the end of it:

```clio
hash
  window
    width 500 height 500
```

Is equivalent to the following JavaScript object:

```JavaScript
{
  window: {
    width: 500, height: 500
  }
}
```

## Parsing rules

1. Indent after key means a sub-hash
2. Several key-value pairs can be defined on the same line
3. All whitespace, except indent and dedent is ignored
4. Empty lines are ignored by the parser
