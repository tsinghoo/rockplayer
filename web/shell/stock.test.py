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

uploadPrice = 0

g.actions = {}

stocks = {}
# 初始化函数 - 策略运行开始时调用一次


def init(ContextInfo):
    print(sys.version)
    print(sys.executable)


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


def getActions(ContextInfo):
    try:
        response = requests.get(
            "http://test1.91taogu.com/stock/rule/actions?broker="+broker, timeout=5)
        if response.status_code != 200:
            print("getActions失败，状态码:", response.status_code)
            return
        else:
            response.encoding = 'utf-8'
            content = response.text
            print("getActions成功:", response.status_code, content)
            jso = json.loads(content)
            for act in jso["data"]:
                if act["scode"] in g.actions:
                    print("已存在", act["scode"], "的action")
                else:
                    if act["action"] == "buy":
                        print("买入", act["sname"], act["scode"],
                              act["price"], act["amount"])
                        
                        order_lots(act["scode"], 1, 'fix', act["price"], ContextInfo, account)


                        # passorder(23, 1101, account, act["scode"], 11, act["price"],
                        #           act["amount"], 2, ContextInfo)

                        print("已买入", act["sname"], act["scode"],
                              act["price"], act["amount"])

                    elif act["action"] == "sell":
                        print("卖出", act["sname"], act["scode"],
                              act["price"], act["amount"])
                        # passorder(24, 1101, account, act["scode"], 11, act["price"],
                        #           act["amount"], ContextInfo)

                    g.actions[act["scode"]] = act
    except Exception as e:
        print("getActions出错:", traceback.format_exc())


def after_init(ContextInfo):
    print('系统会在init函数执行完后和执行handlebar之前调用after_init')
    stocklist = ContextInfo.get_universe()
    # print("订阅", len(stocklist), "个股票中")
    # for stock_code in stocklist:
    #     ContextInfo.subscribe_quote(
    #         stock_code, "tick", "none", '', quote_callback(stock_code))

    # subs = ContextInfo.get_all_subscription()
    # # 打印subs有多少个股票

    # print("已订阅", len(subs), "个股票")
    


    '''
    df = ContextInfo.get_market_data_ex(['open', 'high', 'low', 'askPrice', 'bidPrice'], stock_code=ContextInfo.get_universe(
    ), period='follow', start_time='', end_time='', count=-1, dividend_type='follow', fill_data=True, subscribe=True)

    print(df)
    '''


def handlebar(ContextInfo):
    # print(ContextInfo.period)
    print("handlebar ", ContextInfo.barpos)
    # print(ContextInfo.is_suspended_stock("600004.SH"))
    # getTradeDetail(ContextInfo)
    pass
