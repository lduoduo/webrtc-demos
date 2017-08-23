/**
 * 实时白板
 * created by lduoduo
 */

// 引入样式文件
import "./whiteboard.scss";

let $remoteVideo = document.querySelector('.J-remote-video');
let serverWs = MY.environment === 'dev' ? `${window.location.hostname}:${MY.wsPort}` : window.location.hostname

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
  isCanvasEnable: $(".J-canvas-check").hasClass("active"),
  init() {
    this.initEvent();
    this.initCanvas();
  },
  initEvent() {
    let that = this;
    $("body").on("click", ".J-start", this.startRTC.bind(this));
    $("body").on("click", ".J-canvas-check", this.toggleCanvas.bind(this));

    window.addEventListener("beforeunload", this.destroy.bind(this));
  },
  destroy() {
    if (!this.rtc) return;
    this.rtc.stop();
  },
  // 是否开启canvas绘图
  toggleCanvas() {
    $(".J-canvas-check").toggleClass("active");
    this.isCanvasEnable = $(".J-canvas-check").hasClass("active");
    if (this.isCanvasEnable) {
      cvs.updateType("auto");
      cvs.enable();
    } else {
      cvs.disable();
      cvs.clear();
    }
  },
  // 初始化canvas环境
  initCanvas() {
    let canvas = $(".J-canvas")[0];
    canvas.width = $(".J-canvas").width();
    canvas.height = $(".J-canvas").height();

    cvs.init(canvas);
    this.localStream = canvas.captureStream(25);

    // var video = document.createElement("video");
    // video.srcObject = this.videoStream;
    // video.play();
    // document.body.appendChild(video);
  },
  /** 
     * 开启rtc连接
     * 支持的事件注册列表
     * mediastream
     * stop
     */
  startRTC() {
    if (this.rtc && this.rtc.inited) return;

    let cname = $(".J-channelName").val();

    if (!cname) {
      Mt.alert({
        title: "请先输入房间号",
        confirmBtnMsg: "好"
      });
      return;
    }

    let stream = this.localStream;

    let url = `wss://${serverWs}/rtcWs`;

    let rtc = (this.rtc = new rtcSDK());
    rtc
      .init({ url, roomId: cname, stream })
      .then(obj => {
        console.log("支持的注册事件:", obj);
      })
      .catch(err => {
        Mt.alert({
          title: "webrtc连接失败",
          msg: JSON.stringify(err),
          confirmBtnMsg: "好哒"
        });
      });

    rtc.on("stream", this.startRemoteStream.bind(this));
    rtc.on("stop", this.stopRTC.bind(this));
    rtc.on("ready", this.rtcStatus.bind(this));
  },
  rtcStatus(obj) {
    console.log(obj);
    let { status, error, url } = obj;

    Mt.alert({
      title: status ? "webrtc连接成功" : error,
      msg: url || "",
      confirmBtnMsg: "好哒",
      timer: 1000
    });
  },
  // 接收到远程流，进行外显
  startRemoteStream(stream) {
    console.log("remote stream:", stream);
    $remoteVideo.srcObject = stream;
    $remoteVideo.play();
    // cvs.showVideo($remoteVideo)
  },
  // 远程连接断开
  stopRTC(uid) {
    console.log(`远程rtc连接已断开,用户: `, uid);
  }
};

// 绘图相关的环境设置
window.cvs = {
  // 回调监听
  listeners: {},
  canvas: null,
  ctx: null,
  // 是否已开启
  isEnabled: false,
  isMouseDown: false,
  curColor: "#ff5722",
  curLoc: {
    x: 0,
    y: 0
  },
  lastLoc: {
    x: 0,
    y: 0
  },
  // canvas绘制类型，是矩形还是自由形状
  type: "auto",
  init(canvas) {
    this.canvas = canvas;
    // canvas.width = document.body.clientWidth;
    // canvas.height = document.body.clientHeight;
    this.canvasInfo = canvas.getBoundingClientRect();
    this.ctx = canvas.getContext("2d");
  },
  on(name, cb) {
    if (!name || !cb || cb.constructor !== Function) return;
    this.listeners[name] = cb;
  },
  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  },
  updateType(type) {
    this.type = type || "auto";
  },
  // 渲染video node
  showVideo(node){
    this.video = node;
    this.updateVideo();
  },
  updateVideo(){
    this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height); 
    // only draw if loaded and ready
    if(this.video){ 
        // // find the top left of the video on the canvas
        // video.muted = muted;
        // var scale = videoContainer.scale;
        // var vidH = videoContainer.video.videoHeight;
        // var vidW = videoContainer.video.videoWidth;
        // var top = canvas.height / 2 - (vidH /2 ) * scale;
        // var left = canvas.width / 2 - (vidW /2 ) * scale;
        // now just draw the video the correct size
        this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
    }
    // request the next frame in 1/60th of a second
    requestAnimationFrame(this.updateVideo.bind(this));
  },
  // 根据窗口大小更新canvas大小
  updateWidthHeight() {
    let canvas = this.canvas;
    if (document.body.isFullScreen) {
      canvas.width = window.screen.availWidth;
      canvas.height = window.screen.availHeight;
    } else {
      canvas.width = document.body.clientWidth;
      canvas.height = document.body.clientHeight;
    }

    console.warn(
      "canvas reset: width ->" + canvas.width + " height ->" + canvas.height
    );
  },
  // 开启
  enable() {
    this.isEnabled = true;
    let canvas = this.canvas;
    canvas.classList.toggle("active", true);

    // 不要重复绑定事件
    if (canvas.onmousedown) return;

    canvas.onmousedown = function(e) {
      cvs.canvasMouseDown(e);
    };
    canvas.onmouseup = function(e) {
      e.preventDefault();
      console.log("mouse up");
      cvs.isMouseDown = false;
    };
    canvas.onmouseout = function(e) {
      e.preventDefault();
      console.log("mouse out");
      cvs.isMouseDown = false;
    };
    canvas.onmousemove = function(e) {
      cvs.canvasMouseMove(e);
    };
  },
  // 关闭
  disable() {
    this.isEnabled = false;
    let canvas = this.canvas;
    canvas.classList.toggle("active", false);
    canvas.onmousedown = null;
    canvas.onmouseup = null;
    canvas.onmouseout = null;
    canvas.onmousemove = null;
  },
  canvasMouseDown(e) {
    e.preventDefault();
    console.log("mouse down", e.clientX, e.clientY);
    this.updateLastLoc(e.clientX, e.clientY);
  },
  // 不绘图时候的touch方向
  arrow(key) {
    if (this.isCanvasEnable) return;
    this.listeners["arrow"] && this.listeners["arrow"](key);
  },
  // 更新准备位置：绘图前的准备工作
  updateLastLoc(x, y) {
    this.isMouseDown = true;
    this.lastLoc = {
      x,
      y
    };
  },
  // 更新当前位置
  updateCurrLoc(x, y) {
    this.curLoc = {
      x,
      y
    };
  },
  canvasMouseUp(e) {
    e.preventDefault();
    console.log("mouse up");
  },
  canvasMouseMove(e) {
    e.preventDefault();
    if (!this.isMouseDown) {
      return;
    }
    console.log("mouse move", e.clientX, e.clientY);
    this.updateCurrLoc(e.clientX, e.clientY);
    this.draw();
  },
  draw() {
    if (!this.isEnabled) return;
    if (!this.isMouseDown) return;

    // 原始位置
    let last = this.getPosition(this.lastLoc.x, this.lastLoc.y);
    // 新的位置
    let { x, y } = this.getPosition(this.curLoc.x, this.curLoc.y);

    let ctx = this.ctx;
    // y += 30;
    // last.y += 30;

    ctx.beginPath();
    ctx.lineWidth = 8;
    ctx.strokeStyle = this.curColor;
    ctx.globalAlpha = 0.7;

    // 开始绘制
    if (this.type === "rect") {
      console.log("to x:" + x + " y:" + y);
      this.clear();
      return ctx.strokeRect(last.x, last.y, x - last.x, y - last.y);
    }

    console.log("start x:" + x + " y:" + y);
    // ctx.moveTo(x, y);
    ctx.lineTo(x, y);

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();

    this.lastLoc = this.curLoc;
  },
  getPosition(x, y) {
    x = Math.floor(x - this.canvasInfo.left);
    y = Math.floor(y - this.canvasInfo.top);
    return {
      x: x < 0 || x > this.canvas.width ? -1 : x,
      y: y < 0 || y > this.canvas.height ? -1 : y
    };
  },
  getDistance(loc1, loc2) {
    var data = Math.sqrt(
      (loc2.x - loc1.x) * (loc2.x - loc1.x) +
        (loc2.y - loc1.y) * (loc2.y - loc1.y)
    );
    return data;
  }
};

// 移动端touch事件
window.touch = {
  isMouseDown: false,
  init() {
    document.addEventListener("touchstart", this.touchStart.bind(this), false);
    document.addEventListener("touchmove", this.touchMove.bind(this), false);
    document.addEventListener("touchend", this.touchEnd.bind(this), false);
  },
  touchStart(e) {
    e.preventDefault();
    var touches = event.touches[0];
    this.isMouseDown = true;
    this.lastLoc = {
      x: touches.pageX,
      y: touches.pageY
    };
    cvs.updateLastLoc(touches.pageX, touches.pageY);
  },
  touchMove(e) {
    e.preventDefault();
    var touches = event.touches[0];
    this.currLoc = {
      x: touches.pageX,
      y: touches.pageY
    };
    if (!this.isMouseDown) return;

    // 绘图模式
    if (cvs.isEnabled) {
      cvs.updateCurrLoc(touches.pageX, touches.pageY);
      cvs.draw();
      return;
    }

    // 翻页模式, 需要防抖
    if (this.pageTimer) {
      console.warn("销毁 翻页 timer");
      clearTimeout(this.pageTimer);
    }
    this.pageTimer = setTimeout(() => {
      this.pageTimer = null;
      console.log("------ 执行 翻页 ------");
      cvs.arrow(this.currLoc.x - this.lastLoc.x);
    }, 100);
  },
  touchEnd(e) {
    e.preventDefault();
    this.isMouseDown = false;
    // var result = this.curLoc.x - this.lastLoc.x
  }
};

home.init();
