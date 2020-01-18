var addon = require("../native");

/**
 * Checks, if a given node version is officially supported by Clio.
 * Note that that version is subject to change. In this case, tests may have to be adjusted
 *
 * @argument {string} versionStr in format "major.minor.patch". E.g.: "12.6.1"
 * @returns {boolean} true, if node version is officially supported by Clio
 */
// Note: Wrapper is needed for documentation
exports.isSupportedNodeVersion = versionStr =>
  addon.isSupportedNodeVersion(versionStr);
