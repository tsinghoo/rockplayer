// const Binance = require('node-binance-api');
// import Binance from "node-binance-api";
const Binance = require("node-binance-api");


const binance = new Binance({
  APIKEY: 'zN75a6JuEP3jaffhC3LiCbjsHbMcgrW9MWQX4HqjUXKiVqXt9iRwMYPDfykCUEz1',
  APISECRET: 'JV3y11RJ6Jgy5S0VPN58neQTD7AlvrVVv12cgsoxmEYwkMXrE9fheibFmryFQ95E',
  verbose: true,
  //test: true, // if you want to use the sandbox/testnet
});

// binance.socksProxy = 'socks://192.168.66.1:10800/';
binance.httpsProxy = 'http://192.168.66.205:8080/';
let g = {};
g.broker = "BNB";
g.baseUrl = "http://localhost:3001";


function printObjFunc(obj) {
  const allProps = Object.getOwnPropertyNames(obj);
  const functions = allProps.filter(prop => typeof obj[prop] === 'function');

  console.log('对象中的函数:');
  functions.forEach(funcName => {
    console.log(`- ${funcName}`);
  });

  return functions;
}

async function test() {
  // let ticker = await binance.prices();
  // console.info(`Price of BNB: ${ticker.BTCUSDT}`);

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
  info(`POST ${url}:${JSON.stringify(body, null, 2)}`);
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
  }).then(data => {

  }).catch(error => {
    console.error('上传失败:', JSON.stringify(body), error);
  });

}
function info(msg) {
  console.log(msg);
}

async function updateSticks(stock, period, limit) {

  if (period == "1d") {
    timePatten = "yyyyMMdd";
  }else if (period == "1m") {
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
}


async function start() {
  await updateSticks("BTCUSDT", "1d", 400);
  await updateSticks("ETHUSDT", "1d", 400);
  await updateSticks("BTCUSDT", "1m", 400);
  await updateSticks("ETHUSDT", "1m", 400);

  return;
  binance.websockets.candlesticks(['BTCUSDT', 'ETHUSDT'], "1m", (candlesticks) => {
    let { e: type, E: time, s: symbol, k: ticks } = candlesticks;
    let { o: open, h: high, l: low, c: close, v: volume, n: trades, i: interval, x: isFinal, q: quoteVolume, V: buyVolume, Q: quoteBuyVolume } = ticks;

    let data = [[timeFormat(time, "yyyyMMddhhmmss"), open, close, high, low, volume, quoteVolume]];
    if (isFinal) {
      let body = {
        period: "1m",
        scode: symbol,
        data: data
      }

      post(`${g.baseUrl}/stock/data/upload`, body);
    } else {
      info(timeFormat(time, "yyyyMMddhhmmss") + ":" + symbol);
    }

  });

}

start();


