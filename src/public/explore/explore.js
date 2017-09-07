var Explore = function() {
  this.state = {
    chartView: 'users'
  };
  this.initCharts();
  // this.initMap();
};

Explore.prototype.initMap = function() {
  this.map = map = new mapboxgl.Map({
      container: 'map',
      style: 'mapbox://styles/mapbox/light-v9',
      center: [-88.227203, 40.109403],
      zoom: 13
  });
  map.on('load', this.addLayers.bind(this));
};

Explore.prototype.initCharts = function() {
  var ex = this;
  this.getJSON(this.absoluteURL('/demographics.json'), function(data) {
    console.log(data);
    ex.initChartViews(data);
  });
};

Explore.prototype.initChartViews = function(data) {
  var ex = this,
    viewButtons = document.querySelectorAll('#stats li');
  viewButtons.forEach(function(button) {
    var link = button.querySelector('a'),
      value = button.querySelector('.value'),
      statName = button.className;

    value.innerHTML = ex.formatNumber(ex.getStatTotal(data, statName), 0);
    link.addEventListener('click', function(e) {
      e.preventDefault();
      ex.showStatCharts(this.parentNode.className);
    });
    if (statName === ex.state.chartView) ex.showStatCharts(statName);
  });
};

Explore.prototype.showStatCharts = function(statName) {
  document.querySelectorAll('#stats li a').forEach(function(link) {
    link.className = (link.parentNode.className === statName) ? 'active' : '';
  });

};

Explore.prototype.getStatTotal = function(data, statName) {
  return data.gender.reduce(function(sum, row) {
    return sum + row[statName];
  }, 0);
};

Explore.prototype.formatNumber = function(value, digits) {
  return (+value.toFixed(digits)).toLocaleString();
};

Explore.prototype.absoluteURL = function(url) {
  return location.protocol + '//' + location.hostname + (
    location.port ? ':' + location.port : '') + url;
};

Explore.prototype.getJSON = function(url, callback) {
  var req = new XMLHttpRequest();
  req.onreadystatechange = function() {
    if (this.readyState == 4 && this.status == 200)
      callback(JSON.parse(this.responseText));
  };
  req.open('GET', url, true);
  req.send();
};

Explore.prototype.addLayers = function() {
  this.map.addSource('explore', {
    type: 'vector',
    tilejson: '2.2.0',
    name: 'bikemoves-explore',
    description: 'Map data for the BikeMoves Explore web app.',
    version: '1.0.0',
    attribution: '<a href="https://ccrpc.org/">&copy; CCRPC</a>',
    scheme: 'xyz',
    tiles: [
       this.absoluteURL('/explore/{z}/{x}/{y}.mvt')
    ]
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
        stops: [
          [1, '#d7191c'],
          [2, '#fdae61'],
          [3, '#ffffbf'],
          [4, '#abd9e9'],
          [5, '#2c7bb6']
        ]
      },
      'line-width': {
        type: 'interval',
        property: 'users',
        stops: [
          [2, 4],
          [4, 8],
          [6, 12],
          [8, 16]
        ]
      }
    },
    layout: {
      'line-cap': 'round'
    }
  }, 'road-label-small');
};

var explore = new Explore();
