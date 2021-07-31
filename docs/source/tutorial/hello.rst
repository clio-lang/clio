Hello World!
============

Let’s start by a classical hello world example! Open the project
directory in your favorite text editor and add the following code to
``src/main.clio`` file.

.. playground::
  :height: 320

  export fn main:
    console.log "Hello world!"


Above code is the simplest form of writing a hello world program in
Clio, let’s break it down a little bit:

1. On the first line, we’ve defined a function named ``main``. Every
   runnable Clio program needs a ``main`` function and this function
   needs to be exported. If you don’t know what that means, don’t worry,
   you’ll learn about it soon.
2. On the second line, we call ``console.log`` function, passing
   ``"Hello world!"`` to it. This function prints the arguments passed
   to either to your terminal, or to the browser’s console.

Running this program should show ``Hello world!`` in the console. Go on
and try it out by running ``clio run`` in your project’s root folder.
Congrats on writing and running your first Clio program!
