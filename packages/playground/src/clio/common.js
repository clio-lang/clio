export const getModule = async (src) => {
  const module = { exports: {} };
  eval(src);
  return module.exports;
};
