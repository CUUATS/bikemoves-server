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
        console.log(data);
        _this.initChartViews(data);
      });
    }
  }, {
    key: 'initChartViews',
    value: function initChartViews(data) {
      var _this2 = this;

      var viewButtons = document.querySelectorAll('#stats li');
      viewButtons.forEach(function (button) {
        var link = button.querySelector('a'),
            value = button.querySelector('.value'),
            statName = button.className;

        value.innerHTML = _this2.formatNumber(_this2.getStatTotal(data, statName), 0);
        link.addEventListener('click', function (e) {
          e.preventDefault();
          _this2.showStatCharts(statName);
        });
        if (statName === _this2.state.chartView) _this2.showStatCharts(statName);
      });
    }
  }, {
    key: 'showStatCharts',
    value: function showStatCharts(statName) {
      document.querySelectorAll('#stats li a').forEach(function (link) {
        link.className = link.parentNode.className === statName ? 'active' : '';
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
        req.onreadystatechange = function () {
          if (this.readyState == 4 && this.status == 200) resolve(JSON.parse(this.responseText));
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