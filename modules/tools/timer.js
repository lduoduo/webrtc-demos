/** middleware for time to log how long from a request to a response */
'use strict';

module.exports = function () {
    return function* (next) {
        const paths = this.path;
        const start = new Date;
        yield next;

        const end = new Date;
        const ms = end - start;

        console.log(`${paths} response time : ${ms} ms`);
        this.set('x-response-time', `${ms}ms`);
    }
}

