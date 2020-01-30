# JS Modules

JavaScript files can be imported directly in your Clio code. For JavaScript files you need to use `exports` or `module.exports` variables:

{% code-tabs %}
{% code-tabs-item title="my\_module.js" %}

```text
module.exports.hello = function(name) {
    console.log(`Hello ${name}`);
}
```

{% endcode-tabs-item %}
{% endcode-tabs %}

and to import it in Clio:

```text
import hello from "my_module.js"
```

When importing JavaScript files you must include `.js` in the file name. Same as Clio modules, these imports are relative and recognize the same path formats as the Clio file imports.

To import and use a Node.js module, install it using `npm`

```text
npm i express
```

Then you can import it in your Clio file:

{% code-tabs %}
{% code-tabs-item title="example.clio" %}

```text
import express
```

{% endcode-tabs-item %}
{% endcode-tabs %}
