# RPC

This module is used to do multiprocessing and distributed processing in Clio.

## Terminology

1. **Dispatcher**: All messages go through the dispatcher.
   Dispatcher receives requests from Executors, chooses a Worker and
   sends the request to the worker, receives the answer from the worker
   and replies back to the Executor.

2. **Transport**: Transports are a collection of Clients and Servers who
   make it possible for Workers and Executors to communicate with a Dispatcher
   using a specific protocol.

3. **Worker**: Workers are in charge of processing the requests, calling
   functions and returning the results to the dispatcher.

4. **Executor**: Executors are in charge of sending requests from user to
   the dispatcher and returning the results to the user.
