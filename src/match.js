const stats = require('stats-lite'),
  Queue = require('promise-queue'),
  OSRMQueue = require('./osrm.js'),
  db = require('./db.js'),
  geo = require('./geo.js');

class Matches {

  constructor() {
    this.osrm = new OSRMQueue();
    this.status = {};
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

  markSpeedOutliers(legs) {
    // Anything that is more than three times the standard deviation above the
    // mean or more than 30 MPH (13.4 m/s) is considered an outlier.
    let speeds = legs.map((leg) => leg.speed),
      mean = stats.mean(speeds),
      stdev = stats.stdev(speeds);

    legs.forEach((leg) => leg.speedOutlier = leg.speed > (mean + 3 * stdev) ||
      leg.speed > 13.4);
  }

  updateTrip(trip, status) {
    if (!this.status[status]) this.status[status] = 0;
    this.status[status] += 1;

    trip.matchStatus = status;
    console.log(`${trip.id}: ${status}`);
    return trip.save();
  }

  showStatus() {
    for (let status in this.status)
      console.log(`${status}: ${this.status[status]}`);
  }

  match() {
    let queue = new Queue(10, Infinity);
    return this.getTrips().then((trips) => {
      return Promise.all(trips.map((trip) => {
        return queue.add(() => {
          return trip.getPoints({
              order: [
                ['time', 'ASC']
              ]
          });
        }).then((raw) => {
          let points = geo.filterPoints(raw);
          if (points.length <= 5) return this.updateTrip(trip, 'Skipped');

          return this.osrm.run('match', {
            coordinates: points.map((point) => point.geometry.coordinates),
            overview: 'false',
            geometries: 'geojson',
            steps: true,
            annotations: true,
            radiuses: points.map((point) => point.properties.accuracy + 6),
            timestamps: points.map((point) =>
              Math.round((new Date(point.properties.time)).getTime()/1000)),
            routeType: 'Actual',
            tripId: trip.id,
            pointIds: points.map((point) => point.properties.id)
          }).then((res) => {
            this.markSpeedOutliers(res.legs);
            return Promise.all([
              db.RouteLeg.bulkCreate(res.legs),
              db.RouteTracepoint.bulkCreate(res.tracepoints),
              this.updateTrip(trip, 'Matched')
            ]);
          }).catch((err) => this.updateTrip(trip, err.toString()));
        });
      }))
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
  .then(() => process.exit());
