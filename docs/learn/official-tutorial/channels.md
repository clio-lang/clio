# Emitters

Emitters are used as means of real time \(live\) communication with workers. They can pass messages to and from workers to the main application process. They're quite easy to use:

```text
fn onPing em:
  fn onEvent:
    em.emit "pong"

fn pong: emitter () => em -> .on "ping" (onPing em)
fn onPong: console.log "Pong received from worker!"

export fn main:
  await |pong| ()
    -> .on "pong" onPong
    -> .emit "ping"
```

[Try on playground.](https://clio-playground-pouyae.vercel.app/?code=fn%20onPing%20em%3A%0A%20%20fn%20onEvent%3A%0A%20%20%20%20em.emit%20%22pong%22%0A%0Afn%20pong%3A%20emitter%20%28%29%20%3D%3E%20em%20-%3E%20.on%20%22ping%22%20%28onPing%20em%29%0Afn%20onPong%3A%20console.log%20%22Pong%20received%20from%20worker!%22%0A%0Aexport%20fn%20main%3A%0A%20%20await%20%7Cpong%7C%20%28%29%0A%20%20%20%20-%3E%20.on%20%22pong%22%20onPong%0A%20%20%20%20-%3E%20.emit%20%22ping%22)

