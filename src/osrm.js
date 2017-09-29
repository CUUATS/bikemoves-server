const ThreadQueue = require('./queue.js'),
  geo = require('./geo.js');


function osrmTask(input, done) {
  if (typeof this.osrm === 'undefined' || this.network !== input.network) {
    const OSRM = require('osrm');
    this.osrm = new OSRM({
      algorithm: 'MLD',
      path: '/osrm/' + input.network
    });
    this.network = input.network;
  }

  osrm[input.service](input.options, (err, res) => {
    done({
      status: (err) ? 'error' : 'ok',
      body: (err) ? err : res
    });
  });
}

class OSRMQueue extends ThreadQueue {
  constructor() {
    super(osrmTask);
    this.network = process.env.OSRM_NETWORK;
    this.timeout = parseInt(process.env.OSRM_TIMEOUT) || 10000;
  }

  run(service, options) {
    return this.push({
      network: this.network,
      service: service,
      options: options
    }, {
      timeout: this.timeout
    });
  }

  onMessage(msg) {
    if (this.timer) clearTimeout(this.timer);
    let current = this.queue.shift();
    (msg.status === 'ok') ?
      current.resolve(this.makeResponse(
        msg.body, current.input.service, current.input.options)) :
      current.reject(msg.body);
    this.next();
  }

  makeResponse(res, service, options) {
    let legs = [],
      routeType = (options.routeType) ? options.routeType : null,
      tripId = (options.tripId) ? options.tripId : null,
      routes = (service === 'match') ? res.matchings : res.routes,
      waypoints = (service === 'match') ? res.tracepoints : res.waypoints,
      waypoint_filter = (current, i) => waypoints[i] !== null;

    let timestamps = (options.timestamps || []).filter(waypoint_filter),
      pointIds = (options.pointIds || []).filter(waypoint_filter);

    let tracepoints = waypoints
      .filter((waypoint) => waypoint !== null)
      .map((waypoint, i) => {
        return {
          geom: {
            type: 'Point',
            coordinates: waypoint.location,
            crs: geo.WGS_84
          },
          trip_id: tripId,
          point_id: pointIds[i] || null
        };
      });

    routes.forEach((route, routeIdx) => {
      route.legs.forEach((leg, legIdx) => {
        let cumulativeIdx = legs.length,
          duration = (timestamps.length === 0) ? leg.duration :
            timestamps[cumulativeIdx + 1] - timestamps[cumulativeIdx];
        legs.push({
          matching: routeIdx,
          leg: legIdx,
          distance: leg.distance,
          duration: duration,
          speed: leg.distance / duration,
          nodes: leg.annotation.nodes,
          geom: this.getLegGeom(leg),
          routeType: routeType,
          trip_id: tripId,
          start_point_id: pointIds[cumulativeIdx] || null,
          end_point_id: pointIds[cumulativeIdx + 1] || null
        });
      });
    });

    return {
      legs: legs,
      tracepoints: tracepoints
    }
  }

  getLegGeom(leg) {
    let coords = [];
    leg.steps.forEach((step) => {
      step.geometry.coordinates.forEach((coord) => {
        if (coords[coords.length] != coord) coords.push(coord);
      });
    });

    return {
      type: 'LineString',
      coordinates: coords,
      crs: geo.WGS_84
    };
  }
}

module.exports = OSRMQueue;
