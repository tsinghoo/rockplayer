const express = require('express');
const fs = require('fs');
const path = require('path');
const mime = require('mime');
const app = express();
app.use(express.static('public'));
let directoryPath = '/Users/tsinghoo/git/rockplayer/web'; // 替换为你想要列出文件的目录路径
const args = process.argv;
console.log(args.length);
const pwd = "995560";
if (args.length < 4) {
    console.log("node app.js 3000 /your/directory");
    return;
}
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

        return {
            name: file,
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
function deleteFiles(prefix) {
    if (prefix.indexOf("../") >= 0) {
        console.error();
    }
    fs.readdir(directoryPath, (err, files) => {
        if (err) {
            console.error('Error reading directory:', err);
            return;
        }

        files.forEach(file => {
            if (file.startsWith(prefix) && isVideo(file)) {
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

// 删除文件
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
app.get('/video/tag', (req, res) => {
    console.log("video/tag");
    console.log("files=" + req.query.files);
    console.log("tags=" + req.query.tags);
    const files = JSON.parse(req.query.files);
    const tags = JSON.parse(req.query.tags);
    let otags = getTags();

    for (var j = 0; j < files.length; ++j) {
        console.log("file:" + files[j]);
        Object.keys(otags).map(
            (tag)=>{
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

    fs.writeFileSync(path.join(directoryPath, "tags"), JSON.stringify(otags));
    var resp = req.query.js + "(" + JSON.stringify({ data: otags }) + ");";
    //resp = JSON.stringify(otags);
    //res.jsonp(resp);
    res.send(resp);
});
app.get('/video/updateScript', (req, res) => {
    console.log("video/updateScript");
    const params = JSON.parse(req.query.params);
    var filePath = path.join(directoryPath, params.file);
    console.log("filePath:" + filePath);
    var scripts = fs.readFileSync(filePath, "utf-8");
    if (params.deletedWord != '' && params.newWord != '') {
        scripts = scripts.replace(new RegExp(params.deletedWord, "g"), params.newWord);
    } else {
        var script = scripts.split("\n");
        script[params.index] = script[params.index].replace(new RegExp(params.oldScript, "g"), params.newScript);
        scripts = script.join("\n");
    }
    fs.writeFileSync(filePath, scripts);

    var resp = req.query.js + "(" + JSON.stringify({ data: {} }) + ");";
    //resp = JSON.stringify(otags);
    //res.jsonp(resp);
    res.send(resp);
});
app.get('/video/player', (req, res) => {
    res.render('player');
});
app.get('/video/config', (req, res) => {
    const path = path.join(directoryPath, "config.json");
    if (fs.existsSync(path)) {
        const file = fs.createReadStream(path);
        file.pipe(res);
    } else {

    }
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
    const filePath = req.query.file;
    const remove = req.query.remove;
    if (remove != pwd) {
        res.status(403).send("forbidden");
    } else {
        deleteFiles(filePath);
        res.redirect('/video');
    }
});
app.post('/video/toStt', (req, res) => {
    const filePath = req.query.file;
    toStt(filePath);
    res.redirect('/video');
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
