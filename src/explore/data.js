const auth = require('./auth.js');
const db = require('../db.js');
const Distribution = require('./distribution.js');
const FilterParser = require('./filters.js');

function fitDist(column, n, edgeOptions, distOptions) {
  return db.getEdgeStatistics(column, edgeOptions).then((rows) => {
    let dist = new Distribution(rows);
    return dist.fit(n, distOptions);
  });
}

function getStatistics(req) {
  let edgeOptions = getEdgeOptions(req);
  return Promise.all([
    fitDist('mean_speed', 5, edgeOptions),
    fitDist('trips', 5, edgeOptions),
    fitDist('users', 5, edgeOptions),
    fitDist('preference', 5, edgeOptions, {
      center: 0,
      equal: false,
      profile: [0.05, 0.1, 0.9, 0.95]
    })
  ]).then(([speed, trips, users, preference]) => {
    return {
      speed: speed,
      trips: trips,
      users: users,
      preference: preference
    };
  });
}

function getDemographics() {
  return Promise.all([
    db.getDemographics('age', db.AGE_CHOICES),
    db.getDemographics('gender', db.GENDER_CHOICES),
    db.getDemographics('cycling_experience', db.CYCLING_EXPERIENCE_CHOICES),
    db.getTripCount()
  ]).then(([age, gender, cycling_experience, trip_count]) => {
    return {
      age: age,
      gender: gender,
      'cycling-experience': cycling_experience,
      'trip-count': trip_count
    };
  });
}

function getEdgeOptions(req) {
  if (!auth.checkPermission(req, auth.PERM_VIEW_TRIP_DETAILS))
    return {
      minUsers: 2
    };

  return {
    filters: (new FilterParser(req.query.filters || '')).objects()
  };
}

module.exports.getStatistics = getStatistics;
module.exports.getDemographics = getDemographics;
module.exports.getEdgeOptions = getEdgeOptions;
