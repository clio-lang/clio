export const getModule = async (src) => {
  const url = URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
  return await import(url);
};
