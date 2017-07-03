/** try to use the thought of bigpipe to render the templates */
/**
 * created by duoduo on 2016-1204
 * how to use:
 *  - init:
 *      this.body = new View(option, ctx);
 *  - add partial tpl:
 *      this.body.add(tpl_name)
 *      this.body.add(tpl_name, data/url)
 *      this.body.add(tpl_name, data/url, function(data){
 *          return data; //handle data by self
 *      });
 *  - render html
 *      yield this.body.render();
 * tips:
 *  - 1. option = {
 *      view, //page folder name
 *      tpl //tpl folder name, will use the same name as view name if not set;
 *    }
 *    2. option = string;
 *      //will set page folder name and tpl folder name as the input string;
 */
'use strict';

var Readable = require('stream').Readable;
var request = require('request');
var co = require('co');
var path = require('path');
var ejs = require('ejs');
var fs = require('fs');
const os = require('os');

var config = require('../../../config');
var render = require('../render');

const viewPath = '../../views/';
const tplPath = '../../tpl/';

/** for testing */
const sleep = ms => new Promise(r => setTimeout(r, ms));

module.exports = class View extends Readable {
    /** why need ctx here? we need pass in common variables in koa to use */
    constructor(option, ctx) {

        super();

        ctx.type = "html";

        this.data = {

            /** states of server */
            state: ctx.state || {},
            /** querystring object of request */
            query: ctx.query || {},

            config: config,
            prefix: config.frontURL,
            // prefixCss: config.frontURL.css,

            pageName: null,
            pageCss: null,

            commons: {
                js: `${config.frontURL}page/common.js`,
                header: `${config.frontURL}page/common/header.js`,
                footer: `${config.frontURL}page/common/footer.js`,
                css: `${config.frontURL}page/common/common.css`,
            }

        };
        // 附加js/css资源
        this.references = [];
        this.components = [];
        /** render tpls in order, need pointer as index number */
        this.pointer = this.components.length;

        /** set page folder and tpl folder */
        this.viewFolder = this.tplFoler = "";
        if (typeof option == "string") {
            this.viewFolder = this.tplFoler = option;
        } else if (option instanceof 'Object') {
            this.viewFolder = option.view;
            this.tplFoler = option.tpl || option.view;
        } else {
            new Error('invalid param for option in bp.js');
            return;
        }
        if (!this.viewFolder) {
            new Error('invalid param for option in bp.js');
            return;
        }
    }

    /**
     *  according to node api, must implete _read() method here
     *  refer to : https://nodejs.org/api/stream.html#stream_new_stream_readable_options
     * */
    _read() {

    }

    /** render main page */
    page(name, data) {

        let tmp = this.data;
        tmp.pageName = name;

        tmp.pageJs = `${tmp.prefix}page/${name}/${name}.js`;
        tmp.pageCss = `${tmp.prefix}page/${name}/${name}.css`;
        /** not support deep copy here */
        Object.assign(this.data, data);

    }

    /** manually add tpl to render in service
     *  param: {
     *      name: //tpl name,
     *      url: //url or json data
     *      cb: callback
     *  }
     */
    add(name, url, cb) {
        this.components.push({
            name: name,
            url: url,
            cb: cb
        });
    }
    /** manually add other js / css references to render in service
     *  param: {
     *      name: //references name
     *  }
     */
    addReferences(name) {
        this.references.push(name)
    }
    /** render html */
    render() {

        var body = this;

        // this.addReferences('common.js')
        // this.addReferences(`${this.data.prefix}${this.data.pageName}/${this.data.pageName}.css`)
        // this.addReferences(this.data.pageName + '.css')

        return function* () {
            /** render page view */
            var content = yield render(body.viewFolder + "/" + body.data.pageName, body.data);

            body.push(content);

            /** render other references */
            renderReferences(body);

            /** render tpl components*/
            renderComponents(body);
        }
    }
}

function renderReferences(body) {
    let list = body.references
    let prefix = body.data.prefix + 'lib/'
    list.forEach(function (item) {
        // /\.js$/gi.test(item) ? body.data.prefixJs : body.data.prefixCss
        if (/\.js$/gi.test(item)) {
            body.push(`
                <script src=${prefix + item}></script>
            `);
        } else {
            body.push(`
                <link rel="stylesheet" href=${prefix + item}></link>
            `);
        }
    })
    // 最后插入本页业务js
    body.push(`
        <script src=${body.data.pageJs}></script>
    `);
}

function renderComponents(body) {
    // return function (done) {
    let promises = []; let count = body.components.length;

    body.components.forEach(function (item) {
        // for(let i=0;i<body.components.length;i++){
        // let item = body.components[i];
        let comp = item;
        let name = item.name;
        let url = item.url;
        let promise;

        promise = co(function* () {
            return yield renderTpl(body, item, url);
        }).then(function (html) {
            end(html, name);
        });

        promises.push(promise);
    });

    Promise.all(promises).then(function () {
        console.log('promises done');
        body.push(null);
    }).catch(function (e) {
        console.log(e);
    });

    /** replace the placeholder with real html */
    function end(html, name) {
        html = html.replace(/[\n,\r,\t]/gi, '').replace(/\"/gi, '\\"');
        body.push(`
            <script id=${'componet_' + name}>
                bigpipe(\"${name}\",\"${html || "empty"}\");
            </script>
        `);
    }
}

function* renderTpl(body, item, url) {
    let name = item.name;
    let data = null;
    let cb = item.cb;

    // if (!url) { return ""; }

    /** get template */
    let comTplPath = path.join(__dirname, '../', tplPath, body.tplFoler, name + '.ejs');
    let tplStr = yield readFile(comTplPath);
    let html = "";

    /** if no url passed in, means only need the template with no data */
    if (!url) {
        return ejs.render(tplStr, {}, {
            filename: 'tpl/' + body.tplFoler + '/' + name
        });
    }

    if (url instanceof Object) {
        data = url;
    }

    if (typeof url == "string") {
        data = yield function (cb) {
            request(url, { json: true }, function (err, res, data) {
                cb(err, data);
            });
        }
    }

    /** result is 404 page */
    if (typeof data == "string") {
        return data;
    }

    /** get real data */
    data = data.statuscode && data.statuscode == 1 ? data.data : data;

    if (!data) {
        return data.statusmsg || data;
    }

    /** allow cb to filter the data */
    data = cb ? cb(data) : data;

    Object.assign(data, body.data);

    try {
        html = ejs.render(tplStr, { it: data }, {
            filename: 'tpl/' + body.tplFoler + '/' + name
        });
        // html = yield render(body.tplFoler + "/" + name, { data: t });
    } catch (err) {
        html = '<pre>' + err.stack + '</pre>';
    }

    var t = Math.floor(Math.random() * 10) * 2000;
    // yield sleep(t);

    return html;

}


/**读取layout文件 */
function readFile(path) {
    return function (done) {
        fs.readFile(path, 'utf8', function (err, str) {
            if (err) return done(err);
            // remove extraneous utf8 BOM marker
            str = str.replace(os.EOL, '');
            done(null, str);
        });
    }
}
