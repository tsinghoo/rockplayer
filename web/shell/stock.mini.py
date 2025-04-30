import time
from xtquant import xtdata
from xtquant.xttrader import XtQuantTrader
from xtquant.xttype import StockAccount
if __name__ == '__main__':
    # Mini-QMT的userdata_mini路径
    path = r'D:\国金证券QMT交易端\userdata_mini'
    # 生成session id 整数类型 同时运行的策略不能重复
    session_id = int(time.time())
    xt_trader = XtQuantTrader(path, session_id)

    # 启动本地客户端
    xt_trader.start()

    # 建立交易连接，返回0表示连接成功
    connect_result = xt_trader.connect()
    print('建立交易连接，返回0表示连接成功：', connect_result)

    sector_list = xtdata.get_sector_list()
    print(sector_list)

    stock_list = xtdata.get_stock_list_in_sector('上证A股')
    print(stock_list)

    stock_account = StockAccount('8883949249')
    xt_asset = xt_trader.query_stock_asset(stock_account)

    print('账号类型', xt_asset.account_type)
    print('资金账号', xt_asset.account_id)
    print('可用金额', xt_asset.cash)
    print('冻结金额', xt_asset.frozen_cash)
    print('持仓市值', xt_asset.market_value)
    print('总资产', xt_asset.total_asset)

    # 阻塞主线程退出
    xt_trader.run_forever()