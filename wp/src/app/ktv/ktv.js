/**
 * 在线KTV
 * created by lduoduo
 * 依赖: webAudio.js
 */

// 引入样式文件
import './ktv.scss';

// 引入资源
require('../../media/cs1.mp3')
require('../../media/cs2.mp3')
require('../../media/cs3.mp3')
require('../../media/cs4.mp3')
require('../../media/cs5.mp3')
require('../../media/cs6.mp3')
require('../../media/cs7.mp3')
require('../../media/cs8.mp3')
require('../../media/cs9.mp3')
require('../../media/cs10.mp3')


let serverWs = MY.environment === 'dev' ? `${window.location.hostname}:${MY.wsPort}` : window.location.hostname
let serverStatic = MY.frontUrl


window.home = {
    init() {
        this.initBg()
    },
    initBg() {
        window.mv = new MusicVisualizer();
        let index = Math.floor(Math.random() * 10) + 1
        mv.play(`${serverStatic}media/cs${index}.mp3`, true);
    }
}

home.init()