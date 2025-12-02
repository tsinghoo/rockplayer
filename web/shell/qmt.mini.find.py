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

g.session_id = 1002

g.tick = {}
g.actions = {}
g.reloadK1d = []
g.uploading = 0
g.stocklist = ['000300.SH', '000004.SZ']

g.baseUrl = "http://192.168.66.205:3001"
g.baseUrl = "http://test1.91taogu.com"

g.log = {
    "level": 4,
    "none": 0,
    "error": 1,
    "warning": 2,
    "info": 3,
    "debug": 4,
}
g.candidates = []

g.log["level"] = g.log["debug"]

g.toPrint = []

g.start_date = "20230101"  # 回测开始日期
g.end_date = "20251231"   # 回测结束日期
g.stocklist = []         # 股票池
g.hold_period = 5         # 持有周期(天)

# 设置回测参数
g.position_ratio = 0.2    # 单只股票仓位比例
g.low_percentile = 0.3    # 定义低位的百分位(30%分位数以下)
g.min_price = 0           # 最低股价限制(元)
g.max_price = 3000         # 最高股价限制(元)


today = datetime.datetime.now().date()
threadLocal = threading.local()


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
    info(sys.version)
    info(sys.executable)
    loadConfig()


def resetThreadId(label=""):
    threadLocal.id = label + datetime.datetime.now().strftime("%H%M%S") + \
        str(random.randint(0, 1000))


def CCI(table):
    table["cci"] = None
    for i in range(13, len(table)):
        high = table["high"].values[i-13:i+1]
        low = table["low"].values[i-13:i+1]
        close = table["close"].values[i-13:i+1]
        tp = (high + low + close) / 3
        sma = tp.mean()
        mad = np.abs(tp - sma).mean()
        table["cci"].values[i] = (tp[-1] - sma) / (0.015 * mad)
        # 将cci的值保留小数点后2位
        table["cci"].values[i] = round(table["cci"].values[i], 2)

def get1dLastDate(scode):
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
    info("get1dData", stocklist, index, startTime, endTime)
    if (startTime is None):
        startTime = datetime.datetime.now().strftime("%Y%m%d")

    if (endTime is None):
        endTime = ""

    scode = stocklist[index]
    period = '1d'
    params = ['open', 'close', 'high', 'low', 'volume', 'amount']
    info('downloading', period, 'from', startTime, "for", scode)
    xtdata.download_history_data(scode, period, startTime, endTime)
    # download_history_data2 批量版本 todo
    # params = []
    info('get', period, 'from', startTime, 'to', endTime,
         'for', scode, "(", index, "/", len(stocklist), ")")
    df = xtdata.get_market_data_ex(params, stock_list=[scode], period=period,
                                   start_time=startTime, end_time=endTime, count=-1, dividend_type='none', fill_data=True)
    table = df[scode]
    info("get1dData done")
    # 计算cci
    CCI(table)

    return table

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
                # 把dateStartTime设置为30天前
                dataStartTime = (datetime.datetime.strptime(
                    lastDate, "%Y%m%d") - datetime.timedelta(days=30)).strftime("%Y%m%d")
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

        # 将datas的数据分批上传，每批100条
        bsize = 50
        for i in range(0, len(datas), bsize):
            batch = datas.iloc[i:i+bsize]
            info("上传", scode, period,
                 "[", i, ",", i+bsize, "]", len(batch))
            batch_data = []
            for idx, row in batch.iterrows():
                # info(row)
                if (row["cci"] is not None):
                    batch_data.append([str(idx)] + [row["open"], row["close"], row["high"],
                                                    row["low"], row["volume"], row["amount"], row["cci"]])
            body = {"data": obj2Json(
                batch_data), "scode": scode, "period": period, "passcode": "995560"}
            debug("body:", body)
            # 上传数据到test1
            try:
                response = requests.post(
                    g.baseUrl+"/stock/k/upload", json=body, verify=False, timeout=20)
                if response.status_code != 200:
                    error("上传失败，状态码:", response.status_code,
                          "响应内容:", response.text)
            except Exception as e:
                error("上传失败:", str(e))

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


def log2File(toPrint, file, sep=' ', end='\n', flush=True, mode='a', encoding='utf-8'):
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
        log2File(toPrint, g.logPathPrefix + "\\qmt.mini.find.log")
        while len(toPrint) > 0:
            item = toPrint.pop(0)
            print(*item[0], **item[1])

        time.sleep(0.1)


def listStock(sector):
    stocks = xtdata.get_stock_list_in_sector(sector)
    sname = getStockName(stocks[0])
    info("stock: ", stocks[0], sname)
    return stocks
    # 将datas的数据分批上传，每批100条
    bsize = 200
    for i in range(0, len(stocks), bsize):
        batch = stocks.iloc[i:i+bsize]
        info("uploading stocks in", sector,
             "[", i, ",", i+bsize, "]", len(batch))
        info(obj2JsonString(batch[0], indent=None))

        break

        body = {"sector": sector, "data": batch}
        try:
            response = requests.post(
                g.baseUrl+"/stock/basic/update", json=body, timeout=20)
            if response.status_code != 200:
                error("上传失败，状态码:", response.status_code,
                      "响应内容:", response.text)
        except Exception as e:
            error("上传失败:", str(e))


def getStockName(scode):
    si = xtdata.get_instrument_detail(scode)
    sname = si["InstrumentName"]
    return sname


def getIncreaseDays(prices, rangeStart, rangeEnd, minRate, maxRate):
    count = 0
    days = rangeEnd-rangeStart
    if len(prices) < days:
        return 0

    for i in range(rangeEnd, rangeStart, -1):
        if prices[i] > prices[i-1] * (1+minRate):
            if prices[i] < prices[i-1] * (1+maxRate):
                count += 1

    return count


def findStock(sector):
    # 获取全市场股票列表
    info("findStock", sector)
    g.stocklist = xtdata.get_stock_list_in_sector(sector)

    info("stocklist:", g.stocklist)
    period = '1d'
    # 订阅行情数据
    xtdata.subscribe_whole_quote(g.stocklist)

    current_date = datetime.datetime.now().strftime("%Y%m%d")

    # 找出低位且连续三天上涨的股票
    candidate = []
    # dataStartTime设置为70天前
    startDays = 60
    dataStartTime = (datetime.datetime.now() -
                     datetime.timedelta(days=(startDays*3))).strftime("%Y%m%d")
    dataEndTime = current_date
    params = ['open', 'close', 'high', 'low', 'volume', 'amount']
    for index, scode in enumerate(g.stocklist):
        try:
            sname = getStockName(scode)
            if sname.startswith(('ST', '*ST', '退')):
                continue

            xtdata.download_history_data(
                scode, period, dataStartTime, dataEndTime)
            # download_history_data2 批量版本 todo

            info('get', startDays, period, 'for', scode, 'from',
                 '', 'to', current_date, "(", index, "/", len(g.stocklist), ")", sector)
            df = xtdata.get_market_data_ex(params, stock_list=[scode], period=period,
                                           start_time="", end_time=current_date, count=startDays, dividend_type='none', fill_data=True)
            prices = df[scode]
            CCI(prices)
            # debug("prices:", prices)
            if prices is None or len(prices['high']) < 3:
                continue

            
                
            high_prices = prices['high']
            low_prices = prices['low']
            close_prices = prices['close']
            current_price = high_prices[-1]

            # 检查股价是否在合理范围内
            if current_price < g.min_price or current_price > g.max_price:
                info("bad price:", current_price)
                continue

            # 计算历史分位数判断是否低位
            # hist_percentile = sum(
            #     1 for price in close_prices if price < current_price) / len(close_prices)

            # info(hist_percentile, "in", len(close_prices), "close_prices")
            # if hist_percentile > g.low_percentile:
            #     info("bad")
            #     continue

            dayStart = -4
            dayEnd = -1
            count = getIncreaseDays(high_prices, dayStart, dayEnd, 0, 1)
            info(" high price increase:", count)
            if (count < (dayEnd-dayStart)):
                continue

            count = getIncreaseDays(close_prices, dayStart, dayEnd, 0, 1)
            info(" close price increase:", count)
            if (count < (dayEnd-dayStart)):
                continue

            # #计算high_prices中最近30天的最大值
            # days=30
            # if (len(high_prices) < days):
            #     days=len(high_prices)
            # maxPrice = max(high_prices[-1*days:])
            # minPrice = min(high_prices[-1*days:])
            # if ((high_prices[-1]-minPrice) > (maxPrice-minPrice) * 0.3):
            #     continue

            # 最近30天较大涨幅天数
            dayStart = -30
            dayEnd = -1
            count = getIncreaseDays(close_prices, dayStart, dayEnd, 0.07, 1)
            info(" close price increase:", count)
            if (count < (3)):
                continue
            
            # 最近60天较大跌幅天数
            dayStart = -60
            dayEnd = -1
            count = getIncreaseDays(close_prices, dayStart, dayEnd, -1, -0.07)
            info(" close price decrease:", count)
            if (count > 0):
                continue

            info("OK")
            candidate.append([scode, sname])

        except Exception as e:
            error_msg = traceback.format_exc()
            error(f"处理股票{scode}时出错: {error_msg}")
            continue

    return candidate


def uploadCandidates(stocks):
    bsize = 200
    for i in range(0, len(stocks), bsize):
        batch = stocks[i:i + bsize]
        info("uploading candidates", "[", i, ",", i+bsize, "]", len(batch))

        doUploadCandidates(batch)


def doUploadCandidates(batch):
    body = {"data": batch}
    try:
        response = requests.post(
            g.baseUrl+"/stock/candidates", json=body, timeout=20)
        if response.status_code != 200:
            error("上传失败，状态码:", response.status_code,  "响应内容:", response.text)
    except Exception as e:
        error("上传失败:", str(e))


if __name__ == '__main__':
    # Mini-QMT的userdata_mini路径
    # path = r'D:\国金证券QMT交易端\userdata_mini'
    path = os.getenv("qmtpath")
    # 获取环境变量proxy的值
    proxy = os.getenv("proxy")
    if proxy:
        g.baseUrl = proxy
    else:
        g.baseUrl = "http://test1.91taogu.com"

    configPathPrefix = os.getenv("configPathPrefix")

    if configPathPrefix:
        g.configFile = configPathPrefix + r"\qmt.config.json"
    else:
        g.configFile = r"d:\qmt.config.json"

    logPathPrefix = os.getenv("logPathPrefix")
    if logPathPrefix:
        g.logPathPrefix = logPathPrefix
    else:
        g.logPathPrefix = r"d:"

    print("configPathPrefix:", configPathPrefix)
    print("configFile:", g.configFile)
    print("logPathPrefix:", logPathPrefix)
    # print("1.http://test1.91taogu.com")
    # print("2.http://192.168.66.205:3001")
    # print("q.退出")
    # ui = input("请选择:")

    print("baseUrl:", g.baseUrl)

    # 等待用户输入，如果用户输入q，则退出,否则继续
    print("1.搜索股票")
    print("2.更新所有股票代码")
    print("3.获取所有板块信息")
    print("q.退出")
    ui = input("请选择:")

    # 生成session id 整数类型 同时运行的策略不能重复
    stockAccount = StockAccount(g.account)
    stockAccountHgt = StockAccount(g.account, "HUGANGTONG")
    xt_trader = XtQuantTrader(path, g.session_id)
    # 启动本地客户端
    xt_trader.start()

    t3 = Thread(target=printTask)
    t3.start()

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

    init()

    sector_list = ['上期所', '上证A股', '上证B股', '上证期权', '上证转债', '中金所', '创业板', '大商所', '沪市ETF', '沪市债券', '沪市基金', '沪市指数', '沪深A股', '沪深B股', '沪深ETF', '沪深债券', '沪深基金',
                   '沪深指数', '沪深转债', '深市ETF', '深市债券', '深市基金', '深市指数', '深证A股', '深证B股', '深证期权', '深证转债', '科创板', '科创板CDR', '能源中心', '连续合约', '郑商所', '香港联交所指数', '香港联交所股票']
    sector_list = ['上证A股', '上证B股', '创业板', '沪深A股', '沪深B股',
                   '沪深ETF', '深市ETF', '深证A股', '深证B股', '科创板', '香港联交所股票']
    sector_list = ['创业板', '沪深A股', '沪深B股', '沪深ETF', '科创板', '香港联交所股票']

    time.sleep(5)

    if ui == "2":
        # 对于每个sector,查询成分股
        g.stocks = []
        for sector in sector_list:
            stocks = listStock(sector)
            # info("stocks in:", sector, ":\n", stocks)
            # 将stocks加入全局变量g.stocks
            g.stocks = g.stocks + stocks
    if ui == "1":
        # 先清空所有候选
        doUploadCandidates([])
        # 对于每个sector,调用findStock
        for sector in sector_list:
            candidates = findStock(sector)
            # 将candidates分批上传到test1
            uploadCandidates(candidates)
            update1d([c[0] for c in candidates])

        info("all candidates\n", g.candidates)
    if ui == "3":
        info("下载sector_data")
        xtdata.download_sector_data()
        sector_list = xtdata.get_sector_list()
        info("sector_list:", sector_list)
    if ui == "q":
        sys.exit(1)

    # 阻塞主线程退出
    # xt_trader.run_forever()
