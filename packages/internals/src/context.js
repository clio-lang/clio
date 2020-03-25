class Context {
  constructor(scope, meta) {
    const { run = true, filename, name, path } = meta;
    this.scope = scope;
    this.run = run;
    this.filename = filename;
    this.name = name;
    this.path = path;
  }
}

module.exports.Context = Context;
