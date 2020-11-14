# Parallelism

Clio supports multiple protocols and backends for parallelism, distributed computing and RPC. These can be configured in the `clio.toml` file. Current version of Clio supports web workers, worker threads and web socket backends. Future versions will add TCP, UDP, UNIX sockets and Windows named pipe support.

## Servers

To specify the type of servers you want, you can use `[[servers]]` in your `clio.toml` file. Below you will see all available options for different backends:

{% tabs %}
{% tab title="Web Workers" %}
```text
[[servers]]
proto = "ww"
name = "default"
```
{% endtab %}

{% tab title="Worker Thread" %}
```text
[[servers]]
proto = "wt"
name = "default"
```
{% endtab %}

{% tab title="Web Socket" %}
```text
[[servers]]
proto = "ws"
port = 1337
host = "0.0.0.0"
name = "default"
```
{% endtab %}
{% endtabs %}

## Workers

Workers host instances of your functions for parallel or distributed execution:

{% tabs %}
{% tab title="Web Workers" %}
```text
[[workers]]
proto = "ww"
count = "cpu" # or a number
server = "default"
```
{% endtab %}

{% tab title="Worker Thread" %}
```text
[[workers]]
proto = "wt"
count = "cpu" # or a number
server = "default"
```
{% endtab %}

{% tab title="Web Socket" %}
```text
[[workers]]
proto = "ws"
url = "ws://localhost:1337"
count = "cpu" # or a number
server = "default"
```
{% endtab %}
{% endtabs %}

## Executor

Each project can have one executor. Executor runs your main function and handles all parallel function calls for you:

{% tabs %}
{% tab title="Web Workers" %}
```text
[executor]
proto = "ww"
wait_for = "cpu" # or a number
server = "default"
```
{% endtab %}

{% tab title="Worker Thread" %}
```text
[executor]
proto = "wt"
wait_for = "cpu" # or a number
server = "default"
```
{% endtab %}

{% tab title="Web Socket" %}
```text
[executor]
proto = "ws"
url = "ws://localhost:1337"
wait_for = "cpu"
server = "default"
```
{% endtab %}
{% endtabs %}

In above config files, `wait_for` is used to wait for `n` workers to connect before running your main function.

