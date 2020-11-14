# Hosting

<<<<<<< HEAD
In Clio, functions are isolated and each have their own frozen scope. This makes it easy to host these functions as microservices and import them from some place else \(Even from another language\). It is even possible to write functions in other languages, host them and import them in Clio \(a Python example exists in main repository\).

As an example, let's create a `host.clio` file and put this code in it:

{% code-tabs %}
{% code-tabs-item title="host.clio" %}
```text
42 => answer
#my_emitter -> emitter => my_emitter

@eager
fn to_power_of i n:
  i ^ n

{
  #port 3000    -- defaults to 3000
  #workers 8    -- defaults to number of cpus
  #exports [#to_power_of #my_emitter #answer] -- choose what you want to host
} => host
```
{% endcode-tabs-item %}
{% endcode-tabs %}

Now, we can host this file using:

`clio host host.clio`

Then in another Clio code, we can import these variables, event emitters and functions. For functions and variables we can use http or https, ws or wss protocols, but for events we must use either ws or wss:

```text
import answer to_power_of from http://localhost:3000
import my_emitter from ws://localhost:3000
```

=======
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

>>>>>>> develop
