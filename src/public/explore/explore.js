'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Explore = function () {
  function Explore() {
    _classCallCheck(this, Explore);

    this.state = {
      chartView: 'users'
    };
    this.initCharts();
    // this.initMap();
  }

  _createClass(Explore, [{
    key: 'initMap',
    value: function initMap() {
      this.map = map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mapbox/light-v9',
        center: [-88.227203, 40.109403],
        zoom: 13
      });
      map.on('load', this.addLayers.bind(this));
    }
  }, {
    key: 'initCharts',
    value: function initCharts() {
      var _this = this;

      this.getJSON(this.absoluteURL('/demographics.json')).then(function (data) {
        _this.state.demographics = data;
        _this.initChartViews();
      });
    }
  }, {
    key: 'initChartViews',
    value: function initChartViews() {
      var _this2 = this;

      var data = this.state.demographics,
          viewButtons = document.querySelectorAll('#stats li');
      viewButtons.forEach(function (button) {
        var link = button.querySelector('a'),
            value = button.querySelector('.value'),
            statName = button.className;

        value.innerHTML = _this2.formatNumber(_this2.getStatTotal(data, statName), 0);
        link.addEventListener('click', function (e) {
          e.preventDefault();
          _this2.state.chartView = statName;
          _this2.showStatCharts();
        });
      });
      this.showStatCharts();
      this.drawHistogram('trip-count', 'trips', 'users');
    }
  }, {
    key: 'showStatCharts',
    value: function showStatCharts() {
      var statName = this.state.chartView;
      document.querySelectorAll('#stats li a').forEach(function (link) {
        link.className = link.parentNode.className === statName ? 'active' : '';
      });
      ['age', 'gender', 'cycling-experience'].forEach(this.drawChart.bind(this));
    }
  }, {
    key: 'drawChart',
    value: function drawChart(chartName) {
      var container = document.querySelector('#chart-' + chartName + ' .chart'),
          table = this.state.demographics[chartName],
          statName = this.state.chartView;

      var chart = new Chartist.Bar(container, {
        labels: table.map(function (row) {
          return row.description;
        }),
        series: table.map(function (row) {
          return row[statName];
        })
      }, {
        axisY: {
          onlyInteger: true
        },
        chartPadding: {
          left: 25
        },
        distributeSeries: true
      });

      var ylabel = {
        users: 'Total Users',
        trips: 'Total Trips',
        distance: 'Total Miles'
      }[statName];
      container.parentNode.querySelector('.label-y').innerHTML = '<span class="label">' + ylabel + '</span>';
    }
  }, {
    key: 'drawHistogram',
    value: function drawHistogram(chartName, xName, yName) {
      var container = document.querySelector('#chart-' + chartName + ' .chart'),
          table = this.state.demographics[chartName],
          x = table.map(function (row) {
        return row[xName];
      }),
          y = table.map(function (row) {
        return row[yName];
      }),
          xMin = Math.min.apply(null, x),
          xMax = Math.max.apply(null, x),
          numBars = xMax - xMin + 1,
          labelFreq = Math.ceil(numBars / 10 / 5) * 5,
          values = [],
          labels = [];

      for (var i = xMin; i <= xMax; i++) {
        labels.push((i - xMin + 1) % labelFreq === 0 ? i.toString() : '');
        var idx = x.indexOf(i);
        values.push(idx === -1 ? 0 : y[idx]);
      }

      var chart = new Chartist.Bar(container, {
        labels: labels,
        series: [values]
      }, {
        axisX: {
          showGrid: false
        },
        axisY: {
          onlyInteger: true
        },
        chartPadding: {
          left: 25
        }
      });

      chart.on('draw', function (data) {
        if (data.type !== 'bar') return;
        data.element._node.style['stroke-width'] = 100 / numBars + '%';
      });
    }
  }, {
    key: 'getStatTotal',
    value: function getStatTotal(data, statName) {
      return data.gender.reduce(function (sum, row) {
        return sum + row[statName];
      }, 0);
    }
  }, {
    key: 'formatNumber',
    value: function formatNumber(value, digits) {
      return (+value.toFixed(digits)).toLocaleString();
    }
  }, {
    key: 'absoluteURL',
    value: function absoluteURL(url) {
      return location.protocol + '//' + location.hostname + (location.port ? ':' + location.port : '') + url;
    }
  }, {
    key: 'getJSON',
    value: function getJSON(url) {
      return new Promise(function (resolve, reject) {
        var req = new XMLHttpRequest();
        req.onload = function () {
          if (req.status >= 200 && req.status < 300) {
            resolve(JSON.parse(req.response));
          } else {
            reject(req.statusText);
          }
        };
        req.onerror = function () {
          return reject(req.statusText);
        };
        req.open('GET', url, true);
        req.send();
      });
    }
  }, {
    key: 'addLayers',
    value: function addLayers() {
      this.map.addSource('explore', {
        type: 'vector',
        tilejson: '2.2.0',
        name: 'bikemoves-explore',
        description: 'Map data for the BikeMoves Explore web app.',
        version: '1.0.0',
        attribution: '<a href="https://ccrpc.org/">&copy; CCRPC</a>',
        scheme: 'xyz',
        tiles: [this.absoluteURL('/explore/{z}/{x}/{y}.mvt')]
      });

      this.map.addLayer({
        id: 'bikemoves-edge',
        type: 'line',
        source: 'explore',
        'source-layer': 'edge',
        paint: {
          'line-color': {
            type: 'interval',
            property: 'mean_speed',
            stops: [[1, '#d7191c'], [2, '#fdae61'], [3, '#ffffbf'], [4, '#abd9e9'], [5, '#2c7bb6']]
          },
          'line-width': {
            type: 'interval',
            property: 'users',
            stops: [[2, 4], [4, 8], [6, 12], [8, 16]]
          }
        },
        layout: {
          'line-cap': 'round'
        }
      }, 'road-label-small');
    }
  }]);

  return Explore;
}();

var explore = new Explore();