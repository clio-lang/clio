Async/Await
===========

JavaScript supports async functions, so does Clio. However, unlike
JavaScript Clio doesn’t have an ``async`` keyword. Simply using an
``await`` keyword in your function marks it as async. The ``await``
keyword can be used in flows:

.. tabbed:: Browser

  .. attention::
    The ``fetch`` function used in the example below is a browser only function,
    switch to the Node tab to see how you can run this example when targetting Node.

  .. playground::
    :height: 400

    export fn main argv:
      "https://get.geojs.io/v1/ip/geo.json"
        -> await fetch
        -> await .json
        -> console.log

.. tabbed:: Node

  .. attention::
    This example doesn’t run in the playground. To run this example with Node,
    you need to install ``node-fetch`` first. To do so, run the following command
    in the root directory of your Clio project where your ``clio.toml`` is located:

    .. code-block:: bash
      
      clio deps add --npm node-fetch

  .. playground::
    :height: 300
    :no-interactive:

    import "js:node-fetch"

    export fn main argv:
      "https://get.geojs.io/v1/ip/geo.json"
        -> await nodeFetch
        -> await .json
        -> console.log

It can also be used outside flows:

.. tabbed:: Browser

  .. attention::
    The ``fetch`` function used in the example below is a browser only function,
    switch to the Node tab to see how you can run this example when targetting Node.

  .. playground::
    :height: 400

    export fn main argv:
      await fetch "https://get.geojs.io/v1/ip/geo.json"
        -> await .json
        -> console.log


.. tabbed:: Node

  .. attention::
    This example doesn’t run in the playground. To run this example with Node,
    you need to install ``node-fetch`` first. To do so, run the following command
    in the root directory of your Clio project where your ``clio.toml`` is located:

    .. code-block:: bash
      
      clio deps add --npm node-fetch

  .. playground::
    :height: 300
    :no-interactive:

    import "js:node-fetch"

    export fn main argv:
      await nodeFetch "https://get.geojs.io/v1/ip/geo.json"
        -> await .json
        -> console.log


Clio also supports ``[await]`` keyword, which translates to
``await Promise.all(...)``:

.. tabbed:: Browser

  .. attention::
    The ``fetch`` function used in the example below is a browser only function,
    switch to the Node tab to see how you can run this example when targetting Node.

  .. playground::
    :height: 600

    export fn main argv:
      urls = [
        "https://get.geojs.io/v1/ip/geo.json"
        "https://get.geojs.io/v1/ip/geo/8.8.8.8.json"
      ]
        
      urls  -> * [await] (fetch @it)
            -> * [await] .json
            -> * console.log

.. tabbed:: Node

  .. attention::
    This example doesn’t run in the playground. To run this example with Node,
    you need to install ``node-fetch`` first. To do so, run the following command
    in the root directory of your Clio project where your ``clio.toml`` is located:

    .. code-block:: bash
      
      clio deps add --npm node-fetch

  .. playground::
    :height: 400
    :no-interactive:

    import "js:node-fetch"

    export fn main argv:
      urls = [
        "https://get.geojs.io/v1/ip/geo.json"
        "https://get.geojs.io/v1/ip/geo/8.8.8.8.json"
      ]
        
      urls  -> * [await] (nodeFetch @it)
            -> * [await] .json
            -> * console.log
