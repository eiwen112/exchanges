
const pub = require('./public');
const future = require('./future');
const spot = require('./spot');
const margin = require('./margin');
const ws = require('./ws');
const swap = require('./swap');

module.exports = {
  ...pub, ...future, ...spot, ...margin, ...swap, ws
};
