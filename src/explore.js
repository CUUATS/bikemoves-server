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

function getDist(valCol) {
  let sql = `
    SELECT ${valCol}::int AS value,
      sum(ST_Length(edge.geom_proj)) / 5280 AS count
    FROM edge
    WHERE users >= 2
    GROUP BY value
    ORDER BY value`;

  return db.sequelize.query(sql, {type: db.sequelize.QueryTypes.SELECT});
}

function makeStopValues(n, size, current, max) {
  let stops = [current];
  for (let i = 1; i < n - 1; i++) {
    current += size;
    stops.push(current);
  }
  stops.push(max);
  return stops;
}

function getStops(data, n, size, start) {
  let stops = makeStopValues(n, size, start, data[data.length - 1].value),
    i = 0,
    grandTotal = data.map((d) => d.count).reduce((sum, ct) => sum + ct, 0),
    cumulativeTotal = 0;

  return stops.map((stop) => {
    let stopTotal = 0;

    while (i < data.length && data[i].value <= stop) {
      cumulativeTotal += data[i].count;
      stopTotal += data[i].count;
      i++;
    }

    return {
      value: stop,
      count: stopTotal,
      percentile: cumulativeTotal / grandTotal
    };
  });
}

function scoreStops(stops) {
  let n = stops.length;
  return 1 - stops
    .map((stop, i) => Math.abs(stop.percentile - ((i + 1) / n)))
    .reduce((sum, score) => sum + score, 0);
}

function checkStops(best, n, size, start, data) {
  let stops = getStops(data, n, size, start),
    score = scoreStops(stops);

  if (score > best.score) {
    best.score = score;
    best.stops = stops;
  }
}

function fitDist(data, n, zeroBased) {
  let minVal = data[0].value,
    maxVal = data[data.length - 1].value,
    maxSize = Math.ceil((maxVal - minVal) / n);

  let best = {
    max: maxVal,
    min: minVal,
    score: -1,
    stops: []
  };


  // TODO: Improve stop checking performance by eliminating unlikely
  // possibilities.
  for (let size = 1; size <= maxSize; size++) {
    if (zeroBased) {
      checkStops(best, n, size, size, data);
    } else {
      for (let start = minVal; start + size * (n - 2) < maxVal; start++)
        checkStops(best, n, size, start, data);
    }
  }

  return best;
}

app.server.use('/styleselect.css',
  express.static('node_modules/styleselect/css/styleselect.css'));
app.server.use('/styleselect.js',
  express.static('node_modules/styleselect/js/styleselect.js'));

app.server.use(express.static('src/public/explore'));

app.server.get('/config.js', (req, res) => {
  res.header('Content-Type', 'text/javascript');
  res.send('mapboxgl.accessToken = "' + process.env.MAPBOX_TOKEN + '";');
});

app.server.get('/demographics.json', (req, res) => {
  res.header('Content-Type', 'application/json');
  db.DemographicSummary.findAll({
    where: {
      region: process.env.BIKEMOVES_REGION
    },
    order: [
      ['category', 'ASC'],
      ['row_order', 'ASC']
    ]
  }).then((summaries) => {
    let result = {};

    summaries.forEach((summary) => {
      let category = summary.category.replace('_', '-');
      if (typeof result[category] === 'undefined') result[category] = [];

      result[category].push({
        description: summary.description,
        users: summary.users,
        trips: summary.trips,
        distance: summary.distance
      });
    });

    res.json(result);
  });
});

app.server.get('/map.json', (req, res) => {
  res.header('Content-Type', 'application/json');

  let speed = getDist('mean_speed').then((rows) => fitDist(rows, 5, false)),
    trips = getDist('trips').then((rows) => fitDist(rows, 5, true)),
    users = getDist('users').then((rows) => fitDist(rows, 5, true));

  Promise.all([speed, trips, users])
    .then((results) => {
      res.json({
        speed: results[0],
        trips: results[1],
        users: results[2]
      });
    });
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
