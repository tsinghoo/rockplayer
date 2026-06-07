const fs = require("fs");

let DEBUG = 2;
let INFO = 3;
let ERROR = 4;
let logLevel = parseInt(process.env.LOG_LEVEL || `${INFO}`, 10);

const args = process.argv;
const g = {
    broker: "US",
    baseUrl: process.env.BASE_URL || "http://127.0.0.1:3001",
    passcode: process.env.PASSCODE || "995560",
    batchSize: parseInt(process.env.BATCH_SIZE || "50", 10),
    defaultPeriods: ["1d", "1w", "1mon"],
    logs: []
};

function timeFormat(time, fmt) {
    if (time == null) {
        return "";
    }
    if (time.time) {
        time = new Date(time.time);
    } else {
        time = new Date(time);
    }
    const o = {
        "M+": time.getMonth() + 1,
        "d+": time.getDate(),
        "h+": time.getHours(),
        "m+": time.getMinutes(),
        "s+": time.getSeconds(),
        S: time.getMilliseconds()
    };
    if (/(y+)/.test(fmt)) {
        fmt = fmt.replace(
            RegExp.$1,
            `${time.getFullYear()}`.substr(4 - RegExp.$1.length)
        );
    }
    Object.keys(o).forEach((k) => {
        if (new RegExp(`(${k})`).test(fmt)) {
            fmt = fmt.replace(
                RegExp.$1,
                RegExp.$1.length === 1
                    ? o[k]
                    : (`00${o[k]}`).substr(`${o[k]}`.length)
            );
        }
    });
    return fmt;
}

function log() {
    const line = Array.from(arguments).map((item) => {
        if (typeof item === "string") {
            return item;
        }
        try {
            return JSON.stringify(item);
        } catch (e) {
            return String(item);
        }
    }).join(" ");
    console.log(line);
    g.logs.push(`${timeFormat(Date.now(), "yyyy-MM-dd hh:mm:ss")} ${line}`);
}

function info() {
    if (logLevel > INFO) {
        return;
    }
    log(...arguments);
}

function debug() {
    if (logLevel > DEBUG) {
        return;
    }
    log(...arguments);
}

function error() {
    if (logLevel > ERROR) {
        return;
    }
    log(...arguments);
}

async function log2File() {
    const logFile = `${__dirname}/us${timeFormat(new Date(), "yyMMdd")}.log`;
    if (g.logs.length > 0) {
        const toWrite = g.logs.join("\n");
        g.logs = [];
        fs.writeFileSync(logFile, `${toWrite}\n`, { flag: "a" });
    }
}

function buildUrl(baseUrl, path, params) {
    const url = new URL(path, baseUrl);
    if (params) {
        Object.keys(params).forEach((key) => {
            if (params[key] != null && params[key] !== "") {
                url.searchParams.set(key, params[key]);
            }
        });
    }
    return url.toString();
}

async function get(url) {
    debug(`GET ${url}`);
    return fetch(url, { method: "GET" });
}

async function post(url, body) {
    debug(`POST ${url} ${JSON.stringify(body)}`);
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });
    const text = await response.text();
    if (!response.ok) {
        throw new Error(`POST ${url} failed: ${response.status} ${text}`);
    }
    return text;
}

function normalizeUsScode(scode) {
    if (!scode) {
        return "";
    }
    let code = `${scode}`.trim().toUpperCase();
    if (code === "") {
        return "";
    }
    if (code.indexOf(".") > 0) {
        return code;
    }
    return `${code}.US`;
}

function toYahooSymbol(scode) {
    const code = normalizeUsScode(scode);
    return code.replace(/\.US$/i, "");
}

async function getKLastDate(scode, period) {
    let route;
    let field;
    if (period === "1d") {
        route = "/stock/1d/lastDate";
        field = "lastDate";
    } else if (period === "1w") {
        route = "/stock/1w/lastDate";
        field = "lastDate";
    } else if (period === "1mon") {
        route = "/stock/1mon/lastDate";
        field = "lastDate";
    } else {
        throw new Error(`unsupported period ${period}`);
    }

    const url = buildUrl(g.baseUrl, route, { scode: normalizeUsScode(scode) });
    const response = await get(url);
    if (!response.ok) {
        throw new Error(`getKLastDate failed: ${response.status}`);
    }
    const json = JSON.parse(await response.text());
    return json[field];
}

function parseDateString(yyyymmdd) {
    if (!yyyymmdd || `${yyyymmdd}`.length < 8) {
        return null;
    }
    const text = `${yyyymmdd}`;
    return new Date(Date.UTC(
        parseInt(text.substring(0, 4), 10),
        parseInt(text.substring(4, 6), 10) - 1,
        parseInt(text.substring(6, 8), 10),
        0,
        0,
        0,
        0
    ));
}

function resolveRange(period, lastDate, explicitRange) {
    if (explicitRange) {
        return explicitRange;
    }
    if (!lastDate) {
        if (period === "1d") {
            return "5y";
        }
        return period === "1d" ? "5y" : "10y";
    }

    const last = parseDateString(lastDate);
    if (last == null) {
        if (period === "1d") {
            return "5y";
        }
        return period === "1d" ? "5y" : "10y";
    }

    const now = Date.now();
    const diffDays = Math.ceil((now - last.getTime()) / (24 * 60 * 60 * 1000));
    if (period === "1d") {
        if (diffDays <= 10) {
            return "1mo";
        }
        if (diffDays <= 45) {
            return "3mo";
        }
        if (diffDays <= 190) {
            return "1y";
        }
        if (diffDays <= 900) {
            return "5y";
        }
        return "10y";
    }

    if (period === "1w") {
        if (diffDays <= 35) {
            return "3mo";
        }
        if (diffDays <= 140) {
            return "1y";
        }
        if (diffDays <= 700) {
            return "5y";
        }
        return "10y";
    }

    if (diffDays <= 93) {
        return "1y";
    }
    if (diffDays <= 370) {
        return "5y";
    }
    if (diffDays <= 1850) {
        return "10y";
    }
    return "20y";
}

function mapYahooInterval(period) {
    if (period === "1d") {
        return "1d";
    }
    if (period === "1w") {
        return "1wk";
    }
    if (period === "1mon") {
        return "1mo";
    }
    throw new Error(`unsupported period ${period}`);
}

async function fetchYahooKlines(scode, period, range) {
    const symbol = toYahooSymbol(scode);
    const interval = mapYahooInterval(period);
    const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`);
    url.searchParams.set("interval", interval);
    url.searchParams.set("range", range);
    url.searchParams.set("includePrePost", "false");
    url.searchParams.set("events", "div,splits,capitalGains");
    url.searchParams.set("corsDomain", "finance.yahoo.com");

    info(`fetch ${symbol} ${period} range=${range}`);
    const response = await fetch(url.toString(), {
        headers: {
            "User-Agent": "Mozilla/5.0",
            "Accept": "application/json"
        }
    });
    const text = await response.text();
    if (!response.ok) {
        throw new Error(`Yahoo request failed: ${response.status} ${text}`);
    }

    const json = JSON.parse(text);
    const result = json && json.chart && Array.isArray(json.chart.result) ? json.chart.result[0] : null;
    if (!result || !Array.isArray(result.timestamp) || !result.indicators || !result.indicators.quote || !result.indicators.quote[0]) {
        const message = json && json.chart && json.chart.error ? JSON.stringify(json.chart.error) : text;
        throw new Error(`Yahoo payload invalid: ${message}`);
    }

    const quote = result.indicators.quote[0];
    const timestamps = result.timestamp;
    const adjclose = result.indicators.adjclose && result.indicators.adjclose[0] ? result.indicators.adjclose[0].adjclose : null;
    const rows = [];

    for (let i = 0; i < timestamps.length; i++) {
        const open = quote.open ? quote.open[i] : null;
        const close = quote.close ? quote.close[i] : null;
        const high = quote.high ? quote.high[i] : null;
        const low = quote.low ? quote.low[i] : null;
        const volume = quote.volume ? quote.volume[i] : null;
        if (![open, close, high, low].every((item) => Number.isFinite(item))) {
            continue;
        }

        const closePrice = Number.isFinite(adjclose && adjclose[i]) ? adjclose[i] : close;
        rows.push({
            time: timeFormat(timestamps[i] * 1000, "yyyyMMdd"),
            open,
            close: closePrice,
            high,
            low,
            volume: Number.isFinite(volume) ? volume : 0,
            amount: 0
        });
    }

    return rows;
}

function filterNewRows(rows, lastDate) {
    if (!lastDate) {
        return rows;
    }
    return rows.filter((row) => row.time >= lastDate);
}

async function uploadRows(scode, period, rows) {
    if (rows.length === 0) {
        info(`skip upload ${normalizeUsScode(scode)} ${period}: no rows`);
        return;
    }

    for (let i = 0; i < rows.length; i += g.batchSize) {
        const batch = rows.slice(i, i + g.batchSize).map((row) => [
            row.time,
            row.open,
            row.close,
            row.high,
            row.low,
            row.volume,
            row.amount
        ]);
        const body = {
            scode: normalizeUsScode(scode),
            period,
            passcode: g.passcode,
            data: batch
        };
        await post(`${g.baseUrl}/stock/k/upload`, body);
        info(`uploaded ${normalizeUsScode(scode)} ${period} ${batch[0][0]}-${batch[batch.length - 1][0]} ${batch.length}`);
    }
}

async function updatePeriod(scode, period, rangeOverride) {
    const normalizedScode = normalizeUsScode(scode);
    const lastDate = await getKLastDate(normalizedScode, period).catch((e) => {
        error(`getKLastDate failed ${normalizedScode} ${period}`, e.toString());
        return null;
    });
    const range = resolveRange(period, lastDate, rangeOverride);
    const rows = await fetchYahooKlines(normalizedScode, period, range);
    const newRows = filterNewRows(rows, lastDate);
    info(`rows ${normalizedScode} ${period}: total=${rows.length} new=${newRows.length} lastDate=${lastDate || ""}`);
    await uploadRows(normalizedScode, period, newRows);
}

function parseStockList(raw) {
    if (!raw) {
        return [];
    }
    if (fs.existsSync(raw)) {
        return fs.readFileSync(raw, "utf8")
            .split(/\r?\n|,|;/)
            .map((item) => item.trim())
            .filter(Boolean);
    }
    return raw.split(",").map((item) => item.trim()).filter(Boolean);
}

async function main() {
    const stocksArg = args[2] || process.env.US_STOCKS || "";
    const periodsArg = args[3] || process.env.US_PERIODS || "";
    const rangeOverride = args[4] || process.env.US_RANGE || "";
    const stocks = parseStockList(stocksArg);
    const periods = periodsArg
        ? periodsArg.split(",").map((item) => item.trim()).filter(Boolean)
        : g.defaultPeriods;

    if (stocks.length === 0) {
        console.log("usage: node shell/us.js AAPL,MSFT [1w,1mon] [range]");
        process.exitCode = 1;
        return;
    }

    for (const period of periods) {
        if (!g.defaultPeriods.includes(period)) {
            throw new Error(`unsupported period ${period}`);
        }
    }

    for (const scode of stocks) {
        for (const period of periods) {
            try {
                await updatePeriod(scode, period, rangeOverride);
            } catch (e) {
                error(`update failed ${scode} ${period}`, e.stack || e.toString());
            } finally {
                await log2File();
            }
        }
    }
}

main().then(async () => {
    await log2File();
}).catch(async (e) => {
    error(e.stack || e.toString());
    await log2File();
    process.exitCode = 1;
});
