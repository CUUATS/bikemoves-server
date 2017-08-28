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

  update(sql) {
    return db.sequelize.query(sql, {type: db.sequelize.QueryTypes.UPDATE});
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
        this.insertTripCount(),
        this.updateEdgeTripStatistics(),
        this.updateEdgeUserStatistics()
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
            round(sum(route_leg.distance * 0.000621371)::numeric, 1)
              AS distance,
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

  updateEdgeTripStatistics() {
    let sql = `
      UPDATE edge
      SET trips = summary.trips,
        users = summary.users,
        mean_speed = summary.mean_speed
      FROM (
        SELECT edge_trip.gid,
          count(DISTINCT edge_trip.trip_id) AS trips,
          count(DISTINCT edge_trip.user_id) AS users,
          avg(edge_trip.mean_speed) AS mean_speed
        FROM edge_trip
        GROUP BY edge_trip.gid
      ) AS summary
      WHERE edge.gid = summary.gid;`;

    return this.update(sql);
  }

  updateEdgeUserStatistics() {
    let sql = `
      UPDATE edge
      SET users_age_ns = summary.user_age_ns,
        users_age_0_15 = summary.users_age_0_15,
        users_age_15_19 = summary.users_age_15_19,
        users_age_20_24 = summary.users_age_20_24,
        users_age_25_34 = summary.users_age_25_34,
        users_age_35_44 = summary.users_age_35_44,
        users_age_45_54 = summary.users_age_45_54,
        users_age_55_64 = summary.users_age_55_64,
        users_age_65_74 = summary.users_age_65_74,
        users_age_75_plus = summary.users_age_75_plus,
        users_gender_ns = summary.user_gender_ns,
        users_gender_male = summary.users_gender_male,
        users_gender_female = summary.users_gender_female,
        users_gender_other = summary.users_gender_other,
        users_experience_ns = summary.users_experience_ns,
        users_experience_beginner = summary.users_experience_beginner,
        users_experience_intermediate = summary.users_experience_intermediate,
        users_experience_advanced = summary.users_experience_advanced
      FROM (
        SELECT gid,
          coalesce(sum((usr.age = 0
            OR usr.age IS NOT DISTINCT FROM NULL)::integer), 0) AS user_age_ns,
          coalesce(sum((usr.age = 1)::integer), 0) AS users_age_0_15,
          coalesce(sum((usr.age = 2)::integer), 0) AS users_age_15_19,
          coalesce(sum((usr.age = 3)::integer), 0) AS users_age_20_24,
          coalesce(sum((usr.age = 4)::integer), 0) AS users_age_25_34,
          coalesce(sum((usr.age = 5)::integer), 0) AS users_age_35_44,
          coalesce(sum((usr.age = 6)::integer), 0) AS users_age_45_54,
          coalesce(sum((usr.age = 7)::integer), 0) AS users_age_55_64,
          coalesce(sum((usr.age = 8)::integer), 0) AS users_age_65_74,
          coalesce(sum((usr.age = 9)::integer), 0) AS users_age_75_plus,
          coalesce(sum((usr.gender = 0
            OR usr.gender IS NOT DISTINCT FROM NULL)::integer), 0)
            AS user_gender_ns,
          coalesce(sum((usr.gender = 1)::integer), 0) AS users_gender_male,
          coalesce(sum((usr.gender = 2)::integer), 0) AS users_gender_female,
          coalesce(sum((usr.gender = 3)::integer), 0) AS users_gender_other,
          coalesce(sum((usr.cycling_experience = 0
            OR usr.cycling_experience IS NOT DISTINCT FROM NULL)::integer), 0)
            AS users_experience_ns,
          coalesce(sum((usr.cycling_experience = 1)::integer), 0)
            AS users_experience_beginner,
          coalesce(sum((usr.cycling_experience = 2)::integer), 0)
            AS users_experience_intermediate,
          coalesce(sum((usr.cycling_experience = 3)::integer), 0)
            AS users_experience_advanced
        FROM (
          SELECT DISTINCT gid,
            user_id
          FROM edge_trip
        ) AS edge_user
        INNER JOIN public.user AS usr
          ON edge_user.user_id = usr.id
        GROUP BY edge_user.gid
      ) AS summary
      WHERE edge.gid = summary.gid;`;

    return this.update(sql);
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
