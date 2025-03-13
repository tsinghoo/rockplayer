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
let DB;
app.use(express.json());
app.use(express.static('public'));
let directoryPath = '/Users/tsinghoo/git/rockplayer/web'; // 替换为你想要列出文件的目录路径
const args = process.argv;
console.log(args.length);
const pwd = "995560";
if (args.length < 4) {
    console.log("node app.js 3000 /your/directory");
    return;
}
app.use(fileUpload({
    createParentPath: true
}));
const port = parseInt(args[2]);
directoryPath = args[3];
console.log(directoryPath);
let suffix = [];
if (args.length > 4) {
    suffix = args[4].split(";");
}
console.log(args[4]);
console.log(suffix.join(" "));

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
        console.log(file + " not exists");
    }

    return tags;
}

// 删除文件
function deleteFiles(prefixs) {
    console.log("files to delete:" + JSON.stringify(prefixs));
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
                                console.log('File deleted:', filePath);
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
        console.log("error parsing replacers:" + e.message);
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

            console.log('文件写入成功。');
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

            console.log('toSplit写入成功。');
        });

    });
}

function extractVideo(inputFilePath, i, startTime, endTime) {
    return new Promise((resolve, reject) => {
        console.log("extractVideo:" + inputFilePath);
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
            console.log("error parsing replacers:" + e.message);
        }

        var data = fs.readFileSync(toSplit, 'utf8');
        var files = data.split("\n");
        files.forEach(ele => {
            console.log(ele);
        });

        for (var i = 0; i < files.length; ++i) {
            var ele = files[i];
            console.log(`processing '${ele}'`);
            if (fs.existsSync(path.join(directoryPath, ele))) {
                var pos = ele.lastIndexOf(".");
                if (pos < 0) {
                    console.log("bad file:" + ele);
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
                            console.log(`seg:${e}`);
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
        console.log(e.message);
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
    console.log("video/tag");
    console.log("files=" + req.body.files);
    console.log("tags=" + req.body.tags);
    const files = JSON.parse(req.body.files);
    const tags = JSON.parse(req.body.tags);

    let otags = getTags();

    if (files.length == 1) {
        for (var j = 0; j < files.length; ++j) {
            console.log("file:" + files[j]);
            Object.keys(otags).map(
                (tag) => {
                    var f = otags[tag];
                    delete f[files[j]];
                }
            );
        }

        console.log("otags=" + JSON.stringify(otags));

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
    console.log("video/cookies");
    let cookies = req.body.cookies;
    console.log(req.body.cookies);

    fs.writeFileSync(path.join(directoryPath, "cookies.txt"), cookies);
    var resp = JSON.stringify({ data: "success" });
    res.send(resp);
});
async function getDb() {
    if (DB) {
        console.log("DB exist");
        return DB;
    }


    console.log("open stock.db");
    const dbFilePath = path.join(directoryPath, "stock.db");
    DB = new sqlite3.Database(dbFilePath);

    console.log("open stock.db ok");
    DB.runSync = (sql, params) => {
        console.log("runSync:" + sql);
        console.log(JSON.stringify(params));
        return new Promise((resolve, reject) => {
            DB.run(sql, params, function (err) {
                if (err) {
                    resolve({ error: err });
                } else {
                    resolve({});
                }
            });
        })
    }

    DB.allSync = (sql, params) => {
        return new Promise((resolve, reject) => {
            console.log("allSync:" + sql);
            console.log(JSON.stringify(params));
            DB.all(sql, params, function (err, rows) {
                if (err) {
                    resolve({ error: err });
                } else {
                    resolve({ rows: rows });
                }
            });
        });
    }

    console.log("db inited");

    await DB.runSync(`CREATE TABLE IF NOT EXISTS tstock (
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
    )`);

    await DB.runSync(`CREATE TABLE IF NOT EXISTS tsql (
        id text primary key,
        name text,
        sql text,
        lastUseTime integer
    )`);

    await DB.runSync(`CREATE TABLE IF NOT EXISTS tStockBasic (
        id text primary key,
        scode text,
        sname text,
        buy real default 0,
        sell real default 0,
        updateTime integer
    )`);

    console.log("table inited");

    return DB;
}

app.post('/stock/update', async (req, res) => {
    console.log("/stock/update");

    let rows = req.body.rows.split("\n");
    console.log(rows.join("\n"));
    let db = await getDb();
    for (var i = 0; i < rows.length; ++i) {
        if (rows[i].trim() == "") {
            continue;
        }

        var fields = rows[i].split("\t");
        var sql = `insert or replace into tstock (tday, ttime, sname,scode,operationDirection, operationName,market,tamount,tprice,tcash,tid,taccount, tpair) 
        values (?, ?, ?,?, ?, ?,?, ?, ?,?, ?, ?, ?)`;
        let res = await db.run(sql, fields);
        if (res.error) {
            console.log(res.error);
            res.send(res);
            return;
        } else {

        }
    };

    var resp = JSON.stringify({ data: "success" });
    res.send(resp);
});

app.get('/stock/trade/update', async (req, res) => {
    console.log("/stock/trade/update");
    let js = req.query.js;
    let scode = req.query.scode;
    let sname = req.query.sname;
    let buy = req.query.buy;
    let sell = req.query.sell
    let db = await getDb();

    let sql = `insert or ignore into tstockbasic (id, scode, sname,buy,sell,updateTime) values (?,?,?,?,?,?)`;
    let r = await db.run(sql, [scode, sname, buy, sell, Date.now()]);

    var resp = `${js}(${JSON.stringify({ data: "success" })})`;
    res.send(resp);
});


app.get('/stock/fe/user/login', async (req, res) => {
    console.log("/stock/fe/user/login");
    let js = req.query.js;
    let login = req.query.login;
    let password = req.query.password;
    //todo
    var resp = `${js}(${JSON.stringify({ login: login })})`;
    res.send(resp);
});

app.get('/stock/trade/all', async (req, res) => {
    console.log("/stock/trade/all");
    let js = req.query.js;
    let db = await getDb();

    let sql = `select * from tstockbasic `;
    let r = await db.allSync(sql);

    var resp = `${js}(${JSON.stringify({ data: r.rows })})`;
    res.send(resp);
});

app.get('/stock/pair', async (req, res) => {
    console.log("/stock/pair");
    let js = req.query.js;
    let reset = req.query.reset;
    let db = await getDb();
    let sql = `select * from tstock where tamount<0 and tpair is null or tpair=''`;
    if (reset) {
        console.log("reset before pair");
        await db.runSync(`update tstock set tpair=''`);
        sql = "select * from tstock where tamount<0";
    }
    let r = await db.allSync(sql);
    let sells = r.rows;
    console.log(`${sells.length} sells`);
    for (var i = 0; i < sells.length; ++i) {
        let sell = sells[i];
        console.log(`${sell.sname}(${sell.scode}):${sell.tid}`);
        let r = await db.allSync("select * from tstock where tamount=? and scode=? and tprice<? and (tpair='' or tpair is null) order by tprice desc",
            [sell.tamount * -1, sell.scode, sell.tprice]);
        let buys = r.rows;
        if (buys.length > 0) {
            let buy = buys[0];
            console.log(`${sell.sname}(${sell.scode}):${sell.tid} <==> ${buy.tid}`);
            await db.runSync(`update tstock set tpair=? where tid=?`, [buy.tid, sell.tid]);
            await db.runSync(`update tstock set tpair=? where tid=?`, [sell.tid, buy.tid]);
        }
    };

    var resp = `${js}(${JSON.stringify({ data: "success" })})`;
    res.send(resp);
});

app.post('/stock/query', async (req, res) => {
    let db = await getDb();
    let sql = req.body.sql;
    let name = req.body.name;
    console.log(`sql:${sql}`);
    let r = await db.allSync(sql);
    if (r.error) {
        console.log(r.error);
        res.send(r);
        return;
    }

    await db.runSync(`insert or replace into tsql (id, name, sql,lastUseTime) values (?, ?,?,?)`,
        [name, name, sql, Date.now()]);

    var resp = JSON.stringify({ data: r.rows });
    res.send(resp);
});

app.get('/stock/sqls', async (req, res) => {
    let db = await getDb();
    let js = req.query.js;
    let sql = "select * from tsql order by lastUseTime desc";
    let r = await db.allSync(sql);
    if (r.error) {
        console.log(r.error);
        res.send(r);
        return;
    }

    var resp = `${js}(${JSON.stringify({ data: r.rows })})`;
    res.send(resp);
});

app.post('/stock/sql/update', async (req, res) => {
    let db = await getDb();
    let sql = req.body.sql;
    let name = req.body.name;
    let r = await db.runSync(`insert or replace into tsql (id, name, sql,lastUseTime) values (?, ?,?,?)`,
        [name, name, sql, Date.now()]);
        
    var resp = JSON.stringify({ data: "success" });
    res.send(resp);
});

app.get('/video/replacers', (req, res) => {
    console.log("video/replacers");
    var rPath = path.join(directoryPath, "replacers");
    var replacers = {};
    try {
        replacers = JSON.parse(fs.readFileSync(rPath, "utf-8"));
    } catch (e) {
        console.log("error parsing replacers:" + e.message);
    }

    var resp = req.query.js + "(" + JSON.stringify({ data: replacers }) + ");";
    res.send(resp);
});

app.get('/video/metadata', (req, res) => {
    console.log("video/metadata");
    var fileName = req.query.fileName;
    var rPath = path.join(directoryPath, "metadata");
    var data = {};
    try {
        data = JSON.parse(fs.readFileSync(rPath, "utf-8"));
    } catch (e) {
        console.log("error parsing replacers:" + e.message);
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
        console.log("dest:" + file.originalname);
        const path = path.join(directoryPath, file.originalname);
        if (fs.existsSync(path)) {
            console.log("文件已存在");
            fs.unlinkSync(path);
        } else {
        }
        cb(null, directoryPath);
    },
    filename: function (req, file, cb) {
        console.log("fileName:" + file.originalname);
        // 指定文件名
        cb(null, file.originalname);
    }
});
// 定义上传文件的路由
app.post('/video/upload', (req, res) => {
    console.log("file uploading");
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
    console.log("video/addSegment");
    var fileName = req.query.fileName;
    var start = req.query.start;
    var end = req.query.end;
    var name = req.query.name;
    var rPath = path.join(directoryPath, "metadata");
    var data = {};
    try {
        data = JSON.parse(fs.readFileSync(rPath, "utf-8"));
    } catch (e) {
        console.log("error parsing metadata:" + e.message);
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
    console.log("video/updateScript");
    console.log("params:" + JSON.stringify(req.body));
    const params = JSON.parse(req.body.params);
    var filePath = path.join(directoryPath, params.file);
    console.log("filePath:" + filePath);
    var replaceAll = params.replaceAll;
    var rPath = path.join(directoryPath, "replacers");
    var scripts = fs.readFileSync(filePath, "utf-8");
    var replacers = {};
    try {
        replacers = JSON.parse(fs.readFileSync(rPath, "utf-8"));
    } catch (e) {
        console.log("error parsing replacers:" + e.message);
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
    console.log("video/updatePosition");
    var fileName = req.query.fileName;
    var position = req.query.position;
    var rPath = path.join(directoryPath, "metadata");
    var data = {};
    try {
        data = JSON.parse(fs.readFileSync(rPath, "utf-8"));
    } catch (e) {
        console.log("error parsing replacers:" + e.message);
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
    console.log("video/updatePosition");
    var fileName = req.query.fileName;
    var position = req.query.position;
    var rPath = path.join(directoryPath, "metadata");
    var data = {};
    try {
        data = JSON.parse(fs.readFileSync(rPath, "utf-8"));
    } catch (e) {
        console.log("error parsing replacers:" + e.message);
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
    console.log("body:" + JSON.stringify(bd));
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
    console.log("videoPath:" + videoPath);
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
    console.log("remove:" + remove);
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

    console.log("rename:'" + fileName + "' to '" + newName + "'");

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

    console.log(`setScript:${top},${bottom},${left},${right},${fileName}`);

    var rPath = path.join(directoryPath, "scripts");
    var data = {};
    try {
        data = JSON.parse(fs.readFileSync(rPath, "utf-8"));
    } catch (e) {
        console.log("error parsing replacers:" + e.message);
    }

    data[fileName] = { top: top, bottom: bottom, left: left, right: right };

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

app.get('/video/removeScriptPos', (req, res) => {
    const fileName = req.query.fileName;

    console.log(`removeScript:${fileName}`);

    var rPath = path.join(directoryPath, "scripts");
    var data = {};
    try {
        data = JSON.parse(fs.readFileSync(rPath, "utf-8"));
    } catch (e) {
        console.log("error parsing replacers:" + e.message);
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
    console.log("splitting=" + splitting);
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
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});


