
#pip install akshare -i https://pypi.tuna.tsinghua.edu.cn/simple

import akshare as ak
import pandas as pd

def get_zh_stock_data(code,start_date,end_date):
  df = ak.stock_zh_a_spot()
  print(df)
  return df

#获取指定代码的股票历史数据
def get_zh_stock_hist(code,start_date,end_date):
  df = ak.stock_zh_a_hist(symbol=code, period="daily", start_date=start_date, end_date=end_date, adjust="qfq")
  print(df)
  return df


get_zh_stock_data()
