-- Project geometries to Illinois State Plane East (EPSG 3435)
ALTER TABLE point
ADD COLUMN geom_proj geometry(Point, 3435);

CREATE INDEX point_geom_proj
  ON public.point
  USING gist(geom_proj);

UPDATE point
  SET geom_proj = ST_Transform(geom, 3435);

ANALYZE point;

ALTER TABLE trip
ADD COLUMN geom_proj geometry(LineString, 3435);

CREATE INDEX trip_geom_proj
  ON public.trip
  USING gist(geom_proj);

UPDATE trip
  SET geom_proj = ST_Transform(geom, 3435);

ANALYZE trip;

ALTER TABLE ways
ADD COLUMN geom_proj geometry(LineString, 3435);

CREATE INDEX ways_geom_proj
  ON public.ways
  USING gist(geom_proj);

UPDATE ways
  SET geom_proj = ST_Transform(the_geom, 3435);

ANALYZE ways;

ALTER TABLE ways_vertices_pgr
ADD COLUMN geom_proj geometry(Point, 3435);

CREATE INDEX ways_vertices_pgr_geom_proj
  ON public.ways_vertices_pgr
  USING gist(geom_proj);

UPDATE ways_vertices_pgr
  SET geom_proj = ST_Transform(the_geom, 3435);

ANALYZE ways_vertices_pgr;

SELECT Populate_Geometry_Columns(TRUE);

-- Calculate the smaller angle between three points.
CREATE FUNCTION angle(geometry, geometry, geometry) RETURNS double precision
  AS 'SELECT least(az_diff, 360 - az_diff)
  FROM (
    SELECT abs(degrees(ST_Azimuth($2, $1)) - degrees(ST_Azimuth($2, $3)))
      AS az_diff
  ) AS az;'
  LANGUAGE SQL
  IMMUTABLE
  RETURNS NULL ON NULL INPUT;

-- Test the angle function.
SELECT angle(ST_Point(1, 0), ST_Point(0, 0), ST_Point(0, 1))

-- Filter out duplicates and sharp angles.
DROP TABLE IF EXISTS point_filtered;
CREATE TABLE point_filtered AS
WITH filtered AS (
  SELECT *
  FROM (
    SELECT id,
      accuracy * 3.28084 AS accuracy,
      time,
      angle(
        lag(geom_proj) OVER (PARTITION BY trip_id ORDER BY time),
        geom_proj,
        lead(geom_proj) OVER (PARTITION BY trip_id ORDER BY time)) AS angle,
      trip_id,
      geom_proj AS geom
    FROM (
      SELECT *
      FROM (
        SELECT *,
          lag(geom_proj) OVER (PARTITION BY trip_id ORDER BY time)
            AS prev_geom_proj
        FROM point
      ) AS neighbors
      WHERE prev_geom_proj IS NOT DISTINCT FROM NULL
        OR ST_Distance(prev_geom_proj, geom_proj) > 10
    ) AS deduped
  ) AS angle_measure
  WHERE angle IS NOT DISTINCT FROM NULL
    OR angle >= 90
),
inflection AS (
  SELECT trip_id,
    (ST_DumpPoints(ST_SimplifyVW(ST_MakeLine(geom ORDER BY time), 10^5))).geom
      AS geom
  FROM filtered
  GROUP BY trip_id
)
SELECT *,
  sum(break::integer) OVER (PARTITION BY trip_id ORDER BY time) AS segment
FROM (
  SELECT filtered.*,
    inflection.geom IS DISTINCT FROM NULL AS break
  FROM filtered
  LEFT JOIN inflection
    ON inflection.trip_id = filtered.trip_id
      AND inflection.geom = filtered.geom
) AS with_breaks;

CREATE INDEX point_filtered_geom
  ON public.point_filtered
  USING gist(geom);

CREATE INDEX point_filtered_trip_id
  ON public.point_filtered (trip_id);

CREATE INDEX point_filtered_segment
  ON public.point_filtered (segment);

ANALYZE point_filtered;

DROP TABLE IF EXISTS trip_area;
CREATE TABLE trip_area AS
SELECT trip_id,
  ST_Buffer(ST_Envelope(ST_Collect(geom)), 1320) AS geom
FROM point_filtered
GROUP BY trip_id;

CREATE INDEX trip_area_trip_id
  ON public.trip_area (trip_id);

CREATE INDEX trip_area_geom
  ON public.trip_area
  USING gist(geom);

ANALYZE trip_area;

DROP TABLE IF EXISTS trip_vertex;
CREATE TABLE trip_vertex AS
SELECT trip_id,
  pt_id,
  row_number() OVER (PARTITION BY trip_id ORDER BY pt_id) AS segment,
  UNNEST(vertex) AS vertex
FROM (
  SELECT *,
    lag(vertex) OVER (PARTITION BY trip_id ORDER BY pt_id)
      IS DISTINCT FROM vertex AS vertex_change
  FROM (
    SELECT pt.trip_id,
      pt.id AS pt_id,
      array_agg(DISTINCT (CASE WHEN ST_LineLocatePoint(way.geom_proj, pt.geom)
        <= 0.5 THEN way.source ELSE way.target END)::int) AS vertex
    FROM point_filtered AS pt
    INNER JOIN ways AS way
      ON ST_DWithin(pt.geom, way.geom_proj, pt.accuracy + 20)
    WHERE trip_id = 48
    GROUP BY pt.trip_id,
       pt.id
   ) AS candidate
) AS deduped
WHERE vertex_change;

DROP TABLE IF EXISTS vertex_alias;
CREATE TABLE vertex_alias AS
SELECT DISTINCT trip_id,
  segment,
  vertex,
  sum(change::integer) OVER (PARTITION BY trip_id ORDER BY vertex, segment)
    AS alias
FROM (
  SELECT *,
    coalesce(segment -
      lag(segment) OVER (PARTITION BY trip_id, vertex ORDER BY segment)
      > 1, true) AS change
  FROM trip_vertex
) AS vertex_change;

DROP TABLE IF EXISTS segment_step;
CREATE TABLE segment_step AS
SELECT vertex.trip_id,
  vertex.segment,
  vertex.vertex AS start_vid,
  next.vertex AS end_vid,
  (pgr_dijkstra('
    SELECT way.gid AS id,
      way.source,
      way.target,
      way.length_m AS cost
    FROM ways AS way
    INNER JOIN trip_area
      ON trip_area.trip_id = ' || vertex.trip_id::text || '
        AND trip_area.geom && way.geom_proj',
  vertex.vertex,
  next.vertex,
  directed := false)).*
FROM trip_vertex AS vertex
INNER JOIN trip_vertex AS next
  ON next.trip_id = vertex.trip_id
    AND next.segment = vertex.segment + 1;

DROP TABLE IF EXISTS route_step;
CREATE TABLE route_step AS
SELECT start_segment.trip_id,
  (pgr_dijkstra('
    SELECT step.segment AS id,
      start_alias.alias AS source,
      end_alias.alias AS target,
      step.agg_cost AS cost
    FROM segment_step AS step
    LEFT JOIN vertex_alias AS start_alias
      ON start_alias.trip_id = step.trip_id
        AND start_alias.segment = step.segment
        AND start_alias.vertex = step.start_vid
    LEFT JOIN vertex_alias AS end_alias
      ON end_alias.trip_id = step.trip_id
        AND end_alias.segment = step.segment + 1
        AND end_alias.vertex = step.end_vid
    WHERE step.edge = -1
      AND step.trip_id = ' || start_segment.trip_id::text,
  start_segment.aliases,
  end_segment.aliases,
  directed := false)).*
FROM (
  SELECT vertex.trip_id,
    array_agg(alias.alias) AS aliases
  FROM trip_vertex AS vertex
  INNER JOIN vertex_alias AS alias
    ON vertex.trip_id = alias.trip_id
      AND vertex.vertex = alias.vertex
      AND vertex.segment = alias.segment
  WHERE vertex.segment = 1
  GROUP BY vertex.trip_id
) AS start_segment
LEFT JOIN (
  SELECT vertex.trip_id,
    array_agg(alias.alias) AS aliases
  FROM trip_vertex AS vertex
  INNER JOIN vertex_alias AS alias
    ON vertex.trip_id = alias.trip_id
      AND vertex.vertex = alias.vertex
      AND vertex.segment = alias.segment
  INNER JOIN (
    SELECT trip_id,
      max(segment) AS max_segment
    FROM trip_vertex
    GROUP BY trip_id
  ) AS segment_info
    ON vertex.trip_id = segment_info.trip_id
      AND vertex.segment = segment_info.max_segment
  GROUP BY vertex.trip_id
) AS end_segment
  ON start_segment.trip_id = end_segment.trip_id;

DROP TABLE IF EXISTS route;
CREATE TABLE route AS
SELECT row_number() OVER () AS gid,
  ss.trip_id,
  ss.segment,
  row_number() OVER (PARTITION BY ss.trip_id) AS seq,
  ss.node,
  ss.edge,
  ss.cost,
  1 - ss.cost/way.length_m AS confidence,
  way.the_geom AS geom,
  way.geom_proj AS geom_proj
FROM (
  SELECT step.trip_id,
    step.edge AS segment,
    alias.vertex AS start_vid,
    lead(alias.vertex) OVER (PARTITION BY step.trip_id ORDER BY step.seq)
      AS end_vid
  FROM route_step AS step
  INNER JOIN vertex_alias AS alias
    ON step.trip_id = alias.trip_id
      AND step.node = alias.alias
      AND step.edge = alias.segment
  INNER JOIN (
    SELECT DISTINCT ON (trip_id)
      trip_id,
      start_vid,
      end_vid
    FROM route_step
    WHERE edge = -1
    ORDER BY trip_id,
      agg_cost
  ) AS least_cost
    ON step.trip_id = least_cost.trip_id
      AND step.start_vid = least_cost.start_vid
      AND step.end_vid = least_cost.end_vid
) AS segment
LEFT JOIN segment_step AS ss
  ON ss.trip_id = segment.trip_id
    AND ss.segment = segment.segment
    AND ss.start_vid = segment.start_vid
    AND ss.end_vid = segment.end_vid
INNER JOIN ways AS way
  ON ss.edge = way.gid
ORDER BY
  ss.trip_id,
  ss.segment,
  ss.path_seq;

--
-- WITH example (trip_id, segment, vertex) AS (
--   VALUES (1, 1, 1),
--     (1, 2, 2),
--     (1, 3, 3),
--     (1, 3, 4),
--     (1, 4, 4),
--     (1, 5, 4),
--     (1, 5, 5),
--     (1, 6, 5),
--     (1, 6, 2),
--     (1, 7, 2),
--     (1, 7, 4)
-- )
-- SELECT trip_id,
--   segment,
--   vertex,
--   sum(change::integer) OVER (PARTITION BY trip_id ORDER BY vertex, segment)
-- FROM (
--   SELECT *,
--     coalesce(segment -
--       lag(segment) OVER (PARTITION BY trip_id, vertex ORDER BY segment)
--       > 1, true) AS change
--   FROM example
-- ) AS vertex_change
