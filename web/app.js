const express = require('express');
const fs = require('fs');
const path = require('path');
const mime = require('mime');
const fileUpload = require('express-fileupload');
const app = express();
//引入sqlite库
const sqlite3 = require('sqlite3').verbose();
const { spawn, exec } = require('child_process');
let response = [];
let splitting = 0;

app.use(express.json());
app.use(express.static('public'));
let directoryPath = '/Users/tsinghoo/git/rockplayer/web'; // 替换为你想要列出文件的目录路径
const args = process.argv;
let DEBUG = 2;
let INFO = 3;
let ERROR = 4;
let logLevel = 2;
info(args.length);
const pwd = "995560";
if (args.length < 4) {
    info("node app.js 3000 /your/directory");
    return;
}
app.use(fileUpload({
    createParentPath: true
}));
const port = parseInt(args[2]);
directoryPath = args[3];
info(directoryPath);
let suffix = [];
if (args.length > 4) {
    suffix = args[4].split(";");
}
info(args[4]);
info(suffix.join(" "));


info("open stock.db");
const dbFilePath = path.join(directoryPath, "stock.db");
let db = new sqlite3.Database(dbFilePath);

db.runSync = (sql, params) => {
    info("runSync:" + sql);
    info(JSON.stringify(params));
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) {
                error(err);
                resolve({ error: err });
            } else {
                resolve({});
            }
        });
    })
}

db.allSync = (sql, params) => {
    return new Promise((resolve, reject) => {
        info("allSync:" + sql);
        info("params:" + JSON.stringify(params));
        db.all(sql, params, function (err, rows) {
            if (err) {
                error(err);
                resolve({ error: err });
            } else {
                resolve({ rows: rows });
            }
        });
    });
}

db.getSync = db.getSync || function (sql, params) {
    info("getSync:" + sql);
    info(JSON.stringify(params));
    return new Promise((resolve, reject) => {
        db.get(sql, params, function (err, row) {
            if (err != null) {
                error(err);
                resolve({ error: err });
                //return;
            } else {
                resolve(row);
            }
        });
    });
};

function isVideo(file) {
    if (suffix.length > 0) {
        for (var i = 0; i < suffix.length; ++i) {
            if (file.endsWith(suffix[i])) {
                return true;
            }
        }
    }

    return false;
}

function info(msg) {
    if (logLevel > INFO) {
        return;
    }
    let time = timeFormat(new Date(), "yyyy-MM-dd hh:mm:ss");
    console.log(time + ":" + msg);
}
function debug(msg) {
    if (logLevel > DEBUG) {
        return;
    }

    let time = timeFormat(new Date(), "yyyy-MM-dd hh:mm:ss");
    console.log(time + ":" + msg);
}
function error(msg) {
    if (logLevel > ERROR) {
        return;
    }

    let time = timeFormat(new Date(), "yyyy-MM-dd hh:mm:ss");
    console.log(time + ":" + msg);
}

// 列出目录下的所有文件
function listFiles() {
    const files = fs.readdirSync(directoryPath);
    let matchedFiles = files;
    if (suffix.length > 0) {
        matchedFiles = files.filter(file => {
            for (var i = 0; i < suffix.length; ++i) {
                if (file.endsWith(suffix[i])) {
                    return true;
                }
            }

            return false;
        });
    }
    return matchedFiles.map(file => {
        var script = fs.existsSync(path.join(directoryPath, file + ".htm"));
        const stats = fs.statSync(path.join(directoryPath, file));

        return {
            name: file,
            mtime: stats.mtime,
            path: path.join(directoryPath, file),
            script: script
        };
    });
}

function getTags() {
    var file = path.join(directoryPath, "tags");
    let tags = {};
    try {
        var text = fs.readFileSync(file, "utf-8");
        tags = JSON.parse(text);
    } catch (e) {
        info(file + " not exists");
    }

    return tags;
}

// 删除文件
function deleteFiles(prefixs) {
    info("files to delete:" + JSON.stringify(prefixs));
    prefixs.forEach(
        prefix => {
            if (prefix.indexOf("../") >= 0) {
                console.error();
            }
            fs.readdir(directoryPath, (err, files) => {
                if (err) {
                    console.error('Error reading directory:', err);
                    return;
                }

                files.forEach(file => {
                    if (file.startsWith(prefix)) {
                        const filePath = path.join(directoryPath, file);

                        fs.unlink(filePath, err => {
                            if (err) {
                                console.error('Error deleting file:', err);
                            } else {
                                info('File deleted:', filePath);
                            }
                        });
                    }
                });
            });
        }
    )
}

function cleanFileMetadata() {
    var rPath = path.join(directoryPath, "metadata");
    var data = {};
    try {
        data = JSON.parse(fs.readFileSync(rPath, "utf-8"));
    } catch (e) {
        info("error parsing replacers:" + e.message);
    }

    Object.keys(data).forEach(fileName => {
        let fp = path.join(directoryPath, fileName);
        if (!fs.existsSync(fp)) {
            delete data[fileName];
        }
    });

    fs.writeFileSync(rPath, JSON.stringify(data));
}

function toStt(fileName) {
    var todo = path.join(directoryPath, "todo");
    fs.readFile(todo, 'utf8', (err, data) => {
        if (err) {
            console.error(err);
            return;
        }
        var files = data.split("\n");
        var exists = 0;
        for (var i = 0; i < files.length; ++i) {
            if (files[i] == fileName) {
                exists = 1;
                break;
            }
        }

        if (!exists) {
            files.push(fileName);
        }

        fs.writeFile(todo, files.join("\n"), 'utf8', (err) => {
            if (err) {
                console.error(err);
                return;
            }

            info('文件写入成功。');
        });

    });
}

function toSplit(fileName) {
    var toSplit = path.join(directoryPath, "toSplit");
    fs.readFile(toSplit, 'utf8', (err, data) => {
        if (err) {
            console.error(err);
            return;
        }
        var files = data.split("\n");
        var exists = 0;
        for (var i = 0; i < files.length; ++i) {
            if (files[i] == fileName) {
                exists = 1;
                break;
            }
        }

        if (!exists) {
            files.push(fileName);
        }

        fs.writeFile(toSplit, files.join("\n"), 'utf8', (err) => {
            if (err) {
                console.error(err);
                return;
            }

            info('toSplit写入成功。');
        });

    });
}

function extractVideo(inputFilePath, i, startTime, endTime) {
    return new Promise((resolve, reject) => {
        info("extractVideo:" + inputFilePath);
        const outputDir = path.dirname(inputFilePath);
        var pos = inputFilePath.lastIndexOf(".");
        if (pos < 0) {
            response.push("bad file:" + inputFilePath);
            return;
        }

        var fileName = inputFilePath.substring(0, pos);
        var fileExt = inputFilePath.substring(pos + 1, inputFilePath.length);
        const outputFile = `"${fileName}.${add0(i)}.${fileExt}"`;
        const command = `ffmpeg -i "${inputFilePath}" -ss ${startTime} -to ${endTime} -c copy ${outputFile}`;
        response.push("exec:" + command);
        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(error);
                return;
            }
            resolve();
        });
    });
}

function splitVideo(inputFilePath) {
    return new Promise((resolve, reject) => {
        const outputDir = path.dirname(inputFilePath);
        var pos = inputFilePath.lastIndexOf(".");
        if (pos < 0) {
            response.push("bad file:" + inputFilePath);
            return;
        }

        var fileName = inputFilePath.substring(0, pos);
        var fileExt = inputFilePath.substring(pos + 1, inputFilePath.length);

        const outputPattern = `"${fileName}.%02d.${fileExt}"`;
        const command = `ffmpeg -i "${inputFilePath}" -c copy -f segment -segment_time 1800 -reset_timestamps 1 -map 0 ${outputPattern}`;

        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(error);
                return;
            }
            resolve();
        });
    });
}

function add0(str, length) {
    if (length == null) {
        length = 2;
    }
    var len = length - ("" + str).length;
    var zero = "000000";
    if (len > 0) {
        str = zero.substring(0, len) + str;
    }

    return str;
}

let rules = {};

async function reloadRules() {
    //从 tTradeRule 读取所有未关闭的规则
    let ruleList = await db.allSync("select * from tTradeRule where closed = 0");
    for (let i = 0; i < ruleList.rows.length; i++) {
        let rule = ruleList.rows[i];
        await reloadRule(rule);
    }
}


async function reloadRule(r) {
    if (r == null) {
        return;
    }

    info("reloadRule:" + r.scode);
    if (r.closed != 0) {
        delete rules[r.scode];
        return;
    }
    try {
        r.rule = JSON.parse(r.rule);
    } catch (e) {
        info(e.message);
    }

    rules[r.scode] = r;
    r.actions = [];
    //从 truleaction 里读取响应股票的最近一条执行记录
    let ra = await db.getSync(`select * from tRuleAction where scode = '${r.scode}' order by createTime desc limit 1`);
    if (ra) {
        info(JSON.stringify(ra));
        if (ra.done == 0) {
            r.status = "ordered";
        } else if (ra.done == -1) {
            r.status = "cancelled";
        } else {
            if (ra.action == "buy" && r.rule.order == "buyFirst") {
                r.status = "toSell";
            } else if (ra.action == "sell" && r.rule.order == "sellFirst") {
                r.status = "toBuy";
            } else {
                info("rule done");
                r.status = "done";
                await db.runSync(`update tTradeRule set closed=1 where scode = '${r.scode}'`);

                setTimeout(() => {
                    delete rules[r.scode];
                }, 1000 * 3);

            }
        }
        r.actions.push(ra);
    } else {
        if (r.rule.order == "buyFirst") {
            r.status = "toBuy";
        } else if (r.rule.order == "sellFirst") {
            r.status = "toSell";
        } else {
            r.status = "todo";
        }
    }
}

async function tryToSell(r) {
    debug("tryToSell:" + JSON.stringify(r));
    let rule = r.rule;
    let now = Date.now();
    let price = 0;
    if (rule.dip < 0) {
        price = rule.sell;
    } else if (rule.currentPrice >= parseFloat(rule.sell)) {
        debug(`currentPrice > sell`);
        if (rule.maxPrice >= parseFloat(rule.sell)) {
            debug(`maxPrice > sell`);
            let delta = rule.maxPrice - rule.currentPrice;
            debug(`delta=${delta}`);
            if (delta >= parseFloat(rule.dip)) {
                price = rule.currentPrice;
            }
        }
    }
    debug(`price=${price}`);
    if (price > 0) {
        //卖出
        let action = {
            id: `${r.id}-${now}`,
            ruleId: r.id,
            scode: rule.scode,
            sname: rule.sname,
            action: "sell",
            broker: rule.broker,
            price: price,
            amount: rule.sellAmount,
            orderNo: "",
            done: 0,
            createTime: now
        }

        await insertOrReplace("tRuleAction", action);
        r.status = "ordered";

        r.actions.push(action);
        debug(`rules:${JSON.stringify(rules)}`);
        return true;
    }

    return false;
}
async function tryToBuy(r) {
    debug("tryToBuy:" + JSON.stringify(r));
    let rule = r.rule;
    let now = Date.now();
    let buy = 0;
    if (rule.bounce < 0) {
        buy = rule.buy;
    } else if (rule.currentPrice <= parseFloat(rule.buy)) {
        debug(`currentPrice < buy`);
        if (rule.minPrice <= parseFloat(rule.buy)) {
            let delta = rule.currentPrice - rule.minPrice;
            debug(`delta=${delta}`);
            if (delta >= parseFloat(rule.bounce)) {
                //买入
                buy = rule.currentPrice;
            }
        }
    }
    debug(`buy=${buy}`);
    if (buy > 0) {
        let action = {
            id: `${r.id}-${now}`,
            ruleId: r.id,
            scode: rule.scode,
            sname: rule.sname,
            action: "buy",
            broker: rule.broker,
            price: buy,
            amount: rule.buyAmount,
            orderNo: "",
            done: 0,
            createTime: now
        }

        await insertOrReplace("tRuleAction", action);
        r.status = "ordered";

        r.actions.push(action);
        return true;
    }

    return false;
}


let checkingRule = 0;
async function checkRule(scodes) {
    if (checkingRule == 1) {
        console.log("checking");
        return;
    }

    checkingRule = 1;
    debug("checkRule start");
    //遍历 scodes 里的每一个元素 scode,检查响应的 rule 是否满足条件，
    for (let i = 0; i < scodes.length; i++) {
        let scode = scodes[i].split(".")[0];
        let r = rules[scode];
        if (r != null) {
            debug(`checking rule: scode=${scode} status=${r.status}`);
            switch (r.status) {
                case "todo":
                    //检查是否满足条件
                    let succ = await tryToBuy(r);
                    if (!succ) {
                        succ = await tryToSell(r);
                    }
                    break;
                case "toBuy":
                    await tryToBuy(r);
                    break;
                case "toSell":
                    await tryToSell(r);
                    break;
            }
        }
    }

    debug("checkRule end");
    checkingRule = 0;
}

function getDurationText1__(seconds) {
    seconds = parseInt(seconds);
    var h = parseInt(seconds / 3600);
    var m = parseInt((seconds % 3600) / 60);
    var s = seconds % 60;
    var text = h > 0 ? h + ":" : "";
    text = text + add0(m, 2) + ":";
    text = text + add0(s, 2);
    return text;
}

function timeFormat(time, fmt) {
    if (time == null) {
        return "";
    }
    if (time.time) {
        time = new Date(time.time);
    } else {
        time = new Date(time);
    }
    if (fmt == null) {
        var ms = time.getTime();
        var now = new Date();
        if (now - ms < 24 * 60 * 60 * 1000) {
            fmt = "hh:mm";
        } else if (now.getYear() == time.getYear()) {
            fmt = "MM-dd";
        } else {
            fmt = "yyyy-MM";
        }
    }
    var qua = Math.floor((time.getMonth() + 3) / 3);
    var o = {
        "M+": time.getMonth() + 1, // 月份
        "d+": time.getDate(), // 日
        "h+": time.getHours(), // 小时
        "m+": time.getMinutes(), // 分
        "s+": time.getSeconds(), // 秒
        "q+": qua, // 季度
        S: time.getMilliseconds()
        // 毫秒
    };
    if (/(y+)/.test(fmt))
        fmt = fmt.replace(
            RegExp.$1,
            (time.getYear() + 1900 + "").substr(4 - RegExp.$1.length)
        );
    for (var k in o)
        if (new RegExp("(" + k + ")").test(fmt))
            fmt = fmt.replace(
                RegExp.$1,
                RegExp.$1.length == 1
                    ? o[k]
                    : ("00" + o[k]).substr(("" + o[k]).length)
            );
    return fmt;
}


async function doSplit() {
    var toSplit = path.join(directoryPath, "toSplit");
    if (splitting == 1) {
        return;
    }

    splitting = 1;

    try {
        var rPath = path.join(directoryPath, "metadata");
        var metadata = {};
        try {
            metadata = JSON.parse(fs.readFileSync(rPath, "utf-8"));
        } catch (e) {
            info("error parsing replacers:" + e.message);
        }

        var data = fs.readFileSync(toSplit, 'utf8');
        var files = data.split("\n");
        files.forEach(ele => {
            info(ele);
        });

        for (var i = 0; i < files.length; ++i) {
            var ele = files[i];
            info(`processing '${ele}'`);
            if (fs.existsSync(path.join(directoryPath, ele))) {
                var pos = ele.lastIndexOf(".");
                if (pos < 0) {
                    info("bad file:" + ele);
                    continue;
                }

                var fileName = ele.substring(0, pos);
                var fileExt = ele.substring(pos + 1, ele.length);

                if (fs.existsSync(path.join(directoryPath, fileName + ".00." + fileExt))) {
                    response.push("split skipped:" + ele);
                    continue;
                }
                response.push(`${ele} splitting`);

                try {
                    var m = metadata[ele];
                    if (m && m.segments) {
                        let i = 0;
                        Object.keys(m.segments).forEach(async (e) => {
                            info(`seg:${e}`);
                            let segs = m.segments[e];
                            let startTime = getDurationText1__(segs.start);
                            let endTime = getDurationText1__(segs.end);
                            await extractVideo(path.join(directoryPath, ele), i++, startTime, endTime);
                        });
                    } else {
                        await splitVideo(path.join(directoryPath, ele));
                        response.push(`${ele} splitted`);
                    }
                } catch (e) {
                    response.push("error:" + e.message);
                }
            } else {
                response.push(`${ele} not exist`);
            }
        }
    } catch (e) {
        info(e.message);
        response.push("error:" + e.message);
    }

    splitting = 0;
}

// 设置模板引擎
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

function getFileName(file) {
    var s = file.name.split(".");
    var id = s[0];
    var name = file.name;
    if (s.length > 2 && id.length == 11) {
        name = file.name.substring(id.length + 1);
    }
    return name;
}

var i = 0;
// 路由：首页
app.get('/video/i', (req, res) => {
    let files = listFiles();
    const remove = req.query.remove;
    const tags = getTags();
    res.render('fileList', { files: files, tags: tags, remove: remove });
});
app.post('/video/tag', (req, res) => {
    info("video/tag");
    info("files=" + req.body.files);
    info("tags=" + req.body.tags);
    const files = JSON.parse(req.body.files);
    const tags = JSON.parse(req.body.tags);

    let otags = getTags();

    if (files.length == 1) {
        for (var j = 0; j < files.length; ++j) {
            info("file:" + files[j]);
            Object.keys(otags).map(
                (tag) => {
                    var f = otags[tag];
                    delete f[files[j]];
                }
            );
        }

        info("otags=" + JSON.stringify(otags));

        for (var i = 0; i < tags.length; ++i) {
            var f = otags[tags[i]];
            if (f == null) {
                f = {};
                otags[tags[i]] = f;
            }

            for (var j = 0; j < files.length; ++j) {
                f[files[j]] = 1;
            }
        }

    } else {
        for (var i = 0; i < tags.length; ++i) {
            var f = otags[tags[i]];
            if (f == null) {
                f = {};
                otags[tags[i]] = f;
            }

            for (var j = 0; j < files.length; ++j) {
                f[files[j]] = 1;
            }
        }
    }

    fs.writeFileSync(path.join(directoryPath, "tags"), JSON.stringify(otags));
    var resp = JSON.stringify({ data: otags });
    res.send(resp);
});
app.post('/video/cookies', (req, res) => {
    info("video/cookies");
    let cookies = req.body.cookies;
    info(req.body.cookies);

    fs.writeFileSync(path.join(directoryPath, "cookies.txt"), cookies);
    var resp = JSON.stringify({ data: "success" });
    res.send(resp);
});

app.post('/stock/update', async (req, res) => {
    info("/stock/update");

    let data = req.body.rows.split("\n");
    info(data.join("\n"));
    let now = new Date().getTime();
    for (var i = 0; i < data.length; ++i) {
        if (data[i].trim() == "") {
            continue;
        }

        var fields = data[i].split("\t");
        let tday = fields[0];
        let ttime = fields[1];
        if (fields.length == 12) {
            //广发证券
            fields = fields.concat([""]);
            fields[5] = "广发";
            var sql = `insert or ignore into tstock (tday, ttime, sname,scode,operationDirection, operationName,market,tamount,tprice,tcash,tid,taccount, tpair,lastOperationTime) 
        values (?, ?, ?,?, ?, ?,?, ?, ?,?, ?, ?, ?, ?)`;
            let res = await db.runSync(sql, fields.concat([tday + " " + ttime]));
            if (res.error) {
                info(res.error);
                res.send(res);
                return;
            } else {
            }

            await insertOrIgnore("tStockBasic", {
                id: fields[3],
                scode: fields[3],
                sname: fields[2],
                buy: 0,
                updateTime: now
            });
        } else if (fields.length == 22) {
            //tdx 国信证券
            fields = fields.concat([""]);
            var sql = `insert or ignore into tstock (tday, ttime, sname,scode,operationDirection, operationName,market,tamount,tprice,
            tcash,tid,taccount, tpair,lastOperationTime) 
        values (?, ?, ?,?, ?, ?,?, ?, ?,?, ?, ?, ?, ?)`;

            let res = await db.runSync(sql, [tday, ttime, fields[3], fields[2], fields[4], "国信", fields[21], fields[5], fields[6],
                fields[7], fields[19], fields[20], '', tday + " " + ttime]);
            if (res.error) {
                info(res.error);
                res.send(res);
                return;
            } else {
            }

            await insertOrIgnore("tStockBasic", {
                id: fields[2],
                scode: fields[2],
                sname: fields[3],
                buy: fields[6],
                updateTime: now
            });
        } else if (fields.length == 13) {
            //tdx 国金证券
            fields = fields.concat([""]);
            var sql = `insert or ignore into tstock (tday, ttime, sname,scode,operationDirection, operationName,market,tamount,tprice,
            tcash,tid,taccount, tpair,lastOperationTime) 
        values (?, ?, ?,?, ?, ?,?, ?, ?,?, ?, ?, ?, ?)`;

            let res = await db.runSync(sql, [tday, ttime, fields[3], fields[2], fields[5], "国金", fields[11], fields[7], fields[6],
                fields[8], fields[9], fields[11], '', tday + " " + ttime]);
            if (res.error) {
                info(res.error);
                res.send(res);
                return;
            } else {
            }

            await insertOrIgnore("tStockBasic", {
                id: fields[2],
                scode: fields[2],
                sname: fields[3],
                buy: fields[6],
                updateTime: now
            });
        } else if (fields.length == 15) {
            //tdx 国信证券 港股通
            fields = fields.concat([""]);
            var sql = `insert or ignore into tstock (tday, ttime, sname,scode,operationDirection, operationName,market,tamount,tprice,
            tcash,tid,taccount, tpair,lastOperationTime) 
        values (?, ?, ?,?, ?, ?,?, ?, ?,?, ?, ?, ?, ?)`;

            let res = await db.runSync(sql, [fields[1], fields[2], fields[5], fields[4], fields[6], "国信", fields[0], fields[10], fields[9],
            fields[11], fields[13], fields[14], '', tday + " " + ttime]);
            if (res.error) {
                info(res.error);
                res.send(res);
                return;
            } else {
            }

            await insertOrIgnore("tStockBasic", {
                id: fields[4],
                scode: fields[4],
                sname: fields[5],
                buy: fields[9],
                updateTime: now
            });
        }
    };

    let r = await db.allSync("select max(lastOperationTime) as maxOperationTime, scode from tstock group by scode");
    info(`${r.rows.length} stocks`);
    for (var i = 0; i < r.rows.length; ++i) {
        let row = r.rows[i];
        let scode = row.scode;
        let maxOperationTime = row.maxOperationTime;
        info(`updating ${scode} to ${maxOperationTime}`);
        let sql = `update tstock set lastOperationTime=? where scode=?`;
        await db.runSync(sql, [maxOperationTime, scode]);
    }

    var resp = JSON.stringify({ data: "success" });
    res.send(resp);
});

app.get('/stock/account', async (req, res) => {
    info("/stock/account");
    let js = req.query.js;

    let sql = `select * from config where key='stockAccount' `;
    let r = await db.getSync(sql);

    var resp = `${js}(${r.value})`;
    res.send(resp);
});

app.get('/stock/vote', async (req, res) => {
    info("/stock/vote");
    let js = req.query.js;
    let code = req.query.code;
    let sql = `update tstock set lastOperationTime=? where scode=? `;
    let now = timeFormat(new Date(), "yyyyMMdd hhmmss");
    await db.runSync(sql, [now, code]);

    var resp = `${js}({})`;
    res.send(resp);
});

app.get('/stock/updatePrice', async (req, res) => {
    info("/stock/updatePrice");
    let js = req.query.js;
    let scode = req.query.scode;
    let price = req.query.price;
    updatePriceToRule(scode, price);
    let now = Date.now();
    let sql = `update tStockBasic set buy=?, updateTime=? where id=?`;
    await db.runSync(sql, [price, now, scode]);
    checkRule([scode]);
    var resp = `${js}({})`;
    res.send(resp);
});

app.get('/stock/deleteRow', async (req, res) => {
    info("/stock/deleteRow");
    let js = req.query.js;
    let tid = req.query.tid;
    let sql = `delete from tstock where tid=? `;
    await db.runSync(sql, [tid]);

    var resp = `${js}({})`;
    res.send(resp);
});

app.post('/stock/account', async (req, res) => {
    info("/stock/account");
    info(JSON.stringify(req.body));
    let passcode = req.body.passcode;
    if (passcode != "995560") {
        info("bad request");
        res.send("bad request");
        return;
    }
    let data = req.body.data;
    info(data);
    let sql = `insert or replace into config (key, value) values (?,?)`;
    let result = await db.runSync(sql, ["stockAccount", JSON.stringify(data)]);
    var resp = JSON.stringify({ data: "success" });
    res.send(resp);
});


async function dbCall(options) {
    for (let i = 0; i < options.length; ++i) {
        let stat = options[i];

        if (isArray(stat)) {
            let sql = stat[0];
            let params = stat[1];
            debug("dbCall sql:" + sql);
            debug("params:" + JSON.stringify(params));
            return await db.runSync(sql, params);
        } else {
            debug("sql:" + stat);
            return await db.runSync(stat);
        }
    }
}

function isArray(o) {
    return Object.prototype.toString.call(o) === "[object Array]";
}

async function upgradeDb(succ, fail) {
    debug("upgradeDb");

    let res = await db.getSync("SELECT * FROM config where key=?", "dbVersion");
    var updates = [
        "",
        `CREATE TABLE IF NOT EXISTS tStockPrice (
        id text primary key,
        scode text,
        sname text,
        delta real default 0,
        price real default 0,
        ratio real default 0,
        ratio1 real default 0,
        updateTime integer);
        `,
        "update config set value='3' where key='dbVersion';",
        `create table tStockAction(id text primary key, scode text, sname text, type text, price real, step real, amount int, entrustPrice real, entrustNo text, createTime integer, updateTime integer);`,
        "update config set value='5' where key='dbVersion';",
        `alter table tstock add column lastOperationTime text;`,
        "update config set value='7' where key='dbVersion';",
        `create table tpositions(id text primary key, broker text, account_id text, avg_price real, can_use_volume real, frozen_volume real, market_value real, on_road_volume real, open_price real, stock_code text, volume real, updateTime integer);`,
        "update config set value='9' where key='dbVersion';",
        `create table tTradeRule(id text primary key, scode text, sname text, rule text, createTime integer);`,
        "update config set value='11' where key='dbVersion';",
        `alter table tsql add column params text;`,
        "update config set value='13' where key='dbVersion';",
        `drop table tStockAction;`,
        "update config set value='15' where key='dbVersion';",
        `create table tRuleAction(id text primary key, ruleId text, scode text,sname text, action text, price real, amount real, orderNo text, done int default 0, createTime integer);`,
        "update config set value='17' where key='dbVersion';",
        `alter table tTradeRule add column closed integer default 0;`,
        "update config set value='19' where key='dbVersion';",
        `alter table tRuleAction add column broker text default '';`,
        "update config set value='21' where key='dbVersion';",
        `alter table tRuleAction add column status text default '';`,
        "update config set value='23' where key='dbVersion';",
    ];

    if (res == null || res.error) {
        res = await db.runSync(`CREATE TABLE IF NOT EXISTS tstock (
        tid text PRIMARY KEY,
        scode text,
        sname TEXT,
        tday text,
        ttime text,
        tprice REAL,
        operationDirection text,
        operationName text,
        market text,
        tamount integer,
        tcash REAL,
        taccount text,
        tpair text);`);

        await db.runSync("create table config(key varchar(50) primary key, value text);");

        await db.runSync(`CREATE TABLE IF NOT EXISTS tsql (
        id text primary key,
        name text,
        sql text,
        lastUseTime integer);`);

        await db.runSync(`CREATE TABLE IF NOT EXISTS tStockBasic (
        id text primary key,
        scode text,
        sname text,
        buy real default 0,
        sell real default 0,
        updateTime integer);`);

        await db.runSync("insert into config values('dbVersion', 1);");

        updates.forEach(async (sql, i) => {
            await db.runSync(sql);
        });

    } else {
        debug(JSON.stringify(res));

        var ver = res.value;
        updates.splice(0, parseInt(ver));

        if (updates.length > 0) {
            await dbCall(updates);
        }

        let row = await db.getSync("SELECT * FROM config where key=?", ["dbVersion"]);
        if (row == null) {
            debug("dbVersion:null");
        } else {
            debug("dbVersion:" + row.value);
        }
    }
}

async function insertOrReplace(table, row) {
    debug("replace:" + table);
    let keys = Object.keys(row);
    let cols = keys.join(",");
    let vs = keys.map((k, i) => "?").join(",");
    let sql = `insert or replace into ${table}(${cols}) values(${vs})`;
    let vals = keys.map((k, i) => {
        let val = row[k];
        if (val != null && typeof (val) == "object") {
            val = JSON.stringify(val);
        }

        return val;
    });
    return await dbCall([[sql, vals]]);
}

async function insertOrIgnore(table, row) {
    debug("replace:" + table);
    let keys = Object.keys(row);
    let cols = keys.join(",");
    let vs = keys.map((k, i) => "?").join(",");
    let sql = `insert or ignore into ${table}(${cols}) values(${vs})`;
    let vals = keys.map((k, i) => {
        let val = row[k];
        if (val != null && typeof (val) == "object") {
            val = JSON.stringify(val);
        }

        return val;
    });
    return await dbCall([[sql, vals]]);
}

app.post('/stock/screen/nodes', async (req, res) => {
    info("post /stock/screen/nodes");

    let root = req.body;
    let children = root.children;
    delete root["children"];
    info(JSON.stringify(root));
    root.children = children;

    //将nodes写入文件
    fs.writeFileSync(path.join(directoryPath, "screen.json"), JSON.stringify(root));

    function findNodeById(node, rId) {
        if (node.rId == rId) {
            return node;
        }
        if (node.children) {
            for (var i = 0; i < node.children.length; i++) {
                var child = node.children[i];
                var foundNode = findNodeById(child, rId);
                if (foundNode) {
                    return foundNode;
                }
            }
        }

        return null;
    }

    function findChild(root, pathArr) {
        if (pathArr == null) {
            return null;
        }
        if (pathArr.length == 0) {
            return root;
        }

        var index = pathArr[0];
        if (index < root.children.length) {
            let node = root.children[index];
            return findChild(node, pathArr.slice(1));
        } else {
            return null;
        }
    }

    function getChildProperty(root, path, key) {
        debug(`getChildProperty:${path}.${key}`);
        let node = findChild(root, path.split("."));
        if (node) {
            return node[key];
        }

        return null;
    }

    if (root.children.length == 0) {
        var resp = JSON.stringify({ data: "success" });
        res.send(resp);
        return;
    }
    //0.0.0.0.0.0.0.1.0.1.3.0.1
    //0.0.0.0.0.0.0.1.0.1.3.0.1.1.0.0.0.0
    //0.0.0.0.0.0.0.1.0.1.3.0.1.2.1.2.0.0
    if (root.isGfStatus == 1) {
        debug("isGfStatus");
        var node = findNodeById(root, "com.gf.client:id/refresh_child");
        if (node) {
            debug("refresh_child found");
            for (let i = 0; ; i++) {
                let sname = getChildProperty(node, `1.${i}.0.0.0`, "text");
                let scode = getChildProperty(node, `1.${i}.0.0.1.0`, "text");
                let price = getChildProperty(node, `2.1.2.${i * 4}.0`, "text");
                let delta = getChildProperty(node, `2.1.2.${i * 4 + 1}.0`, "text");
                let ratio = getChildProperty(node, `2.1.2.${i * 4 + 2}.0.0`, "text");
                let ratio1 = getChildProperty(node, `2.1.2.${i * 4 + 3}.0`, "text");
                scodes.push(scode);
                debug(`${i}:${sname}(${scode}),${price},${delta},${ratio},${ratio1}`);
                if (sname == null || scode == null || price == null || delta == null || ratio == null || ratio1 == null) {
                    break;
                }

                let updateTime = Date.now();
                await insertOrReplace("tStockPrice", {
                    id: `${scode}_${updateTime}`,
                    scode: scode,
                    sname: sname,
                    delta: delta,
                    price: price,
                    ratio: ratio,
                    ratio1: ratio1,
                    updateTime: updateTime
                })
            }
        }
    }

    var resp = JSON.stringify({ data: "success" });
    res.send(resp);
});

app.post('/stock/prices', async (req, res) => {
    info("post /stock/prices");

    let prices = req.body;
    for (let i = 0; i < prices.length; i++) {
        let price = prices[i];
        let now = Date.now();
        price.id = `${price.scode}_${now}`;
        price.updateTime = now;
        await insertOrReplace("tStockPrice", price);

        await insertOrReplace("tStockBasic", {
            id: price.scode,
            scode: price.scode,
            sname: price.sname,
            buy: price.price,
            updateTime: now
        });
    }

    let resp = JSON.stringify({ action: [] });
    res.send(resp);
});

app.post('/stock/positions', async (req, res) => {
    info("post /stock/positions");

    info(JSON.stringify(req.body));
    let passcode = req.body.passcode;
    if (passcode != "995560") {
        info("bad request");
        res.send("bad request");
        return;
    }

    let positions = req.body.data;

    for (let i = 0; i < positions.length; i++) {
        let pos = positions[i];
        let now = Date.now();
        if (i == 0) {
            await dbCall([`delete from tPositions where id like '${pos.broker}%'`]);
        }
        pos.stock_code = pos.stock_code.split(".")[0]
        pos.id = `${pos.broker}_${pos.account_id}_${pos.stock_code}`;
        pos.updateTime = now;
        await insertOrReplace("tPositions", pos);
    }

    let resp = JSON.stringify({});
    res.send(resp);
});

function parseTime(str) {
    //"20250411150002.585"
    // 提取各个部分
    const year = parseInt(str.substring(0, 4));
    const month = parseInt(str.substring(4, 6)) - 1; // 月份从0开始
    const day = parseInt(str.substring(6, 8));
    const hours = parseInt(str.substring(8, 10));
    const minutes = parseInt(str.substring(10, 12));
    const seconds = parseInt(str.substring(12, 14));
    const milliseconds = parseInt(str.substring(15, 18)); // 小数点后的部分

    // 创建Date对象
    return new Date(year, month, day, hours, minutes, seconds, milliseconds);
}

app.post('/stock/quotes', async (req, res) => {
    info("post /stock/quotes");
    //{"data":{"837092.BJ":{"20250523101631.000":{"amount":10865500,"askPrice":[42.86,42.87,42.88,42.9,42.92],"askVol":[59,4,20,1,30],"bidPrice":[42.66,42.65,42.64,42.63,42.62],"bidVol":[2,2,10,32,26],"high":43.24,"lastClose":42.76,"lastPrice":42.65,"lastSettlementPrice":0,"low":42.41,"open":42.41,"openInt":13,"pvolume":253700,"settlementPrice":0,"stime":"20250523101631.000","stockStatus":1,"time":1747966591000,"transactionNum":0,"volume":2537}}}}
    info(JSON.stringify(req.body));
    let passcode = req.body.passcode;
    if (passcode != "995560") {
        info("bad request");
        res.send("bad request");
        return;
    }

    let data = req.body.data;
    Object.keys(data).forEach(async (scode) => {
        let v = data[scode];
        scode = scode.split(".")[0];
        Object.keys(v).forEach(async (time) => {
            let v1 = v[time];
            let updateTime = parseTime(time).getTime();
            let price = v1.bidPrice[0];
            if (price == 0) {
                price = v1.askPrice[0];
            }

            if (price == 0) {

            } else {
                updatePriceToRule(scode, price);
                let sql = `update tStockBasic set buy=?,updateTime=? where id=?`;
                await db.runSync(sql, [price, updateTime, scode]);
            }
        })
    })

    setTimeout(function () { checkRule(Object.keys(data)) }, 100);

    res.send("ok");
});

app.post('/stock/quotes.mini', async (req, res) => {
    info("post /stock/quotes.mini");

    info(JSON.stringify(req.body));
    let passcode = req.body.passcode;
    if (passcode != "995560") {
        info("bad request");
        res.send("bad request");
        return;
    }

    let data = req.body.data;
    Object.keys(data).forEach(async (scode) => {
        let v1 = data[scode];
        scode = scode.split(".")[0];
        let updateTime = v1.time;
        let price = v1.bidPrice[0];
        if (price == 0) {
            price = v1.askPrice[0];
        }

        if (price == 0) {
        } else {
            updatePriceToRule(scode, price);
            let sql = `update tStockBasic set buy=?,updateTime=? where id=?`;
            await db.runSync(sql, [price, updateTime, scode]);
        }
    })

    setTimeout(function () { checkRule(Object.keys(data)) }, 100);

    res.send("ok");
});

app.get('/stock/screen/nodes', async (req, res) => {
    info("get /stock/screen/nodes");
    let js = req.query.js;
    let log = req.query.log;
    if (log) {
        info("logLevel to " + log);
        logLevel = log;
    }

    let nodes = fs.readFileSync(path.join(directoryPath, "screen.json"), "utf-8");
    let data = JSON.parse(nodes);
    var resp = JSON.stringify({ data: data });
    if (js) {
        resp = `${js}(${resp})`;
    }

    res.send(resp);
});

app.get('/stock/rule/create', async (req, res) => {
    info("get /stock/rule/create");
    let js = req.query.js;
    let json = JSON.parse(req.query.json);
    let now = Date.now();
    let sql = `insert or replace into tTradeRule(id, scode, sname, rule, createTime) values(?,?,?,?,?)`;
    let result = await db.runSync(sql, [json.scode, json.scode, json.sname, JSON.stringify(json), now]);
    await db.runSync(`delete from tRuleAction where scode=?`, [json.scode]);
    rules[json.scode] = await db.getSync(`select * from tTradeRule where id=?`, [json.scode]);
    reloadRule(rules[json.scode]);

    await insertOrReplace("tStockBasic", {
        id: json.scode,
        scode: json.scode,
        sname: json.sname,
        buy: 0,
        updateTime: now
    });

    var resp = JSON.stringify({});
    if (result.error) {
        resp = result;
    }

    if (js) {
        resp = `${js}(${resp})`;
    }

    res.send(resp);
});

app.get('/stock/rule/cancel', async (req, res) => {
    info("get /stock/rule/cancel");
    let js = req.query.js;
    let scode = req.query.scode;
    let now = Date.now();
    rules[scode].closed = 1;

    let sql = `update tTradeRule set closed = 1 where scode=?`;
    let result = await db.runSync(sql, [scode]);

    if (result.error == null) {
        sql = `update tRuleAction set done = -1 where scode=?`;
        result = await db.runSync(sql, [scode]);
    }

    if (result.error == null) {
        reloadRule(rules[scode]);
    }

    var resp = JSON.stringify({});
    if (result.error) {
        resp = result;
    }

    if (js) {
        resp = `${js}(${resp})`;
    }

    res.send(resp);
});

app.get('/stock/rule/delete', async (req, res) => {
    info("get /stock/rule/delete");
    let js = req.query.js;
    let scode = req.query.scode;
    let now = Date.now();
    delete rules[scode]

    let sql = `delete from tTradeRule where scode=?`;
    let result = await db.runSync(sql, [scode]);

    if (result.error == null) {
        sql = `delete from tRuleAction where scode=?`;
        result = await db.runSync(sql, [scode]);
    }

    var resp = JSON.stringify({});
    if (result.error) {
        resp = result;
    }

    if (js) {
        resp = `${js}(${resp})`;
    }

    res.send(resp);
});

app.get('/stock/rule/actions', async (req, res) => {
    info("get /stock/rule/actions");
    let js = req.query.js;
    let broker = req.query.broker;
    let sql = `select * from tRuleAction where broker=? and orderNo='' and done=0`;
    let r = await db.allSync(sql, [broker]);
    r.rows.forEach(async (row) => {
        row.scode = formatScode(row.scode);
    });
    var resp = JSON.stringify({ data: r.rows });

    if (r.error) {
        resp = r;
    }

    if (js) {
        resp = `${js}(${resp})`;
    }

    res.send(resp);
});

app.get('/stock/rule/status', async (req, res) => {
    info("get /stock/rule/status");
    let js = req.query.js;
    let scode = req.query.scode;


    var resp = JSON.stringify({ data: rules });
    if (js) {
        resp = `${js}(${resp})`;
    }

    res.send(resp);
});


app.get('/stock/fe/user/login', async (req, res) => {
    info("/stock/fe/user/login");
    let js = req.query.js;
    let login = req.query.login;
    let password = req.query.password;
    //todo
    var resp = `${js}(${JSON.stringify({ login: login })})`;
    res.send(resp);
});

function updatePriceToRule(scode, price) {
    let r = rules[scode];
    if (r != null) {
        let rule = r.rule;
        rule.currentPrice = price;
        if (rule.maxPrice == null || price > rule.maxPrice) {
            rule.maxPrice = price;
        }

        if (rule.minPrice == null || price < rule.minPrice) {
            rule.minPrice = price;
        }
    }
}

function formatScode(stockCode) {
    // 转换为字符串并去除空格
    const code = String(stockCode).trim();

    // 检查代码是否有效
    if (!code) {
        throw new Error("股票代码不能为空");
    }

    let suffix = "";
    if (code.length == 6) {
        if (/^(600|601|603|605|688|900|51)\d+$/.test(code)) {
            suffix = "SH"; // 上交所（600/601/603/605/688/900 开头）
        } else if (/^(000|001|002|003|30|15|12|3)\d+$/.test(code)) {
            suffix = "SZ"; // 深交所（000/001/002/003/300 开头）
        } else if (/^(8|43|83|87|88|920)\d+$/.test(code)) {
            suffix = "BJ"; // 北交所（8/43/83/87/88 开头）
        }
    } else if (/^\d{4,5}$/.test(code) || /^0[0-9]\d{3}$/.test(code)) {
        suffix = "HK"; // 港交所（4-5位数字，或 08 开头）
    } else {
        info(`未知：${code}`);
    }

    if (suffix == "") {
        info(`error scode：${code}`);
        return null;
    }

    // 返回格式化结果（如 600023.SH）
    return `${code}.${suffix}`;
}


app.get('/stock/codes', async (req, res) => {
    info("/stock/codes");
    let js = req.query.js;
    let sql = `select scode from tstockbasic`;
    let r = await db.allSync(sql);
    let scodes = [];
    r.rows.forEach((row) => {
        let code = row.scode;
        code = formatScode(code);
        if (code == null) {
        } else {
            scodes.push(code);
        }
    })

    var resp = JSON.stringify(scodes);
    if (js != null) {
        resp = `${js}(${resp})`;
    }

    res.send(resp);
});

app.get('/stock/price/current', async (req, res) => {
    info("/stock/trade/all");
    let js = req.query.js;

    let sql = `select * from tstockbasic `;
    let r = await db.allSync(sql);

    var resp = JSON.stringify({ rows: r.rows });
    if (js != null) {
        resp = `${js}(${resp})`;
    }

    res.send(resp);
});

app.get('/stock/pair', async (req, res) => {
    info("/stock/pair");
    let js = req.query.js;
    let reset = req.query.reset;

    let sql = `select * from tstock where tamount<0 and tpair is null or tpair=''`;
    if (reset) {
        info("reset before pair");
        await db.runSync(`update tstock set tpair=''`);
        sql = "select * from tstock where tamount<0";
    }
    let r = await db.allSync(sql);
    let sells = r.rows;
    info(`${sells.length} sells`);
    for (var i = 0; i < sells.length; ++i) {
        let sell = sells[i];
        info(`${sell.sname}(${sell.scode}):${sell.tid}`);
        let r = await db.allSync("select * from tstock where tamount=? and scode=? and tprice<? and (tpair='' or tpair is null) order by tprice desc",
            [sell.tamount * -1, sell.scode, sell.tprice]);
        let buys = r.rows;
        if (buys.length > 0) {
            let buy = buys[0];
            info(`${sell.sname}(${sell.scode}):${sell.tid} <==> ${buy.tid}`);
            await db.runSync(`update tstock set tpair=? where tid=?`, [buy.tid, sell.tid]);
            await db.runSync(`update tstock set tpair=? where tid=?`, [sell.tid, buy.tid]);
        }
    };

    var resp = `${js}(${JSON.stringify({ data: "success" })})`;
    res.send(resp);
});

app.post('/stock/query', async (req, res) => {

    let sql = req.body.sql;
    let name = req.body.name;
    let params = req.body.params;
    info(`sql:${sql}`);
    let r = await db.allSync(sql);
    if (r.error) {
        info(r.error);
        res.send(JSON.stringify({ error: r.error }));
        return;
    }

    if (name != null) {
        await db.runSync(`insert or replace into tsql (id, name, sql,params,lastUseTime) values (?,?,?,?,?)`,
            [name, name, sql, params, Date.now()]);
    }

    var resp = JSON.stringify({ data: r.rows });
    res.send(resp);
});


app.post('/stock/deal/update', async (req, res) => {
    info(`/stock/deal/update:${JSON.stringify(req.body)}`);
    let deal = req.body;
    deal.lastOperationTime = deal.tday + " " + deal.ttime;
    let r = await insertOrIgnore("tStock", deal);
    if (r.error == null) {
        r = db.runSync(`update tStock set lastOperationTime=? where scode=?`, [deal.lastOperationTime, deal.scode]);
    }

    let resp = {};
    if (r.error) {
        info(r.error);
        resp = { error: r.error };
    } else {
    }

    res.send(JSON.stringify(resp));
});

app.post('/stock/rule/action/ordered', async (req, res) => {
    info(`rule/action/ordered:${JSON.stringify(req.body)}`);

    let scode = req.body.scode;
    let broker = req.body.broker;
    let status = req.body.status;
    let orderNo = req.body.orderNo;
    let r;
    if (status == 56) {
        r = await db.runSync("update tRuleAction set done = 1, status=?, orderNo=? where scode=? and broker=? and done=0", [status, orderNo, scode, broker]);
    } else {
        r = await db.runSync("update tRuleAction set status=?, orderNo=? where scode=? and broker=? and done=0", [status, orderNo, scode, broker]);
    }
    let resp = {};
    if (r.error) {
        info(r.error);
        resp = { error: r.error };
    } else {
        reloadRule(rules[scode]);
    }

    res.send(JSON.stringify(resp));
});

app.get('/stock/sqls', async (req, res) => {

    let js = req.query.js;
    let sql = "select * from tsql order by lastUseTime desc";
    let r = await db.allSync(sql);
    if (r.error) {
        info(r.error);
        res.send(r);
        return;
    }

    var resp = `${js}(${JSON.stringify({ data: r.rows })})`;
    res.send(resp);
});

app.post('/stock/sql/update', async (req, res) => {

    let sql = req.body.sql;
    let name = req.body.name;
    let params = req.body.params;
    let r = await db.runSync(`insert or replace into tsql (id, name, params, sql,lastUseTime) values (?,?,?,?,?)`,
        [name, name, params, sql, Date.now()]);

    var resp = JSON.stringify({ data: "success" });
    res.send(resp);
});

app.get('/video/replacers', (req, res) => {
    info("video/replacers");
    var rPath = path.join(directoryPath, "replacers");
    var replacers = {};
    try {
        replacers = JSON.parse(fs.readFileSync(rPath, "utf-8"));
    } catch (e) {
        info("error parsing replacers:" + e.message);
    }

    var resp = req.query.js + "(" + JSON.stringify({ data: replacers }) + ");";
    res.send(resp);
});

app.get('/video/metadata', (req, res) => {
    info("video/metadata");
    var fileName = req.query.fileName;
    var rPath = path.join(directoryPath, "metadata");
    var data = {};
    try {
        data = JSON.parse(fs.readFileSync(rPath, "utf-8"));
    } catch (e) {
        info("error parsing replacers:" + e.message);
    }

    var m = data[fileName];
    if (m == null) {
        m = {};
    }

    if (fileName == "") {
        m = data;
    }


    var resp = req.query.js + "(" + JSON.stringify({ data: m }) + ");";
    res.send(resp);
});
const multer = require('multer');
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // 指定文件存储的目录
        info("dest:" + file.originalname);
        const path = path.join(directoryPath, file.originalname);
        if (fs.existsSync(path)) {
            info("文件已存在");
            fs.unlinkSync(path);
        } else {
        }
        cb(null, directoryPath);
    },
    filename: function (req, file, cb) {
        info("fileName:" + file.originalname);
        // 指定文件名
        cb(null, file.originalname);
    }
});
// 定义上传文件的路由
app.post('/video/upload', (req, res) => {
    info("file uploading");
    if (!req.files || !req.files.file) {
        return res.status(400).send('No file uploaded.');
    }

    const file = req.files.file;
    var fileName = decodeURIComponent(file.name);
    const filePath = path.join(directoryPath, fileName);

    // 将文件保存到服务器上指定目录
    file.mv(filePath, err => {
        if (err) {
            console.error(err);
            return res.status(500).send(err);
        }
        toStt(fileName);
        res.send(`File ${file.name} uploaded successfully.`);
    });
});
app.get('/video/addSegment', (req, res) => {
    info("video/addSegment");
    var fileName = req.query.fileName;
    var start = req.query.start;
    var end = req.query.end;
    var name = req.query.name;
    var rPath = path.join(directoryPath, "metadata");
    var data = {};
    try {
        data = JSON.parse(fs.readFileSync(rPath, "utf-8"));
    } catch (e) {
        info("error parsing metadata:" + e.message);
    }

    var m = data[fileName];
    if (m == null) {
        m = {};
        data[fileName] = m;
    }

    if (m.segments == null) {
        m.segments = {};
    }

    m.segments[name] = { start, end };

    fs.writeFileSync(rPath, JSON.stringify(data));

    var resp = req.query.js + "(" + JSON.stringify({ data: m }) + ");";
    res.send(resp);
});
app.post('/video/updateScript', (req, res) => {
    info("video/updateScript");
    info("params:" + JSON.stringify(req.body));
    const params = JSON.parse(req.body.params);
    var filePath = path.join(directoryPath, params.file);
    info("filePath:" + filePath);
    var replaceAll = params.replaceAll;
    var rPath = path.join(directoryPath, "replacers");
    var scripts = fs.readFileSync(filePath, "utf-8");
    var replacers = {};
    try {
        replacers = JSON.parse(fs.readFileSync(rPath, "utf-8"));
    } catch (e) {
        info("error parsing replacers:" + e.message);
    }

    if (params.oldWords != "") {
        var words = JSON.parse(params.oldWords);
        words.forEach((w) => {
            scripts = scripts.replace(new RegExp(w, "g"), replacers[w]);
        });
    } else if (params.deletedWord != '' && params.newWord != '') {
        scripts = scripts.replace(new RegExp(params.deletedWord, "g"), params.newWord);
        if (replaceAll) {
            replacers[params.deletedWord] = params.newWord;
            fs.writeFileSync(rPath, JSON.stringify(replacers));
        }
    } else {
        var script = scripts.split("\n");
        script[params.index] = script[params.index].replace(new RegExp(params.oldScript, "g"), params.newScript);
        scripts = script.join("\n");
    }
    fs.writeFileSync(filePath, scripts);

    var resp = JSON.stringify({ data: {} });
    //resp = JSON.stringify(otags);
    //res.jsonp(resp);
    res.send(resp);
});
app.get('/video/updatePosition', (req, res) => {
    info("video/updatePosition");
    var fileName = req.query.fileName;
    var position = req.query.position;
    var rPath = path.join(directoryPath, "metadata");
    var data = {};
    try {
        data = JSON.parse(fs.readFileSync(rPath, "utf-8"));
    } catch (e) {
        info("error parsing replacers:" + e.message);
    }

    m = data[fileName];
    if (m == null) {
        m = {};
    }
    m.position = position;
    m.lastUpdateTime = new Date().getTime();
    data[fileName] = m;
    fs.writeFileSync(rPath, JSON.stringify(data));

    var resp = req.query.js + "(" + JSON.stringify({ data: m }) + ");";
    res.send(resp);
});
app.get('/video/updatePosition', (req, res) => {
    info("video/updatePosition");
    var fileName = req.query.fileName;
    var position = req.query.position;
    var rPath = path.join(directoryPath, "metadata");
    var data = {};
    try {
        data = JSON.parse(fs.readFileSync(rPath, "utf-8"));
    } catch (e) {
        info("error parsing replacers:" + e.message);
    }

    m = data[fileName];
    if (m == null) {
        m = {};
    }
    m.position = position;
    m.lastUpdateTime = new Date().getTime();
    data[fileName] = m;
    fs.writeFileSync(rPath, JSON.stringify(data));

    var resp = req.query.js + "(" + JSON.stringify({ data: m }) + ");";
    res.send(resp);
});
app.get('/video/player', (req, res) => {
    res.render('player');
});
app.get('/video/config', (req, res) => {
    const fp = path.join(directoryPath, "config.json");
    var text = fs.readFileSync(fp, "utf-8");
    var json = { data: JSON.parse(text) }
    var resp = req.query.js + "(" + JSON.stringify(json) + ");";
    res.send(resp);
});

app.post('/video/ping', (req, res) => {
    const fp = path.join(directoryPath, "config.json");
    var text = fs.readFileSync(fp, "utf-8");
    var config = JSON.parse(text);
    var bd = req.body
    info("body:" + JSON.stringify(bd));
    Object.keys(bd).forEach((item) => {
        if (config[item] == null) {
            config[item] = {};
        }
        config[item] = Object.assign(config[item], bd[item])
    });
    config = JSON.stringify(config);
    fs.writeFileSync(fp, config);
    res.send(config);
});

app.get('/video/download/:filename', (req, res) => {
    const fileName = req.params.filename;
    const videoPath = path.join(directoryPath, fileName);
    info("videoPath:" + videoPath);
    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;

    // 获取范围头
    const range = req.headers.range;
    const contentType = mime.getType(videoPath);
    if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = (end - start) + 1;
        const file = fs.createReadStream(videoPath, { start, end });

        // 设置响应头
        res.writeHead(206, {
            "Content-Range": `bytes ${start}-${end}/${fileSize}`,
            "Accept-Ranges": "bytes",
            "Content-Length": chunkSize,
            "Content-Type": contentType // 替换为适当的 MIME 类型
        });

        // 将视频文件流传递给响应对象
        file.pipe(res);
    } else {
        // 如果没有范围头，则正常提供整个视频文件
        res.writeHead(200, {
            "Content-Length": fileSize,
            "Content-Type": contentType // 替换为适当的 MIME 类型
        });

        const file = fs.createReadStream(videoPath);
        file.pipe(res);
    }
});

// 路由：删除文件
app.post('/video/delete', (req, res) => {
    const files = JSON.parse(req.body.files);
    const remove = req.body.remove;
    info("remove:" + remove);
    if (remove != pwd) {
        var resp = JSON.stringify({ ok: 0 });
        //resp = JSON.stringify(otags);
        //res.jsonp(resp);
        res.send(resp);
    } else {
        deleteFiles(files);
        cleanFileMetadata();

        var resp = JSON.stringify({ ok: 1 });
        //resp = JSON.stringify(otags);
        //res.jsonp(resp);
        res.send(resp);
    }
});

app.get('/video/rename', (req, res) => {
    const fileName = path.join(directoryPath, req.query.fileName);
    const newName = path.join(directoryPath, req.query.newName);

    info("rename:'" + fileName + "' to '" + newName + "'");

    var resp = { ok: 1 };
    try {
        fs.renameSync(fileName, newName);
    } catch (err) {
        console.error(`failed:${err.message}`);
        resp = { error: err.message };
    }

    var resp = req.query.js + "(" + JSON.stringify(resp) + ");";
    res.send(resp);
});

app.get('/video/setScriptPos', (req, res) => {
    const top = req.query.top;
    const bottom = req.query.bottom;
    const left = req.query.left;
    const right = req.query.right;
    const fileName = req.query.fileName;

    info(`setScript:${top},${bottom},${left},${right},${fileName}`);

    var rPath = path.join(directoryPath, "scripts");
    var data = {};
    try {
        data = JSON.parse(fs.readFileSync(rPath, "utf-8"));
    } catch (e) {
        info("error parsing replacers:" + e.message);
    }

    data[fileName] = { top: top, bottom: bottom, left: left, right: right };

    var resp = { ok: 1 };
    try {
        fs.writeFileSync(rPath, JSON.stringify(data));
        fs.unlink(path.join(directoryPath, `${fileName}.htm`), err => {
            if (err) {
                console.error('Error deleting file:', err);
            } else {
                info('File deleted:', fileName);
            }
        });
        fs.unlink(path.join(directoryPath, `${fileName}.srt`), err => {
            if (err) {
                console.error('Error deleting file:', err);
            } else {
                info('File deleted:', fileName);
            }
        });
    } catch (err) {
        console.error(`failed:${err.message}`);
        resp = { error: err.message };
    }

    var resp = req.query.js + "(" + JSON.stringify(resp) + ");";
    res.send(resp);
});

app.get('/video/removeScriptPos', (req, res) => {
    const fileName = req.query.fileName;

    info(`removeScript:${fileName}`);

    var rPath = path.join(directoryPath, "scripts");
    var data = {};
    try {
        data = JSON.parse(fs.readFileSync(rPath, "utf-8"));
        let command = `find ${directoryPath}/ -name "${fileName}.*" |xargs -I {} rm -rf "{}"`;
        console.log(command);
        exec(command, (error, stdout, stderr) => {
            console.log(stdout);
            if (error) {
                console.error(stderr);
            }
        });

    } catch (e) {
        info("error parsing replacers:" + e.message);
    }

    delete data[fileName];

    var resp = { ok: 1 };
    try {
        fs.writeFileSync(rPath, JSON.stringify(data));
    } catch (err) {
        console.error(`failed:${err.message}`);
        resp = { error: err.message };
    }

    var resp = req.query.js + "(" + JSON.stringify(resp) + ");";
    res.send(resp);
});
app.post('/video/toStt', (req, res) => {
    const filePath = req.query.file;
    toStt(filePath);
    res.redirect('/video');
});

app.post('/video/toSplit', (req, res) => {
    const filePath = req.query.file;
    toSplit(filePath);
    res.redirect('/video');
});

app.get('/video/doSplit', (req, res) => {
    info("splitting=" + splitting);
    if (response.length > 0) {
        res.send("<pre>" + response.join("\n") + "</pre>");
        if (splitting == 0) {
            response = [];
            return;
        }
    }

    if (splitting == 0) {
        doSplit().then();
        res.send("started");
    } else {
        res.send(JSON.stringify(response));
    }
});

async function init() {
    await upgradeDb();
    reloadRules();
    app.listen(port, () => {
        info(`Server is running on port ${port}`);
    });
}

init();


