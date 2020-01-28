# Hosting

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
import answer to_power_of from "http://localhost:3000"
import my_emitter from "ws://localhost:3000"
```
