const { REGISTRY_NAME } = require("../config");

/**
 * Returns the registry id.
 *
 * @param {string} id
 * @returns {object} - {type, id}
 *
 * @example registryId('stdlib') // 'hub:stdlib'
 */
const registryId = (id) => `${REGISTRY_NAME}:${id}`;

module.exports = { registryId };
