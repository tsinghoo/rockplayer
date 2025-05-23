# encoding:gbk
'''

'''
import datetime
import json
import pandas as pd
import numpy as np
import talib
import inspect
import requests
import sys
import traceback


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

#####################################################

g.actions = {}
stocks = {}
# 初始化函数 - 策略运行开始时调用一次


def init(ContextInfo):
    print(sys.version)
    print(sys.executable)
    ContextInfo.set_account(account)
    stocklist = ['000300.SH', '000004.SZ']
    ContextInfo.set_universe(stocklist)
    if (runGetActionTask == 1):
        info("start getActions task")
        ContextInfo.run_time("getActions", "5nSecond", "2025-04-09 13:20:00")


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


def getActions(ContextInfo):
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

                        passorder(23, 1101, account, act["scode"], 11, act["price"],
                                  act["amount"], 2, ContextInfo)

                        info("已买入", act["sname"], act["scode"],
                             act["price"], act["amount"])

                    elif act["action"] == "sell":
                        info("卖出", act["sname"], act["scode"],
                             act["price"], act["amount"])
                        # passorder(24, 1101, account, act["scode"], 11, act["price"],
                        #           act["amount"], ContextInfo)

                    g.actions[act["scode"]] = act
    except Exception as e:
        error("getActions出错:", traceback.format_exc())


def after_init(ContextInfo):
    info('after_init')


# 行情处理函数 - 每次行情更新时调用


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
    time_header = f"[{current_time}]"
    all_args = (time_header,) + args

    # 处理print的特殊参数（file/flush等）
    print(*all_args, **kwargs)


def handlebar(ContextInfo):
    info("handlebar ", ContextInfo.barpos)
    pass


# 资金账号状态变化主推 account_callback()
def account_callback(ContextInfo, accountInfo):
    info('account_callback:')  # m_strStatus 为资金账号的属性之一，表示资金账号的状态
    # printObj(accountInfo)


def printObj(data, indent="  "):
    dirs = dir(data)
    if not dirs:
        print(data)
    else:
        for field in dirs:
            if not field.startswith("_"):  # 过滤掉Python内置属性
                try:
                    value = getattr(data, field)
                    # child = printObj(value, indent+"  ")
                    print(f"{indent}{field}:{value}\n")
                except Exception as e:
                    print(f"{field}: (无法获取值: {e})")


# 账号委托状态变化主推
def task_callback(ContextInfo, data):
    info('task_callback')
    debug(obj2JsonString(data))

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
    # debug(obj2JsonString(data))

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
        "tid": js["m_strTradeID"],
        "tcash": js["m_dTradeAmount"],
        "tamount": js["m_nVolume"],
        "tpair": ""
    }

    info(json.dumps(deal, indent=2))

    updateDeal(deal)


def position_callback(ContextInfo, data):
    info('position_callback')


def orderError_callback(ContextInfo, orderArgs, errMsg):
    error('orderError_callback')
    error(errMsg)
    debug(obj2JsonString(orderArgs))


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


def stop(ContextInfo):
    error('stop')
