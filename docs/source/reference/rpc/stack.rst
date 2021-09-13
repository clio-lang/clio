The RPC stack
=============

The Clio RPC stack is a modular set of smaller components that communicate
with each other and make up the whole process. The "Dispatcher" component
acts as a hub or a message broker, the Dispatcher component doesn't listen
for connections on its own and does it using one of many Transports supported
by the Clio RPC stack. Transports are a set of classes to listen for connections
on a specific protocol, and also classes to connect to that protocol. For
example, the TCP transport defines a Server class for accepting connections
on the TCP protocol, and a Client class for connections to the server.

A virtually unlimited amount of servers of any transport kind can be added
to a dispatcher, and a virtually unlimited amount of clients can connect to
the dispatcher on the added servers. Using this architecture, a dispatcher can
accept connections on multiple protocols, for example it can accept WebSocket
connections from a browser, and TCP connections from other environments.

On the client side, the Clio RPC stack defines a Worker class and an Executor
class. Workers and Executors use the Client class of the Transports to connect
to the Dispatcher. The Workers wait for instructions from the Dispatcher, then
according to the type of the instruction they will execute and return the results.
An Executor is an agent sitting between the user and the Dispatcher, it sends
the required instructions to the Dispatcher, then Dispatcher relays the instruction
to the appropriate Worker.

For example, if the user wants to call a function on a Worker, the "CALL" instruction
and all the necessary information (the function name, arguments, etc) are packed and
sent to the Dispatcher. The Dispatcher receives the "CALL" instruction and sends it
to a Worker that supports the requested function. The Worker receives the instruction
from the Dispatcher, executes the function, and packs the result in a "RESULT" instruction
packet. The Dispatcher receives the "RESULT" packet and relays it to the Executor.
The Executor receives the "RESULT" packet and returns it to the user:

.. mermaid::
  
  sequenceDiagram
    Executor->>Dispatcher: CALL fib(10)
    Dispatcher->>Worker: CALL fib(10)
    Worker->>Dispatcher: RESULT 55
    Dispatcher->>Executor: RESULT 55
