var express = require('express'),
  Sequelize = require('sequelize'),
  bodyParser = require('body-parser'),
  lzString = require('lz-string'),
  app = express(),
  sequelize = new Sequelize(
    process.env.POSTGRES_ENV_POSTGRES_DB,
    process.env.POSTGRES_ENV_POSTGRES_USER,
    process.env.POSTGRES_ENV_POSTGRES_PASSWORD, {
      dialect: 'postgres',
      host: process.env.POSTGRES_PORT_5432_TCP_ADDR,
      port: process.env.POSTGRES_PORT_5432_TCP_PORT
    }
  );

// Set up middleware.
app.enable('trust proxy');
app.use(function(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept');
  next();
});
app.use(bodyParser.json());

// Define models.
var modelOptions = {
  freezeTableName: true,
  timestamps: false,
  underscored: true
},

User = sequelize.define('user', {
  deviceUUID: {
    type: Sequelize.STRING,
    field: 'device_uuid'
  },
  gender: {
    type: Sequelize.STRING
  },
  age: {
    type: Sequelize.STRING
  },
  cyclingExperience: {
    type: Sequelize.STRING,
    field: 'cycling_experience'
  }
}, modelOptions),

Trip = sequelize.define('trip', {
  originType: {
    type: Sequelize.STRING,
    field: 'origin_type'
  },
  destinationType: {
    type: Sequelize.STRING,
    field: 'destination_type'
  },
  startTime: {
    type: Sequelize.DATE,
    field: 'start_time'
  },
  endTime: {
    type: Sequelize.DATE,
    field: 'end_time'
  },
  desiredAccuracy: {
    type: Sequelize.INTEGER,
    field: 'desired_accuracy'
  },
  transit: {
    type: Sequelize.BOOLEAN
  },
  geom: {
    type: Sequelize.GEOMETRY('LINESTRING', 4326)
  }
}, modelOptions),

Point = sequelize.define('point', {
  accuracy: {
    type: Sequelize.DOUBLE
  },
  altitude: {
    type: Sequelize.DOUBLE
  },
  heading: {
    type: Sequelize.DOUBLE
  },
  moving: {
    type: Sequelize.BOOLEAN
  },
  speed: {
    type: Sequelize.DOUBLE
  },
  time: {
    type: Sequelize.DATE
  },
  geom: {
    type: Sequelize.GEOMETRY('POINT', 4326)
  }
}, modelOptions);

// Set up foreign keys.
Trip.belongsTo(User);
Trip.hasMany(Point);

// Update models.
sequelize.sync({force: true});

// Helper functions
var WGS_84 = {
    type: 'name',
    properties: {
      name: 'EPSG:4326'
    }
  },
  extractData = function(body) {
    if (!body.data) throw 'Data key is empty';
    // return JSON.parse(lzString.decompressFromBase64(body.data));
    return body.data;
  },
  toGeoJSON = function(locations) {
    if (Array.isArray(locations)) {
      return {
        type: 'LineString',
        coordinates: locations.map(function(location) {
          return [location.longitude, location.latitude]
        }),
        crs: WGS_84
      };
    }
    return {
      type: 'Point',
      coordinates: [locations.longitude, locations.latitude],
      crs: WGS_84
    };
  },
  makeTrip = function(tripData, userID) {
    return {
      originType: tripData.origin,
      destinationType: tripData.destination,
      startTime: new Date(tripData.startTime),
      endTime: new Date(tripData.endTime),
      desiredAccuracy: tripData.desiredAccuracy,
      transit: tripData.transit,
      geom: toGeoJSON(tripData.locations),
      user_id: userID
    };
  },
  makePoints = function(locations, tripID) {
   return locations.map(function(location) {
     return {
       accuracy: location.accuracy,
       altitude: location.altitude,
       heading: location.heading,
       moving: location.moving,
       speed: location.speed,
       time: new Date(location.time),
       geom: toGeoJSON(location),
       trip_id: tripID
     };
   });
  };

app.post('/v0.1/user', function(req, res) {
  var userData = extractData(req.body),
    createdUser;
  if (!userData.deviceUUID) throw 'Missing device UUID';

  User.findOrCreate({
    where: {deviceUUID: userData.deviceUUID}
  }).spread(function(user, created) {
    createdUser = created;
    return user.update(userData);
  }).then(function() {
    res.send(((createdUser) ? 'Created' : 'Updated') + ' user');
  });
});

app.post('/v0.1/trip', function(req, res) {
  var tripData = extractData(req.body);
  if (!tripData.deviceUUID) throw 'Missing device UUID';

  User.findOrCreate({
    where: {deviceUUID: tripData.deviceUUID}
  }).spread(function(user, created) {
    return Trip.create(makeTrip(tripData, user.id));
  }).then(function(trip) {
    return Point.bulkCreate(makePoints(tripData.locations, trip.id));
  }).then(function() {
    res.send('Saved trip');
  });
});

app.listen(8888);
