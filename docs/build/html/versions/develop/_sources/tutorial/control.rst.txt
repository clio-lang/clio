Control Flow
============

There are no loops in Clio and all loops should be done using recursion.
There is support for if, else if, else statements:

.. playground::
  :height: 640

  fn isBigger x:
    if x > 10:
      console.log "x is bigger!"
    else if x < 10:
      console.log "x is smaller!"
    else:
      console.log "x equals ten!"

  export fn main argv:
    isBigger 10


Instead of blocks you can also use an expression:

.. playground::
  :height: 440

  fn isOdd n:
    if n % 2: true
    else:     false

  export fn main argv:
    9 -> isOdd -> console.log

You can make it even more compact:

.. playground::
  :height: 400

  fn isOdd n:
    if n % 2: true else: false

  export fn main argv:
    9 -> isOdd -> console.log
