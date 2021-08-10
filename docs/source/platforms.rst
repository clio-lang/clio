Supported Platforms
===================

Clio runs on Node versions ``>=14.14`` and on all major browsers.
The following browsers and platforms are officially supported:

+---------------------+--------------+------------------+-------------------------------+
| Platform            | Versions     | Multithreading   | RPC Protocols [*]_            |
+=====================+==============+==================+===============================+
| |node| Node         | ``>= 14.14`` | Supported        | Worker Threads,               |
|                     |              |                  | Web Sockets,                  |
|                     |              |                  | Unix Sockets,                 |
|                     |              |                  | Named Pipes [*]_,             |
|                     |              |                  | TCP,                          |
|                     |              |                  | IPC                           |
+---------------------+--------------+------------------+-------------------------------+
| |chrome| Chrome     | See          | Supported        | Web Workers,                  |
+---------------------+ `Browsers`_  +------------------+ Web Sockets                   +
| |chromium| Chromium |              | Supported        |                               |
+---------------------+              +------------------+                               +
| |firefox| Firefox   |              | Supported        |                               |
+---------------------+              +------------------+                               +
| |safari| Safari     |              | Supported [*]_   |                               |
+---------------------+              +------------------+                               +
| |edge| Edge         |              | Supported        |                               |
+---------------------+              +------------------+                               +
| |opera| Opera       |              | Supported        |                               |
+---------------------+--------------+------------------+-------------------------------+

.. [*] RPC is used for multithreading and cloud computing.
.. [*] Named Pipes only available on Windows.
.. [*] On Safari, Clio uses a fast but inaccurate shim to determine number of CPU cores.

Browsers
--------

The default browser template for Clio uses Rollup_ and Babel_ for bundling the generated code,
minimum supported browser versions can be set in project's ``clio.toml``. The default
value is ``["defaults", "not IE 11"]``.

.. |chrome| image:: ./_static/images/chrome.svg
  :class: inline-icon

.. |chromium| image:: ./_static/images/chromium.svg
  :class: inline-icon

.. |firefox| image:: ./_static/images/firefox.svg
  :class: inline-icon

.. |safari| image:: ./_static/images/safari.svg
  :class: inline-icon
  
.. |edge| image:: ./_static/images/edge.svg
  :class: inline-icon
  
.. |opera| image:: ./_static/images/opera.svg
  :class: inline-icon
  
.. |node| image:: ./_static/images/node.svg
  :class: inline-icon

.. _Rollup: https://rollupjs.org
.. _Babel: https://babeljs.io
