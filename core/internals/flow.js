const { IO } = require('./lazy')

class Flow {
  constructor(scope, data) {
    this.data = data
    this.scope = scope
  }
  pipe(fn, ...args) {
    const data = fn.call(this.data, ...args)
    if (data instanceof IO) {
      data.valueOf()
    }
    return new Flow(this.scope, data)
  }
  map(fn, ...args) {
    const data = this.data.map(item => fn.call(item, ...args))
    if (data instanceof IO) {
      data.valueOf()
    }
    return new Flow(this.scope, data)
  }
  set(key) {
    this.scope[key] = this.data
    return this
  }
}

const flow = (scope, data) => new Flow(scope, data)

module.exports = { flow, Flow }