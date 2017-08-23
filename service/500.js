/** 500 internal error control */
'use strict';

module.exports = function* (next) {
    try {
        yield next;
    } catch (e) {
        // console.log(e);
        this.body = "500 happens:" + e.message;
        console.log('500 happens:' + e.message);
    }
}
