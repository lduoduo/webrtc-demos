/** service logic control of page test */
'use strict';

var view = require('../modules/render/bigpipe/bp');
var config = require('../config');

module.exports = {
    index: function* (next) {

        this.body = new view('chat', this);

        this.body.page('chat', {
            title: '实时音视频',
            state: {
                keywords: config.keywords,
                description: config.description
            }
        });

        // this.body.addReferences('webAudio.js');

        yield this.body.render();

    }
}