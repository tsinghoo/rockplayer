# encoding:gbk
'''

'''
import datetime
import json
import pandas as pd
import numpy as np
import talib
import requests
import inspect
import sys
import traceback


class G():
    pass


g = G()

account = "8883949249"  # 国金
broker = "国金"
account = "620000558442"  # 国信
broker = "国信"

periods = ["1d", "5m", "1m", "tick"]
periods = ["tick"]
dataStartTime = "20250603"
dataEndTime = ""


g.log = {
    "level": 4,
    "none": 0,
    "error": 1,
    "warning": 2,
    "info": 3,
    "debug": 4,
}

g.log["level"] = g.log["debug"]

g.actions = {}
stocks = {}
# 初始化函数 - 策略运行开始时调用一次


def init(ContextInfo):
    print(sys.version)
    print(sys.executable)
    # 设置全局变量
    # 从test1获取股票列表
    stocklist = ['000300.SH', '000004.SZ']
    try:
        response = requests.get(
            "http://test1.91taogu.com/stock/codes", timeout=5)
        if response.status_code != 200:
            print("请求失败，状态码:", response.status_code)
            return
        else:
            print("请求test1成功:", response.status_code)
            response.encoding = 'utf-8'
            content = response.text
            print(content)
            stocklist = json.loads(content)

    except Exception as e:
        print("获取stockk list失败:", str(e))

    ContextInfo.set_universe(stocklist)
    ContextInfo.set_account(account)              # 交易账户
    ContextInfo.last_print_time = 0       # 上次打印时间


def after_init(ContextInfo):
    info('系统会在init函数执行完后和执行handlebar之前调用after_init')
    stocklist = ContextInfo.get_universe()
    

    # stocklist = ['300870.SZ']
    # periods = ["1d"]
    # dataStartTime = "20140101"
    # 打印subs有多少个股票
    for period in periods:
        for scode in stocklist:
            info('downloading', period, 'for', scode, 'from', dataStartTime)
            download_history_data(scode, period, dataStartTime, dataEndTime)


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
    # print(ContextInfo.period)
    debug("handlebar ", ContextInfo.barpos)
    return
    # print(ContextInfo.is_suspended_stock("600004.SH"))

    # pass


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
