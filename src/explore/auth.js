const argon2 = require('argon2');
const assert = require('assert');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const flash = require('connect-flash');
const passport = require('passport');
const session = require('express-session');
const MemoryStore = require('memorystore')(session);
const Strategy = require('passport-local').Strategy;
const db = require('../db.js');

const PERM_VIEW_TRIP_DETAILS = 'view trip details';
const ROLEMAP = {
  'user': [PERM_VIEW_TRIP_DETAILS]
};

function checkPermission(req, perm) {
  if (!req.user) return false;
  return ROLEMAP[req.user.role].indexOf(perm) !== -1;
}

function requirePermission(perm) {
  return (req, res, next) => {
    if (!checkPermission(req, perm)) return res.sendStatus(403);
    next();
  };
}

function getWebUser(username) {
  return db.WebUser.find({
    where: {
      username: username,
      region: process.env.BIKEMOVES_REGION
    }
  });
}

function init(app) {
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
  if (inProduction) app.set('trust proxy', 1);

  app.use(cookieParser(process.env.BIKEMOVES_EXPLORE_SECRET));
  app.use(bodyParser.urlencoded({
    extended: true
  }));
  app.use(session({
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
  app.use(flash());
  app.use(passport.initialize());
  app.use(passport.session());
}

module.exports.checkPermission = checkPermission;
module.exports.requirePermission = requirePermission;
module.exports.init = init;
module.exports.PERM_VIEW_TRIP_DETAILS = PERM_VIEW_TRIP_DETAILS;
