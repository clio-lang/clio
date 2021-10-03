const GIT_URL_RE = /(.*?)(?:@([^@]*$))/;
/**
 * Returns an object whose properties represent significant elements
 * of the provided string.
 *
 * @param {string} id
 * @returns {object}
 *
 * @example (see tests)
 */
export const parsePackageId = (input) => {
  const match = input.match(GIT_URL_RE);
  if (!match) {
    throw "Failed to parse the package id";
  }
  const [url, tag] = match.slice(1);
  return { url, tag };
};

export default {
  parsePackageId,
};
