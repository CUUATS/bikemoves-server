"use strict";

const db = require('./db.js'),
  route = require('./route.js');

function clearRoutes() {
  return db.Route.destroy({
    truncate: true
  });
}

function getTrips() {
  return db.Trip.findAll({
    where: {
      matchStatus: null
    },
    order: [
      ['id', 'ASC']
    ]
  });
}

function matchTrips(trips) {
  if (!trips) return;
  var trip = trips.shift();
  console.log('Processing trip ' + trip.id + '...');
  route.match(trip).then(() => matchTrips(trips));
}

db.prepare()
  .then(getTrips)
  .then(matchTrips);
