Constants
=========

There are no variables in Clio, instead we have constants. There are two
ways to declare them:

.. playground::
  :height: 400
  
  export fn main argv:
    "Hello" => hello
    world = "world"
    console.log hello + " " + world + "!"

In the above piece of code we put ``"Hello"`` in ``hello``, and assign
``"world"`` to ``world`` . You can probably guess what the last line
does. Constants translate to JavaScript ``const`` and they cannot be
reassigned.

The ``=>`` syntax for defining a constant is very useful if used in a
chain or a flow, a concept you will learn about soon in the next few
chapters.
