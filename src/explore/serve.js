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
  next();
}, (tile, render) => {
  render({
    edge: db.getEdgeTileSQL(tile.edgeOptions)
  });
});

app.get('/data.js', cache('24 hours'), (req, res) => {
  return Promise.all([
    data.getDemographics(),
    data.getStatistics(req)
  ]).then(([demographics, statistics]) => {
    let bikemoves = {
      data: {
        mapboxToken: process.env.MAPBOX_TOKEN,
        demographics: demographics,
        statistics: statistics
      }
    };
    res.type('text/javascript');
    res.send(`var bikemoves = ${JSON.stringify(bikemoves)};`)
  })
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
    title: 'data',
    id: 'data',
    views: template.MAP_VIEWS,
    layers: template.MAP_LAYERS
  });
});

db.prepare()
  .then(() => {
    app.listen(8888);
    console.log('BikeMoves Explore is ready');
  });
