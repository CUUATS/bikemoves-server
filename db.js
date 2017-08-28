const Sequelize = require('sequelize'),
  geo = require('./geo.js');

// Define models.
var sequelize = new Sequelize(
    process.env.POSTGRES_DB,
    process.env.POSTGRES_USER,
    process.env.POSTGRES_PASSWORD, {
      dialect: 'postgres',
      host: process.env.POSTGRES_HOST,
      port: parseInt(process.env.POSTGRES_PORT),
      logging: false
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
    },
    matchStatus: {
      type: Sequelize.STRING,
      field: 'match_status'
    },
    region: {
      type: Sequelize.STRING
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
          geom: geo.toGeoJSON(msg.locations),
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
            geom: geo.toGeoJSON(location),
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
  }),

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
  }, {
    classMethods: {
        fromMessage: function(msg, userID){
          return {
            deviceUuid : msg.deviceUuid,
            category : msg.category,
            comment: msg.comment,
            time: new Date(msg.time.toNumber()),
            geom: geo.toGeoJSON(msg.location),
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
  }),

  RouteLeg = sequelize.define('route_leg', {
    matching: {
      type: Sequelize.INTEGER,
    },
    leg: {
      type: Sequelize.INTEGER,
    },
    distance: {
      type: Sequelize.DOUBLE,
    },
    duration: {
      type: Sequelize.DOUBLE,
    },
    speed: {
      type: Sequelize.DOUBLE,
    },
    speedOutlier: {
      type: Sequelize.BOOLEAN,
    },
    routeType: {
      type: Sequelize.STRING,
      field: 'route_type'
    },
    nodes: {
      type: Sequelize.ARRAY(Sequelize.BIGINT)
    },
    geom: {
      type: Sequelize.GEOMETRY('LINESTRING', 4326),
      allowNull: false
    }
  }, {
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

  RouteTracepoint = sequelize.define('route_tracepoint', {
    geom: {
      type: Sequelize.GEOMETRY('POINT', 4326),
      allowNull: false
    }
  }, {
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

  DemographicSummary = sequelize.define('demographic_summary', {
    region: {
      type: Sequelize.STRING
    },
    category: {
      type: Sequelize.STRING
    },
    rowOrder: {
      type: Sequelize.INTEGER,
      field: 'row_order'
    },
    description: {
      type: Sequelize.STRING
    },
    users: {
      type: Sequelize.INTEGER
    },
    trips: {
      type: Sequelize.INTEGER
    },
    distance: {
      type: Sequelize.DOUBLE
    }
  }, {
    freezeTableName: true,
    indexes: [
      {
        fields: ['region']
      }
    ],
    underscored: true
  });

// Set up foreign keys
Trip.belongsTo(User);
Trip.hasMany(Point);
Incident.belongsTo(User);
RouteLeg.belongsTo(Trip);
RouteLeg.belongsTo(Point, {as: 'startPoint'});
RouteLeg.belongsTo(Point, {as: 'endPoint'});
RouteTracepoint.belongsTo(Trip);
RouteTracepoint.belongsTo(Point);

// Update models.
function prepare(retries) {
  if (retries === undefined) retries = 5;
  return sequelize.authenticate()
    .then(() => sequelize.sync())
    .catch(() => {
      if (retries === 0) return reject();
      console.log('Database unavailable: ' + (retries - 1) + ' more tries');
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          prepare(retries - 1).then(resolve);
        }, 3000);
      });
    });
};

exports.sequelize = sequelize;
exports.User = User;
exports.Trip = Trip;
exports.Point = Point;
exports.Incident = Incident;
exports.RouteLeg = RouteLeg;
exports.RouteTracepoint = RouteTracepoint;
exports.DemographicSummary = DemographicSummary;
exports.prepare = prepare;
