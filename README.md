## :rabbit: WebRTC 实验室
> WebRTC支持的功能探索 by duoduo, 该项目由原 [mykoa](//github.com/lduoduo/mykoa/tree/webRTC) 项目独立出来

> 目前所有功能都是基于最新chrome测试，后期会兼容其他浏览器

[线上demo](https://ldodo.cc/webrtc)

### 目前已实现功能
+ 实时音视频 [video online demo](//ldodo.cc/webrtc/chat)
+ 实时桌面共享 [desktop share online demo](//ldodo.cc/webrtc/desktop) `需安装谷歌插件`[请点击下载](//github.com/lduoduo/my-chrome-extensions/tree/master/desk-capture-share)
+ 文件实时并发传输 [RTCDataChannel online demo](//ldodo.cc/webrtc/rtcdata)
+ Blob / ArrayBuffer 实时传输

### 正在进行中功能
1. 白板交互
2. stats数据分析

### 项目目录结构和涉及知识点
+ koa(不多说)
+ webpack打包，由原项目 [my-wp2](//github.com/lduoduo/my-wp2/tree/webrtc) 改进过来使用
+ websockt server端搭建(不再依赖socket.io)

### 启动项目
1. git clone
2. npm i -d
3. 自己创建秘钥key，在当前目录新建keys文件夹，将秘钥key放进去
4. npm run dev 开启webpack监听编译
5. npm start 开启服务器
6. 启动后访问 `https://${ip}:8081/webrtc` 即可
    - 注: 非https模式下由于浏览器安全限制，将无法捕捉摄像头和麦克风
6. 线上打包: npm run build

### WebRTC 知识点概要, 三大 API
+ 捕捉本地摄像头麦克风: [navigator.mediaDevices.getUserMedia](//developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
    - 兼容性: navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia
+ 建立rtc传输连接: [RTCPeerConnection](//developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection)
    - 兼容性: RTCPeerConnection || webkitRTCPeerConnection || mozRTCPeerConnection
+ 建立任意数据实时传输通道(目前只支持JSON和ArrayBuffer): [RTCDataChannel](//developer.mozilla.org/en-US/docs/Web/API/RTCDataChannel)
+ 具体功能点文档请前往 [wp](//github.com/lduoduo/webrtc-demos/tree/master/wp) 目录app下的源码查看readme.me
+ 自己封装的[rtcSDK脚本](//github.com/lduoduo/webrtc-demos/blob/master/wp/src/sdk/rtcSDK.js)


### WebRTC 点对点连接建立流程详述
[文档](http://note.youdao.com/noteshare?id=76a3b3eb45960cdd9a00255597037cfd)
> 目前只支持2个client的p2p链接，即每个房间只支持2个人
 * 角色A: 第一个进入房间的人，处于等待状态，是p2p链接发起方
 * 角色B: 第二个进入房间的人，是配p2p链接接收方
 * 链接步骤：
 * 1. 角色成功加入房间(失败的时候另寻房间)
 * 2. 初始化本地媒体流
 *    - 检测是否有摄像头，是否支持
 *    - 获取本地视频流, navigator.getUserMedia
 *    - 初始化本地视频流信息, 以video标签进行渲染
 *    - 初始化本地p2p链接信息: new RTCPeerConnection(第三方STUN服务器配置信息);
 *    - 本地peer链接信息加入本地视频流进行渲染
 *    - 初始化本地peer的一系列事件
 *          - onicecandidate: 本地设置sdp时会触发, 生成保存自己的候选人信息
 *          - 通过服务器发送 candidate 给对方
 *          - onaddstream: 当有流过来时触发, 接收流并渲染
 * 3. 如果房间内人数为2，服务器通知房间里的A发起p2p连接请求
 * 4. A创建自己的链接邀请信息, 设置本地链接信息sdp, 通过服务器发送给B
 *    - createOffer: 创建本地链接信息
 *    - setLocalDescription: 将offer设置为本地链接信息sdp, 并且触发本地peer的onicecandidate事件
 * 4. server转发offer链接邀请信息给B, 触发B的onOffer方法进行处理
 *    - setRemoteDescription: 接收A的链接邀请，并设置A的描述信息, XXX.setRemoteDescription(new RTCSessionDescription(offer))
 *    - createAnswer: 创建回应，并存储本地的回应信息, 并将回应发送给server
 *    - setLocalDescription, 将自己的创建的answer设置为本地连接信息sdp, 触发自己的本地onicecandidate事件
 * 5. server转发候选人信息candidate, 触发B的onNewPeer(自定义的方法)
 *    - addIceCandidate: 将A的候选人信息加入自己本地, XXX.addIceCandidate(new RTCIceCandidate(candidate));
 * 6. A通过server接收B发出的answer, 触发自己的onAnswer
 *    - 设置B的描述信息, XXX.setRemoteDescription(new RTCSessionDescription(answer));
 * 7. AB链接建立完成, 开始传输实时数据

## 功能导航

+ [音视频功能块](//github.com/lduoduo/webrtc-demos/tree/master/wp/src/app/chat)
+ [屏幕共享功能块](//github.com/lduoduo/webrtc-demos/tree/master/wp/src/app/desktop)
+ [文件并发传输](//github.com/lduoduo/webrtc-demos/tree/master/wp/src/app/file)
+ [即时文字聊天](//github.com/lduoduo/webrtc-demos/tree/master/wp/src/app/message)
+ [Blob 分块传输]

## updates
+ 更新了老的代码，使用新的api
+ 新增桌面共享功能，将会单独抽出来
+ dataChannel默认值开启一个长连接，特殊数据传输(ArrayBuffer|Blob)只有需要数据传输的时候开启，数据传输完毕关闭，并且数据通道由发起方发送给接收方
+ 支持多文件同时传输，开启多个通道，通道传输完毕自动关闭销毁
+ 支持blob格式数据切块传输，demo里面是canvas导出blob进行传输，对端接收还原
+ 更改服务端全局console.log日志，输出到日志文件

[后续更新独立出来](//github.com/lduoduo/webrtc-demos/tree/master/update.md)

## next step
+ 使用webaudio对音频进行各种音效处理
+ 控制摄像头和麦克风
+ 视频处理
+ 本地录屏功能
+ ui完善
+ 多人尝试

## references
+ [google ppt](http://io13webrtc.appspot.com/#1)

+ [Real time communication with WebRTC](https://codelabs.developers.google.com/codelabs/webrtc-web/#3)

+ [desktop share](https://github.com/muaz-khan/WebRTC-Experiment/tree/master/Pluginfree-Screen-Sharing)

+ [通过WebRTC实现实时视频通信（一)](https://www.oschina.net/question/156697_172887)

+ [使用WebRTC搭建前端视频聊天室——入门篇](https://segmentfault.com/a/1190000000436544)

+ [Html5 点对点视频聊天 - 基于 HTML5、WebRTC、Node.js 的P2P视频聊天DEMO](https://www.linyuting.cn/gerenrizhi/webrtc-p2pusermedia.html)


