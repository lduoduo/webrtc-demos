
window.onload = function () {
    var tmp = window.performance.timing;
    var perf = "DNS: " + (tmp.domainLookupEnd - tmp.domainLookupStart) + "ms" +
        "\nTCP: " + (tmp.connectEnd - tmp.connectStart) + "ms" +
        "\nreq请求: " + (tmp.responseEnd - tmp.responseStart) + "ms" +
        "\ndom解析: " + (tmp.domComplete - tmp.domInteractive) + "ms" +
        "\n白屏: " + (tmp.domLoading - tmp.fetchStart) + "ms" +
        "\n总: " + (tmp.loadEventStart - tmp.fetchStart) + "ms";
    ERROR.logtype = "performance";
    ERROR.log = perf;
    // alert(JSON.stringify(perf));
    // ajax.post('/data/updateLog', ERROR);
}

/**
 * 延迟加载函数 js / css文件
 * 
 * @param {any} url 目标地址
 */
window.lazyLoad = function (url) {
    if (!url) return
    let dom
    // 加载css
    if (/\.css$/.test(url)) {
        dom = document.createElement('style')
        dom.href = url
    }
    if (/\.js$/.test(url)) {
        dom = document.createElement('script')
        dom.src = url
    }
    return new Promise((resolve, reject) => {
        dom.onload = resolve
        document.body.appendChild(dom)
    })

}

//弹窗插件配置
window.Mt = {
    alert: function (option) {
        //type, title, msg, btnMsg, cb, isLoading
        swal({
            title: option.title || '',
            text: option.msg,
            type: option.type,
            showConfirmButton: !!option.confirmBtnMsg,
            showCancelButton: !!option.cancelBtnMsg,
            cancelButtonText: option.cancelBtnMsg || "在犹豫一下",
            confirmButtonColor: "#DD6B55",
            confirmButtonText: option.confirmBtnMsg || "好哒",
            showLoaderOnConfirm: option.isLoading,
            timer: option.timer,
            closeOnConfirm: false,
            html: option.html
        }, option.cb);
    },
    close: function () {
        swal.close();
    }
};