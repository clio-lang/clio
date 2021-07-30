Parallelism
===========

Every function you define in Clio, has a parallel, distributed version.
This parallel version can be accessed using the *sandwich* syntax. Let’s
start by an example and define a fibonacci function:

.. warning::
  Running the following example in the playground might
  freeze your browser for a few seconds!

.. playground::
  :height: 600

  fn fib n:
    if n < 2: n
    else: (fib n - 1)
        + (fib n - 2)

  export fn main argv:
    [39 40 41 42]
      -> * fib
      -> * (console.log @it)

In the above example, we are running ``fib`` function on all the members
of our array. The code above, first runs ``fib 39``, and when the result
is ready it will run the next, which is ``fib 40`` and so on. If I run
the above code on my laptop, it will take about 6.2 seconds to finish.
However, we can make the above code faster, by running all the fibs in
parallel, and at the same time. To do this, we will use the parallel
version of our ``fib`` function, which can be accessed using the
*sandwich* syntax:


.. note::
  Unlike the previous example, this one won't freeze your browser!

.. playground::
  :height: 600

  fn fib n:
    if n < 2: n
    else: (fib n - 1)
        + (fib n - 2)

  export fn main argv:
    [39 40 41 42]
      -> * [await] |fib|
      -> * (console.log @it)


.. note::
  Parallel functions are async, you need to await them if necessary.

This time, if I run the above code it will take 2.7 seconds instead.
Much faster, isn’t it? You might wonder, if we are running in 4
processes instead of one, why isn’t it 4 times faster? That’s a very
good question, and here’s the answer: We’re limited by the performance
of the longest running process, if you wait for 4 processes where 3 of
them run in 1 second and one of them runs in 10 seconds, your overall
wait time is going to be 10 seconds.

.. note::
  Being faster isn’t the only benefit of running
  functions in parallel. On the browser, the regular non-parallel fib
  blocks the ui, but the parallel version doesn’t. If you try the above
  examples in the playground you will see this in action.

Alternatively, you can use the ``.then`` method for handling parallel tasks:

.. playground::
  :height: 600

  fn fib n:
    if n < 2: n
    else: (fib n - 1)
        + (fib n - 2)

  export fn main argv:
    [39 40 41 42]
      -> * |fib|
      -> * .then (console.log @it)