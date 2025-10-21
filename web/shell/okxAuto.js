
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


function convertIfInteger(number, fixed) {
  if (isNaN(number) || isNaN(parseFloat(number))) {
    return number;
  }

  if (fixed == null) {
    fixed = 3;
  }
  number = parseFloat(parseFloat(number).toFixed(fixed));
  if (Number.isInteger(number)) {
    return parseInt(number); // 或者 Math.trunc(number)
  }

  return number; // 保持原值
}

https://www.okx.com/priapi/v5/trade/order?t=1761048384060
{"instId":"DOOD-USDT","tdMode":"cash","_feReq":true,"isTradeBorrowMode":false,"side":"buy","ordType":"limit","tradeQuoteCcy":"USDT","px":"0.0062","sz":"161.2","assetNeedTransfer":"0.99944","orderValue":"0.9994400000000000","_fetchSource":"PLACE_ORDER"}





function config() {
  console.log(`window.bnb=${JSON.stringify(window.bnb, null, 2)}`);
}

async function doBuyAndSell(amount, buyPrice, sellPrice, notTest) {
  let quantity = amount / buyPrice;
  quantity = Math.floor(quantity * 100) / 100;

  let url = "https://www.binance.com/bapi/asset/v1/private/alpha-trade/oto-order/place"; //post

  buyPrice = convertIfInteger(buyPrice, 8);
  sellPrice = convertIfInteger(sellPrice, 8);
  amount = quantity * buyPrice;
  amount = Math.floor(amount * 100000000) / 100000000;
  const json = {
    "baseAsset": window.bnb.stocks[window.bnb.stock.toLowerCase()],
    "quoteAsset": "USDT",
    "workingSide": "BUY",
    "workingPrice": buyPrice,
    "workingQuantity": quantity,
    "paymentDetails":
      [{ "amount": amount, "paymentWalletType": "CARD" }],
    "pendingPrice": sellPrice
  };

  console.log(JSON.stringify(json, null, 2));
  if (window.bnb.maxDelta == null) {
    window.bnb.maxDelta = 0.0001;
  }
  if (sellPrice - buyPrice > window.bnb.maxDelta) {
    console.log("价格差异超过最大允许值", window.bnb.maxDelta);
    return;
  }

  if (notTest) {
    // 发送 POST 请求
    console.log("POST to " + url);
    window.bnb.quantity = quantity;
    fetch(url, {
      method: 'POST',
      headers: window.bnb.lqhHeaders,
      body: JSON.stringify(json)
    })
      .then(response => {
        if (!response.ok) {
          throw new Error('网络响应不正常');
        }
        return response.text();
      })
      .then(data => {
        let resp = JSON.parse(data);
        if (resp.code == "000000") {
          window.bnb.orderId = [resp.data.workingOrderId, resp.data.pendingOrderId];
          console.log("订单创建成功", window.bnb.orderId);
        } else {
          console.log("订单创建失败", resp.message);
        }
      })
      .catch(error => {
        console.error('请求失败:', error);
      });
  }
}
async function doBuy(amount, buyPrice, notTest) {
  let quantity = amount / buyPrice;
  quantity = Math.floor(quantity * 100) / 100;

  let url = "https://www.binance.com/bapi/asset/v1/private/alpha-trade/order/place"; //post

  buyPrice = convertIfInteger(buyPrice, 8);
  amount = quantity * buyPrice;
  amount = Math.floor(amount * 100000000) / 100000000;

  const json = {
    "baseAsset": window.bnb.stocks[window.bnb.stock.toLowerCase()],
    "quoteAsset": "USDT",
    "side": "BUY",
    "price": buyPrice,
    "quantity": quantity,
    "paymentDetails":
      [{ "amount": amount, "paymentWalletType": "CARD" }]
  };

  console.log(JSON.stringify(json, null, 2));

  if (notTest) {
    // 发送 POST 请求
    console.log("POST to " + url);
    window.bnb.quantity = quantity;
    fetch(url, {
      method: 'POST',
      headers: window.bnb.lqhHeaders,
      body: JSON.stringify(json)
    })
      .then(response => {
        if (!response.ok) {
          throw new Error('网络响应不正常');
        }
        return response.text();
      })
      .then(data => {
        let resp = JSON.parse(data);
        if (resp.code == "000000") {
          window.bnb.orderId = [0, resp.data];
          console.log("订单创建成功", window.bnb.orderId);
        } else {
          console.log("订单创建失败", resp.message);
        }
      })
      .catch(error => {
        console.error('请求失败:', error);
      });
  }
}

async function sell(sellPrice, quantity, notTest) {
  //{"baseAsset":"ALPHA_368","quoteAsset":"USDT",
  // "side":"SELL","price":0.12735,"quantity":2351.57,"paymentDetails":[{"amount":2351.57,"paymentWalletType":"ALPHA"}]}
  if (quantity == 0) {
    quantity = window.bnb.quantity * (1 - 1 / 10000);
  }

  quantity = Math.floor(quantity * 100) / 100;
  let url = "https://www.binance.com/bapi/asset/v1/private/alpha-trade/order/place"; //post
  let pprice = sellPrice;
  pprice = convertIfInteger(pprice, 8);
  const json = {
    "baseAsset": window.bnb.stocks[window.bnb.stock.toLowerCase()],
    "quoteAsset": "USDT",
    "side": "SELL",
    "price": pprice,
    "quantity": quantity,
    "paymentDetails":
      [{ "amount": quantity, "paymentWalletType": "ALPHA" }]
  };

  console.log(JSON.stringify(json, null, 2));

  if (notTest) {
    // 发送 POST 请求
    console.log("POST to " + url);
    fetch(url, {
      method: 'POST',
      headers: window.bnb.lqhHeaders,
      body: JSON.stringify(json)
    })
      .then(response => {
        if (!response.ok) {
          throw new Error('网络响应不正常');
        }
        return response.text();
      })
      .then(data => {
        let resp = JSON.parse(data);
        if (resp.code == "000000") {
          window.bnb.orderId = [0, resp.data];
          console.log("订单创建成功", window.bnb.orderId);
        } else {
          console.log("订单创建失败", resp.message);
        }
      })
      .catch(error => {
        console.error('请求失败:', error);
      });
  }


}

async function buyMax(amount, notTest) {
  let { min, max } = getMinMaxPriceFromUi(1);
  doBuy(amount, max, notTest);
}
async function buyMaxSellMin(amount, notTest) {
  let e;
  bnb.running = true;
  while (bnb.running && e == null) {
    infoRed("running");
    e = getMinMaxPriceFromUi(1);

    if (e == null) {
      await sleep(1000);
    }
  }

  if (e == null) {
    infoRed("cancelled");
  } else {
    infoRed("toBuy");
    
    let { min, max } = e;
    doBuyAndSell(amount, max + window.bnb.buyDelta, min - window.bnb.sellDelta, notTest);
  }
}

async function cancel(i) {
  let url = "https://www.binance.com/bapi/defi/v1/private/alpha-trade/order/cancel"; //post
  const json = { "orderId": window.bnb.orderId[i], "symbol": window.bnb.stocks[window.bnb.stock.toLowerCase()] + "USDT" };

  console.log(JSON.stringify(json, null, 2));

  // 发送 POST 请求
  fetch(url, {
    method: 'POST',
    headers: window.bnb.lqhHeaders,
    body: JSON.stringify(json)
  })
    .then(response => {
      if (!response.ok) {
        throw new Error('网络响应不正常');
      }
      return response.text();
    })
    .then(data => {
      console.log("response:" + data);
      let resp = JSON.parse(data);

    })
    .catch(error => {
      console.error('请求失败:', error);
    });

  await sleep(1000);
  sellAll();
}



async function cancelAll() {
  bnb.running = false;

  let url = "https://www.binance.com/bapi/defi/v1/private/alpha-trade/order/cancel-all"; //post
  const json = {};

  console.log(JSON.stringify(json, null, 2));

  // 发送 POST 请求
  fetch(url, {
    method: 'POST',
    headers: window.bnb.lqhHeaders,
    body: JSON.stringify(json)
  })
    .then(response => {
      if (!response.ok) {
        throw new Error('网络响应不正常');
      }
      return response.text();
    })
    .then(data => {
      console.log("response:" + data);
      let resp = JSON.parse(data);

    })
    .catch(error => {
      console.error('请求失败:', error);
    });

}


function sellAll() {
  let { min, max } = getMinMaxPriceFromUi();
  sell(min - window.bnb.delta, 0, 1);
}

function infoRed(info) {
  console.log(`%c${info}`, 'color: red;');
}
function info(info) {
  console.log(info);
}

function getMinMaxPriceFromUi(stopOnLatency) {
  let peles = document.querySelectorAll(".text-PrimaryText .ReactVirtualized__Grid__innerScrollContainer .items-center > :first-child");
  let timeStr = peles[0].innerText;
  const today = new Date();
  const now = today.getTime();
  const [hours, minutes, seconds] = timeStr.split(':');
  today.setHours(hours, minutes, seconds, 0);
  let latency = now - today.getTime();
  info(`延迟${latency / 1000}s`);
  if (latency > 2 * 1000) {
    infoRed(`时间延迟${latency / 1000}s超过2秒`);
    if (stopOnLatency)
      return null;
  }

  peles = document.querySelectorAll(".text-PrimaryText .ReactVirtualized__Grid__innerScrollContainer .items-center .cursor-pointer");
  let min = 0, max = 0, maxi = 0, mini = 0;
  for (let i = 0; i < 3; i++) {
    let pe = peles[i];
    let text = pe.innerText;
    let cp = parseFloat(text);
    if (i == 0) {
      min = cp;
      max = cp;
    } else {
      if (cp > max) {
        max = cp;
        maxi = i;
      }
      if (cp < min) {
        min = cp;
        mini = i;
      }

    }
  }

  console.log("min:", min);
  console.log("max:", max);

  if (max - min > window.bnb.delta / 10) {
    infoRed(`价差超过${window.bnb.delta / 10}`);
    if (stopOnLatency && 1==0)
      return null;
  }

  if (maxi > mini) {
    infoRed(`下降通道`);
    if (stopOnLatency)
      return null;
  }

  return { min, max };
}

function sellAllForce(amount, delta) {
  if (delta == null) {
    delta = 0.0001;
  }

  if (amount == null) {
    amount = 0;
  }


  let { min, max } = getMinMaxPriceFromUi();

  sell(min - delta, amount, 1);

}

function getBalance() {
  let url = "https://www.binance.com/bapi/c2c/v1/private/c2c/asset/balance"
  fetch(url, {
    method: 'GET',
    headers: window.bnb.lqhHeaders
  })
    .then(response => {
      if (!response.ok) {
        throw new Error('网络响应不正常');
      }
      return response.text();
    })
    .then(data => {
      let resp = JSON.parse(data);
      if (resp.code == "000000") {
        window.bnb.balance = 0;
        //console.log("成功:", data);
        resp.data.forEach(ele => {
          let free = parseFloat(ele.free);
          let freeze = parseFloat(ele.freeze);
          window.bnb.balance += free + freeze;
        });
        console.log("余额:", window.bnb.balance);
        if (window.bnb.balanceStart == null) {
          window.bnb.balanceStart = window.bnb.balance;
        } else {
          infoRed(`余额变化:${window.bnb.balance - window.bnb.balanceStart}`);
        }
        if (window.bnb.lastBalance == null) {
          window.bnb.lastBalance = 0;
        } else {
          infoRed(`盈亏:${window.bnb.balance - window.bnb.lastBalance}`);
          window.bnb.lastBalance = window.bnb.balance;
        }
      } else {
        console.log("失败", resp.message);
      }
    })
    .catch(error => {
      console.error('请求失败:', error);
    });
}

function fBuy() {
  let url = "https://www.binance.com/bapi/defi/v2/private/wallet-direct/swap/cex/buy/pre/payment";
  let data = `{"fromToken":"USDT","fromBinanceChainId":"56","fromCoinAmount":"3","toToken":"PINGPONG","toContractAddress":"0x3ecb529752dec6c6ab08fd83e425497874e21d49","toCoinAmount":"20.029321640000000000","priorityMode":"priorityOnSuccess","extra":"{\"uniQuoteId\":\"5b7765a31f5f4a49b72e00d6f04f4667\"}","payMethod":"FUNDING_AND_SPOT"}`
  let response = {
    "code": "000000",
    "message": null,
    "messageDetail": null,
    "data": {
      "payStatus": "SUCCESS",
      "orderHistory": {
        "orderId": "25100900001159952116",
        "direction": "buy",
        "fromToken": "USDT",
        "fromTokenAmount": "3.000000000000000000",
        "fromBinanceChainId": "56",
        "fromTokenId": "A97B597E63B7FCC51BB9E307E13EC2E3",
        "fromContractAddress": "0x55d398326f99059ff775485246999027b3197955",
        "toToken": "PINGPONG",
        "toTokenAmount": "20.029321640000000000",
        "toBinanceChainId": "56",
        "toTokenId": "B48B7AAE6CA16153F10C0221EC1C65B3",
        "toContractAddress": "0x3ecb529752dec6c6ab08fd83e425497874e21d49",
        "status": "processing",
        "dbCreateTime": 1760006873000,
        "dbUpdateTime": 1760006873000,
        "feeDetail": {
          "id": 49,
          "direction": "FROM",
          "ratePercent": 0.0000,
          "defaultRatePercent": 0.005,
          "rateCoinAmount": 0,
          "rateFiatValue": 0.00000000,
          "coinPriceInUSD": null,
          "decimals": null
        },
        "intermediateTokens": null,
        "source": "BINANCE_ALPHA_PAY",
        "fromBridgeFee": 0.00000000,
        "nativeTokenPrice": 1279.26337603,
        "vendorFromCoinAmount": 3.000000000000000000,
        "chainGasFeeInUsd": 0.00000000,
        "chainGasTokenAmount": null,
        "chainToAmount": null,
        "uniQuoteId": "5b7765a31f5f4a49b72e00d6f04f4667",
        "quotePrice": null,
        "chainAmount": null,
        "slippage": 0.01200000
      }
    },
    "success": true
  };
}


let gb = getBalance;
let bmsm = buyMaxSellMin;
let c = cancel;
let ca = cancelAll;
let bm = buyMax;
let sa = sellAll;
let saf = sellAllForce;
function help() {

  let text = `
    * window.bnb.stock="${window.bnb.stock}"
    -初始化: init()

    -获取余额: gb()

    -前三最大买、最小卖: bmsm(201,1)
    -取消买单: c(0)
    -取消反向卖单并卖出所有订单: c(1)

    -取消所有订单: ca()

    -前三最大买: bm(201,1)
    -卖出所有(前三最小): sa()
    -强制卖出: saf(0.0001, 235.134)

    -帮助: help()
  `
  info(text);
}


function init() {

  let headers =
    `app-type
web
authorization
eyJraWQiOiIxMzYzODYiLCJhbGciOiJFUzI1NiJ9.eyJqdGkiOiJleDExMDE3NjEwMzgyMTgxOTJBRjcxRjUwRjQ5OEVBMUYyMUxKYlUiLCJ1aWQiOiJkRTZBRCtNOVJ4dVFub0ZQWHY2V1pRPT0iLCJzdGEiOjAsIm1pZCI6ImRFNkFEK005Unh1UW5vRlBYdjZXWlE9PSIsInBpZCI6IlBUeUE4VzA5ekZVSkJHSjZZUk5HWXc9PSIsIm5kZSI6MCwiaWF0IjoxNzYxMDM5MTIwLCJleHAiOjE3NjIyNDg3MjAsImJpZCI6MCwiZG9tIjoid3d3Lm9reC5jb20iLCJlaWQiOjE0LCJpc3MiOiJva2NvaW4iLCJkaWQiOiJQaC9iaWNiazFrcm9wV1VRcjFJek1sa1VyZlhUYnJEL3VJWklLQzNsTHczV3NxdW0zU2tPeDFMZW0vUFBIMER3IiwiZmlkIjoiUGgvYmljYmsxa3JvcFdVUXIxSXpNbGtVcmZYVGJyRC91SVpJS0MzbEx3M1dzcXVtM1NrT3gxTGVtL1BQSDBEdyIsImxpZCI6ImRFNkFEK005Unh1UW5vRlBYdjZXWlE9PSIsInVmYiI6IlBUeUE4VzA5ekZVSkJHSjZZUk5HWXc9PSIsInVwYiI6ImlCcmEyVmhOb2t5UmloeGlKLzN6RXc9PSIsImt5YyI6Miwia3lpIjoic1ZrUEh4ak1Hb2Fhc2o2Z3RXMVB4N2RUcENaS2c1LzZLbjFteGFpclpDbE84cWtiMWJMdGFmMklSVUtrTDd4RTd5ZEYvWU5DR1FXLzV5aTRWQnpUM1E9PSIsImNwayI6ImhCdjNtSEZjb0lETG5TckZ6dEdTTlpMT29aU2s1bUE4SHBQcE9MOFE1TlV0WFhqcmhYRjExeFI4TDBnUnhHM09CWk9mbGZvaWVqWkQva0FrYkl0VStWNEFXZ2g4OWQzQ0ZIMFpsWDFPWmJaRjg1SzljeHJRODB1ektIRkc5L3UyL1ZHb0dOdnh4TmtFV094YnF5ZXZNT2VSaklGS1R1d3QwRWliY3hJaTZ6OD0iLCJ2ZXIiOjEsImNsdCI6MiwidXVkIjoiN2Vrcm5KTDZ5bFVlL0lZZXhSM2xPKzMzZzhQaS9KdkJCTzNoQlNrL1JyUT0iLCJzdWIiOiJCMjVGNEM3ODE1QTNCMEQ2OTE4RTFERkRBM0M0MjRGRSJ9.whVFgkZmklMLGOywntCmtr69YBJieHA2OH0mze59Ki5BNW-NSOxZhKrxPNaOKLAR-LUBlQIeEqi_LzkcfJrgig
content-length
252
content-type
application/json
cookie
devId=ad206bea-c819-45d1-8061-cab15fa520b5; ok_prefer_udColor=0; first_ref=https%3A%2F%2Fwww.google.com%2F; ok_prefer_udTimeZone=1; OptanonConsent=isGpcEnabled=0&datestamp=Fri+Oct+03+2025+10%3A07%3A58+GMT%2B0800+(%E4%B8%AD%E5%9B%BD%E6%A0%87%E5%87%86%E6%97%B6%E9%97%B4)&version=202405.1.0&browserGpcFlag=0&isIABGlobal=false&hosts=&landingPath=NotLandingPage&groups=C0004%3A0%2CC0002%3A0%2CC0003%3A0%2CC0001%3A1&AwaitingReconsent=false; ok-exp-time=1761037894920; fingerprint_id=ad206bea-c819-45d1-8061-cab15fa520b5; _gcl_au=1.1.924826431.1761037904; _gid=GA1.2.1151162820.1761037904; tmx_session_id=z4cg1nt0v8q_1761037900993; intercom-id-ny9cf50h=9b74c876-b6a5-4538-98a6-a91fe40c7768; intercom-device-id-ny9cf50h=f207003a-f97b-4c07-b1ff-997d05da27f4; fp_s=0; ftID=undefined; x-lid=undefined; finger_test_cookie=1761038195419; g_state={"i_l":0,"i_ll":1761038182943}; isLogin=1; _tk=sNVAtGFfdr557AfYS2Evkg==; ok_login_type=OKX_GLOBAL; u_pid=D6D6lm9rEC5jB70; locale=zh_CN; preferLocale=zh_CN; ok_prefer_currency=0%7C1%7Cfalse%7CUSD%7C2%7C%24%7C1%7C1%7C%E7%BE%8E%E5%85%83; ok_site_info==0HNxojI5RXa05WZiwiIMFkQPx0Rfh1SPJiOiUGZvNmIsICRJJiOi42bpdWZyJye; token=eyJraWQiOiIxMzYzODYiLCJhbGciOiJFUzI1NiJ9.eyJqdGkiOiJleDExMDE3NjEwMzgyMTgxOTJBRjcxRjUwRjQ5OEVBMUYyMUxKYlUiLCJ1aWQiOiJkRTZBRCtNOVJ4dVFub0ZQWHY2V1pRPT0iLCJzdGEiOjAsIm1pZCI6ImRFNkFEK005Unh1UW5vRlBYdjZXWlE9PSIsInBpZCI6IlBUeUE4VzA5ekZVSkJHSjZZUk5HWXc9PSIsIm5kZSI6MCwiaWF0IjoxNzYxMDM5MTIwLCJleHAiOjE3NjIyNDg3MjAsImJpZCI6MCwiZG9tIjoid3d3Lm9reC5jb20iLCJlaWQiOjE0LCJpc3MiOiJva2NvaW4iLCJkaWQiOiJQaC9iaWNiazFrcm9wV1VRcjFJek1sa1VyZlhUYnJEL3VJWklLQzNsTHczV3NxdW0zU2tPeDFMZW0vUFBIMER3IiwiZmlkIjoiUGgvYmljYmsxa3JvcFdVUXIxSXpNbGtVcmZYVGJyRC91SVpJS0MzbEx3M1dzcXVtM1NrT3gxTGVtL1BQSDBEdyIsImxpZCI6ImRFNkFEK005Unh1UW5vRlBYdjZXWlE9PSIsInVmYiI6IlBUeUE4VzA5ekZVSkJHSjZZUk5HWXc9PSIsInVwYiI6ImlCcmEyVmhOb2t5UmloeGlKLzN6RXc9PSIsImt5YyI6Miwia3lpIjoic1ZrUEh4ak1Hb2Fhc2o2Z3RXMVB4N2RUcENaS2c1LzZLbjFteGFpclpDbE84cWtiMWJMdGFmMklSVUtrTDd4RTd5ZEYvWU5DR1FXLzV5aTRWQnpUM1E9PSIsImNwayI6ImhCdjNtSEZjb0lETG5TckZ6dEdTTlpMT29aU2s1bUE4SHBQcE9MOFE1TlV0WFhqcmhYRjExeFI4TDBnUnhHM09CWk9mbGZvaWVqWkQva0FrYkl0VStWNEFXZ2g4OWQzQ0ZIMFpsWDFPWmJaRjg1SzljeHJRODB1ektIRkc5L3UyL1ZHb0dOdnh4TmtFV094YnF5ZXZNT2VSaklGS1R1d3QwRWliY3hJaTZ6OD0iLCJ2ZXIiOjEsImNsdCI6MiwidXVkIjoiN2Vrcm5KTDZ5bFVlL0lZZXhSM2xPKzMzZzhQaS9KdkJCTzNoQlNrL1JyUT0iLCJzdWIiOiJCMjVGNEM3ODE1QTNCMEQ2OTE4RTFERkRBM0M0MjRGRSJ9.whVFgkZmklMLGOywntCmtr69YBJieHA2OH0mze59Ki5BNW-NSOxZhKrxPNaOKLAR-LUBlQIeEqi_LzkcfJrgig; im-token=; _ga=GA1.1.2076758022.1761037904; traceId=2140710481130100002; _ga_G0EKWWQGTZ=GS2.1.s1761045280$o2$g1$t1761048119$j26$l0$h0; intercom-session-ny9cf50h=UHZESy9FWGttMFY4bENHYkllWm9JUDhBZS9UVENpYUdacTQwQXV1LzRzL3JjZXN0Y1hJOHFOYkxLZFRPd3JOMGNwN1RMeWREUVNSQW9NdmVtb1pFd3lSR0Nad2VYUDNtREdCK1lSZ25ZMW89LS1Fa3VaaUNuejVCZDFiZ0ZxekVzYVF3PT0=--e07d3f1021f8c468f6de4938acc977eb7ca19b1a; okg.currentMedia=xl; ok_global={%22okg_m%22:%22xl%22}; __cf_bm=LEoRE8TWRajiwFxq3MSyFCzT9AoytUPV1WxWbwl0YyM-1761048164-1.0.1.1-0ltzWNJ2C3PIiEUX70sk_K6b8aLMeyDhI9bXpUN9iLlaoGXU4fLIqUE43DjdJ_cGYr_a.mmXW_JLnT697B_wmD7w9u8Mfg8yoenPuQGOrD8; ok-ses-id=u32tiJmZs1+13A1msIcCTWBZqcm+O+6omraX3cA4iFqhw5XCN0nR5z9Olb9Q8gYHN9zWZ+0iBDablXxm0d5mRDrFnvg54aYqBJ9IdEeOTmTu+25z2mMnQlRhf7lzD2Su; _monitor_extras={"deviceId":"to05fxWRiFJkh9XdXbfCIt","eventId":501,"sequenceNumber":501}
devid
ad206bea-c819-45d1-8061-cab15fa520b5
`;
  let ss = headers.split("\n");
  let json = {};
  let keys = ["content-type","app-type","authorization","devid"].join(",");
  for (let i = 0; i < ss.length - 1;) {
    let key = ss[i];
    if (keys.indexOf(key) >= 0) {
      let value = ss[i + 1];
      json[key] = value;
    }

    i += 2;
  }

  window.bnb = {};
  window.bnb.lqhHeaders = json;

  window.bnb.buyDelta = 0.00001;
  window.bnb.sellDelta = 0.00001;
  window.bnb.orderId = [];
  window.bnb.maxDelta = 0.0001;
  window.bnb.stock = "numi";
  window.bnb.stocks = {
    aop: "ALPHA_382",
    pingpong: "ALPHA_368",
    p: "ALPHA_408",
    numi: "ALPHA_387",
    btg: "ALPHA_406",
    hana: "ALPHA_394",
    koge: "ALPHA_22",
    jojo: "ALPHA_383"
  }
  config();
}
window.bnb={
  "lqhHeaders": {
    "baggage": "sentry-environment=prod,sentry-release=20251007-7bb57518-3018,sentry-public_key=9445af76b2ba747e7b574485f2c998f7,sentry-trace_id=fba461cc166c44308fec656b375dfde7,sentry-sample_rate=0.01,sentry-transaction=%2Falpha%2F%24chainSymbol%2F%24contractAddress,sentry-sampled=false",
    "bnc-uuid": "67e6afe2-047e-4d30-bdc1-19151112790b",
    "clienttype": "web",
    "content-type": "application/json",
    "csrftoken": "c308cf6ee10c7f645434279240e9998e",
    "device-info": "eyJzY3JlZW5fcmVzb2x1dGlvbiI6IjE2ODAsMTA1MCIsImF2YWlsYWJsZV9zY3JlZW5fcmVzb2x1dGlvbiI6IjE2ODAsMTAyNSIsInN5c3RlbV92ZXJzaW9uIjoibWFjT1MgMTAuMTUuNyIsImJyYW5kX21vZGVsIjoiZGVza3RvcCBBcHBsZSBNYWNpbnRvc2ggIiwic3lzdGVtX2xhbmciOiJ6aC1DTiIsInRpbWV6b25lIjoiR01UKzA4OjAwIiwidGltZXpvbmVPZmZzZXQiOi00ODAsInVzZXJfYWdlbnQiOiJNb3ppbGxhLzUuMCAoTWFjaW50b3NoOyBJbnRlbCBNYWMgT1MgWCAxMF8xNV83KSBBcHBsZVdlYktpdC81MzcuMzYgKEtIVE1MLCBsaWtlIEdlY2tvKSBDaHJvbWUvMTQxLjAuMC4wIFNhZmFyaS81MzcuMzYiLCJsaXN0X3BsdWdpbiI6IlBERiBWaWV3ZXIsQ2hyb21lIFBERiBWaWV3ZXIsQ2hyb21pdW0gUERGIFZpZXdlcixNaWNyb3NvZnQgRWRnZSBQREYgVmlld2VyLFdlYktpdCBidWlsdC1pbiBQREYiLCJjYW52YXNfY29kZSI6IjNmYTgyM2QxIiwid2ViZ2xfdmVuZG9yIjoiR29vZ2xlIEluYy4gKEludGVsIEluYy4pIiwid2ViZ2xfcmVuZGVyZXIiOiJBTkdMRSAoSW50ZWwgSW5jLiwgSW50ZWwoUikgSXJpcyhUTSkgR3JhcGhpY3MgNjEwMCwgT3BlbkdMIDQuMSkiLCJhdWRpbyI6IjEyNC4wNDM0NzY1NzgwODEwMyIsInBsYXRmb3JtIjoiTWFjSW50ZWwiLCJ3ZWJfdGltZXpvbmUiOiJBc2lhL1NoYW5naGFpIiwiZGV2aWNlX25hbWUiOiJDaHJvbWUgVjE0MS4wLjAuMCAobWFjT1MpIiwiZmluZ2VycHJpbnQiOiIwMGE1MWM1Zjc3ZTkzMjM3YWI0MTRmMTBiMDY0ZTgxZSIsImRldmljZV9pZCI6IiIsInJlbGF0ZWRfZGV2aWNlX2lkcyI6IiJ9",
    "fvideo-id": "3305c6443bdca07787f83231ec0fc6da0757b0c6"
  },
  "delta": 0.00001,
  "orderId": [
    49324864,
    49324865
  ],
  "maxDelta": 0.0001,
  "buyDelta": 0.00001,
  "sellDelta": 0.00001,
  "stock": "merl",
  "stocks": {
    "aop": "ALPHA_382",
    "pingpong": "ALPHA_368",
    "p": "ALPHA_408",
    "numi": "ALPHA_387",
    "btg": "ALPHA_406",
    "hana": "ALPHA_394",
    "koge": "ALPHA_22",
    "jojo": "ALPHA_383",
    "merl": "ALPHA_195"
  },
  "balance": 577.8023962,
  "balanceStart": 577.8023962,
  "lastBalance": 577.8023962,
  "running": true,
  "quantity": 1172.2
}