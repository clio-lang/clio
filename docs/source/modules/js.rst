JS Modules
==========

JavaScript files can be imported directly in your Clio code. For
Both ``cjs`` and ``esm`` are supported, for ``cjs`` you can do:

.. tabbed:: my_module.js

  .. code:: js

    module.exports.hello = function(name) {
        console.log(`Hello ${name}`);
    }

and to import it in Clio:

.. playground::
  :height: 300

  from "cjs:./my_module.js" import hello

And for ``esm``, you can do:

.. tabbed:: my_module.js

  .. code:: js

    export const hello = function(name) {
        console.log(`Hello ${name}`);
    }

and to import it in Clio:

.. playground::
  :height: 300

  from "esm:./my_module.js" import hello

When importing JavaScript files it’s better to include ``.js`` in the
file name. Same as Clio modules, these imports are relative and
recognise the same path formats as the Clio file imports.

To import and use a Node.js module, install it using
``clio deps add --npm``

.. code:: bash

   clio deps add --npm express

Then you can import it in your Clio file:

.. tabbed:: example.clio

  .. playground::
    :height: 300

    import "cjs:express"

Both ``esm`` and ``cjs`` modules are supported.
