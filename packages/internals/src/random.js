const randomId = (n) =>
  [...Array(n)].map(() => (~~(Math.random() * 36)).toString(36)).join("");

export default randomId;
