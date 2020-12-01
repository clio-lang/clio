// taken from https://gist.github.com/Gozala/1697037
function tco(f) {
  /**
  Takes `f` function and returns wrapper in return, that may be
  used for tail recursive algorithms. Note that returned funciton
  is not side effect free and should not be called from anywhere
  else during tail recursion. In other words if
  `var f = tco(function foo() { ... bar() ... })`, then `bar`
  should never call `f`. It is ok though for `bar` to call `tco(foo)`
  instead.
  ## Examples
  var sum = tco(function(x, y) {
    return y > 0 ? sum(x + 1, y - 1) :
           y < 0 ? sum(x - 1, y + 1) :
           x
  })
  sum(20, 100000) // => 100020
  **/

  var value,
    active = false,
    accumulated = [];
  return function accumulator() {
    // Every time accumulator is called, given set of parameters
    // are accumulated.
    accumulated.push(arguments);
    // If accumulator is inactive (is not in the process of
    // tail recursion) activate and start accumulating parameters.
    if (!active) {
      active = true;
      // If wrapped `f` performs tail call, then new set of parameters will
      // be accumulated causing new iteration in the loop. If `f` does not
      // performs tail call then accumulation is finished and `value` will
      // be returned.
      while (accumulated.length) value = f.apply(this, accumulated.shift());
      active = false;
      return value;
    }
  };
}

module.exports = tco;
