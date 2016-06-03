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
    process.env.POSTGRES_ENV_POSTGRES_DB,
    process.env.POSTGRES_ENV_POSTGRES_USER,
    process.env.POSTGRES_ENV_POSTGRES_PASSWORD, {
      dialect: 'postgres',
      host: process.env.POSTGRES_PORT_5432_TCP_ADDR,
      port: process.env.POSTGRES_PORT_5432_TCP_PORT
    }
  ),
  User = sequelize.define('user', {
    deviceUUID: {
      type: Sequelize.STRING,
      field: 'device_uuid'
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
      type: Sequelize.STRING
    },
    age: {
      type: Sequelize.STRING
    },
    cyclingExperience: {
      type: Sequelize.STRING,
      field: 'cycling_experience'
    }
  }, {
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
  }, {
    classMethods: {
      fromMessage: function(msg, userID) {
        return {
          originType: msg.origin,
          destinationType: msg.destination,
          startTime: new Date(msg.startTime),
          endTime: new Date(msg.endTime),
          desiredAccuracy: msg.desiredAccuracy,
          transit: msg.transit,
          geom: toGeoJSON(msg.locations),
          user_id: userID
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
            time: new Date(location.time),
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

// Set up foreign keys.
Trip.belongsTo(User);
Trip.hasMany(Point);

// Update models.
sequelize.sync();

exports.User = User;
exports.Trip = Trip;
exports.Point = Point;
