const apicache = require('apicache');
const argon2 = require('argon2');
const assert = require('assert');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const express = require('express');
const flash = require('connect-flash');
const passport = require('passport');
const session = require('express-session');
const MemoryStore = require('memorystore')(session);
const Strategy = require('passport-local').Strategy;
const db = require('./db.js');
const geo = require('./geo.js');
const utils = require('./utils.js');
const Distribution = require('./distribution.js');
const Tilesplash = require('tilesplash');

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
const MENU_ITEMS = [
  {
    id: 'download',
    title: 'Download',
    url: '/download',
    icon: 'download',
    description: 'Get the BikeMoves Illinois mobile app.'
  },
  {
    id: 'demographics',
    title: 'Demographics',
    url: '/demographics',
    icon: 'bar-chart',
    description: "Who's using BikeMoves?"
  },
  {
    id: 'data',
    title: 'Data',
    url: '/data',
    icon: 'map',
    description: 'Explore cycling patterns in our community.'
  }
];
const MAP_VIEWS = [
  {
    id: 'users',
    title: 'Users',
    description: `This view shows the number of unique users that have
      traveled on each segment. Segments ridden by only one user are
      excluded to protect privacy.`
  },
  {
    id: 'trips',
    title: 'Trips',
    description: `This view shows the number of trips that have traveled on
      on a given segment. Segments ridden by only one user are excluded
      to protect privacy.`
  },
  {
    id: 'speed',
    title: 'Average Speed',
    description: `This view shows the average riding speed for segments that
      have been ridden by at least two unique users. The speed includes
      delays, such as waiting for a traffic signal to change.`
  },
  {
    id: 'preference',
    title: 'Preference',
    description: `This view shows differences between the routes chosen by
      users and the fastest routes. The preference score indicates how often
      users have gone out of their way to use (positive score) or
      avoid (negative score) a segment. Only segments with a moderate
      or strong positive or negative preference are shown.`
  }
];
const MAP_LAYERS = [
  {
    id: 'bike-rack',
    title: 'Bicycle Parking'
  },
  {
    id: 'bike-path',
    title: 'Bicycle Facility'
  }
];

function fitDist(column, n, options) {
  return db.getEdgeStatistics(column, EDGE_OPTIONS).then((rows) => {
    let dist = new Distribution(rows);
    return dist.fit(n, options);
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

function getStatistics() {
  return Promise.all([
    fitDist('mean_speed', 5),
    fitDist('trips', 5),
    fitDist('users', 5),
    fitDist('preference', 5, {
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

function getStyles(view) {
  let styles = [
    'https://fonts.googleapis.com/css?family=Montserrat:700%7COpen+Sans'
  ];

  if (view === 'demographics' || view === 'data') {
    styles.push(
      'https://cdn.jsdelivr.net/chartist.js/latest/chartist.min.css');
  }

  if (view === 'data') {
    styles.push('/lib/styleselect.css');
    styles.push(
      'https://api.mapbox.com/mapbox-gl-js/v0.41.0/mapbox-gl.css');
  }

  styles.push('/explore.css');

  return styles;
}

function getScripts(view) {
  let scripts = [
    'https://use.fontawesome.com/e09acc63a3.js'
  ];

  if (view === 'data') {
    scripts.push('/lib/styleselect.js');
    scripts.push('/lib/turf.js');
    scripts.push('https://api.mapbox.com/mapbox-gl-js/v0.41.0/mapbox-gl.js');
  }

  if (view === 'demographics' || view === 'data') {
    scripts.push('/lib/polyfill.js');
    scripts.push(
      'https://cdn.jsdelivr.net/chartist.js/latest/chartist.min.js');
    scripts.push('/data.js');
    scripts.push('/explore.js');
  }

  return scripts;
}

function templateVars(req, res, next) {
  let view = req.path.replace('/', '');
  res.locals.styles = getStyles(view);
  res.locals.scripts = getScripts(view);
  res.locals.user = (req.user) ? {
    username: req.user.username,
    role: req.user.role
  } : null;
  res.locals.menuItems = MENU_ITEMS;
  next();
}

function getWebUser(username) {
  return db.WebUser.find({
    where: {
      username: username,
      region: process.env.BIKEMOVES_REGION
    }
  });
}

utils.serveLib(app.server,
  'node_modules/babel-polyfill/dist/polyfill.min.js', 'polyfill.js');
utils.serveLib(app.server,
  'node_modules/styleselect/css/styleselect.css', 'styleselect.css');
utils.serveLib(app.server,
  'node_modules/styleselect/js/styleselect.js', 'styleselect.js');
utils.serveLib(app.server,
  'src/public/lib/turf-browser.js', 'turf.js');

app.server.use(express.static('src/public/explore'));

passport.use(new Strategy((username, password, cb) => {
  getWebUser(username)
  .then((user) => {
    if (!user || !user.password) return cb(null, false);
    return argon2.verify(user.password, password)
      .then((match) => (match) ? cb(null, user) : cb(null, false));
  })
  .catch((err) => cb(err));
}));

passport.serializeUser((user, cb) => cb(null, user.username));
passport.deserializeUser(function(username, cb) {
  // TODO: Cache user information to avoid hitting the database
  // with every request.
  getWebUser(username)
  .then((user) => (user) ? cb(null, user) : cb(null, false))
  .catch((err) => cb(err));
});

assert((process.env.BIKEMOVES_EXPLORE_SECRET || '').length >= 20,
  'BIKEMOVES_EXPLORE_SECRET must be at least 20 characters');

const inProduction = process.env.BIKEMOVES_DEBUG !== 'true';
if (inProduction) app.server.set('trust proxy', 1);

app.server.use(cookieParser(process.env.BIKEMOVES_EXPLORE_SECRET));
app.server.use(bodyParser.urlencoded({
  extended: true
}));
app.server.use(session({
  cookie: {
    httpOnly: true,
    maxAge: 86400000, // 24 hours
    path: '/',
    secure: inProduction
  },
  resave: false,
  saveUninitialized: false,
  secret: process.env.BIKEMOVES_EXPLORE_SECRET,
  store: new MemoryStore({
    checkPeriod: 86400000 // 24 hours
  })
}));
app.server.use(flash());
app.server.use(passport.initialize());
app.server.use(passport.session());

app.layer('explore', (tile, render) => {
  render({
    edge: EDGE_TILE_SQL
  });
});

app.server.get('/data.js', cache('24 hours'), (req, res) => {
  return Promise.all([
    getDemographics(),
    getStatistics()
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

app.server.set('view engine', 'pug');
app.server.set('views', './src/views/explore');
app.server.use(templateVars);

app.server.get('/login',(req, res) => {
  res.render('login', {
    title: 'Log In',
    id: 'login',
    errorMessages: req.flash('error')
  });
});

app.server.post('/login', passport.authenticate('local', {
    failureFlash: 'Invalid username or password.',
    failureRedirect: '/login',
    successRedirect: '/'
}));

app.server.get('/logout', (req, res) => {
  req.logout();
  res.redirect('/');
});

app.server.get('/', (req, res) => {
  res.render('index', {
    title: 'Home',
    id: 'home',
  });
});

app.server.get('/download', (req, res) => {
  res.render('download', {
    title: 'Download',
    id: 'download',
  });
});

app.server.get('/demographics', (req, res) => {
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

app.server.get('/data', (req, res) => {
  res.render('data', {
    title: 'data',
    id: 'data',
    views: MAP_VIEWS,
    layers: MAP_LAYERS
  });
});

db.prepare()
  .then(() => {
    app.server.listen(8888);
    console.log('BikeMoves Explore is ready');
  });
