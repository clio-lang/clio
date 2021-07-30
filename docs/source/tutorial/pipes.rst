Pipes
=====

In previous section, we saw how to define functions and how to call them.
However, there is another way to call a function, and that’s using pipes:

.. playground::
  :height: 440

  fn add a b:
    a + b

  export fn main argv:
    result = 2 -> add 3
    console.log result

The above piece of code is equivalent to the previous one, now you might
ask why would I want to use this syntax instead? Well it’s because this
syntax allows chaining function calls. Let’s say you want to add ``2``
and ``3``, and then print out the results, you can use pipes to chain
the calls:

.. playground::
  :height: 440

  fn add a b:
    a + b

  export fn main argv:
    add 2 3 -> console.log

The above example calls ``add`` with ``2`` and ``3``, then passes the
results to ``console.log``. If you run the above example you will see a
5 in your console! You can also use parenthesis to pass the results of a
function call to another:

.. playground::
  :height: 440

  fn add a b:
    a + b

  export fn main argv:
    console.log (add 2 3)

However, using this syntax is discouraged (but justified in some cases),
specially when there are more than two nested calls as it can lead to
unreadable, confusing pieces of code!

Finally, if you want to call a function with no arguments, simply do:

.. playground::
  :height: 440

  fn hello: console.log "Hello there!"

  export fn main argv:
    hello ()

The above code calls the ``hello`` function with no arguments.
