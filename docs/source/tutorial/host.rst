Hosting
=======

.. warning:: These examples won't run in the playground.
.. warning:: This is an advanced topic.

You can host a Clio project using ``clio host`` command, you'll be able to
import the functions you hosted over the network, on server or in the browser.
Let's define a function and host it:

.. tabbed:: src/main.clio

  .. playground::
    :height: 600

    fn onPing ch:
      fn onEvent:
        console.log "Ping received"
        ch -> .emit "pong"

    export fn pingPong:
      channel ()
        => ch
        -> .on "ping" (onPing ch)

.. tabbed:: clio.toml

  .. code-block:: toml

    title = "host-example"
    description = ""
    version = "0.1.0"
    license = "MIT"
    main = "src/main.clio"
    authors = [ "Your Name <you@example.com>" ]
    keywords = ""

    [build]
    directory = "build"
    target = "node"

    [target.node]
    directory = "src"
    target = "node"

    [scripts]
    test = "No tests specified"

    [dependencies]
    stdlib = "latest"

    [[servers]]
    proto = "ws"
    port = 1337
    host = "0.0.0.0"
    name = "default"

    [[workers]]
    proto = "ws"
    url = "ws://localhost:1337"
    count = "cpu"
    server = "default"

    [executor]
    proto = "ws"
    url = "ws://localhost:1337"
    wait_for = "cpu"
    server = "default"

Running ``clio host`` in the root directory of the project will host the project.
We can import this in another project:

.. playground::
  :height: 740

  from "ws:localhost:1337/host-example@0.1.0/main.clio" import pingPong

  fn onPong:
    console.log "Pong received"

  export fn main:
    await pingPong ()
      => ch
      -> .on "pong" onPong
    
    fn ping: ch -> .emit "ping"
    setInterval ping 1000

You can see full examples in our `examples`_ repository.

.. _examples: https://github.com/clio-lang/examples