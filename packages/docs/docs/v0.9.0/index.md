# Hello world

This is the
![logo](https://gblobscdn.gitbook.com/spaces%2F-LYYAInRjOVo73nXt9Xy%2Favatar.png?alt=media)
**Clio** _documentation_ generator!

This should be in a separate paragraph! [link](https://google.com)

![image](https://images.pexels.com/photos/1025469/pexels-photo-1025469.jpeg)

## Another Section

You can install > clio using the `npm i -g clio` command:

```bash
npm i -g clio
```

## Playground

```clio
export fn main argv:
  console.log "Hello world"
```

## Lists

- this
- is
  1. a
  2. b
  3. c
- list

## Quotes

> **Clio** is great :)

## Tables

| head | center | head |
| :--- | :----: | ---: |
| body |  body  | body |
| body |  body  | body |
| body |  body  | body |

## Tabs

|> clio.toml

```toml
[build]
src = "src"
destination = "dest"
```

|> main.clio

```js
export fn main argv:
  console.log argv
```

## Hint

[info]> Just for you info!
[exclamation]> DANGER!
[question]> How do I do that?
[check]> Congrats!
