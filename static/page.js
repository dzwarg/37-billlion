var margin = {top: 0, right: 0, bottom: 0, left: 0},
    width = 500 - margin.left - margin.right,
    height;

var createCanvas = function (elem) {
    var svg = d3.select(elem[0]).select('.visual').append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
      .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
};

var render = function (elem, data) {
    var mean = data.sum / data.count,
        stddev = Math.sqrt(data.sum_2 / data.count - mean * mean);
    elem.find('span.count').text(data.count);
    elem.find('span.average').text(mean.toFixed(2));
    elem.find('span.min').text(data.min);
    elem.find('span.max').text(data.max);
    elem.find('span.stddev').text(stddev.toFixed(2));

    // A formatter for counts.
    var formatCount = d3.format(",.0f");

    var x = d3.scale.linear()
        .domain([data.min, data.max])
        .range([0, width]);

    var y = d3.scale.linear()
        .domain([0, 1])
        .range([height, 0]);

    var color = d3.scale.linear()
        .domain([mean - 2 * stddev, mean - stddev, mean, mean + stddev, mean + 2 * stddev])
        .range(['blue', 'purple', 'red', 'yellow', 'white'])
        .clamp(true);

    var svg = d3.select(elem[0]).select('svg');

    var update = svg.selectAll(".bar")
        .data([data]);

    // new bar items
    var bar = update.enter().append("g")
        .attr("class", "bar")
        .attr("transform", function(d) { return "translate(" + x(data.sum/data.count) + ",0)"; });

    bar.append("rect")
        .attr("x", 0)
        .attr("width", 3 - 1)
        .attr("height", height);

    // changed bar items
    update
        .attr("transform", function(d) { return "translate(" + x(data.sum/data.count) + ",0)"; });

    var canvas = document.createElement("canvas");
    canvas.height = 1;
    canvas.width = data.values.length;
    elem[0].querySelector('.visual').appendChild(canvas);

    // clamp this to (height (in px)) items
    if (elem[0].querySelectorAll('canvas').length >= height) {
        // remove the first canvas
        elem[0].querySelector('canvas').remove();
    }

    var ctx = canvas.getContext('2d'),
        imageData = ctx.getImageData(0, 0, canvas.width, canvas.height),
        c;

    data.values.sort(function(a, b) {
        return a > b;
    });

    for (var i = 0; i < data.values.length; i++) {

        c = d3.rgb(color(data.values[i]));
        imageData.data[i * 4 + 0] = c.r;
        imageData.data[i * 4 + 1] = c.g;
        imageData.data[i * 4 + 2] = c.b;
        imageData.data[i * 4 + 3] = 255;
    }

    ctx.putImageData(imageData, 0, 0);

    data.values = [];
    data.limit = true;
};

$(function(){
    var state = {},
        $status = $('#conn-status'),
        streamState = function (x) {
            $('#stream-status').toggleClass('up', x);
        },
        $chart = $('#chart'),
        $connect = $('#connect'),
        $start = $('#start'),
        $stop = $('#stop'),
        $cursor = $('#cursor'),
        summary = {},
        filters = {
            '12': 'Miles per Day',
            '22': 'Curb Weight',
            '24': 'Fuel Economy',
            '27': 'Daily Fuel Use',
            '28': 'co2eqv_day'
        },
        limit = function (sumitem, val) {
            if (!sumitem.limit) {
                return false;
            }

            var mean = sumitem.sum / sumitem.count,
                stddev = Math.sqrt(sumitem.sum_2 / sumitem.count - mean * mean);
            
            return val < (mean - 5 * stddev) || val > (mean + 5 * stddev);
        },
        socketData = function (rows, cursor) {
            if ($cursor.text() == cursor) {
                // duplicate attachments? does .of do nothing?
                return;
            }

            $cursor.text(cursor);

            var i, j = 0, fields, val, sumitem;

            // check the number of items in 'summary'
            for (i in summary) {
                if (summary.hasOwnProperty(i)) {
                    j++;
                }
            }

            // if no properties in 'summary', define a new structure
            if (j == 0) {
                fields = rows[0].split(',');

                for (i = 0; i < fields.length; i++) {
                    if (filters.hasOwnProperty(i)) {
                        // new summary, open wide
                        summary[i] = {
                            min: Number.POSITIVE_INFINITY,
                            max: Number.NEGATIVE_INFINITY,
                            count: 0,
                            sum: 0,
                            sum_2: 0,
                            values: [],
                            limit: false
                        }

                        // add a new div in the markup
                        sumitem = $('<div/>').appendTo($chart);
                        sumitem2 = $('<div/>').appendTo(sumitem);
                        sumitem2.append('<span class="count"/>');
                        sumitem2.append('<span class="min"/>');
                        sumitem2.append('<span class="max"/>');
                        sumitem2.append('<span class="average"/>');
                        sumitem2.append('<span class="stddev"/>');
                        sumitem2.append('<span class="name">' + filters[i] + '</span>');
                        sumitem.append('<div class="visual"/>');

                        createCanvas(sumitem);
                    }
                }
            }

            // parse the rows into fields
            for (i = 0; i < rows.length; i++) {
                fields = rows[i].split(',');

                // for each field
                for (j = 0; j < fields.length; j++) {
                    if (filters.hasOwnProperty(j)) {
                        // if it's numeric, start summarizing it
                        val = parseFloat(fields[j]);
                        sumitem = summary[j];

                        if (!isNaN(val) && !limit(sumitem, val)) {
                            sumitem.min = val < sumitem.min ? val : sumitem.min;
                            sumitem.max = val > sumitem.max ? val : sumitem.max;
                            sumitem.count = sumitem.count + 1;
                            sumitem.sum = sumitem.sum + val;
                            sumitem.sum_2 = sumitem.sum_2 + val * val;
                            sumitem.values.push(val);
                        }
                    }
                }
            }

            j = 1;
            for (i in summary) {
                if (summary.hasOwnProperty(i)) {
                    sumitem = $chart.find('> div:nth-child(' + j + ')');

                    render(sumitem, summary[i]);

                    j++;
                }
            }

            state.iosocket.emit('ack', cursor);
        },
        socketConnect = function () {
            $connect.attr('disabled', true);
            $start.attr('disabled', false);

            $status.removeClass().addClass('up');
        },
        socketDisconnect = function() {
            $connect.attr('disabled', false);
            $start.attr('disabled', true);
            $stop.attr('disabled', true);

            $status.removeClass().addClass('down');
        },
        doConnect = function () {
            $connect.attr('disabled', true);
            state.iosocket = io.connect();
        };

    height = $chart.parent().height() / 6 - 20;

    doConnect();

    state.iosocket.on('connect', socketConnect);
    state.iosocket.on('disconnect', socketDisconnect);
    state.iosocket.on('data', socketData);

    $connect.on('click', doConnect);

    $start.on('click', function () {
        $start.attr('disabled', true);
        $stop.attr('disabled', false);

        // console.log('emitting a start event with cursor <' + $cursor.text() + '>');
        state.iosocket.emit('start', parseInt($cursor.text(),10));

        state.iosocket.emit('get stream state', streamState);
    });

    $stop.on('click', function () {
        $stop.attr('disabled', true);
        $start.attr('disabled', false);

        state.iosocket.emit('stop');

        state.iosocket.emit('get stream state', streamState);
    });

    state.iosocket.on('error', function (msg) {
        console.error('asplode! ' + msg)
    });

});