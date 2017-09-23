/** service logic control of page test */
'use strict';

var view = require('../modules/render/bigpipe/bp');
var config = require('../config');

module.exports = {
    index: function* (next) {

        this.body = new view('video', this);

        this.body.page('video', {
            title: '音视频:Safari支持啦!',
            state: {
                keywords: config.keywords,
                description: config.description
            }
        });

        // this.body.addReferences('webAudio.js');

        yield this.body.render();

    }
}