export const getModule = async (src) => {
  const dataUri =
    "data:text/javascript;charset=utf-8," + encodeURIComponent(src);
  return await import(dataUri);
};
