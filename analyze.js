const db = require('./db.js');

class Analysis {
  constructor() {}

  runAll() {
    return this.updateDemographics();
  }

  insert(sql) {
    return db.sequelize.query(sql, {type: db.sequelize.QueryTypes.INSERT});
  }

  select(sql) {
    return db.sequelize.query(sql, {type: db.sequelize.QueryTypes.SELECT});
  }

  updateDemographics() {
    return db.DemographicSummary.destroy({
      truncate: true
    }).then(() => {
      return Promise.all([
        this.insertDemographicSummary('age', [
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
        this.insertDemographicSummary('gender', [
          'Not Specified',
          'Male',
          'Female'
        ]),
        this.insertDemographicSummary('cycling_experience', [
          'Not Specified',
          'Beginner',
          'Intermediate',
          'Advanced'
        ]),
        this.insertTripCount()
      ]);
    });
  }

  insertDemographicSummary(variable, labels) {
    let values = labels.map((label, i) => {
        return `(${i}, '${label}')`;
      }).join(', '),
      sql = `
        INSERT INTO demographic_summary (
            region,
            category,
            row_order,
            description,
            users,
            trips,
            distance,
            created_at,
            updated_at) (
          SELECT trip.region,
            '${variable}' AS category,
            labels.code AS row_order,
            labels.description,
            count(DISTINCT usr.id) AS users,
            count(DISTINCT trip.id) AS trips,
            round(sum(ST_Length(route_leg.geom_proj) /
              5280)::numeric, 1) AS distance,
            now() AS created_at,
            now() AS updated_at
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
              AND NOT route_leg.speed_outlier
          GROUP BY labels.code,
            labels.description,
            trip.region
          ORDER BY labels.code = 0,
            labels.code
        );`;

    return this.insert(sql);
  }

  insertTripCount() {
    let sql = `
      INSERT INTO demographic_summary (
          region,
          category,
          row_order,
          description,
          users,
          trips,
          distance,
          created_at,
          updated_at) (
        SELECT region,
          'trip_count' AS category,
          row_number() OVER
            (PARTITION BY region ORDER BY trip_count) AS row_order,
          trip_count::character varying AS description,
          count(*) AS users,
          trip_count AS trips,
          NULL AS distance,
          now() AS created_at,
          now() AS updated_at
        FROM (
          SELECT region,
            user_id,
            count(*) trip_count
          FROM trip
          WHERE match_status = 'Matched'
          GROUP BY region,
            user_id
        ) AS counts
        GROUP BY region,
          trip_count
        ORDER BY trip_count
      );`;

    return this.insert(sql);
  }
}

if (require.main === module) {
  db.prepare()
    .then(() => {
      let analysis = new Analysis();
      analysis.runAll().then(() => {
        console.log('Analysis complete!')
        process.exit();
      });
    });
}
