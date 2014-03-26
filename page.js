var margin = {top: 0, right: 0, bottom: 0, left: 0},
    width = 500 - margin.left - margin.right,
    height = 100 - margin.top - margin.bottom;

var createHistogramCanvas = function (elem) {
    var svg = d3.select(elem[0]).append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
      .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
};

var renderHistogram = function (elem, data) {
    elem.find('span.count').text(data.count);
    elem.find('span.average').text((data.sum / data.count).toFixed(2));
    elem.find('span.min').text(data.min);
    elem.find('span.max').text(data.max);

    // A formatter for counts.
    var formatCount = d3.format(",.0f");

    var x = d3.scale.linear()
        .domain([0, 1])
        .range([0, width]);

    // Generate a histogram using twenty uniformly-spaced bins.
    var d3data = d3.layout.histogram()
        .bins(x.ticks(20))
        (data.values);

    var y = d3.scale.linear()
        .domain([0, data.max])
        .range([height, 0]);

    var svg = d3.select(elem[0]).select('svg');

    var bar_update = svg.selectAll(".bar")
            .data(d3data),
        bar_enter = bar_update.enter(),
        bar_exit = bar_update.exit();

    // new bar items
    var bar = bar_enter.append("g")
        .attr("class", "bar")
        .attr("transform", function(d) { return "translate(" + x(d.x) + "," + y(d.y) + ")"; });

    bar.append("rect")
        .attr("x", 1)
        .attr("width", x(d3data[0].dx) - 1)
        .attr("height", function(d) { return height - y(d.y); });

    // stale bar items
    bar_exit.select('g').remove();

    // changed bar items
    bar = bar_update.select('g.bar')
        .attr("transform", function(d) { return "translate(" + x(d.x) + "," + y(d.y) + ")"; });

    bar.select('rect')
        .attr("width", x(d3data[0].dx) - 1)
        .attr("height", function(d) { return height - y(d.y); });
};

$(function(){
    var iosocket = io.connect(),
        status = $('#conn-status'),
        streamState = function (x) {
            $('#stream-status').toggleClass('up', x);
        },
        chart = $('#chart'),
        summary = {},
        filters = {
            '12': 'Miles per Day',
            '22': 'Curb Weight',
            '24': 'Fuel Economy',
            '27': 'Daily Fuel Use',
            '28': 'co2eqv_day'
        };

    iosocket.on('connect', function () {
        status.toggleClass('up');

        iosocket.on('data', function (rows) {
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
                            values: []
                        }

                        // add a new div in the markup
                        sumitem = $('<div/>').appendTo(chart);
                        sumitem.append('<span class="count"/>');
                        sumitem.append('<span class="min"/>');
                        sumitem.append('<span class="average"/>');
                        sumitem.append('<span class="max"/>');
                        sumitem.append('<span class="name">' + filters[i] + '</span>');

                        createHistogramCanvas(sumitem);
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

                        if (!isNaN(val)) {
                            sumitem.min = val < sumitem.min ? val : sumitem.min;
                            sumitem.max = val > sumitem.max ? val : sumitem.max;
                            sumitem.count = sumitem.count + 1;
                            sumitem.sum = sumitem.sum + val;
                            sumitem.values.push(val);
                        }
                    }
                }
            }

            j = 1;
            for (i in summary) {
                if (summary.hasOwnProperty(i)) {
                    sumitem = chart.find('div:nth-child(' + j + ')');

                    renderHistogram(sumitem, summary[i]);

                    j++;
                }
            }

            iosocket.emit('ack');
        });

        iosocket.on('disconnect', function() {
            status.toggleClass('up')
                .toggleClass('down');
        });
    });

    $('#start').on('click', function () {
        iosocket.emit('start');

        iosocket.emit('get stream state', streamState);
    });

    $('#stop').on('click', function () {
        iosocket.emit('stop');

        iosocket.emit('get stream state', streamState);
    });

});