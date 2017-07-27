/**
 * 音频音量控制和实时音量获取
 * created by lduoduo
 * 原版： https://github.com/lduoduo/H5_WebAudio_Music/blob/master/MusicVisualizePlug_zh.js
 * 音量获取参考:
 * https://webrtc.github.io/samples/src/content/getusermedia/volume/
 * 音频转流参考:
 * https://w3c.github.io/mediacapture-fromelement/#intro
 * 开关：chrome://flags/#enable-experimental-web-platform-features
 * 兼容：
 *      1. audio元素的播放模式
 *      2. arraybuffer解码的播放模式
 * 用法：
 *      var mv = new webAudio()
 *      // 播放音源
 *      mv.play({url:"/media/xxx.mp3", file:file, needMediaStream:false});
 *      // 附加流
 *      mv.addStream(stream)
 *      // 普通播放
 *      mv.play()
 *      暂停：mv.pause();
        恢复：mv.resume();
        停止：mv.stop();
        更换音量：mv.setGain(num);
 * 事件监听：
        mv.on('playlist',cb) // 音乐列表加载完毕的回调
        mv.on('end',cb) // 播放完毕的回调
        mv.on('stop',cb) // 播放停止的回调
        mv.on('resume',cb) // 播放恢复的回调
        mv.on('pause',cb) // 播放暂停的回调
        mv.on('volume',cb) // 实时音量的回调
        mv.on('outputStream',cb) // 输出stream变化
 * 1. 音量控制
 * 2. 实时音量获取
 * 3. 多路音频输入
 * 注：
 *  -   插件依赖 webrtcsupport.js
 *  -   如果播放arraybuffer需要获取输出mediastream，请在play()里附带参数 needMediaStream = true
 */


/**
* webaudio 构造器
* 单个输入的音频流可以更新替换为新的，但是多路输入目前无法进行更新
* @param {Boolean} [option.isAnalyze=false] 是否需要监控分析，默认不分析
* @param {string} [option.effect] 效果器
* @param {num} [option.type] 音源类型(伴奏|人声：人声会做处理): 值请参考 #webAudio.type
* @param {boolean} [option.needMediaStream=false]  对于arraybuffer, 是否需要输出mediastream, 默认不输出
* 注: 需要输出mediastream的缓存默认不解码，使用原始arraybuffer
* @param {array} [option.effect] 音频处理器,按照顺序处理: 值请参考 #webAudio.effect
*/

window.webAudio = function (option = {}) {
    this.support = support.supportWebAudio && support.supportMediaStream

    // 回调监听
    this.listeners = {}
    // 处理器节点
    this.nodeList = {}
    // 是否需要输出stream
    this.needMediaStream = option.needMediaStream || false
    // 初始音量
    this.gain = this.needMediaStream ? 0.5 : 1
    // 音频dom节点
    this.audio = null
    // arraybuffer的源对象
    this.source = {}
    // this.stream = option.stream
    // 默认播放状态: played
    this.playStatus = 'played'
    // arraybuffer转url的中间变量blobUrl, 当不再使用时, 需要释放
    this.blob = null
    // arraybuffer转url的中间变量blobUrl, 当不再使用时, 需要释放
    this.blobUrl = null

    // 输出stream
    this.outputStream = null
    // 目前写死mobile模式
    this.isMobile = true

    if (!this.support) {
        return Promise.reject('webAudio not supported');
    }

    // if (!this.stream) {
    //     return Promise.reject('no audio streams for webAudio');
    // }

    // 人声输入
    this.voiceIn = {
        stream: null,
        node: {}
    }

    // 伴音输入
    this.musicIn = {
        stream: null,
        node: {}
    }

    this.instant = 0.0
    this.slow = 0.0
    this.clip = 0.0

    return this.init()

}

// N个实例对应一个环境
webAudio.ac = new support.AudioContext()

// 音源类型：人声 、 伴奏
webAudio.type = {
    'voice': 1,
    'music': 2
}
// 支持的处理器
webAudio.effect = [
    // 低通滤波器
    'BiquadFilter',
    // 混响
    'Convolver',
    // 延迟
    'Delay',
    // 动态压缩器
    'DynamicsCompressor',
    // 音量增益器(默认配备)
    'Gain',
    // 立体声声场控制
    'StereoPanner',
    // 扭曲器, 一般用于声音温暖
    'WaveShaper',
    // 音量监控
    'Monitor'
]

webAudio.prototype = {
    // webAudio上下文
    context: webAudio.ac,
    // 目标输出
    destination: webAudio.ac.destination,
    // stream输出
    streamDestination: webAudio.ac.createMediaStreamDestination(),
    // 缓存buffer列表, 共享
    bufferList: {},
    // xhr请求
    xhr: new XMLHttpRequest(),
    // 注册监听回调事件
    on(name, fn) {
        this.listeners[name] = fn
    },
    // 执行回调
    emit(name, data) {
        this.listeners[name] && this.listeners[name](data)
    },
    // 初始化
    init() {
        if (!this._validateInput()) return Promise.reject('输入mediastream不合法')

        if (this.isAnalyze) {
            this._initMonitor()
        }

        this._initWebAudio()
        this._initAudioIn()

        // 初始化节点
        return this._initAudioNode()
    },
    /*****************************************输入节点相关 start******************************************** */
    // 先验证输入流数据是否合法
    _validateInput() {
        var stream = this.stream
        if (!stream) return true
        // 注：Firefox通过API获取的原生流构造函数是：LocalMediaStream
        return /(Array|MediaStream|LocalMediaStream)/.test(stream.constructor)
    },
    // 第一步：初始化音量分析监控的脚本节点
    _initMonitor() {
        var that = this

        var scriptNode = this.script = this.context.createScriptProcessor(0, 1, 1)
        console.log(scriptNode.bufferSize)

        scriptNode.onaudioprocess = function (event) {
            var input = event.inputBuffer.getChannelData(0)
            var i
            var sum = 0.0
            var clipcount = 0
            for (i = 0; i < input.length; ++i) {
                sum += Math.abs(input[i])
                if (Math.abs(input[i]) > 0.99) {
                    clipcount += 1
                }
            }
            that.instant = Math.sqrt(sum / input.length)
            that.slow = 0.95 * that.slow + 0.05 * that.instant
            that.clip = clipcount / input.length
        }
    },
    // 第二步：初始化webaudio的连接工作
    _initWebAudio() {
        var context = this.context

        // 增益
        var gainNode = this.nodeList.gainNode = context.createGain()

        // 滤波器，可以通过该处理器对音乐进行降噪、去人声等处理 chrome55以上
        var biquadNode = this.nodeList.biquadNode = context.createBiquadFilter();
        // Manipulate the Biquad filter
        biquadNode.type = "lowshelf";
        biquadNode.frequency.value = 400;
        biquadNode.gain.value = 25;

        // 动态压缩器节点
        var compressor = this.nodeList.compressor = context.createDynamicsCompressor();
        compressor.threshold.value = -50;
        compressor.knee.value = 40;
        compressor.ratio.value = 12;
        compressor.attack.value = 0;
        compressor.release.value = 0.25;

        // 混响
        var convolver = this.nodeList.convolver = context.createConvolver();

        // 目的地
        // this.destination = webAudio.destination

        /**************************开始连接************************** */
        gainNode.gain.value = this.gain

        // 开始连接
        gainNode.connect(this.destination)

        // 是否加效果
        // if (this.effect) {
        //     this.audioEffect(this.effect)
        // }

        // biquadFilter.connect(compressor)

        // compressor.connect(destination)

        // convolver.connect(destination)
    },
    // 第三步：初始化音频输入, 不再使用
    _initAudioIn() {
        var that = this
        var stream = this.stream
        var context = this.context
        var tmp

        if (!stream) return

        // 单路输入
        if (/(MediaStream|LocalMediaStream)/.test(stream.constructor)) {
            addMs(stream)
            this.outputStream = this.streamDestination.stream
            return
        }

        // 多路输入
        if (stream.constructor === Array) {
            stream.forEach(item => {
                if (!item || !/(MediaStream|LocalMediaStream)/.test(item)) return

                tmp = addMs(item)
                if (tmp) {
                    this.audioIn[item.id] = tmp
                }
            })
            this.outputStream = this.destination.stream
        }

        function addMs(ms) {
            if (!/(MediaStream|LocalMediaStream)/.test(ms.constructor)) return null
            if (ms.getAudioTracks().length === 0) return null
            var audioIn = context.createMediaStreamSource(ms)

            // 大坑问题！ script目前的代码是没有输出的，只作分析使用，所以source还要再连接一下下一个输出!
            if (that.isAnalyze && that.script) {
                audioIn.connect(that.script)
                that.script.connect(that.nodeList.gainNode)
            }

            audioIn.connect(that.nodeList.gainNode)
            return audioIn
        }
    },
    // 初始化音频播放节点，一个实例只能有一个
    _initAudioNode() {
        this.audio = document.createElement('audio')
        this.audio.crossOrigin = 'anonymous';

        if (!this.audio.captureStream) return Promise.reject('captureStream undefined')
        // if (this.needMediaStream) this.outputStream = this.audio.captureStream()

        this.source.es = this.context.createMediaElementSource(this.audio);
        this.source.es.connect(this.nodeList.gainNode);
        this.source.es.onended = this._onended.bind(this)
        this.audio.onended = this._onended.bind(this)


        if (!this.outputStream) return Promise.resolve(this)

        // 兼容
        if (this.audio.srcObject === undefined) {
            var url = URL.createObjectURL(this.outputStream)
            this.audio.src = url
        } else {
            this.audio.srcObject = this.outputStream
        }

        return Promise.resolve(this)
    },
    // 输入流更新
    _updateInput(type) {
        let that = this
        let stream = this[`${type}In`].stream
        let context = this.context
        let tmp, nodes = this[`${type}In`].node

        if (!stream) return
        // 先销毁原始输入
        for (let i in nodes) {
            nodes[i].disconnect(0)
        }

        nodes = this[`${type}In`].node = {}

        // 单路输入
        if (/(MediaStream|LocalMediaStream)/.test(stream.constructor)) {
            tmp = addMs(stream)
            if (tmp) {
                nodes[stream.id] = tmp
            }
            this._updateOutStream()
            // this.outputStream = this.streamDestination.stream
            return
        }

        // 多路输入
        if (stream.constructor === Array) {
            stream.forEach(item => {
                if (!item || !/(MediaStream|LocalMediaStream)/.test(item)) return

                tmp = addMs(item)
                if (tmp) {
                    nodes[item.id] = tmp
                }
            })
            this._updateOutStream()
            // this.outputStream = this.destination.stream
        }

        function addMs(ms) {
            if (!/(MediaStream|LocalMediaStream)/.test(ms.constructor)) return null
            if (ms.getAudioTracks().length === 0) return null
            var audioIn = context.createMediaStreamSource(ms)

            // 大坑问题！ script目前的代码是没有输出的，只作分析使用，所以source还要再连接一下下一个输出!
            // if (that.isAnalyze && that.script) {
            //     audioIn.connect(that.script)
            //     that.script.connect(that.nodeList.gainNode)
            // }

            if (type === 'music' && that.nodeList.analyser) {
                audioIn.connect(that.nodeList.analyser)
            } else {
                audioIn.connect(that.nodeList.gainNode)
            }

            return audioIn
        }

    },
    /**
     * 更新流 全部替换更新, 可以有多个输入
     * @param {object} option 
     * @param {string} option.type 类型, music / vioce, 默认是music
     * @param {mediastream} option.stream 
     */
    updateStream(option) {
        let { type, stream } = option

        this[`${type}In`].stream = stream

        this._updateInput(type)
    },
    /*****************************************输入节点相关 end******************************************** */

    /*****************************************加载、解码相关 start******************************************** */
    /**
     * 加载音源列表
     * 
     * @param {Array} urls 音源列表
     * @returns Promise
     */
    loadMusicList(option) {
        option = option || {}
        var urls = option.urls
        var isAll = option.isAll || false

        if (!urls || urls.constructor !== Array || urls.length === 0) return Promise.reject('no music list to load')

        // 一次性拉取所有
        if (isAll) {
            return this._loadBufferList(urls, true).then((obj) => {
                // console.log('music obj',obj)
                console.log('music loaded', obj)
                return Promise.resolve(obj)
            });
        }

        // 对列表一首一首缓存
        this.urlList = urls
        this.nameList = [];
        this._loadMusic()

    },
    // 对列表一首一首缓存
    _loadMusic() {
        var that = this
        if (this.urlList.length === 0) return
        var index = Math.floor(Math.random() * this.urlList.length)
        var url = this.urlList.splice(index, 1)[0]
        this._loadBuffer(url, true).then((list) => {
            that.nameList = that.nameList.concat(list)
            that.emit('playlist', that.nameList)
            that._loadMusic()
        })
    },
    // 拉取buffer列表
    _loadBufferList(list, isAll) {
        var p = [];
        list.forEach((url) => {
            p.push(this._loadBuffer(url))
        })
        if (isAll) {
            return Promise.all(p)
        }
        return Promise.race(p)
    },
    // 拉取arraybuffer数据
    /**
     * 
     * 
     * @param {any} url 异步请求链接
     * @param {boolean} isAbort 是否回滚上一个请求, 默认支持多个
     * @returns 
     */
    _loadBuffer(url, isAbort) {
        var that = this;
        if (!url) return Promise.reject('no buffer url')
        isAbort = isAbort || false
        var xhr

        var name = url.match(/.(\w+)\.(wav|mp3|m4r|m4a)$/)
        name = name.length >= 2 ? name[1] : name[0]

        return new Promise((resolve, reject) => {

            if (isAbort) {
                xhr = this.xhr
                // 回滚
                xhr.abort();
            } else {
                xhr = new XMLHttpRequest();
            }

            xhr.open("GET", url, true);
            xhr.responseType = "arraybuffer";
            xhr.onload = function () {

                // 需要输出流, 不进行解码
                if (that.needMediaStream) {
                    that.bufferList[name] = xhr.response;
                    return resolve(name)
                }
                // console.log(xhr.response);

                that._decode(xhr.response).then((buffer) => {
                    that.bufferList[name] = buffer;
                    resolve(name)
                });
            }
            xhr.onerror = function (e) {
                console.error('BufferLoader: XHR error', e);
                resolve()
            }

            xhr.send();
        })
    },
    // 将ArrayBuffer解码为AudioBuffer
    _decode(arraybuffer) {
        var that = this;
        //兼容arraybuffer的方式，如果有，先停掉
        return new Promise((resolve, reject) => {
            this.context.decodeAudioData(arraybuffer, function (buffer) {
                if (!buffer) {
                    console.error('error decoding file data: ' + url);
                    resolve()
                    return;
                }
                // this.bufferList[name] = buffer;
                resolve(buffer)
            }, function (err) {
                console.log('err:' + err);
                reject('文件类型不合法, 请选择音乐格式的文件')
            });
        })
    },
    /*****************************************加载、解码相关 end******************************************** */

    /*****************************************效果器应用相关 start******************************************** */
    /**
     * 应用处理器
     * @param {object} option 
     * @param {any} option.type 目前支持的效果器：请参见 #webAudio.effect
     * @param {any} option.data 如果使用混响, 附加混响效果名字(前提要先加载了对应混响效果器文件)
     * 目前只支持混响
     */
    audioEffect(option) {
        let { type, name } = option
        if (type === 'Convolver' && name) {

            if (!this.nodeList.convolver) {
                this.nodeList.convolver = this.context.createConvolver();
            }

            this.convolver.buffer = this.bufferList[name]

            this.nodeList.gainNode.disconnect()
            this.nodeList.convolver.disconnect()

            this.nodeList.gainNode.connect(this.convolver)
            this.nodeList.convolver.connect(this.destination)
        }
    },
    /*****************************************效果器应用相关 end******************************************** */

    /*****************************************播放操作 start******************************************** */
    /**
     * 播放函数，主入口
     * 
     * @param {object} option 配置参数对象
     * @param {File} option.file   播放本地音源: arraybufer
     * @param {string} option.name 播放缓存音源: arraybufer
     * @param {string} option.url  播放远程音源: audio元素设置url
     * @returns 
     */
    play(option) {
        console.log('play', option)
        var that = this

        // stream的播放, 无需任何参数
        if (!option || option.constructor !== Object) {
            this.audio && this.audio.play()
            return Promise.resolve()
        }

        var file = option.file, name = option.name, url = option.url
        var needMediaStream = this.needMediaStream

        //兼容arraybuffer的方式，如果有，先停掉
        this.stop(true);

        // 针对非stream的播放
        return new Promise((resolve, reject) => {

            // P2: 如果是播放本地文件
            if (file && file.constructor === File) {
                that.source.newUrl = file.name

                // 需要输出mediastream, 直接标签化处理
                if (needMediaStream) {
                    that.source.curr = file.name
                    that.audio.src = that.blobUrl = URL.createObjectURL(file);
                    that._canPlay()
                    that._updateOutStream()
                    resolve(that.source.curr)
                    return
                }

                // 正常处理
                var reader = new FileReader();
                reader.onload = function (e) {

                    that._decode(e.target.result).then((buffer) => {
                        return that._playBuffer(buffer)
                    }).then(() => {
                        resolve(that.source.curr)
                    }).catch(err => {
                        reject(err)
                    })
                }
                reader.readAsArrayBuffer(file);
                return
            }

            // P1: 如果是播放缓存
            if (name && that.bufferList[name]) {
                that.source.newUrl = name

                // 需要输出mediastream, 直接标签化处理
                if (needMediaStream) {
                    that.blob = new window.Blob([that.bufferList[name]]);
                    that.audio.src = that.blobUrl = URL.createObjectURL(that.blob);
                    that._canPlay()
                    that._updateOutStream()
                    resolve(that.source.curr)
                    return
                }

                return that._playBuffer(that.bufferList[name]).then(() => {
                    resolve(that.source.curr)
                })
            }

            // P0: 播放远程音源
            if (that.source.curr && that.source.curr == url) {
                reject('same song');
            }

            that.source.newUrl = url;
            //pc上通过audio标签创建MediaaudioElementSourceNode，比ajax请求再解码要快
            if (!this.isMobile) {

                if (!that.audio) {
                    that.audio = new Audio(url);
                    that.audio.crossOrigin = 'anonymous';
                    // that.audio.loop = true;
                    that.source.es = that.context.createMediaElementSource(that.audio);
                    that.source.es.connect(that.nodeList.gainNode);
                    // that.audio.onended = this.onended.bind(this);
                    that.source.es.onended = this._onended.bind(this)
                } else {
                    that.audio.src = url;
                }

                that._canPlay()

                // 更新stream
                // that.outputStream = webAudio.destination.stream

                that.source.curr = url;

                resolve(url)
            } else {

                that._loadBuffer(url, true).then((name) => {

                    // 需要输出mediastream, 直接标签化处理
                    if (needMediaStream) {
                        that.blob = new window.Blob([that.bufferList[name]]);
                        that.audio.src = that.blobUrl = URL.createObjectURL(that.blob);
                        that._canPlay()
                        that._updateOutStream()
                        return Promise.resolve()
                    }

                    return that._playBuffer(that.bufferList[name])
                }).then(() => {
                    resolve(that.source.curr)
                }).catch(err => {
                    reject(err)
                })
            }

        })
    },
    // 单纯播放audiobuffer, 不用audio元素
    _playBuffer(buffer) {
        console.log('play buffer')
        this.source.curr = this.source.newUrl;
        var bs = this.context.createBufferSource();
        bs.onended = this._onended.bind(this)
        bs.buffer = buffer;

        if (/(resumed|played)/.test(this.playStatus)) {
            bs.connect(this.nodeList.gainNode);
        }

        //兼容较老的API
        bs[bs.start ? "start" : "noteOn"](0);

        this.source.bs = bs;
        // 更新stream
        // this.outputStream = webAudio.destination.stream

        return Promise.resolve(this.source.newUrl)
    },
    // 核心API: 获取流数据
    _updateOutStream() {
        let that = this

        if (this.needMediaStream) {
            this.outputStream = this.audio.captureStream()
        } else {

        }

        whenEmit()

        function whenEmit() {
            console.log('wait emit outputStream')
            setTimeout(function () {
                let stream = that.outputStream
                if (!stream) return
                if (stream.active) {
                    that.emit('outputStream', stream)
                    return
                }
                whenEmit()
            }.bind(this), 300)
        }

    },
    // 是否需要播放
    _canPlay() {
        if (/(resumed|played)/.test(this.playStatus)) {
            //兼容较老的API
            this.audio.play();
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
            this.source.bs.connect(this.nodeList.gainNode);
        }
    },
    //停止
    stop(isPlayed) {
        if (!isPlayed) {
            this.playStatus = 'stoped'
        }

        if (this.blobUrl) {
            window.URL.revokeObjectURL(this.blobUrl);
            this.blob = null
        }

        if (this.audio) {
            this.audio.pause();
            // this.audio.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAVFYAAFRWAAABAAgAZGF0YQAAAAA=';
            this.audio.src = null
        }

        if (this.source.bs) {
            var fn = this.source.bs[this.source.bs.stop ? "stop" : "nodeOff"];
            fn && this.source.bs[this.source.bs.stop ? "stop" : "nodeOff"]();
        }
    },
    // 播放完毕回调
    _onended() {
        // if (this.source.curr === this.source.newUrl) {
        //     this.emit('end')
        // }
        this.emit('end')
    },
    // 音量控制
    setGain(percent) {
        this.gain = percent * percent;
        this.nodeList.gainNode.gain.value = this.gain
    },
    // 获取当前设置的音量
    getGain() {
        return this.gain
    },
    // 实时获取当前音量
    getVolume() {
        this.emit('volume', this.instant.toFixed(2))
    },
    // 静音
    soundOff() {
        return this.setGain(0)
    },
    // 放开静音
    soundOn() {
        this.setGain(this.gain)
    },
    /*****************************************播放操作 start******************************************** */

    /*****************************************canvas相关 start******************************************** */
    /**
     * 初始化绘图环境
     * 
     */
    initVisualizer(node) {
        var canvas = this.canvas
        // 获取外联css文件的样式
        var position = window.getComputedStyle(node, null).position
        if (!position) {
            node.style.position = 'relative'
        }

        canvas = this.canvas = document.createElement('canvas')
        canvas.width = node.offsetWidth
        canvas.height = node.offsetHeight
        canvas.style.position = 'absolute'
        canvas.style.top = '0'
        canvas.style.left = '0'
        canvas.style['z-index'] = '-1'

        node.appendChild(canvas)
        this.canvasCtx = canvas.getContext('2d');

        // 初始化频率捕捉
        this.size = 8;
        this.nodeList.analyser = this.context.createAnalyser();
        this.nodeList.analyser.fftSize = this.size * 8 * 8;
        this.nodeList.analyser.fftSize = this.size * 8 * 8;
        this.nodeList.analyser.connect(this.destination);
        this.nodeList.gainNode.disconnect()
        this.nodeList.gainNode.connect(this.nodeList.analyser);

        return canvas
    },
    /**
     * canvas绘制
     * 
     * @param {object} node dom节点 
     */
    startVisualizer(node) {
        if (!node) return Promise.reject('no dom')
        var canvas = this.canvas
        var that = this
        if (!canvas) canvas = this.initVisualizer(node)

        var ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        var analyser = this.nodeList.analyser
        var arr = new Uint8Array(analyser.frequencyBinCount);

        function v() {
            analyser.getByteFrequencyData(arr);
            //console.log(arr);
            that.drawCanvasDot(arr); //画圆圈
            // that.drawCanvasRect(arr); //画柱状条
            window.requestAnimFrame(v); //使动画更流畅
        }
        window.requestAnimFrame(v);

    },
    //画圆圈
    drawCanvasDot(arr) {
        var ca = this.canvas;
        this.canvasCtx.clearRect(0, 0, ca.width, ca.height);
        if (!this.source.dot) {
            this.source.dot = [];
            var tp = this.source.dot;
            for (var i = 0; i < this.size; i++) {
                tp[i] = {};
                tp[i].x = this.getRandom(0, ca.width);
                tp[i].y = this.getRandom(0, ca.height);
                tp[i].color = "rgba(" + this.getRandom(0, 255) + "," + this.getRandom(0, 255) + "," + this.getRandom(0, 255) + ",0)";
                tp[i].dr = ca.height / 50;
                tp[i].vx = this.getRandom(0.5, 1.5, true);
            }
        }
        var tp = this.source.dot;
        for (var i = 0; i < this.size; i++) {
            tp[i].r = tp[i].dr + arr[4 * i] / 256 * (ca.height > ca.width ? ca.width : ca.height) / 10;
            tp[i].x = (tp[i].x > ca.width + tp[i].r ? -tp[i].r : tp[i].x + tp[i].vx);
            this.canvasCtx.beginPath();
            this.canvasCtx.globalAlpha = 0.3;
            this.canvasCtx.arc(tp[i].x, tp[i].y, tp[i].r, 0, 2 * Math.PI);
            var rrd = this.canvasCtx.createRadialGradient(tp[i].x, tp[i].y, 0, tp[i].x, tp[i].y, tp[i].r);
            rrd.addColorStop(0, "#fff");
            rrd.addColorStop(1, tp[i].color);
            this.canvasCtx.fillStyle = rrd;
            this.canvasCtx.fill();
        }
    },
    // 随机数
    getRandom(m, n, isFloat) {
        return (isFloat ? Math.random() * (n - m) + m : Math.floor(Math.random() * (n - m)) + m);
    },
    // 实例销毁
    destroy() {
        this.instant = 0.0
        this.slow = 0.0
        this.clip = 0.0

        // 断开节点
        for (let i in this.nodeList) {
            this.nodeList[i].disconnect()
            this.nodeList[i] = null
        }

        // 断开输入
        if (this.audioIn) {
            for (var i in this.audioIn) {
                this.audioIn[i] && this.audioIn[i].disconnect(0)
            }
        }
        this.audioIn = {}

        // this.context && this.context.close()
        var ms = this.stream
        // var outms = this.outputStream

        if (/(MediaStream|LocalMediaStream)/.test(ms.constructor)) {
            dropMS(ms)
        }

        if (ms.constructor === Array) {
            ms.forEach(item => {
                item && /(MediaStream|LocalMediaStream)/.test(item) && dropMS(item)
            })
        }

        function dropMS(mms) {
            if (!mms) return
            var tracks = mms.getTracks()
            if (!tracks || tracks.length === 0) return
            // 这里不要移除轨道!!!
            // mms.getTracks().forEach(function (track) {
            //   track.stop()
            //   mms.removeTrack(track)
            // })
        }

        this.stream = null
        // this.outputStream = null
    }
}

window.requestAnimFrame = (function () {
    return window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.oRequestAnimationFrame || window.msRequestAnimationFrame ||
        function ( /* function FrameRequestCallback */ callback, /* DOMElement Element */ element) {
            return window.setTimeout(callback, 1000 / 60);
        };
})();