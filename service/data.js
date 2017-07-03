/** service logic control of data interface */
'use strict';
var request = require('request');
var config = require('../config');

module.exports = {
    index: function* (next) {
        var url = this.url.match(/\/data\/(\w+)?/, '');
        url = url.length > 1 ? url[1] : url[0];
        var addressip = this.ip.replace(/::ffff:/, '');
        var para = this.request.body;
        para.address = addressip;
        // para.platform = this.req.headers['user-agent'];
        // para.platform = navigator.platform +':'+ navigator.userAgent.match(/\s\w+\/\d+/g)[1];
        var data = yield function (done) {
            request.post('http:' + config.monitorUrl + url, { form: para, json: true }, function (err, res, body) {
                done(err, body);
            });
        }
        this.type = 'json';
        this.body = data;
    }
}