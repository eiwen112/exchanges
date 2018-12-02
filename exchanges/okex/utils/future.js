const _ = require('lodash');
const Utils = require('./../../../utils');
const md5 = require('md5');
// const moment = require('moment');
const error = require('./../errors');

const { checkKey } = Utils;

const {
  symbol2pair,
  formatWsResult,
  createWsChanel,
  code2OrderStatus,
  orderStatus2Code,
  futureOrderStatus2Code,
  code2FutureOrderStatus,
  pair2symbol,
  _parse,
  pair2coin,
  coin2pair,
  formatInterval,
} = require('./public');

// future kline

function formatFutureKlineO(o = {}) {
  o = _.cloneDeep(o);
  o.type = formatInterval(o.interval);
  delete o.interval;
  return o;
}

function formatFutureKline(ds, o) {
  return _.map(ds, (d) => {
    const time = new Date(d[0]);
    const tstr = time.getTime();
    return {
      ...o,
      unique_id: md5(`${o.pair}_${tstr}_${o.interval}_${o.contract_type}`),
      time,
      exchange: 'okex',
      open: _parse(d[1]),
      high: _parse(d[2]),
      low: _parse(d[3]),
      close: _parse(d[4]),
      volume_amount: _parse(d[5]),
      volume_coin: _parse(d[6])
    };
  });
}

//
function parseFutureTickChanel(channel) {
  const ds = channel.replace('ok_sub_future', '').split('_ticker_');
  return {
    pair: ds[0].split('_').reverse().join('-').toUpperCase(),
    contract_type: ds[1]
  };
}

function formatWsFutureTick(ds) {
  ds = _.map(ds, (d) => {
    const { channel } = d;
    d = d.data;
    if (d.result) return null;
    const pps = parseFutureTickChanel(channel);
    const bid_price = _parse(d.buy);
    const ask_price = _parse(d.sell);
    const time = new Date();
    // const tstr = time.getTime();
    return {
      future_id: `${pps.pair}_${pps.contract_type}`,
      ...pps,
      exchange: 'okex',
      time,
      high: _parse(d.high),
      low: _parse(d.low),
      volume_24: _parse(d.vol),
      bid_price,
      ask_price,
      last_price: _parse(d.last),
      unit_amount: _parse(d.unitAmount),
      hold_amount: _parse(d.hold_amount),
      contract_id: d.contractId,
    };
  }).filter(d => d);
  return _.keyBy(ds, 'pair');
}

//
const createWsChanelFutureTick = createWsChanel((pair, o) => {
  pair = pair2symbol(pair, true);
  const { contract_type } = o;
  if (Array.isArray(contract_type)) {
    return _.map(contract_type, (ctype) => {
      return `ok_sub_future${pair}_ticker_${ctype}`;
    });
  }
  return `ok_sub_future${pair}_ticker_${contract_type}`;
});

const createWsChanelFutureKline = createWsChanel((pair, o) => {
  pair = pair2symbol(pair, true);
  const interval = formatInterval(o.interval);
  return `ok_sub_future${pair}_kline_${o.contract_type}_${interval}`;
});

// const createWsFutureBalancesDepth = createWsChanel((o) => {
//   return 'ok_sub_futureusd_userinfo';
// });

function _parseWsFutureChannel(channel) {  // usd_btc_kline_quarter_1min
  const symbol = channel.replace('ok_sub_future', '').split('_kline_')[0];
  return symbol2pair(symbol, true);
}

const formatWsFutureKline = formatWsResult((kline, o) => {
  const res = _.map(kline, (d) => {
    const time = new Date(_parse(d[0]));
    const tstr = time.getTime();
    return {
      ...o,
      unique_id: md5(`${o.pair}_${tstr}_${o.interval}_${o.contract_type}`),
      exchange: 'okex',
      time,
      open: _parse(d[1]),
      high: _parse(d[2]),
      low: _parse(d[3]),
      close: _parse(d[4]),
      volume_amount: _parse(d[5]),
      volume_coin: _parse(d[6]),
    };
  });
  return _.keyBy(res, 'unique_id');
});

//
function _parseWsFutureDepthChannel(channel) {  // usd_btc_kline_quarter_1min
  const ds = channel.replace('ok_sub_future', '').split('_depth_');
  const pair = symbol2pair((ds[0] || '').replace('usd', 'usdt'), true);
  const cs = ds[1].split('_');
  cs.pop();
  const contract_type = cs.join('_');
  // console.log(channel, contract_type, 'channel...channel...');
  // process.exit();
  const future_id = `${pair}_${contract_type}`;
  return { contract_type, pair, future_id };
}
const createWsFutureDepth = createWsChanel((pair, o) => {
  pair = pair2symbol(pair, true);
  const { contract_type } = o;
  if (typeof contract_type === 'string') {
    return `ok_sub_future${pair}_depth_${o.contract_type}_${o.size}`;
  } else if (Array.isArray(contract_type)) {
    return _.map(contract_type, (ctype) => {
      return `ok_sub_future${pair}_depth_${ctype}_${o.size}`;
    });
  }
});

// depth
function _formatFutureDepth(ds) {
  return _.map(ds, (d) => {
    return {
      exchange: 'okex',
      price: _parse(d[0]),
      volume_amount: _parse(d[1]),
      volume_coin: _parse(d[2]),
      sum_volume_amount: _parse(d[4]),
      sum_volume_coin: _parse(d[3]),
    };
  });
}


// future balances
function formatFutureBalances(ds) {
  if (!ds) return null;
  return _.map(ds.info, (line, coin) => {
    coin = coin.toUpperCase();
    return {
      coin,
      ..._.pick(line, ['risk_rate', 'profit_real', 'profit_unreal', 'keep_deposit', 'account_rights'])
    };
  });// 不要随意filter
  // .filter(d => d.account_rights);
}

function formatWsFutureBalances(ds) {
  ds = _.map(ds, (d) => {
    d = d.data;
    const coin = d.symbol.replace('_usd', '').toUpperCase();
    const line = _.pick(d, ['balance', 'profit_real', 'keep_deposit', 'account_rights']);
    return {
      coin,
      time: new Date(),
      ...line,
    };
  });
  ds = _.keyBy(ds, (d) => {
    return d.coin;
  });
  return ds;
}

function formatFuturePosition(data = {}, o) {
  const { holding, result } = data;
  const { pair, contract_type } = o;
  if (!result) return null;
  return _.map(holding, (d) => {
    return {
      pair,
      unique_id: `${pair}_${contract_type}`,
      contract_type,
      time: new Date(d.create_date),
      ..._.pick(d, ['buy_amount', 'buy_available', 'buy_price_avg', 'buy_price_cost', 'buy_profit_real', 'contract_id', 'lever_rate', 'sell_amount', 'sell_available', 'sell_price_avg', 'sell_price_cost', 'sell_profit_real', 'force_liqu_price'])
    };
  });
}

const d7 = 7 * 24 * 3600 * 1000;
const d14 = d7 * 2;
function getContractType(contract_id) {
  if (!contract_id) return null;
  contract_id = `${contract_id}`;
  const year = contract_id.substring(0, 4);
  const month = contract_id.substring(4, 6);
  const day = contract_id.substring(6, 8);
  const tstr = `${year}-${month}-${day}`;
  const dt = new Date(tstr) - new Date();
  if (dt > d14) return 'quarter';
  if (dt > d7) return 'next_week';
  return 'this_week';
}
function formatWsFuturePosition(ds) {
  ds = _.map(ds, (d) => {
    d = d.data;
    const { positions, symbol } = d;
    const pair = symbol.replace('_usd', '-USDT').toUpperCase();
    const buy = _.filter(positions, p => p.position === 1)[0];
    const sell = _.filter(positions, p => p.position === 2)[0];
    const { contract_id } = sell;
    const contract_type = getContractType(contract_id);
    return {
      unique_id: `${pair}_${contract_type}`,
      pair,
      contract_type,
      buy_amount: buy.hold_amount,
      sell_amount: sell.hold_amount
    };
  });
  return _.flatten(ds);
}

function formatWsFutureDepth(ds, o) {
  const res = {};
  _.forEach(ds, (d) => {
    const { data, channel } = d;
    if (!data || data.result) return null;
    const { bids, asks, timestamp } = data;
    const info = _parseWsFutureDepthChannel(channel);
    const line = {
      ...info,
      exchange: 'okex',
      time: new Date(timestamp),
      bids: _formatFutureDepth(bids),
      asks: _formatFutureDepth(_.reverse(asks))
    };
    res[`${info.contract_type}_${info.symbol}`] = line;
  }).filter(d => d);
  return res;
}

// move Balance
const moveType2code = {
  future: {
    spot: 2
  },
  spot: {
    future: 1
  }
};

function formatDigit(num, n) {
  const k = Math.pow(10, n);
  return Math.floor(num * k) / k;
}

function formatMoveBalanceO(o) {
  const { source, target, coin } = o;
  const amount = formatDigit(o.amount, 4);// 有时候会有精度问题
  const type = _.get(moveType2code, `${source}.${target}`);
  const symbol = `${coin.toLowerCase()}_usd`;
  return { type, amount, symbol };
}

// futureOrderHistory
function formatFutureOrderHistoryO(o) {
  const { date } = o;
}

function formatFutureOrderHistory() {
}


//
const typeMap = {
  buy: {
    up: 1, // 开多
    down: 2, // 开空
  },
  sell: {
    up: 3, // 平多
    down: 4, // 平空
  }
};
const reverseTypeMap = {
  1: {
    side: 'BUY',
    direction: 'UP'
  },
  2: {
    side: 'BUY',
    direction: 'DOWN'
  },
  3: {
    side: 'SELL',
    direction: 'UP'
  },
  4: {
    side: 'SELL',
    direction: 'DOWN'
  }
};
function formatFutureOrderO(o) {
  let { pair, contract_type, lever_rate, amount, side, direction, type, price } = o;
  side = side.toLowerCase();
  type = type.toLowerCase();
  if (type === 'limit') {
    if (!o.price) {
      console.log('type=limit 必须有price');
      process.exit();
    }
  }
  pair = pair.toLowerCase().replace('usdt', 'usd');
  const opt = {
    pair,
    type: _.get(typeMap, `${side}.${direction}`),
    contract_type,
    lever_rate,
    amount,
    ...(type === 'limit' ? {
      price,
      match_price: 0
    } : {
      match_price: 1
    })
  };
  return opt;
}

function formatFutureOrderInfoO(o = {}) {
  const opt = _.cloneDeep(o);
  if (Array.isArray(o.order_id)) opt.order_id = o.order_id.join(',');
  return opt;
}

function formatAllFutureOrdersO(o) {
  o.status = futureOrderStatus2Code[o.status];
  if (Array.isArray(o.order_id)) o.order_id = o.order_id.join(',');
  return o;
}
function getContractTypeFromContractName(contract_name, coin) {
  const tstr = contract_name.replace(coin, '');
  const month = tstr.substring(0, 2);
  const date = tstr.substring(2, 4);
  const now = new Date();
  const year = now.getFullYear();
  let t = getT(year, month, date);
  let dt = t - now;
  if (dt < 0) {
    t = getT(year, month, date);
    dt = t - now;
  }
  if (dt > d14) return 'quarter';
  if (dt > d7) return 'next_week';
  return 'this_week';
}
function getT(year, month, date) {
  return new Date(`${year}-${month}-${date}`);
}
function formatFutureOrderInfo(ds, o, isFlat = true) {
  if (!ds) return null;
  const { orders } = ds;
  if (!orders) return null;
  let res = _.map(orders, (d) => {
    let { contract_name, contract_type } = d;
    const { pair } = o;
    const coin = pair2coin(pair);
    contract_type = contract_type || getContractTypeFromContractName(contract_name, coin);
    return {
      order_id: `${d.orderid || d.order_id}`, // ////
      lever_rate: d.lever_rate,
      contract_type,
      contract_name,
      amount: d.amount || d.deal_amount,
      deal_amount: d.deal_amount,
      price: d.price_avg || d.price,
      status: code2OrderStatus[d.status],
      fee: d.fee,
      time: new Date(d.create_date),
      pair,
      ...(reverseTypeMap[d.type])
    };
  });
  if (isFlat && Array.isArray(res) && res.length === 1) res = res[0];
  return res;
}

function formatWsFutureOrder(ds) {
  if (!ds) return null;
  return _.map(ds, ({ data: d }) => {
    const { contract_name } = d;
    const coin = contract_name.substring(0, 3);
    const pair = `${coin}-USDT`;
    return {
      order_id: `${d.orderid}`,
      pair,
      lever_rate: d.lever_rate,
      contract_name,
      contract_type: d.contract_type,
      amount: d.amount,
      deal_amount: d.deal_amount,
      price: d.price,
      fee: d.fee,
      time: new Date(d.create_date),
      status: code2OrderStatus[d.status],
      ...(reverseTypeMap[d.type])
    };
  });
}

function formatFutureAllOrdersO(o) {
  o = _.cloneDeep(o);
  o.status = orderStatus2Code[o.status];
  return o;
}

function formatFutureAllOrders(ds) {
  // console.log(ds);
  // o = _.cloneDeep(o);
  // o.status = orderStatus2Code[o.status];
  // return o;
}

function _formatOrders(orders, match_price, type) {
  const res = _.map(orders, (o) => {
    checkKey(o, ['amount']);
    return {
      amount: o.amount,
      match_price,
      type,
      ...(match_price === 1 ? {} : { price: o.price })
    };
  });
  return JSON.stringify(res);
}
function formatBatchFutureOrderO(o) {
  let { side, type, direction } = o;
  side = side.toLowerCase();
  type = type.toLowerCase();
  const match_price = type === 'limit' ? 0 : 1;
  const opt = {
    ..._.pick(o, ['contract_type', 'lever_rate', 'pair']),
    orders_data: _formatOrders(o.orders, match_price, _.get(typeMap, `${side}.${direction}`))
  };
  return opt;
}

function formatBatchFutureOrder(ds, o) {
  return _.map(ds.order_info, (order) => {
    if (order.error_code) {
      const msg = error.getErrorFromCode(order.error_code);
      return null;
    }
    const line = { ...o, success: true, order_id: order.order_id };
    delete line.orders;

    return line;
  }).filter(d => d);
}


module.exports = {
  formatFutureOrderHistoryO,
  formatFutureOrderHistory,
  formatFutureBalances,
  formatMoveBalanceO,
  formatFutureOrderO,
  formatFutureOrderInfoO,
  formatFutureOrderInfo,
  formatFutureAllOrdersO,
  formatFutureAllOrders,
  formatBatchFutureOrderO,
  formatBatchFutureOrder,
  formatFuturePosition,
  formatWsFutureOrder,
  formatAllFutureOrdersO,
  // ws
  createWsChanelFutureKline,
  createWsChanelFutureTick,
  createWsFutureDepth,
  formatWsFutureDepth,
  formatWsFutureBalances,
  formatWsFuturePosition,
  //
  formatWsFutureKline,
  formatWsFutureTick,
  formatFutureKlineO,
  formatFutureKline,
};
