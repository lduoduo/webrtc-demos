/** service logic control of page test */
'use strict';

var view = require('../modules/render/bigpipe/bp');
var config = require('../config');

module.exports = {
    index: function* (next) {

        this.body = new view('desktop', this);

        this.body.page('desktop', {
            title: '实时桌面共享',
            state: {
                keywords: config.keywords,
                description: config.description
            }
        });

        // this.body.addReferences('rtcSDK.js');

        yield this.body.render();

    }
}