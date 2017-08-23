/** service logic control of page test */
'use strict';

var view = require('../modules/render/bigpipe/bp');
var config = require('../config');

module.exports = {
    index: function* (next) {

        console.log('access home');
        
        this.body = new view('home', this);

        this.body.page('home', {
            title: 'im duoduo',
            state: {
                keywords: config.keywords,
                description: config.description
            }
        });

        this.body.addReferences('star.js');

        yield this.body.render();

    }
}