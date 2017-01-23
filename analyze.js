const OSRM = require('osrm'),
  db = require('./db.js');

var osrm = new OSRM('data/illinois-latest.osrm');

function clearRoutes() {
  return db.Route.destroy({
    truncate: true
  });
}

function getTrips() {
  return db.Trip.findAll({
    order: [
      ['id', 'ASC']
    ]
  });
}

function matchTrips(trips) {
  if (!trips) return;
  var trip = trips.shift();
  console.log('Processing trip ' + trip.id + '...');
  trip.getPoints({
      order: [
        ['time', 'ASC']
      ]
  }).then(function(points) {
    if (points.length <= 2) return matchTrips(trips);
    var options = {
      coordinates: points.map(function(point) {
        return point.geom.coordinates;
      }),
      timestamps: points.map(function(point) {
        return point.time.getTime();
      }),
      radiuses: points.map(function(point) {
        return Math.max(point.accuracy, 10);
      }),
      geometries: 'geojson',
      annotations: true,
      steps: true
    };
    osrm.match(options, function(err, res) {
      console.log(trip.id, err);
      if (res && res.matchings) {
        res.matchings.forEach(function(match) {
          db.Route.create(db.Route.fromMatch(match, trip.id));
        });
      }
      return matchTrips(trips);
    });
  });
}

getTrips().then(matchTrips);
