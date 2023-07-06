const express = require('express');
const fs = require('fs');
const path = require('path');
const mime = require('mime');
const app = express();
app.use(express.static('public'));
let directoryPath = '/Users/tsinghoo/git/rockplayer/web'; // 替换为你想要列出文件的目录路径
const args = process.argv;
console.log(args.length);
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

// 设置模板引擎
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// 路由：首页
app.get('/video/i', (req, res) => {
    const files = listFiles();
    const remove = req.query.remove;
    res.render('index', { files: files, remove: remove });
});
app.get('/video/player', (req, res) => {
    res.render('player');
});
app.get('/video/download/:filename', (req, res) => {
    const fileName = req.params.filename;
    const filePath = path.join(directoryPath, fileName);

    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
        res.status(404).send('文件不存在！');
        return;
    }


    const contentType = mime.getType(filePath);

    res.setHeader('Content-Type', contentType);
    // 设置响应头
    // res.setHeader('Content-Type', 'application/octet-stream');
    // res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);

    // 创建可读流并将文件内容传输到响应中
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
});

// 路由：删除文件
app.post('/video/delete', (req, res) => {
    const filePath = req.query.file;
    deleteFiles(filePath);
    res.redirect('/video');
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
