/** service logic control of page test */
'use strict';

var view = require('../modules/render/bigpipe/bp');
var config = require('../config');

module.exports = {
    index: function* (next) {

        this.body = new view('home', this);

        this.body.page('home', {
            title: 'im duoduo',
            state: {
                keywords: 'webrtc,WebRTC,desktop capture,rtcdata,dataChannel,音频,视频,音视频,桌面共享',
                description: '实时音视频,实时桌面共享,实时数据传输'
            }
        });

        yield this.body.render();

    }
}