/**
 * 文件并发传输的demo脚本
 * created by lduoduo
 * 目前遗留问题：chrome与firefox互通，chrome不支持blob格式，firefox支持blob
 */

// 引入样式文件
import './file.less';

let serverIp = MY.environment === 'dev' ? `${window.location.hostname}:${MY.wsPort}` : window.location.hostname

window.home = {
    // 显示远程的列表
    remoteVideo: {},
    // 远端buffer数据
    localData: {
        //name: 'data'
    },
    remoteData: {
        //name: 'data'
    },

    init() {
        this.initEvent();
    },
    initEvent() {
        let that = this
        $('body').on('click', '.J-start', this.startRTC.bind(this))
        $('body').on('click', '.J-rtc-file', function () {
            $('#fileInput').click()
        })
        $('body').on('change', '#fileInput', this.selectedFile.bind(this))
        window.addEventListener('beforeunload', this.destroy.bind(this));
    },
    destroy() {
        if (!this.rtc) return
        this.rtc.stop()
    },
    // 选择文件, 多文件
    selectedFile() {
        let fileInput = document.querySelector('input#fileInput')
        let files = fileInput.files

        for (let i in files) {
            let tmp = files[i]
            tmp.constructor === File && this.rtc && this.rtc.sendFile(tmp)
        }

    },
    /** 
     * 开启rtc连接
     * 支持的事件注册列表
     * mediastream
     * stop
     */
    startRTC() {
        if (this.rtc && this.rtc.inited) return

        let cname = $('.J-channelName').val()

        if (!cname) {
            Mt.alert({
                title: '请先输入房间号',
                confirmBtnMsg: '好'
            });
            return
        }

        let stream = this.localStream

        let url = `wss://${serverIp}/rtcWs`;

        let rtc = this.rtc = new rtcSDK();
        rtc.init({ url, roomId: cname, stream }).then(obj => {
            console.log('支持的注册事件:', obj)
        }).catch(err => {
            Mt.alert({
                title: err,
                confirmBtnMsg: '好哒'
            })
        })

        rtc.on('stream', this.startRemoteStream.bind(this))
        rtc.on('stop', this.stopRTC.bind(this))
        rtc.on('ready', this.rtcStatus.bind(this))
        rtc.on('sendFile', this.sendFileStatus.bind(this))
        rtc.on('receiveFile', this.receiveFileStatus.bind(this))
    },
    rtcStatus(obj) {
        console.log(obj)
        let {status, error, url} = obj

        Mt.alert({
            title: status ? 'webrtc连接成功' : error,
            msg: url || '',
            confirmBtnMsg: '好哒',
            timer: 1000
        });
    },
    // 发送文件状态回传
    sendFileStatus(data) {
        this.localData[data.name] = this.localData[data.name] || {}
        this.localData[data.name].data = data
        this.showLocalFileAnimation()
        // console.log(data)
    },
    // 接收文件状态回传
    receiveFileStatus(data) {
        this.remoteData[data.name] = this.remoteData[data.name] || {}
        this.remoteData[data.name].data = data
        this.showRemoteFileAnimation()
        // console.log(data)
    },
    showLocalFileAnimation() {

        for (let i in this.localData) {
            let tmp = this.localData[i]
            let {name, size, currentSize} = tmp.data
            if (tmp.node) {
                let html = `<p>${name}</p><p class="desc">总:${size}b / 当前:${currentSize}b</p>
                            <div class="tip" style="width:${100 * currentSize / size}%"></div>`
                $(tmp.node).html(html)
                continue
            }

            tmp.node = document.createElement('a')
            tmp.node.className = 'item'
            let html = `<p>${name}</p><p class="desc">总:${size}b / 当前:${currentSize}b</p>
                        <div class="tip" style="width:${100 * currentSize / size}%"></div>`
            $(tmp.node).html(html)
            $('.list-box')[0].appendChild(tmp.node)
        }
    },
    showRemoteFileAnimation() {
        for (let i in this.remoteData) {
            let tmp = this.remoteData[i]
            // 是否已经渲染完成
            if(tmp.completed) continue

            // console.log(`isDone:${tmp.data.isDone}`)
            let {name, size, currentSize} = tmp.data
            if (tmp.node) {
                let html = `<p>${name}</p><p class="desc">总:${size}b / 当前:${currentSize}b</p>
                            <div class="tip" style="width:${100 * currentSize / size}%"></div>`
                $(tmp.node).html(html)

                // 是否接收完毕
                if (tmp.data.isDone) {
                    
                    console.log(`done --> ${name}`)

                    tmp.completed = true

                    tmp.blob = new window.Blob(tmp.data.buffer);
                    tmp.node.href = URL.createObjectURL(tmp.blob);

                    tmp.node.download = name;
                    
                }
                continue
            }
            tmp.node = document.createElement('a')
            tmp.node.className = 'item item-in'
            let html = `<p>${name}</p><p class="desc">总:${size}b / 当前:${currentSize}b</p>
                        <div class="tip" style="width:${100 * currentSize / size}%"></div>`
            $(tmp.node).html(html)
            $('.list-box')[0].appendChild(tmp.node)

        }
    },
    // 接收到远程流，进行外显
    startRemoteStream(stream) {
        console.log('remote stream:', stream);
        $remoteVideo.srcObject = stream;
        $remoteVideo.play();
    },
    // 远程连接断开
    stopRTC(uid) {
        console.log(`远程rtc连接已断开,用户: `, uid)
    }
}


home.init();



