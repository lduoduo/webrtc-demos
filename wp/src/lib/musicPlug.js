/**
 *  音乐可视化插件 -- by duoduo
 *  https://github.com/lduoduo/H5_WebAudio_Music/blob/master/MusicVisualizePlug_zh.js
 *  兼容：
 *      1. audio元素的播放模式
 *      2. arraybuffer解码的播放模式
 *  用法：
 *      window.mv = new MusicVisualizer();
        mv.ini($("#canvas")[0], window);
        mv.play("/media/xxx.mp3", isMobile); isMobile是否为手机，PC直接用audio标签处理，手机会用arraybuffer处理
        更换歌曲：mv.play("/media/xxx.mp3", isMobile);
        暂停：mv.pause();
        恢复：mv.resume();
        停止：mv.stop();
        更换音量：mv.changeVolumn(num);
 *  待完善：
 *      arraybuffer的本地缓存!
 */
var MusicVisualizer = function () {

    this.source = {};//当前正在播放的bufferSource

    this.box = null;
    this.cxt = null;

    this.volumnId = null;

    this.analyser = MusicVisualizer.ac.createAnalyser();
    this.gainNode = MusicVisualizer.ac[MusicVisualizer.ac.createGain ? "createGain" : "createGainNode"]();

    this.size = 64;
    this.analyser.fftSize = this.size * 8;

    this.analyser.connect(MusicVisualizer.ac.destination);

    this.gainNode.connect(this.analyser);

    this.xhr = new XMLHttpRequest();
}

window.AudioContext = window.AudioContext || window.webkitAudioContext || window.mozAudioContext || window.msAudioContext;

MusicVisualizer.ac = new (window.AudioContext)();

//检测是否为function
MusicVisualizer.isFunction = function (fun) {
    return Object.prototype.toString.call(fun) == "[object Function]";
}

// //将canvas用作背景,目前在新的chrome里已经不支持了
// MusicVisualizer.prototype.ini = function (container, canvasId, volumnId) {
//     var self = this;
//     this.box = container;
//     this.cxt = document.getCSSCanvasContext("2d", canvasId, this.box.clientWidth, this.box.clientHeight);
//     this.volumnId = volumnId;
//     this.visualizer();
//     this.volumnId.onclick = function () {
//         self.changeVolumn(this.value / this.max);
//     }
// }

//初始化，传入canvas, 挂载对象，初始化音量
MusicVisualizer.prototype.ini = function (container, context, volumnId) {
    var box = this.box = container;
    var ct = this.window = context;
    box.width = ct.screen.availWidth,
    box.height = ct.screen.availHeight,
    this.cxt = box.getContext("2d"),
    this.volumnId = volumnId,
    this.visualizer();
}

//异步加载音乐url，接收arraybuffer数据流
MusicVisualizer.prototype.load = function (xhr, url, cb) {
    var self = this;
    xhr.abort();

    xhr.open('GET', url);
    xhr.responseType = "arraybuffer";
    xhr.onload = function () {
        console.log(xhr.response);
        MusicVisualizer.isFunction(cb) && cb.call(self, url, xhr.response);
    }
    xhr.send(); // 发送请求
}

//二进制数据进行audio解码
MusicVisualizer.prototype.decode = function (url, arraybuffer, cb) {
    var self = this;
    MusicVisualizer.ac.decodeAudioData(arraybuffer, function (buffer) {
        if (self.source.curr) {
            var fn = self.source.bs[self.source.bs.stop ? "stop" : "nodeOff"];
            self.source.bs && fn && self.source.bs[self.source.bs.stop ? "stop" : "nodeOff"]();
        }
        self.source.curr = url;
        var bs = MusicVisualizer.ac.createBufferSource();
        bs.buffer = buffer;
        bs.loop = true;
        //bufferSource.connect(ac.destination);
        bs.connect(self.gainNode);
        //bufferSource.start();
        bs[bs.start ? "start" : "noteOn"](0);
        self.source.bs = bs;

    }, function (err) {
        console.log('err:' + err);
    });
}

//播放url的歌曲，调用该方法可以实时换歌
MusicVisualizer.prototype.play = function (url, isMobile/*是否移动设备*/) {
    var self = this;
    if (self.source.curr && self.source.curr == url) {
        return;
    }
    //pc上通过audio标签创建MediaaudioElementSourceNode，比ajax请求再解码要快
    if (!isMobile) {
        //self.audio.src = path;

        //兼容arraybuffer的方式，如果有，先停掉
        this.stop();

        if(!self.audio){
            self.audio = new Audio(url);
            self.audio.loop = true;
            var bs = MusicVisualizer.ac.createMediaElementSource(self.audio);
            bs.connect(self.gainNode);
            self.source.bs = bs;
        }else{
            // this.stop();
            self.audio.src = url;
        }


        self.audio.play();

        self.source.curr = url;

    } else {
        if(self.audio){
            self.audio.pause();
            self.audio = null;
        }
        self.load(self.xhr, url, self.decode);
    }

}

//音量控制
MusicVisualizer.prototype.changeVolumn = function (percent) {
    this.gainNode.gain.value = percent * percent;
}

//可视化控制
MusicVisualizer.prototype.visualizer = function () {
    var self = this;
    this.cxt.clearRect(0, 0, this.cxt.canvas.width, this.cxt.canvas.height);
    var arr = new Uint8Array(this.analyser.frequencyBinCount);
    function v() {
        self.analyser.getByteFrequencyData(arr);
        //console.log(arr);
        self.drawCanvasDot(arr); //画圆圈
        // self.drawCanvasRect(arr); //画柱状条
        window.requestAnimFrame(v); //使动画更流畅
    }
    window.requestAnimFrame(v);
}

//画圆圈
MusicVisualizer.prototype.drawCanvasDot = function (arr) {
    var ca = this.cxt.canvas;
    this.cxt.clearRect(0, 0, ca.width, ca.height);
    if (!this.source.dot) {
        this.source.dot = [];
        var tp = this.source.dot;
        for (var i = 0; i < this.size; i++) {
            tp[i] = {};
            tp[i].x = getRandom(0, ca.width);
            tp[i].y = getRandom(0, ca.height);
            tp[i].color = "rgba(" + getRandom(0, 255) + "," + getRandom(0, 255) + "," + getRandom(0, 255) + ",0)";
            tp[i].dr = ca.height / 50;
            tp[i].vx = getRandom(0.5, 1.5, true);
        }
    }
    var tp = this.source.dot;
    for (var i = 0; i < this.size; i++) {
        tp[i].r = tp[i].dr + arr[4 * i] / 256 * (ca.height > ca.width ? ca.width : ca.height) / 10;
        tp[i].x = (tp[i].x > ca.width + tp[i].r ? -tp[i].r : tp[i].x + tp[i].vx);
        this.cxt.beginPath();
        this.cxt.arc(tp[i].x, tp[i].y, tp[i].r, 0, 2 * Math.PI);
        var rrd = this.cxt.createRadialGradient(tp[i].x, tp[i].y, 0, tp[i].x, tp[i].y, tp[i].r);
        rrd.addColorStop(0, "#fff");
        rrd.addColorStop(1, tp[i].color);
        this.cxt.fillStyle = rrd;
        this.cxt.fill();
    }
}

//画柱状条
MusicVisualizer.prototype.drawCanvasRect = function (arr) {
    var ca = this.cxt.canvas;
    this.cxt.clearRect(0, 0, ca.width, ca.height);
    var h, w = ca.width / this.size;
    if (!this.source.rect) {
        this.source.rect = [];
        var tp = this.source.rect;
        for (var i = 0; i < this.size; i++) {
            tp[i] = {};
            tp[i].vy = 2;
            tp[i].cap = w * 0.8 > 10 ? 10 : w * 0.8;
            tp[i].h = 0;
            tp[i].dy = 5 * tp[i].cap;
        }
    }
    var grd = this.cxt.createLinearGradient(0, 0, 0, ca.height);
    grd.addColorStop(1, "green");
    grd.addColorStop(0.3, "yellow");
    grd.addColorStop(0, "red");
    this.cxt.fillStyle = grd;

    for (var i = 0; i < this.size; i++) {
        h = arr[4 * i] / 256 * ca.height;
        if (this.source.rect[i].h <= 0) {
            this.source.rect[i].h = (h == 0 ? 0 : h + this.source.rect[i].dy);
        } else {
            // source.rect[i].h = (source.rect[i].h < 0? 0: source.rect[i].h);
            this.source.rect[i].h = (this.source.rect[i].h < h ? h + this.source.rect[i].dy : this.source.rect[i].h - this.source.rect[i].vy);
            this.source.rect[i].h = (this.source.rect[i].h + this.source.rect[i].cap >= ca.height ? ca.height - this.source.rect[i].cap : this.source.rect[i].h);
        }

        this.cxt.beginPath();
        this.cxt.fillRect(w * i, ca.height - this.source.rect[i].h - this.source.rect[i].cap, w * 0.8, this.source.rect[i].cap); // cap
        this.cxt.fillRect(w * i, ca.height - h, w * 0.8, h);
    }
}

//窗口大小变化监控
MusicVisualizer.prototype.resize = function () {
    var ca = this.cxt.canvas;
    var bk_w = ca.width;
    var bk_h = ca.height;
    this.width = this.box.clientWidth;
    ca.height = this.box.clientHeight;
    if (this.source.dot) {
        var tp = this.source.dot;
        for (var i = 0; i < this.size; i++) {
            tp[i].x = tp[i].x * ca.width / bk_w;
            tp[i].y = tp[i].y * ca.height / bk_h;
        }
    }
}

//播放mv对象的source,mv.onended为播放结束后的回调, 目前没有用到，无法证实是否可用
MusicVisualizer.play1 = function (mv) {

    mv.source.connect(mv.analyser);

    if (mv.source === mv.audioSource) {
        mv.audio.play();
        mv.audio.onended = mv.onended;
    } else {
        //兼容较老的API
        mv.source[mv.source.start ? "start" : "noteOn"](0);

        //为该bufferSource绑定onended事件
        MusicVisualizer.isFunction(mv.onended) && (mv.source.onended = mv.onended);
    }

}

//暂停
MusicVisualizer.prototype.pause = function () {
    if(this.audio){
        this.audio.pause();
    }else{
        this.source.bs.disconnect();
    }
}

//恢复
MusicVisualizer.prototype.resume = function () {
    if(this.audio){
        this.audio.play();
    }else{
        this.source.bs.connect(this.gainNode);
    }
}

//停止
MusicVisualizer.prototype.stop = function () {
    if(this.audio){
        this.audio.pause();
        this.audio.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAVFYAAFRWAAABAAgAZGF0YQAAAAA=';
    }else{
        this.source.bs && this.source.bs.stop && this.source.bs.stop();
    }
}

//停止mv.source， 该方法有问题，目前没有用到
MusicVisualizer.stop1 = function (mv) {
    if (mv.source === mv.audioSource) {
        mv.audio.pause();
        mv.audio.onended = window.undefined;
    } else {
        //兼容较老的API
        mv.source[mv.source.stop ? "stop" : "noteOff"](0);

        //停止后移除之前为mv.source绑定的onended事件
        mv.source.onended = window.undefined;
    }
}


//生成随机数
function getRandom(m, n, isFloat) {
    return (isFloat ? Math.random() * (n - m) + m : Math.floor(Math.random() * (n - m)) + m);
}

window.requestAnimFrame = (function () {
    return window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.oRequestAnimationFrame || window.msRequestAnimationFrame ||
        function ( /* function FrameRequestCallback */ callback, /* DOMElement Element */ element) {
            return window.setTimeout(callback, 1000 / 60);
        };
})();