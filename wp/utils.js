/** webpack中会使用到的工具方法集合 */
const os = require('os');
const fs = require('fs');
var exec = require('child_process').exec;
var glob = require('glob');
/** 解决cmd中文乱码问题
 * http://ask.csdn.net/questions/167560
 */
var iconv = require('iconv-lite');
var encoding = 'cp936';
var binaryEncoding = 'binary';

module.exports = {
    /** 根据路径获取路径下的所有文件
     * return: {
     *  html:[],
     *  other:[]
     * }
     */
    getEntry(url, preStatic) {
        console.log("url----->%s", url);
        var entry = {
            html: {},
            entry: {}
        };
        glob.sync(url).forEach(function (name) {
            console.log('name----->%s', name);
            /*
            循环所有文件，对文件名做处理，并放入entry数组中，返回entry
             */
            var n = "", type = "";
            // n = name.substring((name.lastIndexOf('/') + 1), name.lastIndexOf('.'));
            if (/\.html$/.test(name)) {
                //是html页面
                type = "html";
                n = name.substring(8, name.lastIndexOf('.'));
                // console.log("n_html:"+n);
            } else if (/\.js$/.test(name) && !/^_/.test(name)) {
                //不是html页面  这里实际上只有js页面需要处理
                type = "entry";
                n = name.substring(8, name.lastIndexOf('.'));
                n = n.substring(0, n.lastIndexOf('/'));
                // n = name.substring((name.lastIndexOf('/') + 1), name.lastIndexOf('.'));

                //为脚本样式添加统一前缀
                n = preStatic ? preStatic + '/' + n : n;
            }
            // name = name.replace(/\//gi, "/");
            console.log("file----->%s", name);
            name = __dirname + "\\" + name;
            name = name.replace(/\\/gi, "/");
            if (n) {
                entry[type][n] = name;
            }
        });
        console.log('entry----->%s', JSON.stringify(entry));
        return entry;
    },
    // for my webrtc
    getEntryW(url, preStatic) {
        console.log("url----->%s", url);
        var entry = {
            html: {},
            entry: {}
        };
        glob.sync(url).forEach(function (name) {
            console.log('name----->%s', name);
            /*
            循环所有文件，对文件名做处理，并放入entry数组中，返回entry
             */
            var n = "", type = "";
            // n = name.substring((name.lastIndexOf('/') + 1), name.lastIndexOf('.'));
            if (/\.html$/.test(name)) {
                //是html页面
                type = "html";
                n = name.substring(8, name.lastIndexOf('.'));
                // console.log("n_html:"+n);
            } else if (/\.js$/.test(name) && !/^_/.test(name)) {
                //不是html页面  这里实际上只有js页面需要处理
                type = "entry";
                n = name.substring(8, name.lastIndexOf('.'));
                // n = n.substring(0, n.lastIndexOf('/'));
                // n = name.substring((name.lastIndexOf('/') + 1), name.lastIndexOf('.'));

                //为脚本样式添加统一前缀
                n = preStatic ? preStatic + '/' + n : n;
            }
            // name = name.replace(/\//gi, "/");
            console.log("file----->%s", name);
            name = __dirname + "\\" + name;
            name = name.replace(/\\/gi, "/");
            if (n) {
                entry[type][n] = name;
            }
        });
        console.log('entry----->%s', JSON.stringify(entry));
        return entry;
    },
    /** 判断文件夹路径是否已存在，不存在则创建路径 */
    checkDir(destPath) {

        return function (done) {
            fs.stat(destPath, function (err) {
                // console.log(destPath)
                // console.log(err)
                if (err) {
                    // 创建文件夹
                    fs.mkdir(destPath, function (error) {
                        // console.log(error)
                        done('', error);
                    });
                } else {
                    done('', '');
                }
            });
        }

    },
    /** windows平台的文件路径copy指令 */
    cmdFileCopy(srcPath, destPath) {
        console.log('srcPath--->%s\n destPath--->%s', srcPath, destPath);
        return function (done) {
            var ls = exec(`xcopy ${srcPath} ${destPath} /e`, { encoding: binaryEncoding }, function (error, stdout, stderr) {
                // if (error) {

                //     console.log(error.stack);
                //     console.log('Error code: ' + error.code);
                // }
                // console.log('Child Process STDOUT: ' + stdout);
                console.log(iconv.decode(new Buffer(stdout, binaryEncoding), encoding), iconv.decode(new Buffer(stderr, binaryEncoding), encoding));
                done('');
            });
        }
    },
    /** linux平台的文件路径copy指令 */
    lsFileCopy(srcPath, destPath) {
        console.log('srcPath--->%s\ndestPath--->%s', srcPath, destPath);
        return function (done) {
            /** 这里有个坑
             * `cp -r ${srcPath} ${destPath}` 这个会把源目录的当前文件夹一起copy过去!
             * 我们要的只是源目录下的内容，需要用如下方式
             */
            var ls = exec(`cp -r ${srcPath}/. ${destPath}`, function (error, stdout, stderr) {
                if (error) {
                    console.log(error.stack);
                    console.log('Error code: ' + error.code);
                }
                console.log('Child Process STDOUT: ' + stdout);
                done('');
            });
        }
    },
    /** 获取本机Ip */
    getLocalIP() {
        let interObj = os.networkInterfaces();
        let address;
        for (let i in interObj) {
            let itemArr = interObj[i];
            if (itemArr) {
                itemArr.forEach(function (item) {
                    if (item.family === 'IPv4' && item.address !== "127.0.0.1") {
                        address = item.address;
                        return;
                    }
                })
            }
            if (address) return address;
        };
    }
}
