import os
import shutil
import random
import threading
import time

import datetime
import json
import inspect

import requests
import sys
import traceback
from threading import Thread
import asyncio
# import websocket
import okx.Trade as Trade

import okx.MarketData as MarketData
import okx.Account as Account
from prompt_toolkit import PromptSession
from prompt_toolkit.history import FileHistory


HISTORY_FILE = os.path.expanduser('~/.pt_shell_history')


class G():
    pass


g = G()


g.account = "620000558442"  # 国信
g.account = "8883949249"  # 国金
g.broker = "国金"

g.orderId = "null"
g.stock = "null"

g.session_id = random.randint(1000, 10000)
g.subscribeId = 0
g.tick = {}
g.actions = {}
g.reloadK1d = []
g.uploading = 0
g.stocklist = ['000300.SH', '000004.SZ']

g.baseUrl = "http://192.168.66.205:3001"
g.baseUrl = "http://test1.91taogu.com"

g.usdtStart = 119.8176451524
g.usdtLast = g.usdtStart
g.usdt = g.usdtStart
g.log = {
    "level": 4,
    "none": 0,
    "error": 1,
    "warning": 2,
    "info": 3,
    "debug": 4,
}

g.log["level"] = g.log["debug"]

g.toPrint = []
today = datetime.datetime.now().date()
threadLocal = threading.local()


def geMarketData():
    flag = "1"  # live trading: 0, demo trading: 1
    mapi = MarketData.MarketAPI(flag=flag)
    result = mapi.get_tickers(instType="SPOT")
    debug(result)
    return result


def getPrice(stock):
    info(f"getPrice {stock}")
    if not stock.endswith("-USDT"):
        stock += "-USDT"
    result = geMarketData()
    if result["code"] == "0":
        for item in result["data"]:
            if item["instId"] == stock:
                price = float(item["bidPx"])
                return price
    else:
        error(f"getPrice Failed，error_code = ",
              result["data"][0]["sCode"], ", Error_message = ", result["data"][0]["sMsg"])
        return None


def getPair():

    accountAPI = Account.AccountAPI(
        g.apikey, g.secretkey, g.passphrase, False, g.flag)

    result = accountAPI.get_instruments(instType="SPOT")
    print(result)


def getBalance():
    info("getBalance")

    accountAPI = Account.AccountAPI(
        g.apikey, g.secretkey, g.passphrase, False, g.flag)

    result = accountAPI.get_account_balance()
    debug(result)

    balances = {}
    for i in result["data"]:
        for field in i["details"]:
            balances[field["ccy"]] = field["availBal"]

    info(balances)
    g.balances = balances
    g.usdtLast = g.usdt
    g.usdt = float(balances["USDT"])
    info(f'总增量:{g.usdt-g.usdtStart}\n增量:{g.usdt-g.usdtLast}')


def getAccountConfig():
    flag = "1"  # live trading: 0, demo trading: 1
    accountAPI = Account.AccountAPI(
        g.apikey, g.secretkey, g.passphrase, False, g.flag)

    result = accountAPI.get_account_config()
    print(result)
    if result['code'] == "0":
        acctLv = result["data"][0]["acctLv"]
    if acctLv == "1":
        print("Simple mode")
    elif acctLv == "2":
        print("Single-currency margin mode")
    elif acctLv == "3":
        print("Multi-currency margin mode")
    elif acctLv == "4":
        print("Portfolio margin mode")


def prod():
    info("prod")
    g.apikey = "1315b7af-d17e-4582-8de7-2919f4de5f20"
    g.secretkey = "EB46A9E766BFE107F37B882443FCB780"
    g.flag = "0"
    g.passphrase = "OkxPassw0rd!"
    g.tradeApi = Trade.TradeAPI(
        g.apikey, g.secretkey, g.passphrase, False, g.flag)


def test():
    info("test")
    g.apikey = "e9b7be84-d6e4-4176-86ef-6b695a2844ca"
    g.secretkey = "F0F9ED582D44E2F7ED116D96D2F99F86"
    g.flag = "1"
    g.passphrase = "OkxPassw0rd!"

    g.tradeApi = Trade.TradeAPI(
        g.apikey, g.secretkey, g.passphrase, False, g.flag)


def buy(stock, price, total):
    # limit order
    g.stock = stock
    amount = total/price
    amount = amount.__format__(".8f")
    info(f"buy {stock} {amount} @ {price}")
    result = g.tradeApi.place_order(
        instId=stock+"-USDT",  # "BTC-USDT",
        tdMode="cash",
        side="buy",
        ordType="limit",
        px=price,  # "19000",
        sz=amount,  # "0.01"
    )

    print(result)

    if result["code"] == "0":
        g.orderId = result["data"][0]["ordId"]
        info(f"buy OK，order_id = {g.orderId}")
        getOrderList()
    else:
        print("buy Failed，error_code = ",
              result["data"][0]["sCode"], ", Error_message = ", result["data"][0]["sMsg"])


def buyMarket(stock, amount):
    # limit order
    g.stock = stock
    info(f"buy {stock} ${amount} @ market price")
    result = g.tradeApi.place_order(
        instId=stock+"-USDT",  # "BTC-USDT",
        tdMode="cash",
        side="buy",
        ordType="market",
        sz=amount,  # "0.01"
    )

    print(result)

    if result["code"] == "0":
        g.orderId = result["data"][0]["ordId"]
        info(f"buy OK，order_id = {g.orderId}")
        getOrderList()
    else:
        print("buy Failed，error_code = ",
              result["data"][0]["sCode"], ", Error_message = ", result["data"][0]["sMsg"])


def sellAllMarket(stock):
    info(f"sellAllMarket {stock}")
    getBalance()
    g.stock = stock
    amount = g.balances[stock]
    info(f"sell {stock} {amount} @ market price")
    result = g.tradeApi.place_order(
        instId=stock+"-USDT",  # "BTC-USDT",
        tdMode="cash",
        side="sell",
        ordType="market",
        sz=amount,  # "0.01"
    )

    print(result)

    if result["code"] == "0":
        g.orderId = result["data"][0]["ordId"]
        info(f"buy OK，order_id = {g.orderId}")
        getOrderList()
    else:
        print("buy Failed，error_code = ",
              result["data"][0]["sCode"], ", Error_message = ", result["data"][0]["sMsg"])


def cancelAll():
    info("cancelAll")
    getOrderList()

    # 对g.orders里的每一个订单，调用cancel_order
    for order in g.orders:
        cancelOrder(order["orderId"])


def cancelOrder(orderId, stock):
    if stock is None:
        stock = g.stock
    # 如果stock不是以"-USDT"结尾，添加"-USDT"
    if not stock.endswith("-USDT"):
        stock += "-USDT"
    result = g.tradeApi.cancel_order(
        instId=stock,  # "BTC-USDT",
        ordId=orderId,
    )

    print(result)

    if result["code"] == "0":
        info(f"cancel OK，order_id = {g.orderId}")
    else:
        print("cancel Failed，error_code = ",
              result["data"][0]["sCode"], ", Error_message = ", result["data"][0]["sMsg"])


def getOrderList(stock=None):
    info("getOrderList")
    result = g.tradeApi.get_order_list(
        # instId=g.stock,  # "BTC-USDT",
    )

    print(result)

    orders = []
    for i in result["data"]:
        orders.append({"stock": i["instId"], "orderId": i["ordId"], "side": i["side"],
                      "price": i["px"], "amount": i["sz"], "state": i["state"], "time": i["cTime"]})

    info(orders)
    g.orders = orders


async def websocket_client():
    info("start websocket_client")
    uri = g.baseUrl.replace("http", "ws")
    info(f"websocket connecting to {uri}")
    try:
        # 连接到 WebSocket 服务器
        async with websocket.connect(uri) as wsc:
            info(f"websocket connected to {uri}")

            while True:
                response = await wsc.recv()
                info(f"ws received: {response}")
                # 解析 JSON 消息
                try:
                    message = json.loads(response)
                    # 处理消息
                    if message["func"] == "register":
                        response = {
                            "id": message["id"],
                            "clientId": g.broker,
                        }

                        await wsc.send(json.dumps(response))
                        info(f"发送消息: {response}")

                    elif message["func"] == "reloadStockCodes":
                        params = message["params"]
                        response = {
                            "id": message["id"]
                        }

                        await wsc.send(json.dumps(response))
                        info(f"发送消息: {response}")

                        g.stocklist = getStockList()
                        resubscribe()
                    elif message["func"] == "forceUpdate1d":
                        params = message["params"]
                        scode = params["scode"]
                        startTime = datetime.datetime.now().strftime("%Y%m%d%H")
                        update1d([scode], startTime)

                        response = {
                            "id": message["id"]
                        }

                        await wsc.send(json.dumps(response))
                        info(f"发送消息: {response}")
                    else:
                        error(f"未知消息类型")
                except json.JSONDecodeError:
                    error(f"ws decode error: {response}")
                    continue

                await asyncio.sleep(1)

    except websocket.exceptions.ConnectionClosed:
        error("websocket closed")
    except Exception as e:
        error(f"websocket connect error: {e}")


def updateDeal(deal):
    try:
        info("updateDeal:", deal)
        # 目标 URL
        url = g.baseUrl+"/stock/deal/update"
        info("url:", url)
        info("data:", json.dumps(deal))
        # 设置请求头（声明内容类型为 JSON）
        headers = {
            "Content-Type": "application/json"
        }

        # 发送 POST 请求
        response = requests.post(url, data=json.dumps(
            deal), verify=False, headers=headers)

        # 输出响应
        debug("updateDeal:", response.status_code)
        debug("response:", response.text)

    except Exception as e:
        error("updateDeal 出错:", traceback.format_exc())


def saveConfig():
    # 备份g.configFile到g.configFile+".bak"
    shutil.copy(g.configFile, g.configFile+".bak")

    with open(g.configFile, 'w') as f:
        json.dump(g.config, f)


def init():
    print(sys.version)
    print(sys.executable)
    test()


def getStockList():
    # 从test1获取股票列表
    try:
        response = requests.get(
            g.baseUrl + "/stock/codes", verify=False, timeout=5)
        if response.status_code != 200:
            print("请求失败，状态码:", response.status_code)
            return g.stocklist
        else:
            print("获取stock codes成功:", response.status_code)
            response.encoding = 'utf-8'
            content = response.text
            print(content)
            return json.loads(content)

    except Exception as e:
        print("获取stockk list失败:", str(e))
        return g.stocklist


def get1dLastDate(scode):
    # 从test1获取股票列表
    try:
        url = g.baseUrl + "/stock/1d/lastDate?scode=" + scode
        debug("get", url)
        response = requests.get(url, verify=False, timeout=5)
        if response.status_code != 200:
            error("getLast1dDate failed:", response.status_code)
            return
        else:
            response.encoding = 'utf-8'
            content = response.text
            debug(content)
            return json.loads(content)["lastDate"]

    except Exception as e:
        error("getLast1dDate failed:", str(e))


def uploadStockPrice():
    # 组装成json对象post到test1.91taogu.com
    # 为data添加passcode属性
    sb, g.tick = g.tick, {}  # 这行是原子的
    if (len(list(sb)) < 1):
        info("0 stocks, skip upload")
        return
    info("上传", len(list(sb)), "个股票价格")
    # info(sb.keys())
    try:
        response = requests.post(g.baseUrl+"/stock/quotes.mini", json={
            "data": sb, "passcode": "995560"}, verify=False, timeout=5)
        if response.status_code != 200:
            error("请求失败，状态码:", response.status_code)
            return
        else:
            response.encoding = 'utf-8'
            # info("请求test1成功:", response.status_code, response.text)
    except Exception as e:
        error("请求失败:", str(e))


def getStockDetail(scode):
    info("getStockDetail", scode)
    si = xtdata.get_instrument_detail(scode)
    if (si is None):
        error(scode, "error")
        return None
    detail = {
        "scode": scode,
        "sname": si["InstrumentName"],
        "ExchangeID": si["ExchangeID"],
        "LastVolume": si["LastVolume"],
        "TotalVolume": si["TotalVolume"],
        "FloatVolume": si["FloatVolume"],
        "UpStopPrice": si["UpStopPrice"],
        "DownStopPrice": si["DownStopPrice"],
        # "bNotProfitable": si["bNotProfitable"],
        "VolumeMultiple": si["VolumeMultiple"]
    }

    return detail


def uploadPosition(positions=None):
    # 组装成json对象post到test1.91taogu.com
    url = g.baseUrl+"/stock/positions"
    body = {"broker": g.broker, "clean": 1, "passcode": "995560"}
    if (positions is None):
        info("clean股票持仓")
    else:
        info("上传", len(positions), "个股票持仓")

        # positions 里的没个元素只保留 broker 属性
        data = []
        for position in positions:
            data.append({
                "broker": g.broker,
                "account_id": position["account_id"],
                "avg_price": position["avg_price"],
                "can_use_volume": position["can_use_volume"],
                "frozen_volume": position["frozen_volume"],
                "market_value": position["market_value"],
                "on_road_volume": position["on_road_volume"],
                "open_price": position["open_price"],
                "stock_code": position["stock_code"],
                "volume": position["volume"]
            })
        body = {"data": data, "passcode": "995560"}
        info(url, "\n", body)
    try:
        response = requests.post(url, json=body, verify=False, timeout=5)
        if response.status_code != 200:
            error("上传持仓失败，状态码:", response.status_code)
            return
        else:
            response.encoding = 'utf-8'
            info("上传持仓到test1成功:", response.status_code, response.text)
    except Exception as e:
        info("请求失败:", str(e))


def resetThreadId(label=""):
    threadLocal.id = label + datetime.datetime.now().strftime("%H%M%S") + \
        str(random.randint(0, 1000))


def update1dTask():
    info("update1dTask")
    g.candidates = getCandidates()
    # update1d(g.candidates, (datetime.datetime.now() - datetime.timedelta(days=370)).strftime("%Y%m%d"))
    update1d(g.candidates)

    g.ruleCodes = getRuleCodes()
    update1d(g.ruleCodes)

    while True:
        time.sleep(1)
        resetThreadId("u1d")
        reloadK1d, g.reloadK1d = g.reloadK1d, []
        if len(reloadK1d) > 0:
            info("reloading 1d data")
            for scode in reloadK1d:
                updateActionOrdered(scode, "", "56", 0, "")
                update1d([scode.replace(".HGT", ".HK")], "20210101", "")
        g.stocklist = getStockList()
        update1d(g.stocklist)

        updateLastStartTime1d()
        saveConfig()


def update1mTask():
    while True:
        time.sleep(1)
        resetThreadId("u1m")
        update1m(g.stocklist)
        # update1m(g.candidates)


def updatePriceTask():
    while True:
        uploadStockPrice()
        time.sleep(0.1)


def uploadDetail(details):
    info("uploadDetail", (details))
    try:
        response = requests.post(g.baseUrl+"/stock/details", json={
            "data": details, "passcode": "995560"}, verify=False, timeout=5)
        if response.status_code != 200:
            error("上传详情失败，状态码:", response.status_code)
            return
        else:
            response.encoding = 'utf-8'
            info("上传详情到test1成功:", response.status_code, response.text)
    except Exception as e:
        info("请求失败:", str(e))


def updateDetailTask():
    resetThreadId("udt")
    info("updateDetailTask start")
    details = []
    for index, scode in enumerate(g.stocklist):
        detail = getStockDetail(scode)
        if (detail is None):
            continue
        details.append(detail)
        # 如果 details 里有 10 个元素，则上传到 test1
        if len(details) >= 20:
            uploadDetail(details)
            details = []

    uploadDetail(details)
    uploadDetail([])
    info("updateDetailTask end")


def getActionsTask():
    while True:
        time.sleep(1)
        resetThreadId("act")
        getActions()


def getActions():
    try:
        response = requests.get(
            g.baseUrl+"/stock/rule/actions?broker="+g.broker, verify=False, timeout=5)
        if response.status_code != 200:
            error("getActions失败，状态码:", response.status_code)
            return
        else:
            response.encoding = 'utf-8'
            content = response.text
            debug("getActions成功:", response.status_code, content)
            jso = json.loads(content)
            for act in jso["data"]:
                act["scode"] = act["scode"].replace(".HK", ".HGT")
                # 如果act["scode"]里包含".HK",则用新的stockAccount
                if act["scode"] in g.actions:
                    info("已存在", act["scode"], "的action")
                else:

                    if ".HGT" in act["scode"]:
                        stockAccount = StockAccount(g.account, "HUGANGTONG")
                    else:
                        stockAccount = StockAccount(g.account)
                    if act["action"] == "buy":
                        info("买入", act["sname"], act["scode"],
                             act["price"], act["amount"])

                        oper = xtconstant.STOCK_BUY
                        if "ETF" in act["sname"] or act["scode"].startswith(("51", "15")):
                            # oper = xtconstant.ETF_PURCHASE
                            info("ETF", act["scode"])
                        order_id = xt_trader.order_stock(
                            stockAccount, act["scode"], oper, act["amount"], xtconstant.FIX_PRICE, act["price"], 'strategy_name', 'remark')
                        info("order_id:", order_id)

                        info("已买入", act["sname"], act["scode"],
                             act["price"], act["amount"])

                    elif act["action"] == "sell":
                        info("卖出", act["sname"], act["scode"],
                             act["price"], act["amount"])
                        order_id = xt_trader.order_stock(
                            stockAccount, act["scode"], xtconstant.STOCK_SELL, act["amount"], xtconstant.FIX_PRICE, act["price"], 'strategy_name', 'remark')
                        print(order_id)
                        info("已卖出", act["sname"], act["scode"],
                             act["price"], act["amount"])
                    elif act["action"] == "reloadK1d":
                        info("reloadK1d action for", act["scode"])
                        g.reloadK1d.append(act["scode"])
                    elif act["action"] == "cancelAction":
                        info("cancel action for", act["scode"])
                        cancelAction(act["scode"])
                    actionDone(act["id"])

    except Exception as e:
        error("getActions出错:", traceback.format_exc())


def cancelAction(scode):
    accounts = [StockAccount(g.account), StockAccount(
        g.account, "HUGANGTONG"), StockAccount(g.account, "SHENGANGTONG")]

    for account in accounts:
        orders = xt_trader.query_stock_orders(account, cancelable_only=False)
        info("query_stock_orders", obj2JsonString(orders))
        orders = obj2Json(orders)
        for order in orders:
            # 如果order["stock_code"]以 scode开始
            if order["stock_code"].startswith(scode) or scode == "":
                info("cancel order for", scode, order["order_id"])
                res = xt_trader.cancel_order_stock(account, order["order_id"])
                info("cancelled:", res)

    if scode in g.actions:
        del g.actions[scode]
    elif scode == "":
        g.actions = {}


def actionDone(id):
    try:
        response = requests.get(
            g.baseUrl+"/stock/action/done?id="+id, verify=False, timeout=20)
        if response.status_code != 200:
            error("action done error:", response.status_code,
                  "响应内容:", response.text)
    except Exception as e:
        error("action done error:", str(e))


def updateActionOrdered(scode, type, status, price, orderId):
    try:
        info("updateActionOrdered", scode, type, status, price, orderId)
        # 目标 URL
        url = g.baseUrl+"/stock/rule/action/ordered"
        info("url:", url)
        # 要发送的 JSON 数据（Python 字典）
        data = {
            "broker": g.broker,
            "scode": scode.split(".")[0],
            "status": status,
            "orderNo": orderId
        }
        info("data:", json.dumps(data))
        # 设置请求头（声明内容类型为 JSON）
        headers = {
            "Content-Type": "application/json"
        }

        # 发送 POST 请求
        response = requests.post(url, data=json.dumps(
            data), verify=False, headers=headers)

        # 输出响应
        debug("updateActionStatus:", response.status_code)
        debug("response:", response.text)

    except Exception as e:
        error("updateActionStatus 出错:", traceback.format_exc())


def update1d(stocklist=None, startTime=None, endTime=None):
    info("update1d")
    if (stocklist is None):
        stocklist = g.stocklist
    if (endTime is None):
        endTime = ""

    for index, scode in enumerate(stocklist):
        dataStartTime = startTime
        if (startTime is None):
            lastDate = get1dLastDate(scode)
            if lastDate:
                dataStartTime = lastDate
            else:
                continue
        period = '1d'
        datas = get1dData(stocklist, index, dataStartTime, endTime)
        # print("所有列名:", df.keys())
        # print("所有:", df.values())
        columns = ['Time'] + datas.columns.tolist()
        # print(columns)
        info("", len(datas), "rows")
        # array_data = [datas.columns.tolist()] + datas.values.tolist()

        # 将datas的数据分批上传，每批100条
        bsize = 500
        for i in range(0, len(datas), bsize):
            batch = datas.iloc[i:i+bsize]
            info("上传", scode, period,
                 "[", i, ",", i+bsize, "]", len(batch))
            for idx, row in batch.iterrows():
                # info(row)
                batch_data = [[str(idx)] + [row["open"], row["close"],
                                            row["high"], row["low"], row["volume"], row["amount"]]]
            # print(obj2JsonString(batch_data, indent=None))
                body = {"data": obj2Json(
                    batch_data), "scode": scode, "period": period, "passcode": "995560"}
                debug("body:", body)
                # 上传数据到test1
                try:
                    response = requests.post(
                        g.baseUrl+"/stock/data/upload", json=body, verify=False, timeout=20)
                    if response.status_code != 200:
                        error("上传失败，状态码:", response.status_code,
                              "响应内容:", response.text)
                except Exception as e:
                    error("上传失败:", str(e))


def get1dData(stocklist, index, startTime, endTime):
    if (startTime is None):
        startTime = datetime.datetime.now().strftime("%Y%m%d%H")

    if (endTime is None):
        endTime = ""

    scode = stocklist[index]
    period = '1d'
    params = ['open', 'close', 'high', 'low', 'volume', 'amount']
    info('downloading', period, 'from', startTime, "for", scode)
    xtdata.download_history_data(scode, period, startTime, endTime)
    # download_history_data2 批量版本 todo
    # params = []
    info('get', period, 'from', startTime, 'to', endTime,
         'for', scode, "(", index, "/", len(stocklist), ")")
    df = xtdata.get_market_data_ex(params, stock_list=[scode], period=period,
                                   start_time=startTime, end_time=endTime, count=-1, dividend_type='none', fill_data=True)
    datas = df[scode]

    return datas

    # result_dict = {str(date): datas.loc[date].to_dict() for date in datas.index}
    # print(obj2JsonString(result_dict))
    # json_result = json.dumps(result_dict, indent=4)
    # print(json_result)

    # print(obj2JsonString(df[scode]))
    # print(datas.to_json(orient='index'))


def updateLastStartTime1d():
    g.config["lastStartTime1d"] = datetime.datetime.now().strftime(
        "%Y%m%d")
    info("lastStartTime1d:", g.config["lastStartTime1d"])


def initLastStartTime1d():
    g.config["lastStartTime1d"] = (datetime.datetime.now() - datetime.timedelta(days=370)).strftime(
        "%Y%m%d")
    info("lastStartTime1d:", g.config["lastStartTime1d"])


def update1m(stocklist):
    info("update1m")
    pds = ["1m"]

    if "lastStartTime1m" not in g.config:
        initLastStartTime1m()
        saveConfig()
    dataStartTime = (datetime.datetime.strptime(
        g.config["lastStartTime1m"], "%Y%m%d%H%M%S") - datetime.timedelta(minutes=1)).strftime("%Y%m%d%H%M%S")
    info("dataStartTime:", dataStartTime)
    g.config["lastStartTime1m"] = datetime.datetime.now().strftime(
        "%Y%m%d%H%M%S")
    saveConfig()
    dataEndTime = ""
    for index, scode in enumerate(stocklist):
        for period in pds:
            params = ['open', 'close', 'high', 'low', 'volume', 'amount']
            if period == "tick":
                params = ['volume', 'amount', 'lastPrice']
            # params = []
            info('downloading', period, 'for', scode, 'from', dataStartTime)
            xtdata.download_history_data(
                scode, period, dataStartTime, dataEndTime)
            info('get', period, 'from', dataStartTime, 'to', dataEndTime,
                 'for', scode, "(", index, "/", len(stocklist), ")")
            df = xtdata.get_market_data_ex(params, stock_list=[scode], period=period,
                                           start_time=dataStartTime, end_time=dataEndTime, count=-1, dividend_type='none', fill_data=True)
            datas = df[scode]
            # print("所有列名:", df.keys())
            # info("所有:", df.values())
            columns = ['Time'] + datas.columns.tolist()
            debug(columns)
            debug(len(datas), "rows")
            # array_data = [datas.columns.tolist()] + datas.values.tolist()

            # 将datas的数据分批上传，每批100条
            bsize = 500
            for i in range(0, len(datas), bsize):
                batch = datas.iloc[i:i+bsize]
                info("上传", scode, period,
                     "[", i, ",", i+bsize, "]", len(batch))
                batch_data = []
                for idx, row in batch.iterrows():
                    batch_data.append([str(idx)] + [row["open"], row["close"],
                                                    row["high"], row["low"], row["volume"], row["amount"]])
                # info(obj2JsonString(batch_data, indent=None))

                if (len(batch_data) == 0):
                    info("no data")
                    continue
                body = {"data": obj2Json(
                    batch_data), "scode": scode, "period": period, "passcode": "995560"}
                debug("body:", body)
                # 上传数据到test1
                try:
                    response = requests.post(
                        g.baseUrl+"/stock/data/upload", json=body, verify=False, timeout=20)
                    if response.status_code != 200:
                        error("上传失败，状态码:", response.status_code,
                              "响应内容:", response.text)
                except Exception as e:
                    error("上传失败:", str(e))


def initLastStartTime1m():
    today = datetime.datetime.now().date()
    g.config["lastStartTime1m"] = datetime.datetime.combine(
        today, datetime.time(9, 0)).strftime("%Y%m%d%H%M%S")
    info("lastStartTime1m:", g.config["lastStartTime1m"])


def obj2Json(obj, max_depth=4, current_depth=1):
    """
    使用 dir() 和 getattr() 将 Python 对象（包括数组、字典、嵌套对象）转换为 JSON

    参数:
        obj: 要转换的 Python 对象
        max_depth: 最大递归深度（防止无限递归）
        current_depth: 当前递归深度（内部使用）

    返回:
        JSON 字符串
    """

    # 基本类型（可直接序列化）
    if obj is None or isinstance(obj, (str, int, float, bool)):
        return obj

    if current_depth > max_depth:
        return "<超出最大递归深度>"

    # 处理数组（list/tuple/set）
    if isinstance(obj, (list, tuple, set)):
        return [obj2Json(item, max_depth, current_depth + 1) for item in obj]

    # 处理字典（dict）
    if isinstance(obj, dict):
        return {
            key: obj2Json(value, max_depth, current_depth + 1)
            for key, value in obj.items()
        }

    # 自定义对象（递归获取属性）
    result = {}
    for attr_name in dir(obj):
        # 跳过魔术方法（如 __init__, __str__ 等）
        if attr_name.startswith('__') and attr_name.endswith('__'):
            continue

        try:
            attr_value = getattr(obj, attr_name)

            # 跳过方法（callable 对象）
            if inspect.ismethod(attr_value) or inspect.isfunction(attr_value):
                continue

            # 递归处理属性值
            result[attr_name] = obj2Json(
                attr_value, max_depth, current_depth + 1)

        except Exception as e:
            result[attr_name] = f"<无法获取属性值: {str(e)}>"

    return result


def obj2JsonString(obj, max_depth=4, indent=4, ensure_ascii=False):
    """
    最终转换为 JSON 字符串
    """
    data = obj2Json(obj, max_depth=max_depth)
    js = json.dumps(data, indent=indent,
                    ensure_ascii=ensure_ascii)
    return js


def getPositions():
    all = xt_trader.query_stock_positions(StockAccount(g.account))

    positions = xt_trader.query_stock_positions(
        StockAccount(g.account, "HUGANGTONG"))
    all = all + positions

    positions = xt_trader.query_stock_positions(
        StockAccount(g.account, "SHENGANGTONG"))
    all = all + positions

    return all


def object_to_json(obj, max_depth=3, current_depth=0):
    """
    使用 dir() 和 getattr() 将 Python 对象（包括数组、字典、嵌套对象）转换为 JSON

    参数:
        obj: 要转换的 Python 对象
        max_depth: 最大递归深度（防止无限递归）
        current_depth: 当前递归深度（内部使用）

    返回:
        JSON 字符串
    """
    if current_depth >= max_depth:
        return "<超出最大递归深度>"

    # 基本类型（可直接序列化）
    if obj is None or isinstance(obj, (str, int, float, bool)):
        return obj

    # 处理数组（list/tuple/set）
    if isinstance(obj, (list, tuple, set)):
        return [object_to_json(item, max_depth, current_depth + 1) for item in obj]

    # 处理字典（dict）
    if isinstance(obj, dict):
        return {
            key: object_to_json(value, max_depth, current_depth + 1)
            for key, value in obj.items()
        }

    # 自定义对象（递归获取属性）
    result = {}
    for attr_name in dir(obj):
        # 跳过魔术方法（如 __init__, __str__ 等）
        if attr_name.startswith('__') and attr_name.endswith('__'):
            continue

        try:
            attr_value = getattr(obj, attr_name)

            # 跳过方法（callable 对象）
            if inspect.ismethod(attr_value) or inspect.isfunction(attr_value):
                continue

            # 递归处理属性值
            result[attr_name] = object_to_json(
                attr_value, max_depth, current_depth + 1)

        except Exception as e:
            result[attr_name] = f"<无法获取属性值: {str(e)}>"

    return result


def python_to_json(obj, indent=4, ensure_ascii=False):
    """
    最终转换为 JSON 字符串
    """
    data = object_to_json(obj)
    js = json.dumps(data, indent=indent, ensure_ascii=ensure_ascii)
    return js


def printObj(data, indent):
    if (not indent):
        indent = ""
    dirs = dir(data)
    if not dirs:
        info(data)
    else:
        for field in dirs:
            if not field.startswith("_"):  # 过滤掉Python内置属性
                try:
                    value = getattr(data, field)
                    # child = printObj(value, indent+"  ")
                    info(f"{indent}{field}:{value}\n")
                except Exception as e:
                    info(f"{field}: (无法获取值):{e}")


def debug(*args, **kwargs):
    if (g.log["level"] >= g.log["debug"]):
        all_args = (f"D",) + args
        log(*all_args, **kwargs)


def info(*args, **kwargs):
    if (g.log["level"] >= g.log["info"]):
        all_args = (f"I",) + args
        log(*all_args, **kwargs)


def error(*args, **kwargs):
    if (g.log["level"] >= g.log["error"]):
        all_args = (f"E",) + args
        log(*all_args, **kwargs)


def log(*args, **kwargs):

    print(*args, **kwargs)

    # current_time = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    # # 将时间作为第一个元素插入到输出中
    # if (hasattr(threadLocal, "id")):
    #     time_header = f"[{current_time}][{threadLocal.id}]"
    # else:
    #     time_header = f"[{current_time}]"

    # all_args = (time_header,) + args

    # g.toPrint.append([all_args, kwargs])


def log2File(toPrint, file, sep=' ', end='\n', flush=True, mode='a', encoding='utf-8'):
    """
    将打印内容输出到文件，参数与print()函数保持一致

    参数:
        *args: 要打印的内容，多个参数会自动用sep分隔
        file: 输出文件名(默认'output.txt')
        sep: 分隔符(默认空格)
        end: 结束符(默认换行)
        flush: 是否立即刷新缓冲区(默认False)
        mode: 文件打开模式('a'追加或'w'写入，默认'a')
        encoding: 文件编码(默认'utf-8')
    """
    # 在file文件名后边加上当天日期
    file = file + "." + datetime.datetime.now().strftime("%Y%m%d")+".log"

    with open(file, mode=mode, encoding=encoding) as f:
        for item in toPrint:
            args = item[0]
            # 将多个参数用分隔符连接
            output = sep.join(str(arg) for arg in args)
            f.write(output + end)
            if flush:
                f.flush()


def printTask():
    while True:
        toPrint, g.toPrint = g.toPrint, []
        log2File(toPrint, g.logPathPrefix + "\\qmt.mini")
        while len(toPrint) > 0:
            item = toPrint.pop(0)
            print(*item[0], **item[1])

        time.sleep(0.1)


def help():
    print(f"getBalance()")
    print(f"buy('ETH',1234,300")
    print(f"buyMarket('DOOD', 100)")
    print(f"sellAllMarket('DOOD')")
    print(f"cancelOrder('DOOD', '1234567890')")
    print(f"getOrderList()")
    print(f"test()")
    print(f"prod()")
    print(f"quit()")


def main():
    # 创建带有历史记录的会话
    session = PromptSession(history=FileHistory(HISTORY_FILE))

    help()


if __name__ == '__main__':

    proxy = os.getenv("proxy")
    if proxy:
        g.baseUrl = proxy
    else:
        g.baseUrl = "http://test1.91taogu.com"

    logPathPrefix = os.getenv("logPathPrefix")
    logPathPrefix = "~"
    if logPathPrefix:
        g.logPathPrefix = logPathPrefix
    else:
        g.logPathPrefix = r"d:"

    print("logPathPrefix:", logPathPrefix)

    init()

    main()

    # 阻塞主线程退出
    # xt_trader.run_forever()
