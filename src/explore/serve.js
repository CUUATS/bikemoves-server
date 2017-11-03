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

app.get('/api/v1/demographics', (req, res) => {
  data.getDemographics().then((demographics) => res.json({
    demographics: demographics
  }));
});

app.get('/api/v1/statistics', (req, res) => {
  data.getStatistics(req).then((statistics) => res.json({
    statistics: statistics
  }));
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
