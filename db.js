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
          deviceUUID: msg.deviceUuid,
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
