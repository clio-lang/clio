# Logicals

Clio recognizes `and`, `or` and `not` keywords for logical operations.

## Syntax

Syntax for `not` is:

```clio
not xyz
```

Syntax for `and` is:

```clio
abc and xyz
```

Syntax for `or` is:

```clio
abc or xyz
```

where `abc` and `xyz` can be one of `symbol`, `boolean`, `slice`
`comparison` or `property`.

## Order of precedence

Clio parses the logical operators with the following precedence:

1. not
2. and
3. or

## JavaScript compile target

Clio compiles these logical operators to:

 - `not xyz` to `(!xyz)`
 - `abc and xyz` to `(abc && xyz)`
 - `abc or xyz` to `(abc || xyz)`
