const TYPES = {
  PACKET: 0,
  PAYLOAD: 1,
  REGISTER: 2,
  GET: 3,
  PATH: 4,
  CALL: 5,
  RESULT: 6,
  EVENT: 7,
};

const SIA_TYPES = Object.fromEntries(
  Object.entries(TYPES).map(([key, code]) => [key, 0xf + code])
);

module.exports.TYPES = TYPES;
module.exports.SIA_TYPES = SIA_TYPES;
