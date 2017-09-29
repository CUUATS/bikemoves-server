const Sequelize = require('sequelize'),
  geo = require('./geo.js');

// Define models.
const sequelize = new Sequelize(
  process.env.POSTGRES_DB,
  process.env.POSTGRES_USER,
  process.env.POSTGRES_PASSWORD, {
    dialect: 'postgres',
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT),
    logging: false
  }
);

const User = sequelize.define('user', {
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
  freezeTableName: true,
  indexes: [
    {
      type: 'UNIQUE',
      fields: ['device_uuid']
    }
  ],
  underscored: true
});

User.fromMessage = function(msg) {
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
};

const Trip = sequelize.define('trip', {
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
  alternatives: {
    type: Sequelize.ARRAY(Sequelize.STRING)
  },
  region: {
    type: Sequelize.STRING
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

Trip.fromMessage = function(msg, user, region) {
  return {
    origin: msg.origin,
    destination: msg.destination,
    startTime: new Date(msg.startTime.toNumber()),
    endTime: new Date(msg.endTime.toNumber()),
    desiredAccuracy: msg.desiredAccuracy,
    transit: msg.transit,
    geom: geo.toGeoJSON(msg.locations),
    user_id: user.id,
    debug: msg.debug,
    appVersion: msg.appVersion,
    region: region,
    gender: user.gender || 0,
    age: user.age || 0,
    cyclingExperience: user.cyclingExperience || 0
  };
};

const Point = sequelize.define('point', {
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
  'event': {
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

Point.fromTripMessage = function(tripMsg, tripID) {
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
};

const Incident = sequelize.define('incident', {
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

Incident.fromMessage = function(msg, userID){
  return {
    deviceUuid : msg.deviceUuid,
    category : msg.category,
    comment: msg.comment,
    time: new Date(msg.time.toNumber()),
    geom: geo.toGeoJSON(msg.location),
    user_id: userID
  }
};

const RouteLeg = sequelize.define('route_leg', {
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
    field: 'speed_outlier'
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
});

const RouteTracepoint = sequelize.define('route_tracepoint', {
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
});

Edge = sequelize.define('edge', {
  gid: {
    type: Sequelize.INTEGER,
    primaryKey: true
  },
  region: {
    type: Sequelize.STRING
  },
  users: {
    type: Sequelize.INTEGER
  },
  trips: {
    type: Sequelize.INTEGER
  },
  mean_speed: {
    type: Sequelize.DOUBLE
  },
  users_age_ns: {
    type: Sequelize.INTEGER
  },
  users_age_0_15: {
    type: Sequelize.INTEGER
  },
  users_age_15_19: {
    type: Sequelize.INTEGER
  },
  users_age_20_24: {
    type: Sequelize.INTEGER
  },
  users_age_25_34: {
    type: Sequelize.INTEGER
  },
  users_age_35_44: {
    type: Sequelize.INTEGER
  },
  users_age_45_54: {
    type: Sequelize.INTEGER
  },
  users_age_55_64: {
    type: Sequelize.INTEGER
  },
  users_age_65_74: {
    type: Sequelize.INTEGER
  },
  users_age_75_plus: {
    type: Sequelize.INTEGER
  },
  users_gender_ns: {
    type: Sequelize.INTEGER
  },
  users_gender_male: {
    type: Sequelize.INTEGER
  },
  users_gender_female: {
    type: Sequelize.INTEGER
  },
  users_gender_other: {
    type: Sequelize.INTEGER
  },
  users_experience_ns: {
    type: Sequelize.INTEGER
  },
  users_experience_beginner: {
    type: Sequelize.INTEGER
  },
  users_experience_intermediate: {
    type: Sequelize.INTEGER
  },
  users_experience_advanced: {
    type: Sequelize.INTEGER
  },
  geom: {
    type: Sequelize.GEOMETRY('LINESTRING', 4326),
    allowNull: false
  }
}, {
  freezeTableName: true,
  indexes: [
    {
      fields: ['region']
    },
    {
      type: 'SPATIAL',
      method: 'GIST',
      fields: ['geom']
    }
  ],
  underscored: true
});

const DemographicSummary = sequelize.define('demographic_summary', {
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
    },
    {
      fields: ['region', 'category', 'description'],
      unique: true
    }
  ],
  underscored: true
});

// Set up foreign keys
Trip.belongsTo(User);
Trip.hasMany(Point);
Point.belongsTo(Trip);
Incident.belongsTo(User);
RouteLeg.belongsTo(Trip);
RouteLeg.belongsTo(Point, {as: 'startPoint'});
RouteLeg.belongsTo(Point, {as: 'endPoint'});
RouteTracepoint.belongsTo(Trip);
RouteTracepoint.belongsTo(Point);

function initViews() {
  let sql = `
    CREATE OR REPLACE VIEW edge_trip AS
    SELECT edge.gid,
      trip.id AS trip_id,
      trip.user_id,
      trip.age,
      trip.gender,
      trip.cycling_experience,
      avg(leg.speed) AS mean_speed
    FROM edge
    INNER JOIN (
      SELECT edge_node.edge_gid,
        leg_node.leg_id
      FROM edge_node
      INNER JOIN (
        SELECT id AS leg_id,
          unnest(nodes) AS node_id
        FROM route_leg
        WHERE speed_outlier = FALSE
      ) AS leg_node
        ON edge_node.node_id = leg_node.node_id
      GROUP BY edge_node.edge_gid,
        leg_node.leg_id
      HAVING count(*) > 1
    ) AS leg_edge
      ON leg_edge.edge_gid = edge.gid
    INNER JOIN route_leg AS leg
      ON leg.id = leg_edge.leg_id
    INNER JOIN trip
      ON leg.trip_id = trip.id
    GROUP BY edge.gid,
      trip.id;`;

  return sequelize.query(sql, {type: sequelize.QueryTypes.RAW});
}

// Update models.
function prepare(retries) {
  if (retries === undefined) retries = 5;
  return sequelize.authenticate()
    .then(() => sequelize.sync())
    .then(initViews)
    .catch((e) => {
      if (e.name != 'SequelizeConnectionRefusedError') throw e.name;
      if (retries === 0) return reject('Database unavailable');
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
exports.Edge = Edge;
exports.DemographicSummary = DemographicSummary;
exports.prepare = prepare;
