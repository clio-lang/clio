const randomId = (n) =>
  [...Array(n)].map((i) => (~~(Math.random() * 36)).toString(36)).join("");

module.exports = randomId;
