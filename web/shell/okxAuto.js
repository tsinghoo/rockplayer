
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
  console.log(`window.okx=${JSON.stringify(window.okx, null, 2)}`);
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
    "baseAsset": window.okx.stock,
    "quoteAsset": "USDT",
    "workingSide": "BUY",
    "workingPrice": buyPrice,
    "workingQuantity": quantity,
    "paymentDetails":
      [{ "amount": amount, "paymentWalletType": "CARD" }],
    "pendingPrice": sellPrice
  };

  console.log(JSON.stringify(json, null, 2));
  if (window.okx.maxDelta == null) {
    window.okx.maxDelta = 0.0001;
  }
  if (sellPrice - buyPrice > window.okx.maxDelta) {
    console.log("价格差异超过最大允许值", window.okx.maxDelta);
    return;
  }

  if (notTest) {
    // 发送 POST 请求
    console.log("POST to " + url);
    window.okx.quantity = quantity;
    fetch(url, {
      method: 'POST',
      headers: window.okx.lqhHeaders,
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
          window.okx.orderId = [resp.data.workingOrderId, resp.data.pendingOrderId];
          console.log("订单创建成功", window.okx.orderId);
        } else {
          console.log("订单创建失败", resp.message);
        }
      })
      .catch(error => {
        console.error('请求失败:', error);
      });
  }
}

function type1(el, text) {
  let r = new DataTransfer();
  r.setData("text/plain", text);
  el.dispatchEvent(
    new ClipboardEvent("paste", {
      clipboardData: r,
      bubbles: true,
      cancelable: true,
    })
  );
  r.clearData();
}

function selectAll(el) {
  info("selectAll");
  el.focus();
  let t = window.getSelection();
  if (!t) return;
  let n = document.createRange();
  n.selectNodeContents(el);
  t.removeAllRanges();
  t.addRange(n);
}



async function simulateInput(element, text, delay = 10) {
  selectAll(element);
  await sleep(3000);
  type1(element, text);
}


async function doBuy(amount, buyPrice, notTest) {

  const clickEvent = new MouseEvent('click', {
    view: window,
    bubbles: true,
    cancelable: true
  });
  const event = new Event('change', {
    bubbles: true,    // 事件是否冒泡
    cancelable: true  // 事件是否可取消
  });

  let priceInput = document.getElementById(':r9p:');
  //console.log(getEventListeners(priceInput));


  priceInput.dispatchEvent(clickEvent);
  await sleep(300);
   await simulateInput(priceInput, buyPrice);
  //priceInput.value = buyPrice;
  //priceInput.dispatchEvent(event);
  return;
  //

  let amountInput = document.getElementById(':rad:');
  amountInput.dispatchEvent(clickEvent);
  //amountInput.value=amount;
  await simulateInput(amountInput, amount);

  await sleep(300);
  let quantity = document.getElementById(':r9v:').value;
  info(quantity);

  return;
  let cell = document.querySelectorAll('.okui-button-var.okui-btn.btn-fill-green')[0]

  cell.dispatchEvent(clickEvent);
}

async function sell(sellPrice, quantity, notTest) {
  //{"baseAsset":"ALPHA_368","quoteAsset":"USDT",
  // "side":"SELL","price":0.12735,"quantity":2351.57,"paymentDetails":[{"amount":2351.57,"paymentWalletType":"ALPHA"}]}
  if (quantity == 0) {
    quantity = window.okx.quantity * (1 - 1 / 10000);
  }

  quantity = Math.floor(quantity * 100) / 100;
  let url = "https://www.binance.com/bapi/asset/v1/private/alpha-trade/order/place"; //post
  let pprice = sellPrice;
  pprice = convertIfInteger(pprice, 8);
  const json = {
    "baseAsset": window.okx.stocks[window.okx.stock.toLowerCase()],
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
      headers: window.okx.lqhHeaders,
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
          window.okx.orderId = [0, resp.data];
          console.log("订单创建成功", window.okx.orderId);
        } else {
          console.log("订单创建失败", resp.message);
        }
      })
      .catch(error => {
        console.error('请求失败:', error);
      });
  }


}

async function buy(amount, notTest) {
  let price = getPrice();
  doBuy(amount, price, notTest);
}


async function buyMaxSellMin(amount, notTest) {
  let e;
  bnb.running = true;
  while (bnb.running && e == null) {
    infoRed("running");
    e = getPrice(1);

    if (e == null) {
      await sleep(1000);
    }
  }

  if (e == null) {
    infoRed("cancelled");
  } else {
    infoRed("toBuy");

    let { min, max } = e;
    doBuyAndSell(amount, max + window.okx.buyDelta, min - window.okx.sellDelta, notTest);
  }
}

async function cancel(i) {
  let url = "https://www.okx.com/priapi/v5/trade/aggregate/cancel-orders?t="; //post
  const json = { "orderId": window.okx.orderId[i], "symbol": window.okx.stocks[window.okx.stock.toLowerCase()] + "USDT" };

  console.log(JSON.stringify(json, null, 2));

  // 发送 POST 请求
  fetch(url, {
    method: 'POST',
    headers: window.okx.lqhHeaders,
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
    headers: window.okx.lqhHeaders,
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
  let { min, max } = getPrice();
  sell(min - window.okx.delta, 0, 1);
}

function infoRed(info) {
  console.log(`%c${info}`, 'color: red;');
}
function info(info) {
  console.log(info);
}

function getPrice() {
  let peles;
  //let localPrice=document.querySelectorAll(".order-book-box .index_currentLocalPrice__JVht3");

  peles = document.querySelectorAll(".order-book-box .okui-plain-button.index_tickerPrice__0ElT5");
  if (peles.length < 1) {
    throw "找不到价格";
  }
  let price = peles[0].innerText;
  price = parseFloat(price);

  return price;
}

function sellAllForce(amount, delta) {
  if (delta == null) {
    delta = 0.0001;
  }

  if (amount == null) {
    amount = 0;
  }


  let { min, max } = getPrice();

  sell(min - delta, amount, 1);

}

function getBalance() {
  let url = "https://www.binance.com/bapi/c2c/v1/private/c2c/asset/balance"
  fetch(url, {
    method: 'GET',
    headers: window.okx.lqhHeaders
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
        window.okx.balance = 0;
        //console.log("成功:", data);
        resp.data.forEach(ele => {
          let free = parseFloat(ele.free);
          let freeze = parseFloat(ele.freeze);
          window.okx.balance += free + freeze;
        });
        console.log("余额:", window.okx.balance);
        if (window.okx.balanceStart == null) {
          window.okx.balanceStart = window.okx.balance;
        } else {
          infoRed(`余额变化:${window.okx.balance - window.okx.balanceStart}`);
        }
        if (window.okx.lastBalance == null) {
          window.okx.lastBalance = 0;
        } else {
          infoRed(`盈亏:${window.okx.balance - window.okx.lastBalance}`);
          window.okx.lastBalance = window.okx.balance;
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
let b = buy;
let sa = sellAll;
let saf = sellAllForce;
function help() {

  let text = `
    * window.okx.stock="${window.okx.stock}"
    -初始化: init()

    -获取余额: gb()

    -前三最大买、最小卖: bmsm(201,1)
    -取消买单: c(0)
    -取消反向卖单并卖出所有订单: c(1)

    -取消所有订单: ca()

    -当前价买: b(201,1)
    -卖出所有: sa()
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
eyJraWQiOiIxMzYzODYiLCJhbGciOiJFUzI1NiJ9.eyJqdGkiOiJleDExMDE3NjEwNTM0NzYyNDQyMDRFRDZFNjNBQUREQjM2MWNaclQiLCJ1aWQiOiJkRTZBRCtNOVJ4dVFub0ZQWHY2V1pRPT0iLCJzdGEiOjAsIm1pZCI6ImRFNkFEK005Unh1UW5vRlBYdjZXWlE9PSIsInBpZCI6IlBUeUE4VzA5ekZVSkJHSjZZUk5HWXc9PSIsIm5kZSI6MCwiaWF0IjoxNzYxMDUzNDc2LCJleHAiOjE3NjIyNjMwNzYsImJpZCI6MCwiZG9tIjoid3d3Lm9reC5jb20iLCJlaWQiOjE0LCJpc3MiOiJva2NvaW4iLCJkaWQiOiJQaC9iaWNiazFrcm9wV1VRcjFJek1sa1VyZlhUYnJEL3VJWklLQzNsTHczV3NxdW0zU2tPeDFMZW0vUFBIMER3IiwiZmlkIjoiUGgvYmljYmsxa3JvcFdVUXIxSXpNbGtVcmZYVGJyRC91SVpJS0MzbEx3M1dzcXVtM1NrT3gxTGVtL1BQSDBEdyIsImxpZCI6ImRFNkFEK005Unh1UW5vRlBYdjZXWlE9PSIsInVmYiI6IlBUeUE4VzA5ekZVSkJHSjZZUk5HWXc9PSIsInVwYiI6ImlCcmEyVmhOb2t5UmloeGlKLzN6RXc9PSIsImt5YyI6Miwia3lpIjoic1ZrUEh4ak1Hb2Fhc2o2Z3RXMVB4N2RUcENaS2c1LzZLbjFteGFpclpDbE84cWtiMWJMdGFmMklSVUtrTDd4RTd5ZEYvWU5DR1FXLzV5aTRWQnpUM1E9PSIsImNwayI6ImhCdjNtSEZjb0lETG5TckZ6dEdTTlpMT29aU2s1bUE4SHBQcE9MOFE1TlV0WFhqcmhYRjExeFI4TDBnUnhHM09CWk9mbGZvaWVqWkQva0FrYkl0VStWNEFXZ2g4OWQzQ0ZIMFpsWDFPWmJaRjg1SzljeHJRODB1ektIRkc5L3UyL1ZHb0dOdnh4TmtFV094YnF5ZXZNT2VSaklGS1R1d3QwRWliY3hJaTZ6OD0iLCJ2ZXIiOjEsImNsdCI6MiwidXVkIjoiN2Vrcm5KTDZ5bFVlL0lZZXhSM2xPKzMzZzhQaS9KdkJCTzNoQlNrL1JyUT0iLCJzdWIiOiJCMjVGNEM3ODE1QTNCMEQ2OTE4RTFERkRBM0M0MjRGRSJ9.K-67xUu7aop1KRdS8t7TYZhgwf24vGxnn2Y8y9oWnPa4Nrx9RUx3ov8B4170QyYOA6KZFrDB3VQ_hRW_n17vGg
content-length
244
content-type
application/json
cookie
devId=ad206bea-c819-45d1-8061-cab15fa520b5; ok_prefer_udColor=0; first_ref=https%3A%2F%2Fwww.google.com%2F; ok_prefer_udTimeZone=1; OptanonConsent=isGpcEnabled=0&datestamp=Fri+Oct+03+2025+10%3A07%3A58+GMT%2B0800+(%E4%B8%AD%E5%9B%BD%E6%A0%87%E5%87%86%E6%97%B6%E9%97%B4)&version=202405.1.0&browserGpcFlag=0&isIABGlobal=false&hosts=&landingPath=NotLandingPage&groups=C0004%3A0%2CC0002%3A0%2CC0003%3A0%2CC0001%3A1&AwaitingReconsent=false; ok-exp-time=1761037894920; fingerprint_id=ad206bea-c819-45d1-8061-cab15fa520b5; _gcl_au=1.1.924826431.1761037904; _gid=GA1.2.1151162820.1761037904; intercom-id-ny9cf50h=9b74c876-b6a5-4538-98a6-a91fe40c7768; intercom-device-id-ny9cf50h=f207003a-f97b-4c07-b1ff-997d05da27f4; fp_s=0; ftID=undefined; x-lid=undefined; ok_login_type=OKX_GLOBAL; u_pid=D6D6lm9rEC5jB70; locale=zh_CN; preferLocale=zh_CN; ok_prefer_currency=0%7C1%7Cfalse%7CUSD%7C2%7C%24%7C1%7C1%7C%E7%BE%8E%E5%85%83; im-token=; okg.currentMedia=xl; ok_global={%22okg_m%22:%22xl%22}; tmx_session_id=tl8ph9vjyw8_1761053434915; finger_test_cookie=1761053452326; g_state={"i_l":0,"i_ll":1761053446215}; token=eyJraWQiOiIxMzYzODYiLCJhbGciOiJFUzI1NiJ9.eyJqdGkiOiJleDExMDE3NjEwNTM0NzYyNDQyMDRFRDZFNjNBQUREQjM2MWNaclQiLCJ1aWQiOiJkRTZBRCtNOVJ4dVFub0ZQWHY2V1pRPT0iLCJzdGEiOjAsIm1pZCI6ImRFNkFEK005Unh1UW5vRlBYdjZXWlE9PSIsInBpZCI6IlBUeUE4VzA5ekZVSkJHSjZZUk5HWXc9PSIsIm5kZSI6MCwiaWF0IjoxNzYxMDUzNDc2LCJleHAiOjE3NjIyNjMwNzYsImJpZCI6MCwiZG9tIjoid3d3Lm9reC5jb20iLCJlaWQiOjE0LCJpc3MiOiJva2NvaW4iLCJkaWQiOiJQaC9iaWNiazFrcm9wV1VRcjFJek1sa1VyZlhUYnJEL3VJWklLQzNsTHczV3NxdW0zU2tPeDFMZW0vUFBIMER3IiwiZmlkIjoiUGgvYmljYmsxa3JvcFdVUXIxSXpNbGtVcmZYVGJyRC91SVpJS0MzbEx3M1dzcXVtM1NrT3gxTGVtL1BQSDBEdyIsImxpZCI6ImRFNkFEK005Unh1UW5vRlBYdjZXWlE9PSIsInVmYiI6IlBUeUE4VzA5ekZVSkJHSjZZUk5HWXc9PSIsInVwYiI6ImlCcmEyVmhOb2t5UmloeGlKLzN6RXc9PSIsImt5YyI6Miwia3lpIjoic1ZrUEh4ak1Hb2Fhc2o2Z3RXMVB4N2RUcENaS2c1LzZLbjFteGFpclpDbE84cWtiMWJMdGFmMklSVUtrTDd4RTd5ZEYvWU5DR1FXLzV5aTRWQnpUM1E9PSIsImNwayI6ImhCdjNtSEZjb0lETG5TckZ6dEdTTlpMT29aU2s1bUE4SHBQcE9MOFE1TlV0WFhqcmhYRjExeFI4TDBnUnhHM09CWk9mbGZvaWVqWkQva0FrYkl0VStWNEFXZ2g4OWQzQ0ZIMFpsWDFPWmJaRjg1SzljeHJRODB1ektIRkc5L3UyL1ZHb0dOdnh4TmtFV094YnF5ZXZNT2VSaklGS1R1d3QwRWliY3hJaTZ6OD0iLCJ2ZXIiOjEsImNsdCI6MiwidXVkIjoiN2Vrcm5KTDZ5bFVlL0lZZXhSM2xPKzMzZzhQaS9KdkJCTzNoQlNrL1JyUT0iLCJzdWIiOiJCMjVGNEM3ODE1QTNCMEQ2OTE4RTFERkRBM0M0MjRGRSJ9.K-67xUu7aop1KRdS8t7TYZhgwf24vGxnn2Y8y9oWnPa4Nrx9RUx3ov8B4170QyYOA6KZFrDB3VQ_hRW_n17vGg; isLogin=1; ok_site_info==0HNxojI5RXa05WZiwiIMFkQPx0Rfh1SPJiOiUGZvNmIsICRJJiOi42bpdWZyJye; _tk=sNVAtGFfdr557AfYS2Evkg==; traceId=2141010534772560012; _ga=GA1.1.2076758022.1761037904; intercom-session-ny9cf50h=M1VNNVRmeTkxVU9JaUNJa2VhcDEvaS9rNnBMa3hFZlZOQUd1ZmRnbDQzNnQrWFJVSXRXeHQwMFI2Nm5EbFQwVjF2SkdQZ1RZZ0N4SFozQUNIbmJxZ0ZMQnFvSUpMaENjMVlLSThWWmh0TTg9LS05bTBSYjI2Mk91cVp3YUpIY2Juemh3PT0=--ee56067dace6de2c7d3ec23c07baf6bfc8773183; __cf_bm=s8Q.8X750GNWjjDOQVphIHFlLqsPWihc4JSGniDYQBs-1761053894-1.0.1.1-NH48.YaqRM3GL0TOqQX4FNrbqBARjq9YgjYRY2CRdOIccNUvI4j.grRI08PSAYJwhACCIduj0BLuVxvf.HRyNhuIDij3m_QPVD6RofRr34s; _ga_G0EKWWQGTZ=GS2.1.s1761052161$o3$g1$t1761054088$j60$l0$h0; ok-ses-id=g0Q1XLQNccelRL/nn4hqe6vc8FE9FqEi/1Dj2XbSQdulIFNkVQHUDoe29j1rCH7mgklazPFZbbUaftMc4YJxTsDHuPwKYI4Zj6JQjvNlb4P7uzjsKY4bvc3B5+wQI/8M; _monitor_extras={"deviceId":"to05fxWRiFJkh9XdXbfCIt","eventId":655,"sequenceNumber":655}
devid
ad206bea-c819-45d1-8061-cab15fa520b5
origin
https://www.okx.com
priority
u=1, i
referer
https://www.okx.com/zh-hans/trade-spot/dood-usdt
sec-ch-ua
"Google Chrome";v="141", "Not?A_Brand";v="8", "Chromium";v="141"
sec-ch-ua-mobile
?0
sec-ch-ua-platform
"macOS"
sec-fetch-dest
empty
sec-fetch-mode
cors
sec-fetch-site
same-origin
user-agent
Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36
x-cdn
https://www.okx.com
x-client-signature
{P1363}nxSj89pwaZqvsYvX9zyr9lXg6T57GZ5aUgNbLvaDnbjb+0CtYbHpWtj7UQmrIpVLw8+8wfRSXP6gokTAe3/10g==
x-client-signature-version
1.3
x-id-group
2141010534772560012-c-69
x-locale
zh_CN
x-request-timestamp
1761054129404
x-simulated-trading
undefined
x-site-info
=0HNxojI5RXa05WZiwiIMFkQPx0Rfh1SPJiOiUGZvNmIsICRJJiOi42bpdWZyJye
x-utc
8
x-zkdex-env
0
`;
  let ss = headers.split("\n");
  let json = {};
  let keys = ["content-type", "app-type", "authorization", "devid", "x-cdn",
    "x-client-signature", "x-client-signature-version", "x-id-group", "x-locale"
    , "x-simulated-trading", "x-site-info", "x-utc", "x-zkdex-env", "cookie"].join(",");
  for (let i = 0; i < ss.length - 1;) {
    let key = ss[i];
    if (keys.indexOf(key) >= 0) {
      let value = ss[i + 1];
      json[key] = value;
    }

    i += 2;
  }

  window.okx = {};
  window.okx.lqhHeaders = json;

  window.okx.buyDelta = 0.00001;
  window.okx.sellDelta = 0.00001;
  window.okx.orderId = [];
  window.okx.maxDelta = 0.0001;
  window.okx.stock = "DOOD-USDT";
  config();
}
window.okx = {
  "lqhHeaders": {
    "app-type": "web",
    "authorization": "eyJraWQiOiIxMzYzODYiLCJhbGciOiJFUzI1NiJ9.eyJqdGkiOiJleDExMDE3NjEwMzgyMTgxOTJBRjcxRjUwRjQ5OEVBMUYyMUxKYlUiLCJ1aWQiOiJkRTZBRCtNOVJ4dVFub0ZQWHY2V1pRPT0iLCJzdGEiOjAsIm1pZCI6ImRFNkFEK005Unh1UW5vRlBYdjZXWlE9PSIsInBpZCI6IlBUeUE4VzA5ekZVSkJHSjZZUk5HWXc9PSIsIm5kZSI6MCwiaWF0IjoxNzYxMDM5MTIwLCJleHAiOjE3NjIyNDg3MjAsImJpZCI6MCwiZG9tIjoid3d3Lm9reC5jb20iLCJlaWQiOjE0LCJpc3MiOiJva2NvaW4iLCJkaWQiOiJQaC9iaWNiazFrcm9wV1VRcjFJek1sa1VyZlhUYnJEL3VJWklLQzNsTHczV3NxdW0zU2tPeDFMZW0vUFBIMER3IiwiZmlkIjoiUGgvYmljYmsxa3JvcFdVUXIxSXpNbGtVcmZYVGJyRC91SVpJS0MzbEx3M1dzcXVtM1NrT3gxTGVtL1BQSDBEdyIsImxpZCI6ImRFNkFEK005Unh1UW5vRlBYdjZXWlE9PSIsInVmYiI6IlBUeUE4VzA5ekZVSkJHSjZZUk5HWXc9PSIsInVwYiI6ImlCcmEyVmhOb2t5UmloeGlKLzN6RXc9PSIsImt5YyI6Miwia3lpIjoic1ZrUEh4ak1Hb2Fhc2o2Z3RXMVB4N2RUcENaS2c1LzZLbjFteGFpclpDbE84cWtiMWJMdGFmMklSVUtrTDd4RTd5ZEYvWU5DR1FXLzV5aTRWQnpUM1E9PSIsImNwayI6ImhCdjNtSEZjb0lETG5TckZ6dEdTTlpMT29aU2s1bUE4SHBQcE9MOFE1TlV0WFhqcmhYRjExeFI4TDBnUnhHM09CWk9mbGZvaWVqWkQva0FrYkl0VStWNEFXZ2g4OWQzQ0ZIMFpsWDFPWmJaRjg1SzljeHJRODB1ektIRkc5L3UyL1ZHb0dOdnh4TmtFV094YnF5ZXZNT2VSaklGS1R1d3QwRWliY3hJaTZ6OD0iLCJ2ZXIiOjEsImNsdCI6MiwidXVkIjoiN2Vrcm5KTDZ5bFVlL0lZZXhSM2xPKzMzZzhQaS9KdkJCTzNoQlNrL1JyUT0iLCJzdWIiOiJCMjVGNEM3ODE1QTNCMEQ2OTE4RTFERkRBM0M0MjRGRSJ9.whVFgkZmklMLGOywntCmtr69YBJieHA2OH0mze59Ki5BNW-NSOxZhKrxPNaOKLAR-LUBlQIeEqi_LzkcfJrgig",
    "content-type": "application/json",
    "devid": "ad206bea-c819-45d1-8061-cab15fa520b5"
  },
  "buyDelta": 0.00001,
  "sellDelta": 0.00001,
  "orderId": [],
  "maxDelta": 0.0001,
  "stock": "DOOD-USDT"
}