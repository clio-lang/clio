const cast_to_bool = require('../common').cast_to_bool;

function runtime() {
  return {
    scopes: {
      0: {
        print: function (r) {
          console.log(r);
          return r;
        },
        mul: function (r, n) {
          return r * n;
        },
        div: function (r, n) {
          return r / n;
        },
        add: function (r, n) {
          return r + n;
        },
        sub: function (r, n) {
          return r - n;
        },
        more: function (a, b) {
          return a > b;
        },
        less: function (a, b) {
          return a < b;
        },
        eq: function (a, b) {
          return a == b;
        },
        not: function (a) {
          return !cast_to_bool(a);
        },
        and: function (a, b) {
          return (cast_to_bool(a) && cast_to_bool(b));
        },
        or: function (a, b) {
          return (cast_to_bool(a) || cast_to_bool(b));
        }
      },
    },
    internals: {
      backrefs: {

      },
      last_evals: {
        0: null
      },
      scope_count: 1,
      eval_count: 1,
      backref_count: 0,
    }
  }
}

module.exports = runtime;
