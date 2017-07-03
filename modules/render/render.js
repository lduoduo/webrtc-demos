/** set template engine */

var views = require('co-views');

module.exports = views(__dirname + '/../../views', {
	ext: 'ejs'
});