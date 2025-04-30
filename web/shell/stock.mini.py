import time
from xtquant import xtdata
from xtquant.xttrader import XtQuantTrader, XtQuantTraderCallback
from xtquant.xttype import StockAccount
import datetime
import json
import pandas as pd
import numpy as np
import requests
import sys

class G(): pass

g = G()


g.account = "620000558442"  #国信
g.account = "8883949249"  #国金


g.stocks = {}
g.stocklist = ['000300.SH', '000004.SZ']

class MyXtQuantTraderCallback(XtQuantTraderCallback):
    def on_disconnected(self):
        """
        连接状态回调
        :return:
        """
        print("connection lost")
    def on_account_status(self, status):
        """
        账号状态信息推送
        :param response: XtAccountStatus 对象
        :return:
        """
        print("on_account_status")
        print(status.account_id, status.account_type, status.status)
    def on_stock_asset(self, asset):
        """
        资金信息推送  注意，该回调函数目前不生效
        :param asset: XtAsset对象
        :return:
        """
        print("on asset callback")
        print(asset.account_id, asset.cash, asset.total_asset)
    def on_stock_order(self, order):
        """
        委托信息推送
        :param order: XtOrder对象
        :return:
        """
        print("on order callback:")
        print(order.stock_code, order.order_status, order.order_sysid)
    def on_stock_trade(self, trade):
        """
        成交信息推送
        :param trade: XtTrade对象
        :return:
        """
        print("on trade callback")
        print(trade.account_id, trade.stock_code, trade.order_id)
    def on_stock_position(self, position):
        """
        持仓信息推送  注意，该回调函数目前不生效
        :param position: XtPosition对象
        :return:
        """
        print("on position callback")
        print(position.stock_code, position.volume)
    def on_order_error(self, order_error):
        """
        下单失败信息推送
        :param order_error:XtOrderError 对象
        :return:
        """
        print("on order_error callback")
        print(order_error.order_id, order_error.error_id, order_error.error_msg)
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
        print("on_order_stock_async_response")
        print(response.account_id, response.order_id, response.seq)
    def on_smt_appointment_async_response(self, response):
        """
        :param response: XtAppointmentResponse 对象
        :return:
        """
        print("on_smt_appointment_async_response")
        print(response.account_id, response.order_sysid, response.error_id, response.error_msg, response.seq)


def init():
    print(sys.version)
    print(sys.executable)
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


def uploadStockPrice(ContextInfo):
    # 组装成json对象post到test1.91taogu.com
    # 为data添加passcode属性
    global stocks
    sb, stocks = stocks, {}  # 这行是原子的
    print("上传", len(list(sb)), "个股票价格")
    try:
        response = requests.post("http://test1.91taogu.com/stock/quotes", json={
            "data": sb, "passcode": "995560"}, timeout=5)
        if response.status_code != 200:
            print("请求失败，状态码:", response.status_code)
            return
        else:
            response.encoding = 'utf-8'
            print("请求test1成功:", response.status_code, response.text)
    except Exception as e:
        print("请求失败:", str(e))


if __name__ == '__main__':
    # Mini-QMT的userdata_mini路径
    path = r'D:\国金证券QMT交易端\userdata_mini'
    # 生成session id 整数类型 同时运行的策略不能重复
    session_id = int(time.time())
    xt_trader = XtQuantTrader(path, session_id)
    callback = MyXtQuantTraderCallback()
    xt_trader.register_callback(callback)
    # 启动本地客户端
    xt_trader.start()

    # 建立交易连接，返回0表示连接成功
    connect_result = xt_trader.connect()
    print('建立交易连接，返回0表示连接成功：', connect_result)

    sector_list = xtdata.get_sector_list()
    print(sector_list)

    # stock_list = xtdata.get_stock_list_in_sector('上证A股')
    # print(stock_list)

    stock_account = StockAccount(g.account)
    xt_asset = xt_trader.query_stock_asset(stock_account)

    print('账号类型', xt_asset.account_type)
    print('资金账号', xt_asset.account_id)
    print('可用金额', xt_asset.cash)
    print('冻结金额', xt_asset.frozen_cash)
    print('持仓市值', xt_asset.market_value)
    print('总资产', xt_asset.total_asset)
    
    init()

    # 阻塞主线程退出
    xt_trader.run_forever()