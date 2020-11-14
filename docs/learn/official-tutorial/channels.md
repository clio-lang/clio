# Channels

Channels are used as means of real time \(live\) communication with workers. They can pass messages to and from workers to the main application process. They're quite easy to use:

```text
fn pong:
  channel ()
    => ch
    -> .on "ping" (ev: ch.send "pong")

export fn main:
  await |pong| ()
    -> .on "pong" (ev: console.log "Received pong!")
    -> .send "ping"
```

[Try on playground.](https://clio-playground.pouyae.vercel.app/?code=fn%20pong%3A%0A%20%20channel%20%28%29%0A%20%20%20%20%3D%3E%20ch%0A%20%20%20%20-%3E%20.on%20%22ping%22%20%28ev%3A%20ch.send%20%22pong%22%29%0A%20%20%20%20%0Aexport%20fn%20main%3A%0A%20%20await%20%7Cpong%7C%20%28%29%0A%20%20%20%20-%3E%20.on%20%22pong%22%20%28ev%3A%20console.log%20%22Received%20pong!%22%29%0A%20%20%20%20-%3E%20.send%20%22ping%22)
