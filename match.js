"use strict";

const stats = require('stats-lite'),
  db = require('./db.js'),
  geo = require('./geo.js'),
  Queue = require('./queue.js');

function getRoute(input, done) {
  if (typeof this.osrm === 'undefined' || this.network !== input.network) {
    const OSRM = require('osrm');
    this.osrm = new OSRM('/osrm/' + input.network);
    this.network = input.network;
  }

  osrm.match({
    coordinates: input.points.map((point) => point.geometry.coordinates),
    overview: 'false',
    geometries: 'geojson',
    steps: true,
    radiuses: input.points.map((point) => point.properties.accuracy + 6),
    timestamps: input.points.map((point) =>
      Math.round((new Date(point.properties.time)).getTime()/1000))
  }, (err, res) => {
    done({
      status: (err) ? 'error' : 'match',
      body: (err) ? err.toString() : res
    });
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
        start_point_id: matchingPoints[matchingIdx][legIdx].properties.id,
        end_point_id: matchingPoints[matchingIdx][legIdx + 1].properties.id
      });
    });
  });

  let speeds = legs.map((leg) => leg.speed),
    mean = stats.mean(speeds),
    stdev = stats.stdev(speeds);

  legs.forEach((leg) => {
    // Anything that is more than three times the standard deviation above the
    // mean or more than 30 MPH (13.4 m/s) is considered an outlier.
    leg.speedOutlier = leg.speed > (mean + 3 * stdev) || leg.speed > 13.4;
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
  let queue = new Queue(getRoute);

  return Promise.all(trips.map((trip) => {
    return trip.getPoints({
        order: [
          ['time', 'ASC']
        ]
    }).then((raw) => {
      let points = geo.filterPoints(raw);
      if (points.length <= 5) {
        trip.matchStatus = 'Skipped';
        console.log(trip.id + ': skipped');
        return trip.save();
      }

      return queue.push({
        points: points,
        network: process.env.OSRM_NETWORK
      }, {
        timeout: 20000
      }).then((res) => {
        if (res.status === 'match') {
          let legs = getRouteLegs(trip, res.body, points),
            legsSave = db.RouteLeg.bulkCreate(legs),
            tracepoints = getRouteTracepoints(trip, res.body, points),
            tracepointsSave = db.RouteTracepoint.bulkCreate(tracepoints);

          console.log(trip.id + ': matched');
          trip.matchStatus = 'Matched';
          return Promise.all([legsSave, tracepointsSave, trip.save()]);
        } else {
          console.log(trip.id + ': ' + res.body);
          trip.matchStatus = res.body;
          return trip.save();
        }
      }).catch((err) => {
        console.log(trip.id + ': error ' + err);
        trip.matchStatus = err;
        return trip.save();
      });
    });
  })).then(() => {
    console.log('Finished processing ' + trips.length + ' trips.')
    queue.destroyThread();
  });
}

db.prepare()
  .then(getTrips)
  .then(matchTrips);
