/**
 * Build the URL of a Github archive.
 * 
 * @param {string} branch - master, v
 * @param {string} uri
 * @returns {object} - {type, id}
 * 
 * @example
githubZipURL({uri: 'github.com/foo/bar', branch: 'master'})
// https://github.com/foo/bar/archive/master.zip
 */
const githubZipURL = ({ branch, uri }) => `${uri}/archive/${branch}.zip`;

module.exports = { githubZipURL };
