const express = require('express'),
  turf = require('@turf/turf'),
  db = require('./db.js'),
  geo = require('./geo.js'),
  utils = require('./utils.js'),
  app = express();

app.use(express.static('src/public/examine'));

utils.serveLib(app, 'node_modules/moment/min/moment.min.js', 'moment.js');
utils.serveLib(app,
  'node_modules/clusterize.js/clusterize.min.js', 'clusterize.js');
utils.serveLib(app,
  'node_modules/clusterize.js/clusterize.css', 'clusterize.css');

app.get('/config.js', (req, res) => {
  res.header('Content-Type', 'text/javascript');
  res.send('mapboxgl.accessToken = "' + process.env.MAPBOX_TOKEN + '";');
});

app.get('/api/trips', (req, res) => {
  db.Trip.findAll({
    where: {
      matchStatus: 'OK'
    },
    order: [
      ['startTime', 'ASC']
    ]
  }).then((trips) => {
    res.json({
      trips: trips.map((trip) => {
        let geom = turf.feature(trip.geom);
        return {
          id: trip.id,
          startTime: trip.startTime.getTime(),
          endTime: trip.endTime.getTime(),
          distance: turf.lineDistance(geom, 'miles'),
          origin: trip.origin,
          destination: trip.destination,
          userId: trip.user_id,
          bbox: turf.bbox(geom)
        };
      })
    });
  });
});

function parseTripID(req, res, next) {
  req.tripID = parseInt(req.params.id);
  if (isNaN(req.tripID)) return res.sendStatus(404);
  next();
}

app.get('/api/trips/:id.geojson', parseTripID, (req, res) => {
  db.Trip.findById(req.tripID)
    .then((trip) => {
      if (!trip) return res.sendStatus(404);
      res.json(turf.featureCollection([geo.toFeature(trip)]));
    });
});

app.get('/api/points/:id.geojson', parseTripID, (req, res) => {
  db.Point.findAll({
    where: {
      trip_id: req.tripID
    },
    order: [
      ['time', 'ASC']
    ]
  }).then((points) => {
      if (!points.length) return res.sendStatus(404);
      res.json(turf.featureCollection(geo.filterPoints(points)));
    });
});

app.get('/api/legs/:id.geojson', parseTripID, (req, res) => {
  db.RouteLeg.findAll({
    where: {
      trip_id: req.tripID
    },
    order: [
      ['matching', 'ASC'],
      ['leg', 'ASC']
    ]
  }).then((legs) => {
      if (!legs.length) return res.sendStatus(404);
      res.json(geo.toFeature(legs));
    });
});

app.get('/api/tracepoints/:id.geojson', parseTripID, (req, res) => {
  db.RouteTracepoint.findAll({
    where: {
      trip_id: req.tripID
    }
  }).then((tracepoints) => {
      if (!tracepoints.length) return res.sendStatus(404);
      res.json(geo.toFeature(tracepoints));
    });
});

db.prepare()
  .then(() => {
    app.listen(8888);
    console.log('BikeMoves Examine is ready');
  });
