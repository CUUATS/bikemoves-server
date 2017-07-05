var map = L.map('map', {
    center: [40.109403, -88.227203],
    zoom: 13
  }),
  speedColor = function(value) {
    if (value > 4) return '#2c7bb6';
    if (value > 3) return '#abd9e9';
    if (value > 2) return '#ffffbf';
    if (value > 1) return '#fdae61';
    return '#d7191c';
  },
  popupContent = function(layer) {
    var props = layer.feature.properties,
      html = '<table><thead><tr><th>Column</th><th>Value</th></tr></thead>' +
        '<tbody>';
    for (var key in props) if (props.hasOwnProperty(key))
      html += '<tr><td>' + key + '</td><td>' + props[key] + '</td></tr>';

    html += '</tbody></table>'
    return html;
  },
  tripLayer = L.geoJSON(null, {
    style: function(feature) {
      return {
        color: '#999999'
      };
    }
  }).bindPopup(popupContent)
  .addTo(map),
  pointsLayer = L.geoJSON(null, {
    pointToLayer: function(feature, latlng) {
      return L.circleMarker(latlng);
    },
    style: function(feature) {
      return {
        color: '#999999',
        radius: 3
      };
    }
  }).bindPopup(popupContent)
  .addTo(map),
  legsLayer = L.geoJSON(null, {
    style: function(feature) {
      return {
        color: speedColor(feature.properties.speed),
        weight: 6
      };
    }
  }).bindPopup(popupContent)
  .addTo(map),
  tracepointsLayer = L.geoJSON(null, {
    pointToLayer: function(feature, latlng) {
      return L.circleMarker(latlng);
    },
    style: function(feature) {
      return {
        color: 'white',
        fillColor: 'black',
        fillOpacity: 0.8,
        radius: 5
      };
    }
  }).bindPopup(popupContent)
  .addTo(map),
  LOCATION_TYPES = [
    'Not Specified',
    'Home',
    'Work',
    'K-12 School',
    'University',
    'Shopping',
    'Other'
  ];

L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token=' + mapboxToken, {
    attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="http://mapbox.com">Mapbox</a>',
    maxZoom: 18,
    id: 'mapbox.streets',
    accessToken: mapboxToken
}).addTo(map);

function getJSON(url, callback) {
  var req = new XMLHttpRequest();
  req.onreadystatechange = function() {
    if (this.readyState == 4 && this.status == 200)
      callback(JSON.parse(this.responseText));
  };
  req.open('GET', url, true);
  req.send();
}

function populateTable() {
  var table = document.getElementById('trips'),
    tbody = document.createElement('tbody');
  table.appendChild(tbody);
  getJSON('/api/trips', function(res) {
    res.trips.forEach(function(trip) {
      var start = new Date(trip.startTime),
        end = new Date(trip.endTime);
      var row = makeRow([
        trip.id,
        start.toLocaleString(),
        Math.round((trip.endTime - trip.startTime)/1000),
        trip.distance.toFixed(2),
        LOCATION_TYPES[trip.origin],
        LOCATION_TYPES[trip.destination],
        trip.userId
      ]);
      row.addEventListener('click', function() {
        populateMap(trip.id);
      });
      tbody.appendChild(row);
    });
  });
}

function makeRow(values) {
  var row = document.createElement('tr');
  values.forEach(function(value) {
    var cell = document.createElement('td'),
      content = document.createTextNode(value);
    cell.appendChild(content);
    row.appendChild(cell);
  });
  return row;
}

function populateMap(tripId) {
  getJSON('/api/trips/' + tripId, function(res) {
    tripLayer.clearLayers().addData(res.trip);
    pointsLayer.clearLayers().addData(res.points);
    legsLayer.clearLayers().addData(res.legs);
    tracepointsLayer.clearLayers().addData(res.tracepoints);
    map.fitBounds(tripLayer.getBounds());
  });
}

populateTable();
