const implicit = block => {
  const lastExpr = block[block.length - 1];
  block[block.length - 1] = {
    name: "return",
    expr: lastExpr,
    location: block[block.length - 1].location
  };
  return block;
};

module.exports = implicit;
