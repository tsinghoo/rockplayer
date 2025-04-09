# encoding:gbk
'''
本策略事先设定好交易的股票篮子，然后根据指数的CCI指标来判断超买和超卖
当有超买和超卖发生时，交易事先设定好的股票篮子
'''
import datetime
import json
import pandas as pd
import numpy as np
import talib
import requests
import sys


account = "620000558442"
# 初始化函数 - 策略运行开始时调用一次


def init(ContextInfo):
    print(sys.version)
    print(sys.executable)
    # 设置全局变量
    stocklist = ['000300.SH', '000004.SZ']
    ContextInfo.set_universe(stocklist)
    ContextInfo.account = "620000558442"
    ContextInfo.set_account(ContextInfo.account)              # 交易账户
    ContextInfo.last_print_time = 0       # 上次打印时间
    #ContextInfo.run_time("updateAccount", "2nSecond", "2025-04-09 13:20:00")
    updateAccount()
    try:
        response = requests.get(
            "http://test1.91taogu.com/video/stock.html", timeout=5)
        if response.status_code != 200:
            print("请求失败，状态码:", response.status_code)
            return
        else:
            print("请求test1成功:", response.status_code)
            response.encoding = 'utf-8'
            html_content = response.text
            # print(html_content)

    except Exception as e:
        print("请求失败:", str(e))


def after_init(ContextInfo):
    print('系统会在init函数执行完后和执行handlebar之前调用after_init')


# 资金账号状态变化主推 account_callback()
def account_callback(ContextInfo, accountInfo):
    print('accountInfo')
    print(accountInfo.m_strStatus)  # m_strStatus 为资金账号的属性之一，表示资金账号的状态

    # 打印持仓信息
    positions = get_positions(ContextInfo.account)
    print("\n当前持仓:")
    if len(positions) > 0:
        for pos in positions:
            print(f"{pos['stockcode']}: {pos['volume']}股 @ {pos['costprice']}")
    else:
        print("无持仓")

# 账号任务状态变化主推


def task_callback(ContextInfo, taskInfo):
    print('taskInfo')
# 账号委托状态变化主推


def order_callback(ContextInfo, orderInfo):
    print('orderInfo')

# 账号成交状态变化主推


def deal_callback(ContextInfo, dealInfo):
    print('dealInfo')

# 账号持仓状态变化主推


def position_callback(ContextInfo, positonInfo):
    print('positonInfo')


# 行情处理函数 - 每次行情更新时调用
def handlebar(ContextInfo):
    print(ContextInfo.period)
    print(ContextInfo.barpos)
    print(ContextInfo.is_suspended_stock("600004.SH"))

    pass


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

    print(data)
    try:
        response = requests.post(
            "http://test1.91taogu.com/stock/account", json=data, timeout=5)
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


def stop(ContextInfo):
    print('strategy is stop !')
