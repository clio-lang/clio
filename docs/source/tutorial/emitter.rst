Emitters
========

Emitters are used as means of real time (live) communication with
workers. They can pass messages to and from workers to the main
application process. They’re quite easy to use:

.. playground::
  :height: 720

  fn onPing em:
    fn onEvent:
      em.emit "pong"

  fn pong: emitter () => em -> .on "ping" (onPing em)
  fn onPong: console.log "Pong received from worker!"

  export fn main:
    await |pong| ()
      -> .on "pong" onPong
      -> .emit "ping"
