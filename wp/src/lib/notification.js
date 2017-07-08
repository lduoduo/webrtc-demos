/** 桌面通知插件 */

window.notify = {
    permission: Notification.permission,
    alert(data) {
        if (this.permission === 'denied') {
            return Promise.reject('当前桌面通知已被禁用，无法接收通知哦');
        }
        if (this.permission === 'granted') {
            return this._showNotify(data)
        }
        Notification.requestPermission().then(() => {
            return this._showNotify(data)
        })
    },
    _showNotify(data) {
        let _notify = new Notification(
            //title
            '哎朵朵通知您',
            {
                //提示主体内容的水平书写顺序
                dir: 'auto',
                lang: 'zh-CN',
                //字符串。标记当前通知的标签。
                tag: 'notify' + Date.now(),
                icon: `${MY.frontUrl}img/bg.png`,
                badge: `${MY.frontUrl}img/bg.png`,
                image: `${MY.frontUrl}img/bg.png`,
                /** 
                 * 通知显示时候，设备震动硬件需要的振动模式。
                 * 所谓振动模式，指的是一个描述交替时间的数组，
                 * 分别表示振动和不振动的毫秒数，一直交替下去。
                 * 例如[200, 100, 200]表示设备振动200毫秒，
                 * 然后停止100毫秒，再振动200毫秒。
                 */
                vibrate: [200, 100, 200],
                body: data, //通知的具体内容,
                /**
                 * 布尔值。新通知出现的时候是否替换之前的。如果设为true，则表示替换，表示当前标记的通知只会出现一个。
                 * 注意都这里“当前标记”没？没错，true参数要想其作用，必须tag需要设置属性值。
                 */
                renotify: true,
                //字符串。音频地址。
                sound: `${MY.frontUrl}media/data.mp3`,
                //任意类型和通知相关联的数据
                data: {
                    url: 'https://lduoduo.github.io/'
                }
            }
        );
        _notify.onclick = function () {
            //如果通知消息被点击,通知窗口将被激活
            window.focus();
        };
        _notify.onerror = function (err) {
            console.log("通知出错", err);
        };
        _notify.onshow = function () {
            setTimeout(function () {
                _notify.close();
            }, 3000)
        };
        _notify.onclose = function () {
            console.log("通知关闭");
        };
    }
}