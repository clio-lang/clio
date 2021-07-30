Async/Await
===========

JavaScript supports async functions, so does Clio. However, unlike
JavaScript Clio doesn’t have an ``async`` keyword. Simply using an
``await`` keyword in your function marks it as async. The ``await``
keyword can be used in flows:

.. playground::
  :height: 400

  export fn main argv:
    "https://get.geojs.io/v1/ip/geo.json"
      -> await fetch
      -> await .json
      -> console.log

It can also be used outside flows:

.. playground::
  :height: 400

  export fn main argv:
    await fetch "https://get.geojs.io/v1/ip/geo.json"
      -> await .json
      -> console.log


Clio also supports ``[await]`` keyword, which translates to
``await Promise.all(...)``:

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

