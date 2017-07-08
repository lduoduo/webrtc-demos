/**
 * 实时文字聊天的demo脚本
 * created by lduoduo
 */

// 引入样式文件
import './message.scss';

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
    isTipEnable: $('.J-tip-check').hasClass('active'),
    init() {
        this.initEvent();
    },
    initEvent() {
        let that = this
        $('body').on('click', '.J-start', this.startRTC.bind(this))
        $('body').on('click', '.J-send', this.sendMessage.bind(this))
        $('body').on('click', '.J-tip-check', this.switchTipStatus.bind(this))

        window.addEventListener('beforeunload', this.destroy.bind(this));
    },
    destroy() {
        if (!this.rtc) return
        this.rtc.stop()
    },
    // 是否要发送通知的提示状态切换
    switchTipStatus() {
        $('.J-tip-check').toggleClass('active')
        this.isTipEnable = $('.J-tip-check').hasClass('active');
    },
    // 发送文字聊天内容
    sendMessage() {
        let message = $.trim($('.J-rtc-message').val())
        // this.rtc.sendMessage(message)
        message && this.rtc && this.rtc.sendMessage(message).then(() => {
            let html = `<a class="item item">
                            <p>${message}</p>
                        </a>`
            $('.list-box').append(html)
        }).catch(err => {
            Mt.alert({
                title: '消息发送失败',
                msg: err,
                confirmBtnMsg: '好哒'
            });
        })
    },
    // 接收文字聊天内容
    receiveMessage(data) {
        if (!data) return
        let html = `<a class="item item-in">
                        <p>${data}</p>
                    </a>`
        $('.list-box').append(html)
        if (this.isTipEnable) {
            minAlert.alert({
                position: 'bl',
                msg: data, //消息主体
                timer: 2000
            });
            notify.alert(data)
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

        // let host = 'ldodo.cc'
        // let host = window.location.hostname + ':8099'

        let url = `wss://${serverIp}/rtcWs/?roomId=${cname}`;

        let rtc = this.rtc = new rtcSDK();
        rtc.init({ url, stream }).then(obj => {
            console.log('支持的注册事件:', obj)
        }).catch(err => {
            Mt.alert({
                title: 'webrtc连接失败',
                msg: JSON.stringify(err),
                confirmBtnMsg: '好哒'
            });
        })

        rtc.on('stream', this.startRemoteStream.bind(this))
        rtc.on('stop', this.stopRTC.bind(this))
        rtc.on('ready', this.rtcStatus.bind(this))
        rtc.on('message', this.receiveMessage.bind(this))
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



