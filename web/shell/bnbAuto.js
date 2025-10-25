
/*
async function simulateInput(element, text, delay = 100) {
  element.focus();
  element.value = "";
  text = "" + text;
  for (let i = 0; i < text.length; ++i) {

    const char = text[i];
    const keydownEvent = new KeyboardEvent('keydown', { key: char, bubbles: true });
    const keypressEvent = new KeyboardEvent('keypress', { key: char, bubbles: true });
    const keyupEvent = new KeyboardEvent('keyup', { key: char, bubbles: true });

    element.dispatchEvent(keydownEvent);
    element.dispatchEvent(keypressEvent);

    // 更新值并触发input事件
    element.value += char;
    const inputEvent = new Event('input', { bubbles: true });
    element.dispatchEvent(inputEvent);

    element.dispatchEvent(keyupEvent);
    await sleep(delay);
  }

  // 最终触发change事件
  const changeEvent = new Event('change');
  element.dispatchEvent(changeEvent);
  // 聚焦到输入框
}

async function buy_del(price, dollar, submit) {
  if (dollar == null) {
    dollar = "201";
  }

  const cell = document.querySelector('.bn-web-table-tbody tr.bn-web-table-row td:last-child')
  const clickEvent = new MouseEvent('click', {
    view: window,
    bubbles: true,
    cancelable: true
  });

  //cell.firstChild.dispatchEvent(clickEvent);

  let inputs = document.querySelectorAll('#limitPrice');
  inputs[0].value = price;
  await simulateInput(inputs[0], price);

  inputs = document.querySelectorAll('#limitAmount');
  let amount = dollar / price;
  //inputs[0].value = amount.toFixed(2);

  inputs = document.querySelectorAll('#limitTotal');
  //inputs[0].value = dollar;

  await simulateInput(inputs[0], dollar);
  inputs[1].value = price;


  const button = document.querySelector('.bn-button__buy');
  if (button && submit) {
    button.click();
  }
}



let headers = {
  'Content-Type': 'application/json; charset=UTF-8',
  'baggage': 'sentry-environment=prod,sentry-release=20250924-d1d0004c-2900,sentry-public_key=9445af76b2ba747e7b574485f2c998f7,sentry-trace_id=46e53682185f4f0583eb6f332995b0f6,sentry-sample_rate=0.01,sentry-transaction=%2Falpha%2F%24chainSymbol%2F%24contractAddress,sentry-sampled=false',
  'bnc-uuid': '67e6afe2-047e-4d30-bdc1-19151112790b',
  'clienttype': 'web',
  'csrftoken': 'e64ae6efebfb9c78f67bb9964af09605',
  'device-info': 'eyJzY3JlZW5fcmVzb2x1dGlvbiI6IjE2ODAsMTA1MCIsImF2YWlsYWJsZV9zY3JlZW5fcmVzb2x1dGlvbiI6IjE2ODAsMTAyNSIsInN5c3RlbV92ZXJzaW9uIjoibWFjT1MgMTAuMTUuNyIsImJyYW5kX21vZGVsIjoiZGVza3RvcCBBcHBsZSBNYWNpbnRvc2ggIiwic3lzdGVtX2xhbmciOiJ6aC1DTiIsInRpbWV6b25lIjoiR01UKzA4OjAwIiwidGltZXpvbmVPZmZzZXQiOi00ODAsInVzZXJfYWdlbnQiOiJNb3ppbGxhLzUuMCAoTWFjaW50b3NoOyBJbnRlbCBNYWMgT1MgWCAxMF8xNV83KSBBcHBsZVdlYktpdC81MzcuMzYgKEtIVE1MLCBsaWtlIEdlY2tvKSBDaHJvbWUvMTQxLjAuMC4wIFNhZmFyaS81MzcuMzYiLCJsaXN0X3BsdWdpbiI6IlBERiBWaWV3ZXIsQ2hyb21lIFBERiBWaWV3ZXIsQ2hyb21pdW0gUERGIFZpZXdlcixNaWNyb3NvZnQgRWRnZSBQREYgVmlld2VyLFdlYktpdCBidWlsdC1pbiBQREYiLCJjYW52YXNfY29kZSI6IjNmYTgyM2QxIiwid2ViZ2xfdmVuZG9yIjoiR29vZ2xlIEluYy4gKEludGVsIEluYy4pIiwid2ViZ2xfcmVuZGVyZXIiOiJBTkdMRSAoSW50ZWwgSW5jLiwgSW50ZWwoUikgSXJpcyhUTSkgR3JhcGhpY3MgNjEwMCwgT3BlbkdMIDQuMSkiLCJhdWRpbyI6IjEyNC4wNDM0NzY1NzgwODEwMyIsInBsYXRmb3JtIjoiTWFjSW50ZWwiLCJ3ZWJfdGltZXpvbmUiOiJBc2lhL1NoYW5naGFpIiwiZGV2aWNlX25hbWUiOiJDaHJvbWUgVjE0MS4wLjAuMCAobWFjT1MpIiwiZmluZ2VycHJpbnQiOiIwMGE1MWM1Zjc3ZTkzMjM3YWI0MTRmMTBiMDY0ZTgxZSIsImRldmljZV9pZCI6IiIsInJlbGF0ZWRfZGV2aWNlX2lkcyI6IiJ9',
  'fvideo-id': '3305c6443bdca07787f83231ec0fc6da0757b0c6'
};

*/

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
  sell(min - window.bnb.sellDelta, 0, 1);
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

  if (max - min > window.bnb.sellDelta / 10) {
    infoRed(`价差超过${window.bnb.sellDelta / 10}`);
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
    `baggage
sentry-environment=prod,sentry-release=20251022-1b018171-3173,sentry-public_key=9445af76b2ba747e7b574485f2c998f7,sentry-trace_id=361dae9f62eb45689a47323cdd1262a7,sentry-sample_rate=0.01,sentry-transaction=%2Falpha%2F%24chainSymbol%2F%24contractAddress,sentry-sampled=false
bnc-uuid
67e6afe2-047e-4d30-bdc1-19151112790b
clienttype
web
content-length
162
content-type
application/json
cookie
bnc-uuid=67e6afe2-047e-4d30-bdc1-19151112790b; BNC_FV_KEY=3305c6443bdca07787f83231ec0fc6da0757b0c6; OptanonAlertBoxClosed=2025-10-03T02:13:21.738Z; _gcl_au=1.1.1685839591.1759457606; se_gd=AJXEVDgUEGbCwxbxXUA9gZZCFDQoXBSWlIOVZUkd1hRWwV1NWVBU1; se_gsd=Sjo2GgpVIwAiBjcmJzInIyk9VBMGDgUHUVxBW1ZTVlhXJFNT1; currentAccount=; BNC-Location=CN; userPreferredCurrency=USD_USD; forterToken=8bab0270232a41f9a898284c4156659a_1759635706349__UDF43-mnf-a4_21ck_; changeBasisTimeZone=; neo-theme=dark; theme=dark; logined=y; _ga_MEG0BSW76K=GS2.1.s1760085488$o2$g1$t1760085502$j46$l0$h0; lang=zh-CN; _gid=GA1.2.493797717.1760847799; sensorsdata2015jssdkcross=%7B%22distinct_id%22%3A%2229062185%22%2C%22first_id%22%3A%22199a7d80d15581-0879b6d1278a92-1f525631-1764000-199a7d80d16b7b%22%2C%22props%22%3A%7B%22%24latest_traffic_source_type%22%3A%22%E7%9B%B4%E6%8E%A5%E6%B5%81%E9%87%8F%22%2C%22%24latest_search_keyword%22%3A%22%E6%9C%AA%E5%8F%96%E5%88%B0%E5%80%BC_%E7%9B%B4%E6%8E%A5%E6%89%93%E5%BC%80%22%2C%22%24latest_referrer%22%3A%22%22%2C%22aws_waf_referrer%22%3A%22%7B%5C%22referrer%5C%22%3A%5C%22https%3A%2F%2Fwww.binance.com%2F%5C%22%7D%22%2C%22%24latest_utm_source%22%3A%22copylink%22%2C%22%24latest_utm_campaign%22%3A%22web_square_share_link%22%2C%22%24latest_utm_content%22%3A%22hvFffeYDVM9Tlcb1ofQ9Jg%22%7D%2C%22identities%22%3A%22eyIkaWRlbnRpdHlfY29va2llX2lkIjoiMTk5YTdkODBkMTU1ODEtMDg3OWI2ZDEyNzhhOTItMWY1MjU2MzEtMTc2NDAwMC0xOTlhN2Q4MGQxNmI3YiIsIiRpZGVudGl0eV9sb2dpbl9pZCI6IjI5MDYyMTg1In0%3D%22%2C%22history_login_id%22%3A%7B%22name%22%3A%22%24identity_login_id%22%2C%22value%22%3A%2229062185%22%7D%2C%22%24device_id%22%3A%22199af83906a75-0bf04d3d7a0ff3-1e525631-1764000-199af83906b4da%22%7D; futures-layout=pro; aws-waf-token=88e6aff0-5fe3-45df-bd4a-c174811a35d3:BgoAi7pYIQArAAAA:AhJ2NZMwI7Mm938yTgXVTADdAyB/lNbW3e86MFHwK+366BNr03iGYaA8UmSmK0LJHX5SlZPin+7cnroAmWt6FVrBsKB82gX/kVMiFWpPaqgdb1R3iJGw7D/YWRnmSyn/aVinHyNfGQJ1Sn/dUkaallkMerktpEAvux9KfcskKm89pcJgpePQy2hzq6ceb4mOI+I=; BNC_FV_KEY_T=101-bOL881U25ur17w8DFyGOaEJH%2F7fjUXgkRT8EO5rQoDOfRpnVf4U8w%2B6gzdm0tpimftxMPXU1WPwsFx37goHgfQ%3D%3D-b%2FnjMevCohH9mbBf4Kg1sw%3D%3D-b7; BNC_FV_KEY_EXPIRE=1761158274089; g_state={"i_l":0,"i_ll":1761136669847}; se_sd=xsWVAAQsLBMChIR0bUg8gZZFhVAlXEQUlERFeWkFFBVUAG1NWV9V1; s9r1=CDBDC28D707B1C1607394013F7B3C31C; r20t=web.882836B967F10021D2A4D5C90BD7C82E; r30t=1; cr00=8F6768FA15F8E4781E3CFBCB47F32ED8; d1og=web.29062185.6822CE7FC71DE6280BCE339BA1B57F25; r2o1=web.29062185.EC0841C79A0D73AAFB0410B47C230CAB; f30l=web.29062185.F48EAB2409F0EE381756AAC17B004638; isAccountsLoggedIn=y; p20t=web.29062185.BB0DB0ED19C9A046990093217ECA87FE; _uetsid=ecc5bd30af4311f0a516dd4fab9717c0; _uetvid=8c9cd7f09ffe11f0bdf9cd4c1d08b540; _ga_3WP50LGEEC=GS2.1.s1761182230$o84$g1$t1761182267$j23$l0$h0; OptanonConsent=isGpcEnabled=0&datestamp=Thu+Oct+23+2025+09%3A17%3A49+GMT%2B0800+(%E4%B8%AD%E5%9B%BD%E6%A0%87%E5%87%86%E6%97%B6%E9%97%B4)&version=202506.1.0&browserGpcFlag=0&isIABGlobal=false&hosts=&consentId=6298cb37-9de2-41b1-804b-070908bdd651&interactionCount=2&isAnonUser=1&landingPath=NotLandingPage&groups=C0001%3A1%2CC0003%3A1%2CC0004%3A1%2CC0002%3A1&intType=1&geolocation=CN%3BBJ&AwaitingReconsent=false; _ga=GA1.2.1791296862.1759457604
csrftoken
eaf5652dc9f162df52c0f2690d0a5d96
device-info
eyJzY3JlZW5fcmVzb2x1dGlvbiI6IjE2ODAsMTA1MCIsImF2YWlsYWJsZV9zY3JlZW5fcmVzb2x1dGlvbiI6IjE2ODAsMTAyNSIsInN5c3RlbV92ZXJzaW9uIjoibWFjT1MgMTAuMTUuNyIsImJyYW5kX21vZGVsIjoiZGVza3RvcCBBcHBsZSBNYWNpbnRvc2ggIiwic3lzdGVtX2xhbmciOiJ6aC1DTiIsInRpbWV6b25lIjoiR01UKzA4OjAwIiwidGltZXpvbmVPZmZzZXQiOi00ODAsInVzZXJfYWdlbnQiOiJNb3ppbGxhLzUuMCAoTWFjaW50b3NoOyBJbnRlbCBNYWMgT1MgWCAxMF8xNV83KSBBcHBsZVdlYktpdC81MzcuMzYgKEtIVE1MLCBsaWtlIEdlY2tvKSBDaHJvbWUvMTQxLjAuMC4wIFNhZmFyaS81MzcuMzYiLCJsaXN0X3BsdWdpbiI6IlBERiBWaWV3ZXIsQ2hyb21lIFBERiBWaWV3ZXIsQ2hyb21pdW0gUERGIFZpZXdlcixNaWNyb3NvZnQgRWRnZSBQREYgVmlld2VyLFdlYktpdCBidWlsdC1pbiBQREYiLCJjYW52YXNfY29kZSI6IjNmYTgyM2QxIiwid2ViZ2xfdmVuZG9yIjoiR29vZ2xlIEluYy4gKEludGVsIEluYy4pIiwid2ViZ2xfcmVuZGVyZXIiOiJBTkdMRSAoSW50ZWwgSW5jLiwgSW50ZWwoUikgSXJpcyhUTSkgR3JhcGhpY3MgNjEwMCwgT3BlbkdMIDQuMSkiLCJhdWRpbyI6IjEyNC4wNDM0NzY1NzgwODEwMyIsInBsYXRmb3JtIjoiTWFjSW50ZWwiLCJ3ZWJfdGltZXpvbmUiOiJBc2lhL1NoYW5naGFpIiwiZGV2aWNlX25hbWUiOiJDaHJvbWUgVjE0MS4wLjAuMCAobWFjT1MpIiwiZmluZ2VycHJpbnQiOiIwMGE1MWM1Zjc3ZTkzMjM3YWI0MTRmMTBiMDY0ZTgxZSIsImRldmljZV9pZCI6IiIsInJlbGF0ZWRfZGV2aWNlX2lkcyI6IiJ9
fvideo-id
3305c6443bdca07787f83231ec0fc6da0757b0c6
lang
zh-CN
`;
  let ss = headers.split("\n");
  let json = {};
  let keys = ["content-type", "baggage", 'bnc-uuid', 'clienttype', "csrftoken", "device-info", "fvideo-id"].join(",");
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
    "baggage": "sentry-environment=prod,sentry-release=20251022-1b018171-3173,sentry-public_key=9445af76b2ba747e7b574485f2c998f7,sentry-trace_id=361dae9f62eb45689a47323cdd1262a7,sentry-sample_rate=0.01,sentry-transaction=%2Falpha%2F%24chainSymbol%2F%24contractAddress,sentry-sampled=false",
    "bnc-uuid": "67e6afe2-047e-4d30-bdc1-19151112790b",
    "clienttype": "web",
    "content-type": "application/json",
    "csrftoken": "eaf5652dc9f162df52c0f2690d0a5d96",
    "device-info": "eyJzY3JlZW5fcmVzb2x1dGlvbiI6IjE2ODAsMTA1MCIsImF2YWlsYWJsZV9zY3JlZW5fcmVzb2x1dGlvbiI6IjE2ODAsMTAyNSIsInN5c3RlbV92ZXJzaW9uIjoibWFjT1MgMTAuMTUuNyIsImJyYW5kX21vZGVsIjoiZGVza3RvcCBBcHBsZSBNYWNpbnRvc2ggIiwic3lzdGVtX2xhbmciOiJ6aC1DTiIsInRpbWV6b25lIjoiR01UKzA4OjAwIiwidGltZXpvbmVPZmZzZXQiOi00ODAsInVzZXJfYWdlbnQiOiJNb3ppbGxhLzUuMCAoTWFjaW50b3NoOyBJbnRlbCBNYWMgT1MgWCAxMF8xNV83KSBBcHBsZVdlYktpdC81MzcuMzYgKEtIVE1MLCBsaWtlIEdlY2tvKSBDaHJvbWUvMTQxLjAuMC4wIFNhZmFyaS81MzcuMzYiLCJsaXN0X3BsdWdpbiI6IlBERiBWaWV3ZXIsQ2hyb21lIFBERiBWaWV3ZXIsQ2hyb21pdW0gUERGIFZpZXdlcixNaWNyb3NvZnQgRWRnZSBQREYgVmlld2VyLFdlYktpdCBidWlsdC1pbiBQREYiLCJjYW52YXNfY29kZSI6IjNmYTgyM2QxIiwid2ViZ2xfdmVuZG9yIjoiR29vZ2xlIEluYy4gKEludGVsIEluYy4pIiwid2ViZ2xfcmVuZGVyZXIiOiJBTkdMRSAoSW50ZWwgSW5jLiwgSW50ZWwoUikgSXJpcyhUTSkgR3JhcGhpY3MgNjEwMCwgT3BlbkdMIDQuMSkiLCJhdWRpbyI6IjEyNC4wNDM0NzY1NzgwODEwMyIsInBsYXRmb3JtIjoiTWFjSW50ZWwiLCJ3ZWJfdGltZXpvbmUiOiJBc2lhL1NoYW5naGFpIiwiZGV2aWNlX25hbWUiOiJDaHJvbWUgVjE0MS4wLjAuMCAobWFjT1MpIiwiZmluZ2VycHJpbnQiOiIwMGE1MWM1Zjc3ZTkzMjM3YWI0MTRmMTBiMDY0ZTgxZSIsImRldmljZV9pZCI6IiIsInJlbGF0ZWRfZGV2aWNlX2lkcyI6IiJ9",
    "fvideo-id": "3305c6443bdca07787f83231ec0fc6da0757b0c6"
  },
  "buyDelta": 0.00001,
  "sellDelta": 0.00001,
  "orderId": [],
  "maxDelta": 0.0001,
  "stock": "numi",
  "stocks": {
    "aop": "ALPHA_382",
    "pingpong": "ALPHA_368",
    "p": "ALPHA_408",
    "numi": "ALPHA_387",
    "btg": "ALPHA_406",
    "hana": "ALPHA_394",
    "koge": "ALPHA_22",
    "jojo": "ALPHA_383"
  },
  "balance": 492.99907299,
  "balanceStart": 492.99907299,
  "lastBalance": 492.99907299
}