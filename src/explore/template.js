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
    title: 'Bicycle Parking',
    type: 'base'
  },
  {
    id: 'bike-path',
    title: 'Bicycle Facility',
    type: 'base'
  }
];
const USER_FILTERS = [
  {
    variables: ['age'],
    values: ['years'],
    examples: [
      'age>=35',
      'age<45'
    ]
  },
  {
    variables: ['experience'],
    values: ['beginner', 'intermediate', 'advanced', 'unspecified'],
    examples: [
      'experience=beginner',
      'experience=advanced'
    ]
  },
  {
    variables: ['gender'],
    values: ['male', 'female', 'other', 'unspecified'],
    examples: [
      'gender=female',
      'gender=male'
    ]
  },
  {
    variables: ['user'],
    values: ['id'],
    examples: [
      'user=1',
      'user=23'
    ]
  },
];
const TRIP_FILTERS = [
  {
    variables: ['date'],
    values: ['yyyy-mm-dd'],
    examples: [
      'date>=2017-01-01',
      'date<=2017-08-31'
    ]
  },
  {
    variables: ['distance'],
    values: ['miles'],
    examples: [
      'distance>2.5',
      'distance<=1.0'
    ]
  },
  {
    variables: ['duration'],
    values: ['hh:mm'],
    examples: [
      'duration>=01:00',
      'duration<=00:30'
    ]
  },
  {
    variables: ['origin', 'destination'],
    values: [
      'home',
      'work',
      'k12',
      'university',
      'shopping',
      'other',
      'unspecified'
    ],
    examples: [
      'origin=home',
      'destination=work'
    ]
  },
  {
    variables: ['start', 'end'],
    values: ['hh:mm'],
    examples: [
      'start>=08:00',
      'end<=15:45'
    ]
  },
  {
    variables: ['trip'],
    values: ['id'],
    examples: [
      'trip=10',
      'trip=55'
    ]
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

function getMapViews(req) {
  let views = MAP_VIEWS.slice();
  if (auth.checkPermission(req, auth.PERM_VIEW_TRIP_DETAILS))
    views.push({
      id: 'details',
      title: 'Trip Details',
      description: ''
    });
  return views;
}

function getMapLayers(req) {
  let layers = MAP_LAYERS.slice();
  if (auth.checkPermission(req, auth.PERM_VIEW_TRIP_DETAILS))
    layers = [
      {
        id: 'tracepoint',
        title: 'Matched Tracepoint',
        type: 'trip'
      },
      {
        id: 'leg',
        title: 'Matched Route',
        type: 'trip',
        layers: [
          '0 to 3 MPH',
          '4 to 6 MPH',
          '7 to 9 MPH',
          '10 to 12 MPH',
          '13 MPH or higher'
        ]
      },
      {
        id: 'leg-fastest',
        title: 'Fastest Route',
        type: 'trip'
      },
      {
        id: 'point',
        title: 'GPS Points',
        type: 'trip'
      },
      {
        id: 'trip',
        title: 'GPS Trace',
        type: 'trip'
      }
    ].concat(layers);

  return layers;
}

module.exports.serveStatic = serveStatic;
module.exports.middleware = middleware;
module.exports.getMapViews = getMapViews;
module.exports.getMapLayers = getMapLayers;
module.exports.USER_FILTERS = USER_FILTERS;
module.exports.TRIP_FILTERS = TRIP_FILTERS;
