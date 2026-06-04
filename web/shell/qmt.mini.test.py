import os
import shutil
import random
import threading
import time
from xtquant import xtdata
from xtquant.xttrader import XtQuantTrader, XtQuantTraderCallback
from xtquant.xttype import StockAccount
from xtquant import xtconstant

import sys
import traceback

class MyXtQuantTraderCallback(XtQuantTraderCallback):
    def on_disconnected(self):
        """
        连接状态回调
        :return:
        """
        print("connection lost callback")

    def on_account_status(self, status):
        """
        账号状态信息推送
        :param response: XtAccountStatus 对象
        :return:
        """
        print("on_account_status callback")
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

    def on_stock_trade(self, trade):
        """
        成交信息推送
        :param trade: XtTrade对象
        :return: 17571235 01009714 0102000023061100
        """
        print("on_stock_trade callback:")

    # print(trade.account_id, trade.stock_code, trade.order_id)

    def on_order_print(self, order_error):
        """
        下单失败信息推送
        :param order_error:XtOrderError 对象
        :return:
        """
        print("on order_error callback")
        print(order_error.order_id, order_error.error_id, order_error.error_msg)

    def on_stock_position(self, position):
        """
        持仓信息推送  注意，该回调函数目前不生效
        :param position: XtPosition对象
        :return:
        """
        print("on position callback")
        print(position.stock_code, position.volume)

    def on_cancel_print(self, cancel_error):
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
        print("on_order_stock_async_response callback")
        print(response.account_id, response.order_id, response.seq)

    def on_smt_appointment_async_response(self, response):
        """
        :param response: XtAppointmentResponse 对象
        :return:
        """
        print("on_smt_appointment_async_response callback")
        print(
            response.account_id,
            response.order_sysid,
            response.error_id,
            response.error_msg,
            response.seq,
        )


if __name__ == "__main__":
    # Mini-QMT的userdata_mini路径
    # path = r'D:\国金证券QMT交易端\userdata_mini'
    path = r'D:\huaxinQMT\userdata_mini'
    account = "50900001667601"
    broker = "华鑫"
    print("path:", path)
    print("account:", account)
    print("broker:", broker)
    time.sleep(2)
    # 生成session id 整数类型 同时运行的策略不能重复
    stockAccount = StockAccount(account)
    stockAccountHgt = StockAccount(account, "HUGANGTONG")

    xt_trader = XtQuantTrader(path, 1)
    callback = MyXtQuantTraderCallback()
    xt_trader.register_callback(callback)
    # 启动本地客户端
    print("start xt_trader")
    xt_trader.start()

    print("connect xt_trader")
    # 建立交易连接，返回0表示连接成功
    try:
        connect_result = xt_trader.connect()
        if connect_result != 0:
            print("连接失败")
            xt_trader.stop()
            sys.exit(1)
        else:
            print("连接成功")
    except Exception as e:
        print(f"connect error: {e}")
        xt_trader.stop()
        sys.exit(1)

    # 阻塞主线程退出
    while 1==1:
        if g.exit == 1:
            break
        time.sleep(1)
