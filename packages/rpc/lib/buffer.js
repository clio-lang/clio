const { Buffer: BufferShim } = require("buffer/");

module.exports.Buffer = typeof Buffer === "undefined" ? BufferShim : Buffer;
