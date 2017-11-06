const Clusterize = require('clusterize.js');
const mapboxgl = require('mapbox-gl');
const moment = require('moment');
const styleSelect = require('styleselect');
const Taggle = require('taggle');
const turf = {
  along: require('@turf/along'),
  bbox: require('@turf/bbox'),
  lineDistance: require('@turf/line-distance')
};
const Charts = require('./charts.js');
const FilterParser = require('../filters.js');
const utils = require('./utils.js');

const STATISTICS_ENDPOINT = '/api/v1/statistics';
const TRIPS_ENDPOINT = '/api/v1/trips';

const OD_TYPES = [
  'Not Specified',
  'Home',
  'Work',
  'K-12 School',
  'University',
  'Shopping',
  'Other'
];

const CONTINUOUS_COLORS = [
  '#bd0026',
  '#f03b20',
  '#fd8d3c',
  '#fecc5c',
  '#ffffb2'
];

const DIVERGING_COLORS = [
  '#d7191c',
  '#fdae61',
  '#ffffbf',
  '#abd9e9',
  '#2c7bb6'
];

const EMPTY_FEATURE_COLLECTION = {
  type: 'FeatureCollection',
  features: []
};

const TRIP_SOURCE = 'explore-trip';
const POINT_SOURCE = 'explore-point';
const LEG_SOURCE = 'explore-leg';
const TRACEPOINT_SOURCE = 'explore-tracepoint';
const GEOJSON_SOURCES = [
  TRIP_SOURCE,
  POINT_SOURCE,
  LEG_SOURCE,
  TRACEPOINT_SOURCE
];

const PATH_LAYER = 'bikemoves-bike-path';
const PATH_SHADOW_LAYER = 'bikemoves-bike-path-shadow';
const RACK_LAYER = 'bikemoves-bike-rack';
const EDGE_LAYER = 'explore-edge';
const TRIP_LAYER = 'explore-trip';
const POINT_LAYER = 'explore-point';
const FASTEST_LAYER = 'explore-leg-fastest';
const LEG_LAYER = 'explore-leg';
const TRACEPOINT_LAYER = 'explore-tracepoint';
const TRIP_LAYERS = [
  TRIP_LAYER,
  POINT_LAYER,
  FASTEST_LAYER,
  LEG_LAYER,
  TRACEPOINT_LAYER
];

class Map {
  constructor() {
    this.charts = new Charts();
    this.state = {
      mapView: 'users',
      trip: null
    };
    this.statistics = [];
    this.trips = {};
    this.mapLoaded = false;
    this.init();
  }

  init() {
    mapboxgl.accessToken = bikemoves.config.mapboxToken;
    this.map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mapbox/dark-v9',
        center: [-88.227203, 40.109403],
        zoom: 13,
        minZoom: 12,
        maxZoom: 17
    });

    let updateStats = this.updateStatistics();
    let mapLoad = new Promise(
      (resolve, reject) => this.map.on('load', resolve));

    Promise.all([updateStats, mapLoad]).then(() => {
      this.addMapLayers();
      this.initMapEvents();
      this.mapLoaded = true;
    });

    this.initMapControls();
    this.initFilters();
    this.initTripsTable();
  }

  initMapControls() {
    let toggle = document.getElementById('toggle-map-controls');
    toggle.addEventListener('click', (e) => {
      e.preventDefault();
      this.toggleMapConrols();
    });
    if (document.body.clientWidth >= 768) this.toggleMapConrols();
    this.initMapViewSelect();
  }

  toggleMapConrols() {
    let container = document.getElementById('map-controls-container'),
      active = container.className !== 'active';
    container.className = (active) ? 'active' : '';
    if (active) this.charts.redrawChart('edge-color');
  }

  initMapViewSelect() {
    // Apply styleSelect.
    styleSelect('#select-map-view');

    let select = document.getElementById('select-map-view');
    select.addEventListener('change', (e) => {
      let viewName = select.options[select.selectedIndex].value;
      if (this.state.mapView === viewName) return;
      this.state.mapView = viewName;
      this.updateMapView();
    });
  }

  getStops(propName, values) {
    return this.statistics[propName].stops
      .map((stop, i) => [stop.lower, values[i]]);
  }

  getMapViewPaintProperties() {
    let viewName = this.state.mapView,
      defaults = {
        'line-width': {
          stops: [
            [12, 2],
            [15, 10]
          ]
        },
        'line-color': '#dddddd'
      },
      props = {};

    if (viewName === 'users') {
      props = {
        'line-color': {
          type: 'interval',
          property: 'users',
          stops: this.getStops('users', CONTINUOUS_COLORS)
        }
      };
    } else if (viewName === 'trips') {
      props = {
        'line-color': {
          type: 'interval',
          property: 'trips',
          stops: this.getStops('trips', CONTINUOUS_COLORS)
        }
      };
    } else if (viewName === 'speed') {
      props = {
        'line-color': {
          type: 'interval',
          property: 'mean_speed',
          stops: this.getStops('speed', CONTINUOUS_COLORS)
        }
      };
    } else if (viewName === 'preference') {
      props = {
        'line-color': {
          type: 'interval',
          property: 'preference',
          stops: this.getStops('preference', DIVERGING_COLORS)
        }
      };
    };

    return Object.assign(defaults, props);
  }

  addTileSource() {
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
      tiles: [
         this.getTilesURL()
      ]
    });
  }

  addGeoJSONSources() {
    GEOJSON_SOURCES.forEach((name) => {
      this.map.addSource(name, {
        type: 'geojson',
        data: EMPTY_FEATURE_COLLECTION
      });
    });
  }

  getGeoJSONData(src) {
    if (!this.state.trip) return Promise.resolve(EMPTY_FEATURE_COLLECTION);
    let url = TRIPS_ENDPOINT +
      `/${this.state.trip.id}/` + `${src.replace('explore-', '')}.geojson`;
    return utils.getJSON(url);
  }

  updateGeoJSONSources() {
    GEOJSON_SOURCES.forEach((src) => {
      this.getGeoJSONData(src).then((data) => {
        this.map.getSource(src).setData(data);
        if (src === TRIP_SOURCE && data.features.length &&
            this.state.mapView === 'details') {
          let bbox = turf.bbox(data);
          this.map.fitBounds(bbox, {
            padding: 20
          });
        }
      })
    });
  }

  addMapLayers() {
    this.map.addSource('bikemoves', {
      type: 'vector',
      url: 'https://tileserver.bikemoves.me/tiles/bikemoves.json'
    });

    this.addTileSource();
    this.addGeoJSONSources();

    this.map.addLayer({
      id: EDGE_LAYER,
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
      id: TRIP_LAYER,
      type: 'line',
      source: TRIP_SOURCE,
      paint: {
        'line-color': '#999999',
        'line-width': 3
      }
    }, 'road-label-small');

    this.map.addLayer({
      id: POINT_LAYER,
      type: 'circle',
      source: POINT_SOURCE,
      paint: {
        'circle-color': '#999999',
        'circle-radius': 5
      }
    }, 'road-label-small');

    this.map.addLayer({
      id: FASTEST_LAYER,
      type: 'line',
      source: LEG_SOURCE,
      filter: ['==', 'routeType', 'Fastest'],
      paint: {
        'line-color': '#96539b',
        'line-dasharray': [1, 0.5],
        'line-width': 4
      }
    }, 'road-label-small');

    this.map.addLayer({
      id: LEG_LAYER,
      type: 'line',
      source: LEG_SOURCE,
      filter: ['==', 'routeType', 'Match'],
      paint: {
        'line-color': {
          type: 'interval',
          property: 'speed',
          stops: [
            [1, '#2c7bb6'],
            [2, '#abd9e9'],
            [3, '#ffffbf'],
            [4, '#fdae61'],
            [5, '#d7191c']
          ]
        },
        'line-width': 6
      }
    }, 'road-label-small');

    this.map.addLayer({
      id: TRACEPOINT_LAYER,
      type: 'circle',
      source: TRACEPOINT_SOURCE,
      paint: {
        'circle-color': '#FFFFFF',
        'circle-radius': 5,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#000000'
      }
    }, 'road-label-small');

    this.map.addLayer({
      id: PATH_LAYER,
      type: 'line',
      source: 'bikemoves',
      'source-layer': 'bike_path',
      paint: {
        'line-color': '#ffffff',
        'line-dasharray': [2, 2],
        'line-width': {
          stops: [
            [12, 0.5],
            [15, 2.5]
          ]
        }
      }
    }, 'road-label-small');

    this.map.addLayer({
      id: PATH_SHADOW_LAYER,
      type: 'line',
      source: 'bikemoves',
      'source-layer': 'bike_path',
      paint: {
        'line-color': '#000000',
        'line-dasharray': [0, 2, 2],
        'line-width': {
          stops: [
            [12, 0.5],
            [15, 2.5]
          ]
        }
      }
    }, 'road-label-small');

    this.map.addLayer({
      id: RACK_LAYER,
      type: 'circle',
      source: 'bikemoves',
      'source-layer': 'bike_rack',
      paint: {
        'circle-radius': {
          base: 1,
          stops: [
            [13, 2],
            [20, 6]
          ]
        },
        'circle-color': '#ffffff',
        'circle-stroke-color': '#000000',
        'circle-stroke-width': {
          stops: [
            [12, 0.25],
            [15, 1.5]
          ]
        }
      }
    }, 'road-label-small');

    this.initLayerToggle('legend-item-bike-rack', [RACK_LAYER]);
    this.initLayerToggle('legend-item-bike-path',
      [PATH_LAYER, PATH_SHADOW_LAYER]);

    this.drawLegend();
  }

  initLayerToggle(id, layerNames) {
    document.getElementById(id).addEventListener('change', (e) =>
      layerNames.forEach((layerName) =>
        this.map.setLayoutProperty(layerName, 'visibility',
          (e.target.checked) ? 'visible' : 'none')));
  }

  initMapEvents() {
    this.map.on('mouseenter', EDGE_LAYER, () =>
      this.map.getCanvas().style.cursor = 'pointer');

    this.map.on('mouseleave', EDGE_LAYER, () =>
      this.map.getCanvas().style.cursor = '');

    this.map.on('click', EDGE_LAYER, (e) => {
      let feature = e.features[0];
      if (!feature) return;

      let midpoint = turf.along(feature.geometry,
        turf.lineDistance(feature.geometry) * 0.5);

      new mapboxgl.Popup()
        .setLngLat(midpoint.geometry.coordinates)
        .setHTML(this.formatFeatureProperties(feature.properties))
        .addTo(this.map);

      this.map.easeTo({
        center: midpoint.geometry.coordinates
      });
    });
  }

  updateStatistics() {
    return utils.getJSON(STATISTICS_ENDPOINT + this.getFiltersQueryString())
      .then((res) => this.statistics = res.statistics);
  }

  parseFilters() {
    let filters = (!this.filters) ? [] : this.filters.getTags().values;
    return new FilterParser(filters);
  }

  getFiltersQueryString() {
    let parser = this.parseFilters();
    return parser.querystring();
  }

  getTilesURL() {
    return utils.absoluteURL(
      '/explore/{z}/{x}/{y}.mvt' + this.getFiltersQueryString());
  }

  filtersChanged() {
    let parser = this.parseFilters();
    this.setActiveTrip(parser.tripId());

    let updateStats = this.updateStatistics();
    if (this.mapLoaded) {
      this.map.removeSource('explore');
      this.addTileSource();
      updateStats.then(() => this.updateMapView());
    }
  }

  initFilters() {
    let el = document.getElementById('filters');
    if (!el) return;

    this.filters = new Taggle('filters', {
      placeholder: 'Enter filters...',
      submitKeys: [9, 13],
      onBeforeTagAdd: (e, tag) => FilterParser.validate(tag),
      onTagAdd: (e, tag) => this.filtersChanged(),
      onTagRemove: (e, tag) => this.filtersChanged()
    });

    document.getElementById('clear-filters')
      .addEventListener('click', (e) => {
        e.preventDefault();
        if (this.filters) this.filters.removeAll();
      });

    this.initMapPaneToggle('filter-help', 'toggle-filter-help');
  }

  getPaneActive(pane) {
    return / active/.test(pane.className);
  }

  setPaneActive(pane, active) {
    if (this.getPaneActive(pane) === active) return;
    pane.className = (active) ?
      pane.className + ' active' :
      pane.className.replace(/ active/, '');

    if (pane.id === 'trips-list' && active) this.updateTripsTable();
  }

  toggleMapPane(id, active) {
    document.querySelectorAll('.map-pane').forEach((pane) => {
      if (pane.id !== id) {
        this.setPaneActive(pane, false);
      } else {
        this.setPaneActive(pane,
          (active === undefined) ? !this.getPaneActive(pane) : active);
      }
    });
  }

  initMapPaneToggle(paneId, toggleClass) {
    document.querySelectorAll('.' + toggleClass).forEach((a) => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        this.toggleMapPane(paneId);
      });
    });
  }

  formatFeatureProperties(props) {
    return `<h2>Segment Details</h2>
      <table>
        <thead><tr><th>Property</th><th>Value</th></tr></thead>
        <tbody>
          <tr><td>Users</td><td>${props.users}</td></tr>
          <tr><td>Trips</td><td>${props.trips}</td></tr>
          <tr><td>Average Speed</td><td>${props.mean_speed.toFixed(1)} MPH</td></tr>
          <tr><td>Preference</td><td>${props.preference}</td></tr>
        </tbody>
      </table>`;
  }

  getMapLayerFilter() {
    if (this.state.mapView === 'preference') {
      let exclude = this.statistics['preference'].stops[2];
      if (exclude === undefined) return ['>', 'users', 0];

      return ['any',
        ['>=', 'preference', exclude.upper],
        ['<', 'preference', exclude.lower]
      ];
    }
    return ['>', 'users', 0];
  }

  setMapView(view) {
    if (this.state.mapView === view) return;
    let select = document.getElementById('select-map-view');
    select.value = view;
    document.querySelectorAll('div.ss-option').forEach((opt) => {
      if (opt.dataset.value !== view) return;
      opt.dispatchEvent(new MouseEvent('click'));
    })
  }

  updateMapView() {
    let props = this.getMapViewPaintProperties();
    for (let propName in props) {
      let value = props[propName];
      if (value.stops && value.stops.length === 0) continue;
      this.map.setPaintProperty(EDGE_LAYER, propName, value);
    }

    this.map.setFilter(EDGE_LAYER, this.getMapLayerFilter());
    this.drawLegend();

    let detailsView = this.state.mapView === 'details';
    this.map.setLayoutProperty(EDGE_LAYER, 'visibility',
      (detailsView) ? 'none' : 'visible');
    TRIP_LAYERS.forEach((layer) => {
      this.map.setLayoutProperty(layer, 'visibility',
        (detailsView) ? 'visible' : 'none');
    });

    if (this.state.mapView === 'details' && !this.state.trip)
      this.toggleMapPane('trips-list', true);
  }

  drawLegendChart(chartId, propName, title, xLabel, yLabel, values, exclude) {
    exclude = exclude || [];
    values = values.filter((v, i) => exclude.indexOf(i) === -1);
    let stats = this.statistics[propName],
      labels = stats.stops.map((stop) => {
        if (stop.upper === stop.lower + 1) return stop.lower.toString();
        return `${stop.lower} to ${stop.upper - 1}`;
      }).filter((v, i) => exclude.indexOf(i) === -1),
      series = stats.stops.map((stop) => stop.count)
        .filter((v, i) => exclude.indexOf(i) === -1);

    let chart = this.charts.drawChart({
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

    chart.on('draw', (data) => {
      if (data.type !== 'bar') return;
      let value = values[data.index],
        cssProp = (isNaN(value)) ? 'stroke' : 'stroke-width';

      data.element._node.style[cssProp] = value;
    });

    chart.update();
  }

  drawLegend() {
    let viewName = this.state.mapView;

    document.querySelectorAll('.view-info')
      .forEach((el) => el.style.display = 'none');
    document.querySelectorAll('.view-info.info-' + viewName)
      .forEach((el) => el.style.display = 'block');

    if (viewName === 'users') {
      this.drawLegendChart('edge-color', 'users', 'Users', 'Users',
        'Miles', CONTINUOUS_COLORS);
    } else if (viewName === 'trips') {
      this.drawLegendChart('edge-color', 'trips', 'Trips', 'Trips',
        'Miles', CONTINUOUS_COLORS);
    } else if (viewName === 'speed') {
      this.drawLegendChart('edge-color', 'speed', 'Average Speed', 'MPH',
        'Miles', CONTINUOUS_COLORS);
    } else if (viewName === 'preference') {
      this.drawLegendChart('edge-color', 'preference', 'Preference',
        'Net Trips', 'Miles', DIVERGING_COLORS, [2]);
    }
  }

  getTableRows() {
    return Object.values(this.trips).map((trip) => {
      let start = moment(trip.startTime),
        end = moment(trip.endTime),
        row = [
          trip.id,
          start.format('M/D/YYYY'),
          start.format('h:mm:ss a'),
          utils.formatDuration(moment.duration(end.diff(start))),
          trip.distance.toFixed(2) + ' mi',
          OD_TYPES[trip.origin],
          OD_TYPES[trip.destination],
          trip.userId
        ];

      let attrs = `id="trip-${trip.id}"`;
      if (this.state.trip && this.state.trip.id === trip.id)
        attrs += ' class="selected"';

    return `<tr ${attrs}><td>${row.join('</td><td>')}</td></tr>`;
    });
  }

  setActiveTrip(tripId) {
    let currentId = (this.state.trip) ? this.state.trip.id : null;
    if (currentId !== tripId) {
      this.state.trip = (tripId === null) ? null : this.trips[tripId];
      this.updateGeoJSONSources();
      if (tripId !== null) this.toggleMapPane('trips-list', false);
      if (tripId !== null && this.state.mapView !== 'details')
        this.setMapView('details');
    }
  }

  updateTripsTable() {
    if (!this.clusterize) return;
    this.clusterize.update(this.getTableRows());
  }

  initTripsTable() {
    let content = document.getElementById('trips-content');
    if (!content) return;

    utils.getJSON(TRIPS_ENDPOINT).then((res) => {
      res.trips.forEach((trip) => this.trips[trip.id] = trip);
      this.clusterize = new Clusterize({
        rows: this.getTableRows(),
        scrollId: 'trips-scroll',
        contentId: 'trips-content'
      });
    });

    content.addEventListener('click', (e) => {
      if (e.target.nodeName != 'TD') return;
      let tripId = parseInt(e.target.parentNode.childNodes[0].textContent);
      if (!isNaN(tripId)) {
        if (this.filters) {
          this.filters.removeAll();
          this.filters.add([`trip=${tripId}`]);
        }
      }
    });

    this.initMapPaneToggle('trips-list', 'toggle-trips-list');
  }
}

module.exports = Map;
