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

  pad(n, w) {
    let d = n.toString();
    return (d.length >= w) ? d : new Array(w - d.length + 1).join('0') + d;
  }

  formatDuration(duration) {
    let hours = this.pad(duration.hours(), 2),
      minutes = this.pad(duration.minutes(), 2),
      seconds = this.pad(duration.seconds(), 2);

    return [hours, minutes, seconds].join(':');
  }

  getTableRows() {
    return Object.values(this.data.trips).map((trip) => {
      let start = moment(trip.startTime),
        end = moment(trip.endTime),
        row = [
          trip.id,
          start.format('M/D/YYYY'),
          start.format('h:mm:ss a'),
          this.formatDuration(moment.duration(end.diff(start))),
          trip.distance.toFixed(2) + ' mi',
          this.locationTypes[trip.origin],
          this.locationTypes[trip.destination],
          trip.userId
        ];

      let attrs = `id="trip-${trip.id}"`;
      if (this.state.trip && this.state.trip.id === trip.id)
        attrs += ' class="selected"';

    return `<tr ${attrs}><td>${row.join('</td><td>')}</td></tr>`;
    });
  }

  initTable() {
    this.getJSON('/api/trips').then((res) => {
      this.data.trips = {};
      res.trips.forEach((trip) => this.data.trips[trip.id] = trip);
      this.clusterize = new Clusterize({
        rows: this.getTableRows(),
        scrollId: 'trips-scroll',
        contentId: 'trips-content'
      });
    });

    let content = document.getElementById('trips-content');
    content.addEventListener('click', (e) => {
      if (e.target.nodeName != 'TD') return;
      let tripId = parseInt(e.target.parentNode.childNodes[0].textContent);
      if (!isNaN(tripId)) {
        this.state.trip = this.data.trips[tripId];
        this.populateMap(tripId, this.state.trip.bbox);
        this.clusterize.update(this.getTableRows());
      }
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
