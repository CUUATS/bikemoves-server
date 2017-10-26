const stats = require('stats-lite'),
  Queue = require('promise-queue'),
  OSRMQueue = require('./osrm.js'),
  db = require('./db.js'),
  geo = require('./geo.js');

class Matches {

  constructor() {
    this.osrm = new OSRMQueue();
    this.status = {};
    this.queue = new Queue(10, Infinity);
  }

  getTrips() {
    return db.Trip.findAll({
      where: {
        matchStatus: null
      },
      order: [
        ['id', 'ASC']
      ]
    });
  }

  markSpeedOutliers(res) {
    // Anything that is more than three times the standard deviation above the
    // mean or more than 30 MPH (13.4 m/s) is considered an outlier.
    let speeds = res.legs.map((leg) => leg.speed),
      mean = stats.mean(speeds),
      stdev = stats.stdev(speeds);

    res.legs.forEach((leg) => leg.speedOutlier =
      leg.speed > (mean + 3 * stdev) || leg.speed > 13.4);

    return res;
  }

  updateTrip(trip) {
    let status = `${trip.matchStatus} -> ${trip.fastestStatus}`;
    if (!this.status[status]) this.status[status] = 0;
    this.status[status] += 1;

    console.log(`${trip.id}: ${status}`);
    return trip.save();
  }

  showStatus() {
    for (let status in this.status)
      console.log(`${status}: ${this.status[status]}`);
  }

  getTripPoints(trip) {
    return trip.getPoints({
        order: [
          ['time', 'ASC']
        ]
    });
  }

  makeResult(trip, resType, status, res) {
    let result = Object.assign({
      legs: [],
      tracepoints: [],
      distance: 0
    }, res || {});

    trip[resType + 'Status'] = status;
    trip[resType + 'Distance'] =
      result.legs.reduce((sum, leg) => sum + leg.distance, 0);

    return result;
  }

  getMatchResult(trip) {
    return this.getTripPoints(trip)
      .then((raw) => {
        let points = geo.filterPoints(raw);
        if (points.length <= 5)
          return this.makeResult(trip, 'match', 'Skipped');

        return this.osrm.run('match', {
          coordinates: points.map((point) => point.geometry.coordinates),
          overview: 'false',
          geometries: 'geojson',
          steps: true,
          annotations: true,
          radiuses: points.map((point) => point.properties.accuracy + 6),
          timestamps: points.map((point) =>
            Math.round((new Date(point.properties.time)).getTime()/1000)),
          routeType: 'Match',
          tripId: trip.id,
          pointIds: points.map((point) => point.properties.id)
        })
        .then((res) =>
          this.makeResult(trip, 'match', 'OK', this.markSpeedOutliers(res)))
        .catch((err) => this.makeResult(trip, 'match', err.toString()));
      });
  }

  getFastestResult(trip, tracepoints) {
    if (trip.matchStatus !== 'OK')
      return Promise.resolve(this.makeResult(trip, 'fastest', 'Skipped'));

    let points = [0, tracepoints.length - 1].map((i) => tracepoints[i]);
    return this.osrm.run('route', {
      coordinates: points.map((point) => point.geom.coordinates),
      overview: 'false',
      geometries: 'geojson',
      steps: true,
      annotations: true,
      routeType: 'Fastest',
      tripId: trip.id,
      pointIds: points.map((point) => point.point_id)
    })
    .then((res) => this.makeResult(trip, 'fastest', 'OK', res))
    .catch((err) => this.makeResult(trip, 'fastest', err.toString()));
  }

  saveResults(trip, match, fastest) {
    let legs = match.legs.concat(fastest.legs),
      tracepoints = match.tracepoints;

    return Promise.all([
      (legs.length) ? db.RouteLeg.bulkCreate(legs) : Promise.resolve(),
      (tracepoints.length) ?
        db.RouteTracepoint.bulkCreate(tracepoints) : Promise.resolve(),
      this.updateTrip(trip)
    ]);
  }

  match() {
    return this.getTrips().then((trips) => {
      console.log(`Matching ${trips.length} trips...`);
      return Promise.all(trips.map((trip) => {
        return this.queue.add(() => {
          return this.getMatchResult(trip)
          .then((matchRes) => {
            return this.getFastestResult(trip, matchRes.tracepoints)
            .then((fastestRes) => this.saveResults(trip, matchRes, fastestRes));
          });
        });
      }));
    })
    .then(() => {
      console.log('Matching complete.')
      this.showStatus();
      this.osrm.destroyThread();
    });
  }
}

db.prepare()
  .then(() => {
    let matches = new Matches();
    return matches.match();
  })
  .then(() => {
    console.log('Updating edge relationships...');
    return db.insertIntoRouteLegEdge();
  })
  .then(() => {
    console.log('Updating database statistics...');
    return db.postMatchAnalyze();
  })
  .then(() => process.exit());
