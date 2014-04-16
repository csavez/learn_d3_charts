d3.chart('BaseChart').extend('SunBurstChart', {
  initialize : function(options) {
    var chart = this;

    chart.radius = options.radius;
    chart.maxDepth = 3;

    chart.duration = 500;

    chart.hue = d3.scale.category10();

    chart.luminance = d3.scale.sqrt()
      .domain([0, 1e6])
      .clamp(true)
      .range([90, 20]);

    //.attr("transform", "translate(" + [margin.left , margin.top] + ")");

    chart.partition = d3.layout.partition()
      .sort(function(a, b) { return d3.ascending(a.name, b.name); })
      .size([2 * Math.PI, chart.radius]);

    chart.arc = d3.svg.arc()
      .startAngle(function(d) { return d.x; })
      .endAngle(function(d) { return d.x + d.dx - 0.01 / (d.depth + 0.5); })
      .innerRadius(function(d) { return chart.radius / (chart.maxDepth + 1) * d.depth; })
      .outerRadius(function(d) { return chart.radius / (chart.maxDepth + 1) * (d.depth + 1) - 1; });

    chart.defs = chart.base.append("defs");

    chart.marker = chart.defs.append("marker")
      .attr({
        id: "marker-circle",
        markerWidth: 12,
        markerHeight: 12,
        refx: -5,
        refy: -5,
        orient: "auto"
      });

    chart.markerCircle = chart.marker.append("circle")
      .attr({
          cx: 9,
          cy: 9,
          r: 3,
      })
      .style({
        fill: "#000000"
      });

    chart.centerGroup = chart.base.append("g")
      .attr({
        transform: "translate(" + [chart.radius + 20, chart.radius + 20] + ")"
      });

    chart.breadcrumbGroup = chart.base.append("g");

    chart.center = chart.centerGroup.append("circle")
      .attr({
        r: chart.radius / (chart.maxDepth + 1),
        fill: "#ffffff",
      })
      .on("click", chart.zoomOut.bind(chart));

    chart.centerText = chart.centerGroup.append("text")
      .attr({
        y: 10,
      }).style({
        "font-size": "24px",
        "text-anchor": "middle"
      });

    chart.breadcrumbMainText = chart.breadcrumbGroup.append("text")
    .attr({
      "transform": "translate(" + [20,20] + ")"
    })
    .style({
      "font-size": "18px",
    });

    // Layers
    chart.layer('path', chart.base.select('g').append('g').attr("transform", "translate(" + [chart.radius, chart.radius] + ")"), {
      dataBind: function(data) {
        return this.selectAll('path')
          .data(chart.partition.nodes(data).slice(1));
      },
      insert: function() {
        return this.append('path');
      }
    });

    function onEnterPath() {
      chart.path = this;

      this.attr("d", chart.arc)
        .style({
          "fill": function(d) { return d.fill; },
          "marker-start": function(d) { return d._depth > chart.maxDepth - 1  && d._children ? "url(#marker-circle)" : "none"; }
        })
        .each(function(d) {
          this._current = updateArc(d);
        })
        .on("click", chart.zoomIn.bind(chart))
        .on("mouseover", chart.showInfo.bind(chart))
        .on("mouseout", chart.hideInfo.bind(chart));
    }
    this.layer("path").on("enter", onEnterPath);

  },
  arcTween: function (b, chart) {
    var i = d3.interpolate(this._current, b);
    this._current = i(0);
    return function(t) {
      return chart.arc(i(t));
    };
  },
  zoomIn: function (p) {
    if (p.depth > 1) p = p.parent;
    if (!p.children) return;
    this.zoom(p, p);
  },
  zoomOut: function (p) {
    if (!p || !p.parent) return;
    this.zoom(p.parent, p);
  },
  zoom: function(root, p) {
    var chart = this;

    //console.log(path);
    var actualDepth = root._depth;
    if (document.documentElement.__transition__) return;

    function depthCount(branch) {
      if (!branch._children) {
          return 1;
      }
      return 1 + d3.max(branch._children.map(depthCount));
    }

    var rootDepth = depthCount(root);

    // Rescale outside angles to match the new layout.
    var enterArc,
        exitArc,
        outsideAngle = d3.scale.linear().domain([0, 2 * Math.PI]);

    function insideArc(d) {
      return p.breadcrumb > d.breadcrumb
          ? {depth: d.depth - 1, x: 0, dx: 0} : p.breadcrumb < d.breadcrumb
          ? {depth: d.depth - 1, x: 2 * Math.PI, dx: 0}
          : {depth: 0, x: 0, dx: 2 * Math.PI};
    }

    function outsideArc(d) {
      return {depth: d.depth + 1, x: outsideAngle(d.x), dx: outsideAngle(d.x + d.dx) - outsideAngle(d.x)};
    }

    chart.center.datum(root);

    // When zooming in, arcs enter from the outside and exit to the inside.
    // Entering outside arcs start from the old layout.
    if (root === p) {
      enterArc = outsideArc;
      exitArc = insideArc;
      outsideAngle.range([p.x, p.x + p.dx]);
    }
    chart.path = chart.path.data(chart.partition.nodes(root), function(d) { return d.key; });

    // When zooming out, arcs enter from the inside and exit to the outside.
    // Exiting outside arcs transition to the new layout.
    if (root !== p) enterArc = insideArc, exitArc = outsideArc, outsideAngle.range([p.x, p.x + p.dx]);

    d3.transition().duration(d3.event.altKey ? 7500 : 750).each(function() {
      chart.path.exit().transition()
          .style("fill-opacity", function(d) { return d.depth === 1 + (root === p) ? 1 : 0; })
          .attrTween("d", function(d) { return chart.arcTween.call(this, exitArc(d), chart); })
          .remove();

      chart.path.enter().append("path")
          .style("fill-opacity", function(d) { return d.depth === 2 - (root === p) ? 1 : 0; })
          .style("fill", function(d) { return d.fill; })
          .on("click", chart.zoomIn.bind(chart))
          .on("mouseover", chart.showInfo.bind(chart))
          .on("mouseout", chart.hideInfo.bind(chart))
          .each(function(d) { this._current = enterArc(d); });

      chart.path.transition()
          .style({
            "fill-opacity": 1,
            "marker-start": function(d) { return d._depth > chart.maxDepth + actualDepth - 1 && d._children ? "url(#marker-circle)" : "none"; },
          })
          .attrTween("d", function(d) { return chart.arcTween.call(this, updateArc(d), chart); });
    });
  },
  showInfo: function(p) {
    this.breadcrumbMainText.text(p.breadcrumb.replace(/\./g," > "));
    this.centerText.text((100 * p.value / 40 /*root.value*/).toPrecision(3) + '%');
  },
  hideInfo: function (p) {
      this.breadcrumbMainText.text('');
      this.centerText.text('');
  },
  transform: function(rawData) {
    var chart = this,
        data = buildHierarchy(rawData);

    function fill(d) {
      var p = d;
      while (p.depth > 1) p = p.parent;
      var c = d3.lab(chart.hue(p.name));
      c.l = chart.luminance(d.sum);
      return c;
    }

    chart.partition
      .value(function(d) { return d.size; })
      .nodes(data)
      .forEach(function(d) {
        d._children = d.children;
        d._depth = d.depth;
        d.sum = d.value;
        d.key = guid();
        d.breadcrumb = breadcrumb(d);
        d.fill = fill(d);
      });

    // Now redefine the value function to use the previously-computed sum.
    chart.partition
      .children(function(d, depth) { return depth < chart.maxDepth ? d._children : null; })
      .value(function(d) { return d.sum; });

    return data;
  }

});

function guid() {
    function _p8(s) {
        var p = (Math.random().toString(16)+"000000000").substr(2,8);
        return s ? "-" + p.substr(0,4) + "-" + p.substr(4,4) : p ;
    }
    return _p8() + _p8(true) + _p8(true) + _p8();
}

function breadcrumb(d) {
  var k = [], p = d;
  while (p.depth) {
    k.push(p.name);
    p = p.parent;
  }
  return k.reverse().join(".");
}

function updateArc(d) {
  return {depth: d.depth, x: d.x, dx: d.dx};
}

function buildHierarchy(csv) {
  var root = {"name": "flare", "children": []};
  for (var i = 0; i < csv.length; i++) {
    var sequence = csv[i].path;
    var size = parseInt(csv[i].cnt);

    var parts = sequence.split(",");

    var currentNode = root;

    for (var j = 0; j < parts.length && j < 10; j++) {
      var children = currentNode.children;
      var nodeName = parts[j];
      var childNode;
      if (j + 1 < parts.length) {
        // Not yet at the end of the sequence; move down the tree.
        var foundChild = false;
        for (var k = 0; k < children.length; k++) {
          if (children[k].name == nodeName) {
            childNode = children[k];
            foundChild = true;
            break;
          }
        }

        // If we don't already have a child node for this branch, create it.
        if (!foundChild) {
          childNode = {"name": nodeName, "children": []};
          children.push(childNode);
        }

        currentNode = childNode;
      } else {
        // Reached the end of the sequence; create a leaf node.
        childNode = {"name": nodeName, "size": size};
        children.push(childNode);
      }
    }
  }
  return root;
}