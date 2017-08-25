const db = require('./db.js');

class Analysis {
  constructor() {}

  getResults() {
    return Promise.all([
      this.getDemographicQuery('age', [
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
      ]),
      this.getDemographicQuery('gender', [
        'Not Specified',
        'Male',
        'Female'
      ]),
      this.getDemographicQuery('cycling_experience', [
        'Not Specified',
        'Beginner',
        'Intermediate',
        'Advanced'
      ]),
      this.getTripCountQuery()
    ]).then((queries) => {
      return {
        demographics: {
          age: queries[0],
          gender: queries[1],
          cycling_experience: queries[2]
        },
        stats: {
          trip_count: queries[3]
        }
      };
    });
  }

  select(sql) {
    return db.sequelize.query(sql, {type: db.sequelize.QueryTypes.SELECT});
  }

  getDemographicQuery(variable, labels) {
    let values = labels.map((label, i) => {
        return `(${i}, '${label}')`;
      }).join(', '),
      sql = `
        SELECT description,
          users,
          round((users::double precision /
            sum(users) OVER () * 100)::numeric, 1) AS pct_users,
          trips,
          round((trips::double precision /
            sum(trips) OVER () * 100)::numeric, 1) AS pct_trips,
          miles,
          round((miles::double precision /
            sum(miles) OVER () * 100)::numeric, 1) AS pct_miles
        FROM (
          SELECT labels.description,
            count(DISTINCT usr.id) AS users,
            count(DISTINCT trip.id) AS trips,
            round(sum(ST_Length(route_leg.geom_proj) /
              5280)::numeric, 1) AS miles
          FROM (
            VALUES ${values}
          ) AS labels (code, description)
          LEFT JOIN public.user AS usr
            ON coalesce(usr.${variable}, 0) = labels.code
          INNER JOIN trip
            ON trip.user_id = usr.id
              AND trip.match_status = 'Matched'
          INNER JOIN route_leg
            ON route_leg.trip_id = trip.id
          GROUP BY labels.code,
            labels.description
          ORDER BY labels.code = 0,
            labels.code
        ) AS stats;`;

    return this.select(sql);
  }

  getTripCountQuery() {
    let sql = `
      SELECT trip_count,
        count(*) AS users
      FROM (
        SELECT user_id,
          count(*) trip_count
        FROM trip
        WHERE match_status = 'Matched'
        GROUP BY user_id
      ) AS counts
      GROUP BY trip_count
      ORDER BY trip_count;`;

    return this.select(sql);
  }
}

if (require.main === module) {
  let analysis = new Analysis();
  analysis.getResults().then((results) => console.log(results));
}
