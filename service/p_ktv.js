/** service logic control of page test */
'use strict';

var view = require('../modules/render/bigpipe/bp');
var config = require('../config');

module.exports = {
    index: function* (next) {

        this.body = new view('ktv', this);

        this.body.page('ktv', {
            title: '在线KTV',
            state: {
                keywords: config.keywords,
                description: config.description
            }
        });

        this.body.addReferences('webAudio.js');
        this.body.addReferences('musicPlug.js');

        yield this.body.render();

    }
}