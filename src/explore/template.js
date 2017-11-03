const express = require('express');
const path = require('path');
const auth = require('./auth.js');

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

function getStyles(req) {
  return [
    'https://fonts.googleapis.com/css?family=Montserrat:700%7COpen+Sans',
    '/explore.css'
  ];
}

function getScripts(req) {
  let view = req.path.replace('/', '');
  let scripts = [
    'https://use.fontawesome.com/e09acc63a3.js'
  ];

  if (view === 'demographics' || view === 'data') {
    scripts.push('/config.js');
    scripts.push('/explore.js');
  }

  return scripts;
}

function serveStatic(app) {
  app.use(express.static('dist/explore'));
}

function middleware(req, res, next) {
  res.locals.styles = getStyles(req);
  res.locals.scripts = getScripts(req);
  res.locals.user = (req.user) ? {
    username: req.user.username,
    role: req.user.role
  } : null;
  res.locals.permissions = {
    'view trip details': auth.checkPermission(req, auth.PERM_VIEW_TRIP_DETAILS)
  };
  res.locals.menuItems = MENU_ITEMS;
  next();
}

module.exports.serveStatic = serveStatic;
module.exports.middleware = middleware;
module.exports.MAP_LAYERS = MAP_LAYERS;
module.exports.MAP_VIEWS = MAP_VIEWS;
