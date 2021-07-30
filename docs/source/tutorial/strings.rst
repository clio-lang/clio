Strings
=======

Clio supports Python style string formatting and template literals. The
syntax is very much similar to the one of Python’s:

.. playground::
  :height: 400

  fn hello who:
    console.log f"Hello {who}!"

  export fn main argv:
    hello "visitor"


You can also use custom functions, for example:

.. playground::
  :height: 400

  fn upper str:
    str -> .toUpperCase

  export fn main argv:
    console.log upper"hello!"


.. warning:: Support for custom functions isn’t really polished yet.

