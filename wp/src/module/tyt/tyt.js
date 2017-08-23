/**
 * 调音台插件
 * created by lduoduo on 2017-08-03
 * 滑动条样式 http://blog.csdn.net/u013347241/article/details/51560290
 */

require('./tyt.scss')
const tpl = require('../../../../tpl/tyt/tyt.ejs')

module.exports = {
    dom: {},
    // 初始化环境
    init(webAudio) {
        this.webAudio = webAudio
        this.initDom()
        this.initEQ()
        this.initAnalyser()
    },
    initDom() {
        let dom = document.createElement('div')
        dom.className = 'tyt-box'
        dom.innerHTML = tpl()
        document.body.appendChild(dom)
        this.initEventDomCache()
        this.initEvent()
    },
    open() {
        if (!this.dom.box) {
            this.initDom()
        }
        this.dom.box.classList.add('active')
    },
    // 初始化dom缓存
    initEventDomCache() {
        this.dom.box = document.querySelector('.tyt-box')
        this.dom.close = document.querySelector('.tyt-box .close')
        this.dom.eqBox = document.querySelector('.tyt-box .eq')
    },
    // 初始化事件
    initEvent() {
        this.dom.close.addEventListener('click', this.close.bind(this))

        this.dom.eqBox.addEventListener('change', function (e) {
            if (!e.target) return
            // 检查事件源e.targe是否为INPUT
            if (e.target.nodeName.toUpperCase() == "INPUT") {
                // 真正的处理过程在这里
                this.changeEQ(e)
            }
        }.bind(this))
        document.querySelector('.tyt-box .eq .eq-icon').addEventListener('click', function (e) {
            this.toggleEQ(e)
        }.bind(this))
    },
    // 初始化EQ环境
    initEQ() {
        this.webAudio.initEq([32, 64, 125, 250, 500, 850, 1000, 2000, 4000, 8000, 12000, 16000])
    },
    // 初始化频谱分析
    initAnalyser() {
        this.webAudio.startVisualizer(document.querySelector('.tyt-box .analyser'))
    },
    // 关闭弹框
    close() {
        this.dom.box.classList.remove('active')
    },
    // eq事件
    changeEQ(e) {
        var parent = this.dom.eqBox
        if (parent.classList.contains('disable')) return

        var f = e.target.dataset['type']
        var gain = e.target.value
        console.log(f, gain)
        this.webAudio.eq(f, gain)
    },
    // 开关EQ
    toggleEQ(e) {
        var dom = this.dom.eqBox
        var domClass = dom.classList
        if(!domClass.contains('disable') && !domClass.contains('active')){
            domClass.add('active')
        }
        else if(domClass.contains('disable')){
            domClass.remove('disable')
            domClass.add('active')
        }
        else if(domClass.contains('active')){
            domClass.remove('active')
            domClass.add('disable')
        }
        console.log(domClass)
        // 调用webAudio API更新状态
        if(domClass.contains('disable')){
            this.webAudio.disableEQ()
        }else{
            this.webAudio.enableEQ()
        }
    }


}