/**
 *  音乐可视化插件(有改动) -- by duoduo
 *  原版： https://github.com/lduoduo/H5_WebAudio_Music/blob/master/MusicVisualizePlug_zh.js
 *  兼容：
 *      1. audio元素的播放模式
 *      2. arraybuffer解码的播放模式
 *  用法：
 *      window.mv = new MusicVisualizer();
 *      // isMobile是否为手机，PC直接用audio标签处理，手机会用arraybuffer处理
        mv.ini({canvas:$("#canvas")[0], context:window,isMobile});
        // file: 本地文件
        mv.play({url:"/media/xxx.mp3",file:file}); 
        更换歌曲：mv.play("/media/xxx.mp3", isMobile);
        暂停：mv.pause();
        恢复：mv.resume();
        停止：mv.stop();
        更换音量：mv.changeVolumn(num);
    事件监听：
        mv.on('end',cb) // 播放完毕的回调
 *  待完善：
 *      arraybuffer的本地缓存!
 *  注：依赖插件 webAudio.js
 */

var MusicVisualizer = function () {

    this.listeners = [];
    // 当前播放器状态
    this.playStatus = 'played';
    //当前正在播放的bufferSource
    this.source = {};

    this.box = null;
    this.cxt = null;

    this.volumnId = null;

    // this.webAudio = new webAudio()

    this.analyser = webAudio.ac.createAnalyser();
    this.gainNode = webAudio.ac[webAudio.ac.createGain ? "createGain" : "createGainNode"]();

    this.size = 8;
    this.analyser.fftSize = this.size * 8 * 8;

    this.analyser.connect(webAudio.ac.destination);

    this.gainNode.connect(this.analyser);

    this.ac = webAudio.ac
    this.destination = webAudio.destination
    this.outputStream = this.destination.stream

    this.xhr = new XMLHttpRequest();
}

//检测是否为function
MusicVisualizer.isFunction = function (fun) {
    return Object.prototype.toString.call(fun) == "[object Function]";
}

MusicVisualizer.prototype = {
    // //将canvas用作背景,目前在新的chrome里已经不支持了
    // ini = function (canvas, canvasId, volumnId) {
    //     var self = this;
    //     this.box = canvas;
    //     this.cxt = document.getCSSCanvasContext("2d", canvasId, this.box.clientWidth, this.box.clientHeight);
    //     this.volumnId = volumnId;
    //     this.visualizer();
    //     this.volumnId.onclick = function () {
    //         self.changeVolumn(this.value / this.max);
    //     }
    // }

    // 注册监听回调事件
    on(name, fn) {
        this.listeners[name] = fn
    },
    // 执行回调
    emit(name, data) {
        this.listeners[name] && this.listeners[name](data)
    },

    /**
     * 初始化，传入canvas, 挂载对象，初始化音量
     * @param {object} option 
     * @param {dom} option.canvas canvas dom节点
     * @param {object} option.context 挂载对象,一般为window
     * @param {boolean} option.isMobile 是否移动设备
     * @param {num} option.volumnId 初始化音量
     */
    ini(option) {
        option = option || {}
        var canvas = option.canvas,
            context = option.context,
            isMobile = option.isMobile,
            volumnId = option.volumnId;

        var box = this.box = canvas;
        var ct = this.window = context;
        box.width = ct.screen.availWidth;
        box.height = ct.screen.availHeight;
        this.cxt = box.getContext("2d");
        this.volumnId = volumnId;
        this.isMobile = isMobile || false
        this.visualizer();
    },

    //异步加载音乐url，接收arraybuffer数据流
    load(xhr, url, cb) {
        var self = this;
        xhr.abort();

        xhr.open('GET', url);
        xhr.responseType = "arraybuffer";
        xhr.onload = function () {
            console.log(xhr.response);

            MusicVisualizer.isFunction(cb) && cb.call(self, xhr.response);
        }
        // 发送请求
        xhr.send();
    },

    //二进制数据进行audio解码
    decode(arraybuffer) {
        var self = this;
        //兼容arraybuffer的方式，如果有，先停掉
        this.stop(true);

        return new Promise((resolve, reject) => {
            webAudio.ac.decodeAudioData(arraybuffer, function (buffer) {

                self.source.curr = self.source.newUrl;
                var bs = webAudio.ac.createBufferSource();
                bs.buffer = buffer;
                // bs.loop = true;

                if (/(resumed|played)/.test(self.playStatus)) {
                    bs.connect(self.gainNode);
                }

                //兼容较老的API
                bs[bs.start ? "start" : "noteOn"](0);

                self.source.bs = bs;
                bs.onended = self.onended.bind(self)

                // 更新stream
                self.outputStream = webAudio.destination.stream

                resolve(self.source.newUrl)

            }, function (err) {
                console.log('err:' + err);
                reject('文件类型不合法, 请选择音乐格式的文件')
            });
        })
    },

    /**
     * 播放url的歌曲，调用该方法可以实时换歌
     * @param {object} option 
     * @param {file} option.file 播放本地音频文件(input获取)
     * @param {string} option.url 播放远程音频文件
     * @returns 
     */
    play(option) {
        var self = this;
        option = option || {}

        return new Promise((resolve, reject) => {
            // 如果是播放本地文件
            if (option.file && option.file.constructor === File) {
                self.source.newUrl = option.file.name

                var reader = new FileReader();

                reader.onload = function (e) {
                    self.decode(e.target.result)
                }
                reader.readAsArrayBuffer(option.file);

                resolve(self.source.newUrl)
                return
            }

            var url = option.url

            if (self.source.curr && self.source.curr == url) {
                reject();
            }

            self.source.newUrl = url;
            //pc上通过audio标签创建MediaaudioElementSourceNode，比ajax请求再解码要快
            if (!this.isMobile) {
                //self.audio.src = path;

                //兼容arraybuffer的方式，如果有，先停掉
                this.stop(true);

                if (!self.audio) {
                    self.audio = new Audio(url);
                    self.audio.crossOrigin = 'anonymous';
                    // self.audio.loop = true;
                    var bs = webAudio.ac.createMediaElementSource(self.audio);
                    bs.connect(self.gainNode);
                    self.source.bs = bs;
                    self.audio.onended = this.onended.bind(this);

                } else {
                    self.audio.src = url;
                }

                if (/(resumed|played)/.test(this.playStatus)) {
                    //兼容较老的API
                    self.audio.play();
                }

                // 更新stream
                self.outputStream = webAudio.destination.stream

                self.source.curr = url;

            } else {

                self.load(self.xhr, url, self.decode);
            }

            resolve(url)
        })

    },

    // 播放完毕回调
    onended() {
        if (this.source.curr === this.source.newUrl) {
            this.emit('end')
        }
    },

    //音量控制
    changeVolumn(percent) {
        this.gainNode.gain.value = percent * percent;
    },

    //可视化控制
    visualizer() {
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
    },

    //画圆圈
    drawCanvasDot(arr) {
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
            this.cxt.globalAlpha = 0.3;
            this.cxt.arc(tp[i].x, tp[i].y, tp[i].r, 0, 2 * Math.PI);
            var rrd = this.cxt.createRadialGradient(tp[i].x, tp[i].y, 0, tp[i].x, tp[i].y, tp[i].r);
            rrd.addColorStop(0, "#fff");
            rrd.addColorStop(1, tp[i].color);
            this.cxt.fillStyle = rrd;
            this.cxt.fill();
        }
    },

    //画柱状条
    drawCanvasRect(arr) {
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
    },

    //窗口大小变化监控
    resize() {
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
    },

    //暂停
    pause() {
        this.playStatus = 'paused'
        if (this.audio) {
            this.audio.pause();
        }
        if (this.source.bs && this.source.bs.disconnect) {
            this.source.bs.disconnect();
        }
    },

    //恢复
    resume() {
        this.playStatus = 'resumed'
        if (this.audio && this.audio.src) {
            this.audio.play().catch(function (e) { console.log(e) });
        }
        if (this.source.bs && this.source.bs.connect) {
            this.source.bs.connect(this.gainNode);
        }
    },

    //停止
    stop(isPlayed) {
        if (!isPlayed) {
            this.playStatus = 'stoped'
        }

        if (this.audio) {
            this.audio.pause();
            // this.audio.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAVFYAAFRWAAABAAgAZGF0YQAAAAA=';
            this.audio.src = null
            // delete this.audio.src
        }
        if (this.source.bs) {
            var fn = this.source.bs[this.source.bs.stop ? "stop" : "nodeOff"];
            fn && this.source.bs[this.source.bs.stop ? "stop" : "nodeOff"]();
        }
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