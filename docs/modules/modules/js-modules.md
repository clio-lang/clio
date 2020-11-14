# JS Modules

JavaScript files can be imported directly in your Clio code. For JavaScript files you need to use `exports` or `module.exports` variables:

<<<<<<< HEAD
{% code-tabs %}
{% code-tabs-item title="my\_module.js" %}
=======
{% tabs %}
{% tab title="my\_module.js" %}

> > > > > > > develop

```text
module.exports.hello = function(name) {
    console.log(`Hello ${name}`);
}
```

<<<<<<< HEAD
{% endcode-tabs-item %}
{% endcode-tabs %}
=======
{% endtab %}
{% endtabs %}

> > > > > > > develop

and to import it in Clio:

```text
<<<<<<< HEAD
import hello from my_module.js
```

When importing JavaScript files you must include `.js` in the file name. Same as Clio modules, these imports are relative and recognize the same path formats as the Clio file imports.

To import and use a Node.js module, install it using `npm`

```text
npm i express
=======
import hello from "my_module.js"
```

When importing JavaScript files it's better to include `.js` in the file name. Same as Clio modules, these imports are relative and recognise the same path formats as the Clio file imports.

To import and use a Node.js module, install it using `clio deps add --npm`

```text
clio deps add --npm express
>>>>>>> develop
```

Then you can import it in your Clio file:

<<<<<<< HEAD
{% code-tabs %}
{% code-tabs-item title="example.clio" %}

```text
import express
```

{% endcode-tabs-item %}
{% endcode-tabs %}

=======
{% tabs %}
{% tab title="example.clio" %}

```text
import express
```

{% endtab %}
{% endtabs %}

> > > > > > > develop
