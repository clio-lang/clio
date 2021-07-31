Introduction
============

.. attention::
  The new Clio version isn’t production ready yet,
  it is not even in beta stage. Things might break or not work as
  expected, if you encounter any issues like that please let us know so we
  can fix them as soon as we can.

Clio is a new programming language that compiles to JavaScript, although
Clio tries to stay as close as possible to JavaScript, mainly for
performance reasons, it doesn’t mean Clio is just JavaScript in new
clothes. Clio requires its own runtime and standard libraries, including
but not limited to lazy data types, built-in libraries, event emitters,
serializers, network-based foreign function interface and the remote
procedure ecosystem. Clio introduces a unique syntax, a new way of doing
things and revolutionary programming concepts.

As for syntax, Clio isn’t a free-form language, that means spaces have
meanings in the language syntax. Clio is a noise-free language, that
means most of the common symbols found in other languages are not
present in Clio, as an example, functions aren’t called by braces in
Clio and arguments aren’t separated by a comma. Being expressive is key.
We want to let the programmers do more while writing less.

Clio allows to easily chain functions together with flexibility without
losing readability, these function calls aren’t nested inside each other
and they’re read and run in same direction as they’re written, from left
to right and not from inner to outer. This way of chaining functions is
called a flow in Clio, a flow starts with some data, then is followed by
on or more function names or function calls each operating after one
another on the data.

All functions have a parallel version in Clio, they’re isolated but not
free of side-effects, Clio provides tools to host these functions,
export them, import them and use them in any other place in any
language. It is also possible to import function from other languages
over network, a feature we’re still working on. With the network-based
foreign function interface you’ll be able to use most of the modules of
any other programming language with ease.

This document assumes you are familiar with JavaScript, as Clio is at
experimental stages of its development this documentation targets
current JavaScript developers, but it should be easy to pickup if you’re
familiar with some other language that isn’t JavaScript.This article
also assumes you have installed Clio and you have a working Clio
installation. If not, please follow the install instructions `here`_. If
you’re not ready yet to install Clio, you can always use our
`playground`_.

.. _here: ../install.html
.. _playground: https://playground.clio-lang.org/
