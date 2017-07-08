/** service logic control of page test */
'use strict';

var view = require('../modules/render/bigpipe/bp');
var config = require('../config');

module.exports = {
    index: function* (next) {

        this.body = new view('rtcdata', this);

        this.body.page('rtcdata', {
            title: 'rtcdata demo',
            state: {
                keywords: config.keywords,
                description: config.description
            }
        });

        this.body.addReferences('rtcSDK.js');

        yield this.body.render();

    }
}