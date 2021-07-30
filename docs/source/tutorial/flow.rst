Flows
=====

We introduced the pipe operator ``->`` in the previous section and we
saw how we can pipe results of a function into another one. Using the
pipe operator, you can chain as many function calls as you want:

.. playground::
  :height: 540

  fn add a b:
    a + b

  fn mul a b:
    a * b

  export fn main argv:
    add 2 3 -> mul 4 -> console.log


The above adds ``2`` and ``3`` first, then multiplies them by ``4``,
then prints out the result. To format your code you can put indents
before the ``->`` operator, for example:


.. playground::
  :height: 620

  fn add a b:
    a + b

  fn mul a b:
    a * b

  export fn main argv:
    add 2 3
      -> mul 4
      -> console.log


Map
~~~

Using pipes, you can also map a function to a value, for example, to
print an array we can write:

.. playground::
  :height: 340

  export fn main argv:
    [1 2 3] -> console.log



and to print each item in the array, we can map the ``console.log``
function to the array:


.. playground::
  :height: 400

  export fn main argv:
    [1 2 3] -> * console.log



As you see, in Clio we use ``-> *`` to map functions to values. This
operator can be used in a flow:


.. playground::
  :height: 680

  fn add a b:
    a + b

  fn mul a b:
    a * b

  export fn main argv:
    [1 2 3]
      -> * mul 2
      -> * add 1
      -> console.log


Methods
~~~~~~~

We can call methods in flows, using the pipe operator:


.. playground::
  :height: 340

  export fn main argv:
    "hello" -> .toUpperCase -> console.log


This will call ``toUpperCase`` method of ``"hello"``, and then pipe the
result to ``console.log``!

Anonymous functions
~~~~~~~~~~~~~~~~~~~

Anonymous functions can either be used as an argument:

.. playground::
  :height: 420

  export fn main argv:
    [1 2 3 4 5]
      -> .filter (@it % 2)
      -> console.log
