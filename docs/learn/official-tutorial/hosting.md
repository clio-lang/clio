# Hosting

{% hint style="warning" %}
These examples won't run in the playground.
{% endhint %}

{% hint style="warning" %}
This is an advanced topic.
{% endhint %}

You can host a Clio project using `clio host` command, you'll be able to import the functions you hosted over the network, on server or in the browser. Let's define a function and host it:

{% tabs %}
{% tab title="src/main.clio" %}

```text
fn on-ping ch:
  fn on-ping-inner:
    console.log "Ping received"
    ch -> .send "pong"

export fn ping-pong:
  channel () => ch
    -> .on "ping" (on-ping ch)

```

{% endtab %}

{% tab title="clio.toml" %}

```text
title = "template-node"
description = ""
version = "0.1.0"
license = "MIT"
main = "src/main.clio"
authors = [ "Your Name <you@example.com>" ]
keywords = ""

[build]
directory = "build"
target = "node"

[target.node]
directory = "src"
target = "node"

[scripts]
test = "No tests specified"

[dependencies]
stdlib = "latest"

[[servers]]
proto = "ws"
port = 1337
host = "0.0.0.0"
name = "default"

[[workers]]
proto = "ws"
url = "ws://localhost:1337"
count = "cpu"
server = "default"

[executor]
proto = "ws"
url = "ws://localhost:1337"
wait_for = "cpu"
server = "default"
```

{% endtab %}
{% endtabs %}

Running `clio host` in the root directory of the project will host the project. We can import this in another project:

```text
import ping-pong from "ws://localhost:1337/main.clio"

fn on-pong:
  console.log "Pong received"

export fn main:
  await ping-pong () => ch
    -> .on "pong" on-pong

  fn ping:
    ch -> .send "ping"

  setInterval ping 1000
```

You can see full examples in our [examples](https://github.com/clio-lang/examples) repository.
