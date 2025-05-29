import time
from xtquant import xtdata
from xtquant.xttrader import XtQuantTrader, XtQuantTraderCallback
from xtquant.xttype import StockAccount
import datetime
import json
import inspect
import pandas as pd
import numpy as np
import requests
import sys


class G():
    pass


g = G()


g.account = "620000558442"  # 国信
g.account = "8883949249"  # 国金
g.session_id = 1001

g.tick = {}
g.uploading = 0
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
        print(object_to_json(asset))
        print(asset.account_id, asset.cash, asset.total_asset)

    def on_stock_order(self, order):
        """
        委托信息推送
        :param order: XtOrder对象
        :return:
        """
        print("on order callback:")
        print(object_to_json(order))
        print(order.stock_code, order.order_status, order.order_sysid)

    def on_stock_trade(self, trade):
        """
        成交信息推送
        :param trade: XtTrade对象
        :return:
        """

        print("on_stock_trade:")
        print(object_to_json(trade))
        # print(trade.account_id, trade.stock_code, trade.order_id)

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
        print(response.account_id, response.order_sysid,
              response.error_id, response.error_msg, response.seq)


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


def uploadStockPrice():
    # 组装成json对象post到test1.91taogu.com
    # 为data添加passcode属性
    sb, g.tick = g.tick, {}  # 这行是原子的
    if (len(list(sb)) < 1):
        print("0 stocks, skip upload")
        return
    print("上传", len(list(sb)), "个股票价格")
    print(sb.keys())
    try:
        response = requests.post("http://test1.91taogu.com/stock/quotes.mini", json={
            "data": sb, "passcode": "995560"}, timeout=5)
        if response.status_code != 200:
            print("请求失败，状态码:", response.status_code)
            return
        else:
            response.encoding = 'utf-8'
            print("请求test1成功:", response.status_code, response.text)
    except Exception as e:
        print("请求失败:", str(e))


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
            print("上传持仓失败，状态码:", response.status_code)
            return
        else:
            response.encoding = 'utf-8'
            print("上传持仓到test1成功:", response.status_code, response.text)
    except Exception as e:
        print("请求失败:", str(e))


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
    print(result)

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
        print(data)
    else:
        for field in dirs:
            if not field.startswith("_"):  # 过滤掉Python内置属性
                try:
                    value = getattr(data, field)
                    # child = printObj(value, indent+"  ")
                    print(f"{indent}{field}:{value}\n")
                except Exception as e:
                    print(f"{field}: (无法获取值):{e}")


if __name__ == '__main__':
    # Mini-QMT的userdata_mini路径
    path = r'D:\国金证券QMT交易端\userdata_mini'
    # 生成session id 整数类型 同时运行的策略不能重复
    stockAccount = StockAccount(g.account)
    xt_trader = XtQuantTrader(path, g.session_id)
    callback = MyXtQuantTraderCallback()
    xt_trader.register_callback(callback)
    # 启动本地客户端
    xt_trader.start()

    # 建立交易连接，返回0表示连接成功
    connect_result = xt_trader.connect()
    if connect_result != 0:
        print("连接失败")
        xt_trader.stop()
        sys.exit(1)
    else:
        print("连接成功")

    subscribe_result = xt_trader.subscribe(stockAccount)
    if subscribe_result == 0:
        print("订阅成功")
    else:
        print("订阅失败")
        xt_trader.stop()
        sys.exit(1)

    sector_list = xtdata.get_sector_list()
    print(sector_list)

    # stock_list = xtdata.get_stock_list_in_sector('上证A股')
    # print(stock_list)

    xt_asset = xt_trader.query_stock_asset(stockAccount)

    print('账号类型', xt_asset.account_type)
    print('资金账号', xt_asset.account_id)
    print('可用金额', xt_asset.cash)
    print('冻结金额', xt_asset.frozen_cash)
    print('持仓市值', xt_asset.market_value)
    print('总资产', xt_asset.total_asset)

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

    # while True:
    #     g.tick = xtdata.get_full_tick(g.stocklist)
    #     uploadStockPrice()

    while True:
        uploadStockPrice()
        time.sleep(0.5)

    # 阻塞主线程退出
    # xt_trader.run_forever()
