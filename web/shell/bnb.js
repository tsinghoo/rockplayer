
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


//valid code start

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


function init() {

  let headers =
    `baggage
sentry-environment=prod,sentry-release=20250924-d1d0004c-2900,sentry-public_key=9445af76b2ba747e7b574485f2c998f7,sentry-trace_id=ec4ae78043fc459ea73416fa1133f797,sentry-sample_rate=0.01,sentry-transaction=%2Falpha%2F%24chainSymbol%2F%24contractAddress,sentry-sampled=false
bnc-uuid
67e6afe2-047e-4d30-bdc1-19151112790b
clienttype
web
content-length
194
content-type
application/json
cookie
bnc-uuid=67e6afe2-047e-4d30-bdc1-19151112790b; BNC_FV_KEY=3305c6443bdca07787f83231ec0fc6da0757b0c6; OptanonAlertBoxClosed=2025-10-03T02:13:21.738Z; _gcl_au=1.1.1685839591.1759457606; _gid=GA1.2.1778629017.1759563539; lang=zh-CN; language=zh-CN; se_gd=AJXEVDgUEGbCwxbxXUA9gZZCFDQoXBSWlIOVZUkd1hRWwV1NWVBU1; se_gsd=Sjo2GgpVIwAiBjcmJzInIyk9VBMGDgUHUVxBW1ZTVlhXJFNT1; currentAccount=; _ga_MEG0BSW76K=GS2.1.s1759586256$o1$g1$t1759586422$j60$l0$h0; g_state={"i_l":0}; isAccountsLoggedIn=y; BNC-Location=CN; userPreferredCurrency=USD_USD; forterToken=8bab0270232a41f9a898284c4156659a_1759635706349__UDF43-mnf-a4_21ck_; aws-waf-token=dc432087-c592-4555-b92f-f02c31bac4d0:BgoAnHkSP38pAAAA:zD+2/LRijTtX9jqfZof4RBErnFX1KCcRUcFDSqLp6A1gtN2y8ZvX6s1l+03nKss8GdWzjiVo0bSBlxoPMl+8O4OMX6h/y9pQlQMFhuhvx+l3BeIpDpsjzupWG/4uExFIQnt3ccqrnj5CYRawxYNMOqQtntRthag/pku4JbYcBb+KFy8MzpHw1ertiBt/ffAQWd8=; changeBasisTimeZone=; sensorsdata2015jssdkcross=%7B%22distinct_id%22%3A%2229062185%22%2C%22first_id%22%3A%22199a7d80d15581-0879b6d1278a92-1f525631-1764000-199a7d80d16b7b%22%2C%22props%22%3A%7B%22%24latest_traffic_source_type%22%3A%22%E7%9B%B4%E6%8E%A5%E6%B5%81%E9%87%8F%22%2C%22%24latest_search_keyword%22%3A%22%E6%9C%AA%E5%8F%96%E5%88%B0%E5%80%BC_%E7%9B%B4%E6%8E%A5%E6%89%93%E5%BC%80%22%2C%22%24latest_referrer%22%3A%22%22%2C%22aws_waf_referrer%22%3A%22%7B%5C%22referrer%5C%22%3A%5C%22https%3A%2F%2Fwww.google.com%2F%5C%22%7D%22%7D%2C%22identities%22%3A%22eyIkaWRlbnRpdHlfY29va2llX2lkIjoiMTk5YTdkODBkMTU1ODEtMDg3OWI2ZDEyNzhhOTItMWY1MjU2MzEtMTc2NDAwMC0xOTlhN2Q4MGQxNmI3YiIsIiRpZGVudGl0eV9sb2dpbl9pZCI6IjI5MDYyMTg1In0%3D%22%2C%22history_login_id%22%3A%7B%22name%22%3A%22%24identity_login_id%22%2C%22value%22%3A%2229062185%22%7D%2C%22%24device_id%22%3A%22199af83906a75-0bf04d3d7a0ff3-1e525631-1764000-199af83906b4da%22%7D; se_sd=ARQDxA1wWAJBVIX8bCVEgZZUwD1FREWVlQBNdW0N1hcUwBFNWVwN1; logined=y; theme=dark; neo-theme=dark; _h_desk_key=b404d81d4e3e417b8452d7c1fd14dc0f; BNC_FV_KEY_T=101-B1E0UdWWZEszlY1%2FRYXJqUi3AxtjLhYS68%2BcTBoc5iblxeZE8PgSqyrDvMoIT%2B9NOkboLoqC6q2Lm%2FSyV9qdZw%3D%3D-hvOuaLgzu80%2BHb2HKMlcMA%3D%3D-ef; BNC_FV_KEY_EXPIRE=1759845992278; _uetsid=33ac7200a0f511f0a14e872544e61aa9; _uetvid=8c9cd7f09ffe11f0bdf9cd4c1d08b540; r20t=web.E7A4468099130083135C67DFA0877E54; r30t=1; cr00=CA1EEE414DBF10AACB8F7661AE9D721D; d1og=web.29062185.8BFAEA5EC52A9BBC189AAF375569AEA1; r2o1=web.29062185.B3AE7E51C50075703E7CB7FC3365C2FD; f30l=web.29062185.26174C47C72653F78E5C9E524A0C3038; p20t=web.29062185.1EFFAA770C9C83CE3ADB2BAE4E2C1B37; _ga_3WP50LGEEC=GS2.1.s1759824383$o16$g1$t1759829198$j8$l0$h0; OptanonConsent=isGpcEnabled=0&datestamp=Tue+Oct+07+2025+17%3A26%3A39+GMT%2B0800+(%E4%B8%AD%E5%9B%BD%E6%A0%87%E5%87%86%E6%97%B6%E9%97%B4)&version=202506.1.0&browserGpcFlag=0&isIABGlobal=false&hosts=&consentId=6298cb37-9de2-41b1-804b-070908bdd651&interactionCount=2&isAnonUser=1&landingPath=NotLandingPage&groups=C0001%3A1%2CC0003%3A1%2CC0004%3A1%2CC0002%3A1&intType=1&geolocation=CN%3BBJ&AwaitingReconsent=false; _ga=GA1.2.1791296862.1759457604; _gat=1
csrftoken
a0cc633b00ec01523a8ca6a6c4bcbf9d
device-info
eyJzY3JlZW5fcmVzb2x1dGlvbiI6IjE2ODAsMTA1MCIsImF2YWlsYWJsZV9zY3JlZW5fcmVzb2x1dGlvbiI6IjE2ODAsMTAyNSIsInN5c3RlbV92ZXJzaW9uIjoibWFjT1MgMTAuMTUuNyIsImJyYW5kX21vZGVsIjoiZGVza3RvcCBBcHBsZSBNYWNpbnRvc2ggIiwic3lzdGVtX2xhbmciOiJ6aC1DTiIsInRpbWV6b25lIjoiR01UKzA4OjAwIiwidGltZXpvbmVPZmZzZXQiOi00ODAsInVzZXJfYWdlbnQiOiJNb3ppbGxhLzUuMCAoTWFjaW50b3NoOyBJbnRlbCBNYWMgT1MgWCAxMF8xNV83KSBBcHBsZVdlYktpdC81MzcuMzYgKEtIVE1MLCBsaWtlIEdlY2tvKSBDaHJvbWUvMTQxLjAuMC4wIFNhZmFyaS81MzcuMzYiLCJsaXN0X3BsdWdpbiI6IlBERiBWaWV3ZXIsQ2hyb21lIFBERiBWaWV3ZXIsQ2hyb21pdW0gUERGIFZpZXdlcixNaWNyb3NvZnQgRWRnZSBQREYgVmlld2VyLFdlYktpdCBidWlsdC1pbiBQREYiLCJjYW52YXNfY29kZSI6IjNmYTgyM2QxIiwid2ViZ2xfdmVuZG9yIjoiR29vZ2xlIEluYy4gKEludGVsIEluYy4pIiwid2ViZ2xfcmVuZGVyZXIiOiJBTkdMRSAoSW50ZWwgSW5jLiwgSW50ZWwoUikgSXJpcyhUTSkgR3JhcGhpY3MgNjEwMCwgT3BlbkdMIDQuMSkiLCJhdWRpbyI6IjEyNC4wNDM0NzY1NzgwODEwMyIsInBsYXRmb3JtIjoiTWFjSW50ZWwiLCJ3ZWJfdGltZXpvbmUiOiJBc2lhL1NoYW5naGFpIiwiZGV2aWNlX25hbWUiOiJDaHJvbWUgVjE0MS4wLjAuMCAobWFjT1MpIiwiZmluZ2VycHJpbnQiOiIwMGE1MWM1Zjc3ZTkzMjM3YWI0MTRmMTBiMDY0ZTgxZSIsImRldmljZV9pZCI6IiIsInJlbGF0ZWRfZGV2aWNlX2lkcyI6IiJ9
fvideo-id
3305c6443bdca07787f83231ec0fc6da0757b0c6
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

  window.lqhHeaders = json;

  window.delta = 0.00001;
  window.orderId = [];
  window.maxDelta = 0.0001;
  window.stock="pingpong";
  window.stocks = {
    aop: "ALPHA_382",
    pingpong: "ALPHA_368"
  }
  config();
}

function config() {
  console.log("Headers:", window.lqhHeaders);
  console.log("Delta:", window.delta);
  console.log("OrderId:", window.orderId);
}

async function buy(amount, buyPrice, sellPrice, notTest) {
  let quantity = amount / buyPrice;
  quantity = Math.floor(quantity * 100) / 100;

  let url = "https://www.binance.com/bapi/asset/v1/private/alpha-trade/oto-order/place"; //post

  buyPrice = convertIfInteger(buyPrice, 8);
  sellPrice = convertIfInteger(sellPrice, 8);
  amount = quantity * buyPrice;
  amount = Math.floor(amount * 100000000) / 100000000;
  const json = {
    "baseAsset": window.stocks[window.stock],
    "quoteAsset": "USDT",
    "workingSide": "BUY",
    "workingPrice": buyPrice,
    "workingQuantity": quantity,
    "paymentDetails":
      [{ "amount": amount, "paymentWalletType": "CARD" }],
    "pendingPrice": sellPrice
  };

  console.log(JSON.stringify(json, null, 2));
  if (window.maxDelta == null) {
    window.maxDelta = 0.0001;
  }
  if (sellPrice - buyPrice > maxDelta) {
    console.log("价格差异超过最大允许值", maxDelta);
    return;
  }

  if (notTest) {
    // 发送 POST 请求
    console.log("POST to " + url);
    window.quantity = quantity;
    fetch(url, {
      method: 'POST',
      headers: window.lqhHeaders,
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
          window.orderId = [resp.data.workingOrderId, resp.data.pendingOrderId];
          console.log("订单创建成功", window.orderId);
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
    quantity = window.quantity;
  }

  let url = "https://www.binance.com/bapi/asset/v1/private/alpha-trade/order/place"; //post
  let pprice = sellPrice;
  pprice = convertIfInteger(pprice, 8);
  const json = {
    "baseAsset": window.stocks[window.stock],
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
      headers: window.lqhHeaders,
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
          window.orderId = [0, resp.data];
          console.log("订单创建成功", window.orderId);
        } else {
          console.log("订单创建失败", resp.message);
        }
      })
      .catch(error => {
        console.error('请求失败:', error);
      });
  }


}


async function buymin(amount, notTest) {
  let peles = $$(".text-PrimaryText .ReactVirtualized__Grid__innerScrollContainer .items-center .cursor-pointer");
  let min = 0, max = 0;
  for (let i = 0; i < 3; i++) {
    let pe = peles[i];
    let text = pe.innerText;
    if (i == 0) {
      min = parseFloat(text);
      max = parseFloat(text);
    } else {
      min = Math.min(min, parseFloat(text));
      max = Math.max(max, parseFloat(text));
    }
  }

  console.log("min:", min);
  console.log("max:", max);

  buy(amount, min, min - window.delta, notTest);

}

async function buymax(amount, notTest) {
  let peles = $$(".text-PrimaryText .ReactVirtualized__Grid__innerScrollContainer .items-center .cursor-pointer");
  let min = 0, max = 0;
  for (let i = 0; i < 3; i++) {
    let pe = peles[i];
    let text = pe.innerText;
    if (i == 0) {
      min = parseFloat(text);
      max = parseFloat(text);
    } else {
      min = Math.min(min, parseFloat(text));
      max = Math.max(max, parseFloat(text));
    }
  }

  console.log("min:", min);
  console.log("max:", max);

  buy(amount, max, max - window.delta, notTest);

}
async function buyminmax(amount, notTest) {
  let peles = $$(".text-PrimaryText .ReactVirtualized__Grid__innerScrollContainer .items-center .cursor-pointer");
  let min = 0, max = 0;
  for (let i = 0; i < 3; i++) {
    let pe = peles[i];
    let text = pe.innerText;
    if (i == 0) {
      min = parseFloat(text);
      max = parseFloat(text);
    } else {
      min = Math.min(min, parseFloat(text));
      max = Math.max(max, parseFloat(text));
    }
  }

  console.log("min:", min);
  console.log("max:", max);

  buy(amount, max, min, notTest);

}


async function cancel(i) {
  let url = "https://www.binance.com/bapi/defi/v1/private/alpha-trade/order/cancel"; //post
  const json = { "orderId": window.orderId[i], "symbol": window.stocks[window.stock] + "USDT" };

  console.log(JSON.stringify(json, null, 2));

  // 发送 POST 请求
  fetch(url, {
    method: 'POST',
    headers: window.lqhHeaders,
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



async function cancelall(i) {
  let url = "https://www.binance.com/bapi/defi/v1/private/alpha-trade/order/cancel-all"; //post
  const json = {};

  console.log(JSON.stringify(json, null, 2));

  // 发送 POST 请求
  fetch(url, {
    method: 'POST',
    headers: window.lqhHeaders,
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
  let peles = $$(".text-PrimaryText .ReactVirtualized__Grid__innerScrollContainer .items-center .cursor-pointer");
  let min = 0, max = 0;
  for (let i = 0; i < 3; i++) {
    let pe = peles[i];
    let text = pe.innerText;
    if (i == 0) {
      min = parseFloat(text);
      max = parseFloat(text);
    } else {
      min = Math.min(min, parseFloat(text));
      max = Math.max(max, parseFloat(text));
    }
  }

  console.log("min:", min);
  console.log("max:", max);
  sell(min, 0, 1);
}