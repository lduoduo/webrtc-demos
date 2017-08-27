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
 *      // 注: needMediaStream 标志位意味着只会只有stream输出，不会外放音源!不会听到声音
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
 *  -   
 */


/**
* webaudio 构造器
* 单个输入的音频流可以更新替换为新的，但是多路输入目前无法进行更新
* @param {Boolean} [option.isAnalyze=false] 是否需要监控分析，默认不分析
* @param {string} [option.effect] 效果器
* @param {num} [option.type] 音源类型(伴奏|人声：人声会做处理): 值请参考 #WebAudio.type
* @param {num} [option.outputType] 输出类型, 默认都输出: 值请参考 #WebAudio.outputType
* @param {boolean} [option.needMediaStream=false]  对于arraybuffer, 是否需要输出mediastream, 默认不输出
* 注: 需要输出mediastream的缓存默认不解码，使用原始arraybuffer
* @param {array} [option.effect] 音频处理器,按照顺序处理: 值请参考 #WebAudio.effect
*/

window.WebAudio = function (option = {}) {
    this.support = support.supportWebAudio && support.supportMediaStream

    // 回调监听
    this.listeners = {}
    // 处理器节点
    this.nodeList = {}
    // 是否需要输出stream
    this.needMediaStream = option.needMediaStream || false
    this.outputType = option.outputType || WebAudio.outputType['all']
    // 初始音量
    this.gain = this.needMediaStream ? 0 : 1
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
    this.inVoice = {
        stream: null,
        source: {},
        nodeList: {}
    }

    // 伴音输入
    this.inMusic = {
        // stream: null,
        source: {},
        url: {},
        nodeList: {}
    }

    this.instant = 0.0
    this.slow = 0.0
    this.clip = 0.0

    return this.init()

}

// N个实例对应一个环境
WebAudio.ac = new support.AudioContext()

// 音源类型：人声 、 伴奏
WebAudio.type = {
    'voice': 1,
    'music': 2
}

// 输出类型：扬声器输出、mediastream输出、二者一起输出、都不输出, 默认输出扬声器
WebAudio.outputType = {
    'none': 0,
    'speaker': 1,
    'stream': 2,
    'all': 3,
}

// 支持的处理器
WebAudio.effect = [
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

WebAudio.prototype = {
    // webAudio上下文
    context: WebAudio.ac,
    // 目标输出
    destination: WebAudio.ac.destination,
    // stream输出, 如果所有节点连接该节点, 只会得到outputStream, 音源不会真正发出声音
    streamDestination: WebAudio.ac.createMediaStreamDestination(),
    // 缓存buffer列表, 共享
    bufferList: {},
    // 缓存曲目列表
    nameList: [],
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

        // 初始化伴音gainNode
        var musicGainNode = this.inMusic.nodeList.gainNode = context.createGain()
        // 初始化人声gainNode
        var voiceGainNode = this.inVoice.nodeList.gainNode = context.createGain()

        // 总增益
        var gainNode = this.nodeList.gainNode = context.createGain()
        this.inMusic.gain = musicGainNode.gain.value = voiceGainNode.gain.value = gainNode.gain.value = this.gain


        // 混响
        var convolver = this.nodeList.convolver = context.createConvolver();

        /**************************开始连接************************** */
        musicGainNode.connect(gainNode)
        voiceGainNode.connect(gainNode)
        // 开始连接
        var regSpeaker = new RegExp('[' + WebAudio.outputType['speaker'] + WebAudio.outputType['all'] + ']')
        var regMedia = new RegExp('[' + WebAudio.outputType['media'] + WebAudio.outputType['all'] + ']')
        regSpeaker.test(this.outputType) && gainNode.connect(this.destination)
        regMedia.test(this.outputType) && gainNode.connect(this.streamDestination)

        // 初始化voice连接
        this._initVoiceNode()
    },
    // 初始化音乐相关
    _initMusicNode() {

    },
    // 初始化voice相关，比如降噪等
    _initVoiceNode() {
        var nodes = this.inVoice.nodeList

        // 滤波器，可以通过该处理器对音乐进行降噪、去人声等处理 chrome55以上
        var highPassNode = nodes.highPassNode = this.context.createBiquadFilter();
        highPassNode.type = "highpass";
        highPassNode.frequency.value = 30;
        highPassNode.gain.value = -10;

        highPassNode.connect(nodes.gainNode)

        // 动态压缩器节点
        // var compressor = this.nodeList.compressor = context.createDynamicsCompressor();
        // compressor.threshold.value = -50;
        // compressor.knee.value = 40;
        // compressor.ratio.value = 12;
        // compressor.attack.value = 0;
        // compressor.release.value = 0.25;
    },
    /**
     * 第三步：初始化音频播放节点，一个实例只能有一个，该节点针对通过audio赋值url播放音源
     * 注意: 该节点和bufferSourceNode目前不能共存
     * @returns 
     */
    _initAudioNode() {
        this.audio = document.createElement('audio')
        this.audio.crossOrigin = 'anonymous';

        let source = this.inMusic.source
        if (source.bs) {
            source.bs.disconnect()
            source.bs = null
        }

        source.bs = this.context.createMediaElementSource(this.audio);
        source.bs.connect(this.inMusic.nodeList.gainNode);
        source.bs.onended = this._onended.bind(this)
        this.audio.onended = this._onended.bind(this)

        // if (!this.outputStream) return Promise.resolve(this)

        // 兼容
        // if (this.audio.srcObject === undefined) {
        //     var url = URL.createObjectURL(this.outputStream)
        //     this.audio.src = url
        // } else {
        //     this.audio.srcObject = this.outputStream
        // }

        return Promise.resolve(this)
    },
    // 输入流更新
    _updateInput(type) {
        let that = this

        let stream = this[`in${type}`].stream
        let context = this.context
        let tmp, nodes = this[`in${type}`].source

        if (!stream) return

        // 先销毁原始输入
        for (let i in nodes) {
            nodes[i].disconnect(0)
            nodes[i] = null
            delete nodes[i]
        }

        nodes = this[`in${type}`].source = {}

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

            if (/music/i.test(type)) {
                audioIn.connect(that[`inMusic`].nodeList.gainNode)
            } else {
                audioIn.connect(that['inVoice'].nodeList.highPassNode)
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

        if (type && !/^(music|voice)$/i.test(type)) return

        type = type || 'Music'
        type = type[0].toUpperCase() + type.slice(1).toLocaleLowerCase()

        this[`in${type}`].stream = stream

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
     * 应用处理器, 只处理voice
     * @param {object} option 
     * @param {any} option.type 目前支持的效果器：请参见 #WebAudio.effect
     * @param {any} option.name 如果使用混响, 附加混响效果名字(前提要先加载了对应混响效果器文件)
     * 目前只支持混响
     */
    audioEffect(option) {
        let { type, name } = option
        let nodes = this.inVoice
        if (type === 'Convolver' && name) {

            let convolver = nodes.convolver
            if (!convolver) {
                convolver = nodes.convolver = this.context.createConvolver();
            }

            convolver.buffer = this.bufferList[name]

            nodes.gainNode.disconnect()
            convolver.disconnect()

            nodes.gainNode.connect(convolver)

            if (this.nodeList.analyser) {
                nodes.convolver.connect(this.nodeList.analyser)
            } else {
                nodes.convolver.connect(this.destination)
                nodes.convolver.connect(this.streamDestination)
            }

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
                that.inMusic.url.newUrl = file.name

                // 需要输出mediastream, 直接标签化处理
                if (needMediaStream) {
                    that.inMusic.url.curr = file.name
                    that.audio.src = that.blobUrl = URL.createObjectURL(file);
                    that._canPlay()
                    that._updateOutStream()
                    resolve(that.inMusic.url.curr)
                    return
                }

                // 正常处理
                var reader = new FileReader();
                reader.onload = function (e) {

                    that._decode(e.target.result).then((buffer) => {
                        return that._playBuffer(buffer)
                    }).then(() => {
                        resolve(that.inMusic.url.curr)
                    }).catch(err => {
                        reject(err)
                    })
                }
                reader.readAsArrayBuffer(file);
                return
            }

            // P1: 如果是播放缓存
            if (name && that.bufferList[name]) {
                that.inMusic.url.newUrl = that.inMusic.url.curr = name

                // 需要输出mediastream, 直接标签化处理
                if (needMediaStream) {
                    that.blob = new window.Blob([that.bufferList[name]]);
                    that.audio.src = that.blobUrl = URL.createObjectURL(that.blob);
                    that._canPlay()
                    that._gainSmooth()
                    that._updateOutStream()
                    resolve(that.inMusic.url.curr)
                    return
                }

                return that._playBuffer(that.bufferList[name]).then(() => {
                    resolve(that.inMusic.url.curr)
                })
            }

            // P0: 播放远程音源
            if (!url) {
                reject('play song error: undefined url');
            }

            that.inMusic.url.newUrl = url;
            //pc上通过audio标签创建MediaaudioElementSourceNode，比ajax请求再解码要快
            if (!this.isMobile) {

                that.audio.src = url;

                that._canPlay()

                // 更新stream
                // that.outputStream = webAudio.destination.stream

                that.inMusic.url.curr = url;

                setTimeout(function () {
                    resolve(url)
                }, 2000)

            } else {

                that._loadBuffer(url, true).then((name) => {

                    that.inMusic.url.curr = url

                    // 需要输出mediastream, 直接标签化处理
                    if (needMediaStream) {
                        that.blob = new window.Blob([that.bufferList[name]]);
                        that.audio.src = that.blobUrl = URL.createObjectURL(that.blob);
                        that._canPlay()
                        that._updateOutStream()
                        return Promise.resolve()
                    }

                    that.nameList = that.nameList.concat([name])
                    that.emit('playlist', that.nameList)

                    return that._playBuffer(that.bufferList[name])
                }).then(() => {
                    resolve(that.inMusic.url.curr)
                }).catch(err => {
                    reject(err)
                })
            }

        })
    },
    // 单纯播放audiobuffer, 不用audio元素
    _playBuffer(buffer) {
        console.log('play buffer')
        this.inMusic.url.curr = this.inMusic.url.newUrl;

        var bs = this.context.createBufferSource();
        bs.onended = this._onended.bind(this)
        bs.buffer = buffer;

        var source = this.inMusic.source
        if (source.bs) {
            source.bs.disconnect()
            source.bs = null
        }

        source.bs = bs;
        this._canPlay()

        //兼容较老的API
        bs[bs.start ? "start" : "noteOn"](0);

        // 更新stream
        // this.outputStream = webAudio.destination.stream

        return Promise.resolve(this.inMusic.url.newUrl)
    },
    // 是否需要播放
    _canPlay() {
        if (/(resumed|played)/.test(this.playStatus)) {
            //兼容较老的API
            this.audio.play().catch(err => { console.warn(err) });
            this.inMusic.source.bs && this.inMusic.source.bs.connect(this.inMusic.nodeList.gainNode);
            this._gainSmoothIn()
        }
    },
    // 音乐淡入
    _gainSmoothIn() {
        let gainNode = this.inMusic.nodeList.gainNode
        let gain = this.inMusic.gain
        let duration = this.inMusic.source.bs.buffer.duration
        let currTime = this.context.currentTime;
        this.inMusic.source.startTime = currTime
        // Fade it in.
        // gainNode.gain.linearRampToValueAtTime(0, currTime);
        // gainNode.gain.linearRampToValueAtTime(gain, currTime + 2);
        // Then fade it out.
        // gainNode.gain.linearRampToValueAtTime(gain, currTime + duration - 2);
        // gainNode.gain.linearRampToValueAtTime(0, currTime + duration);
    },
    // 音乐淡出
    _gainSmoothOut() {
        let gainNode = this.inMusic.nodeList.gainNode
        let gain = this.inMusic.gain
        let duration = this.inMusic.source.bs.buffer.duration
        duration = duration - (this.context.currentTime - this.inMusic.source.bs.startTime)
        let currTime = this.context.currentTime
        // Then fade it out.
        // gainNode.gain.linearRampToValueAtTime(gain, currTime + duration - 2);
        // gainNode.gain.linearRampToValueAtTime(0, currTime + duration);
    },
    // 核心API: 获取流数据
    _updateOutStream() {
        let that = this

        if (this.needMediaStream) {
            this.outputStream = this.audio.captureStream()
            whenEmit()
        } else {
            if (!this.outputStream) {
                this.outputStream = this.streamDestination.stream
            }
        }

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
    //暂停
    pause(type = 'voice') {
        this.playStatus = 'paused'
        if (type === 'voice' && this.audio) {
            this.audio.pause();
        }
        if (type === 'music' && this.inMusic.source.bs && this.inMusic.source.bs.disconnect) {
            this.inMusic.source.bs.disconnect();
        }
    },
    //恢复
    resume(type = 'voice') {
        this.playStatus = 'resumed'
        if (type === 'voice' && this.audio && this.audio.src) {
            this.audio.play().catch(function (e) { console.log(e) });
        }
        if (type === 'music' && this.inMusic.source.bs && this.inMusic.source.bs.connect) {
            this.inMusic.source.bs.connect(this.inMusic.nodeList.gainNode);
            this.inMusic.source.bs.onended = this._onended.bind(this)
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

        if (this.inMusic.source) {
            var fn = this.inMusic.source.bs[this.inMusic.source.stop ? "stop" : "nodeOff"];
            fn && this.inMusic.source.bs[this.inMusic.source.stop ? "stop" : "nodeOff"]();
        }
    },
    // 播放完毕回调
    _onended() {
        if (this.inMusic.url.curr === this.inMusic.url.newUrl) {
            this.emit('end')
        }
        // this.emit('end')
    },
    // 音量控制, 对于只有stream输出的音量控制不起作用
    setGain(percent, type) {
        if (this.needMediaStream) return

        var gain = percent * percent;

        // 伴音音量
        if (type && type === 'music' && this.inMusic.nodeList.gainNode) {
            console.log('music gain', gain)
            this.inMusic.nodeList.gainNode.gain.value = this.inMusic.gain = gain
            // 淡出
            this._gainSmoothOut()
            // this.inMusic.nodeList.gainNode.gain.setValueCurveAtTime([gain, 0.5, 0.2, 0.0], this.context.currentTime + duration - 3, 3);
            return
        }

        // voice音量
        console.log('voice gain', gain)
        this.inVoice.nodeList.gainNode.gain.value = gain
    },
    // 获取当前设置的音量
    getGain(type) {
        if (type && type === 'music' && this.inMusic.nodeList.gainNode) {
            return this.inMusic.nodeList.gainNode.gain.value
        }
        return this.inVoice.nodeList.gainNode.gain.value
    },
    // 实时获取当前音量
    getVolume() {
        this.emit('volume', this.instant.toFixed(2))
    },
    // 静音
    soundOff(type) {
        if (this.needMediaStream) return

        if (type && type === 'music' && this.inMusic.nodeList.gainNode) {
            return this.setGain(0, 'music')
        }
        return this.setGain(0)
    },
    // 放开静音
    soundOn(type) {
        if (this.needMediaStream) return

        if (type && type === 'music' && this.inMusic.nodeList.gainNode) {
            let gain = this.inMusic.nodeList.gainNode.gain.value
            return this.setGain(gain, 'music')
        }

        let gain = this.inVoice.nodeList.gainNode.gain.value
        return this.setGain(gain, 'voice')
    },
    // 关闭扬声器输出
    speakerOff(){
        var gainNode = this.nodeList.gainNode
        gainNode.disconnect(this.destination)
    },
    // 开启扬声器输出
    speakerOn(){
        var gainNode = this.nodeList.gainNode
        gainNode.connect(this.destination)
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

        this.nodeList.analyser.connect(this.streamDestination);
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
            that._tyt_ff(300, 62.5);
            // that.drawCanvasDot(arr); //画圆圈
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
    // 调音台频谱分析
    _tyt_ff(size, frequency) {

        var canvas = this.canvas;
        var canvasContext = this.canvasCtx;
        var context = this.context;
        var analyser = this.nodeList.analyser

        size = size || 750
        frequency = frequency || 1000

        var width = canvas.width;
        var height = canvas.height;

        var paddingTop = 20;
        var paddingBottom = 20;
        var paddingLeft = 30;
        var paddingRight = 30;

        var innerWidth = width - paddingLeft - paddingRight;
        var innerHeight = height - paddingTop - paddingBottom;
        var innerBottom = height - paddingBottom;

        var range = analyser.maxDecibels - analyser.minDecibels;  // 70 dB

        // Frequency Resolution
        var fsDivN = context.sampleRate / analyser.fftSize;

        // This value is the number of samples during "frequency" Hz
        var nHz = Math.floor(frequency / fsDivN);

        // Get data for drawing spectrum (dB)
        var spectrums = new Float32Array(size);
        analyser.getFloatFrequencyData(spectrums);

        // Clear previous data
        canvasContext.clearRect(0, 0, canvas.width, canvas.height);

        // Draw spectrum (dB)
        canvasContext.beginPath();

        for (var i = 0, len = spectrums.length; i < len; i++) {
            var x = Math.floor((i / len) * innerWidth) + paddingLeft;
            var y = Math.floor(-1 * ((spectrums[i] - analyser.maxDecibels) / range) * innerHeight) + paddingTop;

            if (i === 0) {
                canvasContext.moveTo(x, y);
            } else {
                canvasContext.lineTo(x, y);
            }

            if ((i % nHz) === 0) {
                var text = '';

                if (frequency < 1000) {
                    text = (frequency * (i / nHz)) + ' Hz';  // index -> frequency
                } else {
                    text = (parseInt(frequency / 1000) * (i / nHz)) + ' kHz';  // index -> frequency
                }

                // Draw grid (X)
                canvasContext.fillStyle = 'rgba(255, 100, 0, 1.0)';
                canvasContext.fillRect(x, paddingTop, 1, innerHeight);

                // Draw text (X)
                canvasContext.fillStyle = 'rgba(255, 255, 255, 1.0)';
                canvasContext.font = '14px';
                canvasContext.fillText(text, (x - (canvasContext.measureText(text).width / 2)), (height - 33));
            }
        }

        canvasContext.strokeStyle = 'rgba(100, 100, 255, 1.0)';
        canvasContext.lineWidth = 4;
        canvasContext.lineCap = 'round';
        canvasContext.lineJoin = 'miter';
        canvasContext.stroke();

        // Draw grid and text (Y)
        for (var i = analyser.minDecibels; i <= analyser.maxDecibels; i += 10) {
            var gy = Math.floor(-1 * ((i - analyser.maxDecibels) / range) * innerHeight) + paddingTop;

            // Draw grid (Y)
            canvasContext.fillStyle = 'rgba(255, 100, 100, 1.0)';
            canvasContext.fillRect(paddingLeft, gy, innerWidth, 1);

            // Draw text (Y)
            canvasContext.fillStyle = 'rgba(255, 255, 255, 1.0)';
            canvasContext.font = '12px "Times New Roman"';
            canvasContext.fillText((i + ' dB'), 3, gy);
        }

    },
    // 调音台EQ调整
    _tyt_eq() {

    },
    /**
     * 初始化EQ环境
     * 
     * @param {array} list 频率数组 [62.5,124]等
     */
    initEq(list) {
        if (!list || list.constructor !== Array) return Promise.reject('initEq error: invalid parameter')
        var nodes = this.inVoice.nodeList.eqList = {}
        var context = this.context

        list.forEach((item, index) => {
            nodes[item] = context.createBiquadFilter()
            nodes[item].type = 'peaking'
            nodes[item].gain.value = 0;
            nodes[item].frequency.value = item;
            if (index === 0) {
                this.inVoice.nodeList.highPassNode.disconnect()
                this.inVoice.nodeList.highPassNode.connect(nodes[item])
                // 记录第一个
                nodes['first'] = nodes[item]
            }
            if (index > 0) {
                nodes[list[index - 1]].connect(nodes[item])
            }
            if (index === list.length - 1) {
                nodes[item].connect(this.inVoice.nodeList.gainNode)
            }
        })
        return Promise.resolve()
    },
    /**
     * EQ调整
     * 
     * @param {any} f 频率值
     * @param {any} gain 增益值
     */
    eq(f, gain) {
        if (!this.inVoice.nodeList.eqList) return Promise.reject('eq error: please initEq first')
        this.inVoice.nodeList.eqList[f].gain.value = gain
        return Promise.resolve()
    },
    /**
     * 开启EQ效果
     * 
     */
    enableEQ() {
        if (!this.inVoice.nodeList.eqList) return Promise.reject('eq error: please initEq first')
        this.inVoice.nodeList.highPassNode.disconnect()
        this.inVoice.nodeList.highPassNode.connect(this.inVoice.nodeList.eqList['first'])
    },
    /**
     * 关闭EQ效果
     * 
     */
    disableEQ() {
        if (!this.inVoice.nodeList.eqList) return Promise.reject('eq error: please initEq first')
        this.inVoice.nodeList.highPassNode.disconnect()
        this.inVoice.nodeList.highPassNode.connect(this.inVoice.nodeList.gainNode)
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
        if (this.inMusic) {
            for (var i in this.inMusic) {
                this.inMusic[i] && this.inMusic[i].disconnect(0)
            }
            this.inMusic = {}
        }

        // 断开输入
        if (this.inVoice) {
            for (var i in this.inVoice) {
                this.inVoice[i] && this.inVoice[i].disconnect(0)
            }
            this.inVoice = {}
        }

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