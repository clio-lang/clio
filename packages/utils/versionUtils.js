/**
 * Checks, if a given node version is officially supported by Clio.
 * Note that that version is subject to change. In this case, tests may have to be adjusted
 *
 * @argument {string} versionStr in format "major.minor.patch". E.g.: "12.6.1"
 * @returns {boolean} true, if node version is officially supported by Clio
 */
exports.isSupportedNodeVersion = (versionStr) => {
  const nodeFullVersion = versionStr.replace("v", "").split(".");

  const nodeMajorVersion = Number(nodeFullVersion[0]);
  const nodeMinorVersion = Number(nodeFullVersion[1]);

  return (
    nodeMajorVersion > 10 || (nodeMajorVersion === 10 && nodeMinorVersion >= 4)
  );
};
