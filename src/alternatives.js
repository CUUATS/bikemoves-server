const Queue = require('promise-queue'),
  OSRMQueue = require('./osrm.js'),
  db = require('./db.js');


class Alternatives {

  constructor(routeType) {
    this.routeType = routeType;
    this.osrm = new OSRMQueue();
    this.queue = new Queue(10, Infinity);
    this.status = {};
  }

  getTrips() {
    return db.Trip.findAll({
      where: {
        matchStatus: 'OK',
        fastestStatus: null
      },
      order: [
        ['id', 'ASC']
      ]
    });
  }

  getEndpoints(trip) {
    return db.RouteTracepoint.findAll({
      where: {
        trip_id: trip.id
      },
      order: [
        ['id', 'ASC']
      ]
    }).then((tracepoints) => {
      return [0, tracepoints.length - 1].map((i) => tracepoints[i]);
    });
  }

  updateTrip(trip, status, distance) {
    this.status[status] = (this.status[status] || 0) + 1;
    trip.fastestStatus = status;
    trip.fastestDistance = distance || 0;
    console.log(`${trip.id}: ${status}`);
    return trip.save();
  }

  showStatus() {
    for (let status in this.status)
      console.log(`${status}: ${this.status[status]}`);
  }

  find() {
    return this.getTrips().then((trips) => {
      console.log(`Finding alternatives for ${trips.length} trips...`);
      return Promise.all(trips.map((trip) => {
        return this.queue.add(() => {
          return this.getEndpoints(trip);
        }).then((points) => {
            return this.osrm.run('route', {
              coordinates: points.map((point) => point.geom.coordinates),
              overview: 'false',
              geometries: 'geojson',
              steps: true,
              annotations: true,
              routeType: this.routeType,
              tripId: trip.id,
              pointIds: points.map((point) => point.point_id)
            });
          })
          .then((res) => {
            return Promise.all([
              db.RouteLeg.bulkCreate(res.legs),
              this.updateTrip(trip, 'OK',
                res.legs.reduce((sum, leg) => sum + leg.distance, 0))
            ]);
          })
          .catch((err) => console.log(`${trip.id}: ${err.toString()}`));
      }));
    })
    .then(() => {
      console.log('Alternatives complete.')
      this.showStatus();
      this.osrm.destroyThread();
    });;
  }
}

db.prepare()
  .then(() => {
    let alts = new Alternatives('Fastest');
    return alts.find();
  })
  .then(() => {
    console.log('Updating edge relationships...');
    return db.insertIntoRouteLegEdge();
  })
  .then(() => process.exit());
