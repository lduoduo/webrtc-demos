/** 
 * minAlert
 * created by lduoduo
 * 自定义小弹窗，默认位置正中，可以指定显示位置(左上、右上、左下、右下)
 * 消息累计堆叠
 * 为了兼容IE8写的弹窗，默认支持传入自定义html结构内容
 * 调用方法:
 * 1. 在目标文件引入该文件 var minAlert = require('./minAlert.js');
 * 2. 打开弹窗时调用
 *      minAlert.alert(option)
 * 3. 关闭弹窗时调用
 *      minAlert.close(option)
 * 参数说明：
 *  option = {
 *      type: 'success', //消息类型 success / error / info / warnning
        title: '', //消息标题，可以不传
        msg: '', //消息主体
        subMsg: '', //副体tip
        position: 'tl/tr/bl/br', //左上、右上、左下、右下)
        cancelBtnMsg: '', //取消按钮的按钮内容
        confirmBtnMsg:'', //确定按钮的按钮内容
        showConfirm: false, //是否显示确定按钮
        showCancel: false, //是否显示取消按钮
        showClose: true, //是否显示关闭按钮
        cbConfirm: function(){}, //点击确定按钮的回调
        cbCancel: function(){}, //点击取消按钮的回调
        cbClose: function(){}, //点击关闭按钮的回调
        env: this //原始执行环境
 *  }
 */

(function () {
    var MinAlert = {
        //默认配置
        defaults: {
            type: 'success',
            title: '提示',
            msg: '',
            subMsg: '',
            position: 'default',
            cancelBtnMsg: '',
            confirmBtnMsg: '',
            showConfirm: false,
            showCancel: true,
            showClose: true,
            // html: false, //是否支持HTML结构代码
            cbConfirm: null,
            cbCancel: null,
            cbClose: null,
            env: null
        },
        info: null, //完整配置
        count: 0, //开启次数，第一次开启时，需要绑定事件，后面都不需要绑定了
        //模板
        tpl: {
            mask: '<div class="min-alert-mask active {{ position }}" tabindex=-1></div>',
            main: '<div class="min-alert active" data-confirm={{ showConfirm }} data-cancel={{ showCancel }}>'+
                    
                    '<div class="min-detail">'+
                        '<div class="min-desc {{ type }}">' +
                            '<p>{{ msg }}</p>'+
                            '<p class="sub-desc">{{ subMsg }}</p>'+
                        '</div>'+
                        '<div class="min-option">'+
                            '<a class="btn-confirm {{ showConfirm }} {{ type }} ">{{ confirmBtnMsg }}</a>'+
                            '<a class="btn-cancel {{ showCancel }}">{{ cancelBtnMsg }}</a>'+
                        '</div>'+
                    '</div>'+
                '</div>'
        },
        // 模板渲染, 使用正则表达式匹配
        render: function (tpl, data) {
            data.type = 'alert-' + data.type;
            var reg = /\{{.*?}}/g;
            var arr = tpl.match(reg); //取出所有的匹配项获得列名
            var tmp = ""; //临时列名
            for (var i = 0; i < arr.length; i++) {
                tmp = $.trim(arr[i].replace("{{", "").replace("}}", ""));
                tpl = tpl.replace(arr[i], data[tmp]);
            }
            // console.log(tpl);
            return tpl;
        },
        initEvent: function () {
            var _ = this;
            $('body').on('click', '.min-alert .btn-confirm', function () {
                _.close();
                _.info.cbConfirm && _.info.cbConfirm.call(_.info.env);
            });
            $('body').on('click', '.min-alert .btn-cancel', function () {
                _.close();
                _.info.cbCancel && _.info.cbCancel.call(_.info.env);
            });
            $('body').on('click', '.min-alert .btn-close', function () {
                _.close();
                _.info.cbClose && _.info.cbClose.call(_.info.env);
            });
        },
        alert: function (option) {
            // $('body').addClass('stop-scrolling');
            let tmp = this.info = $.extend(true, {}, this.defaults, option);
            tmp.env = option.env || this;
            tmp.cbClose = option.cbClose || tmp.cbCancel;
            tmp.showConfirm = !!tmp.confirmBtnMsg;
            tmp.showCancel = !!tmp.cancelBtnMsg;

            if (this.count == 0) {
                this.count++;
                this.initEvent();
                let html = this.render(this.tpl.mask, tmp);
                $('body').append(html);
            }

            let html = this.render(this.tpl.main, tmp);
            $('.min-alert-mask').append(html);
            $('.min-alert-mask')[0].className = `min-alert-mask ${tmp.position}`;

            //位置调整
            // var w = $('.min-alert').width(), h = $('.min-alert').height();
            // $('.min-alert').css({
            //     'margin-left': '-' + ((w) / 2) + 'px',
            //     'margin-top': '-' + ((h) / 2) + 'px'
            // });
        },
        close: function () {
            // $('.min-alert-mask').remove();
            $('.min-alert').remove();
            // $('body').removeClass('stop-scrolling');
        }
    }

    window.minAlert = {
        alert: function (option) {
            MinAlert.alert.call(MinAlert, option);
        },
        close: function () {
            MinAlert.close.call(MinAlert);
        }
    };
})()
