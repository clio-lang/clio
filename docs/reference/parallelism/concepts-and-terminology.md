# Concepts and Terminology

## Dispatcher

The dispatcher is the core and main part of the parallelism and RPC protocols. Consider it a type of hub or manager that manages all connections, connecting workers to executors. The dispatcher provides a server API for adding connection protocol servers. This API is used to write TCP, UDP, WebSocket, IPC, Unix socket, Windows named pipe, worker thread and web worker servers, the same API can be used to provide even more protocols. however the listed protocols are the only officially supported ones. The dispatcher creates servers for each requested protocol and accepts connections on them, parsing and handling incoming messages.

## Workers

Workers connect to dispatcher using one of the supported connection protocol and register themselves, telling the dispatcher which functions are available to them. They're responsible for running functions and returning the results to the dispatcher, it is the dispatcher that redirects the results to the client.

## Executor

An executor is a client that connects to the dispatcher, it is responsible for making call requests. The dispatcher takes in the call requests from the executors, redirects them to the available workers, gets the response and delivers it to the executor. There is no need for the executors and workers to share the same connection API, the dispatcher works as a gateway connecting them together.

