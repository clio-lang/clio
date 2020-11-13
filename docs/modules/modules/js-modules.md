# JS Modules

JavaScript files can be imported directly in your Clio code. For JavaScript files you need to use `exports` or `module.exports` variables:

{% tabs %}
{% tab title="my\_module.js" %}
```text
module.exports.hello = function(name) {
    console.log(`Hello ${name}`);
}
```
{% endtab %}
{% endtabs %}

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

{% tabs %}
{% tab title="example.clio" %}
```text
import express
```
{% endtab %}
{% endtabs %}

