# Clio modules

Any `.clio` file is a Clio module and can be imported in any other Clio code. There is no need to use a `export` keyword or a `exports` variable like in JavaScript.

{% code-tabs %}
{% code-tabs-item title="my\_module.clio" %}
```text
@eager
fn hello name:
  'hello' name -> print
```
{% endcode-tabs-item %}
{% endcode-tabs %}

The above example is a simple Clio module and can be imported and used like this:

```text
import hello from my_module

'world' -> hello
```

In Clio, imports are relative and by path, there is no support for absolute imports. Clio recognizes the following import path formats:

```text
import module
import ./module
import ../module
import dir/module
import ./dir/module
import ../dir/module
```

Including `.clio` for file name is optional, the above example is the same as the following:

```text
import module.clio
import ./module.clio
import ../module.clio
import dir/module.clio
import ./dir/module.clio
import ../dir/module.clio
```



