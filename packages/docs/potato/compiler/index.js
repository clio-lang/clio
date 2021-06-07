const Emitter = require("../lib/emitter");

class Compiler extends Emitter {
  constructor(code, file) {
    super();
    this.matchers = [];
    this.code = code;
    this.file = file;
    this.index = 0;
    this.lastToken;
  }
  compile() {
    while (this.code.length) {
      for (const matcher of this.matchers) {
        if (matcher.call(this)) break;
      }
    }
    this.emit("eof");
  }
  add(matcher) {
    this.matchers.push(matcher);
  }
  token(raw, type, meta) {
    this.emit(type, { raw, meta });
    this.lastToken = { raw, type, meta };
    const { length } = raw;
    this.code = this.code.slice(length);
    this.index += length;
  }
}

module.exports = Compiler;
