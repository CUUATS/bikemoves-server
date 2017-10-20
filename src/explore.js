const apicache = require('apicache'),
  express = require('express'),
  db = require('./db.js'),
  geo = require('./geo.js'),
  utils = require('./utils.js'),
  Distribution = require('./distribution.js'),
  Tilesplash = require('tilesplash');

const app = new Tilesplash({
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT),
  database: process.env.POSTGRES_DB
});

const cache = apicache.middleware;

const EDGE_OPTIONS = {
  minUsers: 2
};
const EDGE_TILE_SQL = db.getEdgeTileSQL(EDGE_OPTIONS);

function fitDist(column, n, options) {
  return db.getEdgeStatistics(column, EDGE_OPTIONS).then((rows) => {
    let dist = new Distribution(rows);
    return dist.fit(n, options);
  });
}

utils.serveLib(app.server,
  'node_modules/styleselect/css/styleselect.css', 'styleselect.css');
utils.serveLib(app.server,
  'node_modules/styleselect/js/styleselect.js', 'styleselect.js');
utils.serveLib(app.server,
  'src/public/lib/turf-browser.js', 'turf.js');

app.server.use(express.static('src/public/explore'));

app.server.get('/config.js', (req, res) => {
  res.header('Content-Type', 'text/javascript');
  res.send('mapboxgl.accessToken = "' + process.env.MAPBOX_TOKEN + '";');
});

app.server.get('/demographics.json', cache('24 hours'), (req, res) => {
  Promise.all([
    db.getDemographics('age', db.AGE_CHOICES),
    db.getDemographics('gender', db.GENDER_CHOICES),
    db.getDemographics('cycling_experience', db.CYCLING_EXPERIENCE_CHOICES),
    db.getTripCount()
  ]).then(([age, gender, cycling_experience, trip_count]) => {
    res.json({
      age: age,
      gender: gender,
      'cycling-experience': cycling_experience,
      'trip-count': trip_count
    });
  });
});

app.server.get('/statistics.json', cache('24 hours'), (req, res) => {
  Promise.all([
    fitDist('mean_speed', 5),
    fitDist('trips', 5),
    fitDist('users', 5),
    fitDist('preference', 5, {
      center: 0,
      equal: false,
      profile: [0.05, 0.1, 0.9, 0.95]
    })
  ]).then(([speed, trips, users, preference]) => {
    res.json({
      speed: speed,
      trips: trips,
      users: users,
      preference: preference
    });
  });
});

app.layer('explore', (tile, render) => {
  render({
    edge: EDGE_TILE_SQL
  });
});

db.prepare()
  .then(() => {
    app.server.listen(8888);
    console.log('BikeMoves Explore is ready');
  });
