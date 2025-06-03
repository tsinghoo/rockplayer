# encoding:gbk
'''

'''
import datetime
import json
import pandas as pd
import numpy as np
import talib
import requests
import sys
import traceback


class G():
    pass

g = G()

account = "8883949249"  # 国金
broker = "国金"
account = "620000558442"  # 国信
broker = "国信"
uploadPrice = 1
runGetActionTask = 0
dataStartTime = "2025-01-01"
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
        print("获取stock list失败:", str(e))

    ContextInfo.set_universe(stocklist)
    ContextInfo.set_account(account)              # 交易账户
    ContextInfo.last_print_time = 0       # 上次打印时间

    if (uploadPrice == 1):
        ContextInfo.run_time("uploadStockPrice",
                             "1nSecond", "2025-04-09 13:20:00")

    if (runGetActionTask == 1):
        ContextInfo.run_time("getActions", "1nSecond", "2025-04-09 13:20:00")
    updateAccount(ContextInfo)
    # getTradeDetail(ContextInfo)


def quote_callback(s):
    def callback(datas):
        global stocks
        # print("details========", type(datas))
        '''
        js=json.dumps(datas,indent=2)
        print(js)
        return
        '''
        for stock_code in datas:
            data = datas[stock_code]
            js = json.loads(getattr(data, "T").to_json())
            stocks[stock_code] = js
            # print(stock_code, ":", list(js))

            '''
            for field in dir(data):
                if not field.startswith("__"):  # 过滤掉Python内置属性
                    try:
                        value = getattr(data, field)
                        js = value.to_json()
                        print(f"{field}:${type(value)}\n {js}")
                    except:
                        continue
            '''

    return callback


def uploadStockPrice(ContextInfo):
    # 组装成json对象post到test1.91taogu.com
    # 为data添加passcode属性
    global stocks
    sb, stocks = stocks, {}  # 这行是原子的
    if len(list(sb)) == 0:
        return
    debug("上传", len(list(sb)), "个股票价格")
    try:
        response = requests.post("http://test1.91taogu.com/stock/quotes", json={
            "data": sb, "passcode": "995560"}, timeout=5)
        if response.status_code != 200:
            error("请求失败，状态码:", response.status_code)
            return
        else:
            response.encoding = 'utf-8'
            debug("请求test1成功:", response.status_code, response.text)
    except Exception as e:
        debug("请求失败:", str(e))


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

                    g.actions[act["scode"]] = act
    except Exception as e:
        error("getActions出错:", traceback.format_exc())


def after_init(ContextInfo):
    info('系统会在init函数执行完后和执行handlebar之前调用after_init')
    stocklist = ContextInfo.get_universe()
    # '''
    info("订阅", len(stocklist), "个股票中")
    for stock_code in stocklist:
        ContextInfo.subscribe_quote(
            stock_code, "tick", "none", '', quote_callback(stock_code))

    subs = ContextInfo.get_all_subscription()
    # 打印subs有多少个股票

    info("已订阅", len(subs), "个股票")
    # '''

    '''
    df = ContextInfo.get_market_data_ex(['open', 'high', 'low', 'askPrice', 'bidPrice'], stock_code=ContextInfo.get_universe(
    ), period='follow', start_time='', end_time='', count=-1, dividend_type='follow', fill_data=True, subscribe=True)

    print(df)
    '''

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


def getTradeDetail(ContextInfo):
    # 获取一周内历史交易信息
    # 遍历每个日期的交易信息

    # 获取当前日期
    today = datetime.datetime.now().strftime('%Y%m%d')
    # 获取一周前的日期
    startDate = (datetime.datetime.now() -
                 datetime.timedelta(days=7)).strftime('%Y%m%d')
    # 获取历史交易信息
    # 该函数不存在
    obj_list = get_history_trade_detail_data(
        account, 'stock', 'position', startDate, today)
    print("历史交易信息：")
    for time, data in obj_list:
        for obj in data:
            print(obj.m_strInstrumentID)
            print(dir(obj))  # 查看有哪些属性字段


def handlebar(ContextInfo):
    # print(ContextInfo.period)
    debug("handlebar ", ContextInfo.barpos)
    # print(ContextInfo.is_suspended_stock("600004.SH"))

    # pass


def query_info(C):

    accounts = get_trade_detail_data(account, 'stock', 'account')
    json_accounts = []
    for dt in accounts:
        print(f'总资产: {dt.m_dBalance:.2f}, 净资产: {dt.m_dAssureAsset:.2f}, 总市值: {dt.m_dInstrumentValue:.2f}',
              f'总负债: {dt.m_dTotalDebit:.2f}, 可用金额: {dt.m_dAvailable:.2f}, 盈亏: {dt.m_dPositionProfit:.2f}')
        # 组装成json对象
        acc = {
            '总资产': dt.m_dBalance,
            '净资产': dt.m_dAssureAsset,
            '总市值': dt.m_dInstrumentValue,
            '总负债': dt.m_dTotalDebit,
            '可用金额': dt.m_dAvailable,
            '盈亏': dt.m_dPositionProfit
        }
        json_accounts.append(acc)

    orders = get_trade_detail_data(account, 'stock', 'order')
    json_orders = []
    for o in orders:
        print(f'股票代码: {o.m_strInstrumentID}, 市场类型: {o.m_strExchangeID}, 证券名称: {o.m_strInstrumentName}, 买卖方向: {o.m_nOffsetFlag}',
              f'委托数量: {o.m_nVolumeTotalOriginal}, 成交均价: {o.m_dTradedPrice}, 成交数量: {o.m_nVolumeTraded}, 成交金额:{o.m_dTradeAmount}')
        # 组装成json对象
        order = {
            '代码': o.m_strInstrumentID,
            '市场': o.m_strExchangeID,
            '名称': o.m_strInstrumentName,
            '买卖方向': o.m_nOffsetFlag,
            '委托数量': o.m_nVolumeTotalOriginal,
            '成交均价': o.m_dTradedPrice,
            '成交数量': o.m_nVolumeTraded,
            '成交金额': o.m_dTradeAmount
        }
        json_orders.append(order)

    deals = get_trade_detail_data(account, 'stock', 'deal')
    json_deals = []
    for dt in deals:
        print(f'股票代码: {dt.m_strInstrumentID}, 市场类型: {dt.m_strExchangeID}, 证券名称: {dt.m_strInstrumentName}, 买卖方向: {dt.m_nOffsetFlag}',
              f'成交价格: {dt.m_dPrice}, 成交数量: {dt.m_nVolume}, 成交金额: {dt.m_dTradeAmount}')
        # 组装成json对象
        deal = {
            '代码': dt.m_strInstrumentID,
            '市场': dt.m_strExchangeID,
            '名称': dt.m_strInstrumentName,
            '买卖方向': dt.m_nOffsetFlag,
            '成交价格': dt.m_dPrice,
            '成交数量': dt.m_nVolume,
            '成交金额': dt.m_dTradeAmount
        }

        json_deals.append(deal)

    positions = get_trade_detail_data(account, 'stock', 'position')
    json_positions = []
    for dt in positions:
        print(f'股票代码: {dt.m_strInstrumentID}, 市场类型: {dt.m_strExchangeID}, 证券名称: {dt.m_strInstrumentName}, 持仓量: {dt.m_nVolume}, 可用数量: {dt.m_nCanUseVolume}',
              f'成本价: {dt.m_dOpenPrice:.2f}, 市值: {dt.m_dInstrumentValue:.2f}, 持仓成本: {dt.m_dPositionCost:.2f}, 盈亏: {dt.m_dPositionProfit:.2f}')

        # 将positions转换为json列表
        position = {
            '代码': dt.m_strInstrumentID,
            '市场': dt.m_strExchangeID,
            '名称': dt.m_strInstrumentName,
            '持仓量': dt.m_nVolume,
            '可用数量': dt.m_nCanUseVolume,
            '成本价': dt.m_dOpenPrice,
            '市值': dt.m_dInstrumentValue,
        }

        json_positions.append(position)

    return {"orders": json_orders,
            "deals": json_deals,
            "positions": json_positions,
            "accounts": json_accounts
            }


def updateAccount(ContextInfo):
    data = query_info(ContextInfo)
    # 组装成json对象post到test1.91taogu.com
    # 为data添加passcode属性
    print(data)
    try:
        response = requests.post(
            "http://test1.91taogu.com/stock/account", json={"data": data, "passcode": "995560"}, timeout=5)
        if response.status_code != 200:
            print("请求失败，状态码:", response.status_code)
            return
        else:
            print("请求test1成功:", response.status_code)
            response.encoding = 'utf-8'
            html_content = response.text
            print(html_content)

    except Exception as e:
        print("请求失败:", str(e))

# 资金账号状态变化主推 account_callback()


def account_callback(ContextInfo, accountInfo):
    info('account_callback:')  # m_strStatus 为资金账号的属性之一，表示资金账号的状态
    printObj(accountInfo)

    # updateAccount(ContextInfo)

    # 账号任务状态变化主推


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
    printObj(data)

# 账号成交状态变化主推


def order_callback(ContextInfo, data):
    info('order_callback')
    printObj(data)

# 账号持仓状态变化主推


def deal_callback(ContextInfo, data):
    info('deal_callback')
    printObj(data)


def position_callback(ContextInfo, data):
    info('position_callback')
    printObj(data)


def orderError_callback(ContextInfo, orderArgs, errMsg):
    error('orderError_callback')
    error(errMsg)
    printObj(orderArgs)


def stop(ContextInfo):
    error('stop')
