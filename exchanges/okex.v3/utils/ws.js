

const _ = require('lodash');
const _ws = require('./_ws');
const { symbol2pair } = require('./public');
const { checkKey } = require('./../../../utils');
const futureUtils = require('./future');
const spotUtils = require('./spot');
const swapUtils = require('./swap');

function _parse(v) {
  return parseFloat(v, 10);
}
function exist(d) {
  return !!d;
}

function final(f, l) {
  return (d) => {
    d = f(d, l);
    if (d) {
      for (const k in d) {
        if (d[k] === undefined) delete d[k];
      }
    }
    return d;
  };
}

function _getChanelObject(args, op = 'subscribe') {
  return { op, args };
}

function genInstrumentChanelFn(chanel) {
  return (o = {}) => {
    const pairs = (o.pairs && o.pairs.length) || _.map(o.coins, coin => `${coin}-USD`);
    const contract_type = getContractTypeFromO(o);
    const args = [];
    _.forEach(pairs, (pair) => {
      _.forEach(contract_type, (c) => {
        const instrument_id = futureUtils.getFutureInstrumentId(pair, c);
        args.push(`${chanel}:${instrument_id}`);
      });
    });
    return args;
  };
}


// 期货指数
const futureIndex = {
  name: 'index/ticker',
  isSign: false,
  notNull: ['pairs'],
  chanel: (o = {}) => _.map(o.pairs, p => `index/ticker:${p.replace('-USDT', '-USD')}`).filter(exist),
  formater: (res) => {
    if (!res) return [];
    const { data } = res;
    return _.map(data, (line) => {
      const { instrument_id: pair, timestamp, last } = line;
      return { pair, time: new Date(timestamp), price: _parse(last) };
    }).filter(d => d);
  }
};


// 现货tick
const ticks = {
  name: 'spot/ticker',
  isSign: false,
  notNull: ['pairs'],
  chanel: (o = {}) => _.map(o.pairs, p => `spot/ticker:${p}`),
  formater: res => _.map(res.data, final(spotUtils.formatTick)).filter(exist)
};

const futureTicks = {
  name: 'futures/ticker',
  notNull: ['pairs', 'contract_type'],
  isSign: false,
  chanel: genInstrumentChanelFn('futures/ticker'),
  formater: res => _.map(res.data, final(futureUtils.formatTick)).filter(exist)
};

function getContractTypeFromO(o) {
  let { contract_type } = o;
  if (typeof contract_type === 'string') contract_type = [contract_type];
  return contract_type;
}

// future Position
const futurePosition = {
  name: 'futures/position',
  notNull: ['coins', 'contract_type'],
  isSign: true,
  chanel: genInstrumentChanelFn('futures/position'),
  formater: res => _.map(res.data, final(futureUtils.formatFuturePosition)).filter(exist)
};


const futureBalance = {
  name: 'futures/account',
  notNull: ['coins'],
  isSign: true,
  chanel: (o = {}) => _.map(o.coins, coin => `futures/account:${coin}`),
  formater: res => _.flatten(_.map(res.data, (l) => {
    return _.map(l, futureUtils.formatBalance);
  }).filter(exist))
};


const futureOrders = {
  name: 'futures/order',
  isSign: true,
  notNull: ['pairs', 'contract_type'],
  chanel: genInstrumentChanelFn('futures/order'),
  formater: res => _.map(res.data, final(futureUtils.formatFutureOrder)).filter(exist)
};

const orders = {
  name: 'spot/order',
  notNull: ['pairs'],
  isSign: true,
  chanel: o => _.map(o.pairs, pair => `spot/order:${pair}`),
  formater: res => _.map(res.data, final(spotUtils.formatOrder)).filter(exist)
};


const futureDepth = {
  isSign: false,
  name: 'futures/depth5',
  chanel: genInstrumentChanelFn('futures/depth5'),
  notNull: ['contract_type', 'pairs'],
  formater: res => futureUtils.formatFutureDepth(res.data)
};

const depth = {
  name: 'spot/depth5',
  notNull: ['pairs'],
  isSign: false,
  chanel: o => _.map(o.pairs, pair => `spot/depth5:${pair}`),
  formater: res => _.map(res.data, (d) => {
    if (!d) return null;
    const { instrument_id: pair, timestamp, asks, bids } = d;
    return {
      pair,
      exchange: 'okex',
      time: new Date(timestamp),
      bids: spotUtils.formatDepth(bids),
      asks: spotUtils.formatDepth(asks),
    };
  }).filter(exist)
};

const balance = {
  name: 'spot/account',
  notNull: ['coins'],
  chanel: o => _.map(o.coins, coin => `spot/account:${coin}`),
  isSign: true,
  formater: ds => _.map(ds.data, final(spotUtils.formatBalance))
};

const swapTicks = {
  name: 'swap/ticker',
  isSign: false,
  notNull: ['pairs'],
  chanel: o => _.map(o.pairs, pair => `swap/ticker:${pair}-SWAP`),
  formater: ds => _.map(ds.data, final(swapUtils.formatTick))
};

const swapDepth = {
  name: 'swap/depth5',
  isSign: false,
  notNull: ['pairs'],
  chanel: o => _.map(o.pairs, pair => `swap/depth5:${pair}-SWAP`),
  formater: res => futureUtils.formatFutureDepth(res.data, 'swap')
};


module.exports = {
  ..._ws,
  // spot
  ticks,
  orders,
  depth,
  balance,
  getChanelObject: _getChanelObject,
  // reqBalance,
  // future
  futureIndex,
  futureTicks,
  futureOrders,
  futureBalance,
  futureDepth,
  futurePosition,
  swapTicks,
  swapDepth
};
