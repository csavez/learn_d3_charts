d3.chart('BaseChart').extend('DonutChart', {
  initialize : function(options) {
    var chart = this,
        radius = options.radius || 200,
        legendAvailable = d3.chart('Legend') !== null;

    chart.color = options.colors ? d3.scale.ordinal()
      .range(options.colors) : d3.scale.category20();

    chart.arc = d3.svg.arc()
      .outerRadius(radius)
      .innerRadius(radius - 120);

    chart.pie = d3.layout.pie()
      .value(function(d) { return d.cnt; });

    chart.pieGroup = this.base.append('g')
      .classed('donut', true)
      .attr('transform', 'translate(' + radius + ',' + radius + ')');

    //Legends
    if (options.legend && legendAvailable) {
      chart.legendChart = this.base.append('g')
        .attr('class', 'legend')
        .chart('Legend', options.legend);

      chart.legend = this.attach('legend', chart.legendChart);
    }

    // Layers
    chart.layer('donut', chart.pieGroup, {
      dataBind: function(data) {
        console.log(data);
        return this.selectAll('.arc')
          .data(data);
      },

      insert: function() {
        return this.append('g')
          .attr('class', 'arc');
      },

      events: {
        enter: function() {
          var chart = this.chart();

          this.append("path")
            .attr("d", chart.arc)
            .style("fill", function(d) { return chart.color(d.data.platform); });

          this.append("text")
            .attr("transform", function(d) { return "translate(" + chart.arc.centroid(d) + ")"; })
            .attr("dy", ".35em")
            .style({
              "text-anchor":"middle",
              "fill": "#ffffff"
            })
            .text(function(d) { return d.data.platform + ': ' + d.data.cnt; });
        },
      }
    });

  },

  transform: function(data) {
    data.forEach(function(d) {
      d.cnt = +d.cnt;
    });

    return this.pie(data);
  },
  demux: function (name, data) {
    var results = [],
      item;

    if (name === 'legend') {
      for (item in data) {
        if (!data.hasOwnProperty(item)) {
          continue;
        }

        item = data[item];

        if (item && item.data) {
          results.push(item.data.platform);
        }
      }

      return results;
    }
    else {
      return data;
    }
  }
});