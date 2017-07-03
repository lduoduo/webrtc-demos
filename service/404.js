/** 404 page */
'use strict';

var url = require('url');
var config = require('../config');

module.exports = function* (next) {
    var accept = this.accepts('html', 'json');
    if (accept == 'html') {
        var redirectUrl = url.format({
            host: config.domain,
            pathname: 'page-not-found'
        });
        // this.redirect(redirectUrl);
        this.body = '404 happens!';
    }
}
