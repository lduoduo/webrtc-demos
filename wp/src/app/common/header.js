FastClick.attach(document.body);

var option = {
    cache: false,
    jsonpCallback: "handler",
}

function Ajax(type) {
    // console.log(arguments);

    var tmp = {
        type: arguments[0],
        dataType: arguments[0] == 'jsonp' ? 'jsonp' : 'json'
    };
    return function (url, para, cb, err) {
        $.extend(option, tmp, {
            success: function (res) {
                cb && cb(res, para);
            },
            error: function (e) {
                err && err(e);
            }
        });
        option.url = url;
        option.data = para ? para : '';
        $.ajax(option);
    }
}

window.ajax = {
    json: new Ajax('get'),
    jsonp: new Ajax('get', 'jsonp'),
    post: new Ajax('post'),
    postp: new Ajax('post', 'jsonp')
};
window.ERROR = {
    appname: MY.appName,
    pagename: MY.pageName,
    platform: navigator.platform + ':' + navigator.userAgent.match(/\s\w+\/\d+/g)[1]
};
// window.addEventListener('error',function(e){
//     console.log(e);
// });
window.onerror = function (errorMessage, source, lineno, colno, error) {
    var info = "错误信息：" + errorMessage + "\n" +
        "出错文件：" + source + "\n " +
        "出错行号：" + lineno + "\n" +
        "出错列号：" + colno + "\n" +
        "错误详情：" + error + "\n";
    ERROR.logtype = "exception";
    ERROR.log = info;
    // alert(JSON.stringify(ERROR));
    // ajax.postp(monitorUrl, ERROR, null, function(e){
    //     alert(e.stack);
    // });
    console.error(JSON.stringify(info));
    // ajax.post('/data/updateLog', ERROR);
    // Mt.alert({
    //     msg: JSON.stringify(info),
    //     confirmBtnMsg: '好哒'
    // })
}
// var a = b+1;
window.bigpipe = function (id, content) {
    //             var dom = document.querySelector('component[name='+id+']');
    //             var el = document.createElement("div");
    // 　　         el.innerHTML = content;//赋值以后其实objE已经具有DOM的对象了
    //             dom.replaceWith(el.childNodes[0]);
    //             var sdom = document.querySelector('#componet_'+id);
    //             sdom.remove()

    //上面的写法，在安卓机上报错，做好容错
    $('component[name=' + id + ']').replaceWith(content);
    $('#componet_' + id).remove();
}