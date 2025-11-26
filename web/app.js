const express = require('express');
const fs = require('fs');
const path = require('path');
const mime = require('mime');
const fileUpload = require('express-fileupload');
const http = require('http');
const app = express();
const WebSocket = require('ws');

//const uuid = (await import('uuid')).v4;
let uuid;
import('uuid').then(module => {
    uuid = module.v4;
}).catch(err => {
    console.error('Failed to load uuid module:', err);
});

//引入sqlite库
const sqlite3 = require('sqlite3').verbose();
const { spawn, exec } = require('child_process');
let response = [];
let splitting = 0;

app.use(express.json({
    limit: '10mb'
}));
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

const server = http.createServer(app);
let wss = null;
let workerCreateRule = {
    id: 0,
    succeeded: [],
    failed: [],
    logs: []
};
function initWss() {
    wss = new WebSocket.Server({
        server,
        path: '/stock/ws'
    });
    wss.callbacks = {};
    wss.funcs = {};
    wss.on('connection', async (ws, request) => {
        // 获取客户端 IP
        const clientIP = request.socket.remoteAddress;
        info(`新的 WebSocket 连接IP: ${clientIP}`);

        // 接收消息
        ws.on('message', (message, isBinary) => {
            if (isBinary) {
                //todo
            } else {
                info("websocket rec:", message);
                let json = null;
                try {
                    json = JSON.parse(message);
                } catch (e) {
                    console.log(e);
                }
                if (json) {
                    if (json.func) {
                        let res = wss.funcs[json.func](json.params, ws);
                    } else if (json.id) {
                        let cb = wss.callbacks[json.id];
                        if (cb) {
                            cb(json.result, ws);
                            delete wss.callbacks[json.id];
                        }
                    }
                }
            }
        });

        ws.on('close', (e) => {
            ws.onClosed && ws.onClosed();
        });

        ws.callFunc = async function (func, params) {
            return new Promise((resolve, reject) => {
                let id = uuid();
                let timer = setTimeout(() => {
                    delete wss.callbacks[id];
                    resolve({ error: `ws.callFunc(${func}) timeout` });
                }, 5000);

                wss.callbacks[id] = function (res) {
                    clearTimeout(timer);
                    info(`${func} result: ${res}`);
                    resolve(res);
                }

                ws.send(JSON.stringify({ func: func, params: params, id }));
            });
        }

        let result = await ws.callFunc("register");
        info(`${result} registerred`);
        ws.clientId = result.clientId;
    });

    wss.callFunc = async function (clientId, func, params) {
        return new Promise(async (resolve, reject) => {
            let client = null;

            for (const c of wss.clients) {
                if (c.clientId === clientId) {
                    client = c;
                    break;
                }
            }

            if (client) {
                let result = await client.callFunc(func, params);
                resolve(result);
            } else {
                resolve({ error: `clientId ${clientId} not found` });
            }
        });
    }

}


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

function getRuleId(scode, broker) {
    return `${scode}.${broker}`;
}

function info(msg, req, logs, maxLogSize) {
    if (logLevel > INFO) {
        return;
    }

    let time = timeFormat(new Date(), "yyyy-MM-dd hh:mm:ss");
    let text = `${time}[${req ? req.threadId : ""}]:${msg}`;
    if (logs) {
        logs.push(text);
        if (!maxLogSize) {
            maxLogSize = 10;
        }

        logs.splice(0, logs.length - maxLogSize);
    }

    console.log(text);
}
function debug(msg, req) {
    if (logLevel > DEBUG) {
        return;
    }

    let time = timeFormat(new Date(), "yyyy-MM-dd hh:mm:ss");
    console.log(`${time}[${req ? req.threadId : ""}]:${msg}`);
}
function error(msg, req) {
    if (logLevel > ERROR) {
        return;
    }

    let time = timeFormat(new Date(), "yyyy-MM-dd hh:mm:ss");
    console.log(`${time}[${req ? req.threadId : ""}]:${msg}`);
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
    let req = {
        threadId:
            Date.now() + "" + Math.floor(Math.random() * 10000)
    }

    for (let i = 0; i < ruleList.rows.length; i++) {
        let rule = ruleList.rows[i];
        await reloadRule(rule, req);
    }
}

async function reloadRule(r, req) {
    if (r == null) {
        return;
    }

    info("reloadRule:" + r.scode, req);

    let now = Date.now();
    if (r.expireTime != null && r.expireTime < now) {
        info("expired rule:" + r.scode, req);
        if (rules[r.scode] && rules[r.scode][r.broker]) {
            delete rules[r.scode][r.broker];
        }

        await db.runSync(`update tRuleAction set done = -1 where ruleId=?`, [r.id]);

        await db.runSync(`update tTradeRule set closed=1 where id = '${r.id}'`);

        return;
    }

    if (r.closed != 0) {
        if (rules[r.scode] && rules[r.scode][r.broker]) {
            delete rules[r.scode][r.broker];
        }

        return;
    }

    try {
        info("r.rule:" + r.rule, req);
        r.rule = JSON.parse(r.rule);
    } catch (e) {
        info(e.message, req);
        info(e.stack, req);
    }

    if (rules[r.scode] == null) {
        rules[r.scode] = {};
    }
    rules[r.scode][r.broker] = r;

    let sb = await db.getSync(`select * from tStockBasic where scode = '${r.scode}'`);
    if (sb != null) {
        r.rule.currentPrice = r.rule.minPrice = r.rule.maxPrice = sb.buy;
    }

    r.actions = [];
    //从 truleaction 里读取响应股票的最近一条执行记录
    let ra = await db.getSync(`select * from tRuleAction where ruleId = '${r.id}' order by createTime desc limit 1`);
    if (ra) {
        info("ra:" + JSON.stringify(ra), req);
        if (ra.done == 0) {
            r.status = "ordered";
        } else if (ra.done == -1) {
            r.status = "cancelled";
        } else {
            if (ra.action == "buy" && (r.rule.order == "buyFirst" || r.rule.order == "")) {
                r.status = "toSell";
            } else if (ra.action == "sell" && (r.rule.order == "sellFirst" || r.rule.order == "")) {
                r.status = "toBuy";
            } else {
                info("rule done", req);
                r.status = "done";
                await db.runSync(`update tTradeRule set closed=1 where id = '${r.id}'`);
                delete rules[r.scode][r.broker];
                setTimeout(async () => {
                    let res = await autoCreateRule(r.scode, req.threadId);
                    if (res.error == null) {
                        await saveCreateRuleFailure(r.scode, "");
                        reloadRule(res.rule, req);
                    } else {
                        error(res.error, req);
                        await saveCreateRuleFailure(r.scode, res.error);
                    }
                }, 100);
            }
        }

        info(`r.status=${r.status}`, req);
        r.actions.push(ra);
    } else {
        info(`r.status=${r.status}`, req);
        if (r.rule.order == "buyFirst") {
            r.status = "toBuy";
        } else if (r.rule.order == "sellFirst") {
            r.status = "toSell";
        } else {
            r.status = "todo";
        }

        info(`set r.status=${r.status}`, req);
    }
}

async function tryToSell(r, req) {
    debug("tryToSell:" + JSON.stringify(r), req);
    let rule = r.rule;
    let now = Date.now();
    let price = 0;
    if (rule.dip < 0) {
        price = rule.sell;
    } else if (rule.currentPrice >= parseFloat(rule.sell)) {
        debug(`currentPrice > sell`, req);
        if (rule.maxPrice >= parseFloat(rule.sell)) {
            debug(`maxPrice > sell`, req);
            let delta = rule.maxPrice - rule.currentPrice;
            debug(`delta=${delta}`, req);
            if (delta >= parseFloat(rule.dip)) {
                price = rule.currentPrice;
            }
        }
    }
    debug(`price=${price}`, req);
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
        debug(`rules:${JSON.stringify(rules)}`, req);
        return true;
    }

    return false;
}
async function tryToBuy(r, req) {
    debug("tryToBuy:" + JSON.stringify(r), req);
    let rule = r.rule;
    let now = Date.now();
    let buy = 0;
    if (rule.bounce < 0) {
        buy = rule.buy;
    } else if (rule.currentPrice <= parseFloat(rule.buy)) {
        debug(`currentPrice < buy`, req);
        if (rule.minPrice <= parseFloat(rule.buy)) {
            let delta = rule.currentPrice - rule.minPrice;
            debug(`delta=${delta}`, req);
            if (delta >= parseFloat(rule.bounce)) {
                //买入
                buy = rule.currentPrice;
            }
        }
    }
    debug(`buy=${buy}`, req);
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

        if (r.actions.length > 0) {
            let oc = r.actions[r.actions.length - 1].createTime;
            let n = Date.now();
            if (n - oc < 1000) {
                return false;
            }
        }

        await insertOrReplace("tRuleAction", action);
        r.status = "ordered";

        r.actions.push(action);
        return true;
    }

    return false;
}


let checkingRule = 0;
async function checkRule(scodes, req) {
    if (req == null) {
        req = {
            threadId: Date.now()
        }
    }
    if (checkingRule == 1) {
        error("checking", req);
        return;
    }

    checkingRule = 1;
    debug("checkRule start", req);
    let now = Date.now();
    //遍历 scodes 里的每一个元素 scode,检查响应的 rule 是否满足条件，
    for (let i = 0; i < scodes.length; i++) {
        let scode = scodes[i].split(".")[0];
        let rs = rules[scode];
        if (rs != null) {
            Object.values(rs).forEach(async (r) => {
                debug(`checking rule: scode=${scode} status=${r.status}`, req);

                if (r.expireTime != null && r.expireTime < now) {
                    info("expired rule:" + r.scode, req);
                    if (rules[r.scode] && rules[r.scode][r.broker]) {
                        delete rules[r.scode][r.broker];
                    }

                    await db.runSync(`update tRuleAction set done = -1 where ruleId=?`, [r.id]);

                    await db.runSync(`update tTradeRule set closed=1 where id = '${r.id}'`);

                    return;
                }

                switch (r.status) {
                    case "todo":
                        //检查是否满足条件
                        let succ = await tryToBuy(r, req);
                        if (!succ) {
                            succ = await tryToSell(r, req);
                        }
                        break;
                    case "toBuy":
                        await tryToBuy(r, req);
                        break;
                    case "toSell":
                        await tryToSell(r, req);
                        break;
                }
            });
        }
    }

    debug("checkRule end", req);
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

// 对所有请求进行预处理
app.use((req, res, next) => {
    req.threadId = Date.now() + "" + Math.floor(Math.random() * 10000);
    const method = req.method;
    const url = req.url;
    const queryParams = JSON.stringify(req.query);
    const bodyParams = JSON.stringify(req.body);
    info(`${method} ${url}`, req)
    if (method.toLowerCase() == "post") {
        info(`body:${bodyParams}`, req);
    }

    next();
});

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
    info("files=" + req.body.files, req)
    info("tags=" + req.body.tags, req)
    const files = JSON.parse(req.body.files);
    const tags = JSON.parse(req.body.tags);

    let otags = getTags();

    if (files.length == 1) {
        for (var j = 0; j < files.length; ++j) {
            info("file:" + files[j], req)
            Object.keys(otags).map(
                (tag) => {
                    var f = otags[tag];
                    delete f[files[j]];
                }
            );
        }

        info("otags=" + JSON.stringify(otags), req)

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
    let cookies = req.body.cookies;
    info(req.body.cookies, req)

    fs.writeFileSync(path.join(directoryPath, "cookies.txt"), cookies);
    var resp = JSON.stringify({ data: "success" });
    res.send(resp);
});

app.post('/stock/update', async (req, resp) => {
    let broker = req.body.broker;
    if (broker == null) {
        if (fields.length == 12) {
            broker = "广发历史"
        } else if (fields.length == 22) {
            broker = "国信历史"
        } else if (fields.length == 13) {
            broker = "国金历史"
        } else if (fields.length == 15) {
            broker = "国信港股通历史"
        }
    }
    info(broker)
    let data = req.body.rows.split("\n");
    info(data.join("\n"), req)
    let now = new Date().getTime();
    for (var i = 0; i < data.length; ++i) {
        if (data[i].trim() == "") {
            continue;
        }

        var fields = data[i].split("\t");
        let tday = fields[0];
        let ttime = fields[1];
        if (broker == "广发历史") {
            //广发证券
            fields = fields.concat([""]);
            fields[5] = "广发";
            var sql = `insert or ignore into tstock (tday, ttime, sname,scode,operationDirection, operationName,market,tamount,tprice,tcash,tid,taccount, tpair,lastOperationTime) 
        values (?, ?, ?,?, ?, ?,?, ?, ?,?, ?, ?, ?, ?)`;
            let res = await db.runSync(sql, fields.concat([tday + " " + ttime]));
            if (res.error) {
                info(res.error, req)
                resp.send(res);
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
        } else if (broker == "国信历史") {
            //tdx 国信证券
            fields = fields.concat([""]);
            let tday = fields[0];
            let ttime = fields[1];
            let sname = fields[3];
            let scode = fields[2];
            let operationDirection = fields[4];
            let operationName = "国信";
            let market = fields[21];
            let tprice = fields[6];
            let tamount = fields[5];
            let tcash = fields[7];
            let taccount = fields[20];
            let tpair = "";

            scode = fixScode(scode);

            if (ttime.length == 7) {
                ttime = "0" + ttime.substring(0, 1) + ":" + ttime.substring(1, 3) + ":" + ttime.substring(3, 5);
            } else if (ttime.length == 8) {
                ttime = ttime.substring(0, 2) + ":" + ttime.substring(2, 4) + ":" + ttime.substring(4, 6);
            }

            if (operationDirection.indexOf("卖") >= 0 && tamount.substring(0, 1) != "-") {
                tamount = "-" + tamount;
            }

            let tid = `${tday}.${ttime}.${scode}.${tprice}`;
            let lastOperationTime = tday + " " + ttime;

            var sql = `insert or ignore into tstock (tday, ttime, sname,scode,operationDirection, operationName,market,tamount,tprice,
            tcash,tid,taccount, tpair,lastOperationTime) 
        values (?, ?, ?,?, ?, ?,?, ?, ?,?, ?, ?, ?, ?)`;
            let res = await db.runSync(sql, [tday, ttime, sname, scode, operationDirection, operationName, market, tamount, tprice,
                tcash, tid, taccount, tpair, lastOperationTime]);
            if (res.error) {
                info(res.error, req)
                resp.send(res);
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
        } else if (broker == "国信当日") {
            //tdx 国信证券
            fields = fields.concat([""]);
            let tday = timeFormat(new Date(), "yyyyMMdd");
            let ttime = fields[9];
            let sname = fields[1];
            let scode = fields[0];
            let operationDirection = fields[2];
            let operationName = "国信";
            let market = fields[11];
            let tamount = fields[3];
            let tprice = fields[4];
            let tcash = fields[5];
            let taccount = fields[10];
            let tpair = "";

            scode = fixScode(scode);
            if (operationDirection.indexOf("卖") >= 0 && tamount.substring(0, 1) != "-") {
                tamount = "-" + tamount;
            }
            let lastOperationTime = tday + " " + ttime;
            let tid = `${tday}.${ttime}.${scode}.${tprice}`;

            var sql = `insert or ignore into tstock (tday, ttime, sname,scode,operationDirection, operationName,market,tamount,tprice,
            tcash,tid,taccount, tpair,lastOperationTime) 
        values (?, ?, ?,?, ?, ?,?, ?, ?,?, ?, ?, ?, ?)`;

            let res = await db.runSync(sql, [tday, ttime, sname, scode, operationDirection, operationName, market, tamount, tprice,
                tcash, tid, taccount, tpair, lastOperationTime]);
            if (res.error) {
                info(res.error, req)
                resp.send(res);
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
        } else if (broker == "国金历史") {
            //tdx 国金证券
            fields = fields.concat([""]);
            var sql = `insert or ignore into tstock (tday, ttime, sname,scode,operationDirection, operationName,market,tamount,tprice,
            tcash,tid,taccount, tpair,lastOperationTime) 
        values (?, ?, ?,?, ?, ?,?, ?, ?,?, ?, ?, ?, ?)`;

            let res = await db.runSync(sql, [tday, ttime, fields[3], fields[2], fields[5], "国金", fields[11], fields[7], fields[6],
                fields[8], fields[9], fields[11], '', tday + " " + ttime]);
            if (res.error) {
                info(res.error, req)
                resp.send(res);
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
        } else if (broker == "国金港股通历史") {
            fields = fields.concat([""]);
            let tday = fields[0];
            let ttime = fields[2];
            let sname = fields[5];
            let scode = fields[4];
            let operationDirection = fields[7];
            let operationName = "国金";
            let market = "HK";
            let tprice = fields[8];
            let tamount = fields[11];
            let tcash = fields[12];
            let taccount = fields[3];
            let tpair = "";

            scode = fixScode(scode);

            if (ttime.length == 7) {
                ttime = "0" + ttime.substring(0, 1) + ":" + ttime.substring(1, 3) + ":" + ttime.substring(3, 5);
            } else if (ttime.length == 8) {
                ttime = ttime.substring(0, 2) + ":" + ttime.substring(2, 4) + ":" + ttime.substring(4, 6);
            }

            if (operationDirection.indexOf("卖") >= 0 && tamount.substring(0, 1) != "-") {
                tamount = "-" + tamount;
            }

            let tid = `${tday}.${ttime}.${scode}.${tprice}`;
            let lastOperationTime = tday + " " + ttime;

            var sql = `insert or ignore into tstock (tday, ttime, sname,scode,operationDirection, operationName,market,tamount,tprice,
            tcash,tid,taccount, tpair,lastOperationTime) 
        values (?, ?, ?,?, ?, ?,?, ?, ?,?, ?, ?, ?, ?)`;
            let res = await db.runSync(sql, [tday, ttime, sname, scode, operationDirection, operationName, market, tamount, tprice,
                tcash, tid, taccount, tpair, lastOperationTime]);
            if (res.error) {
                info(res.error, req)
                resp.send(res);
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
        } else if (broker == "国金当日") {
            //tdx 国金证券
            fields = fields.concat([""]);
            var sql = `insert or ignore into tstock (tday, ttime, sname,scode,operationDirection, operationName,market,tamount,tprice,
            tcash,tid,taccount, tpair,lastOperationTime) 
        values (?, ?, ?,?, ?, ?,?, ?, ?,?, ?, ?, ?, ?)`;
            let tday = timeFormat(new Date(), "yyyyMMdd");
            let ttime = fields[0];
            let res = await db.runSync(sql, [tday, ttime, fields[2], fields[1], fields[4], "国金", getMarket(fields[1]), fields[7], fields[6],
                fields[8], fields[9], fields[11], '', tday + " " + ttime]);
            if (res.error) {
                info(res.error, req)
                resp.send(res);
                return;
            } else {
            }

            await insertOrReplace("tStockBasic", {
                id: fields[1],
                scode: fields[1],
                sname: fields[2],
                buy: fields[5],
                updateTime: now
            });
        } else if (broker == "国金qmt成交") {
            //国金qmt成交
            fields = fields.concat([""]);
            var sql = `insert or replace into tstock (tday, ttime, sname,scode,operationDirection, operationName,market,tamount,tprice,
            tcash,tid,taccount, tpair,lastOperationTime) 
        values (?, ?, ?,?, ?, ?,?, ?, ?,?, ?, ?, ?, ?)`;
            let tday = timeFormat(new Date(), "yyyyMMdd");
            let ttime = fields[0];
            let res = await db.runSync(sql, [tday, ttime, fields[3], fields[2], fields[4], "国金", getMarket(fields[2]), fields[6], fields[5],
                fields[7], fields[8], fields[1], '', tday + " " + ttime]);
            if (res.error) {
                info(res.error, req)
                resp.send(res);
                return;
            } else {
            }
            await insertOrReplace("tStockBasic", {
                id: fields[1],
                scode: fields[1],
                sname: fields[2],
                buy: fields[5],
                updateTime: now
            });
        } else if (broker == "广发当日") {
            //tdx 国金证券
            fields = fields.concat([""]);
            var sql = `insert or ignore into tstock (tday, ttime, sname,scode,operationDirection, operationName,market,tamount,tprice,
            tcash,tid,taccount, tpair,lastOperationTime) 
        values (?, ?, ?,?, ?, ?,?, ?, ?,?, ?, ?, ?, ?)`;
            let tday = timeFormat(new Date(), "yyyyMMdd");
            let ttime = fields[0];

            // let res = await db.runSync(sql, [tday, ttime, fields[1], fields[2], fields[3], "广发", getMarket(fields[2]), fields[4], fields[5],
            // fields[6], tday + " " + ttime, fields[7], '', tday + " " + ttime]);

            //将上面代码改成先组装对象再调用insertOrReplace的模式
            let obj = {
                tday: tday,
                ttime: ttime,
                sname: fields[1],
                scode: fields[2],
                operationDirection: fields[3],
                operationName: "广发",
                market: getMarket(fields[2]),
                tamount: fields[4],
                tprice: fields[5],
                tcash: fields[6],
                tid: tday + " " + ttime,
                taccount: fields[7],
                tpair: "",
                lastOperationTime: tday + " " + ttime
            }

            let res = await insertOrReplace("tstock", obj);



            if (res.error) {
                info(res.error, req)
                resp.send(res);
                return;
            } else {
            }

            await insertOrIgnore("tStockBasic", {
                id: fields[2],
                scode: fields[2],
                sname: fields[1],
                buy: fields[5],
                updateTime: now
            });
        } else if (broker == "国金港股通当日") {
            //tdx 国金证券
            fields = fields.concat([""]);
            var sql = `insert or ignore into tstock (tday, ttime, sname,scode,operationDirection, operationName,market,tamount,tprice,
            tcash,tid,taccount, tpair,lastOperationTime) 
        values (?, ?, ?,?, ?, ?,?, ?, ?,?, ?, ?, ?, ?)`;

            let res = await db.runSync(sql, [tday, ttime, fields[6], fields[5], fields[8], "国金", "HGT", fields[10], fields[9],
                fields[11], fields[12], fields[3], '', tday + " " + ttime]);
            if (res.error) {
                info(res.error, req)
                resp.send(res);
                return;
            } else {
            }

            await insertOrReplace("tStockBasic", {
                id: fields[5],
                scode: fields[5],
                sname: fields[6],
                buy: fields[6],
                updateTime: now
            });
        } else if (broker == "国信港股通历史") {
            let tday = fields[1];
            let ttime = fields[2];
            let sname = fields[5];
            let scode = fields[4];
            let operationDirection = fields[6];
            let operationName = "国信";
            let market = fields[0];
            let tprice = fields[9];
            let tamount = fields[10];
            let tcash = fields[11];
            let taccount = fields[14];
            let tpair = "";

            scode = fixScode(scode, 5);

            if (ttime.length == 7) {
                ttime = "0" + ttime.substring(0, 1) + ":" + ttime.substring(1, 3) + ":" + ttime.substring(3, 5);
            } else if (ttime.length == 8) {
                ttime = ttime.substring(0, 2) + ":" + ttime.substring(2, 4) + ":" + ttime.substring(4, 6);
            }

            if (operationDirection.indexOf("卖") >= 0 && tamount.substring(0, 1) != "-") {
                tamount = "-" + tamount;
            }

            let tid = `${tday}.${ttime}.${scode}.${tprice}`;
            let lastOperationTime = tday + " " + ttime;

            var sql = `insert or ignore into tstock (tday, ttime, sname,scode,operationDirection, operationName,market,tamount,tprice,
            tcash,tid,taccount, tpair,lastOperationTime) 
        values (?, ?, ?,?, ?, ?,?, ?, ?,?, ?, ?, ?, ?)`;
            let res = await db.runSync(sql, [tday, ttime, sname, scode, operationDirection, operationName, market, tamount, tprice,
                tcash, tid, taccount, tpair, lastOperationTime]);
            if (res.error) {
                info(res.error, req)
                resp.send(res);
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



        }
    };

    let r = await db.allSync("select max(lastOperationTime) as maxOperationTime, scode from tstock group by scode");
    info(`${r.rows.length} stocks`, req)
    for (var i = 0; i < r.rows.length; ++i) {
        let row = r.rows[i];
        let scode = row.scode;
        let maxOperationTime = row.maxOperationTime;
        info(`updating ${scode} to ${maxOperationTime}`, req)
        let sql = `update tstock set lastOperationTime=? where scode=?`;
        await db.runSync(sql, [maxOperationTime, scode]);
    }

    var res = JSON.stringify({ data: "success" });
    resp.send(res);
});

app.get('/stock/account', async (req, res) => {
    let js = req.query.js;

    let sql = `select * from config where key='stockAccount' `;
    let r = await db.getSync(sql);

    var resp = `${js}(${r.value})`;
    res.send(resp);
});

app.get('/stock/vote', async (req, res) => {
    let js = req.query.js;
    let code = req.query.code;
    let sql = `update tstock set lastOperationTime=? where scode=? `;
    let now = timeFormat(new Date(), "yyyyMMdd hh:mm:ss");
    await db.runSync(sql, [now, code]);
    await db.runSync(`update tStockBasic set priority=? where scode=?`, [new Date().getTime(), code]);
    await db.runSync(`update tTradeRule set createTime=? where scode=?`, [new Date().getTime(), code]);
    var resp = `${js}({})`;
    res.send(resp);
});


app.get('/stock/updatePrice', async (req, res) => {
    let js = req.query.js;
    let scode = req.query.scode;
    let price = req.query.price;
    let time = req.query.time;
    if (time == null) {
        time = Date.now();
    }

    updatePriceToRule(scode, price);
    let sql = `update tStockBasic set buy=?, updateTime=? where id=?`;
    await db.runSync(sql, [price, time, scode]);
    checkRule([scode], req);
    var resp = `${js}({})`;
    res.send(resp);
});

app.get('/stock/updatePrice/option', async (req, res) => {
    let js = req.query.js;
    let scode = req.query.scode;
    let price = req.query.price;
    let time = req.query.time;
    if (time == null) {
        time = Date.now();
    }

    //updatePriceToRule(scode, price);

    let sql = `update tStockBasic set optionPrice=?, optionUpdateTime=? where id=?`;
    await db.runSync(sql, [price, time, scode]);
    //checkRule([scode]);
    var resp = `${js}({})`;
    res.send(resp);
});

app.get('/stock/deleteRow', async (req, res) => {
    let js = req.query.js;
    let tid = req.query.tid;
    let id = req.query.id;
    let force = req.query.force;
    let table = req.query.table;
    if (id && table) {
        let sql = `delete from ${table} where id=? `;
        await db.runSync(sql, [id]);
    } else if (force) {
        let sql = `delete from tstock where tid=? `;
        await db.runSync(sql, [tid]);
    } else {
        let sql = `update tstock set deleted=1 where tid=? `;
        await db.runSync(sql, [tid]);
    }

    var resp = `${js}({})`;
    res.send(resp);
});

app.get('/stock/undeleteRow', async (req, res) => {
    let js = req.query.js;
    let tid = req.query.tid;
    let id = req.query.id;
    let table = req.query.table;
    let sql = `update tstock set deleted=0, tpair="" where tid=? `;
    await db.runSync(sql, [tid]);

    var resp = `${js}({})`;
    res.send(resp);
});

app.post('/stock/account', async (req, res) => {
    info(JSON.stringify(req.body), req)
    let passcode = req.body.passcode;
    if (passcode != "995560") {
        info("bad request", req)
        res.send("bad request");
        return;
    }
    let data = req.body.data;
    info(data, req)
    let sql = `insert or replace into config (key, value) values (?,?)`;
    let result = await db.runSync(sql, ["stockAccount", JSON.stringify(data)]);
    var resp = JSON.stringify({ data: "success" });
    res.send(resp);
});


function fixScode(scode, minLength) {
    if (minLength == null) {
        minLength = 6;
    }
    if (scode.length < minLength) {
        scode = "000000".substring(0, minLength - scode.length) + scode;
    }

    return scode;
}

async function dbCall(options) {
    for (let i = 0; i < options.length; ++i) {
        let stat = options[i];
        if (isArray(stat)) {
            let sql = stat[0];
            let params = stat[1];
            debug("dbCall sql:" + sql);
            debug("params:" + JSON.stringify(params));
            let res = await db.runSync(sql, params);
            if (res.error) {
                return res;
            }
        } else {
            debug("sql:" + stat);
            let res = await db.runSync(stat);
            if (res.error) {
                return res;
            }
        }
    }

    return {};
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
        `create table tRuleAction(id text primary key, ruleId text, scode text, sname text, action text, price real, amount real, orderNo text, done int default 0, createTime integer);`,
        "update config set value='17' where key='dbVersion';",
        `alter table tTradeRule add column closed integer default 0;`,
        "update config set value='19' where key='dbVersion';",
        `alter table tRuleAction add column broker text default '';`,
        "update config set value='21' where key='dbVersion';",
        `alter table tRuleAction add column status text default '';`,
        "update config set value='23' where key='dbVersion';",
        `create table ttick(id text primary key, scode text, time int, data text);`,
        "update config set value='25' where key='dbVersion';",
        `create table t1d(id text primary key, scode text, time text, open real, close real, high real, low real, volume int, amount real);`,
        "update config set value='27' where key='dbVersion';",
        `create table t1m(id text primary key, scode text, time text, open real, close real, high real, low real, volume int, amount real);`,
        "update config set value='29' where key='dbVersion';",
        `create table t5m(id text primary key, scode text, time text, open real, close real, high real, low real, volume int, amount real);`,
        "update config set value='31' where key='dbVersion';",
        `alter table tpositions add column floatProfit real default 0;`,
        "update config set value='33' where key='dbVersion';",
        `/* The code you provided is not valid JavaScript code. It appears to be a mix of SQL and some
        other characters that are not recognized in JavaScript. */
        alter table tstockbasic add column priority int default 0;`,
        "update config set value='35' where key='dbVersion';",
        `create table tallstock(id text primary key, scode text, sname text, sector text, priority int default 0, updateTime integer);`,
        "update config set value='37' where key='dbVersion';",
        `create table tcandidate(id text primary key, scode text, sname text, priority int default 0, updateTime integer);`,
        "update config set value='39' where key='dbVersion';",
        `alter table tStockBasic add column volumeMultiple int default 100;`,
        "update config set value='41' where key='dbVersion';",
        `alter table tStockBasic add column upStopPrice real default 0;`,
        "update config set value='43' where key='dbVersion';",
        `alter table tStockBasic add column downStopPrice real default 0;`,
        "update config set value='45' where key='dbVersion';",
        `alter table tStockBasic add column totalVolume real default 0;`,
        "update config set value='47' where key='dbVersion';",
        `alter table tStockBasic add column floatVolume real default 0;`,
        "update config set value='49' where key='dbVersion';",
        `alter table tTradeRule add column broker text;`,
        "update config set value='51' where key='dbVersion';",
        `alter table tStockBasic add column bNotProfitable real default 0;`,
        "update config set value='53' where key='dbVersion';",
        `alter table tStockBasic add column market text;`,
        "update config set value='55' where key='dbVersion';",
        `alter table tStockBasic add column LastVolume real,add column TotalVolume real,add column FloatVolume real,add column UpStopPrice real,add column DownStopPrice real,add column VolumeMultiple int;`,
        "update config set value='57' where key='dbVersion';",
        `alter table tStockBasic add column LastVolume real;`,
        "update config set value='59' where key='dbVersion';",
        `alter table tStock add column deleted int default 0;`,
        "update config set value='61' where key='dbVersion';",
        `alter table tStockBasic add column optionPrice real;`,
        "update config set value='63' where key='dbVersion';",
        `alter table tStock add column type int default 0;`,
        "update config set value='65' where key='dbVersion';",
        `alter table tStockBasic add column optionUpdateTime int;`,
        "update config set value='67' where key='dbVersion';",
        `alter table t1m add column type int default 0;`,
        "update config set value='69' where key='dbVersion';",
        `alter table t1d add column type int default 0;`,
        "update config set value='71' where key='dbVersion';",
        `alter table tpositions add column type int default 0;`,
        "update config set value='73' where key='dbVersion';",
        `alter table tTradeRule add column expireTime int;`,
        "update config set value='75' where key='dbVersion';",
        `alter table tStockBasic add column autoCreateRuleFail text;`,
        "update config set value='77' where key='dbVersion';",
    ];

    if (res == null || res.error) {
        res = await db.runSync(`CREATE TABLE tstock (
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

        await db.runSync(`CREATE TABLE tsql (
        id text primary key,
        name text,
        sql text,
        lastUseTime integer);`);

        await db.runSync(`CREATE TABLE tStockBasic (
        id text primary key,
        scode text,
        sname text,
        buy real default 0,
        sell real default 0,
        updateTime integer);`);

        await db.runSync("insert into config values('dbVersion', 1);");

        updates.forEach(async (sql, i) => {
            let res = await db.runSync(sql);
            if (res.error) {
                error(res.error);
                return res;
            }
        });

    } else {
        debug(JSON.stringify(res));

        var ver = res.value;
        updates.splice(0, parseInt(ver));

        if (updates.length > 0) {
            let res = await dbCall(updates);
            if (res.error) {
                error(res.error);
                return res;
            }
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
    debug("insertOrReplace:" + table);
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
    debug("insertOrIgnore:" + table);
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

    let root = req.body;
    let children = root.children;
    delete root["children"];
    info(JSON.stringify(root), req)
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
        debug(`getChildProperty:${path}.${key}`, req);
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
        debug("isGfStatus", req);
        var node = findNodeById(root, "com.gf.client:id/refresh_child");
        if (node) {
            debug("refresh_child found", req);
            for (let i = 0; ; i++) {
                let sname = getChildProperty(node, `1.${i}.0.0.0`, "text");
                let scode = getChildProperty(node, `1.${i}.0.0.1.0`, "text");
                let price = getChildProperty(node, `2.1.2.${i * 4}.0`, "text");
                let delta = getChildProperty(node, `2.1.2.${i * 4 + 1}.0`, "text");
                let ratio = getChildProperty(node, `2.1.2.${i * 4 + 2}.0.0`, "text");
                let ratio1 = getChildProperty(node, `2.1.2.${i * 4 + 3}.0`, "text");
                scodes.push(scode);
                debug(`${i}:${sname}(${scode}),${price},${delta},${ratio},${ratio1}`, req);
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

app.post('/stock/basic/update', async (req, res) => {
    let sector = req.sector;
    let stocks = req.data;
    for (let i = 0; i < stocks.length; i++) {
        let stock = stocks[i];
        let now = Date.now();
        stock.id = `${stock.scode}`;
        stock.updateTime = now;
        await insertOrReplace("tAllStock", stock);
    }

    let resp = JSON.stringify({ action: [] });
    res.send(resp);
});

app.post('/stock/candidates', async (req, res) => {
    let stocks = req.body.data;
    if (stocks.length == 0) {
        await dbCall([`delete from tcandidate`]);
    }
    for (let i = 0; i < stocks.length; i++) {
        let stock = stocks[i];
        let now = Date.now();
        let scode = stock[0].split(".")[0];
        let row = {
            id: scode,
            scode: scode,
            sname: stock[1],
            priority: 0,
            updateTime: now
        }
        await insertOrReplace("tcandidate", row);
    }

    let resp = JSON.stringify({});
    res.send(resp);
});

app.post('/stock/positions', async (req, res) => {

    info(JSON.stringify(req.body), req)
    let passcode = req.body.passcode;
    if (passcode != "995560") {
        info("bad request", req)
        res.send("bad request");
        return;
    }
    let broker = req.body.broker;
    let clean = req.body.clean;
    if (broker && clean) {
        await dbCall([`delete from tPositions where id like '${broker}%'`]);
    }


    let positions = req.body.data;
    if (positions == null) {
        positions = [];
    }

    let type = req.body.type;
    if (type == null) {
        type = 0;
    }
    for (let i = 0; i < positions.length; i++) {
        let pos = positions[i];
        let now = Date.now();

        pos.stock_code = pos.stock_code.split(".")[0]
        pos.id = `${pos.broker}_${pos.account_id}_${pos.stock_code}_${type}`;
        pos.updateTime = now;
        pos.type = type;
        await insertOrReplace("tPositions", pos);
    }

    let resp = JSON.stringify({});
    res.send(resp);
});

app.get('/stock/positions', async (req, res) => {

    let js = req.query.js;
    let scode = req.query.scode;
    var resp = null;
    if (scode == null) {
        resp = await db.allSync(`select * from tPositions`);
        resp = JSON.stringify({ data: resp.rows });
    } else {
        resp = await db.allSync(`select * from tPositions where stock_code=?`, [scode]);
        resp = JSON.stringify({ data: resp.rows });
    }
    if (js) {
        resp = `${js}(${resp})`;
    }

    res.send(resp);

});

app.get('/stock/trades', async (req, res) => {

    let js = req.query.js;
    let scode = req.query.scode;
    let all = req.query.all;
    let type = req.query.type;
    if (type == null) {
        type = 0;
    }
    var resp = null;
    if (scode == null) {
        resp = await db.allSync(`select * from tstock`);
        resp = JSON.stringify({ data: resp.rows });
    } else {
        let sql = `select * from tstock where scode=? and type=? and deleted=0 order by tday desc, ttime desc`;
        if (all == 1) {
            sql = `select * from tstock where scode=? and type=? order by tday desc, ttime desc`;
        }
        resp = await db.allSync(sql, [scode, type]);
        resp = JSON.stringify({ data: resp.rows });
    }
    if (js) {
        resp = `${js}(${resp})`;
    }

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
    //{"data":{"837092.BJ":{"20250523101631.000":{"amount":10865500,"askPrice":[42.86,42.87,42.88,42.9,42.92],"askVol":[59,4,20,1,30],"bidPrice":[42.66,42.65,42.64,42.63,42.62],"bidVol":[2,2,10,32,26],"high":43.24,"lastClose":42.76,"lastPrice":42.65,"lastSettlementPrice":0,"low":42.41,"open":42.41,"openInt":13,"pvolume":253700,"settlementPrice":0,"stime":"20250523101631.000","stockStatus":1,"time":1747966591000,"transactionNum":0,"volume":2537}}}}
    info(JSON.stringify(req.body), req)
    let passcode = req.body.passcode;
    if (passcode != "995560") {
        info("bad request", req)
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
            let price = v1.lastPrice;
            if (price == 0) {

            } else {
                updatePriceToRule(scode, price);
                let sql = `update tStockBasic set buy=?,updateTime=? where id=?`;
                await db.runSync(sql, [price, updateTime, scode]);

                delete v1["stime"];
                delete v1["pvolume"];
                delete v1["lastSettlementPrice"];
                delete v1["settlementPrice"];
                let min = new Date(v1.time);
                min.setSeconds(0, 0);
                min = min.getTime();
                await insertOrReplace("ttick", {
                    id: `${scode}_${min}`,
                    scode: scode,
                    time: min,
                    data: JSON.stringify(v1)
                });
            }
        })
    })

    setTimeout(function () { checkRule(Object.keys(data)) }, 100);

    res.send("ok");
});

app.post('/stock/quotes.mini', async (req, res) => {

    info(JSON.stringify(req.body), req)
    let passcode = req.body.passcode;
    if (passcode != "995560") {
        info("bad request", req)
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

app.post('/stock/details', async (req, res) => {

    info(JSON.stringify(req.body), req)
    let passcode = req.body.passcode;
    if (passcode != "995560") {
        info("bad request", req)
        res.send("bad request");
        return;
    }

    let data = req.body.data;
    let updateTime = Date.now();
    data.forEach(async (row) => {
        let sql = `update tStockBasic set sname=?, market=?, LastVolume=?, TotalVolume=?, FloatVolume=?,    UpStopPrice=?,   DownStopPrice=?,   VolumeMultiple=?,updateTime=? where scode=?`;
        await db.runSync(sql, [row.sname, row.ExchangeID, row.LastVolume, row.TotalVolume, row.FloatVolume, row.UpStopPrice, row.DownStopPrice, row.VolumeMultiple, updateTime, row.scode.split(".")[0]]);
    })

    if (data.length < 1) {
        await db.runSync(`UPDATE tstock 
                    SET sname = (SELECT tsb.sname FROM tStockBasic tsb WHERE tsb.scode = tstock.scode)
                    WHERE EXISTS (SELECT 1 FROM tStockBasic tsb WHERE tsb.scode = tstock.scode);`, []);
    }

    res.send("ok");
});

app.get('/stock/screen/nodes', async (req, res) => {
    let js = req.query.js;
    let log = req.query.log;
    if (log) {
        info("logLevel to " + log, req)
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
    let js = req.query.js;
    let json = JSON.parse(req.query.json);
    let now = Date.now();

    let sql = `insert or replace into tTradeRule(id, broker, scode, sname, rule, createTime, expireTime) values(?,?,?,?,?,?,?)`;
    let broker = json.broker;
    let calc = eval(json.expireHours);
    let expireHours = parseFloat(calc);
    let expireTime = now + expireHours * 60 * 60 * 1000;
    let id = `${json.scode}.${broker}`;
    let result = await db.runSync(sql, [id, broker, json.scode, json.sname, JSON.stringify(json), now, expireTime]);
    await db.runSync(`delete from tRuleAction where scode=? and broker=?`, [json.scode, broker]);
    if (rules[json.scode] == null) {
        rules[json.scode] = {};
    }

    rules[json.scode][broker] = await db.getSync(`select * from tTradeRule where scode=? and broker=?`, [json.scode, broker]);
    await reloadRule(rules[json.scode][broker], req);

    let market = getMarket(json.scode);
    let buy = 0;
    if (rules[json.scode][broker] && rules[json.scode][broker].rule) {
        buy = rules[json.scode][broker].rule.currentPrice;
    }
    await insertOrReplace("tStockBasic", {
        id: json.scode,
        scode: json.scode,
        sname: json.sname,
        market: market,
        buy: buy,
        priority: now,
        updateTime: now
    });

    if (json.order == "buyFirst") {
        let r = await db.allSync(`select * from tStock where scode=? and deleted=0 and tamount<>0`, [json.scode]);
        if (r.rows.length == 0) {
            let tday = timeFormat(now, "yyyyMMdd");
            let ttime = timeFormat(now, "hh:mm:ss");
            let obj = {
                tday,
                ttime,
                sname: json.sname,
                scode: json.scode,
                operationDirection: "买入",
                operationName: broker,
                market: market,
                tamount: 0,
                tprice: json.buy,
                tcash: 0,
                tid: `${json.scode}.${json.sname}`,
                taccount: "",
                tpair: "",
                deleted: 0,
                lastOperationTime: tday + " " + ttime
            }
            await insertOrReplace("tstock", obj);
            await db.runSync(`update tStock set lastOperationTime=? where scode=?`, [obj.lastOperationTime, obj.scode]);
        }
    }

    var resp = JSON.stringify({});
    if (result.error) {
        resp = JSON.stringify(result);
    }

    if (js) {
        resp = `${js}(${resp})`;
    }

    res.send(resp);
});

function setBuyPriceBySell(rc, maxDelta) {
    rc.buy = rc.sell * (1 - 0.02);
    if (rc.sell - rc.buy > maxDelta) {
        rc.buy = rc.sell - maxDelta;
    }

    //rc.buy取小数点后3位
    rc.buy = parseFloat(rc.buy.toFixed(3));
    //rc.sell取小数点后3位
    rc.sell = parseFloat(rc.sell.toFixed(3));
}

function setSellPriceByBuy(rc, maxDelta) {
    rc.sell = rc.buy * (1 + 0.02);
    if (rc.sell - rc.buy > maxDelta) {
        rc.sell = rc.buy + maxDelta;
    }
    //rc.buy取小数点后3位
    rc.buy = parseFloat(rc.buy.toFixed(3));
    //rc.sell取小数点后3位
    rc.sell = parseFloat(rc.sell.toFixed(3));
}

async function autoCreateRules() {
    let threadId = Date.now();
    try {
        let sql = `select * from tStockBasic`;
        if (workerCreateRule.scode) {
            sql = `select * from tStockBasic where scode='${workerCreateRule.scode}'`;
        }

        let res = await db.allSync(sql);
        let total = 0;

        for (let i = 0; i < res.rows.length; ++i) {
            if (total >= workerCreateRule.max) {
                break;
            }

            let stockBasicInfo = res.rows[i];
            let scode = stockBasicInfo.scode;
            let sname = stockBasicInfo.sname;

            let result = await autoCreateRule(scode, threadId, stockBasicInfo);
            if (result.error == null) {
                await saveCreateRuleFailure(scode, "");
                workerCreateRule.succeeded.push({ scode, sname });
                total++;
            } else {
                info(result.error, { threadId }, workerCreateRule.logs, 5);
                await saveCreateRuleFailure(scode, result.error);
                workerCreateRule.failed.push({ scode, sname, reason: result.error });
            }
        }

        info(`auto create rule succeeded`, { threadId }, workerCreateRule.logs, 5);
    } catch (e) {
        error(e.message, { threadId });
        error(e.stack, { threadId });
        info(`auto create rule failed:${e}`, { threadId }, workerCreateRule.logs, 5);
    }

    reloadRules();

    workerCreateRule.id = 0;
    workerCreateRule.scode = null;
}

app.get('/stock/rule/create/auto', async (req, res) => {
    let js = req.query.js;
    let max = req.query.max;
    let type = req.query.type;
    let scode = req.query.scode;
    let priceDelay = req.query.priceDelay;
    if (!max) {
        max = 1;
    }
    if (!priceDelay) {
        priceDelay = 30;
    }
    let logs = [];
    let succeeded = [];
    let failed = [];
    if (workerCreateRule.id == 0) {
        if (workerCreateRule.succeeded.length + workerCreateRule.failed.length == 0) {
            workerCreateRule.max = max;
            workerCreateRule.type = type;
            workerCreateRule.priceDelay = priceDelay;
            if (scode == null) {
                workerCreateRule.id = setTimeout(autoCreateRules, 100);
                logs = ["autoCreateRule started"];
            } else {
                workerCreateRule.scode = scode;
                await autoCreateRules();
                workerCreateRule.scode = null;
                succeeded = workerCreateRule.succeeded;
                workerCreateRule.succeeded = [];
                failed = workerCreateRule.failed;
                workerCreateRule.failed = [];
            }
        } else {
            logs = workerCreateRule.logs;
            workerCreateRule.logs = [];
            succeeded = workerCreateRule.succeeded;
            workerCreateRule.succeeded = [];
            failed = workerCreateRule.failed;
            workerCreateRule.failed = [];
        }
    } else {
        logs = workerCreateRule.logs;
        succeeded = workerCreateRule.succeeded;
        failed = workerCreateRule.failed;
    }

    var resp = JSON.stringify({
        succeeded: succeeded,
        failed: failed,
        logs
    });
    if (js) {
        resp = `${js}(${resp})`;
    }

    res.send(resp);
});

app.get('/stock/k/1m', async (req, res) => {
    let js = req.query.js;
    info(JSON.stringify(req.query), req)
    let scode = req.query.scode;
    let type = req.query.type;
    let day = req.query.day;
    if (day == null) {
        day = new Date();
        //day.setMonth(4, 30);
    } else {
        day = new Date(parseInt(day));
    }

    await wss.callFunc("国金", "forceUpdate1m", { scode: formatScode(scode) });
    day.setHours(0, 0, 0, 0);
    let nextDay = new Date(day.getTime() + 24 * 60 * 60 * 1000);
    day = timeFormat(day, "yyyyMMdd")
    nextDay = timeFormat(nextDay, "yyyyMMdd")
    let sql = `select * from t1m where scode=? and type=? and time > ? and time < ? order by scode, time`;
    let result = await db.allSync(sql, [scode, type, day, nextDay]);

    var resp = JSON.stringify(result.rows);
    if (result.error) {
        resp = JSON.stringify(result);
    }

    if (js) {
        resp = `${js}(${resp})`;
    }

    res.send(resp);
});

app.get('/stock/reload/k1d', async (req, res) => {
    let js = req.query.js;
    info(JSON.stringify(req.query), req)
    let scode = req.query.scode;
    let broker = req.query.broker;
    let now = Date.now();
    let action = {
        id: `${scode}-reloadK1d`,
        ruleId: scode,
        scode: scode,
        sname: scode,
        action: "reloadK1d",
        broker: broker,
        price: 0,
        amount: 0,
        orderNo: "",
        done: 0,
        createTime: now
    }

    let result = await insertOrReplace("tRuleAction", action);


    var resp = JSON.stringify({});
    if (result && result.error) {
        resp = JSON.stringify(result);
    }

    if (js) {
        resp = `${js}(${resp})`;
    }

    res.send(resp);
});

app.get('/stock/k/1d', async (req, res) => {
    let js = req.query.js;
    info(JSON.stringify(req.query), req)
    let scode = req.query.scode;
    let type = req.query.type;
    let startDay = req.query.startDay;
    let endDay = req.query.endDay;
    if (endDay == null) {
        endDay = new Date();
        //day.setMonth(4, 30);
    } else {
        endDay = new Date(parseInt(endDay));
    }

    if (startDay == null) {
        startDay = new Date();
        startDay.setYear(endDay.getFullYear() - 4);
        //day.setMonth(4, 30);
    } else {
        startDay = new Date(parseInt(startDay));
    }

    startDay = timeFormat(startDay, "yyyyMMdd");
    endDay = timeFormat(endDay, "yyyyMMdd");

    await wss.callFunc("国金", "forceUpdate1d", { scode: formatScode(scode) });

    let sql = `select * from t1d where scode=? and type=? and time >= ? and time <= ? order by scode,time`;
    let result = await db.allSync(sql, [scode, type, startDay, endDay]);

    var resp = JSON.stringify(result.rows);
    if (result.error) {
        resp = JSON.stringify(result);
    }

    if (js) {
        resp = `${js}(${resp})`;
    }

    res.send(resp);
});

app.get('/stock/k/1ds', async (req, res) => {
    let js = req.query.js;
    info(JSON.stringify(req.query), req)
    let scodes = req.query.scodes;
    let type = req.query.type;
    let startDay = req.query.startDay;
    let endDay = req.query.endDay;
    if (endDay == null) {
        endDay = new Date();
        //day.setMonth(4, 30);
    } else {
        endDay = new Date(parseInt(endDay));
    }

    if (startDay == null) {
        startDay = new Date(endDay.getTime() - 30 * 24 * 60 * 60 * 1000);
        //day.setMonth(4, 30);
    } else {
        startDay = new Date(parseInt(startDay));
    }

    startDay = timeFormat(startDay, "yyyyMMdd");
    endDay = timeFormat(endDay, "yyyyMMdd");

    let sql = `select * from t1d where scode in ('${scodes.split(',').join("','")}') and type=? and time >= ? and time <= ? order by scode,time`;
    let result = await db.allSync(sql, [type, startDay, endDay]);

    var resp = JSON.stringify(result.rows);
    if (result.error) {
        resp = JSON.stringify(result);
    }

    if (js) {
        resp = `${js}(${resp})`;
    }

    res.send(resp);
});

app.get('/stock/k/1ms', async (req, res) => {
    let js = req.query.js;
    info(JSON.stringify(req.query), req)
    let scodes = req.query.scodes;
    let type = req.query.type;
    let day = req.query.day;
    if (day == null) {
        day = new Date();
        //day.setMonth(4, 30);
    } else {
        day = new Date(parseInt(day));
    }

    day.setHours(0, 0, 0, 0);
    let nextDay = new Date(day.getTime() + 24 * 60 * 60 * 1000);
    day = timeFormat(day, "yyyyMMdd")
    nextDay = timeFormat(nextDay, "yyyyMMdd")

    let sql = `select * from t1m where scode in ('${scodes.split(',').join("','")}') and type=? and time >= ? and time <= ? order by scode,time`;
    let result = await db.allSync(sql, [type, day, nextDay]);

    var resp = JSON.stringify(result.rows);
    if (result.error) {
        resp = JSON.stringify(result);
    }

    if (js) {
        resp = `${js}(${resp})`;
    }

    res.send(resp);
});

app.get('/stock/rule/cancel', async (req, res) => {
    info(JSON.stringify(req.query), req)
    let js = req.query.js;
    let scode = req.query.scode;
    let broker = req.query.broker;
    let all = req.query.all;
    let now = Date.now();
    if (rules[scode] && rules[scode][broker]) {
        rules[scode][broker].closed = 1;
    }
    let ruleId = getRuleId(scode, broker);
    let sql = `update tTradeRule set closed = 1 where id=?`;
    let params = [ruleId];

    let cancelled = ruleId;

    if (all == 1) {
        sql = `update tTradeRule set closed = 1`;
        cancelled = "1";
        params = [];
    } else if (all == "A股") {
        sql = `update tTradeRule set closed = 1 where scode in (select scode from tstockbasic where market in ('BJ','SH',"SZ"))`;
        cancelled = "";
        params = [];
    } else if (all == "H股") {
        sql = `update tTradeRule set closed = 1 where scode in (select scode from tstockbasic where market in ('HK'))`;
        cancelled = "";
        params = [];
    } else if (all == "BNB") {
        sql = `update tTradeRule set closed = 1 where scode in (select scode from tstockbasic where market in ('EC'))`;
        cancelled = "";
        params = [];
    }

    let result = await db.runSync(sql, params);

    if (result.error == null) {
        if (all == 1) {
            sql = `update tRuleAction set done = -1 `;
            result = await db.runSync(sql, []);
        } else if (all == "A股") {
            sql = `update tRuleAction set done = -1 where scode in (select scode from tstockbasic where market in ('BJ','SH',"SZ"))`;
            result = await db.runSync(sql, []);
        } else if (all == "H股") {
            sql = `update tRuleAction set done = -1 where scode in (select scode from tstockbasic where market in ('HK"))`;
            result = await db.runSync(sql, []);
        } else if (all == "BNB") {
            sql = `update tRuleAction set done = -1 where scode in (select scode from tstockbasic where market in ('EC"))`;
            result = await db.runSync(sql, []);
        } else {
            sql = `update tRuleAction set done = -1 where ruleId=?`;
            result = await db.runSync(sql, [ruleId]);
        }
    }

    if (result.error == null) {
        if (all == null) {
            if (rules[scode] && rules[scode][broker]) {
                reloadRule(rules[scode][broker], req);
            }
        } else {
            rules = {}
            reloadRules();
        }
    }


    let action = {
        id: `${cancelled}-cancelAction`,
        ruleId: ruleId,
        broker: broker,
        scode: scode,
        sname: scode,
        action: "cancelAction",
        price: 0,
        amount: 0,
        orderNo: "",
        done: 0,
        createTime: now
    }

    result = await insertOrReplace("tRuleAction", action);

    var resp = JSON.stringify({});
    if (result.error) {
        resp = JSON.stringify(result);
    }

    if (js) {
        resp = `${js}(${resp})`;
    }

    res.send(resp);
});

app.get('/stock/rule/delete', async (req, res) => {
    let js = req.query.js;
    let id = req.query.id;
    let scode = req.query.scode;
    let broker = req.query.broker;
    let now = Date.now();
    if (rules[scode] && rules[scode][broker]) {
        delete rules[scode][broker];
    }

    let sql = `delete from tTradeRule where id=?`;
    let result = await db.runSync(sql, [id]);

    if (result.error == null) {
        sql = `delete from tRuleAction where scode=? and broker=?`;
        result = await db.runSync(sql, [scode, broker]);
    }

    var resp = JSON.stringify({});
    if (result.error) {

        resp = JSON.stringify(result);
    }

    if (js) {
        resp = `${js}(${resp})`;
    }

    res.send(resp);
});

app.get('/stock/rule/actions', async (req, res) => {
    let js = req.query.js;
    let broker = req.query.broker;
    let sql = `select * from tRuleAction where (broker=?) and orderNo='' and done=0`;
    let r = await db.allSync(sql, [broker]);
    r.rows.forEach(async (row) => {
        let nc = formatScode(row.scode);
        if (nc == null) {

        } else {
            row.scode = nc;
        }
    });

    var resp = JSON.stringify({ data: r.rows });

    if (r.error) {
        resp = r;
    } else {
    }

    if (js) {
        resp = `${js}(${resp})`;
    }

    res.send(resp);
});

app.get('/stock/action/done', async (req, res) => {
    let js = req.query.js;
    let id = req.query.id;
    let sql = `update tRuleAction set done=1 where id=?`;
    let r = await db.runSync(sql, [id]);

    var resp = JSON.stringify({});

    if (r.error) {
        resp = r;
    } else {
    }

    if (js) {
        resp = `${js}(${resp})`;
    }

    res.send(resp);
});

app.get('/stock/rule/status', async (req, res) => {
    let js = req.query.js;
    let scode = req.query.scode;
    var resp = null;
    if (scode == null) {
        resp = JSON.stringify({ data: rules });
    } else if (rules[scode] == null) {
        let res = await db.allSync(`select * from tTradeRule where scode=?`, [scode]);

        if (res.rows.length > 0) {
            let tsb = await db.getSync(`select * from tStockBasic where scode=?`, [scode]);
            let data = res.rows[0];
            data.autoCreateRuleFail = tsb.autoCreateRuleFail;
            resp = JSON.stringify({ data });
        } else {
            resp = JSON.stringify({ data: null });
        }
    } else {
        resp = JSON.stringify({ data: Object.values(rules[scode])[0] });
    }
    if (js) {
        resp = `${js}(${resp})`;
    }

    res.send(resp);
});


app.get('/stock/fe/user/login', async (req, res) => {
    let js = req.query.js;
    let login = req.query.login;
    let password = req.query.password;
    //todo
    var resp = `${js}(${JSON.stringify({ login: login })})`;
    res.send(resp);
});

async function saveCreateRuleFailure(scode, error) {
    await db.runSync(`update tStockBasic set autoCreateRuleFail=? where scode=?`, [error, scode]);
}
async function autoCreateRule(scode, threadId, stockBasicInfo) {
    if (stockBasicInfo == null) {
        stockBasicInfo = await db.getSync(`select * from tstockbasic where scode=?`, [scode]);
    }

    let sname = stockBasicInfo.sname;
    info(`${sname}: auto creating rule`, { threadId }, workerCreateRule.logs, 5);
    let failed = 0;
    //获取tstock里对应scode的最后一条记录
    let r = await db.getSync(`select * from tstock where scode=? and deleted=0 order by tday desc, ttime desc limit 1`, [scode]);
    if (r == null) {
        return { error: `no trade history` };
    }

    //如果已经存在rule,则跳过
    let oldRule = await db.getSync(`select * from tTradeRule where scode=? and broker=?`, [scode, r.operationName]);
    if (oldRule != null && oldRule.closed == 0) {
        return `rule already active`;
    }

    //获取scode对应的当前价格
    if (stockBasicInfo.updateTime < Date.now() - 1000 * workerCreateRule.priceDelay) {
        return { error: `price is old` };
    }

    let amount = Math.abs(r.tamount);
    if (r.operationName == "BNB") {

    } else {
        if (amount < stockBasicInfo.volumeMultiple) {
            amount = stockBasicInfo.volumeMultiple;
        }

        if (amount < 100) {
            amount = 100;
        }
    }

    let minDelta = 0.5;
    let maxDelta = 2;
    let dip = 0.02;

    let currentPrice = stockBasicInfo.buy;
    if (currentPrice < 30) {
        dip = 0.005;
    } else if (currentPrice < 300) {
        dip = 0.02;
    } else {
        dip = 0.1;
    }

    if (r.operationName == "BNB") {
        minDelta = 1;
        maxDelta = 20000;
        dip = 10;
    }

    let lastPrice = r.tprice;
    let buyPrice = lastPrice * (1 - 0.02);
    if (lastPrice - buyPrice < minDelta) {
        buyPrice = lastPrice - minDelta;
    }
    if (lastPrice - buyPrice > maxDelta) {
        buyPrice = lastPrice - maxDelta;
    }

    buyPrice = parseFloat(buyPrice.toFixed(3));

    let sellPrice = lastPrice * (1 + 0.02);
    if (sellPrice - lastPrice < minDelta) {
        sellPrice = lastPrice + minDelta;
    }

    if (sellPrice - lastPrice > maxDelta) {
        sellPrice = lastPrice + maxDelta;
    }

    sellPrice = parseFloat(sellPrice.toFixed(3));

    let rc = null;

    let all = await db.allSync(`select * from tPositions where stock_code=? and broker=?`, [scode, r.operationName]);
    let position = 0;
    if (all.rows && all.rows.length > 0) {
        position = all.rows[0].volume;
    }

    if (r.operationDirection.indexOf("卖") >= 0) {
        if (workerCreateRule.type == "toSell") {
            return { error: `toSell` };
        }

        if (position == 0) { //如果已经清仓
            let all;
            all = await ensureHighPriceIncreasing(scode, sname, threadId, all, 1, 2);
            all = await ensureLowPriceIncreasing(scode, sname, threadId, all, 0, 2);
            all = await ensureAboveMa5(scode, sname, threadId, all, 0, 2);

            if (all.reason) {
                return { error: `${all.reason}` };
            }
            let avgPrice = (currentPrice + all.rows[0].low) / 2;
            if (buyPrice > avgPrice) {
                buyPrice = avgPrice;
            }

            rc = {
                buy: buyPrice,
                bounce: dip,
                buyAmount: amount,
                sell: currentPrice,
                dip: dip,
                sellAmount: amount,
                scode: scode,
                sname: r.sname,
                broker: r.operationName,
                order: "buyFirst",
                expireHours: 12
            };

            setSellPriceByBuy(rc, maxDelta);
        } else {
            let all;
            all = await ensureHighPriceIncreasing(scode, sname, threadId, all, 1, 2);
            all = await ensureLowPriceIncreasing(scode, sname, threadId, all, 0, 3);

            if (all.reason) {
                return { error: `${all.reason}` };
            }

            rc = {
                buy: buyPrice,
                bounce: dip,
                buyAmount: amount,
                sell: lastPrice,
                dip: dip,
                sellAmount: amount,
                scode: scode,
                sname: r.sname,
                broker: r.operationName,
                order: "buyFirst",
                expireHours: 12
            };

            if (currentPrice < buyPrice) {
                rc.buy = currentPrice * (1 - 0.01);
                if (currentPrice - rc.buy > minDelta) {
                    rc.buy = currentPrice - minDelta;
                }
            }

            setSellPriceByBuy(rc, maxDelta);
        }
    } else if (r.operationDirection.indexOf("买") >= 0) {
        if (workerCreateRule.type == "toBuy") {
            return { error: `toBuy` };
        }
        if (position == 0) {
            return { error: `need 1st buy by hand` };
        } else {
            rc = {
                buy: lastPrice,
                bounce: "0.02",
                buyAmount: amount,
                sell: sellPrice,
                dip: "0.02",
                sellAmount: amount,
                scode: scode,
                sname: r.sname,
                broker: r.operationName,
                order: "sellFirst",
                expireHours: 12
            };

            if (currentPrice > rc.sell) {
                rc.sell = currentPrice * (1 + 0.001);

                if (rc.sell - currentPrice > minDelta) {
                    rc.sell = currentPrice + minDelta;
                }
            }

            setBuyPriceBySell(rc, maxDelta);
        }
    } else {
        return { error: `bad trade direction` };
    }

    let broker = rc.broker;
    let now = Date.now();
    let sql = `insert or replace into tTradeRule(id, broker, scode, sname, rule, createTime, closed, expireTime) values(?,?,?,?,?,?,?,?)`;
    let expireHours = 12;
    let expireTime = now + expireHours * 60 * 60 * 1000;
    let id = `${scode}.${broker}`;
    let rule = { id, broker, scode, sname, rule: JSON.stringify(rc), createTime: now, closed: 0, expireTime };
    await insertOrReplace("tTradeRule", rule);
    await db.runSync(`delete from tRuleAction where scode=? and broker=?`, [scode, broker]);
    return {
        rule
    };
}

function getMA(dayCount, rows1d) {
    var result = [];
    for (var i = 0; i < rows1d.length - dayCount; i++) {

        var sum = 0;
        for (var j = i; j < i + dayCount && j < rows1d.length; j++) {
            let d = rows1d[j];
            sum += d.close;
        }

        result.push(+(sum / dayCount).toFixed(3));
    }

    return result;
}
function getIncreaseDays(values, start, end) {
    let days = 0;
    for (let i = start; i < end; i++) {
        if (values[i] > values[i - 1]) {
            days++;
        }
    }

    return days;
}
function getDecreaseDays(values, start, end) {
    let days = 0;
    for (let i = start; i < end; i++) {
        if (values[i] > values[i + 1]) {
            days++;
        }
    }

    return days;
}

async function ensureMa5Exist(scode, sname, threadId, prevRes) {
    prevRes = await ensureData1dIsEnough(scode, sname, threadId, prevRes);

    if (prevRes.reason) {
        return prevRes;
    }

    if (prevRes.ma5 == null) {
        prevRes.ma5 = getMA(5, prevRes.rows);
    }

    return prevRes;
}

async function ensureMa5Increasing(scode, sname, threadId, prevRes, start, end) {
    prevRes = await ensureMa5Exist(scode, sname, threadId, prevRes);

    if (prevRes.reason) {
        return prevRes;
    }

    let ma5 = prevRes.ma5;
    let days = getDecreaseDays(ma5, start, end);
    if (days < end - start) {
        info(`${sname}: ma5 increasing ${days}/${end - start} days`, { threadId }, workerCreateRule.logs, 5);
        prevRes.reason = `ma5 increasing ${days}/${end - start} days`;
        return prevRes;
    }

    return prevRes;
}

async function ensureAboveMa5(scode, sname, threadId, prevRes, start, end) {
    prevRes = await ensureMa5Exist(scode, sname, threadId, prevRes);

    if (prevRes.reason) {
        return prevRes;
    }

    let ma5 = prevRes.ma5;
    let days = 0;
    for (let i = start; i < end; ++i) {
        if (ma5[i] < (prevRes.rows[i].high + prevRes.rows[i].low) / 2) {
            days++;
        }
    }

    if (days < end - start) {
        info(`${sname}: larger than ma5 ${days}/${end - start} days`, { threadId }, workerCreateRule.logs, 5);
        prevRes.reason = `larger than ma5 ${days}/${end - start} days`;
        return prevRes;
    }

    return prevRes;
}


async function get1dData(prevRes, scode) {
    prevRes = await db.allSync(`select * from t1d where scode=? order by time desc limit 30`, [scode]);
    return prevRes;
}

async function ensureLowPriceIncreasing(scode, sname, threadId, prevRes, start, end) {
    prevRes = await ensureData1dIsEnough(scode, sname, threadId, prevRes);

    if (prevRes.reason) {
        return prevRes;
    }

    for (let i = start; i < end; ++i) {
        if (prevRes.rows[i].low < prevRes.rows[i + 1].low) {
            info(`${sname}:${i}.low < ${i + 1}.low`, { threadId }, workerCreateRule.logs, 5);
            prevRes.reason = `${i}.low < ${i + 1}.low`;
            return prevRes;
        }
    }

    return prevRes;
}

async function ensureData1dIsEnough(scode, sname, threadId, prevRes) {
    if (prevRes == null) {
        prevRes = await get1dData(prevRes, scode);
    }

    if (prevRes.rows == null || prevRes.rows.length < 3) {
        info(`${sname}:no 1d data`, { threadId }, workerCreateRule.logs, 5);
        prevRes.reason = "no 1d data";
        return prevRes;
    }

    let lastDay = prevRes.rows[0].time;
    let todayStr = timeFormat(new Date(), "yyyyMMdd");
    if (todayStr != lastDay) {
        info(`${sname}:no today 1d`, { threadId }, workerCreateRule.logs, 5);
        prevRes.reason = "no today 1d";
        return prevRes;
    }

    return prevRes;
}

async function ensureHighPriceIncreasing(scode, sname, threadId, prevRes, start, end) {
    prevRes = await ensureData1dIsEnough(scode, sname, threadId, prevRes);

    if (prevRes.reason) {
        return prevRes;
    }

    for (let i = start; i < end; ++i) {
        if (prevRes.rows[i].high < prevRes.rows[i + 1].high) {
            info(`${sname}:${i}.high < ${i + 1}.high`, { threadId }, workerCreateRule.logs, 5);
            prevRes.reason = `${i}.high < ${i + 1}.high`;
            return prevRes;
        }
    }

    return prevRes;
}

function updatePriceToRule(scode, price) {
    let rs = rules[scode];
    if (rs != null) {
        Object.values(rs).forEach((r) => {
            let rule = r.rule;
            rule.currentPrice = price;
            if (rule.maxPrice == null || price > rule.maxPrice) {
                rule.maxPrice = price;
            }

            if (rule.minPrice == null || price < rule.minPrice) {
                rule.minPrice = price;
            }
        })
    }
}
function getMarket(stockCode) {
    // 转换为字符串并去除空格
    const code = String(stockCode).trim();

    // 检查代码是否有效
    if (!code) {
        return "";
    }

    let suffix = "未知";
    if (code.length == 6) {
        if (/^(600|601|603|605|688|900|51|58|56)\d+$/.test(code)) {
            suffix = "SH"; // 上交所（600/601/603/605/688/900 开头）
        } else if (/^(000|001|002|003|30|15)\d+$/.test(code)) {
            suffix = "SZ"; // 深交所（000/001/002/003/300 开头）
        } else if (/^(8|43|83|87|88|92)\d+$/.test(code)) {
            suffix = "BJ"; // 北交所（8/43/83/87/88 开头）
        }
    } else if (/^\d{4,5}$/.test(code) || /^0[0-9]\d{3}$/.test(code)) {
        suffix = "HK"; // 港交所（4-5位数字，或 08 开头）
    } else if (code.indexOf("USDT") >= 0 || code.indexOf("BTC") >= 0 || code.indexOf("ETH") >= 0) {
        suffix = "EC";
    } else {
        debug(`未知：${code}`);
    }

    // 返回格式化结果（如 600023.SH）
    return `${suffix}`;
}

function formatScode(stockCode) {
    // 转换为字符串并去除空格
    const code = String(stockCode).trim();

    // 检查代码是否有效
    if (!code) {
        return null;
    }

    let suffix = "";
    if (code.length == 6) {
        if (/^(600|601|603|605|688|900|51|58|56)\d+$/.test(code)) {
            suffix = "SH"; // 上交所（600/601/603/605/688/900 开头）
        } else if (/^(000|001|002|003|30|15|12|3)\d+$/.test(code)) {
            suffix = "SZ"; // 深交所（000/001/002/003/300 开头）
        } else if (/^(8|43|83|87|88|920)\d+$/.test(code)) {
            suffix = "BJ"; // 北交所（8/43/83/87/88 开头）
        }
    } else if (/^\d{4,5}$/.test(code) || /^0[0-9]\d{3}$/.test(code)) {
        suffix = "HK"; // 港交所（4-5位数字，或 08 开头）
    } else if (code.indexOf("USDT") >= 0 || code.indexOf("BTC") >= 0 || code.indexOf("ETH") >= 0) {
        suffix = "EC";
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
    let js = req.query.js;
    let sql = `select scode from tstockbasic;`;
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


app.get('/stock/rule/codes', async (req, res) => {
    let js = req.query.js;
    let sql = `select distinct scode from tTradeRule`;
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

app.get('/stock/rule/codes/active', async (req, res) => {
    let js = req.query.js;
    let sql = `select distinct scode from tTradeRule where closed=0;`;
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


app.get('/stock/candidates', async (req, res) => {
    let js = req.query.js;
    let sql = `select scode from tcandidate order by priority desc`;
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


app.get('/stock/1d/lastDate', async (req, res) => {
    let js = req.query.js;
    let scode = req.query.scode;
    info("scode:" + scode, req)
    let sql = `select max(time) as lastDate from t1d where scode=?`;
    let r = await db.getSync(sql, [scode.split(".")[0]]);

    var resp = JSON.stringify(r);
    if (js != null) {
        resp = `${js}(${resp})`;
    }

    res.send(resp);
});

app.get('/stock/1m/lastMinute', async (req, res) => {
    let js = req.query.js;
    let scode = req.query.scode;
    info("scode:" + scode, req)
    let sql = `select max(time) as lastMinute from t1m where scode=?`;
    let r = await db.getSync(sql, [scode.split(".")[0]]);

    var resp = JSON.stringify(r);
    if (js != null) {
        resp = `${js}(${resp})`;
    }

    res.send(resp);
});

app.get('/stock/price/current', async (req, res) => {
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
    let js = req.query.js;
    let reset = req.query.reset;

    let sql = `select * from tstock where tamount<0 and tpair is null or tpair=''`;
    if (reset) {
        info("reset before pair", req)
        await db.runSync(`update tstock set tpair=''`);
        sql = "select * from tstock where tamount<0";
    }
    let r = await db.allSync(sql);
    let sells = r.rows;
    info(`${sells.length} sells`, req)
    for (var i = 0; i < sells.length; ++i) {
        let sell = sells[i];
        info(`${sell.sname}(${sell.scode}):${sell.tid}`, req)
        let r = await db.allSync("select * from tstock where tamount=? and scode=? and operationName=? and tprice<? and (tpair='' or tpair is null) order by tday , ttime , tprice desc",
            [sell.tamount * -1, sell.scode, sell.operationName, sell.tprice]);
        let buys = r.rows;
        if (buys.length > 0) {
            let buy = buys[0];
            info(`${sell.sname}(${sell.scode}):${sell.tid} <==> ${buy.tid}`, req)
            await db.runSync(`update tstock set tpair=? where tid=?`, [buy.tid, sell.tid]);
            await db.runSync(`update tstock set tpair=? where tid=?`, [sell.tid, buy.tid]);
        } else {
            let r = await db.allSync("select * from tstock where tamount=? and scode=? and tprice<? and (tpair='' or tpair is null) order by tday, ttime, tprice desc",
                [sell.tamount * -1, sell.scode, sell.tprice]);
            let buys = r.rows;
            if (buys.length > 0) {
                let buy = buys[0];
                info(`${sell.sname}(${sell.scode}):${sell.tid} <==> ${buy.tid}`, req)
                await db.runSync(`update tstock set tpair=? where tid=?`, [buy.tid, sell.tid]);
                await db.runSync(`update tstock set tpair=? where tid=?`, [sell.tid, buy.tid]);
            }
        }

    };

    var resp = `${js}(${JSON.stringify({ data: "success" })})`;
    res.send(resp);
});

app.post('/stock/query', async (req, res) => {
    let text = req.body.text;
    let row = JSON.parse(decodeURIComponent(atob(text)));
    let sql = row.sql;
    let name = row.name;
    let params = row.params;
    info(`/stock/query:${name}:sql:${sql}`, req)
    info(`/stock/query:${name}:params:${params}`, req)
    let r = await db.allSync(sql);
    if (r.error) {
        info(r.error, req)
        res.send(JSON.stringify({ error: `${r.error}` }));
        return;
    }

    if (name != null) {
        await db.runSync(`insert or replace into tsql (id, name, sql,params,lastUseTime) values (?,?,?,?,?)`,
            [name, name, sql, params, Date.now()]);
    }

    var resp = JSON.stringify({ data: r.rows });
    res.send(resp);
});

app.post('/stock/k/upload', async (req, res) => {
    info(`/stock/k/upload`, req)
    let data = req.body.data;
    let scode = req.body.scode.split(".")[0];
    let period = req.body.period;
    let type = req.body.type;
    if (type == null) {
        type = 0;
    }
    info(`scode:${scode},period:${period},len:${data.length}`, req)
    for (var i = 0; i < data.length; ++i) {
        if (period == "tick") {
            let dateStr = data[i][0];//"20250603091500";
            const year = dateStr.substring(0, 4);
            const month = dateStr.substring(4, 6);
            const day = dateStr.substring(6, 8);
            const hours = dateStr.substring(8, 10);
            const minutes = dateStr.substring(10, 12);
            const seconds = dateStr.substring(12, 14);
            const date = new Date(year, month - 1, day, hours, minutes, seconds);
            if (data[i][3] > 0) {
                //['Time', 'volume', 'amount', 'lastPrice']
                let row = {
                    id: `${scode}-${type}-${date.getTime()}`,
                    scode: scode,
                    time: date.getTime(),
                    data: JSON.stringify({
                        volume: data[i][1],
                        amount: data[i][2],
                        lastPrice: data[i][3]
                    })
                }

                await insertOrReplace("ttick", row);
            }
        } else {
            //['Time', 'open', 'close', 'high', 'low', 'volume', 'amount']
            let row = {
                id: `${scode}-${type}-${data[i][0]}`,
                scode: scode,
                time: data[i][0],
                open: data[i][1],
                close: data[i][2],
                high: data[i][3],
                low: data[i][4],
                volume: data[i][5],
                amount: data[i][6],
                type: type
            }

            if (row.volume < 0) {
                if (period == "1m") {
                    row.volume = 0;
                } else {
                    row.volume = Math.abs(row.volume);
                }
            }

            await insertOrReplace(`t${period}`, row);
        }
    }

    var resp = JSON.stringify({});
    res.send(resp);
});

async function getDealName(scode) {
    let name = scode;
    let r = await db.allSync(`select * from tstockbasic where scode=?`, [scode]);
    if (r.rows.length > 0) {
        name = r.rows[0].sname;
    }

    return name;
}
function convertIfInteger(number) {
    number = parseFloat(number.toFixed(3));
    if (Number.isInteger(number)) {
        return parseInt(number); // 或者 Math.trunc(number)
    }

    return number; // 保持原值
}
app.post('/stock/deal/update', async (req, res) => {
    info(`/stock/deal/update:${JSON.stringify(req.body)}`, req)
    let deal = req.body;
    let ocode = deal.scode.split(".");
    deal.scode = ocode[0];
    if ("" == deal.sname) {
        deal.sname = await getDealName(deal.scode);
    }
    if ("" == deal.market) {
        deal.market = ocode.length > 1 ? ocode[1] : "";
    }
    deal.tday = deal.tday.replace(/\-/g, "");
    if (deal.ttime.length == 5) {
        deal.ttime = "0" + deal.ttime.substring(0, 1) + ":" + deal.ttime.substring(1, 3) + ":" + deal.ttime.substring(3, 5);
    } else if (deal.ttime.length == 6) {
        deal.ttime = deal.ttime.substring(0, 2) + ":" + deal.ttime.substring(2, 4) + ":" + deal.ttime.substring(4, 6);
    }
    deal.lastOperationTime = deal.tday + " " + deal.ttime;
    deal.tprice = convertIfInteger(deal.tprice);
    deal.tid = `${deal.tday}.${deal.ttime}.${deal.scode}.${deal.tprice}`;

    let old = await db.getSync("select * from tStock where tid=?", [deal.tid]);
    let r;
    if (old == null) {
        r = await insertOrIgnore("tStock", deal);
    } else {
        old.tamount += deal.tamount;
        r = await insertOrReplace("tStock", old);
    }

    if (r == null || r.error == null) {
        r = db.runSync(`update tStock set lastOperationTime=? where scode=?`, [deal.lastOperationTime, deal.scode]);
    }

    let resp = {};
    if (r.error) {
        info(r.error, req)
        resp = { error: r.error };
    } else {
    }

    res.send(JSON.stringify(resp));
});


app.post('/stock/rule/action/ordered', async (req, res) => {
    info(`rule/action/ordered:${JSON.stringify(req.body)}`, req)

    let scode = req.body.scode;
    let broker = req.body.broker;
    let status = req.body.status;
    let orderNo = req.body.orderNo;

    let r;
    if (status == 56) {
        r = await db.runSync("update tRuleAction set done = 1, status=?, orderNo=? where scode=? and broker=? ", [status, orderNo, scode, broker]);
    } else if (status == 10) {
        let err = orderNo;
        r = await db.runSync("update tRuleAction set done = 1, status=?, orderNo=? where scode=? and broker=? ", [status, err, scode, broker]);
    } else {
        r = await db.runSync("update tRuleAction set status=?, orderNo=? where scode=? and broker=?", [status, orderNo, scode, broker]);
    }
    let resp = {};
    if (r.error) {
        info(r.error, req)
        resp = { error: r.error };
    } else {
        if (rules[scode]) {
            reloadRule(rules[scode][broker], req);
        }
    }

    res.send(JSON.stringify(resp));
});

app.get('/stock/sqls', async (req, res) => {

    let js = req.query.js;
    let sql = "select * from tsql order by lastUseTime desc";
    let r = await db.allSync(sql);
    if (r.error) {
        info(r.error, req)
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
    info("video/replacers", req)
    var rPath = path.join(directoryPath, "replacers");
    var replacers = {};
    try {
        replacers = JSON.parse(fs.readFileSync(rPath, "utf-8"));
    } catch (e) {
        info("error parsing replacers:" + e.message, req)
    }

    var resp = req.query.js + "(" + JSON.stringify({ data: replacers }) + ");";
    res.send(resp);
});

app.get('/video/metadata', (req, res) => {
    info("video/metadata", req)
    var fileName = req.query.fileName;
    var rPath = path.join(directoryPath, "metadata");
    var data = {};
    try {
        data = JSON.parse(fs.readFileSync(rPath, "utf-8"));
    } catch (e) {
        info("error parsing replacers:" + e.message, req)
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
const { CLIENT_RENEG_WINDOW } = require('tls');
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
    info("file uploading", req)
    if (!req.files || !req.files.file) {
        return res.status(400).send('No file uploaded.');
    }

    const file = req.files.file;
    let dir = req.body.dir;
    if (dir == null) {
        dir = "";
    }

    if (!fs.existsSync(directoryPath + "/" + dir)) {
        fs.mkdirSync(directoryPath + "/" + dir);
    }

    var fileName = decodeURIComponent(file.name);
    const filePath = path.join(directoryPath + "/" + dir, fileName);

    // 将文件保存到服务器上指定目录
    file.mv(filePath, err => {
        if (err) {
            error(err, req);
            return res.status(500).send(err);
        }
        // toStt(fileName);
        res.send(`File ${file.name} uploaded successfully.`);
    });
});
app.get('/video/addSegment', (req, res) => {
    info("video/addSegment", req)
    var fileName = req.query.fileName;
    var start = req.query.start;
    var end = req.query.end;
    var name = req.query.name;
    var rPath = path.join(directoryPath, "metadata");
    var data = {};
    try {
        data = JSON.parse(fs.readFileSync(rPath, "utf-8"));
    } catch (e) {
        info("error parsing metadata:" + e.message, req)
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
    info("video/updateScript", req)
    info("params:" + JSON.stringify(req.body), req)
    const params = JSON.parse(req.body.params);
    var filePath = path.join(directoryPath, params.file);
    info("filePath:" + filePath, req)
    var replaceAll = params.replaceAll;
    var rPath = path.join(directoryPath, "replacers");
    var scripts = fs.readFileSync(filePath, "utf-8");
    var replacers = {};
    try {
        replacers = JSON.parse(fs.readFileSync(rPath, "utf-8"));
    } catch (e) {
        info("error parsing replacers:" + e.message, req)
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
    info("video/updatePosition", req)
    var fileName = req.query.fileName;
    var position = req.query.position;
    var rPath = path.join(directoryPath, "metadata");
    var data = {};
    try {
        data = JSON.parse(fs.readFileSync(rPath, "utf-8"));
    } catch (e) {
        info("error parsing replacers:" + e.message, req)
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
    info("video/updatePosition", req)
    var fileName = req.query.fileName;
    var position = req.query.position;
    var rPath = path.join(directoryPath, "metadata");
    var data = {};
    try {
        data = JSON.parse(fs.readFileSync(rPath, "utf-8"));
    } catch (e) {
        info("error parsing replacers:" + e.message, req)
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
    var text = "{}";
    try {
        text = fs.readFileSync(fp, "utf-8");
    } catch (e) {
        error("error reading config.json:" + e.message, req);
    }

    var json = { data: JSON.parse(text) }
    var resp = req.query.js + "(" + JSON.stringify(json) + ");";
    res.send(resp);
});

app.post('/video/ping', (req, res) => {
    const fp = path.join(directoryPath, "config.json");
    var text = "{}";
    try {
        text = fs.readFileSync(fp, "utf-8");
    } catch (e) {
        error("error reading config.json:" + e.message, req);
    }
    var config = JSON.parse(text);
    var bd = req.body
    info("body:" + JSON.stringify(bd), req)
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
    info("videoPath:" + videoPath, req)
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
    info("remove:" + remove, req)
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

    info("rename:'" + fileName + "' to '" + newName + "'", req)

    var resp = { ok: 1 };
    try {
        fs.renameSync(fileName, newName);
    } catch (err) {
        error(`failed:${err.message}`, req);
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

    info(`setScript:${top},${bottom},${left},${right},${fileName}`, req)

    var rPath = path.join(directoryPath, "scripts");
    var data = {};
    try {
        data = JSON.parse(fs.readFileSync(rPath, "utf-8"));
    } catch (e) {
        info("error parsing replacers:" + e.message, req)
    }

    data[fileName] = { top: top, bottom: bottom, left: left, right: right };

    var resp = { ok: 1 };
    try {
        fs.writeFileSync(rPath, JSON.stringify(data));
        fs.unlink(path.join(directoryPath, `${fileName}.htm`), err => {
            if (err) {
                console.error('Error deleting file:', err);
            } else {
                info('File deleted:', fileName, req)
            }
        });
        fs.unlink(path.join(directoryPath, `${fileName}.srt`), err => {
            if (err) {
                console.error('Error deleting file:', err);
            } else {
                info('File deleted:', fileName, req)
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

    info(`removeScript:${fileName}`, req)

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
        info("error parsing replacers:" + e.message, req)
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
    info("splitting=" + splitting, req)
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
    let res = await upgradeDb();
    if (res && res.error) {
        error(res.error);
        return res;
    }
    reloadRules();

    server.listen(port, () => {
        info(`Server is running on port ${port}`);
        initWss();

    });
}

init();


