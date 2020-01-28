# Events

Clio supports event-based control flow. When we introduced flows, we mentioned a flow starts with data or a source. Events can be considered a source of data and can be used like this:

```text
#echo -> emitter => echo
echo:#message -> upper -> print
echo -> emit #message 'hello events!'
```

In above example, we create a emitter named `#echo` and store it in variable `echo`. Then we use `:` to listen to the `#message` event of `echo`, piping the message to `upper` and `print`. Then, on the last line, we emit a `#message` event using `echo`, and we pass `'hello events!'` as content of the message.

`echo:#message` acts as a data source here, every time there's new data it will be passed to the specified flow.

