class Examine {
  constructor() {
    this.state = {};
    this.data = {};
    this.layerNames = ['trips', 'points', 'legs', 'tracepoints'];
    this.locationTypes = [
      'Not Specified',
      'Home',
      'Work',
      'K-12 School',
      'University',
      'Shopping',
      'Other'
    ];
    this.initMap();
    this.initTable();
  }

  initMap() {
    this.map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mapbox/light-v9',
        center: [-88.227203, 40.109403],
        zoom: 13
    });
    this.map.on('load', () => {
      this.addSources();
      this.addLayers();
    });
  }

  addSources() {
    this.layerNames.forEach((name) => {
      this.map.addSource(name, {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: []
        }
      });
    });
  }

  addLayers() {
    this.map.addLayer({
      id: 'bikemoves-trips',
      type: 'line',
      source: 'trips',
      paint: {
        'line-color': '#999999',
        'line-width': 3
      },
      layout: {
        'line-cap': 'round'
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
      id: 'bikemoves-legs',
      type: 'line',
      source: 'legs',
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
      },
      layout: {
        'line-cap': 'round'
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

    ['points', 'legs'].forEach((name) => {
      let layerName = `bikemoves-${name}`;
      this.map.on('click', layerName, (e) => this.onLayerClick(e));
      this.map.on('mouseenter', layerName, () =>
        this.map.getCanvas().style.cursor = 'pointer');
      this.map.on('mouseleave', layerName, () =>
        this.map.getCanvas().style.cursor = '');
    });
  }

  onLayerClick(e) {
    if (!e.features.length) return;

    new mapboxgl.Popup()
      .setLngLat(e.lngLat)
      .setHTML(this.popupContent(e.features[0]))
      .addTo(this.map);
  }

  popupContent(feature) {
    let props = feature.properties,
      html = '<table class="popup-table"><thead><tr><th>Column</th>' +
        '<th>Value</th></tr></thead><tbody>';
    for (var key in props) if (props.hasOwnProperty(key))
      html += '<tr><td>' + key + '</td><td>' + props[key] + '</td></tr>';

    html += '</tbody></table>'
    return html;
  }

  populateMap(tripId, bbox) {
    this.layerNames.forEach((name) =>
      this.map.getSource(name).setData(`/api/${name}/${tripId}.geojson`));
    this.map.fitBounds(bbox, {
      padding: 20
    });
  }

  makeRow(values) {
    var row = document.createElement('tr');
    values.forEach(function(value) {
      var cell = document.createElement('td'),
        content = document.createTextNode(value);
      cell.appendChild(content);
      row.appendChild(cell);
    });
    return row;
  }

  initTable() {
    let table = document.getElementById('trips'),
      tbody = document.createElement('tbody');
    table.appendChild(tbody);

    this.getJSON('/api/trips').then((res) => {
      res.trips.forEach((trip) => {
        var start = new Date(trip.startTime),
          end = new Date(trip.endTime);
        var row = this.makeRow([
          trip.id,
          start.toLocaleString(),
          Math.round((trip.endTime - trip.startTime)/1000),
          trip.distance.toFixed(2),
          this.locationTypes[trip.origin],
          this.locationTypes[trip.destination],
          trip.userId
        ]);
        row.addEventListener('click', () =>
          this.populateMap(trip.id, trip.bbox));
        tbody.appendChild(row);
      });
    });
  }

  getJSON(url) {
    return new Promise((resolve, reject) => {
      let req = new XMLHttpRequest();
      req.onload = () => {
        if (req.status >= 200 && req.status < 300) {
          resolve(JSON.parse(req.response));
        } else {
          reject(req.statusText);
        }
      };
      req.onerror = () => reject(req.statusText);
      req.open('GET', url, true);
      req.send();
    });
  }
}

let examine = new Examine();
