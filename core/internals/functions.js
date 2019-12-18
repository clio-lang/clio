const uuidv4 = require('uuid/v4')
const { Scope } = require('./scope')
const { Lazy } = require('./lazy')

class Fn {
  constructor(fn, outerScope, type) {
    this.id = uuidv4()
    this.fn = fn
    this.outerScope = outerScope
    this.type = type
  }
  call(...args) {
    const scope = new Scope({}, this.outerScope)
    return new this.type(() => this.fn(scope, ...args))
  }
}

const fn = (fn, outerScope) => new Fn(fn, outerScope)

module.exports = { fn, Fn }