const apicache = require('apicache');
const express = require('express');
const passport = require('passport');
const auth = require('./auth.js');
const data = require('./data.js');
const db = require('../db.js');
const template = require('./template.js');

const Tilesplash = require('tilesplash');

const tilesplash = new Tilesplash({
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT),
  database: process.env.POSTGRES_DB
});
const app = tilesplash.server;
const cache = apicache.middleware;
const noFilters = (req, res) => !req.query.filters;
const requireView = auth.requirePermission(auth.PERM_VIEW_TRIP_DETAILS);
const tripRoute = '/api/v1/trips/:id';

template.serveStatic(app);
auth.init(app);

tilesplash.layer('explore', (req, res, tile, next) => {
  tile.edgeOptions = data.getEdgeOptions(req);
  tile.cacheKey = (auth.checkPermission(req, auth.PERM_VIEW_TRIP_DETAILS)) ?
    req.query.filters : '';
  next();
}, function (tile, render) {
  this.cache((tile) =>
    tilesplash.defaultCacheKeyGenerator(tile) + ':' + tile.cacheKey,
    1000 * 60 * 60 * 4); // Cache for four hours
  render({
    edge: db.getEdgeTileSQL(tile.edgeOptions)
  });
});

app.get('/config.js', cache('24 hours'), (req, res) => {
  let bikemoves = {
    config: {
      mapboxToken: process.env.MAPBOX_TOKEN
    }
  };
  res.type('text/javascript');
  res.send(`var bikemoves = ${JSON.stringify(bikemoves)};`)
});

app.get('/api/v1/demographics', cache('4 hours'), (req, res) => {
  data.getDemographics().then((demographics) => res.json({
    demographics: demographics
  }));
});

app.get('/api/v1/statistics', cache('4 hours', noFilters), (req, res) => {
  data.getStatistics(req).then((statistics) => res.json({
    statistics: statistics
  }));
});

app.get('/api/v1/trips', requireView, (req, res) => {
  db.Trip.findAll({
    where: {
      matchStatus: 'OK'
    },
    order: [
      ['startTime', 'ASC']
    ]
  }).then((trips) => {
    res.json({
      trips: trips.map((trip) => {
        return {
          id: trip.id,
          startTime: trip.startTime.getTime(),
          endTime: trip.endTime.getTime(),
          distance: (trip.matchStatus === 'OK') ?
            trip.matchDistance * 0.000621371 : null,
          origin: trip.origin,
          destination: trip.destination,
          userId: trip.user_id
        };
      })
    });
  });
});

app.get('/api/v1/trips/id', requireView, (req, res) => {
  let filters = (new FilterParser(req.query.filters || '')).objects();
  db.getFilteredTripIds(filters).then((ids) => res.json({
    id: ids
  }));
});

function parseTripID(req, res, next) {
  req.tripID = parseInt(req.params.id);
  if (isNaN(req.tripID)) return res.sendStatus(404);
  next();
}

app.get(`${tripRoute}/trip.geojson`, requireView, parseTripID, (req, res) => {
  db.Trip.findById(req.tripID)
    .then((trip) => {
      if (!trip) return res.sendStatus(404);
      res.json(turf.featureCollection([geo.toFeature(trip)]));
    });
});

app.get(`${tripRoute}/points.geojson`, requireView, parseTripID, (req, res) => {
  db.Point.findAll({
    where: {
      trip_id: req.tripID
    },
    order: [
      ['time', 'ASC']
    ]
  }).then((points) => {
      if (!points.length) return res.sendStatus(404);
      res.json(turf.featureCollection(geo.filterPoints(points)));
    });
});

app.get(`${tripRoute}/legs.geojson`, requireView, parseTripID, (req, res) => {
  db.RouteLeg.findAll({
    where: {
      trip_id: req.tripID
    },
    order: [
      ['matching', 'ASC'],
      ['leg', 'ASC']
    ]
  }).then((legs) => {
      if (!legs.length) return res.sendStatus(404);
      res.json(geo.toFeature(legs));
    });
});

app.get(`${tripRoute}/tracepoints.geojson`,
    requireView, parseTripID, (req, res) => {
  db.RouteTracepoint.findAll({
    where: {
      trip_id: req.tripID
    }
  }).then((tracepoints) => {
      if (!tracepoints.length) return res.sendStatus(404);
      res.json(geo.toFeature(tracepoints));
    });
});

app.set('view engine', 'pug');
app.set('views', './src/explore/views');
app.use(template.middleware);

app.get('/login',(req, res) => {
  res.render('login', {
    title: 'Log In',
    id: 'login',
    errorMessages: req.flash('error')
  });
});

app.post('/login', passport.authenticate('local', {
    failureFlash: 'Invalid username or password.',
    failureRedirect: '/login',
    successRedirect: '/'
}));

app.get('/logout', (req, res) => {
  req.logout();
  res.redirect('/');
});

app.get('/', (req, res) => {
  res.render('index', {
    title: 'Home',
    id: 'home',
  });
});

app.get('/download', (req, res) => {
  res.render('download', {
    title: 'Download',
    id: 'download',
  });
});

app.get('/demographics', (req, res) => {
  res.render('demographics', {
    title: 'Demographics',
    id: 'demographics',
    stats: [
      {id: 'users', title: 'Users'},
      {id: 'trips', title: 'Trips'},
      {id: 'distance', title: 'Miles'}
    ],
    charts: ['age', 'gender', 'cycling-experience', 'trip-count']
  });
});

app.get('/data', (req, res) => {
  res.render('data', {
    title: 'Data',
    id: 'data',
    views: template.MAP_VIEWS,
    layers: template.MAP_LAYERS,
    userFilters: template.USER_FILTERS,
    tripFilters: template.TRIP_FILTERS
  });
});

db.prepare()
  .then(() => {
    app.listen(8888);
    console.log('BikeMoves Explore is ready');
  });
