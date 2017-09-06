const express = require('express'),
  db = require('./db.js'),
  geo = require('./geo.js'),
  Tilesplash = require('tilesplash');

const EDGE_QUERY = `
  SELECT users,
    trips,
    mean_speed,
    ST_AsGeoJSON(geom) AS the_geom_geojson
  FROM edge
  WHERE users >= 2
    AND ST_Intersects(geom, !bbox_4326!)`;

const app = new Tilesplash({
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT),
  database: process.env.POSTGRES_DB
});

app.server.use(express.static('src/public/explore'));

app.server.get('/config.js', (req, res) => {
  res.header('Content-Type', 'text/javascript');
  res.send('mapboxgl.accessToken = "' + process.env.MAPBOX_TOKEN + '";');
});

app.layer('explore', (tile, render) => {
  render({
    edge: EDGE_QUERY
  });
});

db.prepare()
  .then(() => {
    app.server.listen(8888);
    console.log('BikeMoves Explore is ready');
  });
