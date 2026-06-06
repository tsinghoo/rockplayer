// const Binance = require('node-binance-api');
// import Binance from "node-binance-api";
const { json } = require("express");
const { Alpha, ALPHA_REST_API_PROD_URL } = require("@binance/alpha");
const Binance = require("node-binance-api");
const fs = require("fs");
let DEBUG = 2;
let INFO = 3;
let ERROR = 4;
let logLevel = process.env.LOG_LEVEL;


const args = process.argv;
let dev = 0;


const binance = new Binance({
  APIKEY: process.env.BnbAPIKEY,
  APISECRET: process.env.BnbAPISECRET,
  verbose: logLevel <= DEBUG,
  //test: true, // if you want to use the sandbox/testnet
});
const alpha = new Alpha({
  configurationRestAPI: {
    apiKey: process.env.BnbAPIKEY || "",
    apiSecret: process.env.BnbAPISECRET || "",
    basePath: process.env.BNB_ALPHA_BASE_URL || ALPHA_REST_API_PROD_URL
  }
});

// binance.socksProxy = 'socks://192.168.66.1:10800/';
binance.httpsProxy = process.env.HTTP_PROXY;
let g = {};
g.broker = "BNB";
g.baseUrl = "http://152.136.244.225";
g.baseUrl = "http://192.168.1.6:3001";
g.doneActionIds = new Set();
g.getActionTimes = 0;
g.stocklist = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'];
// g.stocklist = ['BTCUSDT'];
g.futuresPositionMode = null;
g.lastFuturesPositionModeSync = 0;
g.alphaBaseUrl = process.env.BNB_ALPHA_BASE_URL || ALPHA_REST_API_PROD_URL;
g.alphaDiscoveryKeywords = (process.env.BNB_ALPHA_STOCK_KEYWORDS || "stock,us stock,equity").split(",").map(item => item.trim().toLowerCase()).filter(Boolean);
g.alphaTokenMap = {};
g.alphaSymbols = new Set();
g.alphaPrice = {};
g.lastAlphaMetaLoad = 0;

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

function buildUrl(baseUrl, path, params) {
  let url = new URL(path, baseUrl);
  if (params) {
    Object.keys(params).forEach(key => {
      if (params[key] != null && params[key] !== "") {
        url.searchParams.set(key, params[key]);
      }
    });
  }
  return url.toString();
}

async function requestJson(url, options) {
  let response = await fetch(url, options);
  let text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (e) {
    error("requestJson parse fail:", url, text);
  }

  if (!response.ok) {
    throw new Error(`${response.status} ${text}`);
  }

  return data;
}

async function getAlphaSdkData(methodName, params) {
  if (!alpha || !alpha.restAPI || typeof alpha.restAPI[methodName] !== "function") {
    throw new Error(`@binance/alpha method not found: ${methodName}`);
  }

  let response = await alpha.restAPI[methodName](params || {});
  if (response == null) {
    return null;
  }

  if (typeof response.data === "function") {
    return await response.data();
  }

  if (typeof response.data !== "undefined") {
    return response.data;
  }

  return response;
}

function normalizeAlphaSymbol(scode) {
  if (!scode) {
    return "";
  }
  return `${scode}`.trim().toUpperCase();
}

function isAlphaSymbol(scode) {
  let symbol = normalizeAlphaSymbol(scode);
  return symbol.startsWith("A_") || g.alphaSymbols.has(symbol);
}

function toAlphaLookupKey(scode) {
  let symbol = normalizeAlphaSymbol(scode);
  if (symbol.startsWith("A_")) {
    symbol = symbol.substring(2);
  }
  return symbol;
}

function toAlphaScode(meta) {
  if (!meta) {
    return "";
  }

  let code = meta.symbol || meta.code || meta.baseAsset || meta.asset || meta.tokenSymbol || meta.displaySymbol || meta.name || "";
  code = `${code}`.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!code) {
    return "";
  }
  return `A_${code}`;
}

function getAlphaTradeSymbol(meta, fallbackScode) {
  if (meta == null) {
    return toAlphaLookupKey(fallbackScode);
  }

  let candidates = [
    meta.alphaTradeSymbol,
    meta.tradeSymbol,
    meta.symbol,
    meta.pair,
    meta.code,
    meta.tokenSymbol
  ];

  for (let item of candidates) {
    if (item == null) continue;
    item = `${item}`.trim();
    if (item !== "") {
      return item;
    }
  }

  return toAlphaLookupKey(fallbackScode);
}

function pickAlphaMarketText(meta) {
  let texts = [];
  if (meta == null) {
    return "";
  }

  Object.keys(meta).forEach(key => {
    let value = meta[key];
    if (value == null) return;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      texts.push(`${value}`.toLowerCase());
    }
  });

  return texts.join(" ");
}

function looksLikeAlphaStockToken(meta) {
  let text = pickAlphaMarketText(meta);
  if (!text) {
    return false;
  }

  return g.alphaDiscoveryKeywords.some(keyword => text.indexOf(keyword) >= 0);
}

async function ensureAlphaTokenMeta(force) {
  let now = Date.now();
  if (!force && g.lastAlphaMetaLoad > 0 && now - g.lastAlphaMetaLoad < 10 * 60 * 1000 && Object.keys(g.alphaTokenMap).length > 0) {
    return g.alphaTokenMap;
  }

  try {
    let response = await getAlphaSdkData("tokenList");
    let items = [];
    if (Array.isArray(response)) {
      items = response;
    } else if (response && Array.isArray(response.data)) {
      items = response.data;
    } else if (response && response.data && Array.isArray(response.data.tokens)) {
      items = response.data.tokens;
    } else if (response && response.data && Array.isArray(response.data.list)) {
      items = response.data.list;
    }

    let nextMap = {};
    let nextSymbols = new Set();
    for (let item of items) {
      if (!looksLikeAlphaStockToken(item)) {
        continue;
      }

      let scode = toAlphaScode(item);
      if (!scode) {
        continue;
      }

      nextMap[scode] = item;
      nextSymbols.add(scode);

      let raw = getAlphaTradeSymbol(item, scode);
      nextSymbols.add(normalizeAlphaSymbol(raw));
      nextSymbols.add(`A_${normalizeAlphaSymbol(raw)}`);
    }

    g.alphaTokenMap = nextMap;
    g.alphaSymbols = nextSymbols;
    g.lastAlphaMetaLoad = now;
    info("alpha token meta loaded:", Object.keys(nextMap).join(","));
  } catch (e) {
    error("ensureAlphaTokenMeta failed:", e.toString());
  }

  return g.alphaTokenMap;
}

function getAlphaMetaByScode(scode) {
  let key = normalizeAlphaSymbol(scode);
  if (g.alphaTokenMap[key]) {
    return g.alphaTokenMap[key];
  }

  let compact = `A_${toAlphaLookupKey(scode)}`;
  return g.alphaTokenMap[compact];
}

function mapPeriodToAlpha(period) {
  if (period == "1m") return "1m";
  if (period == "1d") return "1d";
  throw new Error(`unsupported alpha period ${period}`);
}

async function getAlphaKlines(scode, period, limit) {
  await ensureAlphaTokenMeta();
  let meta = getAlphaMetaByScode(scode);
  let symbol = getAlphaTradeSymbol(meta, scode);
  let interval = mapPeriodToAlpha(period);
  let response = await getAlphaSdkData("klines", {
    symbol,
    interval,
    limit
  });
  if (Array.isArray(response)) {
    return response;
  }
  if (response && Array.isArray(response.data)) {
    return response.data;
  }
  if (response && response.data && Array.isArray(response.data.klines)) {
    return response.data.klines;
  }
  if (response && response.data && Array.isArray(response.data.list)) {
    return response.data.list;
  }
  return [];
}

function parseAlphaKline(item) {
  if (Array.isArray(item)) {
    return {
      openTime: parseInt(item[0]),
      open: item[1],
      high: item[2],
      low: item[3],
      close: item[4],
      volume: item[5],
      quoteAssetVolume: item[7] || item[6] || 0
    };
  }

  return {
    openTime: parseInt(item.openTime || item.t || item.time || item[0]),
    open: item.open || item.o || item[1],
    high: item.high || item.h || item[2],
    low: item.low || item.l || item[3],
    close: item.close || item.c || item[4],
    volume: item.volume || item.v || item[5],
    quoteAssetVolume: item.quoteAssetVolume || item.q || item[7] || item[6] || 0
  };
}

async function updateAlphaPrice(scode) {
  try {
    await ensureAlphaTokenMeta();
    let meta = getAlphaMetaByScode(scode);
    let tradeSymbol = getAlphaTradeSymbol(meta, scode);
    let response = await getAlphaSdkData("ticker", { symbol: tradeSymbol });
    let ticker = response;
    if (response && Array.isArray(response.data) && response.data.length > 0) {
      ticker = response.data[0];
    } else if (Array.isArray(response) && response.length > 0) {
      ticker = response[0];
    }

    if (ticker == null) {
      return;
    }

    let price = parseFloat(ticker.lastPrice || ticker.price || ticker.close || ticker.c);
    if (!Number.isFinite(price)) {
      return;
    }
    let updateTime = parseInt(ticker.closeTime || ticker.time || ticker.ts || Date.now());

    let symbol = normalizeAlphaSymbol(scode);
    let prev = g.alphaPrice[symbol];
    if (prev != null && prev.price === price && Date.now() - prev.time < 1000) {
      return;
    }

    g.alphaPrice[symbol] = {
      price,
      time: Date.now()
    };

    let url = `${g.baseUrl}/stock/updatePrice?scode=${symbol}&price=${price}&time=${updateTime}&type=0`;
    await get(url);
  } catch (e) {
    error("updateAlphaPrice failed:", scode, e.toString());
  }
}

async function syncAlphaTickers() {
  await ensureAlphaTokenMeta();
  let symbols = Object.keys(g.alphaTokenMap);
  for (let scode of symbols) {
    await updateAlphaPrice(scode);
  }
}

async function getKLastDate(scode, period) {
  try {
    let route;
    let field;
    if (period == "1d") {
      route = "1d/lastDate";
      field = "lastDate";
    } else if (period == "1m") {
      route = "1m/lastMinute";
      field = "lastMinute";
    } else {
      error("getKLastDate unsupported period:", period);
      return null;
    }

    let response = await get(`${g.baseUrl}/stock/${route}?scode=${scode}`);
    if (!response.ok) {
      error("getKLastDate failed:", response.status);
      return null;
    }

    let content = await response.text();
    debug("getKLastDate:", content);
    let json = JSON.parse(content);
    return json[field];
  } catch (e) {
    error("getKLastDate failed:", e.toString());
    return null;
  }
}

function parseTimeByPeriod(value, period) {
  if (!value) {
    return null;
  }
  if (period == "1d") {
    return new Date(
      parseInt(value.substring(0, 4)),
      parseInt(value.substring(4, 6)) - 1,
      parseInt(value.substring(6, 8)),
      0,
      0,
      0,
      0
    );
  }
  if (period == "1m") {
    return new Date(
      parseInt(value.substring(0, 4)),
      parseInt(value.substring(4, 6)) - 1,
      parseInt(value.substring(6, 8)),
      parseInt(value.substring(8, 10)),
      parseInt(value.substring(10, 12)),
      parseInt(value.substring(12, 14)),
      0
    );
  }

  return null;
}

async function resolveStickLimit(stock, period, limit) {
  if (limit != null) {
    return limit;
  }

  let defaultLimit = period == "1d" ? 360 : 240;
  let lastDate = await getKLastDate(stock, period);
  info(`lastDate ${stock} ${period}:`, lastDate);
  let lastTime = parseTimeByPeriod(lastDate, period);
  if (lastTime == null) {
    return defaultLimit;
  }

  let now = new Date();
  let diffMs = now.getTime() - lastTime.getTime();
  if (diffMs <= 0) {
    return 1;
  }

  if (period == "1d") {
    return Math.max(1, Math.ceil(diffMs / (24 * 60 * 60 * 1000)) + 1);
  }
  if (period == "1m") {
    return Math.max(1, Math.ceil(diffMs / (60 * 1000)) + 1);
  }

  return defaultLimit;
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
    limit = await resolveStickLimit(stock, period, limit);
    info(`updateSticks resolved limit ${stock} ${period} ${limit}`);
    let isAlpha = isAlphaSymbol(stock);
    let uploadScode = normalizeAlphaSymbol(stock);
    if (period == "1d") {
      timePatten = "yyyyMMdd";
    } else if (period == "1m") {
      timePatten = "yyyyMMddhhmmss";
    }

    let response;
    if (isAlpha) {
      response = await getAlphaKlines(stock, period, limit);
    } else {
      response = await binance.candlesticks(stock, period, { limit: limit });
    }
    let data = [];
    for (let i = 0; i < response.length; i++) {
      let item = isAlpha ? parseAlphaKline(response[i]) : response[i];
      data.push([timeFormat(item.openTime, timePatten), item.open, item.close, item.high, item.low, item.volume, item.quoteAssetVolume]);
      if (data.length == 50) {
        let body = {
          period: period,
          scode: uploadScode,
          data: data
        };
        post(`${g.baseUrl}/stock/k/upload`, body);
        data = [];
      }
    }

    let body = {
      period: period,
      scode: uploadScode,
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
    await ensureAlphaTokenMeta();
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
      let actionId = String(act.id);

      if (g.doneActionIds.has(actionId)) {
        info("action已执行过，跳过", act.id, act.scode);
        continue;
      }
      try {
        let isFuture = act.scode.startsWith("O_");
        let isAlpha = isAlphaSymbol(act.scode);
        let tradeSymbol = isFuture ? act.scode.substring(2) : act.scode;
        let dotNums = {
          "BTCUSDT": 100000,
          "ETHUSDT": 10000,
          "BNBUSDT": 1000,
          "DOGEUSDT": 1
        };
        if (isFuture) {
          await syncFuturesPositionMode();
        }
        let ratio = dotNums[tradeSymbol];
        if (ratio == null) {
          ratio = 1000;
        }
        let price = parseFloat(act.price);
        if (price < 1) {
          price = price.toFixed(5);
        } else {
          price = price.toFixed(2);
        }
        let quantity = Math.floor(parseFloat(act["amount"]) * ratio) / ratio;
        if (act.action === "buy") {
          if (isAlpha) {
            info("skip alpha trade action", act.action, act.scode, act.price, act.amount);
          } else {
            info("买入", act.sname, act.scode, act.price, act.amount);
            info("买入", price, quantity);

            let response;
            if (isFuture) {
              response = await placeFutureOrder("BUY", tradeSymbol, quantity, price);
            } else {
              response = await binance.buy(tradeSymbol, quantity, price);
            }
            debug(response);
            info("已买入", act.sname, act.scode, act.price, act.amount);
          }
        } else if (act.action === "sell") {
          if (isAlpha) {
            info("skip alpha trade action", act.action, act.scode, act.price, act.amount);
          } else {
            info("卖出", act.sname, act.scode, act.price, act.amount);
            info("卖出", price, quantity);

            let response;
            if (isFuture) {
              response = await placeFutureOrder("SELL", tradeSymbol, quantity, price);
            } else {
              response = await binance.sell(tradeSymbol, quantity, price);
            }
            debug(response);
            info("已卖出", act.sname, act.scode, act.price, act.amount);
          }
        } else if (act.action === "setLeverage" || act.action === "changeLeverage" || act.action === "updateLeverage") {
          if (!isFuture) {
            throw new Error(`set leverage only supports futures symbol: ${act.scode}`);
          }

          let leverage = parseInt(act.amount, 10);
          if (!Number.isInteger(leverage) || leverage <= 0) {
            leverage = parseInt(act.price, 10);
          }
          if (!Number.isInteger(leverage) || leverage <= 0) {
            throw new Error(`invalid leverage: amount=${act.amount}, price=${act.price}`);
          }

          info("调整杠杆", act.sname, act.scode, leverage);
          let response = await binance.futuresLeverage(tradeSymbol, leverage);
          debug(response);
          info("已调整杠杆", act.sname, act.scode, leverage);
        } else if (act.action === "reloadK1d") {
          info("reloadK1d action for", act.scode);
        } else if (act.action === "cancelAction") {
          if (isAlpha) {
            info("skip alpha trade action", act.action, act.scode, act.price, act.amount);
          } else {
            info("cancel action for", act.scode);
            let response;
            if (isFuture) {
              response = await binance.futuresCancelAll(tradeSymbol);
            } else {
              response = await binance.cancelAll(tradeSymbol);
            }
            debug("cancelAll response:" + response);
          }
        }
      } catch (e) {
        error(act.action, act.scode, "fail:", e);
      } finally {
        g.doneActionIds.add(actionId);
        actionDone(act.id);
      }
    }

  } catch (err) {
    error("getActions出错:", err.toString());
  }
}

async function syncFuturesPositionMode(force) {
  let now = Date.now();
  if (!force && g.lastFuturesPositionModeSync > 0 && (now - g.lastFuturesPositionModeSync) < 60 * 1000) {
    return g.futuresPositionMode;
  }

  try {
    let response = await binance.futuresPositionSideDual();
    let dualSidePosition = response && (response.dualSidePosition === true || response.dualSidePosition === "true");
    g.futuresPositionMode = dualSidePosition ? "HEDGE" : "ONE_WAY";
    g.lastFuturesPositionModeSync = now;
    //binance.options({ hedgeMode: dualSidePosition });
    info("Binance futures position mode:", g.futuresPositionMode);
  } catch (e) {
    error("syncFuturesPositionMode fail:", e.toString());
  }

  return g.futuresPositionMode;
}

async function placeFutureOrder(side, symbol, quantity, price) {
  let params = {};
  if (g.futuresPositionMode === "HEDGE") {
    params.positionSide = side === "BUY" ? "LONG" : "SHORT";
  }

  if (side === "BUY") {
    return await binance.futuresBuy(symbol, quantity, price, params);
  }
  return await binance.futuresSell(symbol, quantity, price, params);
}

async function actionDone(id) {
  try {
    const url = g.baseUrl + "/stock/action/done?id=" + id;
    info(`GET ${url}`)
    const response = await fetch(url, {
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
  g.stocklist.filter(element => !isAlphaSymbol(element)).forEach(element => {
    binance.futuresMiniTickerStream(element, item => {
      let { symbol, close, high, low, open, volume, quoteVolume, eventTime } = item;
      let url = `${g.baseUrl}/stock/updatePrice?scode=O_${symbol}&price=${close}&time=${eventTime}`;
      get(url)
        .catch((err) => {
          error("updatePrice error:", err.toString());
        });
    });
  });

}
async function start() {
  log2File();
  await ensureAlphaTokenMeta();
  let marketSymbols = g.stocklist.filter(scode => !isAlphaSymbol(scode));
  await syncFuturesPositionMode(1);
  await updatePositions(1);
  await updatePositions(0);
  await updateFuturePositions();

  binance.websockets.userData(balance_update, execution_update);

  for (let scode of g.stocklist) {
    await updateSticks(scode, "1m");
    await updateSticks(scode, "1d");

    if (!isAlphaSymbol(scode)) {
      await futureCandles(scode, "1m");
      await futureCandles(scode, "1d");
    }
  }

  await syncAlphaTickers();

  startFutureMiniTicket();

  //futuresCandlesticksStream
  binance.websockets.candlesticks(marketSymbols, "1m", (candlesticks) => {
    let { e: type, E: time, s: symbol, k: ticks } = candlesticks;
    let { o: open, h: high, l: low, c: close, v: volume, n: trades, i: interval, x: isFinal, q: quoteVolume, V: buyVolume, Q: quoteBuyVolume } = ticks;

    let data = [[timeFormat(time, "yyyyMMddhhmmss"), open, close, high, low, volume, quoteVolume]];
    let url = `${g.baseUrl}/stock/updatePrice?scode=${symbol}&price=${close}&type=0`;
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
        updateSticks(scode, "1d");
        updateSticks(scode, "1m");
        if (!isAlphaSymbol(scode)) {
          futureCandles(scode, "1m");
          futureCandles(scode, "1d");
        }
      }
    }
  });


  while (1 == 1) {
    await getActions();
    await syncAlphaTickers();
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
  start();
}

async function futureCandles(stock, period, limit) {
  info(`futureCandles ${stock} ${period} ${limit}`);
  try {
    limit = await resolveStickLimit(`O_${stock}`, period, limit);
    info(`updateSticks resolved limit O_${stock} ${period} ${limit}`);
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
          scode: `O_${stock}`,
          type: 1,
          data: data
        };
        await post(`${g.baseUrl}/stock/k/upload`, body);
        count += 50;
        info(`fc upload:O_${stock}:${period}:${data[0][0]}-${data[data.length - 1][0]} ${count}`);
        data = [];
      }
    }

    if (data.length > 0) {
      let body = {
        period: period,
        scode: `O_${stock}`,
        type: 1,
        data: data
      };
      await post(`${g.baseUrl}/stock/k/upload`, body);
      count += data.length;
      info(`fc upload last:O_${stock}:${period}:${data[0][0]}-${data[data.length - 1][0]} ${count}`);
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

  if (process.env.BNB_STOCKLIST) {
    g.stocklist = process.env.BNB_STOCKLIST.split(",").map(item => item.trim()).filter(Boolean);
  }

  if (process.env.BNB_ALPHA_STOCKLIST) {
    let alphaStocks = process.env.BNB_ALPHA_STOCKLIST.split(",").map(item => item.trim()).filter(Boolean).map(item => item.startsWith("A_") ? item.toUpperCase() : `A_${item.toUpperCase()}`);
    g.stocklist = g.stocklist.concat(alphaStocks);
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
  test1();
} else {
  start();
}
