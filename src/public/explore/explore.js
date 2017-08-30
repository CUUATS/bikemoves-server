var Explore = function() {
  this.initMap();
};

Explore.prototype.initMap = function() {
  this.map = map = new mapboxgl.Map({
      container: 'map',
      style: 'mapbox://styles/mapbox/streets-v9',
      center: [-88.227203, 40.109403],
      zoom: 13
  });
  map.on('load', this.addLayers.bind(this));
};

Explore.prototype.addLayers = function() {

};

var explore = new Explore();
