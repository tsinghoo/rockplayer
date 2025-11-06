# encoding:gbk
'''

'''
import random
import os
import shutil
import threading
import time
import datetime
import json
import pandas as pd
import numpy as np
import talib
import inspect
import requests
import sys
import traceback
import math

from threading import Thread


class G():
    pass


g = G()
g.log = {
    "level": 4,
    "none": 0,
    "error": 1,
    "warning": 2,
    "info": 3,
    "debug": 4,
}

g.log["level"] = g.log["debug"]


account = "8883949249"  # 国金
broker = "国金"
account = "620000558442"  # 国信
broker = "国信"

runGetActionTask = 1

baseUrl = "http://192.168.66.205:3001"
baseUrl = "http://test1.91taogu.com"

g.baseUrl = "http://192.168.66.205:3001"
g.baseUrl = "http://test1.91taogu.com"

logPathPrefix = os.getenv("logPathPrefix")
if logPathPrefix:
    g.logPathPrefix = logPathPrefix
else:
    g.logPathPrefix = r"d:"


configPathPrefix = os.getenv("configPathPrefix")

if configPathPrefix:
    g.configFile = configPathPrefix + r"\qmt.config.json"
else:
    g.configFile = r"d:\qmt.config.json"

#####################################################

g.tick = {}
g.actions = {}
g.toPrint = []
today = datetime.datetime.now().date()
threadLocal = threading.local()




def subscribe_whole_callback(data):
    for stock in data:
        if stock not in g.stocklist:
            continue
        g.tick[stock] = data[stock]


def getStockList():
    # 从test1获取股票列表
    info("getStockList")
    try:
        response = requests.get(
            g.baseUrl + "/stock/codes", verify=False, timeout=5)
        if response.status_code != 200:
            info("getStockList failed:", response.status_code)
            return g.stocklist
        else:
            info("getStockList success:", response.status_code)
            response.encoding = 'utf-8'
            content = response.text
            info("getStockList response:", content)
            stocklist = json.loads(content)
            # 将g.stocklist中包含".EC"的元素去除
            stocklist = [x for x in stocklist if not x.endswith(".EC")]
            return stocklist

    except Exception as e:
        error("getStockList failed:", str(e))
        return g.stocklist


def resetThreadId(label=""):
    threadLocal.id = label + datetime.datetime.now().strftime("%H%M%S") + \
        str(random.randint(0, 1000))


def getCandidates():
    info("getCandidates")
    try:
        response = requests.get(
            g.baseUrl + "/stock/candidates", verify=False, timeout=5)
        if response.status_code != 200:
            info("请求失败，状态码:", response.status_code)
            return
        else:
            info("获取candidates成功:", response.status_code)
            response.encoding = 'utf-8'
            content = response.text
            info(content)
            return json.loads(content)

    except Exception as e:
        info("获取candidates失败:", str(e))


def getRuleCodes():
    info("getRuleCodes")
    try:
        response = requests.get(
            g.baseUrl + "/stock/rule/codes", verify=False, timeout=5)
        if response.status_code != 200:
            info("getRuleCodes:", response.status_code)
            return
        else:
            info("getRuleCodes:", response.status_code)
            response.encoding = 'utf-8'
            content = response.text
            info(content)
            return json.loads(content)

    except Exception as e:
        info("getRuleCodes failed:", str(e))


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


def get1dData(stocklist, index, startTime, endTime):
    xtdata = g.ContextInfo
    if (startTime is None):
        startTime = datetime.datetime.now().strftime("%Y%m%d%H")

    if (endTime is None):
        endTime = ""

    scode = stocklist[index]
    period = '1d'
    params = ['open', 'close', 'high', 'low', 'volume', 'amount']
    info('downloading', period, 'from', startTime, "for", scode)
    download_history_data(scode, period, startTime, endTime)
    # download_history_data2 批量版本 todo
    # params = []
    info('get', period, 'from', startTime, 'to', endTime,
         'for', scode, "(", index, "/", len(stocklist), ")")
    df = xtdata.get_market_data_ex(params, [scode], period=period,
                                   start_time=startTime, end_time=endTime, count=-1, dividend_type='none', fill_data=True)
    datas = df[scode]

    return datas


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
                # 把dateStartTime设置为1年前
                dataStartTime = (datetime.datetime.now() -
                                 datetime.timedelta(days=365)).strftime("%Y%m%d")
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


def update1dTask():
    info("update1dTask")
    try:
        g.candidates = getCandidates()
        resetThreadId("u1d")
        # update1d(g.candidates, (datetime.datetime.now() - datetime.timedelta(days=370)).strftime("%Y%m%d"))
        update1d(g.candidates)

        g.ruleCodes = getRuleCodes()
        resetThreadId("u1d")
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
    except Exception as e:
        error("update1dTask error:", str(e))
    info("update1dTask quit")


def update1mTask():
    while True:
        time.sleep(1)
        resetThreadId("u1m")
        try:
            update1m(g.ContextInfo)
        except Exception as e:
            error("update1m error:", str(e))


def updatePriceTask():
    info("upt")
    while True:
        uploadStockPrice()
        time.sleep(0.1)


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


def loadConfig():
    if not os.path.exists(g.configFile):
        g.config = {}
        with open(g.configFile, 'w') as f:
            json.dump(g.config, f)
    else:
        with open(g.configFile) as f:
            g.config = json.load(f)
    info("config:", g.config)


def saveConfig():
    # 备份g.configFile到g.configFile+".bak"
    shutil.copy(g.configFile, g.configFile+".bak")

    with open(g.configFile, 'w') as f:
        json.dump(g.config, f)


def updateActionOrdered(scode, type, status, price, orderId):
    try:
        # 目标 URL
        url = "http://test1.91taogu.com/stock/rule/action/ordered"

        # 要发送的 JSON 数据（Python 字典）
        data = {
            "broker": broker,
            "scode": scode,
            "status": status,
            "orderNo": orderId
        }

        # 设置请求头（声明内容类型为 JSON）
        headers = {
            "Content-Type": "application/json"
        }

        # 发送 POST 请求
        response = requests.post(url, data=json.dumps(data), headers=headers)

        # 输出响应
        debug("updateActionStatus:", response.status_code)
        debug("response:", response.text)

    except Exception as e:
        error("updateActionStatus 出错:", traceback.format_exc())


def getActionsTask():
    info("getActionsTask")
    while True:
        time.sleep(1)
        resetThreadId("act")
        getActions(g.ContextInfo)


def getActions(ContextInfo):
    info("getActions")
    try:
        response = requests.get(
            "http://test1.91taogu.com/stock/rule/actions?broker="+broker, timeout=5)
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
                if act["scode"] in g.actions:
                    info("已存在", act["scode"], "的action")
                else:
                    if act["action"] == "buy":
                        info("买入", act["sname"], act["scode"],
                             act["price"], act["amount"])
                        if act["amount"] == -1:
                            order_lots(act["scode"], 1,
                                       'fix', act["price"], ContextInfo, account)
                        else:
                            passorder(23, 1101, account, act["scode"], 11, act["price"],
                                      act["amount"], 2, ContextInfo)

                        info("已买入", act["sname"], act["scode"],
                             act["price"], act["amount"])

                    elif act["action"] == "sell":
                        info("卖出", act["sname"], act["scode"],
                             act["price"], act["amount"])
                        passorder(24, 1101, account, act["scode"], 11, act["price"],
                                  act["amount"], 2, ContextInfo)
                        info("已卖出", act["sname"], act["scode"],
                             act["price"], act["amount"])
                    elif act["action"] == "cancelAction":
                        info("cancel action for", act["scode"])
                        cancelAction(act["sname"], ContextInfo)
                    actionDone(act["id"])
    except Exception as e:
        error("getActions出错:", traceback.format_exc())


def cancelAction(scode, ContextInfo):
    accountTypes = ["stock", "HUGANGTONG", "SHENGANGTONG"]

    for type in accountTypes:
        orders = get_trade_detail_data(account, type, 'order')
        info("query_stock_orders", type, obj2JsonString(orders, 2))
        orders = obj2Json(orders)
        for order in orders:
            # 如果order["stock_code"]以 scode开始
            if order["m_strInstrumentID"].startswith(scode) or scode == "":
                orderId = order["m_strOrderSysID"]
                info("cancel order for", scode, orderId)
                res = cancel(orderId, account, type, ContextInfo)
                info("cancelled:", res)

    if scode in g.actions:
        del g.actions[scode]
    elif scode == "":
        g.actions = {}


def actionDone(id):
    try:
        response = requests.get(
            baseUrl+"/stock/action/done?id="+id, timeout=20)
        if response.status_code != 200:
            error("action done error:", response.status_code,
                  "响应内容:", response.text)
    except Exception as e:
        error("action done error:", str(e))


def getFloat(a):
    return None if isinstance(a, float) and math.isnan(a) else a


def syncPosition(accountType):
    info("syncPosition", accountType)
    body = {
        "broker": broker,
        "clean": 1,
        "passcode": "995560"
    }

    if (accountType != "clean"):
        data = get_trade_detail_data(account, accountType, 'position')
        info('查询持仓结果：')
        positions = []
        for dt in data:
            position = {
                "broker": broker,
                "account_id": account,
                "avg_price": dt.m_dOpenPrice,
                "can_use_volume": dt.m_nCanUseVolume,
                "frozen_volume": dt.m_nFrozenVolume,
                "market_value": dt.m_dMarketValue,
                "on_road_volume": dt.m_nOnRoadVolume,
                "floatProfit": getFloat(dt.m_dFloatProfit),
                "open_price": dt.m_dOpenPrice,
                "stock_code": dt.m_strInstrumentID,
                "volume": dt.m_nVolume
            }

            positions.append(position)

        body = {"data": positions, "passcode": "995560"}
    info("body:", json.dumps(body, indent=None))
    response = requests.post(
        "http://test1.91taogu.com/stock/positions", json=body, timeout=5)
    if response.status_code != 200:
        error("上传持仓失败，状态码:", response.status_code)
        return
    else:
        response.encoding = 'utf-8'
        info("上传持仓到test1成功:", accountType)


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
    """增强版log函数，完全模拟print的参数行为"""
    current_time = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    # 将时间作为第一个元素插入到输出中
    if (hasattr(threadLocal, "id")):
        time_header = f"[{current_time}][{threadLocal.id}]"
    else:
        time_header = f"[{current_time}]"

    all_args = (time_header,) + args
    # print(*all_args, **kwargs)
    g.toPrint.append([all_args, kwargs])


# 资金账号状态变化主推 account_callback()
def account_callback(ContextInfo, accountInfo):
    info('account_callback:')  # m_strStatus 为资金账号的属性之一，表示资金账号的状态
    # printObj(accountInfo)


def printObj(data, indent="  "):
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
                    info(f"{field}: (无法获取值: {e})")


# 账号委托状态变化主推
def task_callback(ContextInfo, data):
    info('task_callback')
    debug(obj2JsonString(data))
    js = obj2Json(data)
    type = js["m_eOrderType"]
    status = js["m_eStatus"]
    scode = js["m_stockCode"]
    strMsg = js["m_strMsg"]

    updateActionOrdered(scode, type, status, 0, strMsg)

# 账号成交状态变化主推


def order_callback(ContextInfo, data):
    info('order_callback')
    debug(obj2JsonString(data, 1))
    js = obj2Json(data, 1)
    type = js["m_nOpType"]
    status = js["m_nOrderStatus"]
    submitStatus = js["m_nOrderSubmitStatus"]
    price = js["m_dLimitPrice"]
    scode = js["m_strInstrumentID"]
    amount = js["m_nVolumeTotalOriginal"]
    orderId = js["m_strOrderSysID"]
    updateActionOrdered(scode, type, status, price, orderId)


def orderError_callback(ContextInfo, orderArgs, errMsg):
    error('orderError_callback')
    error(errMsg)
    printObj(orderArgs)


def updateDeal(deal):
    try:
        # 目标 URL
        url = "http://test1.91taogu.com/stock/deal/update"

        # 设置请求头（声明内容类型为 JSON）
        headers = {
            "Content-Type": "application/json"
        }

        # 发送 POST 请求
        response = requests.post(url, data=json.dumps(deal), headers=headers)

        # 输出响应
        debug("updateDeal:", response.status_code)
        debug("response:", response.text)

    except Exception as e:
        error("updateDeal 出错:", traceback.format_exc())

# 账号持仓状态变化主推


def deal_callback(ContextInfo, data):
    info('deal_callback')
    debug(obj2JsonString(data))

    js = obj2Json(data, 1)

    deal = {
        "tprice": js["m_dPrice"],
        "scode": js["m_strInstrumentID"],
        "sname": js["m_strInstrumentName"],
        "market": js["m_strExchangeName"],
        "operationDirection": js["m_strOptName"],
        "operationName": broker,
        "tday": js["m_strTradeDate"],
        "ttime": js["m_strTradeTime"],
        # "tid": js["m_strTradeID"],
        "tid": js["m_strOrderSysID"],
        "tcash": js["m_dTradeAmount"],
        "tamount": js["m_nVolume"],
        "tpair": ""
    }

    if deal["operationDirection"].find("卖") != -1:
        deal["tamount"] = -deal["tamount"]

    info(json.dumps(deal, indent=2))

    updateDeal(deal)

    syncPosition("clean")
    syncPosition("stock")
    syncPosition("HUGANGTONG")
    syncPosition("SHENGANGTONG")


def position_callback(ContextInfo, data):
    info('position_callback')
    debug(obj2JsonString(data))

    js = obj2Json(data, 1)

    # broker text, account_id text, avg_price real, can_use_volume real, frozen_volume real, market_value real, on_road_volume real, open_price real, stock_code text, volume real

    position = {
        "broker": broker,
        "account_id": account,
        "avg_price": js["m_dOpenPrice"],
        "can_use_volume": js["m_nCanUseVolume"],
        "frozen_volume": js["m_nFrozenVolume"],
        "market_value": js["m_dMarketValue"],
        "on_road_volume": js["m_nOnRoadVolume"],
        "m_dFloatProfit": js["m_dFloatProfit"],
        "open_price": js["m_dLastPrice"],
        "stock_code": js["m_strInstrumentID"],
        "volume": js["m_nVolume"]
    }

    info(json.dumps(position, indent=2))


def orderError_callback(ContextInfo, orderArgs, errMsg):
    error('orderError_callback')
    error(errMsg)
    debug(obj2JsonString(orderArgs))


def initLastStartTime1d():
    g.config["lastStartTime1d"] = (datetime.datetime.now() - datetime.timedelta(days=370)).strftime(
        "%Y%m%d")
    info("lastStartTime1d:", g.config["lastStartTime1d"])


def update1mTimer(ci):
    try:
        resetThreadId("u1m")
        update1m(ci)
    except Exception as e:
        error("update1m error:", str(e))


def update1m(ci):
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
    for index, scode in enumerate(g.stocklist):
        for period in pds:
            params = ['open', 'close', 'high', 'low', 'volume', 'amount']
            if period == "tick":
                params = ['volume', 'amount', 'lastPrice']
            # params = []
            info('downloading', period, 'for', scode, 'from', dataStartTime)
            download_history_data(
                scode, period, dataStartTime, dataEndTime, incrementally=True)
            info('get', period, 'from', dataStartTime, 'to', dataEndTime,
                 'for', scode, "(", index, "/", len(g.stocklist), ")")
            df = ci.get_market_data_ex(params, [scode], period=period,
                                       start_time=dataStartTime, end_time=dataEndTime, count=-1, dividend_type='none', fill_data=True)
            datas = df[scode]
            # print("所有列名:", df.keys())
            # info("所有:", df.values())
            columns = ['Time'] + datas.columns.tolist()
            # debug(columns)
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


def printTask():
    while True:
        toPrint, g.toPrint = g.toPrint, []
        log2File(toPrint, g.logPathPrefix + "\\qmt.action")
        time.sleep(0.1)


def log2File(toPrint, file="d:\\qmt.action", sep=' ', end='\n', flush=True, mode='a', encoding='utf-8'):
    print("log2File")
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

def init(ContextInfo):
    info("init")
    info(sys.version)
    info(sys.executable)
    loadConfig()
    ContextInfo.set_account(account)
    g.ContextInfo = ContextInfo
    g.stocklist = getStockList()
    ContextInfo.set_universe(g.stocklist)

    t3 = Thread(target=printTask)
    t3.start()


def after_init(ContextInfo):
    info('after_init')


def handlebar(ContextInfo):
    info("handlebar ", ContextInfo.barpos)
    g.ContextInfo = ContextInfo
    update1d()
    # resetThreadId("hdlbar")
    # g.ContextInfo = ContextInfo
    # update1mTimer(ContextInfo)


def stop(ContextInfo):
    error('stop')
