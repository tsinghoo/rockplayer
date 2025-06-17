
# http://localhost:3001/stock/quotes.mini 09926.HK 75.881

url=http://test1.91taogu.com/stock/quotes.mini
url=http://localhost:3001/stock/quotes.mini
code=09926.HK

pause(){
  read -p "Press any key to continue..."
}

post(){
  set -x

  price=$1
  data=$(
    cat <<END
{"data":{"$code": {"time": 1747367672000,"lastPrice": 83,"open": 81.3,"high": 83.2,"low": 81.3,"lastClose": 81.3,"amount": 199763700,"volume": 2423608,"pvolume": 2423608,"stockStatus": 3,"openInt": 13,"transactionNum": 0,"lastSettlementPrice": 81.3,"settlementPrice": 0,"pe": 0,"askPrice": [ $price, 0, 0, 0, 0 ],"bidPrice": [ $price, 0, 0, 0, 0 ],"askVol": [ 2000, 0, 0, 0, 0 ],"bidVol": [ 2000, 0, 0, 0, 0 ],"volRatio": 0,"speed1Min": 0,"speed5Min": 0 }},"passcode":"995560"}  
END
  ) 
  
  curl -X POST -H "Content-Type: application/json" -d "$data" $url

  set +x

  pause
}

  url=http://test1.91taogu.com/stock/rule/action/ordered
  url=http://localhost:3001/stock/deal/update
  data=$(
    cat <<END
{
  "tprice": 174.06,
  "scode": "688012",
  "sname": "\u4e2d\u5fae\u516c\u53f8",
  "market": "\u4e0a\u8bc1\u6240",
  "operationDirection": "\u9650\u4ef7\u5356\u51fa",
  "operationName": "\u56fd\u4fe1",
  "tday": "20250617",
  "ttime": "101514",
  "tid": "891704867",
  "tcash": 21061.26,
  "tamount": -79,
  "tpair": ""
}
END
  ) 
  
  curl -X POST -H "Content-Type: application/json" -d "$data" $url

exit 0

post 76.5
post 76.4
post 77
post 76.4
post 76
post 75
post 75.5
post 75.7
post 75.78
post 75.77
post 75.785




