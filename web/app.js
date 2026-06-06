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

async function getUuid() {
    while (uuid == null) {
        await sleep(100);
    }

    return uuid();
}

// Helper function to generate time in YYMMDDHHmm format (e.g., "2605021123")
function getTimeStr(timestamp = Date.now()) {
    const d = new Date(timestamp);
    const yy = String(d.getFullYear()).slice(-2);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return yy + mm + dd + hh + min;
}

// Helper function to parse YYMMDDHHmm string to formatted date string
function formatTimeStr(timeStr) {
    if (!timeStr || timeStr.length !== 10) return String(timeStr);
    const yy = parseInt(timeStr.substring(0, 2)) + 2000;
    const mm = parseInt(timeStr.substring(2, 4));
    const dd = parseInt(timeStr.substring(4, 6));
    const hh = parseInt(timeStr.substring(6, 8));
    const min = parseInt(timeStr.substring(8, 10));
    return `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')} ${String(hh).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

let g = {
    logs: [],
    actions: []
}

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
                info("websocket rec:" + message);
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
            let id = await getUuid();
            return new Promise((resolve, reject) => {
                let timer = setTimeout(() => {
                    delete wss.callbacks[id];
                    resolve({ error: `ws.callFunc(${func}) timeout` });
                }, 5000);

                wss.callbacks[id] = function (res) {
                    clearTimeout(timer);
                    info(`${func} result: ${res}`);
                    resolve(res);
                }
                let str = JSON.stringify({ func: func, params: params, id })
                info(`ws.send: ${str}`);
                ws.send(str);
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
const openwrtClientsPath = path.join(directoryPath, "openwrt_clients.json");
info(directoryPath);
let suffix = [];
if (args.length > 4) {
    suffix = args[4].split(";");
}
info(args[4]);
info(suffix.join(" "));
if (args.length > 5) {
    if (args[5] == "info") {
        logLevel = INFO;
    }
}

info("open stock.db");
const dbFilePath = path.join(directoryPath, "stock.db");
let db = new sqlite3.Database(dbFilePath);
const stockPyPort = parseInt(process.env.STOCK_PY_PORT || (port + 10000));
let stockPyReady = false;
let stockPyProcess = null;

function startStockPyService() {
    if (process.env.DISABLE_STOCK_PY_PROXY === "1") {
        info("stock.py proxy disabled by env");
        return;
    }

    stockPyProcess = spawn("python3", [path.join(__dirname, "stock.py"), `${stockPyPort}`, directoryPath], {
        cwd: __dirname,
        stdio: ["ignore", "pipe", "pipe"]
    });

    stockPyProcess.stdout.on("data", (data) => {
        let text = data.toString();
        if (text.indexOf("stock.py listening") >= 0) {
            stockPyReady = true;
        }
        info(`[stock.py] ${text.trim()}`);
    });

    stockPyProcess.stderr.on("data", (data) => {
        error(`[stock.py] ${data.toString().trim()}`);
    });

    stockPyProcess.on("exit", (code) => {
        stockPyReady = false;
        error(`stock.py exited with code ${code}`);
    });
}

startStockPyService();

app.use(async (req, res, next) => {
    if (!stockPyProcess || !stockPyReady) {
        next();
        return;
    }

    if (req.path === "/stock/ws" || (!req.path.startsWith("/stock") && req.path !== "/stockUpdate")) {
        next();
        return;
    }

    try {
        let headers = {
            accept: req.headers.accept || "application/json"
        };
        if (req.headers["content-type"]) {
            headers["content-type"] = req.headers["content-type"];
        }

        let body = undefined;
        if (req.method !== "GET" && req.method !== "HEAD") {
            body = JSON.stringify(req.body || {});
            headers["content-type"] = headers["content-type"] || "application/json";
        }

        let resp = await fetch(`http://127.0.0.1:${stockPyPort}${req.originalUrl}`, {
            method: req.method,
            headers,
            body
        });

        if (resp.status === 404 || resp.status === 501) {
            next();
            return;
        }

        let text = await resp.text();
        res.status(resp.status);
        let contentType = resp.headers.get("content-type");
        if (contentType) {
            res.set("content-type", contentType);
        }
        res.send(text);
    } catch (e) {
        error(`stock.py proxy failed:${e.message}`, req.threadId);
        next();
    }
});

db.runSync = (sql, params, threadId) => {
    info(`runSync: ${sql}, ${JSON.stringify(params)}`, threadId);
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

db.allSync = (sql, params, threadId) => {
    return new Promise((resolve, reject) => {
        info("allSync:" + sql, threadId);
        info("params:" + JSON.stringify(params), threadId);
        db.all(sql, params, function (err, rows) {
            if (err) {
                error(err, threadId);
                resolve({ error: err });
            } else {
                resolve({ rows: rows });
            }
        });
    });
}

db.getSync = db.getSync || function (sql, params, threadId) {
    info("getSync:" + sql, threadId);
    info(JSON.stringify(params), threadId);
    return new Promise((resolve, reject) => {
        db.get(sql, params, function (err, row) {
            if (err != null) {
                error(err, threadId);
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

function stripScodeSuffix(scode) {
    if (scode == null) {
        return scode;
    }
    scode = String(scode).trim();
    let index = scode.lastIndexOf(".");
    if (index > 0) {
        return scode.substring(0, index);
    }

    return scode;
}

function hasScodeSuffix(scode) {
    if (scode == null) {
        return false;
    }
    scode = String(scode).trim();
    return /^[^.]+\.[A-Za-z]+$/.test(scode);
}

function normalizeScode(scode, minLength) {
    if (scode == null) {
        return scode;
    }
    if (minLength == null) {
        minLength = 5;
    }

    scode = String(scode).trim();
    if (scode == "") {
        return scode;
    }

    if (hasScodeSuffix(scode)) {
        let fields = scode.split(".");
        let code = fields[0];
        let suffix = fields[1].toUpperCase();
        suffix = suffix.replace(/HGT/g, "HK");
        suffix = suffix.replace(/SGT/g, "HK");
        if (/^\d+$/.test(code) && code.length < minLength) {
            code = "000000".substring(0, minLength - code.length) + code;
        }
        return `${code}.${suffix}`;
    }

    let code = scode;
    if (/^\d+$/.test(code) && code.length < minLength) {
        code = "000000".substring(0, minLength - code.length) + code;
    }

    let suffix = getMarket(code);
    if (suffix == null || suffix == "" || suffix == "未知") {
        return code;
    }

    return `${code}.${suffix}`;
}

function getScodeType(scode) {
    if (scode == null) {
        return 0;
    }

    return String(scode).trim().toUpperCase().startsWith("O_") ? 1 : 0;
}

function normalizeType(type, scode) {
    let normalized = parseInt(type);
    if (isNaN(normalized)) {
        normalized = getScodeType(scode);
    }

    return normalized;
}

function getTypedScodeQuery(scode, type, minLength) {
    let aliases = getScodeAliases(scode, minLength);
    let normalizedType = normalizeType(type, scode);
    let candidateIds = aliases.map((alias) => alias);
    return {
        type: normalizedType,
        aliases,
        candidateIds,
        scodePlaceholders: aliases.map(() => "?").join(","),
        idPlaceholders: candidateIds.map(() => "?").join(",")
    };
}

async function getStockBasicByScode(scode, type, threadId) {
    let query = getTypedScodeQuery(scode, type);
    let sql = `select * from tStockBasic where type=? and (scode in (${query.scodePlaceholders}) or id in (${query.idPlaceholders})) limit 1`;
    let row = await db.getSync(sql, [query.type].concat(query.aliases, query.candidateIds), threadId);
    normalizeDbRowScodes(row);
    return row;
}

function getScodeAliases(scode, minLength) {
    let values = [];
    let normalized = normalizeScode(scode, minLength);
    let raw = stripScodeSuffix(scode);
    if (normalized) {
        values.push(normalized);
    }
    if (raw && !values.includes(raw)) {
        values.push(raw);
    }

    return values;
}

function normalizeDbRowScodes(row) {
    if (row == null) {
        return row;
    }
    if (row.scode != null) {
        row.scode = normalizeScode(row.scode);
    }
    if (row.stock_code != null) {
        row.stock_code = normalizeScode(row.stock_code);
    }

    return row;
}

function normalizeDbRowsScodes(rows) {
    if (rows == null) {
        return rows;
    }
    rows.forEach((row) => normalizeDbRowScodes(row));
    return rows;
}

function quoteSqliteIdentifier(name) {
    return `"${String(name).replace(/"/g, '""')}"`;
}

function normalizeRuleRatio(value, fallback) {
    let result = parseFloat(value);
    if (isNaN(result) || result <= 0) {
        return fallback;
    }

    return result;
}

async function refreshTableScodeColumn(tableName, columnName, threadId) {
    let tableSqlName = quoteSqliteIdentifier(tableName);
    let columnSqlName = quoteSqliteIdentifier(columnName);
    let r = await db.allSync(`select distinct ${columnSqlName} as scode from ${tableSqlName} where ${columnSqlName} is not null and trim(${columnSqlName})<>''`, [], threadId);
    if (r.error) {
        return r;
    }

    for (let i = 0; i < r.rows.length; i++) {
        let oldScode = r.rows[i].scode;
        let newScode = normalizeScode(oldScode);
        if (newScode == null || newScode == "" || newScode == oldScode) {
            continue;
        }

        let updateResult = await db.runSync(`update ${tableSqlName} set ${columnSqlName}=? where ${columnSqlName}=?`, [newScode, oldScode], threadId);
        if (updateResult.error) {
            return updateResult;
        }
    }

    return {};
}

async function refreshAllTableScodes(threadId) {
    let tables = await db.allSync(`select name from sqlite_master where type='table' and name not like 'sqlite_%'`, [], threadId);
    if (tables.error) {
        return tables;
    }

    for (let i = 0; i < tables.rows.length; i++) {
        let tableName = tables.rows[i].name;
        let columns = await db.allSync(`pragma table_info(${quoteSqliteIdentifier(tableName)})`, [], threadId);
        if (columns.error) {
            return columns;
        }

        let hasScode = columns.rows.some((column) => column.name == "scode");
        if (!hasScode) {
            continue;
        }

        let result = await refreshTableScodeColumn(tableName, "scode", threadId);
        if (result.error) {
            return result;
        }
    }

    return {};
}

async function updateStockBasicByScode(fields, threadId) {
    let scode = normalizeScode(fields.scode);
    if (scode == null || scode == "") {
        return { error: "scode required" };
    }

    let query = getTypedScodeQuery(scode, fields.type);
    let row = Object.assign({}, fields);
    row.scode = scode;
    let type = query.type;

    let querySql = `select id from tStockBasic where type=? and (scode in (${query.scodePlaceholders}) or id in (${query.idPlaceholders})) limit 1`;
    let target = await db.getSync(querySql, [type].concat(query.aliases, query.candidateIds), threadId);
    if (target && !target.error) {
        let columns = Object.keys(row);
        let assignments = columns.map((column) => `${column}=?`).join(", ");
        let values = columns.map((column) => row[column]);
        let sql = `update tStockBasic set ${assignments} where id=?`;
        return await db.runSync(sql, values.concat([target.id]), threadId);
    }

    row.id = scode;
    row.type = type;
    row.market = getMarket(scode);
    return await insertOrReplace("tStockBasic", row, threadId);
}

async function queueFutureLeverageAction(scode, leverage, broker, threadId) {
    let normalizedScode = normalizeScode(scode);
    if (normalizedScode == null || normalizedScode == "" || !normalizedScode.startsWith("O_")) {
        return { error: "future scode required" };
    }

    let type = normalizeType(1, normalizedScode);
    let aliases = getScodeAliases(normalizedScode);
    let placeholders = aliases.map(() => "?").join(",");
    let normalizedBroker = broker == null || `${broker}`.trim() == "" ? "BNB" : `${broker}`.trim();
    let deleteParams = [type].concat(aliases, [normalizedBroker]);
    let deleteSql = `delete from tRuleAction where type=? and scode in (${placeholders}) and broker=? and done=0 and action in ('setLeverage','changeLeverage','updateLeverage')`;
    let deleteResult = await db.runSync(deleteSql, deleteParams, threadId);
    if (deleteResult && deleteResult.error) {
        return deleteResult;
    }

    let stockBasicInfo = await getStockBasicByScode(normalizedScode, type, threadId);
    let now = Date.now();
    return await insertOrReplace("tRuleAction", {
        id: `${normalizedScode}.${normalizedBroker}.setLeverage.${now}`,
        ruleId: `${normalizedScode}.${normalizedBroker}.setLeverage`,
        scode: normalizedScode,
        sname: stockBasicInfo && stockBasicInfo.sname ? stockBasicInfo.sname : normalizedScode,
        action: "setLeverage",
        price: 0,
        amount: leverage,
        orderNo: "",
        done: 0,
        createTime: now,
        broker: normalizedBroker,
        status: "",
        type: type
    }, threadId);
}

function log(msg) {
    g.logs.push(msg);
}

setTimeout(log2File, 10);

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function appendFile(filePath, data) {
    return new Promise((resolve, reject) => {
        fs.appendFile(filePath, data, (err) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

async function log2File() {
    while (true) {
        let logFilePath = path.join(__dirname, `logs/app.${timeFormat(new Date(), "yyMMdd")}.log`);
        let logs = g.logs;
        g.logs = [];
        if (logs.length > 0) {
            try {
                await appendFile(logFilePath, logs.join("\n") + "\n");
            } catch (e) {
                console.log(e.stack);
            }
        } else {
            await sleep(100);
        }
    }
}

function info(msg, threadId) {
    if (logLevel > INFO) {
        return;
    }

    if (threadId == null) {
        threadId = "";
    }

    let time = timeFormat(new Date(), "yyyy-MM-dd hh:mm:ss");
    let text = `${time}[${threadId}]:${msg}`;

    log(text);
}
function debug(msg, threadId) {
    if (logLevel > DEBUG) {
        return;
    }

    if (threadId == null) {
        threadId = "";
    }

    let time = timeFormat(new Date(), "yyyy-MM-dd hh:mm:ss");
    log(`${time}[${threadId}]:${msg}`);
}
function error(msg, threadId) {
    if (logLevel > ERROR) {
        return;
    }

    if (threadId == null) {
        threadId = "";
    }

    let time = timeFormat(new Date(), "yyyy-MM-dd hh:mm:ss");
    log(`${time}[${threadId}]:${msg}`);
}

function readOpenwrtClients(threadId) {
    try {
        const text = fs.readFileSync(openwrtClientsPath, "utf-8");
        const data = JSON.parse(text);
        if (data && typeof data === "object") {
            return data;
        }
    } catch (e) {
        if (e.code !== "ENOENT") {
            error(`readOpenwrtClients error:${e.message}`, threadId);
        }
    }

    return {
        router: "",
        reportedAt: 0,
        clients: []
    };
}

function writeOpenwrtClients(data, threadId) {
    try {
        fs.writeFileSync(openwrtClientsPath, JSON.stringify(data, null, 4));
        return { ok: 1 };
    } catch (e) {
        error(`writeOpenwrtClients error:${e.message}`, threadId);
        return { error: e.message };
    }
}

// 列出目录下的所有文件
function listFiles() {
    let files = fs.readdirSync(directoryPath);
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

// 列出目录下的所有文件
function listVoices() {
    const files = fs.readdirSync(directoryPath + "/voice");
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
        var script = fs.existsSync(path.join(directoryPath, "/voice/" + file + ".htm").replace(/([\[\] ])/g, '\\$1'));
        const stats = fs.statSync(path.join(directoryPath, "/voice/" + file).replace(/([\[\] ])/g, '\\$1'));

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
                                info('File deleted:' + filePath);
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
let autoActionStartTime = {
    buy: {
        value: "00:00",
        minutes: 0
    },
    sell: {
        value: "00:00",
        minutes: 0
    },
    loadedAt: 0
};
let autoActionBlockedLogMinute = {
    buy: -1,
    sell: -1
};
let autoActionBlockedInfo = {
    count: 0,
    lastAt: 0,
    lastScode: "",
    lastSname: "",
    lastBroker: "",
    lastActionType: "",
    lastStartTime: ""
};
let tempAllowedAutoActions = {};

function getTempAutoActionKey(scode) {
    return normalizeScode(scode) || "";
}

function grantTempAutoAction(scode) {
    let key = getTempAutoActionKey(scode);
    tempAllowedAutoActions[key] = {
        scode: normalizeScode(scode),
        createdAt: Date.now()
    };
    return tempAllowedAutoActions[key];
}

function consumeTempAutoAction(scode) {
    let key = getTempAutoActionKey(scode);
    let item = tempAllowedAutoActions[key];
    if (item == null) {
        return null;
    }
    delete tempAllowedAutoActions[key];
    return item;
}

function normalizeAutoActionStartTime(value) {
    if (value == null) {
        return {
            value: "00:00",
            minutes: 0
        };
    }

    let text = `${value}`.trim();
    if (text == "") {
        return {
            value: "00:00",
            minutes: 0
        };
    }

    let match = text.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
    if (match == null) {
        match = text.match(/^([01]?\d|2[0-3])([0-5]\d)$/);
    }

    if (match == null) {
        return {
            error: `bad startTime:${value}`
        };
    }

    let hour = parseInt(match[1]);
    let minute = parseInt(match[2]);
    return {
        value: `${add0(hour)}:${add0(minute)}`,
        minutes: hour * 60 + minute
    };
}

async function refreshAutoActionStartTime(threadId, force) {
    if (force == null) {
        force = false;
    }
    let now = Date.now();
    if (!force && autoActionStartTime.loadedAt > 0 && now - autoActionStartTime.loadedAt < 60 * 1000) {
        return autoActionStartTime;
    }

    let fallback = {
        value: "00:00",
        minutes: 0
    };

    let rowLegacy = await db.getSync("select * from config where key=?", ["autoActionStartTime"], threadId);
    if (rowLegacy && rowLegacy.value != null) {
        let result = normalizeAutoActionStartTime(rowLegacy.value);
        if (result.error == null) {
            fallback = result;
        } else {
            error(result.error, threadId);
        }
    }

    let rowBuy = await db.getSync("select * from config where key=?", ["autoActionStartTimeBuy"], threadId);
    if (rowBuy && rowBuy.value != null) {
        let result = normalizeAutoActionStartTime(rowBuy.value);
        if (result.error == null) {
            autoActionStartTime.buy = result;
        } else {
            error(result.error, threadId);
            autoActionStartTime.buy = fallback;
        }
    } else {
        autoActionStartTime.buy = fallback;
    }

    let rowSell = await db.getSync("select * from config where key=?", ["autoActionStartTimeSell"], threadId);
    if (rowSell && rowSell.value != null) {
        let result = normalizeAutoActionStartTime(rowSell.value);
        if (result.error == null) {
            autoActionStartTime.sell = result;
        } else {
            error(result.error, threadId);
            autoActionStartTime.sell = fallback;
        }
    } else {
        autoActionStartTime.sell = fallback;
    }

    autoActionStartTime.loadedAt = now;
    return autoActionStartTime;
}

async function getAutoActionGateInfo(threadId) {
    await refreshAutoActionStartTime(threadId);
    let now = new Date();
    let minute = now.getHours() * 60 + now.getMinutes();
    let blockedBuy = autoActionStartTime.buy.minutes > 0 && minute < autoActionStartTime.buy.minutes;
    let blockedSell = autoActionStartTime.sell.minutes > 0 && minute < autoActionStartTime.sell.minutes;
    return {
        blocked: blockedBuy || blockedSell,
        blockedBuy,
        blockedSell,
        buyStartTime: autoActionStartTime.buy.value,
        sellStartTime: autoActionStartTime.sell.value,
        startTime: autoActionBlockedInfo.lastStartTime,
        currentTime: `${add0(now.getHours())}:${add0(now.getMinutes())}`,
        blockCount: autoActionBlockedInfo.count,
        lastBlockedAt: autoActionBlockedInfo.lastAt,
        lastScode: autoActionBlockedInfo.lastScode,
        lastSname: autoActionBlockedInfo.lastSname,
        lastBroker: autoActionBlockedInfo.lastBroker,
        lastActionType: autoActionBlockedInfo.lastActionType
    };
}

async function allowAutoCreateAction(req, row) {
    let threadId = req ? req.threadId : null;
    await refreshAutoActionStartTime(threadId);
    let actionType = row && row.action ? row.action : null;
    if (actionType !== "buy" && actionType !== "sell") {
        return true;
    }
    let gate = actionType == "buy" ? autoActionStartTime.buy : autoActionStartTime.sell;
    if (gate.minutes <= 0) {
        return true;
    }

    let now = new Date();
    let minute = now.getHours() * 60 + now.getMinutes();
    if (minute >= gate.minutes) {
        return true;
    }

    let tempAllowed = consumeTempAutoAction(row && row.scode ? row.scode : "");
    if (tempAllowed != null) {
        info(`auto ${actionType} action temp allowed for ${tempAllowed.scode}`, threadId);
        return true;
    }

    if (autoActionBlockedLogMinute[actionType] != minute) {
        autoActionBlockedLogMinute[actionType] = minute;
        info(`auto ${actionType} action paused, wait until ${gate.value}`, threadId);
    }

    autoActionBlockedInfo.count += 1;
    autoActionBlockedInfo.lastAt = Date.now();
    autoActionBlockedInfo.lastScode = row && row.scode ? row.scode : "";
    autoActionBlockedInfo.lastSname = row && row.sname ? row.sname : "";
    autoActionBlockedInfo.lastBroker = row && row.broker ? row.broker : "";
    autoActionBlockedInfo.lastActionType = actionType;
    autoActionBlockedInfo.lastStartTime = gate.value;

    return false;
}

async function reloadRules() {
    let req = {
        threadId:
            Date.now() + "" + Math.floor(Math.random() * 10000)
    }
    let ruleList = await db.allSync("select * from tTradeRule where closed = 0", [], req.threadId);
    if (ruleList == null || ruleList.rows == null) {
        error("bad rule list", req.threadId);
        return;
    }

    for (let i = 0; i < ruleList.rows.length; i++) {
        let rule = ruleList.rows[i];
        normalizeDbRowScodes(rule);
        await reloadRule(rule, req);
    }
}

async function reloadRule(r, req) {
    if (r == null) {
        return;
    }
    let threadId = req.threadId;
    normalizeDbRowScodes(r);
    r.type = normalizeType(r.type, r.scode);

    info("reloadRule:" + r.scode + r.sname, req.threadId)

    let now = Date.now();
    if (r.expireTime != null && r.expireTime < now) {
        info("expired rule:" + r.scode, req.threadId)
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
        info("r.rule:" + JSON.stringify(r.rule), req.threadId)
        r.rule = JSON.parse(r.rule);
    } catch (e) {
        info(e.stack, req.threadId)
    }

    if (rules[r.scode] == null) {
        rules[r.scode] = {};
    }
    rules[r.scode][r.broker] = r;

    let sb = await getStockBasicByScode(r.scode, r.type, threadId);
    if (sb != null) {
        r.rule.currentPrice = sb.buy;
    }

    r.actions = [];
    //从 truleaction 里读取响应股票的最近一条执行记录
    let ra = await db.getSync(`select * from tRuleAction where ruleId = '${r.id}' order by createTime desc limit 1`, [], threadId);
    if (ra) {
        normalizeDbRowScodes(ra);
        info("${r.scode} ${r.sname} ra:" + JSON.stringify(ra), req.threadId)
        if (ra.done == 0) {
            r.status = "ordered";
        } else if (ra.done == -1) {
            r.status = "cancelled";
        } else if (ra.done == 1) {
            r.status = "ordered";
        } else if (ra.done == 2) {
            info("rule done", req.threadId)
            r.status = "done";
            await db.runSync(`update tTradeRule set closed=1 where id = '${r.id}'`);
            delete rules[r.scode][r.broker];
            if (r.rule.buyAmount > 0 && r.rule.sellAmount > 0) {
                setTimeout(async () => {
                    let res = await autoCreateRule(r.scode, req.threadId, null, true);
                    if (res.error == null) {
                        await saveCreateRuleFailure(r.scode, "");
                        reloadRule(res.rule, req);
                    } else {
                        error(res.error, req.threadId)
                        await saveCreateRuleFailure(r.scode, res.error);
                    }
                }, 100);
            }
        } else {

        }

        info(`r.status=${r.status}`, req.threadId)
        r.actions.push(ra);
    } else {
        info(`${r.scode} ${r.sname} r.status=${r.status}`, req.threadId)
        if (r.rule.order == "buyFirst") {
            r.status = "toBuy";
        } else if (r.rule.order == "sellFirst") {
            r.status = "toSell";
        } else {
            r.status = "todo";
        }

        info(`${r.scode} ${r.sname} set r.status=${r.status}`, req.threadId)
    }

    checkRule(r, req);
}

async function tryToSell(r, req) {
    debug("tryToSell:" + JSON.stringify(r), req.threadId)
    // if (!await allowAutoCreateAction(req, r, "sell")) {
    //     return false;
    // }
    let rule = r.rule;
    let now = Date.now();
    let price = 0;
    if (rule.dip < 0) {
        price = rule.sell;
    } else if (rule.currentPrice >= parseFloat(rule.sell)) {
        debug(`currentPrice > sell`, req.threadId)
        if (rule.maxPrice >= parseFloat(rule.sell)) {
            debug(`maxPrice > sell`, req.threadId)
            let delta = rule.maxPrice - rule.currentPrice;
            debug(`delta=${delta}`, req.threadId)
            if (delta >= parseFloat(rule.dip)) {
                price = rule.currentPrice;
            }
        }
    }
    debug(`price=${price}`, req.threadId)
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
            createTime: now,
            type: normalizeType(r.type, rule.scode)
        }

        await insertOrReplace("tRuleAction", action);
        r.status = "ordered";

        r.actions.push(action);
        debug(`rules:${JSON.stringify(rules)}`, req.threadId)
        return true;
    }

    return false;
}
async function tryToBuy(r, req) {
    debug("tryToBuy:" + JSON.stringify(r), req.threadId)
    // if (!await allowAutoCreateAction(req, r, "buy")) {
    //     return false;
    // }
    let rule = r.rule;
    let now = Date.now();
    let buy = 0;
    let scode = rule.scode;
    let sname = rule.sname;
    let broker = rule.broker;
    let threadId = req.threadId;

    if (rule.bounce < 0) {
        debug(`bounce=${rule.bounce}<0, order asap`, req.threadId)
        //立即下单
        buy = rule.buy;
    } else {
        debug(`bounce=${rule.bounce}`, req.threadId)
        if (rule.currentPrice <= parseFloat(rule.buy)) {
            debug(`currentPrice < buy (${rule.currentPrice}<${rule.buy})`, req.threadId)

            debug(`minPrice=${rule.minPrice}`, req.threadId);
            if (rule.minPrice <= parseFloat(rule.buy)) {
                let delta = rule.currentPrice - rule.minPrice;
                debug(`delta=${delta}`, req.threadId)
                if (delta >= parseFloat(rule.bounce)) {
                    //买入
                    buy = rule.currentPrice;
                }
            }
        }
    }

    debug(`buy=${buy}`, req.threadId)
    if (buy > 0) {
        if (rule.bounce > 0) {
            let all = {};
            if (rule.auto == 1) {
                all = await ensureCciNotCrossDown100(scode, sname, threadId);
                all = await ensureLowPriceIncreasing(scode, sname, threadId, all, 0, 1);
                all = await ensureAboveMa5(scode, sname, threadId, all, 0, 1);
            }

            if (all.reason != null) {
                info(all.reason, req.threadId)
                await saveCreateRuleFailure(rule.scode, all.reason);
                await db.runSync(`update tTradeRule set closed=1 where id = '${r.id}'`);
                if (rules[scode] && rules[scode][broker]) {
                    await reloadRule(rules[scode][broker], req);
                }
                info(`rule closed`, req.threadId);
                return false;
            }
        }

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
            createTime: now,
            type: normalizeType(r.type, rule.scode)
        }

        if (r.actions.length > 0) {
            info(`check recent actions`, req.threadId);
            let oc = r.actions[r.actions.length - 1].createTime;
            let n = Date.now();
            if (n - oc < 1000) {
                info("buy action too close", req.threadId);
                return false;
            }
        }

        info("new action", req.threadId);
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
        error("checking", req.threadId)
        return;
    }

    checkingRule = 1;
    debug("checkRule start", req.threadId)
    let now = Date.now();
    //遍历 scodes 里的每一个元素 scode,检查响应的 rule 是否满足条件，
    for (let i = 0; i < scodes.length; i++) {
        let scode = normalizeScode(scodes[i]);
        let rs = rules[scode];
        debug("checkRule:" + scode, req.threadId);
        if (rs == null) {
            debug("no rule", req.threadId);
        } else {
            let vs = Object.values(rs);
            for (let i = 0; i < vs.length; ++i) {
                let r = vs[i];
                try {
                    debug(`checking rule: scode=${scode} status=${r.status}`, req.threadId)
                    if (r.expireTime != null && r.expireTime < now) {
                        info("expired rule:" + r.scode, req.threadId)
                        if (rules[r.scode] && rules[r.scode][r.broker]) {
                            delete rules[r.scode][r.broker];
                        }

                        await db.runSync(`update tRuleAction set done = -1 where ruleId=?`, [r.id]);

                        await db.runSync(`update tTradeRule set closed=1 where id = '${r.id}'`);

                        break;
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
                }
                catch (e) {
                    error(e.stack, req.threadId);
                }
            }
        }

        debug("checkRule:" + scode + " end", req.threadId);
    }

    debug("checkRule end", req.threadId)
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
    info(`${method} ${url}`, req.threadId)
    debug(`body:${bodyParams}`, req.threadId)

    // 拦截 response 的 send/end 方法来记录响应内容
    const originalSend = res.send.bind(res);
    const originalEnd = res.end.bind(res);
    let responseLogged = false;

    res.send = function (body, ...args) {
        if (!responseLogged) {
            responseLogged = true;
            const respStr = body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : '';
            debug(`${method} ${url} response:${respStr}`, req.threadId);
        }
        return originalSend(body, ...args);
    };

    res.end = function (chunk, ...args) {
        if (!responseLogged && chunk) {
            responseLogged = true;
            const respStr = typeof chunk === 'string' ? chunk : JSON.stringify(chunk);
            debug(`${method} ${url} response:${respStr}`, req.threadId);
        }
        return originalEnd(chunk, ...args);
    };

    try {
        next();
    } catch (e) {
        error(e.stack, req.threadId);
    }
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

app.get('/video/voice', (req, res) => {
    let files = listVoices();
    const remove = req.query.remove;
    var resp = JSON.stringify({ files, remove });
    res.send(resp);
});
app.delete('/video/voice', (req, res) => {
    const { files } = req.body;
    info("delete voice files:" + JSON.stringify(files));
    const voiceDir = directoryPath + "/voice";
    for (const fileName of files) {
        const filePath = path.join(voiceDir, fileName);
        try {
            fs.unlinkSync(filePath);
            const txtPath = filePath + ".txt";
            if (fs.existsSync(txtPath)) {
                fs.unlinkSync(txtPath);
            }
        } catch (err) {
            console.error('Error deleting voice file:', err);
        }
    }
    res.send(JSON.stringify({ success: true }));
});
app.post('/video/tag', (req, res) => {
    info("files=" + req.body.files, req.threadId)
    info("tags=" + req.body.tags, req.threadId)
    const files = JSON.parse(req.body.files);
    const tags = JSON.parse(req.body.tags);

    let otags = getTags();

    if (files.length == 1) {
        for (var j = 0; j < files.length; ++j) {
            info("file:" + files[j], req.threadId)
            Object.keys(otags).map(
                (tag) => {
                    var f = otags[tag];
                    delete f[files[j]];
                }
            );
        }

        info("otags=" + JSON.stringify(otags), req.threadId)

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
    info(req.body.cookies, req.threadId)

    fs.writeFileSync(path.join(directoryPath, "cookies.txt"), cookies);
    var resp = JSON.stringify({ data: "success" });
    res.send(resp);
});

app.post('/stock/update', async (req, resp) => {
    let threadId = req.threadId;
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
    debug(broker)
    let data = req.body.rows.split("\n");
    debug(data.join("\n"), req.threadId)
    let now = new Date().getTime();
    for (var i = 0; i < data.length; ++i) {
        if (data[i].trim() == "") {
            continue;
        }

        var fields = data[i].split("\t");
        debug(JSON.stringify(fields));
        let tday = fields[0];
        let ttime = fields[1];
        if (broker == "广发历史") {
            //广发证券
            fields = fields.concat([""]);
            fields[3] = normalizeScode(fields[3]);
            fields[5] = "广发";
            var sql = `insert or ignore into tstock (tday, ttime, sname,scode,operationDirection, operationName,market,tamount,tprice,tcash,tid,taccount, tpair,lastOperationTime) 
        values (?, ?, ?,?, ?, ?,?, ?, ?,?, ?, ?, ?, ?)`;
            let res = await db.runSync(sql, fields.concat([Date.now()]));
            if (res.error) {
                debug(res.error, req.threadId)
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
            let lastOperationTime = Date.now();

            var sql = `insert or ignore into tstock (tday, ttime, sname,scode,operationDirection, operationName,market,tamount,tprice,
            tcash,tid,taccount, tpair,lastOperationTime) 
        values (?, ?, ?,?, ?, ?,?, ?, ?,?, ?, ?, ?, ?)`;
            let res = await db.runSync(sql, [tday, ttime, sname, scode, operationDirection, operationName, market, tamount, tprice,
                tcash, tid, taccount, tpair, lastOperationTime]);
            if (res.error) {
                info(res.error, req.threadId)
                resp.send(res);
                return;
            } else {
            }

            await insertOrIgnore("tStockBasic", {
                id: scode,
                scode: scode,
                sname: fields[3],
                buy: fields[6],
                updateTime: now
            });
        } else if (broker == "国信当日") {
            fields = fields.concat([""]);
            fields[0] = normalizeScode(fields[0]);
            var sql = `insert or ignore into tstock (tday, ttime, sname,scode,operationDirection, operationName,market,tamount,tprice,
            tcash,tid,taccount, tpair,lastOperationTime) 
        values (?, ?, ?,?, ?, ?,?, ?, ?,?, ?, ?, ?, ?)`;
            let tday = timeFormat(new Date(), "yyyyMMdd");
            let ttime = fields[0];
            let res = await db.runSync(sql, [tday, ttime, fields[1], fields[0], fields[2], "国信", getMarket(fields[11]), fields[3], fields[4],
                fields[5], fields[8], fields[10], '', Date.now()]);
            if (res.error) {
                info(res.error, req.threadId)
                resp.send(res);
                return;
            } else {
            }

            await insertOrReplace("tStockBasic", {
                id: fields[0],
                scode: fields[0],
                sname: fields[1],
                buy: fields[4],
                updateTime: now
            });
        } else if (broker == "国金历史") {
            //tdx 国金证券
            fields = fields.concat([""]);
            fields[2] = normalizeScode(fields[2]);
            var sql = `insert or ignore into tstock (tday, ttime, sname,scode,operationDirection, operationName,market,tamount,tprice,
            tcash,tid,taccount, tpair,lastOperationTime) 
        values (?, ?, ?,?, ?, ?,?, ?, ?,?, ?, ?, ?, ?)`;

            let res = await db.runSync(sql, [tday, ttime, fields[3], fields[2], fields[5], "国金", fields[11], fields[7], fields[6],
                fields[8], fields[9], fields[11], '', tday + " " + ttime]);
            if (res.error) {
                info(res.error, req.threadId)
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
            let lastOperationTime = Date.now();

            var sql = `insert or ignore into tstock (tday, ttime, sname,scode,operationDirection, operationName,market,tamount,tprice,
            tcash,tid,taccount, tpair,lastOperationTime) 
        values (?, ?, ?,?, ?, ?,?, ?, ?,?, ?, ?, ?, ?)`;
            let res = await db.runSync(sql, [tday, ttime, sname, scode, operationDirection, operationName, market, tamount, tprice,
                tcash, tid, taccount, tpair, lastOperationTime]);
            if (res.error) {
                info(res.error, req.threadId)
                resp.send(res);
                return;
            } else {
            }

            await insertOrIgnore("tStockBasic", {
                id: scode,
                scode: scode,
                sname: sname,
                buy: tprice,
                updateTime: now
            });
        } else if (broker == "国金流水") {
            fields = fields.concat([""]);
            let tday = fields[0];
            let ttime = "00:00:00";
            let sname = fields[2];
            let scode = fields[1];
            let operationDirection = fields[6];
            let operationName = "国金";
            let market = "HK";
            let tprice = fields[4];
            let tamount = fields[5];
            let tcash = fields[7];
            let taccount = fields[9];
            let tpair = "";

            scode = fixScode(scode);

            if (operationDirection.indexOf("卖") >= 0 && tamount.substring(0, 1) != "-") {
                tamount = "-" + tamount;
            }

            let tid = `${tday}.${ttime}.${scode}.${tprice}`;
            let lastOperationTime = Date.now();

            var sql = `insert or ignore into tstock (tday, ttime, sname,scode,operationDirection, operationName,market,tamount,tprice,
            tcash,tid,taccount, tpair,lastOperationTime) 
        values (?, ?, ?,?, ?, ?,?, ?, ?,?, ?, ?, ?, ?)`;
            let res = await db.runSync(sql, [tday, ttime, sname, scode, operationDirection, operationName, market, tamount, tprice,
                tcash, tid, taccount, tpair, lastOperationTime]);
            if (res.error) {
                info(res.error, req.threadId)
                resp.send(res);
                return;
            } else {
            }

            await insertOrIgnore("tStockBasic", {
                id: scode,
                scode: scode,
                sname: sname,
                buy: tprice,
                updateTime: now
            });
        } else if (broker == "国金当日") {
            //tdx 国金证券
            fields = fields.concat([""]);
            fields[1] = normalizeScode(fields[1]);
            var sql = `insert or ignore into tstock (tday, ttime, sname,scode,operationDirection, operationName,market,tamount,tprice,
            tcash,tid,taccount, tpair,lastOperationTime) 
        values (?, ?, ?,?, ?, ?,?, ?, ?,?, ?, ?, ?, ?)`;
            let tday = timeFormat(new Date(), "yyyyMMdd");
            let ttime = fields[0];
            let res = await db.runSync(sql, [tday, ttime, fields[2], fields[1], fields[4], "国金", getMarket(fields[1]), fields[7], fields[6],
                fields[8], fields[9], fields[11], '', tday + " " + ttime]);
            if (res.error) {
                info(res.error, req.threadId)
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
            let sname = fields[3];
            let scode = normalizeScode(fields[2]);
            let operationDirection = fields[4];
            let operationName = "国金";
            let market = getMarket(fields[2]);
            let tprice = fields[5];
            let tamount = fields[6];
            let tcash = fields[7];
            let taccount = fields[1];
            let tid = `${tday}.${ttime}.${scode}.${tprice}`;
            let tpair = "";

            if (operationDirection.indexOf("卖") >= 0 && tamount.substring(0, 1) != "-") {
                tamount = "-" + tamount;
            }

            let res = await db.runSync(sql, [tday, ttime, sname, scode, operationDirection, operationName, market, tamount, tprice,
                tcash, tid, taccount, tpair, tday + " " + ttime]);
            if (res.error) {
                info(res.error, req.threadId)
                resp.send(res);
                return;
            } else {
            }
            await insertOrReplace("tStockBasic", {
                id: scode,
                scode: scode,
                sname: sname,
                buy: fields[5],
                updateTime: now
            });
        } else if (broker == "国信qmt成交") {
        } else if (broker == "广发当日") {
            //tdx 国金证券
            fields = fields.concat([""]);
            var sql = `insert or ignore into tstock (tday, ttime, sname,scode,operationDirection, operationName,market,tamount,tprice,
            tcash,tid,taccount, tpair,lastOperationTime) 
        values (?, ?, ?,?, ?, ?,?, ?, ?,?, ?, ?, ?, ?)`;
            let tday = timeFormat(new Date(), "yyyyMMdd");
            let ttime = fields[0];
            fields[2] = normalizeScode(fields[2]);

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
                lastOperationTime: Date.now()
            }

            let res = await insertOrReplace("tstock", obj);



            if (res.error) {
                info(res.error, req.threadId)
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
            fields = fields.concat([""]);
            let tday = fields[0];
            let ttime = fields[1];
            let sname = fields[6];
            let scode = fields[5];
            let operationDirection = fields[8];
            let operationName = "国金";
            let market = "HK";
            let tprice = fields[9];
            let tamount = fields[10];
            let tcash = fields[11];
            let taccount = fields[3];
            let tpair = "";

            scode = fixScode(scode);

            if (ttime.length == 7) {
                ttime = "0" + ttime.substring(0, 1) + ":" + ttime.substring(1, 3) + ":" + ttime.substring(3, 5);
            }

            if (operationDirection.indexOf("卖") >= 0 && tamount.substring(0, 1) != "-") {
                tamount = "-" + tamount;
            }

            let tid = `${tday}.${ttime}.${scode}.${tprice}`;
            let lastOperationTime = Date.now();

            var sql = `insert or ignore into tstock (tday, ttime, sname,scode,operationDirection, operationName,market,tamount,tprice,
            tcash,tid,taccount, tpair,lastOperationTime) 
        values (?, ?, ?,?, ?, ?,?, ?, ?,?, ?, ?, ?, ?)`;
            let res = await db.runSync(sql, [tday, ttime, sname, scode, operationDirection, operationName, market, tamount, tprice,
                tcash, tid, taccount, tpair, lastOperationTime]);
            if (res.error) {
                info(res.error, req.threadId)
                resp.send(res);
                return;
            } else {
            }

            await insertOrIgnore("tStockBasic", {
                id: scode,
                scode: scode,
                sname: sname,
                buy: tprice,
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
            let lastOperationTime = Date.now();

            var sql = `insert or ignore into tstock (tday, ttime, sname,scode,operationDirection, operationName,market,tamount,tprice,
            tcash,tid,taccount, tpair,lastOperationTime) 
        values (?, ?, ?,?, ?, ?,?, ?, ?,?, ?, ?, ?, ?)`;
            let res = await db.runSync(sql, [tday, ttime, sname, scode, operationDirection, operationName, market, tamount, tprice,
                tcash, tid, taccount, tpair, lastOperationTime]);
            if (res.error) {
                info(res.error, req.threadId)
                resp.send(res);
                return;
            } else {
            }

            await insertOrIgnore("tStockBasic", {
                id: scode,
                scode: scode,
                sname: sname,
                buy: tprice,
                updateTime: now
            });



        }
    };

    let r = await db.allSync("select max(lastOperationTime) as maxOperationTime, scode from tstock group by scode", [], threadId);
    info(`${r.rows.length} stocks`, req.threadId)
    for (var i = 0; i < r.rows.length; ++i) {
        let row = r.rows[i];
        let scode = row.scode;
        let maxOperationTime = row.maxOperationTime;
        info(`updating ${scode} to ${maxOperationTime}`, req.threadId)
        let sql = `update tstock set lastOperationTime=? where scode=?`;
        await db.runSync(sql, [maxOperationTime, scode]);
    }

    var res = JSON.stringify({ data: "success" });
    resp.send(res);
});

app.get('/stock/account', async (req, res) => {
    let threadId = req.threadId;
    let js = req.query.js;

    let sql = `select * from config where key='stockAccount' `;
    let r = await db.getSync(sql, [], threadId);

    var resp = `${js}(${r.value})`;
    res.send(resp);
});

app.get('/stock/rule/action/startTime', async (req, res) => {
    let js = req.query.js;
    await refreshAutoActionStartTime(req.threadId, true);
    let now = new Date();
    let currentTime = `${add0(now.getHours())}:${add0(now.getMinutes())}`;
    let result = {
        data: {
            startTime: autoActionStartTime.buy.value,
            buyStartTime: autoActionStartTime.buy.value,
            sellStartTime: autoActionStartTime.sell.value,
            currentTime: currentTime
        }
    };
    let resp = JSON.stringify(result);
    if (js) {
        resp = `${js}(${resp})`;
    }
    res.send(resp);
});

app.post('/stock/rule/action/startTime', async (req, res) => {
    await refreshAutoActionStartTime(req.threadId, true);
    let buyStartTime = req.body ? req.body.buyStartTime : null;
    let sellStartTime = req.body ? req.body.sellStartTime : null;

    if (buyStartTime == null && sellStartTime == null) {
        let startTime = req.body ? req.body.startTime : null;
        buyStartTime = startTime;
        sellStartTime = startTime;
    }

    if (buyStartTime == null) {
        buyStartTime = autoActionStartTime.buy.value;
    }
    if (sellStartTime == null) {
        sellStartTime = autoActionStartTime.sell.value;
    }

    let buyResult = normalizeAutoActionStartTime(buyStartTime);
    if (buyResult.error) {
        res.send({ error: buyResult.error });
        return;
    }
    let sellResult = normalizeAutoActionStartTime(sellStartTime);
    if (sellResult.error) {
        res.send({ error: sellResult.error });
        return;
    }

    await db.runSync(`insert or replace into config (key, value) values (?, ?)`, ["autoActionStartTimeBuy", buyResult.value]);
    await db.runSync(`insert or replace into config (key, value) values (?, ?)`, ["autoActionStartTimeSell", sellResult.value]);

    autoActionStartTime.buy = buyResult;
    autoActionStartTime.sell = sellResult;
    autoActionStartTime.loadedAt = Date.now();
    autoActionBlockedLogMinute = {
        buy: -1,
        sell: -1
    };

    res.send({
        data: {
            startTime: autoActionStartTime.buy.value,
            buyStartTime: autoActionStartTime.buy.value,
            sellStartTime: autoActionStartTime.sell.value
        }
    });
});

app.post('/stock/rule/action/tempAllow', async (req, res) => {
    let scode = normalizeScode(req.body ? req.body.scode : null);

    if (scode == null || scode === "") {
        res.send({ error: "bad scode" });
        return;
    }

    let result = grantTempAutoAction(scode);
    info(`temp allow action for ${scode}`, req.threadId);
    res.send({
        data: {
            scode: result.scode
        }
    });
});

app.get('/stock/moveUp', async (req, res) => {
    let js = req.query.js;
    let code = normalizeScode(req.query.code);
    let type = getScodeType(code);
    let sql = `update tstock set lastOperationTime=? where scode=? `;
    let now = Date.now();
    await db.runSync(sql, [now, code]);
    await db.runSync(`update tStockBasic set priority=? where scode=? and type=?`, [now, code, type]);
    await db.runSync(`update tTradeRule set createTime=? where scode=? and type=?`, [now, code, type]);
    var resp = `${js}({})`;
    res.send(resp);
});

function getTradeTimestamp(tday, ttime) {
    if (tday == null || ttime == null) {
        return null;
    }
    tday = `${tday}`.trim();
    ttime = `${ttime}`.trim();
    if (!/^\d{8}$/.test(tday)) {
        return null;
    }

    let parts = ttime.split(":");
    if (parts.length !== 3) {
        let digits = ttime.replace(/\D/g, "");
        if (digits.length === 5) {
            digits = "0" + digits;
        }
        if (digits.length < 6) {
            digits = digits.padEnd(6, "0");
        }
        if (digits.length >= 6) {
            parts = [digits.substring(0, 2), digits.substring(2, 4), digits.substring(4, 6)];
        }
    }
    if (parts.length !== 3) {
        return null;
    }

    let year = parseInt(tday.substring(0, 4));
    let month = parseInt(tday.substring(4, 6));
    let day = parseInt(tday.substring(6, 8));
    let hours = parseInt(parts[0]) || 0;
    let minutes = parseInt(parts[1]) || 0;
    let seconds = parseInt(parts[2]) || 0;
    return new Date(year, month - 1, day, hours, minutes, seconds).getTime();
}

app.get('/stock/resetMove', async (req, res) => {
    let js = req.query.js;
    let code = normalizeScode(req.query.code);
    let type = getScodeType(code);
    let lastTrade = await db.getSync(`select tday, ttime from tstock where scode=? order by tday desc, ttime desc limit 1`, [code], req.threadId);
    if (lastTrade == null) {
        let resp = js ? `${js}(${JSON.stringify({ error: "未找到交易记录" })})` : JSON.stringify({ error: "未找到交易记录" });
        res.send(resp);
        return;
    }

    let lastOperationTime = getTradeTimestamp(lastTrade.tday, lastTrade.ttime);
    if (lastOperationTime == null || Number.isNaN(lastOperationTime)) {
        let resp = js ? `${js}(${JSON.stringify({ error: "交易时间格式无效" })})` : JSON.stringify({ error: "交易时间格式无效" });
        res.send(resp);
        return;
    }

    let sql = `update tstock set lastOperationTime=? where scode=? `;
    await db.runSync(sql, [lastOperationTime, code]);
    await db.runSync(`update tStockBasic set priority=? where scode=? and type=?`, [lastOperationTime, code, type]);
    await db.runSync(`update tTradeRule set createTime=? where scode=? and type=?`, [lastOperationTime, code, type]);
    var resp = `${js}({})`;
    res.send(resp);
});

app.get('/stock/moveDown', async (req, res) => {
    let js = req.query.js;
    let code = normalizeScode(req.query.code);
    let type = getScodeType(code);
    let sql = `update tstock set lastOperationTime=? where scode=? `;
    let now = -1 * Date.now();
    await db.runSync(sql, [now, code]);
    await db.runSync(`update tStockBasic set priority=? where scode=? and type=?`, [now, code, type]);
    await db.runSync(`update tTradeRule set createTime=? where scode=? and type=?`, [now, code, type]);
    var resp = `${js}({})`;
    res.send(resp);
});

app.get('/stock/forceMoveUp', async (req, res) => {
    let js = req.query.js;
    let code = normalizeScode(req.query.code);
    let type = getScodeType(code);
    let sql = `update tstock set lastOperationTime=? where scode=? `;
    let now = Date.now() + 20 * 365 * 24 * 60 * 60 * 1000;
    await db.runSync(sql, [now, code]);
    await db.runSync(`update tStockBasic set priority=? where scode=? and type=?`, [now, code, type]);
    await db.runSync(`update tTradeRule set createTime=? where scode=? and type=?`, [now, code, type]);
    var resp = `${js}({})`;
    res.send(resp);
});

app.get('/stock/forceMoveDown', async (req, res) => {
    let js = req.query.js;
    let code = normalizeScode(req.query.code);
    let type = getScodeType(code);
    let sql = `update tstock set lastOperationTime=? where scode=? `;
    let now = -1 * Date.now() - 20 * 365 * 24 * 60 * 60 * 1000;
    await db.runSync(sql, [now, code]);
    await db.runSync(`update tStockBasic set priority=? where scode=? and type=?`, [now, code, type]);
    await db.runSync(`update tTradeRule set createTime=? where scode=? and type=?`, [now, code, type]);
    var resp = `${js}({})`;
    res.send(resp);
});


app.get('/stock/updatePrice', async (req, res) => {
    let js = req.query.js;
    let scode = normalizeScode(req.query.scode);
    let price = req.query.price;
    let time = req.query.time;
    if (time == null) {
        time = Date.now();
    }

    updatePriceToRule(scode, price);
    await updateStockBasicByScode({ scode: scode, buy: price, updateTime: time }, req.threadId);
    checkRule([scode], req);
    var resp = `${js}({})`;
    res.send(resp);
});

app.get('/stock/updatePrice/option', async (req, res) => {
    let js = req.query.js;
    let scode = normalizeScode(req.query.scode);
    let price = req.query.price;
    let time = req.query.time;
    if (time == null) {
        time = Date.now();
    }

    //updatePriceToRule(scode, price);

    await updateStockBasicByScode({ scode: scode, buy: price, updateTime: time, type: 1 });
    //checkRule([scode]);
    var resp = `${js}({})`;
    res.send(resp);
});

app.get('/stock/intros', async (req, res) => {
    let scodes = (req.query.scodes || "").split(",").map((item) => normalizeScode(item)).filter((item) => item);
    let uniqueScodes = [];
    scodes.forEach((scode) => {
        if (!uniqueScodes.includes(scode)) {
            uniqueScodes.push(scode);
        }
    });

    if (uniqueScodes.length < 1) {
        res.send(JSON.stringify({ data: {} }));
        return;
    }

    let queryScodes = [];
    uniqueScodes.forEach((scode) => {
        getScodeAliases(scode).forEach((item) => {
            if (!queryScodes.includes(item)) {
                queryScodes.push(item);
            }
        });
    });

    let placeholders = queryScodes.map(() => "?").join(",");
    let result = await db.allSync(`select scode, id, intro from tStockBasic where scode in (${placeholders}) or id in (${placeholders})`, queryScodes.concat(queryScodes), req.threadId);
    if (result.error) {
        res.send(JSON.stringify(result));
        return;
    }

    normalizeDbRowsScodes(result.rows);
    let data = {};
    uniqueScodes.forEach((scode) => {
        data[scode] = "";
    });
    result.rows.forEach((row) => {
        let scode = normalizeScode(row.scode || row.id);
        if (scode) {
            data[scode] = row.intro || "";
        }
    });

    res.send(JSON.stringify({ data }));
});

app.post('/stock/intro/update', async (req, res) => {
    let scode = normalizeScode(req.body.scode);
    let intro = req.body.intro == null ? "" : `${req.body.intro}`.trim();
    let updateTime = Date.now();

    if (scode == null || scode == "") {
        res.send(JSON.stringify({ error: "scode required" }));
        return;
    }

    let result = await updateStockBasicByScode({ scode: scode, intro: intro, updateTime: updateTime });

    if (result && result.error) {
        res.send(JSON.stringify(result));
        return;
    }

    res.send(JSON.stringify({
        data: {
            scode,
            intro
        }
    }));
});

app.post('/stock/future/leverage/update', async (req, res) => {
    let scode = normalizeScode(req.body.scode);
    let leverage = parseInt(req.body.leverage, 10);
    let updateTime = Date.now();

    if (scode == null || scode == "" || !scode.startsWith("O_")) {
        res.send(JSON.stringify({ error: "future scode required" }));
        return;
    }

    if (!Number.isInteger(leverage) || leverage <= 0) {
        res.send(JSON.stringify({ error: "invalid leverage" }));
        return;
    }

    let updateResult = await updateStockBasicByScode({
        scode: scode,
        leverage: leverage,
        updateTime: updateTime,
        type: 1
    }, req.threadId);
    if (updateResult && updateResult.error) {
        res.send(JSON.stringify(updateResult));
        return;
    }

    let actionResult = await queueFutureLeverageAction(scode, leverage, "BNB", req.threadId);
    if (actionResult && actionResult.error) {
        res.send(JSON.stringify(actionResult));
        return;
    }

    res.send(JSON.stringify({
        data: {
            scode,
            leverage,
            broker: "BNB"
        }
    }));
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
    info(JSON.stringify(req.body), req.threadId)
    let passcode = req.body.passcode;
    if (passcode != "995560") {
        info("bad request", req.threadId)
        res.send("bad request");
        return;
    }
    let data = req.body.data;
    info(data, req.threadId)
    let sql = `insert or replace into config (key, value) values (?,?)`;
    let result = await db.runSync(sql, ["stockAccount", JSON.stringify(data)]);
    var resp = JSON.stringify({ data: "success" });
    res.send(resp);
});


function fixScode(scode, minLength) {
    return normalizeScode(scode, minLength);
}

async function dbCall(options, threadId) {
    for (let i = 0; i < options.length; ++i) {
        let stat = options[i];
        if (isArray(stat)) {
            let sql = stat[0];
            let params = stat[1];
            debug("dbCall sql:" + sql, threadId);
            debug("params:" + JSON.stringify(params), threadId);
            let res = await db.runSync(sql, params, threadId);
            if (res.error) {
                return res;
            }
        } else {
            debug("sql:" + stat, threadId);
            let res = await db.runSync(stat, null, threadId);
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
    let threadId = Date.now();
    let res = await db.getSync("SELECT * FROM config where key=?", "dbVersion", threadId);
    var updates = [
        `alter table tStockBasic add column MinLimitOrderVolume int default 100;`,
        `alter table t1d add column kdj_k real default 0;`,
        `alter table t1d add column kdj_d real default 0;`,
        `alter table t1d add column kdj_j real default 0;`,
        `alter table t1d add column boll_u real default 0;`,
        `alter table t1d add column boll_m real default 0;`,
        `alter table t1d add column boll_l real default 0;`,
        `alter table t1d add column range real default 0;`,
        `alter table tstock drop column lastOperationTime;`,
        `alter table tstock add column lastOperationTime int default 0;`,
        `create table t1w(id text primary key, scode text, time text, open real, close real, high real, low real, volume int, amount real, type int default 0);`,
        `create table t1mon(id text primary key, scode text, time text, open real, close real, high real, low real, volume int, amount real, type int default 0);`,
        `create table openwrt(id text primary key, ip text, mac text, host text, online int default 0, time integer);`,
        `create table openwrt_onlines(id text primary key, ip text, mac text, host text, status text, time integer);`,
        `alter table openwrt_onlines add column startTime integer;`,
        `alter table tStockBasic add column intro text default '';`,
        `alter table tStockBasic add column type int default 0;`,
        `update tStockBasic set type=1 where optionPrice is not null or optionUpdateTime is not null;`,
        `alter table tStockBasic drop column optionPrice;`,
        `alter table tStockBasic drop column optionUpdateTime;`,
        `alter table tRuleAction add column type int default 0;`,
        `update tRuleAction set type=1 where substr(upper(trim(scode)), 1, 2)='O_';`,
        `alter table tTradeRule add column type int default 0;`,
        `update tTradeRule set type=1 where substr(upper(trim(scode)), 1, 2)='O_';`,
        `alter table tStockBasic add column leverage int default 5;`,
        `alter table tStockBasic add column dip real default 0.02;`,
        `alter table tStockBasic add column bounce real default 0.02;`,
    ];

    if (res == null || res.error) {
        res = await db.runSync(`
CREATE TABLE config(key varchar(50) primary key, value text);
CREATE TABLE t1d(id text primary key, scode text, time text, open real, close real, high real, low real, volume int, amount real, type int default 0, cci INTEGER DEFAULT -800);
CREATE TABLE t1m(id text primary key, scode text, time text, open real, close real, high real, low real, volume int, amount real, type int default 0);
CREATE TABLE t5m(id text primary key, scode text, time text, open real, close real, high real, low real, volume int, amount real);
CREATE TABLE tRuleAction(id text primary key, ruleId text, scode text,sname text, action text, price real, amount real, orderNo text, done int default 0, createTime integer, broker text default '', status text default '');
CREATE TABLE tStockBasic (
        id text primary key,
        scode text,
        sname text,
        buy real default 0,
        sell real default 0,
        updateTime integer
    , priority int default 0, volumeMultiple int default 100, upStopPrice real default 0, downStopPrice real default 0, totalVolume real default 0, floatVolume real default 0, bNotProfitable real default 0, market text, LastVolume real, optionPrice real, optionUpdateTime int, autoCreateRuleFail text);
CREATE TABLE tStockPrice (
        id text primary key,
        scode text,
        sname text,
        delta real default 0,
        price real default 0,
        ratio real default 0,
        ratio1 real default 0,
        updateTime integer);
CREATE TABLE tTradeRule(id text primary key, scode text, sname text, rule text, createTime integer, closed integer default 0, broker text, expireTime int);
CREATE TABLE tallstock(id text primary key, scode text, sname text, sector text, priority int default 0, updateTime integer);
CREATE TABLE tcandidate(id text primary key, scode text, sname text, priority int default 0, updateTime integer);
CREATE TABLE tpositions(id text primary key, broker text, account_id text, avg_price real, can_use_volume real, frozen_volume real, market_value real, on_road_volume real, open_price real, stock_code text, volume real, updateTime integer, floatProfit real default 0, type int default 0);
CREATE TABLE tsql (
        id text primary key,
        name text,
        sql text,
        lastUseTime integer
    , params text);
CREATE TABLE tstock (
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
        tpair text
    , lastOperationTime text, deleted int default 0, type int default 0);
CREATE TABLE ttick(id text primary key, scode text, time int, data text);`);

        await db.runSync("insert into config values('dbVersion', 0);");
    } else {
        debug(JSON.stringify(res));
        var ver = parseInt(res.value);
        updates.splice(0, ver);

        for (let i = 0; i < updates.length; ++i) {
            let sql = updates[i];
            let res = await db.runSync(sql);
            if (res.error) {
                error(res.error);
                return res;
            }

            sql = `update config set value='${ver + i + 1}' where key='dbVersion';`;
            await db.runSync(sql);
        }

        let row = await db.getSync("SELECT * FROM config where key=?", ["dbVersion"], threadId);
        if (row == null) {
            debug("dbVersion:null");
        } else {
            debug("dbVersion:" + row.value);
        }
    }
}

async function insertOrReplace(table, row, threadId) {
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

    return await dbCall([[sql, vals]], threadId);
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
    info(JSON.stringify(root), req.threadId)
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
        debug(`getChildProperty:${path}.${key}`, req.threadId)
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
        debug("isGfStatus", req.threadId)
        var node = findNodeById(root, "com.gf.client:id/refresh_child");
        if (node) {
            debug("refresh_child found", req.threadId)
            for (let i = 0; ; i++) {
                let sname = getChildProperty(node, `1.${i}.0.0.0`, "text");
                let scode = getChildProperty(node, `1.${i}.0.0.1.0`, "text");
                let price = getChildProperty(node, `2.1.2.${i * 4}.0`, "text");
                let delta = getChildProperty(node, `2.1.2.${i * 4 + 1}.0`, "text");
                let ratio = getChildProperty(node, `2.1.2.${i * 4 + 2}.0.0`, "text");
                let ratio1 = getChildProperty(node, `2.1.2.${i * 4 + 3}.0`, "text");
                scodes.push(scode);
                debug(`${i}:${sname}(${scode}),${price},${delta},${ratio},${ratio1}`, req.threadId)
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
        price.scode = normalizeScode(price.scode);
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
        stock.scode = normalizeScode(stock.scode);
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

    let now = timeFormat(Date.now(), "yyMMddhhmm");
    now = parseInt(now);
    for (let i = 0; i < stocks.length; i++) {
        let stock = stocks[i];
        let scode = normalizeScode(stock[0]);
        let row = {
            id: scode,
            scode: scode,
            sname: stock[1],
            priority: now,
            updateTime: now
        }
        await insertOrReplace("tcandidate", row);
    }

    let resp = JSON.stringify({});
    res.send(resp);
});

app.post('/stock/positions', async (req, res) => {

    info(JSON.stringify(req.body), req.threadId)
    let passcode = req.body.passcode;
    if (passcode != "995560") {
        info("bad request", req.threadId)
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

        pos.stock_code = normalizeScode(pos.stock_code);
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
        resp = await db.allSync(`select * from tPositions`, [], req.threadId);
        normalizeDbRowsScodes(resp.rows);
        resp = JSON.stringify({ data: resp.rows });
    } else {
        let aliases = getScodeAliases(scode);
        let placeholders = aliases.map(() => "?").join(",");
        resp = await db.allSync(`select * from tPositions where stock_code in (${placeholders})`, aliases, req.threadId);
        normalizeDbRowsScodes(resp.rows);
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
        resp = await db.allSync(`select * from tstock`, [], req.threadId);
        normalizeDbRowsScodes(resp.rows);
        resp = JSON.stringify({ data: resp.rows });
    } else {
        let aliases = getScodeAliases(scode);
        let placeholders = aliases.map(() => "?").join(",");
        let sql = `select * from tstock where scode in (${placeholders}) and type=? and deleted=0 order by tday desc, ttime desc`;
        if (all == 1) {
            sql = `select * from tstock where scode in (${placeholders}) and type=? order by tday desc, ttime desc`;
        }
        resp = await db.allSync(sql, aliases.concat([type]), req.threadId);
        normalizeDbRowsScodes(resp.rows);
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
    let threadId = req.threadId;
    info(JSON.stringify(req.body), req.threadId);
    let passcode = req.body.passcode;
    if (passcode != "995560") {
        info("bad request", req.threadId);
        res.send("bad request");
        return;
    }

    let data = req.body.data;
    Object.keys(data).forEach(async (scode) => {
        let v = data[scode];
        scode = normalizeScode(scode);
        Object.keys(v).forEach(async (time) => {
            let v1 = v[time];
            let updateTime = parseTime(time).getTime();
            let price = v1.lastPrice;
            if (price == 0) {

            } else {
                updatePriceToRule(scode, price);
                await updateStockBasicByScode({ scode: scode, buy: price, updateTime: updateTime }, threadId);

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
    let threadId = req.threadId;
    info(JSON.stringify(req.body), threadId);
    let passcode = req.body.passcode;
    if (passcode != "995560") {
        info("bad request", req.threadId);
        res.send("bad request");
        return;
    }

    let data = req.body.data;
    Object.keys(data).forEach(async (scode) => {
        let v1 = data[scode];
        scode = normalizeScode(scode);
        let updateTime = v1.time;
        let price = v1.lastPrice;

        if (price == 0) {
        } else {
            updatePriceToRule(scode, price);
            await updateStockBasicByScode({ scode: scode, buy: price, updateTime: updateTime }, threadId);
        }
    })

    setTimeout(function () { checkRule(Object.keys(data), req) }, 100);

    res.send("ok");
});

app.post('/stock/details', async (req, res) => {

    info(JSON.stringify(req.body), req.threadId);
    let passcode = req.body.passcode;
    if (passcode != "995560") {
        info("bad request", req.threadId);
        res.send("bad request");
        return;
    }

    let data = req.body.data;
    let updateTime = Date.now();
    data.forEach(async (row) => {
        let sql = `update tStockBasic set sname=?, market=?, LastVolume=?, TotalVolume=?, FloatVolume=?,    UpStopPrice=?,   DownStopPrice=?,   VolumeMultiple=?, 
        MinLimitOrderVolume=?, 
        bNotProfitable=?,
        updateTime=? 
        where scode in (${getScodeAliases(row.scode).map(() => "?").join(",")})`;
        await db.runSync(sql, [row.sname, row.ExchangeID, row.LastVolume, row.TotalVolume, row.FloatVolume, row.UpStopPrice, row.DownStopPrice, row.VolumeMultiple, row.MinLimitOrderVolume, row.bNotProfitable, updateTime].concat(getScodeAliases(row.scode)));
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
        info("logLevel to " + log, req.threadId);
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
    let threadId = req.threadId;
    let js = req.query.js;
    let json = JSON.parse(req.query.json);
    json.scode = normalizeScode(json.scode);
    json.type = normalizeType(json.type, json.scode);
    json.dip = normalizeRuleRatio(json.dip, 0.02);
    json.bounce = normalizeRuleRatio(json.bounce, 0.02);
    let now = Date.now();

    let sql = `insert or replace into tTradeRule(id, broker, scode, sname, rule, createTime, expireTime, type) values(?,?,?,?,?,?,?,?)`;
    let broker = json.broker;
    let calc = eval(json.expireHours);
    let expireHours = parseFloat(calc);
    let expireTime = now + expireHours * 60 * 60 * 1000;
    if (expireHours == 0) {
        //将expireTime设置为当天15:01
        expireTime = new Date();
        expireTime.setHours(16, 10, 0, 0);
        expireTime = expireTime.getTime();
    }

    let ruleId = `${json.scode}.${broker}`;

    let aliases = getScodeAliases(json.scode);
    let placeholders = aliases.map(() => "?").join(",");
    let stockBasicInfo = await getStockBasicByScode(json.scode, json.type, threadId);
    if (stockBasicInfo && broker != "OKX" && broker != "BNB") {
        if (stockBasicInfo.volumeMultiple == 1) {
            stockBasicInfo.volumeMultiple = 100;
        }

        if (json.buyAmount > 0 && json.buyAmount < stockBasicInfo.volumeMultiple) {
            json.buyAmount = stockBasicInfo.volumeMultiple
        }
        if (json.sellAmount > 0 && json.sellAmount < stockBasicInfo.volumeMultiple) {
            json.sellAmount = stockBasicInfo.volumeMultiple
        }
    }

    if (json.buyDelta == null) {
        json.buyDelta = json.sell - json.buy;
    }

    if (json.sellDelta == null) {
        json.sellDelta = json.buyDelta;
    }

    let result = await db.runSync(sql, [ruleId, broker, json.scode, json.sname, JSON.stringify(json), now, expireTime, json.type]);
    await db.runSync(`delete from tRuleAction where type=? and scode in (${placeholders}) and broker=?`, [json.type].concat(aliases, [broker]));
    if (rules[json.scode] == null) {
        rules[json.scode] = {};
    }

    rules[json.scode][broker] = await db.getSync(`select * from tTradeRule where type=? and scode in (${placeholders}) and broker=?`, [json.type].concat(aliases, [broker]), threadId);
    await reloadRule(rules[json.scode][broker], req);

    let market = getMarket(json.scode);
    let buy = 0;
    if (rules[json.scode][broker] && rules[json.scode][broker].rule) {
        buy = rules[json.scode][broker].rule.currentPrice;
    }
    await updateStockBasicByScode({
        scode: json.scode,
        sname: json.sname,
        market: market,
        buy: buy,
        dip: json.dip,
        bounce: json.bounce,
        priority: now,
        updateTime: now,
        type: json.type
    }, threadId);

    let r = await db.allSync(`select * from tStock where scode in (${placeholders}) and deleted=0 and tamount<>0`, aliases, threadId);
    if (r.rows.length == 0) {
        let tday = timeFormat(now, "yyyyMMdd");
        let ttime = timeFormat(now, "hh:mm:ss");
        let obj = {
            tday,
            ttime,
            sname: json.sname,
            scode: json.scode,
            operationDirection: "卖出",
            operationName: broker,
            market: market,
            tamount: 0,
            tprice: json.sell,
            tcash: 0,
            tid: `${json.scode}.${json.sname}`,
            taccount: "",
            tpair: "",
            deleted: 0,
            lastOperationTime: Date.now()
        }
        await insertOrReplace("tstock", obj);
        await checkRule([json.scode], req);
        //await db.runSync(`update tStock set lastOperationTime=? where scode=?`, [obj.lastOperationTime, obj.scode]);

    }

    wss.callFunc("国金", "reloadStockCodes", {});
    wss.callFunc("国金", "updateDetail", { scode: formatScode(json.scode) });
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

async function autoCreateRules(threadId) {
    if (threadId == null) {
        threadId = Date.now();
    }

    try {
        let sql = `select * from tStockBasic`;
        if (workerCreateRule.scode) {
            sql = `select * from tStockBasic where scode='${workerCreateRule.scode}'`;
        }

        let res = await db.allSync(sql, [], threadId);
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
                info(result.error, threadId)
                await saveCreateRuleFailure(scode, result.error);
                workerCreateRule.failed.push({ scode, sname, reason: result.error });
            }
        }

        info(`auto create rule succeeded`, threadId)
    } catch (e) {
        error(e.message, threadId);
        error(e.stack, threadId);
        info(`auto create rule failed:${e}`, threadId)
    }

    rules = {};
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

    let succeeded = [];
    let failed = [];
    let done = 0;
    if (scode == null) {
        if (workerCreateRule.id == 0) {
            if (workerCreateRule.succeeded.length + workerCreateRule.failed.length == 0) {
                workerCreateRule.max = max;
                workerCreateRule.type = type;
                workerCreateRule.priceDelay = priceDelay;
                workerCreateRule.id = setTimeout(function () {
                    autoCreateRules(req.threadId);
                }, 100);
            } else {
                done = 1;
                succeeded = workerCreateRule.succeeded;
                workerCreateRule.succeeded = [];
                failed = workerCreateRule.failed;
                workerCreateRule.failed = [];
            }
        } else {
            succeeded = workerCreateRule.succeeded;
            workerCreateRule.succeeded = succeeded.length == 0 ? [] : [succeeded[succeeded.length - 1]];
            failed = workerCreateRule.failed;
            workerCreateRule.failed = failed.length == 0 ? [] : [failed[failed.length - 1]];
        }
    } else {
        let result = await autoCreateRule(scode, req.threadId, null, true);
        if (result.error == null) {
            await saveCreateRuleFailure(scode, "");
            succeeded.push({ scode, sname: result.sname });
            reloadRule(result.rule, req);
        } else {
            info(result.error, req.threadId)
            await saveCreateRuleFailure(scode, result.error);
            failed.push({ scode, sname: result.sname, reason: result.error });
        }

        done = 1;
    }

    var resp = JSON.stringify({
        succeeded: succeeded,
        failed: failed,
        done
    });
    if (js) {
        resp = `${js}(${resp})`;
    }

    res.send(resp);
});

app.get('/stock/k/1m', async (req, res) => {
    let js = req.query.js;
    let threadId=req.threadId;
    info(JSON.stringify(req.query), req.threadId);
    let scode = normalizeScode(req.query.scode);
    let type = req.query.type;
    let day = req.query.day;
    if (day == null) {
        day = new Date();
        //day.setMonth(4, 30);
    } else {
        day = new Date(parseInt(day));
    }

    await forceUpdate1m(scode, threadId);
    day.setHours(0, 0, 0, 0);
    let nextDay = new Date(day.getTime() + 24 * 60 * 60 * 1000);
    day = timeFormat(day, "yyyyMMdd")
    nextDay = timeFormat(nextDay, "yyyyMMdd")
    let aliases = getScodeAliases(scode);
    let placeholders = aliases.map(() => "?").join(",");
    let sql = `select * from t1m where scode in (${placeholders}) and type=? and time > ? and time < ? order by scode, time`;
    let result = await db.allSync(sql, aliases.concat([type, day, nextDay]), req.threadId);
    normalizeDbRowsScodes(result.rows);

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
    info(JSON.stringify(req.query), req.threadId)
    let scode = normalizeScode(req.query.scode);
    let broker = req.query.broker;
    let force = req.query.force == 1 || req.query.force == "1";
    let now = Date.now();
    if (force) {
        let aliases = getScodeAliases(scode);
        let placeholders = aliases.map(() => "?").join(",");
        let deleteResult = await db.runSync(`delete from t1d where scode in (${placeholders})`, aliases, req.threadId);
        if (deleteResult && deleteResult.error) {
            let resp = JSON.stringify(deleteResult);
            if (js) {
                resp = `${js}(${resp})`;
            }
            res.send(resp);
            return;
        }
    }

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
        createTime: now,
        type: getScodeType(scode)
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

async function forceUpdate1m(scode, threadId) {
    let lastMinute=await getLastMinute(scode, threadId);
    try {
        await wss.callFunc("国金", "forceUpdate1m", { scode: formatScode(scode), lastMinute });
    } catch (e) {
        error("update1m error:" + e.message, threadId);
    }
}

async function sendDayLikeKLine(res, req, tableName) {
    let threadId = req.threadId;
    let js = req.query.js;
    info(JSON.stringify(req.query), req.threadId)
    let scode = normalizeScode(req.query.scode);
    let type = req.query.type;
    let max = req.query.max;
    let startDay = req.query.startDay;
    let endDay = req.query.endDay;
    if (endDay == null) {
        endDay = new Date();
    } else {
        endDay = new Date(parseInt(endDay));
    }
    let interval = 24 * 60 * 60 * 1000;
    if (tableName == "t1mon") {
        interval = 31 * 24 * 60 * 60 * 1000;
    } else if (tableName == "t1w") {
        interval = 7 * 24 * 60 * 60 * 1000;
    }

    if (startDay == null) {
        startDay = new Date();
        if (max) {
            startDay = new Date(startDay.getTime() - max * interval);
        } else {
            startDay.setYear(endDay.getFullYear() - 4);
        }
    } else {
        startDay = new Date(parseInt(startDay));
    }

    startDay = timeFormat(startDay, "yyyyMMdd");
    endDay = timeFormat(endDay, "yyyyMMdd");

    let aliases = getScodeAliases(scode);
    let placeholders = aliases.map(() => "?").join(",");
    let sql = `select * from ${tableName} where scode in (${placeholders}) and type=? and time >= ? and time <= ? order by time`;
    let result = await db.allSync(sql, aliases.concat([type, startDay, endDay]), threadId);
    normalizeDbRowsScodes(result.rows);
    let resp;
    if (result.error) {
        resp = JSON.stringify(result);
    } else {
        let sb = await getStockBasicByScode(scode, type, threadId);
        resp = JSON.stringify({
            stockBasic: sb,
            rows: result.rows
        });
    }

    if (js) {
        resp = `${js}(${resp})`;
    }

    res.send(resp);
}

async function sendDayLikeKLines(res, req, tableName) {
    let js = req.query.js;
    info(JSON.stringify(req.query), req.threadId)
    let scodes = req.query.scodes;
    let type = req.query.type;
    let startDay = req.query.startDay;
    let endDay = req.query.endDay;
    if (endDay == null) {
        endDay = new Date();
    } else {
        endDay = new Date(parseInt(endDay));
    }

    if (startDay == null) {
        let days = 30;
        if (tableName == "t1w") {
            days = 365 * 3;
        } else if (tableName == "t1mon") {
            days = 365 * 8;
        }
        startDay = new Date(endDay.getTime() - days * 24 * 60 * 60 * 1000);
    } else {
        startDay = new Date(parseInt(startDay));
    }

    startDay = timeFormat(startDay, "yyyyMMdd");
    endDay = timeFormat(endDay, "yyyyMMdd");

    let queryScodes = [];
    scodes.split(',').forEach((scode) => {
        getScodeAliases(scode).forEach((item) => {
            if (!queryScodes.includes(item)) {
                queryScodes.push(item);
            }
        });
    });
    let sql = `select * from ${tableName} where scode in ('${queryScodes.join("','")}') and type=? and time >= ? and time <= ? order by scode,time`;
    let result = await db.allSync(sql, [type, startDay, endDay], req.threadId);
    normalizeDbRowsScodes(result.rows);

    var resp = JSON.stringify(result.rows);
    if (result.error) {
        resp = JSON.stringify(result);
    }

    if (js) {
        resp = `${js}(${resp})`;
    }

    res.send(resp);
}

app.get('/stock/k/1d', async (req, res) => {
    let threadId = req.threadId;
    let js = req.query.js;
    info(JSON.stringify(req.query), req.threadId)
    let scode = normalizeScode(req.query.scode);
    let type = req.query.type;
    let max = req.query.max;
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
        if (max) {
            startDay = new Date(startDay.getTime() - max * 24 * 60 * 60 * 1000);
        } else {
            startDay.setYear(endDay.getFullYear() - 4);
        }
        //day.setMonth(4, 30);
    } else {
        startDay = new Date(parseInt(startDay));
    }

    startDay = timeFormat(startDay, "yyyyMMdd");
    endDay = timeFormat(endDay, "yyyyMMdd");
    await forceUpdate1d(scode, req.threadId);

    let aliases = getScodeAliases(scode);
    let placeholders = aliases.map(() => "?").join(",");
    let sql = `select * from t1d where scode in (${placeholders}) and type=? and time >= ? and time <= ? order by time`;
    let result = await db.allSync(sql, aliases.concat([type, startDay, endDay]), threadId);
    normalizeDbRowsScodes(result.rows);
    if (result.error) {
        resp = JSON.stringify(result);
    } else {
        let sb = await getStockBasicByScode(scode, type, threadId);
        resp = JSON.stringify({
            stockBasic: sb,
            rows: result.rows
        });
    }

    if (js) {
        resp = `${js}(${resp})`;
    }

    res.send(resp);
});

app.get('/stock/k/1w', async (req, res) => {
    await sendDayLikeKLine(res, req, "t1w");
});

app.get('/stock/k/1mon', async (req, res) => {
    await sendDayLikeKLine(res, req, "t1mon");
});

app.get('/stock/k/1ds', async (req, res) => {
    let js = req.query.js;
    info(JSON.stringify(req.query), req.threadId)
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

    let queryScodes = [];
    scodes.split(',').forEach((scode) => {
        getScodeAliases(scode).forEach((item) => {
            if (!queryScodes.includes(item)) {
                queryScodes.push(item);
            }
        });
    });
    let sql = `select * from t1d where scode in ('${queryScodes.join("','")}') and type=? and time >= ? and time <= ? order by scode,time`;
    let result = await db.allSync(sql, [type, startDay, endDay], req.threadId);
    normalizeDbRowsScodes(result.rows);

    var resp = JSON.stringify(result.rows);
    if (result.error) {
        resp = JSON.stringify(result);
    }

    if (js) {
        resp = `${js}(${resp})`;
    }

    res.send(resp);
});

app.get('/stock/k/1ws', async (req, res) => {
    await sendDayLikeKLines(res, req, "t1w");
});

app.get('/stock/k/1mons', async (req, res) => {
    await sendDayLikeKLines(res, req, "t1mon");
});

app.get('/stock/k/1ms', async (req, res) => {
    let js = req.query.js;
    info(JSON.stringify(req.query), req.threadId)
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

    let queryScodes = [];
    scodes.split(',').forEach((scode) => {
        getScodeAliases(scode).forEach((item) => {
            if (!queryScodes.includes(item)) {
                queryScodes.push(item);
            }
        });
    });
    let sql = `select * from t1m where scode in ('${queryScodes.join("','")}') and type=? and time >= ? and time <= ? order by scode,time`;
    let result = await db.allSync(sql, [type, day, nextDay], req.threadId);
    normalizeDbRowsScodes(result.rows);

    var resp = JSON.stringify(result.rows);
    if (result.error) {
        resp = JSON.stringify(result);
    }

    if (js) {
        resp = `${js}(${resp})`;
    }

    res.send(resp);
});

async function forceUpdate1d(scode, threadId) {
    let r = await get1dLastDate(scode, threadId);
    try {
        await wss.callFunc("国金", "forceUpdate1d", { scode: formatScode(scode), lastDate: r.lastDate });
        // await genCci(scode, req);
    } catch (e) {
        error(e.stack, threadId);
    }
}

async function cancelAction(rule) {
    info("cancelAction:" + rule.scode);
    if (rule.actions.length > 0) {
        let oa = rule.actions[0];
        let now = Date.now();
        let action = {
            id: `${oa.ruleId}-cancelAction`,
            ruleId: oa.ruleId,
            broker: oa.broker,
            scode: oa.scode,
            sname: oa.scode,
            action: "cancelAction",
            price: 0,
            amount: 0,
            orderNo: oa.orderNo,
            done: 0,
            createTime: now,
            type: normalizeType(rule.type, oa.scode)
        }

        let result = await insertOrReplace("tRuleAction", action);

    }
}

app.get('/stock/rule/cancel', async (req, res) => {
    info(JSON.stringify(req.query), req.threadId)
    let js = req.query.js;
    let scode = normalizeScode(req.query.scode);
    let type = getScodeType(scode);
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
        cancelled = "";
        params = [];
    } else if (all == "A股") {
        sql = `update tTradeRule set closed = 1 where scode in (select scode from tstockbasic where market in ('BJ','SH','SZ') and type=0)`;
        cancelled = "";
        params = [];
    } else if (all == "H股") {
        sql = `update tTradeRule set closed = 1 where scode in (select scode from tstockbasic where market in ('HK') and type=0)`;
        cancelled = "";
        params = [];
    } else if (all == "BNB") {
        sql = `update tTradeRule set closed = 1 where scode in (select scode from tstockbasic where market in ('EC') and type=0)`;
        cancelled = "";
        params = [];
    } else if (all == "待买") {
        sql = `update tTradeRule set closed = 1 where rule like '%buyFirst%'`;
        cancelled = "";
        params = [];
    } else if (all == "待卖") {
        sql = `update tTradeRule set closed = 1 where rule like '%sellFirst%'`;
        cancelled = "";
        params = [];
    }

    let result = await db.runSync(sql, params);

    if (result.error == null) {
        if (all == 1) {
            sql = `update tRuleAction set done = -1 `;
            result = await db.runSync(sql, []);
        } else if (all == "A股") {
            sql = `update tRuleAction set done = -1 where type=0 and scode in (select scode from tstockbasic where market in ('BJ','SH','SZ') and type=0)`;
            result = await db.runSync(sql, []);
        } else if (all == "H股") {
            sql = `update tRuleAction set done = -1 where type=0 and scode in (select scode from tstockbasic where market in ('HK') and type=0)`;
            result = await db.runSync(sql, []);
        } else if (all == "BNB") {
            sql = `update tRuleAction set done = -1 where type=0 and scode in (select scode from tstockbasic where market in ('EC') and type=0)`;
            result = await db.runSync(sql, []);
        } else if (all == "待买") {
            sql = `update tRuleAction set done = -1 where action='buy'`;
            result = await db.runSync(sql, []);
        } else if (all == "待卖") {
            sql = `update tRuleAction set done = -1 where action='sell'`;
            result = await db.runSync(sql, []);
        } else {
            sql = `update tRuleAction set done = -1 where ruleId=? and type=?`;
            result = await db.runSync(sql, [ruleId, type]);
        }
    }

    if (result.error == null) {
        if (all == null) {
            if (rules[scode] && rules[scode][broker]) {
                await cancelAction(rules[scode][broker]);
                reloadRule(rules[scode][broker], req);
            }
        } else {
            for (let scode in Object.keys(rules)) {
                let sbs = rules[scode];
                if (sbs == null) continue;
                for (let broker in Object.keys(sbs)) {
                    let rule = sbs[broker];
                    await cancelAction(rule);
                }
            }

            rules = {}
            reloadRules();
        }
    }

    var resp = JSON.stringify({});


    if (js) {
        resp = `${js}(${resp})`;
    }

    res.send(resp);
});

app.get('/stock/rule/delete', async (req, res) => {
    let js = req.query.js;
    let id = req.query.id;
    let scode = normalizeScode(req.query.scode);
    let type = getScodeType(scode);
    let broker = req.query.broker;
    let now = Date.now();
    if (rules[scode] && rules[scode][broker]) {
        delete rules[scode][broker];
    }

    let aliases = getScodeAliases(scode);
    let placeholders = aliases.map(() => "?").join(",");
    let sql = `delete from tTradeRule where type=? and scode in (${placeholders}) and broker=?`;
    let result = await db.runSync(sql, [type].concat(aliases, [broker]));

    if (result.error == null) {
        sql = `delete from tRuleAction where type=? and scode in (${placeholders}) and broker=?`;
        result = await db.runSync(sql, [type].concat(aliases, [broker]));
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
    let sql = `select * from tRuleAction where (broker=?) and done=0`;
    let r = await db.allSync(sql, [broker], req.threadId);
    r.rows.forEach(async (row) => {
        let nc = formatScode(row.scode);
        if (nc == null) {

        } else {
            row.scode = nc;
        }
    });

    for (let i = 0; i < g.actions.length;) {
        let element = g.actions[i];
        if (element.broker == broker) {
            r.rows.push(element);
            //从g.actions里删除element;
            g.actions.splice(i, 1);
        } else {
            ++i;
        }
    }

    let filteredRows = [];
    for (let row of r.rows) {
        if (await allowAutoCreateAction(req, row)) {
            filteredRows.push(row);
        } else {
            info(`${row.scode} is filtered`);
        }
    }

    var resp = JSON.stringify({ data: filteredRows });

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
    let threadId = req.threadId;
    let sql = `update tRuleAction set done=1 where id=?`;
    let r = await db.runSync(sql, [id]);
    let ra = await db.getSync(`select * from tRuleAction where ruleId = '${r.id}' order by createTime desc limit 1`, [], threadId);
    if (ra) {
        let scode = ra.scode;
        let broker = ra.broker;
        if (rules[scode] && rules[scode][broker]) {
            rules[scode][broker].status = "ordered";
        }
    }

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
    let threadId = req.threadId;
    let js = req.query.js;
    let scode = normalizeScode(req.query.scode);
    info("scode:" + scode, threadId);
    let result = {};
    if (scode == null) {
        result.data = rules;
    } else if (rules[scode] == null || Object.keys(rules[scode]).length == 0) {
        info("no active rule for scode:" + scode, threadId);
        let query = getTypedScodeQuery(scode);
        let res = await db.allSync(`select * from tTradeRule where type=? and scode in (${query.scodePlaceholders})`, [query.type].concat(query.aliases), threadId);

        if (res.rows.length > 0) {
            let tsb = await getStockBasicByScode(scode, query.type, threadId);
            let data = res.rows[0];
            normalizeDbRowScodes(data);
            data.type = normalizeType(data.type, data.scode);
            data.autoCreateRuleFail = tsb ? tsb.autoCreateRuleFail : "";
            result.data = data;
        } else {
            result.data = null;
        }
    } else {
        info("active rule exists", threadId);
        result.data = Object.values(rules[scode])[0];
    }

    result.autoActionGate = await getAutoActionGateInfo(threadId);
    var resp = JSON.stringify(result);
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
    let query = getTypedScodeQuery(scode, null);
    await db.runSync(`update tStockBasic set autoCreateRuleFail=? where type=? and (scode in (${query.scodePlaceholders}) or id in (${query.idPlaceholders}))`, [error, query.type].concat(query.aliases, query.candidateIds));
}
async function autoCreateRule(scode, threadId, stockBasicInfo, notBatch) {
    scode = normalizeScode(scode);
    let type = getScodeType(scode);
    if (stockBasicInfo == null) {
        stockBasicInfo = await getStockBasicByScode(scode, type, threadId);
    }
    normalizeDbRowScodes(stockBasicInfo);
    if (stockBasicInfo && stockBasicInfo.type == null) {
        stockBasicInfo.type = type;
    }

    let sname = stockBasicInfo.sname;
    info(`${sname}: auto creating rule`, threadId)
    let failed = 0;
    //获取tstock里对应scode的最后一条记录
    let aliases = getScodeAliases(scode);
    let placeholders = aliases.map(() => "?").join(",");
    let trade = await db.getSync(`select * from tstock where scode in (${placeholders}) and deleted=0 order by tday desc, ttime desc limit 1`, aliases, threadId);
    if (trade == null) {
        return { error: `no trade history`, sname };
    }
    normalizeDbRowScodes(trade);

    //如果已经存在rule,则跳过
    let oldRule = await db.getSync(`select * from tTradeRule where type=? and scode in (${placeholders}) and broker=?`, [type].concat(aliases, [trade.operationName]), threadId);
    if (oldRule != null) {
        if (oldRule.closed == 0) {
            return { error: `I:exists`, sname };
        }
        try {
            oldRule.rule = JSON.parse(oldRule.rule);
        } catch (e) {
            info(e.stack, threadId);
        }

    }

    //获取scode对应的当前价格
    if (stockBasicInfo.updateTime < Date.now() - 1000 * workerCreateRule.priceDelay) {
        return { error: `price is old`, sname };
    }

    let amount = Math.abs(trade.tamount);
    if (trade.operationName == "BNB" || trade.operationName == "OKX") {

    } else {
        if (amount < stockBasicInfo.volumeMultiple) {
            amount = stockBasicInfo.volumeMultiple;
        }

        if (amount != 50 && amount < 100) {
            amount = 100;
        }
    }

    let minDelta = 0.5;
    let maxDelta = 2;
    let deltaRatio = 0.02;

    let currentPrice = stockBasicInfo.buy;
    if (currentPrice < 30) {
        minDelta = 0.3;
        maxDelta = 1;
        deltaRatio = 0.04;
    } else if (currentPrice < 300) {
    } else {
        minDelta = 1;
        maxDelta = 3;
        deltaRatio = 0.01;
    }

    if (trade.operationName == "BNB" || trade.operationName == "OKX") {
        minDelta = 1;
        maxDelta = 20000;
    }

    let dip = normalizeRuleRatio(stockBasicInfo.dip, 0.02);
    let bounce = normalizeRuleRatio(stockBasicInfo.bounce, 0.02);

    let lastPrice = trade.tprice;
    let buyDelta = deltaRatio * lastPrice;
    let sellDelta = deltaRatio * lastPrice;
    let buyPrice = lastPrice - buyDelta;
    if (lastPrice - buyPrice < minDelta) {
        buyPrice = lastPrice - minDelta;
    }

    let sellPrice = lastPrice + sellDelta;
    if (sellPrice - lastPrice < minDelta) {
        sellPrice = lastPrice + minDelta;
    }

    if (sellPrice - lastPrice > maxDelta) {
        sellPrice = lastPrice + maxDelta;
    }


    buyPrice = parseFloat(buyPrice.toFixed(3));
    sellPrice = parseFloat(sellPrice.toFixed(3));

    let rc = null;

    let all = await db.allSync(`select * from tPositions where stock_code in (${placeholders}) and broker=?`, aliases.concat([trade.operationName]), threadId);
    normalizeDbRowsScodes(all.rows);
    let position = 0;
    if (all.rows && all.rows.length > 0) {
        position = all.rows[0].volume;
    }

    if (trade.operationName == "广发") {
        return { error: `I:need buy by hand`, sname };
    }

    if (trade.tamount == 0) {
        all = await isCciCrossUpN100(scode, sname, threadId);
        if (all.reason) {
            error(`${sname}: ${all.reason}`);
            return { error: `I:buy by hand`, sname };
        }

        return { error: `cci buy`, sname };
    } else if (trade.operationDirection.indexOf("卖") >= 0) {
        if (!notBatch && workerCreateRule.type == "toSell") {
            return { error: `toSell`, sname };
        }

        if (oldRule && oldRule.rule.buyAmount < 1) {
            return { error: `I:buy by hand`, sname };
        }


        let all = await ensureData1dIsEnough(scode, sname, threadId);


        if (currentPrice <= buyPrice) {
            info(`currentPrice <= buyPrice(${currentPrice} <= ${buyPrice})`, threadId);
            all = await ensureHighPriceIncreasing(scode, sname, threadId, all, 0, 1);
            all = await ensureLowPriceIncreasing(scode, sname, threadId, all, 0, 2);
            all = await ensureAboveMa5(scode, sname, threadId, all, 0, 1);

            if (all && all.reason) {
                return { error: `${all.reason}`, sname };
            }
            let avgPrice = (currentPrice + all.rows[0].low) / 2;
            let minPrice = Math.min(avgPrice, currentPrice * (1 - deltaRatio / 2));
            if (buyPrice > minPrice) {
                buyPrice = minPrice;
            }

            rc = {
                buy: buyPrice,
                bounce: bounce,
                buyDelta,
                sellDelta,
                buyAmount: amount,
                sell: currentPrice,

                dip: dip,
                sellAmount: amount,
                scode: scode,
                sname: trade.sname,
                broker: trade.operationName,
                order: "buyFirst",
                auto: 1,
                expireHours: 12
            };

            setSellPriceByBuy(rc, maxDelta);
        } else {
            info(`currentPrice > buyPrice(${currentPrice})>${buyPrice})`, threadId);
            all = await ensureLowPriceIncreasing(scode, sname, threadId, all, 0, 1);
            all = await ensureAboveMa5(scode, sname, threadId, all, 0, 1);

            if (all && all.reason) {
                return { error: `${all.reason}`, sname };
            }

            rc = {
                buy: buyPrice,
                bounce: bounce,
                buyDelta,
                sellDelta,
                buyAmount: amount,
                sell: lastPrice,
                dip: dip,
                sellAmount: amount,
                scode: scode,
                sname: trade.sname,
                broker: trade.operationName,
                order: "buyFirst",
                auto: 1,
                expireHours: 12
            };

            if (currentPrice < buyPrice) {
                info(`currentPrice < buyPrice(${currentPrice})<${buyPrice})`, threadId);
                rc.buy = currentPrice * (1 - 0.01);
                if (currentPrice - rc.buy > minDelta) {
                    rc.buy = currentPrice - minDelta;
                }
            }

            if (rc.buy * rc.buyAmount < 10000) {
                rc.broker = "国信"
            }

            setSellPriceByBuy(rc, maxDelta);
        }
    } else if (trade.operationDirection.indexOf("买") >= 0) {
        if (!notBatch && workerCreateRule.type == "toBuy") {
            return { error: `toBuy`, sname };
        }

        if (oldRule && oldRule.rule.sellAmount < 1) {
            return { error: `I:sell by hand`, sname };
        }

        rc = {
            buy: lastPrice,
            bounce,
            buyDelta,
            sellDelta,
            buyAmount: amount,
            sell: sellPrice,
            dip: dip,
            sellAmount: amount,
            scode: scode,
            sname: trade.sname,
            broker: trade.operationName,
            order: "sellFirst",
            auto: 1,
            expireHours: 12
        };

        if (currentPrice > (rc.sell + lastPrice) / 2) {
            info(`currentPrice > rc.sell(${currentPrice})>${rc.sell})`, threadId);
            rc.sell = currentPrice * (1 + deltaRatio);

            if (rc.sell - currentPrice > maxDelta / 2) {
                info(`rc.sell - currentPrice > minDelta(${rc.sell} - ${currentPrice} > ${minDelta})`, threadId);
                rc.sell = currentPrice + maxDelta / 2;
            }

            setBuyPriceBySell(rc, maxDelta);
        }
    } else {
        return { error: `bad trade direction`, sname };
    }

    let broker = rc.broker;
    let now = Date.now();
    let sql = `insert or replace into tTradeRule(id, broker, scode, sname, rule, createTime, closed, expireTime, type) values(?,?,?,?,?,?,?,?,?)`;
    //将expireTime设置为当天14:10
    let expireTime = new Date();
    expireTime.setHours(16);
    expireTime.setMinutes(10);
    expireTime = expireTime.getTime();


    let id = `${scode}.${broker}`;
    let rule = { id, broker, scode, sname, rule: JSON.stringify(rc), createTime: now, closed: 0, expireTime, type };
    await insertOrReplace("tTradeRule", rule);
    await db.runSync(`delete from tRuleAction where type=? and scode=? and broker=?`, [type, scode, broker]);
    return {
        rule,
        sname
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
        info(`${sname}: ma5 increasing ${days}/${end - start} days`, threadId)
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
        info(`${sname}: larger than ma5 ${days}/${end - start} days`, threadId)
        prevRes.reason = `larger than ma5 ${days}/${end - start} days`;
        return prevRes;
    }

    return prevRes;
}


async function get1dData(scode, threadId) {
    info(`get1dData`, threadId);
    await forceUpdate1d(scode, threadId);
    let prevRes = await db.allSync(`select * from t1d where scode=? order by time desc limit 30`, [scode], threadId);
    return prevRes;
}

async function ensureLowPriceIncreasing(scode, sname, threadId, prevRes, start, end) {
    prevRes = await ensureData1dIsEnough(scode, sname, threadId, prevRes);

    if (prevRes.reason) {
        return prevRes;
    }

    for (let i = start; i < end; ++i) {
        if (prevRes.rows[i].low < prevRes.rows[i + 1].low) {
            info(`${sname}:${i}.low < ${i + 1}.low`, threadId)
            prevRes.reason = `${i}.low < ${i + 1}.low`;
            return prevRes;
        }
    }

    return prevRes;
}

async function ensureData1dIsEnough(scode, sname, threadId, prevRes) {
    info(`ensureData1dIsEnough`, threadId);
    if (prevRes == null) {
        prevRes = await get1dData(scode, threadId);
    }

    if (prevRes.rows == null || prevRes.rows.length < 3) {
        info(`${sname}:no 1d data`, threadId)
        prevRes.reason = "no 1d data";
        return prevRes;
    }

    let lastDay = prevRes.rows[0].time;
    let todayStr = timeFormat(new Date(), "yyyyMMdd");
    if (todayStr != lastDay) {
        info(`${sname}:no today 1d`, threadId)
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
            info(`${sname}:${i}.high < ${i + 1}.high`, threadId)
            prevRes.reason = `${i}.high < ${i + 1}.high`;
            return prevRes;
        }
    }

    return prevRes;
}

async function ensureCciNotCrossDown100(scode, sname, threadId, prevRes) {
    info(`ensureCciNotCrossDown100`, threadId);
    prevRes = await ensureData1dIsEnough(scode, sname, threadId, prevRes);
    if (prevRes.reason) {
        return prevRes;
    }
    let period = 14;
    await calc1dCci(prevRes.rows, period);

    for (let i = 0; i < 2; ++i) {
        if (prevRes.rows[i].cci <= 100 && prevRes.rows[i + 1].cci >= 100) {
            info(`${sname}:${i}.cci <=100<=${i + 1}.cci`, threadId)
            prevRes.reason = `${i}.cci(${prevRes.rows[i].cci})<=100<=${i + 1}.cci(${prevRes.rows[i + 1].cci})`;
            return prevRes;
        }
    }

    return prevRes;
}

async function isCciCrossUpN100(scode, sname, threadId, prevRes) {
    prevRes = await ensureData1dIsEnough(scode, sname, threadId, prevRes);
    if (prevRes.reason) {
        error(`${sname}:${prevRes.reason}`, threadId);
        return prevRes;
    }
    let period = 14;
    await calc1dCci(prevRes.rows, period);

    for (let i = 0; i < 2; ++i) {
        if (prevRes.rows[i].cci >= -100 && prevRes.rows[i + 1].cci <= -100) {
            info(`${sname}:${i}.cci >=-100>=${i + 1}.cci`, threadId)
            for (let j = i - 1; j >= 0; --j) {
                if (prevRes.rows[j].cci < prevRes.rows[j + 1].cci) {
                    info(`${sname}:${j}.cci < ${j + 1}.cci`, threadId)
                    prevRes.reason = `${j}.cci(${prevRes.rows[j].cci}) < ${j + 1}.cci(${prevRes.rows[j + 1].cci})`;
                    return prevRes;
                }
            }

            return prevRes;
        }
    }

    prevRes.reason = `no cci cross up -100`;
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
    const code = stripScodeSuffix(stockCode) == null ? "" : String(stripScodeSuffix(stockCode)).trim();

    // 检查代码是否有效
    if (!code) {
        return "";
    }

    let suffix = "未知";
    if (code.length == 6) {
        if (/^(600|601|603|605|688|900|51|58|56)\d+$/.test(code)) {
            suffix = "SH"; // 上交所（600/601/603/605/688/900 开头）
        } else if (/^(000|001|002|003|30|15|16|12|3)\d+$/.test(code)) {
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
    let code = normalizeScode(stockCode);
    if (code == null || code == "" || !hasScodeSuffix(code)) {
        info(`error scode：${stockCode}`);
        return null;
    }

    return code;
}


app.get('/stock/codes', async (req, res) => {
    let js = req.query.js;
    let sql = `select scode from tstockbasic
            order by priority desc;`;
    let r = await db.allSync(sql, [], req.threadId);
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
    let r = await db.allSync(sql, [], req.threadId);
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
    let r = await db.allSync(sql, [], req.threadId);
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
    let r = await db.allSync(sql, [], req.threadId);
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
    let threadId = req.threadId;
    let js = req.query.js;
    let scode = normalizeScode(req.query.scode);
    let r = await get1dLastDate(scode, threadId);

    var resp = JSON.stringify(r);
    if (js != null) {
        resp = `${js}(${resp})`;
    }

    res.send(resp);
});

async function get1dLastDate(scode, threadId) {
    info("scode:" + scode, threadId);
    let aliases = getScodeAliases(scode);
    let sql = `select max(time) as lastDate from t1d where scode in (${aliases.map(() => "?").join(",")})`;
    let r = await db.getSync(sql, aliases, threadId);
    return r;
}

async function sendKLastDate(req, res, tableName) {
    let threadId = req.threadId;
    let js = req.query.js;
    let scode = normalizeScode(req.query.scode);
    info("scode:" + scode, req.threadId)
    let aliases = getScodeAliases(scode);
    let sql = `select max(time) as lastDate from ${tableName} where scode in (${aliases.map(() => "?").join(",")})`;
    let r = await db.getSync(sql, aliases, threadId);

    var resp = JSON.stringify(r);
    if (js != null) {
        resp = `${js}(${resp})`;
    }

    res.send(resp);
}

app.get('/stock/1w/lastDate', async (req, res) => {
    await sendKLastDate(req, res, "t1w");
});

app.get('/stock/1mon/lastDate', async (req, res) => {
    await sendKLastDate(req, res, "t1mon");
});

app.get('/stock/1m/lastMinute', async (req, res) => {
    let threadId = req.threadId;
    let js = req.query.js;
    let scode = normalizeScode(req.query.scode);
    let r = await getLastMinute(scode, threadId);

    var resp = JSON.stringify(r);
    if (js != null) {
        resp = `${js}(${resp})`;
    }

    res.send(resp);
});

app.get('/stock/price/current', async (req, res) => {
    let js = req.query.js;

    let sql = `select * from tstockbasic `;
    let r = await db.allSync(sql, [], req.threadId);
    normalizeDbRowsScodes(r.rows);

    var resp = JSON.stringify({ rows: r.rows });
    if (js != null) {
        resp = `${js}(${resp})`;
    }

    res.send(resp);
});

async function getLastMinute(scode, threadId) {
    info("scode:" + scode, threadId);
    let aliases = getScodeAliases(scode);
    let sql = `select max(time) as lastMinute from t1m where scode in (${aliases.map(() => "?").join(",")})`;
    let r = await db.getSync(sql, aliases, threadId);
    return r;
}

async function autoDelete(delta, scode, req) {
    info("auto delete", req.threadId);
    if (delta != 1) {
        info("reset before pair", req.threadId);
        await db.runSync(`update tstock set tpair='', deleted=0 where scode=?`, [scode]);
    }

    let sql = `select * from tstock where scode=? and deleted=0 order by tday, ttime, tid`;
    let r = await db.allSync(sql, [scode], req.threadId);
    let trades = r.rows;
    info(`${trades.length} trades`, req.threadId);
    let latestTradeId = trades.length > 0 ? trades[trades.length - 1].tid : null;

    let getTradeNumber = function (value) {
        let num = parseFloat(value);
        if (isNaN(num)) {
            return 0;
        }

        return num;
    };

    let canAutoPairTrade = function (t1, t2) {
        let amount1 = getTradeNumber(t1.tamount);
        let amount2 = getTradeNumber(t2.tamount);
        if (Math.abs(amount1 + amount2) > 0.00000001) {
            return false;
        }

        let price1 = getTradeNumber(t1.tprice);
        let price2 = getTradeNumber(t2.tprice);
        if (price1 <= price2 && amount1 < 0) {
            return false;
        }

        if (price1 > price2 && amount1 > 0) {
            return false;
        }

        return true;
    };

    let canSellMatchBuy = function (sellTrade, buyTrade) {
        return getTradeNumber(buyTrade.tprice) <= getTradeNumber(sellTrade.tprice);
    };

    let hideTradeGroup = async function (groupTrades) {
        let tids = groupTrades.map((trade) => trade.tid);
        for (let i = 0; i < groupTrades.length; ++i) {
            let trade = groupTrades[i];
            let tpair = tids.filter((tid) => tid != trade.tid).join(",");
            await db.runSync(`update tstock set tpair=?, deleted=1 where tid=?`, [tpair, trade.tid], req.threadId);
            trade.deleted = 1;
            trade.tpair = tpair;
        }
    };

    let findTradeSubsetByAmount = function (candidates, targetAmount) {
        let suffixAmounts = new Array(candidates.length + 1).fill(0);
        for (let i = candidates.length - 1; i >= 0; --i) {
            suffixAmounts[i] = suffixAmounts[i + 1] + getTradeNumber(candidates[i].tamount);
        }

        let tried = new Set();
        let dfs = function (start, remaining) {
            if (Math.abs(remaining) < 0.00000001) {
                return [];
            }

            if (start >= candidates.length || remaining < -0.00000001) {
                return null;
            }

            if (suffixAmounts[start] + 0.00000001 < remaining) {
                return null;
            }

            let key = `${start}:${remaining.toFixed(8)}`;
            if (tried.has(key)) {
                return null;
            }

            for (let i = start; i < candidates.length; ++i) {
                let candidate = candidates[i];
                let amount = getTradeNumber(candidate.tamount);
                if (amount <= 0) {
                    continue;
                }

                let result = dfs(i + 1, remaining - amount);
                if (result != null) {
                    return [candidate].concat(result);
                }
            }

            tried.add(key);
            return null;
        };

        return dfs(0, targetAmount);
    };

    for (let i = 0; i < trades.length - 1; ++i) {
        let t1 = trades[i];
        info(`${i}: ${t1.tprice} * ${t1.tamount}`, req.threadId);
        if (t1.deleted) {
            info(`${i} deleted`, req.threadId);
            continue;
        }

        if (Math.abs(getTradeNumber(t1.tamount)) < 0.00000001) {
            continue;
        }

        for (let j = i + 1; j < trades.length; ++j) {
            let t2 = trades[j];
            info(`${j}: ${t2.tprice} * ${t2.tamount}`, req.threadId);
            if (t2.deleted) {
                info(`${j} deleted`, req.threadId);
                continue;
            }

            if (t2.tid == latestTradeId) {
                info(`${j} latest trade excluded`, req.threadId);
                continue;
            }

            if (Math.abs(getTradeNumber(t2.tamount)) < 0.00000001) {
                continue;
            }

            if (!canAutoPairTrade(t1, t2)) {
                info(`can not auto pair`, req.threadId);
                continue;
            }

            await hideTradeGroup([t1, t2]);
            break;
        }
    }

    for (let sellIndex = 0; sellIndex < trades.length; ++sellIndex) {
        let sellTrade = trades[sellIndex];
        let sellAmount = getTradeNumber(sellTrade.tamount);
        if (sellTrade.deleted || sellAmount >= 0 || sellTrade.tid == latestTradeId) {
            continue;
        }

        let targetAmount = Math.abs(sellAmount);
        let candidateBuys = [];
        for (let buyIndex = 0; buyIndex < sellIndex; ++buyIndex) {
            let buyTrade = trades[buyIndex];
            let buyAmount = getTradeNumber(buyTrade.tamount);
            if (buyTrade.deleted || buyAmount <= 0) {
                continue;
            }

            if (!canSellMatchBuy(sellTrade, buyTrade)) {
                continue;
            }

            candidateBuys.push(buyTrade);
        }

        if (candidateBuys.length < 2) {
            continue;
        }

        let matchedBuys = findTradeSubsetByAmount(candidateBuys, targetAmount);
        if (matchedBuys == null || matchedBuys.length < 2) {
            continue;
        }

        await hideTradeGroup([sellTrade].concat(matchedBuys));
    }
}

app.get('/stock/delete/auto', async (req, res) => {
    let js = req.query.js;
    let scode = req.query.scode;
    let delta = req.query.delta;
    await autoDelete(delta, scode, req);

    var resp = `${js}(${JSON.stringify({ data: "success" })})`;
    res.send(resp);
});

app.get('/stockUpdate', async (req, res) => {
    let refreshResult = await refreshAllTableScodes(req.threadId);
    if (refreshResult.error) {
        info(refreshResult.error, req.threadId)
        res.send(JSON.stringify({ error: `${refreshResult.error}` }));
        return;
    }
});

app.post('/stock/query', async (req, res) => {
    let text = req.body.text;
    let row = JSON.parse(decodeURIComponent(atob(text)));
    let sql = row.sql;
    let name = row.name;
    let params = row.params;
    info(`/stock/query:${name}:sql:${sql}`, req.threadId)
    info(`/stock/query:${name}:params:${params}`, req.threadId)
    let r = await db.allSync(sql, [], req.threadId);
    if (r.error) {
        info(r.error, req.threadId)
        res.send(JSON.stringify({ error: `${r.error}` }));
        return;
    }
    normalizeDbRowsScodes(r.rows);

    if (name != null) {
        await db.runSync(`insert or replace into tsql (id, name, sql,params,lastUseTime) values (?,?,?,?,?)`,
            [name, name, sql, params, Date.now()]);
    }

    var resp = JSON.stringify({ data: r.rows });
    res.send(resp);
});

async function genCci(scode, req, all) {
    if (req == null) {
        req = {
            threadId:
                Date.now() + "" + Math.floor(Math.random() * 10000)
        }
    }

    info(`genCci:${scode},${all}`, req.threadId)
    let period = 14;

    let sql = `select * from t1d where scode=? order by time desc ${all ? "" : "limit " + (period + 2)}`;
    let r = await db.allSync(sql, [scode], req.threadId);
    if (r.error) {
        error(r.error, req.threadId)
        return;
    }

    if (r.rows.length < period) {
        error(`${r.rows.length} < ${period} 1d data`, req.threadId)
        return;
    }
    if ((r.rows[0].cci == -800 && r.rows[1].cci == -800) && !all) {
        info(`need recalc all cci`, req.threadId);
        genCci(scode, req, 1);
        return;
    }

    let data = r.rows;
    await calc1dCci(data, period, async function (row) {
        db.runSync(`update t1d set cci=? where id=?`, [row.cci, row.id], req.threadId);
    });
}

app.post('/stock/k/upload', async (req, res) => {
    info(`/stock/k/upload`, req.threadId)
    let data = req.body.data;
    let scode = normalizeScode(req.body.scode);
    let period = req.body.period;
    let type = req.body.type;
    if (type == null) {
        type = 0;
    }
    info(`scode:${scode},period:${period},len:${data.length}`, req.threadId)
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

            if (period == "1d") {
                row.cci = data[i][7];
                //     row.kdj_k = 0;
                //     row.kdj_d = 0;
                //     row.kdj_j = 0;
                //     row.boll_u = 0;
                //     row.boll_m = 0;
                //     row.boll_l = 0;
                //     row.range = 0;
            }

            if (row.volume < 0) {
                if (period == "1m") {
                    row.volume = 0;
                } else {
                    row.volume = Math.abs(row.volume);
                }
            }

            await insertOrReplace(`t${period}`, row);
            if (period == "1d") {
                await genCci(scode, req);
            }

        }
    }

    var resp = JSON.stringify({});
    res.send(resp);
});

async function calc1dCci(data, period, onCalced) {
    const typicalPrices = [];
    for (let i = 0; i < data.length; i++) {
        const high = data[i].high;
        const low = data[i].low;
        const close = data[i].close;
        const typicalPrice = (high + low + close) / 3;
        typicalPrices.push(typicalPrice);
    }

    for (let i = 0; i <= data.length - period; i++) {
        if (data[i].cci != -800 && i > 0) {
            continue;
        }

        const tps = typicalPrices.slice(i, i + period);
        // 2. 计算典型价格的简单移动平均(SMA)
        const sma = tps.reduce((sum, price) => sum + price, 0) / period;
        // 3. 计算平均绝对偏差(MAD) 
        const absoluteDeviations = tps.map(tp => Math.abs(tp - sma));
        const mad = absoluteDeviations.reduce((sum, dev) => sum + dev, 0) / period;

        // 4. 计算CCI值
        const ctp = typicalPrices[i];
        let cci;

        if (mad === 0) {
            cci = 0;
        } else {
            cci = (ctp - sma) / (0.015 * mad);
        }

        data[i].cci = parseFloat(cci.toFixed(2));

        onCalced && await onCalced(data[i]);
    }
}

async function getDealName(scode, req) {
    let name = scode;
    let row = await getStockBasicByScode(scode, null, req.threadId);
    if (row) {
        name = row.sname;
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
    let threadId = req.threadId;
    let deal = req.body;
    let ocode = normalizeScode(deal.scode).split(".");
    deal.scode = `${ocode[0]}.${ocode[1]}`;
    if ("" == deal.sname) {
        deal.sname = await getDealName(deal.scode, req);
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
    deal.lastOperationTime = Date.now();
    deal.tprice = convertIfInteger(deal.tprice);
    deal.tid = `${deal.tday}.${deal.ttime}.${deal.scode}.${deal.tprice}`;

    let old = await db.getSync("select * from tStock where tid=?", [deal.tid], threadId);
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

    autoDelete(0, deal.scode, req);

    let resp = {};
    if (r.error) {
        info(r.error, req.threadId)
        resp = { error: r.error };
    } else {
    }

    res.send(JSON.stringify(resp));
});


app.post('/stock/rule/action/ordered', async (req, res) => {
    let scode = normalizeScode(req.body.scode);
    let type = getScodeType(scode);
    let broker = req.body.broker;
    let status = req.body.status;
    let orderNo = req.body.orderNo;
    let aliases = getScodeAliases(scode);
    let placeholders = aliases.map(() => "?").join(",");
    let r;
    let resp = {};
    if (status == 56 || status == 53 || status == 54) {
        r = await db.runSync(`update tRuleAction set done = 2, status=?, orderNo=? where type=? and scode in (${placeholders}) and broker=? `, [status, orderNo, type].concat(aliases, [broker]));
    } else if (status == 10 || status == 50 || status == 57) {
        r = await db.runSync(`update tRuleAction set done = 1, status=?, orderNo=? where type=? and scode in (${placeholders}) and broker=? `, [status, orderNo, type].concat(aliases, [broker]));
    } else {
        info(`status ${status} skipped`, req.threadId);
        res.send(JSON.stringify(resp));
        return;
    }
    if (r && r.error) {
        info(r.error, req.threadId)
        resp = { error: r.error };
    } else {
        info("update succeeded", req.threadId);
        if (rules[scode]) {
            info(`${JSON.stringify(rules[scode])}`, req.threadId);
            reloadRule(rules[scode][broker], req);
        } else {
            info(`no rule exists for ${scode}`, req.threadId);
        }
    }

    res.send(JSON.stringify(resp));
});

app.get('/stock/sqls', async (req, res) => {

    let js = req.query.js;
    let sql = "select * from tsql order by lastUseTime desc";
    let r = await db.allSync(sql, [], req.threadId);
    if (r.error) {
        info(r.error, req.threadId)
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
    info("video/replacers", req.threadId)
    var rPath = path.join(directoryPath, "replacers");
    var replacers = {};
    try {
        replacers = JSON.parse(fs.readFileSync(rPath, "utf-8"));
    } catch (e) {
        info("error parsing replacers:" + e.message, req.threadId)
    }

    var resp = req.query.js + "(" + JSON.stringify({ data: replacers }) + ");";
    res.send(resp);
});

app.get('/video/metadata', (req, res) => {
    info("video/metadata", req.threadId)
    var fileName = req.query.fileName;
    var rPath = path.join(directoryPath, "metadata");
    var data = {};
    try {
        data = JSON.parse(fs.readFileSync(rPath, "utf-8"));
    } catch (e) {
        info("error parsing replacers:" + e.message, req.threadId)
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
const { warn } = require('console');
const { setInterval } = require('timers/promises');
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
    info("file uploading", req.threadId)
    if (!req.files || !req.files.file) {
        return res.status(400).send('No file uploaded.');
    }

    const file = req.files.file;
    let dir = req.body.dir;
    if (dir == null) {
        dir = "voice";
    }

    if (!fs.existsSync(directoryPath + "/" + dir)) {
        fs.mkdirSync(directoryPath + "/" + dir);
    }

    var fileName = decodeURIComponent(file.name);
    const filePath = path.join(directoryPath + "/" + dir, fileName);

    // 将文件保存到服务器上指定目录
    file.mv(filePath, err => {
        if (err) {
            error(err, req.threadId)
            return res.status(500).send(err);
        }
        // toStt(fileName);
        res.send(`File ${file.name} uploaded successfully.`);
    });
});
app.get('/video/addSegment', (req, res) => {
    info("video/addSegment", req.threadId)
    var fileName = req.query.fileName;
    var start = req.query.start;
    var end = req.query.end;
    var name = req.query.name;
    var rPath = path.join(directoryPath, "metadata");
    var data = {};
    try {
        data = JSON.parse(fs.readFileSync(rPath, "utf-8"));
    } catch (e) {
        info("error parsing metadata:" + e.message, req.threadId)
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
    info("video/updateScript", req.threadId)
    info("params:" + JSON.stringify(req.body), req.threadId)
    const params = JSON.parse(req.body.params);
    var filePath = path.join(directoryPath, params.file);
    info("filePath:" + filePath, req.threadId)
    var replaceAll = params.replaceAll;
    var rPath = path.join(directoryPath, "replacers");
    var scripts = fs.readFileSync(filePath, "utf-8");
    var replacers = {};
    try {
        replacers = JSON.parse(fs.readFileSync(rPath, "utf-8"));
    } catch (e) {
        info("error parsing replacers:" + e.message, req.threadId)
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
    info("video/updatePosition", req.threadId)
    var fileName = req.query.fileName;
    var position = req.query.position;
    var rPath = path.join(directoryPath, "metadata");
    var data = {};
    try {
        data = JSON.parse(fs.readFileSync(rPath, "utf-8"));
    } catch (e) {
        info("error parsing replacers:" + e.message, req.threadId)
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
    info("video/updatePosition", req.threadId)
    var fileName = req.query.fileName;
    var position = req.query.position;
    var rPath = path.join(directoryPath, "metadata");
    var data = {};
    try {
        data = JSON.parse(fs.readFileSync(rPath, "utf-8"));
    } catch (e) {
        info("error parsing replacers:" + e.message, req.threadId)
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
        error("error reading config.json:" + e.message, req.threadId)
    }

    var json = { data: JSON.parse(text) }
    var resp = req.query.js + "(" + JSON.stringify(json) + ");";
    res.send(resp);
});

app.get('/video/openwrt/clients', (req, res) => {
    info("video/openwrt/clients", req.threadId);
    const data = readOpenwrtClients(req.threadId);
    res.send(JSON.stringify({ data }));
});

app.post('/video/openwrt/clients/upload', async (req, res) => {
    info(`video/openwrt/clients/upload:${JSON.stringify(req.body)}`, req.threadId);
    const body = req.body || {};
    const clients = Array.isArray(body.clients) ? body.clients : [];
    const data = {
        router: body.router || req.ip,
        reportedAt: Number(body.reportedAt) || Date.now(),
        clients: clients.map((item) => {
            const leaseEnd = Number(item.leaseEnd);
            return {
                ip: item.ip || "",
                mac: item.mac || "",
                host: item.host || "-",
                leaseEnd: Number.isFinite(leaseEnd) ? leaseEnd : 0
            };
        })
    };
    const result = writeOpenwrtClients(data, req.threadId);
    if (result.error) {
        res.status(500).send(JSON.stringify(result));
        return;
    }

    const currentMinute = getTimeStr();
    const prevMinute = getTimeStr(Date.now() - 60000);
    const currentIPs = new Set(data.clients.map(c => c.ip));

    // Check which IPs were online in previous minute
    const prevOnlineRows = await db.allSync(
        `SELECT ip FROM openwrt_onlines WHERE time = ?`,
        [prevMinute],
        req.threadId
    );
    const prevOnlineIPs = new Set(((prevOnlineRows && prevOnlineRows.rows) || []).map(r => r.ip));

    // Process each current client
    for (const client of data.clients) {
        // Get the latest record for this IP
        const latestRow = await db.getSync(
            `SELECT startTime,time FROM openwrt_onlines WHERE ip = ? ORDER BY time DESC LIMIT 1`,
            [client.ip],
            req.threadId
        );

        const isReconnect = latestRow &&
            currentMinute - parseInt(latestRow.time) <= 1;

        if (isReconnect) {
            // Continue same online session, just update time
            const latestId = `${client.ip}_${latestRow.startTime}`;
            await db.runSync(
                `UPDATE openwrt_onlines SET time = ?, mac = ?, host = ? WHERE id = ?`,
                [currentMinute, client.mac, client.host, latestId],
                req.threadId
            );
        } else {
            // New online session with startTime
            const id = `${client.ip}_${currentMinute}`;
            await db.runSync(
                `INSERT OR REPLACE INTO openwrt_onlines (id, ip, mac, host, status, time, startTime) VALUES (?, ?, ?, ?, 'online', ?, ?)`,
                [id, client.ip, client.mac, client.host, currentMinute, currentMinute],
                req.threadId
            );
            info(`openwrt: ${client.host || client.ip} online at ${formatTimeStr(currentMinute)}`, req.threadId);
        }
    }

    res.send(JSON.stringify({
        ok: 1,
        count: data.clients.length,
        reportedAt: data.reportedAt
    }));
});

app.get('/video/openwrt/history', async (req, res) => {
    info("/video/openwrt/history", req.threadId);
    const { ip, start, end } = req.query;

    let sql = "SELECT ip, mac, host, status, time, startTime FROM openwrt_onlines";
    const params = [];
    const conditions = [];

    if (ip) {
        conditions.push("ip = ?");
        params.push(ip);
    }
    if (start) {
        conditions.push("time >= ?");
        params.push(getTimeStr(Number(start)));
    }
    if (end) {
        conditions.push("time <= ?");
        params.push(getTimeStr(Number(end)));
    }

    if (conditions.length > 0) {
        sql += " WHERE " + conditions.join(" AND ");
    }
    sql += " ORDER BY time ASC, ip ASC";

    const rows = await db.allSync(sql, params, req.threadId);
    res.send(JSON.stringify({ data: rows?.rows || [] }));
});

app.get('/video/openwrt/devices', async (req, res) => {
    info("/video/openwrt/devices", req.threadId);
    const rows = await db.allSync(
        "SELECT DISTINCT ip, mac, host FROM openwrt WHERE host IS NOT NULL AND host != '' AND host != '-' ORDER BY host",
        [],
        req.threadId
    );
    res.send(JSON.stringify({ data: rows?.rows || [] }));
});

app.post('/voice/ping', (req, res) => {
    const fp = path.join(directoryPath, "voice/ping.json");
    var text = "{}";
    try {
        text = fs.readFileSync(fp, "utf-8");
    } catch (e) {
        error("error reading ping.json:" + e.message, req.threadId)
    }
    var config = JSON.parse(text);
    var bd = req.body
    info("body:" + JSON.stringify(bd), req.threadId)
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

app.get('/voice/ping', (req, res) => {
    const fp = path.join(directoryPath, "voice/ping.json");
    var text = "{}";
    try {
        text = fs.readFileSync(fp, "utf-8");
    } catch (e) {
        error("error reading ping.json:" + e.message, req.threadId)
    }
    res.send(text);
});

app.get('/video/download/:filename', (req, res) => {
    const fileName = req.params.filename;
    const videoPath = path.join(directoryPath, fileName);
    info("videoPath:" + videoPath, req.threadId)
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

app.get('/video/voice/:filename', (req, res) => {
    const fileName = req.params.filename;
    const filePath = path.join(directoryPath, "/voice/" + fileName);
    info("voicePath:" + filePath, req.threadId)
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;

    // 获取范围头
    const range = req.headers.range;
    const contentType = mime.getType(filePath);
    if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = (end - start) + 1;
        const file = fs.createReadStream(filePath, { start, end });

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

        const file = fs.createReadStream(filePath);
        file.pipe(res);
    }
});

// 路由：删除文件
app.post('/video/delete', (req, res) => {
    const files = JSON.parse(req.body.files);
    const remove = req.body.remove;
    info("remove:" + remove, req.threadId)
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

    info("rename:'" + fileName + "' to '" + newName + "'", req.threadId)

    var resp = { ok: 1 };
    try {
        fs.renameSync(fileName, newName);
    } catch (err) {
        error(`failed:${err.message}`, req.threadId)
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

    info(`setScript:${top},${bottom},${left},${right},${fileName}`, req.threadId)

    var rPath = path.join(directoryPath, "scripts");
    var data = {};
    try {
        data = JSON.parse(fs.readFileSync(rPath, "utf-8"));
    } catch (e) {
        info("error parsing replacers:" + e.message, req.threadId)
    }

    data[fileName] = { top: top, bottom: bottom, left: left, right: right };

    var resp = { ok: 1 };
    try {
        fs.writeFileSync(rPath, JSON.stringify(data));
        fs.unlink(path.join(directoryPath, `${fileName}.htm`), err => {
            if (err) {
                console.error('Error deleting file:', err);
            } else {
                info('File deleted:', fileName, req.threadId)
            }
        });
        fs.unlink(path.join(directoryPath, `${fileName}.srt`), err => {
            if (err) {
                console.error('Error deleting file:', err);
            } else {
                info('File deleted:', fileName, req.threadId)
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

    info(`removeScript:${fileName}`, req.threadId)

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
        info("error parsing replacers:" + e.message, req.threadId)
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
    info("splitting=" + splitting, req.threadId)
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
        let scode = "WS" + Date.now();
        g.actions.push({ action: "connectWebSocket", broker: "国金", id: "connectWebSocket", scode });
    });
}

init();
