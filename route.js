"use strict";

const OSRM = require('osrm'),
  db = require('./db.js'),
  geo = require('./geo.js'),
  osrm = new OSRM('/osrm/' + process.env.OSRM_NETWORK);

function getRoute(points) {
  return new Promise((resolve, reject) => {
    osrm.match({
      coordinates: points.map((point) => point.geometry.coordinates),
      overview: 'false',
      geometries: 'geojson',
      steps: true,
      radiuses: points.map((point) => point.properties.accuracy + 6),
      timestamps: points.map((point) =>
        Math.round((new Date(point.properties.time)).getTime()/1000))
    }, (err, res) => {
      if (err) reject(err.toString());
      resolve(res);
    });
    setTimeout(() => reject('Timeout'), 10000);
  });
}

function getMatchingPoints(points, tracepoints) {
  let result = [];

  points.forEach((point, i) => {
    let tracepoint = tracepoints[i];
    if (!tracepoint) return;

    let matching = tracepoint.matchings_index;
    if (!result[matching]) result[matching] = [];
    result[matching].push(point);
  });

  return result;
}

function getLegDurations(matchingPoints) {
  let times = matchingPoints.map((matching) => {
    return matching.map((point) => (new Date(point.properties.time)).getTime());
  });

  return times.map((matchingTimes) => {
    let leg = [];
    for (let i = 0; i < matchingTimes.length - 1; i++) {
      let time = matchingTimes[i],
        next = matchingTimes[i + 1];
      leg.push(next - time);
    }
    return leg;
  });
}

function getRouteLegs(trip, route, points) {
  let matchingPoints = getMatchingPoints(points, route.tracepoints),
    legDurations = getLegDurations(matchingPoints),
    legs = [];

  route.matchings.forEach((matching, matchingIdx) => {
    matching.legs.forEach((leg, legIdx) => {

      let coords = [];
      leg.steps.forEach((step) => {
        step.geometry.coordinates.forEach((coord) => {
          if (coords[coords.length] != coord) coords.push(coord);
        });
      });

      let duration = legDurations[matchingIdx][legIdx] / 1000;

      legs.push({
        matching: matchingIdx,
        leg: legIdx,
        distance: leg.distance,
        duration: duration,
        speed: leg.distance / duration,
        geom: {
          type: 'LineString',
          coordinates: coords,
          crs: geo.WGS_84
        },
        trip_id: trip.id,
        start_point_id: matchingPoints[matchingIdx][legIdx].id,
        end_point_id: matchingPoints[matchingIdx][legIdx + 1].id
      });
    });
  });

  return legs;
}

function getRouteTracepoints(trip, route, points) {
  let result = [];
  route.tracepoints.forEach((tp, i) => {
    if (tp) result.push({
      geom: {
        type: 'Point',
        coordinates: tp.location,
        crs: geo.WGS_84
      },
      trip_id: trip.id,
      point_id: points[i].id
    });
  });
  return result;
}

function match(trip) {
  return trip.getPoints({
      order: [
        ['time', 'ASC']
      ]
  }).then((raw) => {
    if (raw.length <= 10) {
      trip.matchStatus = 'Skipped';
      console.log('Match status: skipped');
      return trip.save();
    }

    let points = geo.filterPoints(raw);
    return getRoute(points).then((route) => {
      let legs = getRouteLegs(trip, route, points),
        legsSave = db.RouteLeg.bulkCreate(legs),
        tracepoints = getRouteTracepoints(trip, route, points),
        tracepointsSave = db.RouteTracepoint.bulkCreate(tracepoints);

      trip.matchStatus = 'Matched';
      console.log('Match status: matched');
      return Promise.all([legsSave, tracepointsSave, trip.save()]);
    }).catch((err) => {
      trip.matchStatus = err;
      console.log('Match status: error');
      console.log(err);
      return trip.save();
    });
  });
}

module.exports.match = match;
