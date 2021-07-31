Functions
=========

Functions the most important concept in Clio. Here’s how we define them:

.. playground::
  :height: 440

  fn add a b:
    a + b

  export fn main:
    result = add 2 3
    console.log result

In above code we define a function named ``add``, this function accepts
two parameters: ``a`` and ``b``, what it does is adding ``a`` and ``b``
together. We don’t have a ``return`` keyword in Clio, all functions
return the last evaluated expression.

A function’s body can be either a block just like above, or an
expression:

.. playground::
  :height: 440

  fn add a b: a + b

  export fn main:
    result = add 2 3
    console.log result

Anonymous Functions
~~~~~~~~~~~~~~~~~~~

Clio has a unique way of defining anonymous functions. In Clio,
anonymous function parameters are implicit:

.. playground::
  :height: 440

  add = (@a + @b)

  export fn main:
    result = add 2 3
    console.log result

The code above makes an anonymous function that accepts two parameters
``a`` and ``b`` . Please note that anonymous functions should be wrapped
in parentheses. These functions are very useful when filtering out an
array, mapping or reducing one.

To use an anonymous function, you don't need to assign it to a constant:

.. playground::
  :height: 340

  export fn main:
    result = (@a + @b) 2 3
    console.log result
