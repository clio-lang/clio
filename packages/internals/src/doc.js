const help = (fn) => console.log(fn.__doc__);

const describe = (description, fn) => {
  fn.__doc__ = description;
  return fn;
};

const returns = (type, fn) => {
  fn.__returns__ = type;
  return fn;
};

module.exports.help = help;
module.exports.describe = describe;
module.exports.returns = returns;
