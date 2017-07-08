/** service logic control of page test */
'use strict';

var view = require('../modules/render/bigpipe/bp');
var config = require('../config');

module.exports = {
    index: function* (next) {

        this.body = new view('message', this);

        this.body.page('message', {
            title: '实时文字聊天',
            state: {
                keywords: config.keywords,
                description: config.description
            }
        });

        this.body.addReferences('rtcSDK.js');
        this.body.addReferences('minAlert.js');
        this.body.addReferences('minAlert.css');
        this.body.addReferences('notification.js');

        yield this.body.render();

    }
}