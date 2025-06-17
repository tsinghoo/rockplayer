import os
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
import pandas as pd
import numpy as np
import requests
import sys
import traceback
from threading import Thread
from colorama import Fore, Back, Style
import colorama
colorama.init()


class G():
    pass


g = G()


g.account = "620000558442"  # 国信
g.account = "8883949249"  # 国金
g.broker = "国金"

g.session_id = 1001

g.tick = {}
g.actions = {}
g.reloadK1d = []
g.uploading = 0
g.stocklist = ['000300.SH', '000004.SZ']

baseUrl = "http://192.168.66.205:3001"
baseUrl = "http://test1.91taogu.com"

g.log = {
    "level": 4,
    "none": 0,
    "error": 1,
    "warning": 2,
    "info": 3,
    "debug": 4,
}

g.configFile = "d:\\qmt.config.json"

g.log["level"] = g.log["debug"]

g.toPrint = []
today = datetime.datetime.now().date()
threadLocal = threading.local()


class MyXtQuantTraderCallback(XtQuantTraderCallback):
    def on_disconnected(self):
        """
        连接状态回调
        :return:
        """
        info("connection lost callback")

    def on_account_status(self, status):
        """
        账号状态信息推送
        :param response: XtAccountStatus 对象
        :return:
        """
        info("on_account_status callback")
        info(status.account_id, status.account_type, status.status)

    def on_stock_asset(self, asset):
        """
        资金信息推送  注意，该回调函数目前不生效
        :param asset: XtAsset对象
        :return:
        """
        info("on asset callback")
        info(object_to_json(asset))
        info(asset.account_id, asset.cash, asset.total_asset)

    def on_stock_order(self, order):
        """
        委托信息推送
        :param order: XtOrder对象
        :return:
        """
        info("on order callback:")
        info(object_to_json(order))
        updateActionOrdered(order.stock_code, order.order_type,
                            order.order_status, order.traded_price, order.order_sysid)
        # print(order.stock_code, order.order_status, order.order_sysid)

    def on_stock_trade(self, trade):
        """
        成交信息推送
        :param trade: XtTrade对象
        :return:
        """
        # resetThreadId("st")
        info("on_stock_trade callback:")
        try:
            js = obj2Json(trade, 1)
            # js["traded_time"]是时间戳，将它转换成时间字符串
            tradeTime = datetime.datetime.fromtimestamp(js["traded_time"])

            deal = {
                "tprice": js["traded_price"],
                "scode": js["m_strStockCode"],
                "sname": "",
                "market": "",
                "operationDirection": "买入" if js["direction"] == 48 else "卖出",
                "operationName": g.broker,
                "tday": tradeTime.strftime("%Y-%m-%d"),
                "ttime": tradeTime.strftime("%H:%M:%S"),
                # "tid": js["m_strTradeID"],
                "tid": js["m_strTradedID"],
                "tcash": js["traded_amount"],
                "tamount": js["traded_volume"],
                "tpair": ""
            }

            if deal["operationDirection"].find("卖") != -1:
                deal["tamount"] = -deal["tamount"]

            info(json.dumps(deal, indent=2))

            updateDeal(deal)

        except Exception as e:
            error("on_stock_trade 出错:", traceback.format_exc())

    # print(trade.account_id, trade.stock_code, trade.order_id)

    def on_order_error(self, order_error):
        """
        下单失败信息推送
        :param order_error:XtOrderError 对象
        :return:
        """
        info("on order_error callback")
        info(order_error.order_id, order_error.error_id, order_error.error_msg)

    def on_stock_position(self, position):
        """
        持仓信息推送  注意，该回调函数目前不生效
        :param position: XtPosition对象
        :return:
        """
        print("on position callback")
        print(position.stock_code, position.volume)

    def on_cancel_error(self, cancel_error):
        """
        撤单失败信息推送
        :param cancel_error: XtCancelError 对象
        :return:
        """
        print("on cancel_error callback")
        print(cancel_error.order_id, cancel_error.error_id, cancel_error.error_msg)

    def on_order_stock_async_response(self, response):
        """
        异步下单回报推送
        :param response: XtOrderResponse 对象
        :return:
        """
        info("on_order_stock_async_response callback")
        info(response.account_id, response.order_id, response.seq)

    def on_smt_appointment_async_response(self, response):
        """
        :param response: XtAppointmentResponse 对象
        :return:
        """
        info("on_smt_appointment_async_response callback")
        info(response.account_id, response.order_sysid,
             response.error_id, response.error_msg, response.seq)


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
    with open(g.configFile, 'w') as f:
        json.dump(g.config, f)


def init():
    print(sys.version)
    print(sys.executable)
    loadConfig()
    # 设置全局变量
    # 从test1获取股票列表
    try:
        response = requests.get(
            "http://test1.91taogu.com/stock/codes", timeout=5)
        if response.status_code != 200:
            print("请求失败，状态码:", response.status_code)
            return
        else:
            print("从test1获取stock codes成功:", response.status_code)
            response.encoding = 'utf-8'
            content = response.text
            print(content)
            g.stocklist = json.loads(content)

    except Exception as e:
        print("获取stockk list失败:", str(e))


def uploadStockPrice():
    # 组装成json对象post到test1.91taogu.com
    # 为data添加passcode属性
    sb, g.tick = g.tick, {}  # 这行是原子的
    if (len(list(sb)) < 1):
        info(Back.CYAN, "0 stocks, skip upload", Style.RESET_ALL)
        return
    info(Back.CYAN, "上传", len(list(sb)), "个股票价格", Style.RESET_ALL)
    # info(sb.keys())
    try:
        response = requests.post("http://test1.91taogu.com/stock/quotes.mini", json={
            "data": sb, "passcode": "995560"}, timeout=5)
        if response.status_code != 200:
            error("请求失败，状态码:", response.status_code)
            return
        else:
            response.encoding = 'utf-8'
            # info("请求test1成功:", response.status_code, response.text)
    except Exception as e:
        error("请求失败:", str(e))


def uploadPosition(positions):
    # 组装成json对象post到test1.91taogu.com

    print("上传", len(positions), "个股票持仓")
    try:
        # positions 里的没个元素只保留 broker 属性
        data = []
        for position in positions:
            data.append({
                "broker": "国金",
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

        response = requests.post("http://test1.91taogu.com/stock/positions", json={
            "data": data, "passcode": "995560"}, timeout=5)
        if response.status_code != 200:
            error("上传持仓失败，状态码:", response.status_code)
            return
        else:
            response.encoding = 'utf-8'
            info("上传持仓到test1成功:", response.status_code, response.text)
    except Exception as e:
        print("请求失败:", str(e))


def resetThreadId(label=""):
    threadLocal.id = label + datetime.datetime.now().strftime("%H%M%S") + \
        str(random.randint(0, 1000))


def update1dTask():
    while True:
        time.sleep(1)
        resetThreadId("u1d")
        reloadK1d, g.reloadK1d = g.reloadK1d, []
        if len(reloadK1d) > 0:
            info("reloading 1d data")
            for scode in reloadK1d:
                updateActionOrdered(scode, "", "56", 0, "")
                update1d([scode.replace(".HGT", ".HK")], "20210101", "")

        update1d()


def update1mTask():
    while True:
        time.sleep(1)
        resetThreadId("u1m")
        update1m()


def getActionsTask():
    while True:
        time.sleep(1)
        resetThreadId("act")
        getActions()


def getActions():
    try:
        response = requests.get(
            "http://test1.91taogu.com/stock/rule/actions?broker="+g.broker, timeout=5)
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
                        if "ETF" in act["sname"] or act["scode"].startswith(("51","15")):
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
                    g.actions[act["scode"]] = act
    except Exception as e:
        error("getActions出错:", traceback.format_exc())


def updateActionOrdered(scode, type, status, price, orderId):
    try:
        # 目标 URL
        url = "http://test1.91taogu.com/stock/rule/action/ordered"

        # 要发送的 JSON 数据（Python 字典）
        data = {
            "broker": g.broker,
            "scode": scode.split(".")[0],
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


def update1d(stocklist=None, dataStartTime=None, dataEndTime=None):
    info("update1d")
    if (stocklist is None):
        stocklist = g.stocklist
    if (dataStartTime is None):
        # 判断g.config里是否有lastStartTime1d这个key
        if "lastStartTime1d" not in g.config:
            g.config["lastStartTime1d"] = datetime.datetime.now().strftime(
                "%Y%m%d")
            info("lastStartTime1d:", g.config["lastStartTime1d"])
            saveConfig()

        dataStartTime = (datetime.datetime.strptime(
            g.config["lastStartTime1d"], "%Y%m%d") - datetime.timedelta(minutes=0)).strftime("%Y%m%d")
    if (dataEndTime is None):
        dataEndTime = ""

    pds = ["1d"]
    for index, scode in enumerate(stocklist):
        for period in pds:
            params = ['open', 'close', 'high', 'low', 'volume', 'amount']
            if period == "tick":
                params = ['volume', 'amount', 'lastPrice']

            info('downloading', period, 'from', dataStartTime)
            xtdata.download_history_data(
                scode, period, dataStartTime, dataEndTime)
            # download_history_data2 批量版本 todo
            # params = []
            info(Back.RED, 'get', period, 'for', scode, 'from',
                 dataStartTime, 'to', dataEndTime, "(", index, "/", len(stocklist), ")", Style.RESET_ALL)
            df = xtdata.get_market_data_ex(params, stock_list=[scode], period=period,
                                           start_time=dataStartTime, end_time=dataEndTime, count=-1, dividend_type='none', fill_data=True)
            datas = df[scode]
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
                            baseUrl+"/stock/data/upload", json=body, timeout=20)
                        if response.status_code != 200:
                            error("上传失败，状态码:", response.status_code,
                                  "响应内容:", response.text)
                    except Exception as e:
                        error("上传失败:", str(e))

            # result_dict = {str(date): datas.loc[date].to_dict() for date in datas.index}
            # print(obj2JsonString(result_dict))
            # json_result = json.dumps(result_dict, indent=4)
            # print(json_result)

            # print(obj2JsonString(df[scode]))
            # print(datas.to_json(orient='index'))


def update1m():
    info("update1m")
    stocklist = g.stocklist
    pds = ["1m"]

    if "lastStartTime1m" not in g.config:
        today = datetime.datetime.now().date()
        g.config["lastStartTime1m"] = datetime.datetime.combine(
            today, datetime.time(9, 0)).strftime("%Y%m%d%H%M%S")
        info("lastStartTime1m:", g.config["lastStartTime1m"])
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
            info('==downloading', period, 'from', dataStartTime)
            xtdata.download_history_data(
                scode, period, dataStartTime, dataEndTime)
            info(Back.GREEN, 'get', period, 'for', scode, 'from',
                 dataStartTime, 'to', dataEndTime, "(", index, "/", len(stocklist), ")", Style.RESET_ALL)
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
                for idx, row in batch.iterrows():
                    batch_data = [[str(idx)] + [row["open"], row["close"],
                                                row["high"], row["low"], row["volume"], row["amount"]]]
                # info(obj2JsonString(batch_data, indent=None))
                    body = {"data": obj2Json(
                        batch_data), "scode": scode, "period": period, "passcode": "995560"}
                    debug("body:", body)
                    # 上传数据到test1
                    try:
                        response = requests.post(
                            baseUrl+"/stock/data/upload", json=body, timeout=20)
                        if response.status_code != 200:
                            error("上传失败，状态码:", response.status_code,
                                  "响应内容:", response.text)
                    except Exception as e:
                        error("上传失败:", str(e))

            # result_dict = {str(date): datas.loc[date].to_dict() for date in datas.index}
            # info(obj2JsonString(result_dict))
            # json_result = json.dumps(result_dict, indent=4)
            # info(json_result)

            # info(obj2JsonString(df[scode]))
            # info(datas.to_json(orient='index'))


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


def buy(scode, price, volume):
    stockAccount = StockAccount(g.account)

    order_id = xt_trader.order_stock(
        stockAccount, scode, xtconstant.STOCK_BUY, volume, xtconstant.FIX_PRICE, price, 'strategy1', '')
    return order_id


def sell(scode, price, volume):
    stockAccount = StockAccount(g.account)
    order_id = xt_trader.order_stock(
        stockAccount, scode, xtconstant.STOCK_SELL, volume, xtconstant.FIX_PRICE, price, 'strategy1', '')
    return order_id


def cancel(order_id):
    stockAccount = StockAccount(g.account)
    return xt_trader.cancel_order_stock(stockAccount, order_id)


def getOrders(cancelable_only):
    stockAccount = StockAccount(g.account)
    orders = xt_trader.query_stock_orders(stockAccount, cancelable_only)
    return orders


def getPositions():
    stockAccount = StockAccount(g.account)
    positions = xt_trader.query_stock_positions(stockAccount)
    return positions


def getDeals():
    stockAccount = StockAccount(g.account)
    result = xt_trader.export_data(
        stockAccount, "d:\\guojin_deal.csv", "deal", start_time="2025-01-01", end_time="2025-05-11")
    info(result)

    deals = xt_trader.query_data(
        stockAccount, "d:\\guojin_deal.csv", "deal", start_time="2025-01-01", end_time="2025-05-11")
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


def subscribe_whole_callback(data):

    for stock in data:
        if stock not in g.stocklist:
            continue
        g.tick[stock] = data[stock]


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
    """增强版log函数，完全模拟print的参数行为"""
    current_time = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    # 将时间作为第一个元素插入到输出中
    if (hasattr(threadLocal, "id")):
        time_header = f"[{current_time}][{threadLocal.id}]"
    else:
        time_header = f"[{current_time}]"

    all_args = (time_header,) + args

    g.toPrint.append([all_args, kwargs])


def log2File(toPrint, file="d:\\qmt.mini", sep=' ', end='\n', flush=True, mode='a', encoding='utf-8'):
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
        log2File(toPrint)
        while len(toPrint) > 0:
            item = toPrint.pop(0)
            print(*item[0], **item[1])

        time.sleep(0.1)


if __name__ == '__main__':
    # Mini-QMT的userdata_mini路径
    path = r'D:\国金证券QMT交易端\userdata_mini'
    # 生成session id 整数类型 同时运行的策略不能重复
    stockAccount = StockAccount(g.account)
    stockAccountHgt = StockAccount(g.account, "HUGANGTONG")
    xt_trader = XtQuantTrader(path, g.session_id)
    callback = MyXtQuantTraderCallback()
    xt_trader.register_callback(callback)
    # 启动本地客户端
    xt_trader.start()

    # 建立交易连接，返回0表示连接成功
    connect_result = xt_trader.connect()
    if connect_result != 0:
        info("连接失败")
        xt_trader.stop()
        sys.exit(1)
    else:
        info("连接成功")

    subscribe_result = xt_trader.subscribe(stockAccount)
    if subscribe_result == 0:
        info("订阅成功")
    else:
        info("订阅失败")
        xt_trader.stop()
        sys.exit(1)
    subscribe_result = xt_trader.subscribe(stockAccountHgt)
    if subscribe_result == 0:
        info("订阅成功")
    else:
        info("订阅失败")
        xt_trader.stop()
        sys.exit(1)

    sector_list = xtdata.get_sector_list()
    info("sector_list:", sector_list)

    orders = xt_trader.query_stock_orders(stockAccountHgt, False)
    info("orders:", obj2JsonString(orders))

    # stock_list = xtdata.get_stock_list_in_sector('上证A股')
    # print(stock_list)

    xt_asset = xt_trader.query_stock_asset(stockAccount)

    info('账号类型', xt_asset.account_type)
    info('资金账号', xt_asset.account_id)
    info('可用金额', xt_asset.cash)
    info('冻结金额', xt_asset.frozen_cash)
    info('持仓市值', xt_asset.market_value)
    info('总资产', xt_asset.total_asset)

    init()

    positions = getPositions()

    print("positions:", len(positions))
    js = object_to_json(positions)

    uploadPosition(js)

    # deals = getDeals()
    # print("deals:", len(deals))
    # js = python_to_json(deals)
    # print(js)

    xtdata.subscribe_whole_quote(
        g.stocklist, callback=subscribe_whole_callback)

    t1 = Thread(target=update1dTask)
    t2 = Thread(target=update1mTask)
    t3 = Thread(target=printTask)
    t4 = Thread(target=getActionsTask)
    t1.start()
    t2.start()
    t3.start()
    t4.start()

    while True:
        uploadStockPrice()
        time.sleep(0.5)

    # 阻塞主线程退出
    # xt_trader.run_forever()
