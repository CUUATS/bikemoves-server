'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Examine = function () {
  function Examine() {
    _classCallCheck(this, Examine);

    this.state = {};
    this.data = {};
    this.layerNames = ['trips', 'points', 'legs', 'tracepoints'];
    this.locationTypes = ['Not Specified', 'Home', 'Work', 'K-12 School', 'University', 'Shopping', 'Other'];
    this.initMap();
    this.initTable();
  }

  _createClass(Examine, [{
    key: 'initMap',
    value: function initMap() {
      var _this = this;

      this.map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mapbox/light-v9',
        center: [-88.227203, 40.109403],
        zoom: 13
      });
      this.map.on('load', function () {
        _this.addSources();
        _this.addLayers();
      });
    }
  }, {
    key: 'addSources',
    value: function addSources() {
      var _this2 = this;

      this.layerNames.forEach(function (name) {
        _this2.map.addSource(name, {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: []
          }
        });
      });
    }
  }, {
    key: 'addLayers',
    value: function addLayers() {
      var _this3 = this;

      this.map.addLayer({
        id: 'bikemoves-trips',
        type: 'line',
        source: 'trips',
        paint: {
          'line-color': '#999999',
          'line-width': 3
        }
      }, 'road-label-small');
      this.map.addLayer({
        id: 'bikemoves-points',
        type: 'circle',
        source: 'points',
        paint: {
          'circle-color': '#999999',
          'circle-radius': 5
        }
      }, 'road-label-small');
      this.map.addLayer({
        id: 'bikemoves-legs-fastest',
        type: 'line',
        source: 'legs',
        filter: ['==', 'routeType', 'Fastest'],
        paint: {
          'line-color': '#96539b',
          'line-dasharray': [1, 0.5],
          'line-width': 4
        }
      }, 'road-label-small');
      this.map.addLayer({
        id: 'bikemoves-legs',
        type: 'line',
        source: 'legs',
        filter: ['==', 'routeType', 'Match'],
        paint: {
          'line-color': {
            type: 'interval',
            property: 'speed',
            stops: [[1, '#2c7bb6'], [2, '#abd9e9'], [3, '#ffffbf'], [4, '#fdae61'], [5, '#d7191c']]
          },
          'line-width': 6
        }
      }, 'road-label-small');
      this.map.addLayer({
        id: 'bikemoves-tracepoints',
        type: 'circle',
        source: 'tracepoints',
        paint: {
          'circle-color': '#FFFFFF',
          'circle-radius': 5,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#000000'
        }
      }, 'road-label-small');

      ['points', 'legs'].forEach(function (name) {
        var layerName = 'bikemoves-' + name;
        _this3.map.on('click', layerName, function (e) {
          return _this3.onLayerClick(e);
        });
        _this3.map.on('mouseenter', layerName, function () {
          return _this3.map.getCanvas().style.cursor = 'pointer';
        });
        _this3.map.on('mouseleave', layerName, function () {
          return _this3.map.getCanvas().style.cursor = '';
        });
      });
    }
  }, {
    key: 'onLayerClick',
    value: function onLayerClick(e) {
      if (!e.features.length) return;

      new mapboxgl.Popup().setLngLat(e.lngLat).setHTML(this.popupContent(e.features[0])).addTo(this.map);
    }
  }, {
    key: 'popupContent',
    value: function popupContent(feature) {
      var props = feature.properties,
          html = '<table class="popup-table"><thead><tr><th>Column</th>' + '<th>Value</th></tr></thead><tbody>';
      for (var key in props) {
        if (props.hasOwnProperty(key)) html += '<tr><td>' + key + '</td><td>' + props[key] + '</td></tr>';
      }html += '</tbody></table>';
      return html;
    }
  }, {
    key: 'populateMap',
    value: function populateMap(tripId, bbox) {
      var _this4 = this;

      this.layerNames.forEach(function (name) {
        return _this4.map.getSource(name).setData('/api/' + name + '/' + tripId + '.geojson');
      });
      this.map.fitBounds(bbox, {
        padding: 20
      });
    }
  }, {
    key: 'pad',
    value: function pad(n, w) {
      var d = n.toString();
      return d.length >= w ? d : new Array(w - d.length + 1).join('0') + d;
    }
  }, {
    key: 'formatDuration',
    value: function formatDuration(duration) {
      var hours = this.pad(duration.hours(), 2),
          minutes = this.pad(duration.minutes(), 2),
          seconds = this.pad(duration.seconds(), 2);

      return [hours, minutes, seconds].join(':');
    }
  }, {
    key: 'getTableRows',
    value: function getTableRows() {
      var _this5 = this;

      return Object.values(this.data.trips).map(function (trip) {
        var start = moment(trip.startTime),
            end = moment(trip.endTime),
            row = [trip.id, start.format('M/D/YYYY'), start.format('h:mm:ss a'), _this5.formatDuration(moment.duration(end.diff(start))), trip.distance.toFixed(2) + ' mi', _this5.locationTypes[trip.origin], _this5.locationTypes[trip.destination], trip.userId];

        var attrs = 'id="trip-' + trip.id + '"';
        if (_this5.state.trip && _this5.state.trip.id === trip.id) attrs += ' class="selected"';

        return '<tr ' + attrs + '><td>' + row.join('</td><td>') + '</td></tr>';
      });
    }
  }, {
    key: 'initTable',
    value: function initTable() {
      var _this6 = this;

      this.getJSON('/api/trips').then(function (res) {
        _this6.data.trips = {};
        res.trips.forEach(function (trip) {
          return _this6.data.trips[trip.id] = trip;
        });
        _this6.clusterize = new Clusterize({
          rows: _this6.getTableRows(),
          scrollId: 'trips-scroll',
          contentId: 'trips-content'
        });
      });

      var content = document.getElementById('trips-content');
      content.addEventListener('click', function (e) {
        if (e.target.nodeName != 'TD') return;
        var tripId = parseInt(e.target.parentNode.childNodes[0].textContent);
        if (!isNaN(tripId)) {
          _this6.state.trip = _this6.data.trips[tripId];
          _this6.populateMap(tripId, _this6.state.trip.bbox);
          _this6.clusterize.update(_this6.getTableRows());
        }
      });
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
  }]);

  return Examine;
}();

var examine = new Examine();