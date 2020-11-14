# Importing

{% hint style="warning" %}
Examples on this page won't run in the playground.
{% endhint %}

When making a big project, you don't want to store everything in one file, or in one directory. You can break your big code into smaller pieces, store them in different files, in different locations, then import and use them in other files in your project:

{% tabs %}
{% tab title="main.clio" %}

```text
import "greetings"

export fn main argv:
  "World" -> greetings.hello
```

{% endtab %}

{% tab title="greetings.clio" %}

```text
export fn hello arg:
  console.log "Hello" arg
```

{% endtab %}
{% endtabs %}

If you want to rename the module, you can do:

{% tabs %}
{% tab title="main.clio" %}

```text
import * as my_module from "greetings"

export fn main argv:
  "World" -> my_module.hello
```

{% endtab %}

{% tab title="greetings.clio" %}

```text
export fn hello arg:
  console.log "Hello" arg
```

{% endtab %}
{% endtabs %}

If you only want to import one function from the module, you can do:

{% tabs %}
{% tab title="main.clio" %}

```text
import hello from "greetings"

export fn main argv:
  "World" -> hello
```

{% endtab %}

{% tab title="greetings.clio" %}

```text
export fn hello arg:
  console.log "Hello" arg
```

{% endtab %}
{% endtabs %}

If you want to rename the imported function, you can do:

{% tabs %}
{% tab title="main.clio" %}

```text
import hello as my_function from "greetings"

export fn main argv:
  "World" -> my_function
```

{% endtab %}

{% tab title="greetings.clio" %}

```text
export fn hello arg:
  console.log "Hello" arg
```

{% endtab %}
{% endtabs %}

To import several functions, you can do:

{% tabs %}
{% tab title="main.clio" %}

```text
import hello bye from "greetings"

export fn main argv:
  "World" -> hello
```

{% endtab %}

{% tab title="greetings.clio" %}

```text
export fn hello arg:
  console.log "Hello" arg

export fn bye arg:
  console.log "Bye" arg
```

{% endtab %}
{% endtabs %}

You can also use indents to format your imports:

{% tabs %}
{% tab title="main.clio" %}

```text
import
  hello
  bye
from "greetings"

export fn main argv:
  "World" -> hello
```

{% endtab %}

{% tab title="greetings.clio" %}

```text
export fn hello arg:
  console.log "Hello" arg

export fn bye arg:
  console.log "Bye" arg
```

{% endtab %}
{% endtabs %}

To rename multiple imports, do:

{% tabs %}
{% tab title="main.clio" %}

```text
import
  hello as my_function
  bye
from "greetings"

export fn main argv:
  "World" -> my_function
```

{% endtab %}

{% tab title="greetings.clio" %}

```text
export fn hello arg:
  console.log "Hello" arg

export fn bye arg:
  console.log "Bye" arg
```

{% endtab %}
{% endtabs %}

To import a function, and rest of the module in a separate namespace do:

{% tabs %}
{% tab title="main.clio" %}

```text
import
  bye
  * as greetings
from "greetings"

export fn main argv:
  "World" -> greetings.hello
```

{% endtab %}

{% tab title="greetings.clio" %}

```text
export fn hello arg:
  console.log "Hello" arg

export fn bye arg:
  console.log "Bye" arg
```

{% endtab %}
{% endtabs %}
