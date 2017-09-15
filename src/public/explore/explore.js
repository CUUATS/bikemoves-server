'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Explore = function () {
  function Explore() {
    _classCallCheck(this, Explore);

    this.state = {
      chartView: 'users',
      mapView: 'users-speed'
    };
    this.charts = {};
    this.data = {};
    this.edgeColors = ['#253494', '#2c7fb8', '#41b6c4', '#a1dab4', '#ffffcc'];
    this.edgeWidths = [3, 6, 9, 12, 15];

    this.initCharts();
    this.initMap();
  }

  _createClass(Explore, [{
    key: 'initMap',
    value: function initMap() {
      var _this = this;

      var getStats = this.getJSON(this.absoluteURL('/statistics.json')).then(function (statistics) {
        return _this.data.statistics = statistics;
      });

      this.map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mapbox/dark-v9',
        center: [-88.227203, 40.109403],
        zoom: 13
      });

      var mapLoad = new Promise(function (resolve, reject) {
        _this.map.on('load', resolve);
      });

      Promise.all([getStats, mapLoad]).then(this.addLayers.bind(this));

      this.initMapViewSelect();
    }
  }, {
    key: 'initCharts',
    value: function initCharts() {
      var _this2 = this;

      this.getJSON(this.absoluteURL('/demographics.json')).then(function (data) {
        _this2.data.demographics = data;
        _this2.initChartViews();
      });
    }
  }, {
    key: 'initChartViews',
    value: function initChartViews() {
      var _this3 = this;

      var data = this.data.demographics,
          viewButtons = document.querySelectorAll('#stats li');
      viewButtons.forEach(function (button) {
        var link = button.querySelector('a'),
            value = button.querySelector('.value'),
            statName = button.className;

        value.innerHTML = _this3.formatNumber(_this3.getStatTotal(data, statName), 0);
        link.addEventListener('click', function (e) {
          e.preventDefault();
          _this3.state.chartView = statName;
          _this3.showStatCharts();
        });
      });
      this.showStatCharts();
      this.drawStatHistogram('trip-count', 'trips', 'users');
    }
  }, {
    key: 'showStatCharts',
    value: function showStatCharts() {
      var statName = this.state.chartView;
      document.querySelectorAll('#stats li a').forEach(function (link) {
        link.className = link.parentNode.className === statName ? 'active' : '';
      });
      ['age', 'gender', 'cycling-experience'].forEach(this.drawStatChart.bind(this));
    }
  }, {
    key: 'drawChart',
    value: function drawChart(options, chartOptions) {
      var chart = this.charts[options.id];

      if (chart) {
        chart.update({
          labels: options.labels,
          series: options.series
        });
        var container = document.querySelector('#chart-' + options.id);
        if (options.title) container.querySelector('.title').innerHTML = options.title;
        if (options.xLabel) container.querySelector('.label-x').innerHTML = options.xLabel;
        if (options.yLabel) container.querySelector('.label-y .label').innerHTML = options.yLabel;
      } else {
        var _container = document.querySelector('#chart-' + options.id);
        _container.innerHTML = '<h2 class="title">' + options.title + '</h2>' + ('<div class="chart ' + options.cssClass + '"></div>') + ('<div class="label-x">' + options.xLabel + '</div>') + ('<div class="label-y"><span class="label">' + options.yLabel + '</span></div>');

        chart = new Chartist.Bar(_container.querySelector('.chart'), {
          labels: options.labels,
          series: options.series
        }, chartOptions || {});

        this.charts[options.id] = chart;
      }

      return chart;
    }
  }, {
    key: 'drawStatChart',
    value: function drawStatChart(chartName) {
      var table = this.data.demographics[chartName],
          statName = this.state.chartView,
          labels = table.map(function (row) {
        return row.description;
      }),
          series = table.map(function (row) {
        return row[statName];
      }),
          xLabel = {
        age: 'Age',
        gender: 'Gender',
        'cycling-experience': 'Cycling Experience'
      }[chartName],
          yLabel = {
        users: 'Total Users',
        trips: 'Total Trips',
        distance: 'Total Miles'
      }[statName];

      this.drawChart({
        id: chartName,
        title: xLabel,
        cssClass: 'ct-octave',
        xLabel: xLabel,
        yLabel: yLabel,
        labels: labels,
        series: series
      }, {
        axisY: {
          onlyInteger: true
        },
        chartPadding: {
          left: 25
        },
        distributeSeries: true
      });
    }
  }, {
    key: 'drawStatHistogram',
    value: function drawStatHistogram(chartName, xName, yName) {
      var table = this.data.demographics[chartName],
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

      var chart = this.drawChart({
        id: chartName,
        title: 'Trips per User',
        cssClass: 'ct-octave',
        xLabel: 'Trips',
        yLabel: 'Users',
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
    key: 'initMapViewSelect',
    value: function initMapViewSelect() {
      var _this4 = this;

      // Apply styleSelect.
      window.returnExports('#select-map-view');

      var select = document.getElementById('select-map-view');
      select.addEventListener('change', function (e) {
        var viewName = select.options[select.selectedIndex].value;
        if (_this4.state.mapView === viewName) return;
        _this4.state.mapView = viewName;
        _this4.updateMapView();
      });
    }
  }, {
    key: 'getStops',
    value: function getStops(propName, values) {
      return this.data.statistics[propName].stops.map(function (stop, i) {
        return [stop.lower, values[i]];
      });
    }
  }, {
    key: 'getMapViewPaintProperties',
    value: function getMapViewPaintProperties() {
      var viewName = this.state.mapView;

      if (viewName === 'users-speed') return {
        'line-color': {
          type: 'interval',
          property: 'mean_speed',
          stops: this.getStops('speed', this.edgeColors)
        },
        'line-width': {
          type: 'interval',
          property: 'users',
          stops: this.getStops('users', this.edgeWidths)
        }
      };

      if (viewName === 'trips-speed') return {
        'line-color': {
          type: 'interval',
          property: 'mean_speed',
          stops: this.getStops('speed', this.edgeColors)
        },
        'line-width': {
          type: 'interval',
          property: 'trips',
          stops: this.getStops('trips', this.edgeWidths)
        }
      };
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
        paint: this.getMapViewPaintProperties(),
        layout: {
          'line-cap': 'round'
        }
      }, 'road-label-small');

      this.drawLegend();
    }
  }, {
    key: 'updateMapView',
    value: function updateMapView() {
      var props = this.getMapViewPaintProperties();
      for (var propName in props) {
        this.map.setPaintProperty('bikemoves-edge', propName, props[propName]);
      }this.drawLegend();
    }
  }, {
    key: 'drawLegendChart',
    value: function drawLegendChart(chartId, propName, title, xLabel, yLabel, values) {
      var stats = this.data.statistics[propName],
          labels = stats.stops.map(function (stop) {
        if (stop.upper === stop.lower + 1) return stop.lower.toString();
        return stop.lower + ' to ' + (stop.upper - 1);
      }),
          series = stats.stops.map(function (stop) {
        return stop.count;
      });

      var chart = this.drawChart({
        id: chartId,
        title: title,
        cssClass: 'ct-octave',
        xLabel: xLabel,
        yLabel: yLabel,
        labels: labels,
        series: [series]
      }, {
        axisX: {
          showGrid: false
        },
        axisY: {
          onlyInteger: true
        }
      });

      chart.on('draw', function (data) {
        if (data.type !== 'bar') return;
        var value = values[data.index],
            cssProp = isNaN(value) ? 'stroke' : 'stroke-width';

        data.element._node.style[cssProp] = value;
      });
    }
  }, {
    key: 'drawLegend',
    value: function drawLegend() {
      this.drawLegendChart('edge-color', 'speed', 'Average Speed', 'MPH', 'Miles', this.edgeColors);
      if (this.state.mapView === 'users-speed') {
        this.drawLegendChart('edge-width', 'users', 'Users', 'Users', 'Miles', this.edgeWidths);
      } else {
        this.drawLegendChart('edge-width', 'trips', 'Trips', 'Trips', 'Miles', this.edgeWidths);
      }
    }
  }]);

  return Explore;
}();

var explore = new Explore();