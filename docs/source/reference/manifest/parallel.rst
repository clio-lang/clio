Parallelism
===========

Clio supports multiple protocols and backends for parallelism,
distributed computing and RPC. These can be configured in the
``clio.toml`` file. Current version of Clio supports web workers, worker
threads and web socket backends. Future versions will add TCP, UDP, UNIX
sockets and Windows named pipe support.

Servers
-------

To specify the type of servers you want, you can use ``[[servers]]`` in
your ``clio.toml`` file. Below you will see all available options for
different backends:

.. tabbed:: Web Workers

  .. code-block:: toml

    [[servers]]
    proto = "ww"
    name = "default"


.. tabbed:: Worker Thread

  .. code-block:: toml

    [[servers]]
    proto = "wt"
    name = "default"


.. tabbed:: Web Socket

  .. code-block:: toml

    [[servers]]
    proto = "ws"
    port = 1337
    host = "0.0.0.0"
    name = "default"

Workers
-------

Workers host instances of your functions for parallel or distributed
execution:

.. tabbed:: Web Workers

  .. code-block:: toml

    [[workers]]
    proto = "ww"
    count = "cpu" # or a number
    server = "default"


.. tabbed:: Worker Thread

  .. code-block:: toml

    [[workers]]
    proto = "wt"
    count = "cpu" # or a number
    server = "default"

.. tabbed:: Web Socket

  .. code-block:: toml

    [[workers]]
    proto = "ws"
    url = "ws://localhost:1337"
    count = "cpu" # or a number
    server = "default"

.. note::
  The ``count`` option specifies how many workers you want to spawn for multi-processing
  purposes. It can either be set to ``"cpu"`` or to a positive non-zero finite number.
  The behavior of the ``"cpu"`` value is dependant on the runtime environment. If ``"cpu"``
  is provided as the value for this option, Clio uses the ``os.cpus()`` function on Node to
  determine the CPU count of the runtime environment. On the browsers Clio uses the
  ``navigator.hardwareConcurrency`` value, if that value isn't available (for example,
  on Safari) then Clio uses an estimation method based on web workers. Please note that
  the web worker estimation method is not very accurate, but it is the fastest estimation
  method available.

Executor
--------

Each project can have one executor. Executor runs your main function and
handles all parallel function calls for you:

.. tabbed:: Web Workers

  .. code-block:: toml

    [executor]
    proto = "ww"
    wait_for = "cpu" # or a number
    server = "default"

.. tabbed:: Worker Thread

  .. code-block:: toml

    [executor]
    proto = "wt"
    wait_for = "cpu" # or a number
    server = "default"

.. tabbed:: Web Socket

  .. code-block:: toml

    [executor]
    proto = "ws"
    url = "ws://localhost:1337"
    wait_for = "cpu"
    server = "default"

In above config files, ``wait_for`` is used to wait for ``n`` workers to
connect before running your main function.
