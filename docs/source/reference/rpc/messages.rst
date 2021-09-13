Message structure
=================

In the Clio RPC protocol, each message is enclosed in a Packet. Each Packet
consists of three parts:

.. mermaid::

  classDiagram
    class Packet {
      +String source
      +String destination
      +Buffer payload
    }

Where source is the id of the Executor or Worker sending the message,
and Destination is either a function name, or an Executor / Worker id.
Payload contains serialized data of the following form:

.. mermaid::

  classDiagram
    class Payload {
      +String id
      +UInt8 instruction
      +String? event
      +Any data
    }

Where id is a string id assigned to the payload by the Executor in order
to keep track of the payload. Workers must use the same id when answering
to the payload. The instruction field, is a numeric value of specifying the
type of this payload, possible values are: 

+----------+------+--------------------------------------+
| Name     | Code | Purpose                              |
+----------+------+--------------------------------------+
| REGISTER | 2    | To register a Worker on a Dispatcher |
+----------+------+--------------------------------------+
| GET      | 3    | To get available functions on a      |
|          |      | specific path                        |
+----------+------+--------------------------------------+
| PATH     | 4    | A response to a GET request          |
+----------+------+--------------------------------------+
| CALL     | 5    | A function call                      |
+----------+------+--------------------------------------+
| RESULT   | 6    | A response to a CALL request         |
+----------+------+--------------------------------------+
| EVENT    | 7    | An event, used for event emitters    |
+----------+------+--------------------------------------+

The event property of the payload is only defined for the EVENT payloads.
The type and purpose of the data attribute depends on the type of the payload:

+----------+----------------------------------------------+
| Name     | Data                                         |
+----------+----------------------------------------------+
| REGISTER | An array of available function names         |
|          | and paths on a worker                        |
+----------+----------------------------------------------+
| GET      | A string with the path being requested       |
+----------+----------------------------------------------+
| PATH     | An array of available function names         |
|          | and paths on a worker                        |
+----------+----------------------------------------------+
| CALL     | An array of arguments to the function call   |
+----------+----------------------------------------------+
| RESULT   | The result of a function call                |
+----------+----------------------------------------------+
| EVENT    | An array of arguments for a dispatched event |
+----------+----------------------------------------------+

The Packet and the Payload classes are serialized as an array. The packet
properties are used by different components for routing. The payload gets
deserialized only at the destination.