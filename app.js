var fs = require('fs'),
    http = require('http'),
    socketio = require('socket.io');
 
var server = http.createServer(function(req, res) {
    res.writeHead(200, { 'Content-type': 'text/html'});
    if (req.url == '/page.js') {
        res.end(fs.readFileSync(__dirname + '/page.js'));
    } else if (req.url == '/style.css') {
        res.end(fs.readFileSync(__dirname + '/style.css'));
    } else {
        res.end(fs.readFileSync(__dirname + '/index.html'));
    }
}).listen(8080, function() {
    console.log('Listening at: http://localhost:8080');
});
 
var io = socketio.listen(server).on('connection', function (socket) {
    var streaming = null,
        tail = null;

    socket.on('get stream state', function (fn) {
        fn(streaming != null);
    });

    socket.on('start', function () {
        console.log('starting stream');

        var bufferStart,
            tail = '',
            data,
            i,
            row;

        streaming = fs.createReadStream('data/MassVehicleCensusData_20130313/rae_public_noheader.csv');
        streaming.on('data', function(buffer) {
            bufferStart = 0;
            data = [];

            for (i = 0; i < buffer.length; i++) {
                if (buffer[i] == 10) { // newline
                    row = tail + buffer.toString('utf8', bufferStart, i-1).split(',');
                    data.push(row);
                    bufferStart = i+1;
                    tail = '';
                }
            }

            if (bufferStart < buffer.length) {
                tail = buffer.toString('utf8', bufferStart, buffer.length);
            }

            socket.emit('data', data);

            // pause stream until ACK
            streaming.pause();
        });
    });

    socket.on('stop', function () {
        streaming.pause();
        streaming.close();
        streaming = null;
    });

    socket.on('ack', function () {
        if (streaming) {
            streaming.resume();
        }
    });
});

io.configure(function () {
    io.set('log level', 0);
});
