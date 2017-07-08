/** 打包工具 */
// require modules
var fs = require('fs');
var archiver = require('archiver');

// create a file to stream archive data to.
var output = fs.createWriteStream(__dirname + '/target/webrtc.zip');
var archive = archiver('zip', {
    store: true // Sets the compression method to STORE.
});

// listen for all archive data to be written
output.on('close', function() {
  console.log(archive.pointer() + ' total bytes');
  console.log('archiver has been finalized and the output file descriptor has closed.');
});

// good practice to catch this error explicitly
archive.on('error', function(err) {
  throw err;
});

// pipe archive data to the file
archive.pipe(output);

// append files from a directory
archive.directory('config/');
archive.directory('keys/');
archive.directory('modules/');
archive.directory('public/');
archive.directory('routers/');
archive.directory('service/');
archive.directory('tpl/');
archive.directory('views/');

// append a file
archive.file('app-server.js');
archive.file('app-static.js');
archive.file('app-io-prd.js');
archive.file('app-ws-prd.js');
archive.file('apps.js');
archive.file('package.json');

// append files from a glob pattern
// archive.glob('subdir/*.txt');

// finalize the archive (ie we are done appending files but streams have to finish yet)
archive.finalize();