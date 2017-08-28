"use strict";

const express = require('express'),
  turf = require('@turf/turf'),
  db = require('./db.js'),
  geo = require('./geo.js'),
  app = express();

app.use(express.static('src/public/examine'));

app.get('/config.js', (req, res) => {
  res.header('Content-Type', 'text/javascript');
  res.send('window.mapboxToken = "' + process.env.MAPBOX_TOKEN + '";');
});

app.get('/api/trips', (req, res) => {
  db.Trip.findAll({
    where: {
      matchStatus: 'Matched'
    },
    order: [
      ['startTime', 'ASC']
    ]
  }).then((trips) => {
    res.json({
      trips: trips.map((trip) => {
        return {
          id: trip.id,
          startTime: trip.startTime.getTime(),
          endTime: trip.endTime.getTime(),
          distance: turf.lineDistance(turf.feature(trip.geom), 'miles'),
          origin: trip.origin,
          destination: trip.destination,
          userId: trip.user_id
        };
      })
    });
  });
});

app.get('/api/trips/:id', (req, res) => {
  var id = parseInt(req.params.id);
  if (isNaN(id)) return res.sendStatus(404);
  Promise.all([
    db.Trip.findById(id),
    db.Point.findAll({
      where: {
        trip_id: id
      },
      order: [
        ['time', 'ASC']
      ]
    }),
    db.RouteLeg.findAll({
      where: {
        trip_id: id
      },
      order: [
        ['matching', 'ASC'],
        ['leg', 'ASC']
      ]
    }),
    db.RouteTracepoint.findAll({
      where: {
        trip_id: id
      }
    })
  ]).then((records) => {
    var trip = records[0],
      points = records[1],
      legs = records[2],
      tracepoints = records[3];
    if (!trip) return res.sendStatus(404);
    res.send({
      trip: geo.toFeature(trip),
      points: turf.featureCollection(geo.filterPoints(points)),
      legs: geo.toFeature(legs),
      tracepoints: geo.toFeature(tracepoints)
    });
  });
});

db.prepare()
  .then(() => {
    app.listen(8888);
    console.log('BikeMoves Examine is ready');
  });
