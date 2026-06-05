import os
import shutil
import random
import threading
import time
from xtquant import xtdata
from xtquant.xttrader import XtQuantTrader, XtQuantTraderCallback
from xtquant.xttype import StockAccount
from xtquant import xtconstant

import datetime
import json
import inspect
import re
import pandas as pd
import numpy as np
import requests
import sys
import traceback
from threading import Thread
import asyncio
import websockets
import signal

class G:
    pass


g = G()


g.account = "620000558442"  # 国信
g.broker = "国信"

g.account = "8883949249"  # 国金
g.broker = "国金"

g.account = "50900001667601" #华鑫
g.broker = "华鑫"

g.subscribeId = 0
g.tick = {}
g.actions = {}
g.reloadK1d = []
g.uploading = 0
g.stocklist = ["000300.SH", "000004.SZ"]

g.baseUrl = "http://192.168.66.205:3001"
g.baseUrl = "http://test1.91taogu.com"

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
g.exit = 0
today = datetime.datetime.now().date()
threadLocal = threading.local()
g.k1dIndicatorLookbackDays = 30


def cleanup(signum, frame):
    print("\n正在清理并退出...")
    g.exit = 1
    unsubscribe()
    # 这里放你的清理代码，如保存数据、断开连接
    sys.exit(0)
def strip_scode_suffix(scode):
    scode = str(scode or "").strip().upper()
    index = scode.rfind(".")
    if index > 0:
        return scode[:index]
    return scode


def get_scode_market(scode):
    code = strip_scode_suffix(scode)
    if not code:
        return ""
    if len(code) == 6:
        if re.match(r"^(600|601|603|605|688|900|51|58|56)\d+$", code):
            return "SH"
        if re.match(r"^(000|001|002|003|30|15|16|12|3)\d+$", code):
            return "SZ"
        if re.match(r"^(8|43|83|87|88|92)\d+$", code):
            return "BJ"
    if re.match(r"^\d{4,5}$", code) or re.match(r"^0[0-9]\d{3}$", code):
        return "HK"
    if "USDT" in code or "BTC" in code or "ETH" in code:
        return "EC"
    return ""


def normalize_scode(scode):
    scode = str(scode or "").strip().upper()
    if not scode:
        return scode
    if re.match(r"^[^.]+\.[A-Z]+$", scode):
        return scode
    code = strip_scode_suffix(scode)
    market = get_scode_market(code)
    if not market:
        return code
    return f"{code}.{market}"


def updateDeal(deal):
    try:
        info("updateDeal:", deal)
        # 目标 URL
        url = g.baseUrl + "/stock/deal/update"
        info("url:", url)
        info("data:", json.dumps(deal))
        # 设置请求头（声明内容类型为 JSON）
        headers = {"Content-Type": "application/json"}

        # 发送 POST 请求
        response = requests.post(
            url, data=json.dumps(deal), verify=False, headers=headers
        )

        # 输出响应
        debug("updateDeal:", response.status_code)
        debug("response:", response.text)

    except Exception as e:
        error("updateDeal error:", traceback.format_exc())


def loadConfig():
    if not os.path.exists(g.configFile):
        g.config = {}
        with open(g.configFile, "w") as f:
            json.dump(g.config, f)
    else:
        with open(g.configFile) as f:
            g.config = json.load(f)
    info("config:", g.config)


def saveConfig():
    # 备份g.configFile到g.configFile+".bak"
    shutil.copy(g.configFile, g.configFile + ".bak")

    with open(g.configFile, "w") as f:
        json.dump(g.config, f)


def init():
    print(sys.version)
    print(sys.executable)
    loadConfig()
    g.stocklist = getStockList()


def getStockList():
    # 从test1获取股票列表
    info("getStockList")
    try:
        response = requests.get(g.baseUrl + "/stock/codes", verify=False, timeout=5)
        if response.status_code != 200:
            info("getStockList error:", response.status_code)
            return g.stocklist
        else:
            info("getStockList success:", response.status_code)
            response.encoding = "utf-8"
            content = response.text
            info("getStockList response:", content)
            stocklist = json.loads(content)
            # 将g.stocklist中包含".EC"的元素去除
            stocklist = [x for x in stocklist if not x.endswith(".EC")]
            # stocklist=["09926.HK"]
            return stocklist

    except Exception as e:
        error("getStockList error:", traceback.format_exc())
        return g.stocklist


def get1dLastDate(scode):
    try:
        url = g.baseUrl + "/stock/1d/lastDate?scode=" + scode
        debug("get", url)
        response = requests.get(url, verify=False, timeout=5)
        if response.status_code != 200:
            error("getLast1dDate error:", response.status_code)
            return
        else:
            response.encoding = "utf-8"
            content = response.text
            debug(content)
            return json.loads(content)["lastDate"]

    except Exception as e:
        error("getLast1dDate error:", traceback.format_exc())


def getKLastDate(scode, period):
    try:
        mapping = {"1d": "1d", "1w": "1w", "1mon": "1mon"}
        route = mapping.get(period)
        if route is None:
            error("getKLastDate unsupported period:", period)
            return
        url = g.baseUrl + f"/stock/{route}/lastDate?scode=" + scode
        debug("get", url)
        response = requests.get(url, verify=False, timeout=5)
        if response.status_code != 200:
            error("getKLastDate error:", response.status_code)
            return
        else:
            response.encoding = "utf-8"
            content = response.text
            debug(content)
            return json.loads(content)["lastDate"]

    except Exception as e:
        error("getKLastDate error:", traceback.format_exc())


def get1mLastMinute(scode):
    try:
        url = g.baseUrl + "/stock/1m/lastMinute?scode=" + scode
        debug("get", url)
        response = requests.get(url, verify=False, timeout=5)
        if response.status_code != 200:
            error("getLast1dMinute error:", response.status_code)
            return
        else:
            response.encoding = "utf-8"
            content = response.text
            debug(content)
            return json.loads(content)["lastMinute"]

    except Exception as e:
        error_info = traceback.format_exc()
        error("getLast1dMinute error:", error_info)


def getCandidates():
    info("getCandidates")
    try:
        response = requests.get(
            g.baseUrl + "/stock/candidates", verify=False, timeout=5
        )
        if response.status_code != 200:
            info("请求失败，状态码:", response.status_code)
            return
        else:
            info("获取candidates成功:", response.status_code)
            response.encoding = "utf-8"
            content = response.text
            info(content)
            return json.loads(content)

    except Exception as e:
        info("获取candidates失败:", traceback.format_exc())


def getRuleCodes():
    info("getRuleCodes")
    try:
        response = requests.get(
            g.baseUrl + "/stock/rule/codes", verify=False, timeout=5
        )
        if response.status_code != 200:
            info("getRuleCodes:", response.status_code)
            return
        else:
            info("getRuleCodes:", response.status_code)
            response.encoding = "utf-8"
            content = response.text
            info(content)
            return json.loads(content)

    except Exception as e:
        info("getRuleCodes error:", traceback.format_exc())


def uploadStockPrice():
    # 组装成json对象post到test1.91taogu.com
    # 为data添加passcode属性
    sb, g.tick = g.tick, {}  # 这行是原子的
    if len(list(sb)) < 1:
        info("0 stocks, skip upload")
        return
    info("上传", len(list(sb)), "个股票价格")
    # info(sb.keys())
    try:
        response = requests.post(
            g.baseUrl + "/stock/quotes.mini",
            json={"data": sb, "passcode": "995560"},
            verify=False,
            timeout=5,
        )
        if response.status_code != 200:
            error("请求失败，状态码:", response.status_code)
            return
        else:
            response.encoding = "utf-8"
            # info("请求test1成功:", response.status_code, response.text)
    except Exception as e:
        error("请求失败:", traceback.format_exc())


def getStockDetail(scode):
    info("getStockDetail", scode)
    si = xtdata.get_instrument_detail(scode, True)
    if si is None:
        error(scode, "error")
        return None
    info("detail:", obj2JsonString(si))
    detail = {
        "scode": scode,
        "sname": si["InstrumentName"],
        "ExchangeID": si["ExchangeID"],
        "LastVolume": si["LastVolume"],
        "TotalVolume": si["TotalVolume"],
        "FloatVolume": si["FloatVolume"],
        "UpStopPrice": si["UpStopPrice"],
        "DownStopPrice": si["DownStopPrice"],
        "VolumeMultiple": si["VolumeMultiple"],
        "bNotProfitable": 1 if si["bNotProfitable"] == True else 0,
    }

    if si["MinLimitOrderVolume"] > detail["VolumeMultiple"]:
        detail["VolumeMultiple"] = si["MinLimitOrderVolume"]
    if si["MinMarketOrderVolume"] > detail["VolumeMultiple"]:
        detail["VolumeMultiple"] = si["MinMarketOrderVolume"]

    # data = xtdata.get_financial_data([scode])
    # info(data)

    return detail


def uploadPosition(positions=None):
    # 组装成json对象post到test1.91taogu.com
    url = g.baseUrl + "/stock/positions"
    body = {"broker": g.broker, "clean": 1, "passcode": "995560"}
    if positions is None:
        info("clean股票持仓")
    else:
        info("上传", len(positions), "个股票持仓")

        # positions 里的没个元素只保留 broker 属性
        data = []
        for position in positions:
            data.append(
                {
                    "broker": g.broker,
                    "account_id": position["account_id"],
                    "avg_price": position["avg_price"],
                    "can_use_volume": position["can_use_volume"],
                    "frozen_volume": position["frozen_volume"],
                    "market_value": position["market_value"],
                    "on_road_volume": position["on_road_volume"],
                    "open_price": position["open_price"],
                    "stock_code": normalize_scode(position["stock_code"]),
                    "volume": position["volume"],
                }
            )
        body = {"data": data, "passcode": "995560"}
        info(url, "\n", body)
    try:
        response = requests.post(url, json=body, verify=False, timeout=5)
        if response.status_code != 200:
            error("上传持仓失败，状态码:", response.status_code)
            return
        else:
            response.encoding = "utf-8"
            info("上传持仓到test1成功:", response.status_code, response.text)
    except Exception as e:
        info("请求失败:", traceback.format_exc())


def resetThreadId(label=""):
    threadLocal.id = (
        label
        + datetime.datetime.now().strftime("%H%M%S")
        + str(random.randint(0, 1000))
    )


def update1dTask():
    info("update1dTask")
    try:
        g.candidates = getCandidates()

        g.stocklist = getStockList()
        resetThreadId("u1mc")
        update1mon(g.candidates)
        resetThreadId("u1m")
        update1mon(g.stocklist)

        resetThreadId("u1wc")
        update1w(g.candidates)
        resetThreadId("u1w")
        update1w(g.stocklist)

        resetThreadId("u1dc")
        update1d(g.candidates)
        mergedStocks = list(
            dict.fromkeys((g.stocklist or []) + (g.candidates or []) + (g.ruleCodes or []))
        )
        
        updateHigherPeriodIfNeeded("1w", mergedStocks, "lastUpdate1wDate")
        updateHigherPeriodIfNeeded("1mon", mergedStocks, "lastUpdate1monDate")

        # g.ruleCodes = getRuleCodes()
        # resetThreadId("u1dr")
        # update1d(g.ruleCodes)

        while True:
            info("1d loop start")
            if g.exit == 1:
                return
            now = datetime.datetime.now()
            if now.hour < 9 or (now.hour == 9 and now.minute < 15):
                time.sleep(1)
                continue
            if now.hour > 16 or (now.hour == 16 and now.minute >= 10):
                info("16:10以后，update1dTask退出")
                return
            resetThreadId("u1d")
            reloadK1d, g.reloadK1d = g.reloadK1d, []
            if len(reloadK1d) > 0:
                info("reloading 1d data")
                for scode in reloadK1d:
                    # updateActionOrdered(scode, "", "56", 0, "")
                    update1d([scode.replace(".HGT", ".HK")], "20210101", "")
            g.stocklist = getStockList()
            update1d(g.stocklist)

            updateLastStartTime1d()
            saveConfig()
    except Exception as e:
        info("update1dTask error:", traceback.format_exc())

def updateToday1d(stocklist=None):
    info("updateToday1d") #todo
    if stocklist is None:
        stocklist = g.stocklist

    chunks = [stocklist[i:i + 10] for i in range(0, len(stocklist), 10)]

    period = "1d"
    params = ["open", "close", "high", "low", "volume", "amount", "suspendFlag"]
    for index, chunk in enumerate(chunks):
        datas = xtdata.get_market_data_ex(params, chunk, period, start_time = '', end_time = '', count = 1, dividend_type = 'none', fill_data = True)

        info("get_full_kline:", datas)
        info("", len(datas), "rows")
        batch_data = []
        for idx, row in datas.iterrows():
            batch_data.append(
                    [str(idx)]
                    + [
                        row["open"],
                        row["close"],
                        row["high"],
                        row["low"],
                        row["volume"],
                        row["amount"],
                        row["cci"],
                        row["kdj_k"],
                        row["kdj_d"],
                        row["kdj_j"],
                        row["boll_u"],
                        row["boll_m"],
                        row["boll_l"],
                        row["range"],
                    ]
                )
        if len(batch_data) > 0:
            body = {
                "data": obj2Json(batch_data),
                "scode": scode,
                "period": period,
                "passcode": "995560",
            }
            # debug("body:", body)
            # 上传数据
            try:
                response = requests.post(
                    g.baseUrl + "/stock/k/upload",
                    json=body,
                    verify=False,
                    timeout=20,
                )
                if response.status_code != 200:
                    error(
                        "上传失败，状态码:",
                        response.status_code,
                        "响应内容:",
                        response.text,
                    )
            except Exception as e:
                error("上传失败:", traceback.format_exc())


def updateTodayTask():
    info("updateTodayTask")
    try:
        resetThreadId("u1dt")
        g.stocklist = getStockList()
        updateToday1d(g.stocklist)

    except Exception as e:
        info("update1dTask error:", traceback.format_exc())


def update1mTask():
    while True:
        if g.exit == 1:
            return
        now = datetime.datetime.now()
        if now.hour < 9 or (now.hour == 9 and now.minute < 15):
            time.sleep(1)
            continue
        if now.hour > 16 or (now.hour == 16 and now.minute >= 10):
            info("16:10以后，update1mTask退出")
            return
        resetThreadId("u1m")
        try:
            update1m(g.stocklist)
        except Exception as e:
            info("update1mTask error:", traceback.format_exc())
        # update1m(g.candidates)
        time.sleep(1)


def updatePriceTask():
    info("upt")
    while True:
        if g.exit == 1:
            return
        now = datetime.datetime.now()
        # 非交易时段降低频率，避免无效请求
        if now.hour < 9 or (now.hour == 9 and now.minute < 15) or now.hour > 16 or (now.hour == 16 and now.minute >= 10):
            time.sleep(5)
            continue
        resetThreadId("upt")
        try:
            uploadStockPrice()
        except Exception as e:
            info("updatePriceTask error:", traceback.format_exc())
        time.sleep(0.5)


def uploadDetail(details):
    info("uploadDetail", (details))
    try:
        response = requests.post(
            g.baseUrl + "/stock/details",
            json={"data": details, "passcode": "995560"},
            verify=False,
            timeout=5,
        )
        if response.status_code != 200:
            error("上传详情失败，状态码:", response.status_code)
            return
        else:
            response.encoding = "utf-8"
            info("上传详情到test1成功:", response.status_code, response.text)
    except Exception as e:
        info("请求失败:", traceback.format_exc())


def updateDetailTask():
    resetThreadId("udt")
    # 判断是否9:30以后
    now = datetime.datetime.now()
    while now.hour < 9 or (now.hour == 9 and now.minute < 31):
        info("9:30以后，再更新详情")
        time.sleep(60)
        now = datetime.datetime.now()

    info("updateDetailTask start")
    details = []
    try:
        for index, scode in enumerate(g.stocklist):
            detail = getStockDetail(scode)
            if detail is None:
                continue
            details.append(detail)
            # 如果 details 里有 10 个元素，则上传到 test1
            if len(details) >= 20:
                uploadDetail(details)
                details = []

        uploadDetail(details)
        uploadDetail([])
    except Exception as e:
        info("error:", traceback.format_exc())
    info("updateDetailTask end")


def getActionsTask():
    while True:
        time.sleep(1)
        resetThreadId("act")
        getActions()


def getActions():
    try:
        response = requests.get(
            g.baseUrl + "/stock/rule/actions?broker=" + g.broker,
            verify=False,
            timeout=5,
        )
        if response.status_code != 200:
            error("getActions失败，状态码:", response.status_code)
            return
        else:
            response.encoding = "utf-8"
            content = response.text
            debug("getActions成功:", response.status_code, content)
            jso = json.loads(content)
            for act in jso["data"]:
                act["scode"] = normalize_scode(act["scode"]).replace(".HK", ".HGT")
                # 如果act["scode"]里包含".HK",则用新的stockAccount
                if act["scode"] in g.actions:
                    info("已存在", act["scode"], "的action")
                else:

                    if ".HGT" in act["scode"]:
                        stockAccount = StockAccount(g.account, "HUGANGTONG")
                    else:
                        stockAccount = StockAccount(g.account)
                    if act["action"] == "buy":
                        info(
                            "买入",
                            act["sname"],
                            act["scode"],
                            act["price"],
                            act["amount"],
                        )

                        oper = xtconstant.STOCK_BUY
                        if "ETF" in act["sname"] or act["scode"].startswith(
                            ("51", "15")
                        ):
                            # oper = xtconstant.ETF_PURCHASE
                            info("ETF", act["scode"])
                        order_id = xt_trader.order_stock(
                            stockAccount,
                            act["scode"],
                            oper,
                            act["amount"],
                            xtconstant.FIX_PRICE,
                            act["price"],
                            "strategy_name",
                            "remark",
                        )
                        info("order_id:", order_id)

                        info(
                            "已买入",
                            act["sname"],
                            act["scode"],
                            act["price"],
                            act["amount"],
                        )

                    elif act["action"] == "sell":
                        info(
                            "卖出",
                            act["sname"],
                            act["scode"],
                            act["price"],
                            act["amount"],
                        )
                        order_id = xt_trader.order_stock(
                            stockAccount,
                            act["scode"],
                            xtconstant.STOCK_SELL,
                            act["amount"],
                            xtconstant.FIX_PRICE,
                            act["price"],
                            "strategy_name",
                            "remark",
                        )
                        info("order_id:", order_id)
                        info(
                            "已卖出",
                            act["sname"],
                            act["scode"],
                            act["price"],
                            act["amount"],
                        )
                    elif act["action"] == "reloadK1d":
                        info("reloadK1d action for", act["scode"])
                        g.reloadK1d.append(act["scode"])
                    elif act["action"] == "connectWebSocket":
                        connectWebSocket()
                    elif act["action"] == "cancelAction":
                        info("cancel action for", act["scode"])
                        cancelAction(act["scode"])
                    actionDone(act["id"])

    except Exception as e:
        error("getActions error:", traceback.format_exc())


def connectWebSocket():
    info("connect webSocket")

    thread = threading.Thread(target=lambda: asyncio.run(websocket_client()))
    thread.start()


def cancelAction(scode):
    accounts = [
        StockAccount(g.account),
        StockAccount(g.account, "HUGANGTONG"),
        StockAccount(g.account, "SHENGANGTONG"),
    ]

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
            g.baseUrl + "/stock/action/done?id=" + id, verify=False, timeout=20
        )
        if response.status_code != 200:
            error(
                "action done error:", response.status_code, "响应内容:", response.text
            )
    except Exception as e:
        error("action done error:", traceback.format_exc())


def updateActionOrdered(scode, type, status, price, orderId, statusMessage=""):
    try:
        info("updateActionOrdered", scode, type, status, price, orderId, statusMessage)
        # 目标 URL
        url = g.baseUrl + "/stock/rule/action/ordered"
        info("url:", url)
        if status == 57:
            status = f"{status}:{statusMessage}"

        # 要发送的 JSON 数据（Python 字典）
        data = {
            "broker": g.broker,
            "scode": normalize_scode(scode),
            "status": status,
            "orderNo": orderId,
        }
        info("data:", json.dumps(data))
        # 设置请求头（声明内容类型为 JSON）
        headers = {"Content-Type": "application/json"}

        # 发送 POST 请求
        response = requests.post(
            url, data=json.dumps(data), verify=False, headers=headers
        )

        # 输出响应
        debug("updateActionStatus:", response.status_code)
        debug("response:", response.text)

    except Exception as e:
        error("updateActionStatus error:", traceback.format_exc())


def update1d(stocklist=None, startTime=None, endTime=None):
    updatePeriod(stocklist, startTime, endTime, "1d")


def update1w(stocklist=None, startTime=None, endTime=None):
    updatePeriod(stocklist, startTime, endTime, "1w")


def update1mon(stocklist=None, startTime=None, endTime=None):
    updatePeriod(stocklist, startTime, endTime, "1mon")


def updatePeriod(stocklist=None, startTime=None, endTime=None, period="1d"):
    info("updatePeriod", period)
    if stocklist is None:
        stocklist = g.stocklist
    if endTime is None:
        endTime = ""

    defaultLookbackDays = 365
    fetchLookbackDays = 0
    includeCci = False
    if period == "1d":
        fetchLookbackDays = g.k1dIndicatorLookbackDays
        includeCci = True
    elif period == "1w":
        defaultLookbackDays = 365 * 5
    elif period == "1mon":
        defaultLookbackDays = 365 * 10

    for index, scode in enumerate(stocklist):
        try:
            newData = 0

            dataStartTime = startTime
            if startTime is None:
                lastDate = getKLastDate(scode, period)
                info("lastDate:", lastDate)
                if lastDate:
                    dataStartTime = lastDate
                else:
                    newData = 1
                    dataStartTime = (
                        datetime.datetime.now()
                        - datetime.timedelta(days=defaultLookbackDays)
                    ).strftime("%Y%m%d")

            uploadStartTime = dataStartTime
            fetchStartTime = dataStartTime
            if fetchLookbackDays > 0:
                fetchStartTime = (
                    datetime.datetime.strptime(dataStartTime, "%Y%m%d")
                    - datetime.timedelta(days=fetchLookbackDays)
                ).strftime("%Y%m%d")
            datas = getPeriodData(
                stocklist, index, fetchStartTime, endTime, period, includeCci
            )
            info(
                "",
                len(datas),
                "rows",
                "fetchStartTime:",
                fetchStartTime,
                "uploadStartTime:",
                uploadStartTime,
                "period:",
                period,
            )

            uploadPeriodData(
                scode, period, datas, uploadStartTime, newData, includeCci
            )
        except Exception as e:
            error(f"update {period} error:", traceback.format_exc())


def KDJ(table):
    table["kdj_k"] = 0.0000001
    table["kdj_d"] = 0.0000001
    table["kdj_j"] = 0.0000001
    for i in range(13, len(table)):
        high = table["high"].values[i - 13 : i + 1]
        low = table["low"].values[i - 13 : i + 1]
        close = table["close"].values[i - 13 : i + 1]
        rsv = (close[-1] - low.min()) / (high.max() - low.min())
        table["kdj_k"].values[i] = 2 / 3 * table["kdj_k"].values[i - 1] + 1 / 3 * rsv
        table["kdj_d"].values[i] = (
            2 / 3 * table["kdj_d"].values[i - 1] + 1 / 3 * table["kdj_k"].values[i]
        )
        table["kdj_j"].values[i] = (
            3 * table["kdj_k"].values[i] - 2 * table["kdj_d"].values[i]
        )
        # 将kdj的值保留小数点后2位
        table["kdj_k"].values[i] = round(table["kdj_k"].values[i], 3)
        table["kdj_d"].values[i] = round(table["kdj_d"].values[i], 3)
        table["kdj_j"].values[i] = round(table["kdj_j"].values[i], 3)


def BOLL(table, period=20, k=2):
    table["boll_u"] = 0.0000001
    table["boll_m"] = 0.0000001
    table["boll_l"] = 0.0000001
    for i in range(period, len(table)):
        high = table["high"].values[i - period : i + 1]
        low = table["low"].values[i - period : i + 1]

        close = table["close"].values[i - period : i + 1]
        boll_u = close.mean() + k * close.std()
        boll_m = close.mean()
        boll_l = close.mean() - k * close.std()

        table["boll_u"].values[i] = round(boll_u, 2)
        table["boll_m"].values[i] = round(boll_m, 2)
        table["boll_l"].values[i] = round(boll_l, 2)


def RANGE(table, period=5):
    table["range"] = 0.0000001
    for i in range(period, len(table)):
        high = table["high"].values[i - period : i + 1]
        low = table["low"].values[i - period : i + 1]
        delta = high - low
        mean = delta.mean()
        table["range"].values[i] = mean

def CCI(table):
    table["cci"] = 0.0000001
    for i in range(13, len(table)):
        high = table["high"].values[i - 13 : i + 1]
        low = table["low"].values[i - 13 : i + 1]
        close = table["close"].values[i - 13 : i + 1]
        tp = (high + low + close) / 3
        sma = tp.mean()
        mad = np.abs(tp - sma).mean()
        table["cci"].values[i] = (tp[-1] - sma) / (0.015 * mad)
        # 将cci的值保留小数点后2位
        table["cci"].values[i] = round(table["cci"].values[i], 2)


def get1dData(stocklist, index, startTime, endTime):
    return getPeriodData(stocklist, index, startTime, endTime, "1d", True)


def getPeriodData(stocklist, index, startTime, endTime, period, calcIndicators=False):
    info("getPeriodData", period, index, startTime, endTime)
    if startTime is None:
        startTime = datetime.datetime.now().strftime("%Y%m%d")

    if endTime is None:
        endTime = ""

    scode = stocklist[index]
    params = ["open", "close", "high", "low", "volume", "amount", "suspendFlag"]
    info("downloading", period, "from", startTime, "for", scode)
    xtdata.download_history_data(scode, period, startTime, endTime, True)
    # download_history_data2 批量版本 todo
    # params = []
    info(
        "get",
        period,
        "from",
        startTime,
        "to",
        endTime,
        "for",
        scode,
        "(",
        index,
        "/",
        len(stocklist),
        ")",
    )
    df = xtdata.get_local_data(
        params,
        stock_list=[scode],
        period=period,
        start_time=startTime,
        end_time=endTime,
        count=-1,
        dividend_type="none",
        fill_data=True,
    )
    table = df[scode]
    table = table.query("suspendFlag != 1").copy()
    info("getPeriodData done", period)
    if calcIndicators:
        CCI(table)
        KDJ(table)
        BOLL(table)
        RANGE(table)

    return table


def uploadPeriodData(scode, period, datas, uploadStartTime, newData, includeCci=False):
    bsize = 50
    foundStart = 0
    for i in range(0, len(datas), bsize):
        batch = datas.iloc[i : i + bsize]
        info("上传", scode, period, "[", i, ",", i + bsize, "]", len(batch))
        batch_data = []
        for idx, row in batch.iterrows():
            if newData != 1 and foundStart != 1 and idx != uploadStartTime:
                info(
                    f"newData={newData}, idx={idx}, foundStart={foundStart}, uploadStartTime={uploadStartTime}"
                )
                continue

            if idx == uploadStartTime:
                foundStart = 1

            values = [
                row["open"],
                row["close"],
                row["high"],
                row["low"],
                row["volume"],
                row["amount"],
            ]
            if includeCci:
                values.append(row["cci"])
            batch_data.append([str(idx)] + values)

        if len(batch_data) > 0:
            body = {
                "data": obj2Json(batch_data),
                "scode": scode,
                "period": period,
                "passcode": "995560",
            }
            response = requests.post(
                g.baseUrl + "/stock/k/upload",
                json=body,
                verify=False,
                timeout=20,
            )
            if response.status_code != 200:
                error(
                    "上传失败，状态码:",
                    response.status_code,
                    "响应内容:",
                    response.text,
                )


def updateHigherPeriodIfNeeded(period, stocklist, configKey):
    if stocklist is None or len(stocklist) == 0:
        return

    today = datetime.datetime.now().strftime("%Y%m%d")
    if g.config.get(configKey) == today:
        return

    if period == "1w":
        update1w(stocklist)
    elif period == "1mon":
        update1mon(stocklist)
    else:
        error("updateHigherPeriodIfNeeded unsupported period:", period)
        return

    g.config[configKey] = today

    # result_dict = {str(date): datas.loc[date].to_dict() for date in datas.index}
    # print(obj2JsonString(result_dict))
    # json_result = json.dumps(result_dict, indent=4)
    # print(json_result)

    # print(obj2JsonString(df[scode]))
    # print(datas.to_json(orient='index'))


def updateLastStartTime1d():
    g.config["lastStartTime1d"] = datetime.datetime.now().strftime("%Y%m%d")
    info("lastStartTime1d:", g.config["lastStartTime1d"])


def initLastStartTime1d():
    g.config["lastStartTime1d"] = (
        datetime.datetime.now() - datetime.timedelta(days=370)
    ).strftime("%Y%m%d")
    info("lastStartTime1d:", g.config["lastStartTime1d"])


def update1m(stocklist, startTime=None):
    info("update1m")
    pds = ["1m"]

    dataEndTime = ""
    for index, scode in enumerate(stocklist):
        dataStartTime = startTime
        if startTime is None:
            lastMinute = get1mLastMinute(scode)
            if lastMinute:
                dataStartTime = lastMinute
            else:
                dataStartTime = (
                    datetime.datetime.now() - datetime.timedelta(hours=7)
                ).strftime("%Y%m%d%H%M%S")
        
        origTime = datetime.datetime.strptime(dataStartTime, "%Y%m%d%H%M%S")
        today_930 = datetime.datetime.combine(datetime.datetime.now().date(), datetime.time(9, 30, 0))
    
        if origTime < today_930:
            dataStartTime= today_930.strftime("%Y%m%d%H%M%S")

        info("dataStartTime:", dataStartTime)

        for period in pds:
            params = ["open", "close", "high", "low", "volume", "amount"]
            if period == "tick":
                params = ["volume", "amount", "lastPrice"]
            # params = []
            info("downloading", period, "for", scode, "from", dataStartTime)
            xtdata.download_history_data(scode, period, dataStartTime, dataEndTime)
            info(
                "get",
                period,
                "from",
                dataStartTime,
                "to",
                dataEndTime,
                "for",
                scode,
                "(",
                index,
                "/",
                len(stocklist),
                ")",
            )
            df = xtdata.get_market_data_ex(
                params,
                stock_list=[scode],
                period=period,
                start_time=dataStartTime,
                end_time=dataEndTime,
                count=-1,
                dividend_type="none",
                fill_data=True,
            )
            datas = df[scode]
            # print("所有列名:", df.keys())
            # info("所有:", df.values())
            columns = ["Time"] + datas.columns.tolist()
            # debug(columns)
            debug(len(datas), "rows")
            # array_data = [datas.columns.tolist()] + datas.values.tolist()

            # 将datas的数据分批上传，每批100条
            bsize = 50
            for i in range(0, len(datas), bsize):
                batch = datas.iloc[i : i + bsize]
                info("上传", scode, period, "[", i, ",", i + bsize, "]", len(batch))
                batch_data = []
                for idx, row in batch.iterrows():
                    batch_data.append(
                        [str(idx)]
                        + [
                            row["open"],
                            row["close"],
                            row["high"],
                            row["low"],
                            row["volume"],
                            row["amount"],
                        ]
                    )
                # info(obj2JsonString(batch_data, indent=None))

                if len(batch_data) == 0:
                    info("no data")
                    continue
                body = {
                    "data": obj2Json(batch_data),
                    "scode": scode,
                    "period": period,
                    "passcode": "995560",
                }
                # debug("body:", body)
                # 上传数据
                try:
                    response = requests.post(
                        g.baseUrl + "/stock/k/upload",
                        json=body,
                        verify=False,
                        timeout=20,
                    )
                    if response.status_code != 200:
                        error(
                            "上传失败，状态码:",
                            response.status_code,
                            "响应内容:",
                            response.text,
                        )
                except Exception as e:
                    error("上传失败:", traceback.format_exc())


def initLastStartTime1m():
    today = datetime.datetime.now().date()
    g.config["lastStartTime1m"] = datetime.datetime.combine(
        today, datetime.time(9, 0)
    ).strftime("%Y%m%d%H%M%S")
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
        if attr_name.startswith("__") and attr_name.endswith("__"):
            continue

        try:
            attr_value = getattr(obj, attr_name)

            # 跳过方法（callable 对象）
            if inspect.ismethod(attr_value) or inspect.isfunction(attr_value):
                continue

            # 递归处理属性值
            result[attr_name] = obj2Json(attr_value, max_depth, current_depth + 1)

        except Exception as e:
            result[attr_name] = f"<无法获取属性值: {traceback.format_exc()}>"

    return result


def obj2JsonString(obj, max_depth=4, indent=4, ensure_ascii=False):
    """
    最终转换为 JSON 字符串
    """
    data = obj2Json(obj, max_depth=max_depth)
    js = json.dumps(data, indent=indent, ensure_ascii=ensure_ascii)
    return js


def buy(scode, price, volume):
    stockAccount = StockAccount(g.account)

    order_id = xt_trader.order_stock(
        stockAccount,
        scode,
        xtconstant.STOCK_BUY,
        volume,
        xtconstant.FIX_PRICE,
        price,
        "strategy1",
        "",
    )
    return order_id


def sell(scode, price, volume):
    stockAccount = StockAccount(g.account)
    order_id = xt_trader.order_stock(
        stockAccount,
        scode,
        xtconstant.STOCK_SELL,
        volume,
        xtconstant.FIX_PRICE,
        price,
        "strategy1",
        "",
    )
    return order_id


def cancel(order_id):
    stockAccount = StockAccount(g.account)
    return xt_trader.cancel_order_stock(stockAccount, order_id)


def getOrders(cancelable_only):
    stockAccount = StockAccount(g.account)
    orders = xt_trader.query_stock_orders(stockAccount, cancelable_only)
    return orders


def getPositions():
    all = xt_trader.query_stock_positions(StockAccount(g.account))

    positions = xt_trader.query_stock_positions(StockAccount(g.account, "HUGANGTONG"))
    all = all + positions

    positions = xt_trader.query_stock_positions(StockAccount(g.account, "SHENGANGTONG"))
    all = all + positions

    return all


def getDeals(stockAccount, start_time, end_time):
    # result = xt_trader.export_data(
    #     stockAccount, g.logPathPrefix + "\\guojin_deal.csv", "deal", start_time="2025-01-01", end_time="2025-05-11")
    # info(result)
    if start_time is None:
        start_time = (datetime.datetime.now() - datetime.timedelta(days=15)).strftime(
            "%Y%m%d"
        )

    deals = xt_trader.query_data(
        stockAccount,
        g.logPathPrefix + "\\guojin_deal.csv",
        "deal",
        start_time=start_time,
        end_time=end_time,
    )
    return deals


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
        if attr_name.startswith("__") and attr_name.endswith("__"):
            continue

        try:
            attr_value = getattr(obj, attr_name)

            # 跳过方法（callable 对象）
            if inspect.ismethod(attr_value) or inspect.isfunction(attr_value):
                continue

            # 递归处理属性值
            result[attr_name] = object_to_json(attr_value, max_depth, current_depth + 1)

        except Exception as e:
            result[attr_name] = f"<无法获取属性值: {traceback.format_exc()}>"

    return result


def python_to_json(obj, indent=4, ensure_ascii=False):
    """
    最终转换为 JSON 字符串
    """
    data = object_to_json(obj)
    js = json.dumps(data, indent=indent, ensure_ascii=ensure_ascii)
    return js


def subscribe_whole_callback(data):
    info("subscribe_whole_callback", data)
    try:
        for stock in data:
            if stock not in g.stocklist:
                continue
            g.tick[stock] = data[stock]
    except Exception as e:
        info(f"error:{e}")


def printObj(data, indent):
    if not indent:
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
    if g.log["level"] >= g.log["debug"]:
        all_args = (f"D",) + args
        log(*all_args, **kwargs)


def info(*args, **kwargs):
    if g.log["level"] >= g.log["info"]:
        all_args = (f"I",) + args
        log(*all_args, **kwargs)


def error(*args, **kwargs):
    if g.log["level"] >= g.log["error"]:
        all_args = (f"E",) + args
        log(*all_args, **kwargs)


def log(*args, **kwargs):
    """增强版log函数，完全模拟print的参数行为"""
    current_time = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    # 将时间作为第一个元素插入到输出中
    if hasattr(threadLocal, "id"):
        time_header = f"[{current_time}][{threadLocal.id}]"
    else:
        time_header = f"[{current_time}]"

    all_args = (time_header,) + args
    print(*all_args, **kwargs)
    g.toPrint.append([all_args, kwargs])


def log2File(toPrint, file, sep=" ", end="\n", flush=True, mode="a", encoding="utf-8"):
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
    file = f"{file}.{datetime.datetime.now().strftime('%Y%m%d')}.log.{g.config['sessionId']:02d}"

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
        if g.exit == 1:
            return
        toPrint, g.toPrint = g.toPrint, []
        log2File(toPrint, f"{g.logPathPrefix}\\qmt.mini.data")

        time.sleep(1)


def startUpdatePositions():
    t1 = Thread(target=refreshPositions)
    t1.start()


def refreshPositions():
    resetThreadId("utp")
    info("updatePositions")
    uploadPosition()

    updatePositions()


def updatePositions():
    positions = getPositions()

    info("positions:", len(positions))
    js = object_to_json(positions)

    uploadPosition(js)


def resubscribe():
    info("resubscribe start", g.stocklist)
    unsubscribe()

    g.subscribeId = xtdata.subscribe_whole_quote(
        g.stocklist, callback=subscribe_whole_callback
    )

    info("resubscribe end", g.subscribeId)


def unsubscribe():
    info("unsubscribe start")
    if g.subscribeId != 0:
        info("unsubscribe", g.subscribeId)
        xtdata.unsubscribe_quote(g.subscribeId)

    g.subscribeId = 0

    info("unsubscribe end", g.subscribeId)


if __name__ == "__main__":
    signal.signal(signal.SIGINT, cleanup)
    # Mini-QMT的userdata_mini路径
    # path = r'D:\国金证券QMT交易端\userdata_mini'
    path = os.getenv("qmtpath")
    # 获取环境变量proxy的值
    proxy = os.getenv("proxy")
    if proxy:
        g.baseUrl = proxy
    else:
        g.baseUrl = "http://test1.91taogu.com"

    configPathPrefix = os.getenv("configPathPrefix")

    if configPathPrefix:
        g.configFile = configPathPrefix + r"\qmt.config.json"
    else:
        g.configFile = r"d:\qmt.config.json"

    logPathPrefix = os.getenv("logPathPrefix")
    if logPathPrefix:
        g.logPathPrefix = logPathPrefix
    else:
        g.logPathPrefix = r"d:"

    print("configPathPrefix:", configPathPrefix)
    print("configFile:", g.configFile)
    print("logPathPrefix:", logPathPrefix)
    # print("1.http://test1.91taogu.com")
    # print("2.http://192.168.66.205:3001")
    # print("q.退出")
    # ui = input("请选择:")

    print("baseUrl:", g.baseUrl)
    time.sleep(2)

    init()
    # 生成session id 整数类型 同时运行的策略不能重复
    stockAccount = StockAccount(g.account)
    stockAccountHgt = StockAccount(g.account, "HUGANGTONG")
    if "sessionId" not in g.config:
        g.config["sessionId"] = 0
    g.config["sessionId"] = g.config["sessionId"] + 1
    saveConfig()

    # xt_trader = XtQuantTrader(path, g.config["sessionId"])
    # callback = MyXtQuantTraderCallback()
    # xt_trader.register_callback(callback)
    # # 启动本地客户端
    # print("start xt_trader")
    # xt_trader.start()

    # print("connect xt_trader")
    # # 建立交易连接，返回0表示连接成功
    # connect_result = xt_trader.connect()
    # if connect_result != 0:
    #     info("连接失败")
    #     xt_trader.stop()
    #     sys.exit(1)
    # else:
    #     info("连接成功")

    # subscribe_result = xt_trader.subscribe(stockAccount)
    # if subscribe_result == 0:
    #     info("订阅成功")
    # else:
    #     info("订阅失败")
    #     xt_trader.stop()
    #     sys.exit(1)
    # subscribe_result = xt_trader.subscribe(stockAccountHgt)
    # if subscribe_result == 0:
    #     info("订阅成功")
    # else:
    #     info("订阅失败")
    #     xt_trader.stop()
    #     sys.exit(1)

    sector_list = xtdata.get_sector_list()
    info("sector_list:", sector_list)

    # # 查询当日所有的委托
    # orders = xt_trader.query_stock_orders(stockAccountHgt, False)
    # info("orders:", obj2JsonString(orders))

    # stock_list = xtdata.get_stock_list_in_sector('上证A股')
    # print(stock_list)

    # xt_asset = xt_trader.query_stock_asset(stockAccount)

    # info("账号类型", xt_asset.account_type)
    # info("资金账号", xt_asset.account_id)
    # info("可用金额", xt_asset.cash)
    # info("冻结金额", xt_asset.frozen_cash)
    # info("持仓市值", xt_asset.market_value)
    # info("总资产", xt_asset.total_asset)

    # info("start updateDetailTask")
    # t0 = Thread(target=updateDetailTask)
    # t0.start()
    t3 = Thread(target=printTask)
    t3.start()

    # while True:
    #     info(".")
    #     time.sleep(1)

    # startUpdatePositions()
    # connectWebSocket()
    # deals = getDeals(stockAccount)
    # info("deals A:", len(deals))
    # js = python_to_json(deals)
    # info("deals:", js)

    # deals = getDeals(stockAccountHgt)
    # info("deals HGT:", len(deals))
    # js = python_to_json(deals)
    # info("deals HGT:", js)

    # resubscribe()
    # g.subscribeId = xtdata.subscribe_whole_quote( g.stocklist, callback=subscribe_whole_callback)

    t1 = Thread(target=update1dTask)
    t1.start()

    t2 = Thread(target=update1mTask)
    t2.start()

    # t3 = Thread(target=updateTodayTask)
    # t3.start()

    # t4 = Thread(target=getActionsTask)
    # t4.start()

    # t5 = Thread(target=updatePriceTask)
    # t5.start()

    # 阻塞主线程退出
    while 1==1:
        if g.exit == 1:
            break
        time.sleep(1)
