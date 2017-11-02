const turf = {
  along: require('@turf/along'),
  lineDistance: require('@turf/line-distance')
};
const mapboxgl = require('mapbox-gl');
const styleSelect = require('styleselect');
const Taggle = require('taggle');
const Charts = require('./charts.js');
const FilterParser = require('../filters.js');

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

const EDGE_LAYER = 'explore-edge';
const PATH_LAYER = 'bikemoves-bike-path';
const PATH_SHADOW_LAYER = 'bikemoves-bike-path-shadow';
const RACK_LAYER = 'bikemoves-bike-rack';

class Map {
  constructor(data) {
    this.charts = new Charts();
    this.state = {
      mapView: 'users'
    };
    this.data = data;
    this.mapLoaded = false;
    this.init();
  }

  init() {
    mapboxgl.accessToken = this.data.mapboxToken;
    this.map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mapbox/dark-v9',
        center: [-88.227203, 40.109403],
        zoom: 13,
        minZoom: 12,
        maxZoom: 17
    });

    this.map.on('load', () => {
      this.addMapLayers();
      this.initMapEvents();
      this.mapLoaded = true;
    });

    this.initMapControls();
    this.initFilters();
  }

  absoluteURL(url) {
    return location.protocol + '//' + location.hostname + (
      location.port ? ':' + location.port : '') + url;
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
    return this.data.statistics[propName].stops
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

  addMapLayers() {
    this.map.addSource('bikemoves', {
      type: 'vector',
      url: 'https://tileserver.bikemoves.me/tiles/bikemoves.json'
    });

    this.addTileSource();

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

  getTilesURL() {
    let filters = (!this.filters) ? [] : this.filters.getTags().values;
    let parser = new FilterParser(filters);
    return this.absoluteURL('/explore/{z}/{x}/{y}.mvt' + parser.querystring());
  }

  filtersChanged() {
    if (this.mapLoaded) {
      this.map.removeSource('explore');
      this.addTileSource();
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
      let exclude = this.data.statistics['preference'].stops[2];

      return ['any',
        ['>=', 'preference', exclude.upper],
        ['<', 'preference', exclude.lower]
      ];
    }
    return ['>', 'users', 0];
  }

  updateMapView() {
    let props = this.getMapViewPaintProperties();
    for (let propName in props)
      this.map.setPaintProperty(EDGE_LAYER, propName, props[propName]);
    this.map.setFilter(EDGE_LAYER, this.getMapLayerFilter());
    this.drawLegend();
  }

  drawLegendChart(chartId, propName, title, xLabel, yLabel, values, exclude) {
    exclude = exclude || [];
    values = values.filter((v, i) => exclude.indexOf(i) === -1);
    let stats = this.data.statistics[propName],
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
}

module.exports = Map;
