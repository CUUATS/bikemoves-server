'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var ExploreCharts = function () {
  function ExploreCharts() {
    _classCallCheck(this, ExploreCharts);

    this.charts = {};
  }

  _createClass(ExploreCharts, [{
    key: 'drawChart',
    value: function drawChart(options, chartOptions) {
      options = Object.assign({
        headingLevel: 2
      }, options);
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
        container.querySelector('.aria-table').innerHTML = this.chartTableHTML(options);
      } else {
        var _container = document.querySelector('#chart-' + options.id);
        _container.innerHTML = '<h' + options.headingLevel + ' class="title">' + (options.title + '</h' + options.headingLevel + '>') + ('<div class="chart ' + options.cssClass + '" aria-hidden="true"></div>') + ('<div class="label-x">' + options.xLabel + '</div>') + '<div class="label-y"><span class="label">' + (options.yLabel + '</span></div>') + this.chartTableHTML(options);

        chart = new Chartist.Bar(_container.querySelector('.chart'), {
          labels: options.labels,
          series: options.series
        }, chartOptions || {});

        this.charts[options.id] = chart;
      }

      return chart;
    }
  }, {
    key: 'redrawChart',
    value: function redrawChart(id) {
      var chart = this.charts[id];
      if (chart) chart.update();
    }
  }, {
    key: 'chartTableHTML',
    value: function chartTableHTML(options) {
      var html = '<table class="aria-table">';
      if (options.title) html += '<caption>' + options.title + '</caption>';
      html += '<thead><tr><th>' + options.xLabel + '</th>' + ('<th>' + options.yLabel + '</th></tr></thead><tbody>');

      var series = void 0,
          labels = void 0;
      if (options.series.length === 1) {
        series = options.series[0];
        labels = new Array(series.length).fill(0).map(function (v, i) {
          return i + 1;
        });
      } else {
        series = options.series;
        labels = options.labels;
      }

      for (var i = 0; i < labels.length; i++) {
        html += '<tr><td>' + labels[i] + '</td>' + ('<td>' + Math.round(series[i]) + '</td></tr>');
      }

      html += '</tbody></table>';
      return html;
    }
  }]);

  return ExploreCharts;
}();

var ExploreDemographics = function () {
  function ExploreDemographics(charts) {
    _classCallCheck(this, ExploreDemographics);

    this.charts = new ExploreCharts();
    this.state = {
      chartView: 'users'
    };
    this.data = bikemoves.data;
    this.init();
  }

  _createClass(ExploreDemographics, [{
    key: 'init',
    value: function init() {
      var _this = this;

      var data = this.data.demographics,
          viewButtons = document.querySelectorAll('#stats li');
      viewButtons.forEach(function (button) {
        var link = button.querySelector('a'),
            value = button.querySelector('.value'),
            statName = button.className;

        value.innerHTML = _this.formatNumber(_this.getStatTotal(data, statName), 0);
        link.addEventListener('click', function (e) {
          e.preventDefault();
          _this.state.chartView = statName;
          _this.showStatCharts();
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

      var chart = this.charts.drawChart({
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

      chart.off('draw');

      chart.on('draw', function (data) {
        if (data.type !== 'bar') return;
        var node = data.element._node;
        node.setAttribute('class', node.getAttribute('class') + ' ct-bar-' + labels[data.seriesIndex].toLowerCase().replace(/ /g, '-'));
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

      var chart = this.charts.drawChart({
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
  }]);

  return ExploreDemographics;
}();

var ExploreData = function () {
  function ExploreData() {
    _classCallCheck(this, ExploreData);

    this.charts = new ExploreCharts();
    this.state = {
      mapView: 'users'
    };
    this.data = bikemoves.data;
    this.continuousColors = ['#bd0026', '#f03b20', '#fd8d3c', '#fecc5c', '#ffffb2'];
    this.divergingColors = ['#d7191c', '#fdae61', '#ffffbf', '#abd9e9', '#2c7bb6'];
    this.edgeLayer = 'explore-edge';
    this.pathLayer = 'bikemoves-bike-path';
    this.pathShadowLayer = 'bikemoves-bike-path-shadow';
    this.rackLayer = 'bikemoves-bike-rack';
    this.init();
  }

  _createClass(ExploreData, [{
    key: 'init',
    value: function init() {
      var _this2 = this;

      mapboxgl.accessToken = this.data.mapboxToken;
      this.map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mapbox/dark-v9',
        center: [-88.227203, 40.109403],
        zoom: 13,
        minZoom: 12,
        maxZoom: 17
      });

      this.map.on('load', function () {
        _this2.addMapLayers();
        _this2.initMapEvents();
      });

      this.initMapControls();
    }
  }, {
    key: 'absoluteURL',
    value: function absoluteURL(url) {
      return location.protocol + '//' + location.hostname + (location.port ? ':' + location.port : '') + url;
    }
  }, {
    key: 'initMapControls',
    value: function initMapControls() {
      var _this3 = this;

      var toggle = document.getElementById('toggle-map-controls');
      toggle.addEventListener('click', function (e) {
        return _this3.toggleMapConrols(toggle);
      });
      if (document.body.clientWidth >= 768) this.toggleMapConrols(toggle);
      this.initMapViewSelect();
    }
  }, {
    key: 'toggleMapConrols',
    value: function toggleMapConrols(button) {
      var active = button.className !== 'active';
      button.className = active ? 'active' : 'inactive';
      document.getElementById('map-controls').style.display = active ? 'block' : 'none';
      if (active) this.charts.redrawChart('edge-color');
    }
  }, {
    key: 'initMapViewSelect',
    value: function initMapViewSelect() {
      var _this4 = this;

      // Apply styleSelect.
      styleSelect('#select-map-view');

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
      var viewName = this.state.mapView,
          defaults = {
        'line-width': {
          stops: [[12, 2], [15, 10]]
        },
        'line-color': '#dddddd'
      },
          props = {};

      if (viewName === 'users') {
        props = {
          'line-color': {
            type: 'interval',
            property: 'users',
            stops: this.getStops('users', this.continuousColors)
          }
        };
      } else if (viewName === 'trips') {
        props = {
          'line-color': {
            type: 'interval',
            property: 'trips',
            stops: this.getStops('trips', this.continuousColors)
          }
        };
      } else if (viewName === 'speed') {
        props = {
          'line-color': {
            type: 'interval',
            property: 'mean_speed',
            stops: this.getStops('speed', this.continuousColors)
          }
        };
      } else if (viewName === 'preference') {
        props = {
          'line-color': {
            type: 'interval',
            property: 'preference',
            stops: this.getStops('preference', this.divergingColors)
          }
        };
      };

      return Object.assign(defaults, props);
    }
  }, {
    key: 'addMapLayers',
    value: function addMapLayers() {
      this.map.addSource('bikemoves', {
        type: 'vector',
        url: 'https://tileserver.bikemoves.me/tiles/bikemoves.json'
      });

      this.map.addSource('explore', {
        type: 'vector',
        tilejson: '2.2.0',
        name: 'bikemoves-explore',
        description: 'Map data for the BikeMoves Explore web app.',
        version: '1.0.0',
        attribution: '<a href="https://ccrpc.org/">&copy; CCRPC</a>',
        scheme: 'xyz',
        minzoom: 12,
        maxzoom: 15,
        tiles: [this.absoluteURL('/explore/{z}/{x}/{y}.mvt')]
      });

      this.map.addLayer({
        id: this.edgeLayer,
        type: 'line',
        source: 'explore',
        'source-layer': 'edge',
        filter: this.getMapLayerFilter(),
        paint: this.getMapViewPaintProperties(),
        layout: {
          'line-cap': 'round'
        }
      }, 'road-label-small');

      this.map.addLayer({
        id: this.pathLayer,
        type: 'line',
        source: 'bikemoves',
        'source-layer': 'bike_path',
        paint: {
          'line-color': '#ffffff',
          'line-dasharray': [2, 2],
          'line-width': {
            stops: [[12, 0.5], [15, 2.5]]
          }
        }
      }, 'road-label-small');

      this.map.addLayer({
        id: this.pathShadowLayer,
        type: 'line',
        source: 'bikemoves',
        'source-layer': 'bike_path',
        paint: {
          'line-color': '#000000',
          'line-dasharray': [0, 2, 2],
          'line-width': {
            stops: [[12, 0.5], [15, 2.5]]
          }
        }
      }, 'road-label-small');

      this.map.addLayer({
        id: this.rackLayer,
        type: 'circle',
        source: 'bikemoves',
        'source-layer': 'bike_rack',
        paint: {
          'circle-radius': {
            base: 1,
            stops: [[13, 2], [20, 6]]
          },
          'circle-color': '#ffffff',
          'circle-stroke-color': '#000000',
          'circle-stroke-width': {
            stops: [[12, 0.25], [15, 1.5]]
          }
        }
      }, 'road-label-small');

      this.initLayerToggle('legend-item-bike-rack', [this.rackLayer]);
      this.initLayerToggle('legend-item-bike-path', [this.pathLayer, this.pathShadowLayer]);

      this.drawLegend();
    }
  }, {
    key: 'initLayerToggle',
    value: function initLayerToggle(id, layerNames) {
      var _this5 = this;

      document.getElementById(id).addEventListener('change', function (e) {
        return layerNames.forEach(function (layerName) {
          return _this5.map.setLayoutProperty(layerName, 'visibility', e.target.checked ? 'visible' : 'none');
        });
      });
    }
  }, {
    key: 'initMapEvents',
    value: function initMapEvents() {
      var _this6 = this;

      this.map.on('mouseenter', this.edgeLayer, function () {
        return _this6.map.getCanvas().style.cursor = 'pointer';
      });

      this.map.on('mouseleave', this.edgeLayer, function () {
        return _this6.map.getCanvas().style.cursor = '';
      });

      this.map.on('click', this.edgeLayer, function (e) {
        var feature = e.features[0];
        if (!feature) return;

        var midpoint = turf.along(feature.geometry, turf.lineDistance(feature.geometry) * 0.5);

        new mapboxgl.Popup().setLngLat(midpoint.geometry.coordinates).setHTML(_this6.formatFeatureProperties(feature.properties)).addTo(_this6.map);

        _this6.map.easeTo({
          center: midpoint.geometry.coordinates
        });
      });
    }
  }, {
    key: 'formatFeatureProperties',
    value: function formatFeatureProperties(props) {
      return '<h2>Segment Details</h2>\n      <table>\n        <thead><tr><th>Property</th><th>Value</th></tr></thead>\n        <tbody>\n          <tr><td>Users</td><td>' + props.users + '</td></tr>\n          <tr><td>Trips</td><td>' + props.trips + '</td></tr>\n          <tr><td>Average Speed</td><td>' + props.mean_speed.toFixed(1) + ' MPH</td></tr>\n          <tr><td>Preference</td><td>' + props.preference + '</td></tr>\n        </tbody>\n      </table>';
    }
  }, {
    key: 'getMapLayerFilter',
    value: function getMapLayerFilter() {
      if (this.state.mapView === 'preference') {
        var exclude = this.data.statistics['preference'].stops[2];

        return ['any', ['>=', 'preference', exclude.upper], ['<', 'preference', exclude.lower]];
      }
      return ['>', 'users', 0];
    }
  }, {
    key: 'updateMapView',
    value: function updateMapView() {
      var props = this.getMapViewPaintProperties();
      for (var propName in props) {
        this.map.setPaintProperty(this.edgeLayer, propName, props[propName]);
      }this.map.setFilter(this.edgeLayer, this.getMapLayerFilter());
      this.drawLegend();
    }
  }, {
    key: 'drawLegendChart',
    value: function drawLegendChart(chartId, propName, title, xLabel, yLabel, values, exclude) {
      exclude = exclude || [];
      values = values.filter(function (v, i) {
        return exclude.indexOf(i) === -1;
      });
      var stats = this.data.statistics[propName],
          labels = stats.stops.map(function (stop) {
        if (stop.upper === stop.lower + 1) return stop.lower.toString();
        return stop.lower + ' to ' + (stop.upper - 1);
      }).filter(function (v, i) {
        return exclude.indexOf(i) === -1;
      }),
          series = stats.stops.map(function (stop) {
        return stop.count;
      }).filter(function (v, i) {
        return exclude.indexOf(i) === -1;
      });

      var chart = this.charts.drawChart({
        id: chartId,
        title: title,
        cssClass: 'ct-octave',
        headingLevel: 3,
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

      chart.off('draw');

      chart.on('draw', function (data) {
        if (data.type !== 'bar') return;
        var value = values[data.index],
            cssProp = isNaN(value) ? 'stroke' : 'stroke-width';

        data.element._node.style[cssProp] = value;
      });

      chart.update();
    }
  }, {
    key: 'drawLegend',
    value: function drawLegend() {
      var viewName = this.state.mapView;

      document.querySelectorAll('.view-info').forEach(function (el) {
        return el.style.display = 'none';
      });
      document.querySelectorAll('.view-info.info-' + viewName).forEach(function (el) {
        return el.style.display = 'block';
      });

      if (viewName === 'users') {
        this.drawLegendChart('edge-color', 'users', 'Users', 'Users', 'Miles', this.continuousColors);
      } else if (viewName === 'trips') {
        this.drawLegendChart('edge-color', 'trips', 'Trips', 'Trips', 'Miles', this.continuousColors);
      } else if (viewName === 'speed') {
        this.drawLegendChart('edge-color', 'speed', 'Average Speed', 'MPH', 'Miles', this.continuousColors);
      } else if (viewName === 'preference') {
        this.drawLegendChart('edge-color', 'preference', 'Preference', 'Net Trips', 'Miles', this.divergingColors, [2]);
      }
    }
  }]);

  return ExploreData;
}();

document.querySelector('article').id === 'demographics' ? new ExploreDemographics() : new ExploreData();