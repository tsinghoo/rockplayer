// const Binance = require('node-binance-api');
// import Binance from "node-binance-api";
const { json } = require("express");
const fs = require("fs");
let DEBUG = 2;
let INFO = 3;
let ERROR = 4;
let logLevel = INFO;


const args = process.argv;
let dev = 0;

const { RestClient, WebsocketClient } = require('okx-api');


// binance.socksProxy = 'socks://192.168.66.1:10800/';

let g = {};
g.broker = "OKX";
g.baseUrl = "http://test1.91taogu.com";
g.httpsProxy = 'http://192.168.66.205:8080/';
g.actions = [];
g.getActionTimes = 0;
g.stocklist = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'];
g.apiKey = '1315b7af-d17e-4582-8de7-2919f4de5f20';
g.apiSecret = 'EB46A9E766BFE107F37B882443FCB780';
g.apiPass = 'OkxPassw0rd!';

function printObjFunc(obj) {
  const allProps = Object.getOwnPropertyNames(obj);
  const functions = allProps.filter(prop => typeof obj[prop] === 'function');

  debug('对象中的函数:');
  functions.forEach(funcName => {
    debug(`- ${funcName}`);
  });

  return functions;
}


const client = new RestClient({
  apiKey: g.apiKey,
  apiSecret: g.apiSecret,
  apiPass: g.apiPass,
  // For Global users (www.okx.com), you don't need to set the market.
  // It will use global by default.
  // Not needed: market: 'GLOBAL',

  // For EEA users (my.okx.com), set market to "EEA":
  // market: 'EEA',

  // For US users (app.okx.com), set market to "US":
  // market: 'US',
});


const wsClient = new WebsocketClient({
  // For Global users (www.okx.com), you don't need to set the market.
  // It will use global by default.
  // Not needed: market: 'GLOBAL',

  // For EEA users (my.okx.com), set market to "EEA":
  // market: 'EEA',

  // For US users (app.okx.com), set market to "US":
  // market: 'US',

  accounts: [
    // For private topics, include one or more accounts in an array. Otherwise only public topics will work
    {
      apiKey: g.apiKey,
      apiSecret: g.apiSecret,
      apiPass: g.apiPass,
    }
  ],
});






async function test() {


  // Submit a buy and sell market order
  (async () => {
    try {

      let response = await client.getHistoricCandles({
        instId: "BTC-USDT",
        bar: "",
        limit: 5
      });

      console.log('All balances: ', JSON.stringify(response, null, 2));

      return;

      const allBalances = await client.getBalance();
      console.log('All balances: ', JSON.stringify(allBalances, null, 2));



      const buyResult = await client.submitOrder({
        instId: 'BTC-USDT',
        ordType: 'market',
        side: 'buy',
        sz: '0.1',
        tdMode: 'cash',
        tgtCcy: 'base_ccy',
      });
      console.log('buy order result: ', buyResult);

    } catch (e) {
      console.error('request failed: ', e);
    }
  })();

  return;
  // Raw data will arrive on the 'update' event
  wsClient.on('update', (data) => {
    console.log('ws update (raw data received)', JSON.stringify(data));
  });

  wsClient.on('open', (data) => {
    console.log('connection opened open:', data.wsKey);
  });

  // Replies (e.g. authenticating or subscribing to channels) will arrive on the 'response' event
  wsClient.on('response', (data) => {
    // console.log('ws response: ', JSON.stringify(data, null, 2));
    console.log('ws response: ', JSON.stringify(data));
  });

  wsClient.on('reconnect', ({ wsKey }) => {
    console.log('ws automatically reconnecting.... ', wsKey);
  });
  wsClient.on('reconnected', (data) => {
    console.log('ws has reconnected ', data?.wsKey);
  });
  wsClient.on('exception', (data) => {
    console.error('ws exception: ', data);
  });

  /**
   * Simply call subscribe to request the channels that you're interested in.
   *
   * If authentication is required, the WSClient will automatically authenticate with the available credentials.
   */

  // Subscribe one event at a time:
  wsClient.subscribe({
    channel: 'account',
  });

  // OR, combine multiple subscription events into one request using an array instead of an object:
  wsClient.subscribe([
    {
      channel: 'account',
    },
    {
      channel: 'positions',
      instType: 'ANY',
    },
  ]);

  // Public topics, for comparison. These do not require authentication / api keys:
  wsClient.subscribe([
    {
      channel: 'instruments',
      instType: 'SPOT',
    },
    {
      channel: 'instruments',
      instType: 'FUTURES',
    },
    {
      channel: 'tickers',
      instId: 'BTC-USDT',
    }, {
      channel: 'candle1m',
      instId: 'BTC-USDT',
    }, {
      channel: 'candle1D',
      instId: 'BTC-USDT',
    }, {
      channel: 'trades',
      instId: 'BTC-USDT',
    }

  ]);

}


function timeFormat(time, fmt) {
  if (time == null) {
    return "";
  }
  if (time.time) {
    time = new Date(time.time);
  } else {
    time = new Date(time);
  }
  if (fmt == null) {
    var ms = time.getTime();
    var now = new Date();
    if (now - ms < 24 * 60 * 60 * 1000) {
      fmt = "hh:mm";
    } else if (now.getYear() == time.getYear()) {
      fmt = "MM-dd";
    } else {
      fmt = "yyyy-MM";
    }
  }
  var qua = Math.floor((time.getMonth() + 3) / 3);
  var o = {
    "M+": time.getMonth() + 1, // 月份
    "d+": time.getDate(), // 日
    "h+": time.getHours(), // 小时
    "m+": time.getMinutes(), // 分
    "s+": time.getSeconds(), // 秒
    "q+": qua, // 季度
    S: time.getMilliseconds()
    // 毫秒
  };
  if (/(y+)/.test(fmt))
    fmt = fmt.replace(
      RegExp.$1,
      (time.getYear() + 1900 + "").substr(4 - RegExp.$1.length)
    );
  for (var k in o)
    if (new RegExp("(" + k + ")").test(fmt))
      fmt = fmt.replace(
        RegExp.$1,
        RegExp.$1.length == 1
          ? o[k]
          : ("00" + o[k]).substr(("" + o[k]).length)
      );
  return fmt;
};

function post(url, body) {
  debug(`POST ${url}:${JSON.stringify(body)}`);
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  }).then(response => {
    if (!response.ok) {
      throw new Error('网络响应不正常');
    }
    return response.text();
  }).catch(e => {
    error('上传失败:', `POST ${url}:${JSON.stringify(body)}`, JSON.stringify(body), e.toString());
  });

}

function get(url) {
  debug(`GET ${url}`);
  return fetch(url, {
    method: "GET"
  });
}

g.logs = [];
async function log2File() {
  return new Promise(async (resolve, reject) => {
    while (1 == 1) {
      if (g.logs.length > 0) {
        let toWrite = g.logs.join("\n");
        g.logs = [];
        //将toWrite同步写入当前目录的日志文件里,文件名是yyyyMMdd格式
        let logFile = `${__dirname}/bnb${timeFormat(new Date(), "yyMMdd")}.log`;
        fs.writeFileSync(logFile, toWrite + "\n", { flag: "a" });
      } else {
        await sleep(100);
      }
    }
  });
}

function log() {

  let now = timeFormat(new Date(), "yy-MM-dd hh:mm:ss");
  console.log(now, ...arguments);

  let msg = [now, ...arguments].join(" ");
  g.logs.push(msg);

}
function info() {

  if (logLevel > INFO) {
    return;
  }

  log(...arguments);
}
function debug(msg) {

  if (logLevel > DEBUG) {
    return;
  }
  log(...arguments);
}
function error(msg) {
  if (logLevel > ERROR) {
    return;
  }

  log(...arguments);
}

async function updateSticks(stock, period, limit) {
  info(`updateSticks ${stock} ${period} ${limit}`);
  try {
    if (period == "1d") {
      timePatten = "yyyyMMdd";
    } else if (period == "1m") {
      timePatten = "yyyyMMddhhmmss";
    }


    let response = await client.getHistoricCandles({
      instId: stock,
      bar: "tick",
      limit: limit
    });

    let data = [];
    for (let i = 0; i < response.length; i++) {
      let item = response[i];
      data.push([timeFormat(item.openTime, timePatten), item.open, item.close, item.high, item.low, item.volume, item.quoteAssetVolume]);
      if (data.length == 50) {
        let body = {
          period: period,
          scode: stock,
          data: data
        };
        post(`${g.baseUrl}/stock/k/upload`, body);
        data = [];
      }
    }

    let body = {
      period: period,
      scode: stock,
      data: data
    };

    post(`${g.baseUrl}/stock/k/upload`, body);
    data = [];

  } catch (e) {
    error("updateSticks失败:", e);
  }
}

async function getActions() {
  try {
    let response = await get(g.baseUrl + "/stock/rule/actions?broker=" + g.broker);
    if (!response.ok) {
      error("getActions失败，状态码:", response.status);
      return;
    }

    const content = await response.text();
    const jso = JSON.parse(content);
    if (jso.data.length == 0) {
      g.getActionTimes++;
      if (g.getActionTimes > 10) {
        info("getActions ok");
        g.getActionTimes = 0;
      }

    } else {
      g.getActionTimes = 0;
      info("getActions:", response.status, content);
    }

    for (const act of jso.data) {
      act.scode = act.scode.split(".")[0];

      if (g.actions.includes(act.scode)) {
        info("已存在", act.scode, "的action");
      } else {

        try {
          let dotNums = {
            "BTCUSDT": 100000,
            "ETHUSDT": 10000,
            "BNBUSDT": 1000,
            "DOGEUSDT": 1
          };
          let ratio = dotNums[act.scode];
          let price = parseFloat(act.price);
          if (price < 1) {
            price = price.toFixed(5);
          } else {
            price = price.toFixed(2);
          }
          let quantity = Math.floor(parseFloat(act["amount"]) * ratio) / ratio;
          if (act.action === "buy") {
            info("买入", act.sname, act.scode, act.price, act.amount);
            info("买入", price, quantity);

            const response = await client.submitOrder({
              instId: act.scode,
              ordType: 'limit',
              side: 'buy',
              px: price,
              sz: quantity,
              tdMode: 'cash',
              tgtCcy: 'base_ccy',
            });

            debug(response);
            info("已买入", act.sname, act.scode, act.price, act.amount);

          } else if (act.action === "sell") {
            info("卖出", act.sname, act.scode, act.price, act.amount);
            info("卖出", price, quantity);
            const response = await client.submitOrder({
              instId: act.scode,
              ordType: 'limit',
              side: 'sell',
              px: price,
              sz: quantity,
              tdMode: 'cash',
              tgtCcy: 'base_ccy',
            });

            debug(response);
            info("已卖出", act.sname, act.scode, act.price, act.amount);
          } else if (act.action === "reloadK1d") {
            info("reloadK1d action for", act.scode);
          } else if (act.action === "cancelAction") {
            info("cancel action for", act.scode);

            response = await client.cancelOrder({
              instId: act.scode
            });

            debug("cancelAll response:" + response);
          }
        } catch (e) {
          error(act.action, act.scode, "fail:", e);
        }

        actionDone(act.id);
      }
    }

  } catch (err) {
    error("getActions出错:", err.toString());
  }
}

async function actionDone(id) {
  try {
    const response = await fetch(g.baseUrl + "/stock/action/done?id=" + id, {
      method: 'GET',
    });

    if (!response.ok) {
      const errorText = await response.text();
      error("action done error:", response.status, "响应内容:", errorText);
    }
  } catch (e) {
    error("action done error:", e.toString());
  }
}

async function sleep(ms) {
  return new Promise((resolve, reject) => {
    if (ms <= 0) {
      resolve();
      return;
    }

    setTimeout(() => {
      resolve();
    }, ms);
  });
}

function balance_update(data) {
  info("Balance Update", JSON.stringify(data));
  if (data.e = "executionReport") {
    if (data.x == "NEW") {
      // 25-10-20 15:51:08 Balance Update {"e":"executionReport","E":1760946669043,"s":"BNBUSDT","c":"x-B3AUXNYV827cefbc0c9748448b195b","S":"BUY","o":"LIMIT","f":"GTC","q":"0.00700000","p":"1125.22000000","P":"0.00000000","F":"0.00000000","g":-1,"C":"","x":"NEW","X":"NEW","r":"NONE","i":9639329831,"l":"0.00000000","z":"0.00000000","L":"0.00000000","n":"0","N":null,"T":1760946669042,"t":-1,"I":20702625198,"w":true,"m":false,"M":false,"O":1760946669042,"Z":"0.00000000","Y":"0.00000000","Q":"0.00000000","W":1760946669042,"V":"EXPIRE_MAKER"}

      let scode = data.s;
      let operation = data.S;
      let orderId = data.c;

      let url = g.baseUrl + "/stock/rule/action/ordered"
      let body = {
        "broker": g.broker,
        "scode": scode.split(".")[0],
        "status": 50,
        "orderNo": orderId
      }

      post(url, body);
    } else if (data.x == "TRADE") {
      let scode = data.s;
      let operation = data.S;
      if (operation == "BUY") {
        operation = "买入";
      } else {
        operation = "卖出";
      }

      let orderId = data.c;
      let time = data.O;


      let url = g.baseUrl + "/stock/rule/action/ordered"
      let body = {
        "broker": g.broker,
        "scode": scode.split(".")[0],
        "status": 56,
        "orderNo": orderId
      }
      post(url, body);

      url = g.baseUrl + "/stock/deal/update"

      // 25-10-20 15:51:10 Balance Update {"e":"executionReport","E":1760946670457,"s":"BNBUSDT","c":"x-B3AUXNYV827cefbc0c9748448b195b","S":"BUY","o":"LIMIT","f":"GTC","q":"0.00700000","p":"1125.22000000","P":"0.00000000","F":"0.00000000","g":-1,"C":"","x":"TRADE","X":"FILLED","r":"NONE","i":9639329831,"l":"0.00700000","z":"0.00700000","L":"1125.22000000","n":"0.00000525","N":"BNB","T":1760946670456,"t":1251701408,"I":20702626656,"w":false,"m":true,"M":true,"O":1760946669042,"Z":"7.87654000","Y":"7.87654000","Q":"0.00000000","W":1760946669042,"V":"EXPIRE_MAKER"}
      deal = {
        "tprice": parseFloat(data.p),//data.L
        "scode": scode.split(".")[0],
        "sname": "",
        "market": "",
        "operationDirection": operation,
        "operationName": g.broker,
        "tday": timeFormat(time, "yyyyMMdd"),
        "ttime": timeFormat(time, "hh:mm:ss"),
        "tid": orderId,
        "tcash": data.Z,
        "tamount": data.q,
        "tpair": ""
      }

      body = deal;
      post(url, body);
    }

  } else if (data.e == "outboundAccountPosition") {

    // 25-10-20 15:51:08 Balance Update {"e":"outboundAccountPosition","E":1760946669043,"u":1760946669042,"B":[{"a":"BNB","f":"0.00000000","l":"0.00000000"},{"a":"USDT","f":"1.82939400","l":"7.87654000"}]}


    for (let obj of data.B) {
      let { a: asset, f: available, l: onOrder } = obj;
      if (available == "0.00000000") continue;
      info(asset + "\tavailable: " + available + " (" + onOrder + " on order)");
    }

    updatePositions(0);

  }
}

function execution_update(data) {
  let { x: executionType, s: symbol, p: price, q: quantity, S: side, o: orderType, i: orderId, X: orderStatus } = data;
  if (executionType == "NEW") {
    if (orderStatus == "REJECTED") {
      debug("Order Failed! Reason: " + data.r);
    }
    debug(symbol + " " + side + " " + orderType + " ORDER #" + orderId + " (" + orderStatus + ")");
    debug("..price: " + price + ", quantity: " + quantity);
    return;
  }
  //NEW, CANCELED, REPLACED, REJECTED, TRADE, EXPIRED
  debug(symbol + "\t" + side + " " + executionType + " " + orderType + " ORDER #" + orderId);
}

async function startFutureMiniTicket() {
  g.stocklist.forEach(element => {
    binance.futuresMiniTickerStream(element, item => {
      let { symbol, close, high, low, open, volume, quoteVolume, eventTime } = item;
      let url = `${g.baseUrl}/stock/updatePrice/option?scode=${symbol}&price=${close}&time=${eventTime}`;
      info(`GET ${url}`);
      get(url)
        .catch((err) => {
          error("updatePrice error:", err.toString());
        });

    });
  });

}
async function start() {
  log2File();
  await updatePositions(1);
  await updatePositions(0);
  await updateFuturePositions();

  binance.websockets.userData(balance_update, execution_update);

  for (let scode of g.stocklist) {
    await updateSticks(scode, "1m", 240);
    await updateSticks(scode, "1d", 360);

    await futureCandles(scode, "1m", 240);
    await futureCandles(scode, "1d", 360);
  }

  startFutureMiniTicket();

  //futuresCandlesticksStream
  binance.websockets.candlesticks(g.stocklist, "1m", (candlesticks) => {
    let { e: type, E: time, s: symbol, k: ticks } = candlesticks;
    let { o: open, h: high, l: low, c: close, v: volume, n: trades, i: interval, x: isFinal, q: quoteVolume, V: buyVolume, Q: quoteBuyVolume } = ticks;

    let data = [[timeFormat(time, "yyyyMMddhhmmss"), open, close, high, low, volume, quoteVolume]];
    let url = `${g.baseUrl}/stock/updatePrice?scode=${symbol}&price=${close}&type=0`;
    info(`GET ${url}`);
    get(url)
      .catch((err) => {
        error("updatePrice error:", err.toString());
      });

    if (isFinal) {
      let body = {
        period: "1m",
        scode: symbol,
        data: data
      }
      info(`POST ${g.baseUrl}/stock/k/upload`, JSON.stringify(body));
      post(`${g.baseUrl}/stock/k/upload`, body);

      for (let scode of g.stocklist) {
        updateSticks(scode, "1d", 1);
        updateSticks(scode, "1m", 10);
        futureCandles(scode, "1m", 2);
        futureCandles(scode, "1d", 1);
      }
    }
  });


  while (1 == 1) {
    await getActions();
    await sleep(100);
  }

  return;

}


async function updatePositions(clean) {
  info("updatePositions: clean=", clean);

  let body = { "clean": clean, "passcode": "995560", broker: g.broker };
  if (clean != 1) {

    const response = await client.getBalance();
    console.log('All balances: ', JSON.stringify(response, null, 2));

    let data = [];
    response.details.forEach(
      item => {
        data.push({
          "broker": g.broker,
          "account_id": "",
          "avg_price": 0,
          "can_use_volume": item.availBal,
          "frozen_volume": item.frozenBal,
          "market_value": item.eqUsd,
          "on_road_volume": 0,
          "open_price": 0,
          "stock_code": item.ccy + "USDT",
          "volume": item.spotBal
        });
      }
    )

    body.data = data;
  }
  post(`${g.baseUrl}/stock/positions`, body);
}

async function updateFuturePositions() {
  info("updateFuturePositions");
  let response = await binance.futuresBalance();
  let data = [];
  response.forEach(item => {
    debug(item);
    let { balance: available, asset, availableBalance, maxWithdrawAmount, crossUnPnl } = item;
    available = parseFloat(available);
    if (available <= 0) return;

    data.push({
      "broker": g.broker,
      "account_id": "",
      "avg_price": 0,
      "can_use_volume": availableBalance,
      "frozen_volume": 0,
      "market_value": 0,
      "on_road_volume": 0,
      "open_price": 0,
      "stock_code": asset,
      "volume": available
    });
  });

  let body = { "data": data, "passcode": "995560", type: 1 };
  post(`${g.baseUrl}/stock/positions`, body);
}

async function test1() {
  start();
}

async function futureCandles(stock, period, limit) {
  info(`futureCandles ${stock} ${period} ${limit}`);
  try {
    let count = 0;
    if (period == "1d") {
      timePatten = "yyyyMMdd";
    } else if (period == "1m") {
      timePatten = "yyyyMMddhhmmss";
    }


    let response = await binance.futuresCandles(stock, period, { limit });
    let data = [];
    for (let i = 0; i < response.length; i++) {
      let item = response[i];
      data.push([timeFormat(item.openTime, timePatten), item.open, item.close, item.high, item.low, item.volume, item.quoteAssetVolume]);
      if (data.length == 50) {
        let body = {
          period: period,
          scode: stock,
          type: 1,
          data: data
        };
        await post(`${g.baseUrl}/stock/k/upload`, body);
        count += 50;
        info(`fc upload:${stock}:${period}:${data[0][0]}-${data[data.length - 1][0]} ${count}`);
        data = [];
      }
    }

    if (data.length > 0) {
      let body = {
        period: period,
        scode: stock,
        type: 1,
        data: data
      };
      await post(`${g.baseUrl}/stock/k/upload`, body);
      count += data.length;
      info(`fc upload last:${stock}:${period}:${data[0][0]}-${data[data.length - 1][0]} ${count}`);
    }

  } catch (e) {
    error("futureCandles failed:", e);
  }

}

function init() {
  info(`args:${args}`);
  if (args.length > 2 && args[2] == "dev") {
    dev = 1;
  }

  if (dev) {
    info("env: dev");
    g.baseUrl = "http://localhost:3001";
    g.stocklist = ['ETHUSDT'];
  } else {
    info("env: prod")
  }

  if (args.length > 3) {
    if (args[3].startsWith("socks")) {
      binance.socksProxy = args[3];
    } else if (args[3].startsWith("http")) {
      binance.httpsProxy = args[3];
    }
  }
}

init();

if (dev == 1) {
  test();
} else {
  start();
}



