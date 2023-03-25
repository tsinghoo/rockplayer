'use strict';

const fs = require('fs');
const path = require('path');
const bytenode = require('bytenode');
const v8 = require('v8');

v8.setFlagsFromString('--no-lazy');

const pathName = path.join(__dirname, './main.js');

try {
    (async function () {
        try {
            await bytenode.compileFile({
                filename: pathName,
                electron: true,  // electron的项目这个参数一定要加上
                compileAsModule: true
            }, `${pathName}c`);
            // 将原来的js文件里面的内容替换成下面的内容
            fs.writeFileSync(pathName, 'require("bytenode");require("./main.jsc");', 'utf8');
        } catch (e) {
            console.error(`run_bytenode_err: ${e}`);
        }
    }());
} catch (e) {
    console.error(`run_bytenode_err: ${e}`);
}

