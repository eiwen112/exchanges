
const _ = require('lodash');
const md5 = require('md5');
//
const Utils = require('./../../../utils');
const publicUtils = require('./public');

const { pair2symbol, formatInterval, _parse } = publicUtils;

function spotKlineO(o) {
  const pair = `${pair2symbol(o.pair)}`;
  const interval = formatInterval(o.interval || '1m');
  return {
    pair, interval
  };
}
function formatSpotKline(d, o) {
  const { pair, interval } = o;
  const time = new Date(_parse(d[0]) * 1000);
  const t = time.getTime();
  const unique_id = [pair, interval, t].join('_');
  return {
    unique_id,
    interval,
    time,
    pair,
    open: _parse(d[1]),
    high: _parse(d[2]),
    low: _parse(d[3]),
    close: _parse(d[4]),
    volume: _parse(d[6]),
    count: _parse(d[7]),
  };
}
function spotKline(ds, o) {
  const { result } = ds;
  for (const symbol in result) {
    return _.map(result[symbol], d => formatSpotKline(d, o));
  }
}

function depthO(o) {
  const pair = `${pair2symbol(o.pair)}`;
  return {
    pair
  };
}
function formatDepth(d, o) {
  const { pair } = o;
  if (!pair) {
    console.log(`kraken的币种${d.s} 无法翻译为标准symbol... 请联系开发者`);
    return null;
  }
  return {
    pair,
    asks: d.asks.map(ask => ({
      price: _parse(ask[0]),
      volume: _parse(ask[1]),
      timestamp: ask[2]
    })),
    bids: d.bids.map(bid => ({
      price: _parse(bid[0]),
      volume: _parse(bid[1]),
      timestamp: bid[2]
    }))
  };
}
function depth(ds, o) {
  const { result } = ds;
  for (const symbol in result) {
    return formatDepth(result[symbol], o);
  }
}

module.exports = {
  spotKlineO, spotKline, spotTicks, depth, formatDepth, depthO
};
