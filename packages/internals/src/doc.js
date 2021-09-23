const help = (fn) => console.log(fn.__doc__);

const describe = (description, fn) => {
  fn.__doc__ = description;
  return fn;
};

module.exports.help = help;
module.exports.describe = describe;
