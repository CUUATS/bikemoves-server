const express = require('express'),
  db = require('./db.js'),
  geo = require('./geo.js'),
  app = express(),
  tilelive = require('@mapbox/tilelive');

require('tilelive-postgis').registerProtocols(tilelive);;

app.use(express.static('src/public/explore'));

app.get('/config.js', (req, res) => {
  res.header('Content-Type', 'text/javascript');
  res.send('mapboxgl.accessToken = "' + process.env.MAPBOX_TOKEN + '";');
});

db.prepare()
  .then(() => {
    app.listen(8888);
    console.log('BikeMoves Explore is ready');
  });
