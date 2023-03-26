'use strict';

const fs = require('fs');
const path = require('path');
const bytenode = require('bytenode');
const v8 = require('v8');

v8.setFlagsFromString('--no-lazy');

const pathName = path.join(__dirname, './main');

try {
    (async function () {
        try {
            await bytenode.compileFile({
                filename: `${pathName}.js`,
                electron: true,  // electron的项目这个参数一定要加上
                compileAsModule: true
            }, `${pathName}b.js`);
            // 将原来的js文件里面的内容替换成下面的内容
            fs.writeFileSync(pathName, 'require("bytenode");require("./mainb.js");', 'utf8');
        } catch (e) {
            console.error(`run_bytenode_err: ${e}`);
        }
    }());
} catch (e) {
    console.error(`run_bytenode_err: ${e}`);
}

