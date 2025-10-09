const Binance = require('node-binance-api');
const binance = new Binance({
  APIKEY: 'doHZ0MQbQguh9Rx3HRyDty2oZJY3zgWj8SmPWqHzD60AIHLQNc764CRebrHXBBji',
  APISECRET: 'kxHDxpT4w74tPD5L5xRYbylB7SHvo5zzXWs5BaxEmWOF1EFdOCESvBQigdQeGcrL',
  //verbose: true,
  //test: true, // if you want to use the sandbox/testnet
});

binance.socksProxy = 'socks://192.168.66.1:10800/';

async function test() {
  let ticker = await binance.prices("BNBUSDT");
  console.info(`Price of BNB: ${ticker.BNBUSDT}`);

  let response;
  // let response = await binance.balance();
  // console.info(response);

  response=await binance.bookTickers('ALPHA_368');
  console.info("bookTickers", response);
}

test();



