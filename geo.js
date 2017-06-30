"use strict";

const turf = require('@turf/turf');

const WGS_84 = {
  type: 'name',
  properties: {
    name: 'EPSG:4326'
  }
};

function toGeoJSON(locations) {
  if (Array.isArray(locations)) {
    return {
      type: 'LineString',
      coordinates: locations.map(function(location) {
        return [location.longitude, location.latitude]
      }),
      crs: WGS_84
    };
  }
  return {
    type: 'Point',
    coordinates: [locations.longitude, locations.latitude],
    crs: WGS_84
  };
};

function toFeature(obj) {
  if (Array.isArray(obj))
    return turf.featureCollection(obj.map((child) => toFeature(child)));
  let geom = obj.geom,
    props = Object.assign({}, obj.dataValues);
  delete props['geom'];
  geom.crs = WGS_84;
  return turf.feature(geom, props);
};

function getAngle(pointA, pointB, pointC) {
  let bearingA = turf.bearing(pointB, pointA),
    bearingC = turf.bearing(pointB, pointC),
    angle = Math.abs(bearingC - bearingA);
  return Math.min(angle, 360 - angle);
};

function filterPoints(points) {
  // Convert points to features.
  let features = points.map(toFeature),
    latest = null;

  // First pass: remove points with an angle greater than 90 degrees.
  return features.filter((feature, i, all) => {
    if (i === 0 || i === all.length - 1) return true;
    let prev = features[i - 1],
      next = features[i + 1];
    return getAngle(prev, feature, next) >= 90;
  })
  // Second pass: remove points that are too close in time or location.
  .filter((feature, i, all) => {
    // Always preserve the first and last points.
    if (i === 0 || i === all.length - 1) {
      latest = feature;
      return true;
    }

    // Remove points that are less than 10 seconds or less than 100 meters
    // from the previous point.
    if (feature.properties.time.getTime() -
        latest.properties.time.getTime() < 10000 ||
      turf.distance(feature, latest) < 0.1) return false;

    latest = feature;
    return true;
  });
};

module.exports.WGS_84 = WGS_84;
module.exports.toGeoJSON = toGeoJSON;
module.exports.filterPoints = filterPoints;
