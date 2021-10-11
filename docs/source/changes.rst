Change Log
==========

v0.12.0
-------

- Removed multi-line comments.
- Added decorators.
- Added decorator based documentation.
- Added gradual static typing.
- Added optional dynamic typing.
- Added absolute imports (from the root of the project).
- Added compiler cache.
- Added scope and dependency tracing to the compiler.
  The cli no longer compiles all Clio files found in the project source folder,
  instead it follows the imports and compiles only the required files.
- Clio source code is now full esm, and also compiles the Clio source to esm.
- Added support for esm modules.
- Symbol exports are now allows: ``export foo``.
- A type system is implemented: ``type`` and ``list`` keywords are added.

v0.11.0
-------

- Switched to Sia for serialization.
- Added default values for WebSocket RPC configuration.
- Fixed memory leak issues on the browser and TCP/IPC backends.

v0.10.0
-------

- Changed import syntax from ``import abc from "module"`` to ``from "module" import abc``.

  This allows us to add better IntelliSense / Auto-completion support,
  and allows more flexibility on the import syntax.

- Clio modules are now installed in ``.clio/modules``. It's now required to specity the
  module version when importing. Installing and using multiple versions of the same module
  is now possible. Dependencies aren't installed in nested subdirectories anymore.

- A namespace prefix added to hosted functions. This is to ensure modules register their
  rpc functions in their own namespace. It's now required to specify a namespace when importing
  functions over network.

- Imports are now resolved on compile time. JavaScript bundlers like Parcel, Webpack, Rollup and
  others know and recognize ``esm`` and ``cjs`` import systems, to keep Clio compatible with these
  tools we have to use ``esm`` and ``cjs`` import methods and not a custom import function. This
  makes module resolve impossible on runtime.

- Added tail recursive call optimization.
