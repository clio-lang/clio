Clio Documentation
==================

Clio is a modern, functional, parallel programming language targeting
decentralised and distributed systems. It is made to take advantage of
multiple CPUs and CPU cores (parallelism) by default, to run on clusters
and on the cloud easily.

Clio compiles to JavaScript. This enables Clio to run in the browser and
on servers, and anywhere JavaScript can run. Furthermore, Clio can take
advantage of the JavaScript ecosystem, tools and libraries. On this
website, you will find numerous useful information about Clio, its
history and you can learn how to use it.

.. playground::
  :height: 640

  fn fib n:
    if n < 2: n
    else: (fib n - 1)
          + (fib n - 2)

    export fn main argv:
    [39 40 41 42]
        -> * [await] |fib|
        -> * (console.log @it)

Click on the run button to run the above example,
or continue reading on this article to learn more about the language!

.. attention::
   Clio was recently rewritten from scratch, some
   parts of this document have been updated to reflect the new changes, but
   not all pages are updated. This documentation is a work in progress.

.. _here: https://clio-playground.pouyae.vercel.app/?code=fn%20fib%20n%3A%0A%20%20if%20n%20%3C%202%3A%20n%0A%20%20else%3A%20%28fib%20n%20-%201%29%0A%20%20%20%20%20%20%2B%20%28fib%20n%20-%202%29%0A%0Aexport%20fn%20main%20argv%3A%0A%20%20%5B39%2040%2041%2042%5D%0A%20%20%20%20-%3E%20*%20await%20%7Cfib%7C%0A%20%20%20%20-%3E%20*%20item%3A%20console.log%20item


.. toctree::
   :maxdepth: 2
   :caption: Table of Contents
   
   self
   install
   quick
   medium
   tutorial/index
   cli/index
   modules/index
   tools/index
   reference/index
   development/index
   links/index
   support


Indices and tables
==================

* :ref:`genindex`
* :ref:`search`
