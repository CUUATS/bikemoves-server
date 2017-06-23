const Sequelize = require('sequelize');
// Define models.
var WGS_84 = {
    type: 'name',
    properties: {
      name: 'EPSG:4326'
    }
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
  sequelize = new Sequelize(
    process.env.POSTGRES_DB,
    process.env.POSTGRES_USER,
    process.env.POSTGRES_PASSWORD, {
      dialect: 'postgres',
      host: process.env.POSTGRES_HOST,
      port: parseInt(process.env.POSTGRES_PORT)
    }
  ),
  User = sequelize.define('user', {
    deviceUuid: {
      type: Sequelize.STRING,
      field: 'device_uuid',
      allowNull: false
    },
    platformName: {
      type: Sequelize.STRING,
      field: 'platform_name'
    },
    platformVersion: {
      type: Sequelize.FLOAT,
      field: 'platform_version'
    },
    gender: {
      type: Sequelize.INTEGER
    },
    age: {
      type: Sequelize.INTEGER
    },
    cyclingExperience: {
      type: Sequelize.INTEGER,
      field: 'cycling_experience'
    }
  }, {
    classMethods: {
      fromMessage: function(msg) {
        // Round the version number to at most two decimal places.
        var version = (msg.platformVersion) ?
          +(Math.round(msg.platformVersion + 'e+2')  + 'e-2') : null;
        return {
          deviceUuid: msg.deviceUuid,
          platformName: msg.platformName,
          platformVersion: version,
          gender: msg.gender,
          age: msg.age,
          cyclingExperience: msg.cyclingExperience
        };
      }
    },
    freezeTableName: true,
    indexes: [
      {
        type: 'UNIQUE',
        fields: ['device_uuid']
      }
    ],
    underscored: true
  }),

  Trip = sequelize.define('trip', {
    origin: {
      type: Sequelize.INTEGER,
      field: 'origin_type'
    },
    destination: {
      type: Sequelize.INTEGER,
      field: 'destination_type'
    },
    startTime: {
      type: Sequelize.DATE,
      field: 'start_time',
      allowNull: false
    },
    endTime: {
      type: Sequelize.DATE,
      field: 'end_time',
      allowNull: false
    },
    desiredAccuracy: {
      type: Sequelize.INTEGER,
      field: 'desired_accuracy',
      allowNull: false
    },
    transit: {
      type: Sequelize.BOOLEAN
    },
    geom: {
      type: Sequelize.GEOMETRY('LINESTRING', 4326),
      allowNull: false
    },
    debug: {
      type: Sequelize.BOOLEAN,
      field: 'debug'

    },
    appVersion: {
      type: Sequelize.STRING,
      field: 'app_version'
    }
  }, {
    classMethods: {
      fromMessage: function(msg, userID) {
        return {
          origin: msg.origin,
          destination: msg.destination,
          startTime: new Date(msg.startTime.toNumber()),
          endTime: new Date(msg.endTime.toNumber()),
          desiredAccuracy: msg.desiredAccuracy,
          transit: msg.transit,
          geom: toGeoJSON(msg.locations),
          user_id: userID,
          debug: msg.debug,
          appVersion: msg.appVersion
        };
      }
    },
    freezeTableName: true,
    indexes: [
      {
        type: 'SPATIAL',
        method: 'GIST',
        fields: ['geom']
      }
    ],
    underscored: true
  }),

  Route = sequelize.define('route', {
    distance: {
      type: Sequelize.DOUBLE,
    },
    duration: {
      type: Sequelize.DOUBLE,
    },
    confidence: {
      type: Sequelize.DOUBLE,
    },
    geom: {
      type: Sequelize.GEOMETRY('LINESTRING', 4326),
      allowNull: false
    }
  }, {
    classMethods: {
      fromMatch: function(match, tripID) {
        match.geometry.crs = WGS_84;
        return {
          distance: match.distance,
          duration: match.duration,
          confidence: match.confidence,
          geom: match.geometry,
          trip_id: tripID
        };
      }
    },
    freezeTableName: true,
    indexes: [
      {
        type: 'SPATIAL',
        method: 'GIST',
        fields: ['geom']
      }
    ],
    underscored: true
  }),

  Point = sequelize.define('point', {
    accuracy: {
      type: Sequelize.DOUBLE,
      allowNull: false
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
      type: Sequelize.DATE,
      allowNull: false
    },
    event: {
      type: Sequelize.INTEGER
    },
    activity: {
      type: Sequelize.INTEGER
    },
    confidence: {
      type: Sequelize.INTEGER
    },
    geom: {
      type: Sequelize.GEOMETRY('POINT', 4326),
      allowNull: false
    }
  }, {
    classMethods: {
      fromTripMessage: function(tripMsg, tripID) {
        return tripMsg.locations.map(function(location) {
          return {
            accuracy: location.accuracy,
            altitude: location.altitude,
            heading: location.heading,
            moving: location.moving,
            speed: location.speed,
            time: new Date(location.time.toNumber()),
            event: (location.event) ? location.event : null,
            activity: (location.activity) ? location.activity : null,
            confidence: (location.confidence) ? location.confidence : null,
            geom: toGeoJSON(location),
            trip_id: tripID
          };
        });
      }
    },
    freezeTableName: true,
    indexes: [
      {
        type: 'SPATIAL',
        method: 'GIST',
        fields: ['geom']
      }
    ],
    underscored: true
  });

  Incident = sequelize.define('incident', {
    category : {
      type: Sequelize.STRING
    },
    comment:{
      type: Sequelize.TEXT
    },
    time:{
      type: Sequelize.DATE,
      allowNull: false
    },
    geom: {
      type: Sequelize.GEOMETRY("POINT", 4326)
    }
  },{
    classMethods: {
      fromMessage: function(msg, userID){
        return {
          deviceUuid : msg.deviceUuid,
          category : msg.category,
          comment: msg.comment,
          time: new Date(msg.time.toNumber()),
          geom: toGeoJSON(msg.location),
          user_id: userID
        }
      }
    },
  freezeTableName: true,
  indexes: [
    {
      type: 'SPATIAL',
      method: 'GIST',
      fields: ['geom']
    }
  ],
  underscored:true

});

// Set up foreign keys
Trip.belongsTo(User);
Trip.hasMany(Point);
Trip.hasMany(Route);

Incident.belongsTo(User);

// Update models.
sequelize.sync();

exports.User = User;
exports.Trip = Trip;
exports.Route = Route;
exports.Point = Point;
exports.Incident = Incident;
