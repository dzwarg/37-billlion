var fs = require('fs'),
    http = require('http'),
    socketio = require('socket.io');
 
var server = http.createServer(function(req, res) {
    if (req.url == '/static/page.js') {
        res.writeHead(200, { 'Content-type': 'application/json'});
        res.end(fs.readFileSync(__dirname + '/static/page.js'));
    } else if (req.url == '/static/jquery-1.7.2.min.js') {
        res.writeHead(200, { 'Content-type': 'application/json'});
        res.end(fs.readFileSync(__dirname + '/static/jquery-1.7.2.min.js'));
    } else if (req.url == '/static/d3.v3.min.js') {
        res.writeHead(200, { 'Content-type': 'application/json'});
        res.end(fs.readFileSync(__dirname + '/static/d3.v3.min.js'));
    } else if (req.url == '/static/style.css') {
        res.writeHead(200, { 'Content-type': 'text/css'});
        res.end(fs.readFileSync(__dirname + '/static/style.css'));
    } else {
        res.writeHead(200, { 'Content-type': 'text/html'});
        res.end(fs.readFileSync(__dirname + '/index.html'));
    }
}).listen(8080, function() {
    console.log('Listening at: http://localhost:8080');
});
 
var io = socketio.listen(server).on('connection', function (socket) {
    // console.log('new connection from <' + socket.id + '>');

    var socketStart = function (cursor) {
        var bufferStart,
            data,
            i,
            row;

        socket.cursor = cursor;

        // console.log('opening stream for <' + socket.id + '>: ' + cursor);

        socket.stream = fs.createReadStream('data/MassVehicleCensusData_20130313/rae_public_noheader.csv', {start: cursor});
        socket.stream.on('data', function(buffer) {
            // console.log('cursor was ' + socket.cursor);
            socket.cursor += buffer.length;

            bufferStart = 0;
            data = [];

            for (i = 0; i < buffer.length; i++) {
                if (buffer[i] == 10) { // newline
                    row = socket.tail + buffer.toString('utf8', bufferStart, i-1).split(',');
                    data.push(row);
                    bufferStart = i + 1;
                    socket.tail = '';
                }
            }

            if (bufferStart < buffer.length) {
                socket.tail = buffer.toString('utf8', bufferStart, buffer.length);
                socket.cursor -= buffer.length - bufferStart;
            }

            // console.log('cursor is now ' + socket.cursor);
            socket.emit('data', data, socket.cursor);

            // pause stream until ACK
            socket.stream.pause();
        });
    },
        socketStop = function () {
            // console.log('disconnecting socket <' + socket.id + '>');
            if (socket.stream) {
                socket.stream.pause();
                socket.stream.close();
                socket.stream = null;
            }
        };

    socket.stream = null;
    socket.tail = '';
    socket.cursor = 0;

    socket.on('get stream state', function (fn) {
        fn(socket.stream != null);
    });

    socket.on('start', socketStart);
    socket.on('stop', socketStop);
    socket.on('disconnect', socketStop);

    socket.on('ack', function (cursor) {
        if (socket.stream) {
            // console.log('stream exists');
            // console.log('socket cursor is: ' + socket.cursor);
            // console.log('requested cursor: ' + cursor);
            if (socket.cursor == cursor) {
                socket.stream.resume();
            } else {
                // console.log('starting new socket');
                socketStart(cursor);
            }
        }
    });
});

io.configure(function () {
    io.set('log level', 1);
    io.set('connect timeout', 3000);
});
