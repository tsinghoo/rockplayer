// const Binance = require('node-binance-api');
// import Binance from "node-binance-api";
const { json } = require("express");
const Binance = require("node-binance-api");

let DEBUG = 2;
let INFO = 3;
let ERROR = 4;
let logLevel = INFO;


const args = process.argv;
let dev = 0;


const binance = new Binance({
  APIKEY: '5tZbH6hW8lHgS6vNm5Dg8BKMYny1kXZDIqvZWZnqJtz2EQXOOSS2w1PADilLFObe',
  APISECRET: 'Jf8gB0jdZ5A7ACjzqTvxIrj0wvWwjj1scgHsZl8NJpGMFODo0AKv37WNkS1EJ7v3',
  verbose: logLevel <= DEBUG,
  //test: true, // if you want to use the sandbox/testnet
});

// binance.socksProxy = 'socks://192.168.66.1:10800/';
binance.httpsProxy = 'http://192.168.66.205:8080/';
let g = {};
g.broker = "BNB";
g.baseUrl = "http://test1.91taogu.com";
g.actions = [];
g.getActionTimes = 0;
g.stocklist = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'DOGEUSDT'];

function printObjFunc(obj) {
  const allProps = Object.getOwnPropertyNames(obj);
  const functions = allProps.filter(prop => typeof obj[prop] === 'function');

  debug('对象中的函数:');
  functions.forEach(funcName => {
    debug(`- ${funcName}`);
  });

  return functions;
}

async function test() {
  binance.futuresChart('BTCUSDT', '1d', console.log);
  //binance.futuresTickerStream( 'BTCUSDT', console.log );
  //binance.futuresBookTickerStream( 'BTCUSDT', console.log );

  // console.info(await binance.futuresBalance());


  return;
  // let ticker = await binance.prices();
  // console.info(`Price of BNB: ${ticker.BTCUSDT}`);
  let json = { "e": "executionReport", "E": 1760952876443, "s": "DOGEUSDT", "c": "x-B3AUXNYVde3392c077544aa19e949a", "S": "BUY", "o": "LIMIT", "f": "GTC", "q": "8.00000000", "p": "0.20000000", "P": "0.00000000", "F": "0.00000000", "g": -1, "C": "", "x": "TRADE", "X": "FILLED", "r": "NONE", "i": 12538778774, "l": "8.00000000", "z": "8.00000000", "L": "0.20000000", "n": "0.00000107", "N": "BNB", "T": 1760952876441, "t": 1329259740, "I": 26704157948, "w": false, "m": true, "M": true, "O": 1760951855354, "Z": "1.60000000", "Y": "1.60000000", "Q": "0.00000000", "W": 1760951855354, "V": "EXPIRE_MAKER" };

  balance_update(json);

  let response;
  // response = await binance.balance();
  // Object.keys(response).forEach(key => {
  //   if (parseFloat(response[key].available) > 0.000001) {
  //     console.info(`${key}: ${response[key].available}`);
  //   }
  // });

  // response = await binance.bookTickers();
  // console.info(response);

  // response = await binance.trades("BTCUSDT");
  // console.info(response);

  // response = await binance.allOrders("BTCUSDT");
  // console.info(response);

  // response = await binance.prevDay("BTCUSDT");
  // console.log("prevDay()", response);

  // response = await binance.candlesticks("BTCUSDT", "1m");
  // console.log("candlesticks()", response);

  // binance.websockets.candlesticks(['BNBBTC'], "1m", (candlesticks) => {
  //   let { e: eventType, E: eventTime, s: symbol, k: ticks } = candlesticks;
  //   let { o: open, h: high, l: low, c: close, v: volume, n: trades, i: interval, x: isFinal, q: quoteVolume, V: buyVolume, Q: quoteBuyVolume } = ticks;
  //   console.info(symbol + " " + interval + " candlestick update");
  //   console.info("open: " + open);
  //   console.info("high: " + high);
  //   console.info("low: " + low);
  //   console.info("close: " + close);
  //   console.info("volume: " + volume);
  //   console.info("isFinal: " + isFinal);
  // });

  // binance.websockets.miniTicker(markets => {
  //   console.log("miniTicker total:", Object.keys(markets).length);
  //   console.info(markets["BTCUSDT"]);
  // });

  // binance.websockets.bookTickers("BTCUSDT",console.log);

  // binance.depositHistory("VEN",(error, response) => {
  //   console.info(response);
  // });

  // binance.withdrawHistory("BTC",(error, response) => {
  //   console.info(response);
  // });

  // let quantity = 0.00005, price = 100000;
  // response = await binance.buy("BTCUSDT", quantity, price);
  // console.info(response);

  // binance.sell("BTCUSDT", quantity, price);

  // response=await binance.cancelAll("BTCUSDT");
  // console.info(response);

  // response=binance.cancel("BTCUSDT", orderid);
  // console.info(response);


  // response = binance.cancelAll("BTCUSDT");
  // console.info("cancelled:", response);

  binance.websockets.trades(['BNBBTC', 'ETHBTC'], (trades) => {
    let { e: eventType, E: eventTime, s: symbol, p: price, q: quantity, m: maker, a: tradeId } = trades;
    console.info(symbol + " trade update. price: " + price + ", quantity: " + quantity + ", maker: " + maker);
  });
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
function log() {

  let now = timeFormat(new Date(), "yy-MM-dd hh:mm:ss");
  console.log(now, ...arguments);
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


    let response = await binance.candlesticks(stock, period, { limit: limit });
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
        post(`${g.baseUrl}/stock/data/upload`, body);
        data = [];
      }
    }

    let body = {
      period: period,
      scode: stock,
      data: data
    };

    post(`${g.baseUrl}/stock/data/upload`, body);
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

            let response = await binance.buy(act.scode, quantity, price);
            debug(response);
            info("已买入", act.sname, act.scode, act.price, act.amount);

          } else if (act.action === "sell") {
            info("卖出", act.sname, act.scode, act.price, act.amount);
            info("卖出", price, quantity);
            let response = await binance.sell(act.scode, quantity, price);
            debug(response);
            info("已卖出", act.sname, act.scode, act.price, act.amount);
          } else if (act.action === "reloadK1d") {
            info("reloadK1d action for", act.scode);
          } else if (act.action === "cancelAction") {
            info("cancel action for", act.scode);

            response = await binance.cancelAll(act.scode);
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
      let url = g.baseUrl + "/stock/deal/update"

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

      let body = deal;
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
      info("futureMiniTicket:", JSON.stringify(item));
      let { symbol, close, high, low, open, volume, quoteVolume, eventTime } = item;

      get(`${g.baseUrl}/stock/updatePrice/option?scode=${symbol}&price=${close}&time=${eventTime}`)
        .catch((err) => {
          error("updatePrice error:", err.toString());
        });

    });
  });

}
async function start() {
  await updatePositions(1);
  await updatePositions(0);
  await updateFuturePositions();

  binance.websockets.userData(balance_update, execution_update);

  for (let scode of g.stocklist) {
    await updateSticks(scode, "1m", 240);
    await updateSticks(scode, "1d", 30);

    await futureCandles(scode, "1m", 240);
    await futureCandles(scode, "1d", 30);
  }

  startFutureMiniTicket();

  //futuresCandlesticksStream
  binance.websockets.candlesticks(g.stocklist, "1m", (candlesticks) => {
    let { e: type, E: time, s: symbol, k: ticks } = candlesticks;
    let { o: open, h: high, l: low, c: close, v: volume, n: trades, i: interval, x: isFinal, q: quoteVolume, V: buyVolume, Q: quoteBuyVolume } = ticks;

    let data = [[timeFormat(time, "yyyyMMddhhmmss"), open, close, high, low, volume, quoteVolume]];

    get(`${g.baseUrl}/stock/updatePrice?scode=${symbol}&price=${close}&type=0`)
      .catch((err) => {
        error("updatePrice error:", err.toString());
      });

    if (isFinal) {
      let body = {
        period: "1m",
        scode: symbol,
        data: data
      }

      post(`${g.baseUrl}/stock/data/upload`, body);

      for (let scode of g.stocklist) {
        updateSticks(scode, "1d", 1);
        updateSticks(scode, "1m", 10);
        futureCandles(scode, "1m", 2);
        futureCandles(scode, "1d", 1);
      }
    }
  });

  while (1 == 1) {
    //await getActions();
    await sleep(100);
  }

  return;

}


async function updatePositions(clean) {
  info("updatePositions: clean=", clean);

  let body = { "clean": clean, "passcode": "995560", broker: g.broker };
  if (clean != 1) {
    let response = await binance.balance();

    let data = [];
    Object.keys(response).forEach(key => {
      let { available, onOrder } = response[key];
      available = parseFloat(available);
      if (available <= 0 && parseFloat(onOrder) <= 0) return;
      info(key, JSON.stringify(response[key]));
      data.push({
        "broker": g.broker,
        "account_id": "",
        "avg_price": 0,
        "can_use_volume": available,
        "frozen_volume": 0,
        "market_value": 0,
        "on_road_volume": 0,
        "open_price": 0,
        "stock_code": key + "USDT",
        "volume": available
      });
    });
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
  // await futureCandles("ETHUSDT", "1m", 400);
  // await futureCandles("ETHUSDT", "1d", 400);
  //updateOptionSticks("1m", 70);
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
        await post(`${g.baseUrl}/stock/data/upload`, body);
        count += 50;
        info(`uploaded:${data[0][0]}-${data[data.length - 1][0]} ${count}`);
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
      await post(`${g.baseUrl}/stock/data/upload`, body);
      count += data.length;
      info(`uploaded:${data[0][0]}-${data[data.length - 1][0]} ${count}`);
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
}

init();

if (dev == 1) {
  test1();
} else {
  start();
}



