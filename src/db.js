const pg = require('pg');
pg.defaults.parseInt8 = true;

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
    logging: false,
    operatorsAliases: false
  }
);

const AGE_CHOICES = [
  'Not Specified',
  'Under 15',
  '15 to 19',
  '20 to 24',
  '25 to 34',
  '35 to 44',
  '45 to 54',
  '55 to 64',
  '65 to 74',
  '75 and older'
];

const GENDER_CHOICES = [
  'Not Specified',
  'Male',
  'Female',
  'Other'
];

const CYCLING_EXPERIENCE_CHOICES = [
  'Not Specified',
  'Beginner',
  'Intermediate',
  'Advanced'
];

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
  matchDistance: {
    type: Sequelize.DOUBLE,
    field: 'match_distance'
  },
  fastestStatus: {
    type: Sequelize.STRING,
    field: 'fastest_status'
  },
  fastestDistance: {
    type: Sequelize.DOUBLE,
    field: 'fastest_distance'
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
      fields: ['id']
    },
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
      fields: ['id']
    },
    {
      fields: ['route_type']
    },
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

const Node = sequelize.define('node', {
  id: {
    type: Sequelize.BIGINT,
    primaryKey: true
  },
  endpoint: {
    type: Sequelize.BOOLEAN
  },
  geom: {
    type: Sequelize.GEOMETRY('LINESTRING', 4326),
    allowNull: false
  }
}, {
  freezeTableName: true,
  indexes: [
    {
      fields: ['id']
    },
    {
      type: 'SPATIAL',
      method: 'GIST',
      fields: ['geom']
    }
  ],
  underscored: true
});

const Edge = sequelize.define('edge', {
  refs: {
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
      fields: ['id']
    },
    {
      fields: ['refs'],
      using: 'gin'
    },
    {
      type: 'SPATIAL',
      method: 'GIST',
      fields: ['geom']
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
RouteLeg.belongsToMany(Edge, {through: 'route_leg_edge'});
Edge.belongsToMany(RouteLeg, {through: 'route_leg_edge'});

function initViews() {
  let views_sql = [
    `CREATE OR REPLACE VIEW edge_trip AS
    SELECT rle.edge_id,
        trip.id AS trip_id,
        leg.route_type = 'Match' AS is_match,
        avg(speed) AS mean_speed,
        CASE WHEN trip.match_distance > 0
          AND trip.fastest_distance > 0
          AND trip.match_distance / trip.fastest_distance >= 0.8
          AND trip.match_distance / trip.fastest_distance <= 1.5
          THEN CASE WHEN leg.route_type = 'Match' THEN 1 ELSE -1 END
          ELSE 0 END AS preference
      FROM route_leg_edge AS rle
      INNER JOIN route_leg AS leg
        ON rle.route_leg_id = leg.id
          AND (leg.speed_outlier IS NOT DISTINCT FROM NULL
            OR leg.speed_outlier = FALSE)
      INNER JOIN trip
        ON leg.trip_id = trip.id
      GROUP BY rle.edge_id,
        leg.route_type,
        trip.id;`
  ];

  return Promise.all(views_sql.map(
    (sql) => sequelize.query(sql, {type: sequelize.QueryTypes.RAW})));
}

function getQueryOptions(options) {
  return Object.assign({
    minUsers: 0,
    region: process.env.BIKEMOVES_REGION
  }, options || {});
}

function insertIntoRouteLegEdge() {
  let sql = `
  INSERT INTO route_leg_edge (
    SELECT DISTINCT now() AS created_at,
      now() AS updated_at,
      segment.route_leg_id,
      edge.id AS edge_id
    FROM edge
    INNER JOIN (
      SELECT route_leg_id,
        node_id AS start_id,
        lead(node_id, 1) OVER
          (PARTITION BY route_leg_id ORDER BY node_idx) AS end_id
      FROM (
        SELECT route_leg_id,
          node_id,
          node_idx
        FROM (
          SELECT leg.id AS route_leg_id,
            node.id AS node_id,
            node.idx AS node_idx
          FROM route_leg AS leg,
            unnest(leg.nodes) WITH ORDINALITY node(id, idx)
          WHERE leg.id NOT IN (
            SELECT DISTINCT route_leg_id
            FROM route_leg_edge
          ) AND node.id IN (
            SELECT DISTINCT id
            FROM node
          )
        ) AS leg_node
      ) AS filtered
    ) AS segment
    ON edge.refs @> ARRAY[SEGMENT.start_id, segment.end_id]
      AND segment.end_id IS DISTINCT FROM NULL
  );`;

  return sequelize.query(sql, {type: sequelize.QueryTypes.RAW});
}

function postMatchAnalyze() {
  let sql = [
    'ANALYZE route_leg;',
    'ANALYZE route_leg_edge;',
    'ANALYZE route_tracepoint;'
  ];

  return Promise.all(sql.map(
    (sql) => sequelize.query(sql, {type: sequelize.QueryTypes.RAW})));
}

function getDemographics(trip_column, choices, options) {
  options = getQueryOptions(options);

  let sql = `
    SELECT choices.description,
      count(DISTINCT trip.user_id) AS users,
      count(DISTINCT trip.id) AS trips,
      round(sum(route_leg.distance * 0.000621371)::numeric,
        1)::double precision AS distance
    FROM unnest(ARRAY['${choices.join("', '")}'])
      WITH ORDINALITY choices(description, code)
    INNER JOIN trip
      ON coalesce(trip.${trip_column}, 0) = choices.code - 1
        AND trip.match_status = 'OK'
        AND trip.region = '${options.region}'
    INNER JOIN route_leg
      ON route_leg.trip_id = trip.id
        AND NOT route_leg.speed_outlier
    GROUP BY choices.code,
      choices.description
    ORDER BY choices.code = 1,
      choices.code;`;

  return sequelize.query(sql, {type: sequelize.QueryTypes.SELECT});
}

function getTripCount(options) {
  options = getQueryOptions(options);

  let sql = `
    SELECT trip_count::character varying AS description,
      count(*) AS users,
      trip_count AS trips,
      NULL AS distance
    FROM (
      SELECT user_id,
        count(*) trip_count
      FROM trip
      WHERE match_status = 'OK'
        AND region = '${options.region}'
      GROUP BY user_id
    ) AS counts
    GROUP BY trip_count
    ORDER BY trip_count;`;

  return sequelize.query(sql, {type: sequelize.QueryTypes.SELECT});
}

function getEdgeSQL(options) {
  options = getQueryOptions(options);

  let sql = `
    SELECT edge_info.users,
      edge_info.trips,
      edge_info.mean_speed,
      edge_info.preference,
      edge.length,
      edge.geom
      FROM (
        SELECT edge_trip.edge_id,
          count(DISTINCT CASE WHEN edge_trip.is_match
            THEN trip.user_id ELSE NULL END)::integer AS users,
          count(DISTINCT CASE WHEN edge_trip.is_match
            THEN trip.id ELSE NULL END)::integer AS trips,
          coalesce(avg(CASE WHEN edge_trip.is_match
            THEN edge_trip.mean_speed ELSE NULL END), 0) * 2.23694
            AS mean_speed,
          coalesce(sum(edge_trip.preference), 0) AS preference
        FROM edge
        INNER JOIN edge_trip
          ON edge_trip.edge_id = edge.id
        INNER JOIN trip
          ON edge_trip.trip_id = trip.id
            AND trip.region = '${options.region}'
        GROUP BY edge_trip.edge_id
        ) AS edge_info
      INNER JOIN edge
        ON edge.id = edge_info.edge_id`;

  if (options.minUsers)
    sql = `SELECT
        CASE WHEN users >= ${options.minUsers} THEN users ELSE 0 END AS users,
        CASE WHEN users >= ${options.minUsers} THEN trips ELSE 0 END AS trips,
        mean_speed,
        preference,
        length,
        geom
      FROM (${sql}) AS unfiltered`;

  return sql;
}

function getEdgeStatistics(column, options, min) {
  let where = (column != 'preference') ? `WHERE ${column} > 0` : '';
  let sql = `
    SELECT ${column}::int AS value,
      sum(length) * 0.000621371 AS count
    FROM (${getEdgeSQL(options)}) AS edge_info
    ${where}
    GROUP BY value
    ORDER BY value;`;

  return sequelize.query(sql, {type: sequelize.QueryTypes.SELECT});
}

function getEdgeTileSQL(options) {
  return `
    SELECT users,
      trips,
      mean_speed,
      preference,
      ST_AsGeoJSON(geom) AS the_geom_geojson
    FROM (${getEdgeSQL(options)}) AS edge_info
    WHERE ST_Intersects(geom, !bbox_4326!)`;
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

exports.AGE_CHOICES = AGE_CHOICES;
exports.GENDER_CHOICES = GENDER_CHOICES;
exports.CYCLING_EXPERIENCE_CHOICES = CYCLING_EXPERIENCE_CHOICES;
exports.sequelize = sequelize;
exports.Op = Sequelize.Op;
exports.User = User;
exports.Trip = Trip;
exports.Point = Point;
exports.Incident = Incident;
exports.RouteLeg = RouteLeg;
exports.RouteTracepoint = RouteTracepoint;
exports.Edge = Edge;
exports.prepare = prepare;
exports.insertIntoRouteLegEdge = insertIntoRouteLegEdge;
exports.postMatchAnalyze = postMatchAnalyze;
exports.getDemographics = getDemographics;
exports.getTripCount = getTripCount;
exports.getEdgeStatistics = getEdgeStatistics;
exports.getEdgeTileSQL = getEdgeTileSQL;
