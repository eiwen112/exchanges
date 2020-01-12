
const _ = require('lodash');
// const md5 = require('md5');
//
const Utils = require('./../../../utils');
const { orderStatusMap, formatOrder, orderO } = require('./public');

const reverseOrderStatusMap = _.invert(orderStatusMap);
const publicUtils = require('./public');

const { checkKey } = Utils;


function direct(d) {
  return d;
}

function _parse(v) {
  return parseFloat(v, 10);
}

function symbol2pair(symbol) {
  return symbol.replace('_', '-');
}

function _parseBalance(d) {
  return {
    moveable_amount: _parse(d.can_withdraw),
    balance: _parse(d.available),
    borrow_balance: _parse(d.borrowed),
    total_balance: _parse(d.balance),
    locked_balance: _parse(d.hold),
    fee: _parse(d.lending_fee)
  };
}

function coin2currency(coin) {
  return `currency:${coin}`;
}


function formatMarginBalance(d, o = {}) {
  const pair = o.pair || symbol2pair(d.instrument_id);
  const [left, right] = pair.split('-');
  const leftInfo = d[coin2currency(left)];
  const rightInfo = d[coin2currency(right)];
  const res = {
    pair,
    left: {
      coin: left,
      ..._parseBalance(leftInfo)
    },
    right: {
      coin: right,
      ..._parseBalance(rightInfo)
    },
    margin_ratio: _parse(d.margin_ratio) || 10000
  };
  if (d.liquidation_price) res.liquidation_price = _parse(d.liquidation_price);
  if (d.risk_rate) res.risk_rate = _parse(d.risk_rate);
  return res;
}

function marginBalance(d, o) {
  const res = formatMarginBalance(d, o);
  if (o && o.notNull) {
    return _.filter(res, d => d.balance || d.total_balance);
  }
  return res;
}


function marginBalances(ds, o) {
  let res = _.map(ds, formatMarginBalance);
  if (!o) return res;
  if (o.notNull) res = _.filter(res, d => d.balance || d.total_balance);
  if (o.pairs) res = _.filter(res, d => o.pairs.includes(d.pair));
  return res;
}

function _parseMarginCoin(d) {
  return {
    borrow_available: _parse(d.available),
    fee_rate: _parse(d.rate),
    lever_rate: _parse(d.leverage)
  };
}

function marginPairInfo(ds) {
  const res = [];
  _.forEach(ds, (d) => {
    const pair = symbol2pair(d.instrument_id);
    const [left, right] = pair.split('-');
    const leftInfo = d[coin2currency(left)];
    const rightInfo = d[coin2currency(right)];
    const pub = { pair };
    res.push({
      side: 'left',
      ...pub,
      unique_id: `${pair}_${left}`,
      coin: left,
      ..._parseMarginCoin(leftInfo)
    });
    res.push({
      side: 'right',
      ...pub,
      coin: right,
      unique_id: `${pair}_${right}`,
      ..._parseMarginCoin(rightInfo)
    });
  });
  return res;
}

// 借款历史
const marginStatus = {
  brrowing: 0,
  payoff: 1,
};
const borrowStateMap = {
  1: 'SUCCESS',
  2: 'UNFINISH'
};

const reverseBorrowStateMap = {
  UNFINISH: 0,
  SUCCESS: 1
};

function borrowHistoryO(o = {}) {
  const opt = _.cloneDeep(o);
  if (o.status) {
    opt.status = reverseBorrowStateMap[o.status];
  }
  if (o.pair) opt.instrument_id = o.pair;
  return opt;
}


function _borrowHistory(d, o) {
  const amount = _parse(d.amount);
  const repayed_amount = _parse(d.returned_amount);
  const interest = _parse(d.interest);
  const repayed_interest = _parse(d.paid_interest);
  const unfinish_interest = interest - repayed_interest;
  const res = {
    amount,
    order_id: d.borrow_id,
    time: new Date(d.created_at),
    coin: d.currency,
    instrument_id: d.instrument_id,
    pair: d.instrument_id,
    interest,
    repayed_amount,
    unfinish_amount: amount - repayed_amount,
    unfinish_interest,
    repayed_interest,
    last_interest_time: new Date(d.last_interest_time),
    force_repay_time: new Date(d.force_repay_time),
    rate: _parse(d.rate),
    rate_day: _parse(d.rate * 24),
    rate_year: _parse(d.rate * 24 * 365),
  };
  if (o.status) res.status = o.status;
  return res;
}

function borrowHistory(ds, o) {
  return _.map(ds, d => _borrowHistory(d, o));
}

// 借款
function borrowO(o) {
  return {
    instrument_id: o.pair || o.instrument_id,
    currency: o.coin,
    amount: o.amount
  };
}

function borrow(d) {
  if (!d) return false;
  return {
    order_id: d.borrow_id,
    success: d.result
  };
}

function repayO(o) {
  const res = {
    instrument_id: o.instrument_id || o.pair,
    amount: o.amount,
    currency: o.coin
  };
  if (o.client_oid) res.client_oid = o.client_oid;
  if (o.borrow_id) res.borrow_id = o.borrow_id || o.order_id;
  return res;
}

function repay(d) {
  if (!d) return false;
  return {
    order_id: d.repayment_id,
    success: d.result
  };
}

// 下单
function marginOrderO(o) {
  return {
    ...publicUtils.orderO(o),
    margin_trading: 2
  };
}
function marginOrder(d, o) {
  if (!d) return null;
  return formatOrder(d, o);
}

function cancelMarginOrderO(o = {}) {
  return {
    instrument_id: o.instrument_id,
    client_oid: o.client_oid
  };
}

function batchCancelMarginOrderO(o = []) {
  o = _.map(_.groupBy(o, 'pair'), (l, pair) => {
    return {
      instrument_id: pair.toLowerCase(),
      order_ids: _.map(l, _l => _l.order_id).slice(0, 9)
    };
  });
  return o;
}
function batchCancelMarginOrder(ds, o = {}) {
  const res = [];
  _.forEach(ds, (d, pair) => {
    _.forEach(d, (_d) => {
      const l = {
        client_oid: _d.client_oid,
        order_id: _d.order_id,
        success: _d.result,
        pair: pair.toUpperCase()
      };
      if (l.success) l.status = 'CANCEL';
      res.push(l);
    });
  });
  return res;
}

function cancelMarginOrder(d, o) {
  const res = {
    order_id: d.order_id,
    client_oid: d.client_oid,
    ...o
  };
  if (d.result) res.status = 'CANCEL';
  return res;
}

function _formatOrderIds(ids) {
  if (Array.isArray(ids)) return ids.join(',');
}
function cancelAllMarginOrdersO(o = {}) {
  return { ...o };
  // return { instrument_id: o.instrument_id, order_id: _formatOrderIds(o.order_ids) };
}
function cancelAllMarginOrders(ds, o) {
  return ds;
}

function marginOrdersO(o = {}) {
  return {
    instrument_id: o.pair,
    status: reverseOrderStatusMap[o.status],
    from: o.from,
    to: o.to,
    limit: o.limit
  };
}


function _marginOrders(d, o) {
  return {
    ...formatOrder(d),
    ...o
  };
}

function unfinishMarginOrdersO(o = {}) {
  return {
    ...o
  };
}

function unfinishMarginOrders(ds, o) {
  return _.map(ds, d => formatOrder(d, o));
}

// function successMarginOrders() {
// }
// function successMarginOrdersO(o = {}) {
// }
function marginOrders(ds) {
  return _.map(ds, _marginOrders);
}

function marginOrderInfoO(o = {}) {
  return {
    instrument_id: o.pair,
    order_id: o.order_id
  };
}

function marginOrderInfo(line, o, error) {
  if (error && error.code === 33014) {
    return { order_id: o.order_id, status: 'X_FINISH' };
  }
  return { ...formatOrder(line), ...o };
}

module.exports = {
  formatMarginBalance,
  marginBalances,
  marginBalance,
  marginBalanceO: direct,
  marginPairInfoO: direct,
  marginPairInfo,
  borrowHistoryO,
  borrowHistory,
  borrow,
  borrowO,
  repay,
  repayO,
  marginOrderO,
  marginOrder,
  cancelAllMarginOrdersO,
  cancelAllMarginOrders,
  cancelMarginOrderO,
  batchCancelMarginOrderO,
  batchCancelMarginOrder,
  batchCancelMarginOrders: batchCancelMarginOrder,
  batchCancelMarginOrdersO: batchCancelMarginOrderO,
  cancelMarginOrder,
  marginOrdersO,
  marginOrders,
  unfinishMarginOrdersO,
  unfinishMarginOrders,
  marginOrderInfoO,
  marginOrderInfo
};
