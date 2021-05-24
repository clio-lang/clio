# Serialization

Current version of the protocol uses JSON for serialization, although JSON lacks type information, it is available on almost all programming languages, making the protocol easier to port. However, this might change in future releases, Clio needs real-time communication, events and streams and these aren't very easy to do with JSON without affecting the performance of the serialization.

