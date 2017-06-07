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
SELECT *,
  false AS break,
  0 AS segment
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
      WHERE trip_id = 474
    ) AS neighbors
    WHERE ST_Distance(prev_geom_proj, geom_proj) > 10
  ) AS deduped
) AS angle_measure
WHERE angle >= 90;

-- Find inflection points
UPDATE point_filtered AS pt
SET break = true
FROM (
  SELECT trip_id,
    (ST_DumpPoints(ST_SimplifyVW(ST_MakeLine(geom ORDER BY time), 10^5))).geom AS geom
  FROM point_filtered
  GROUP BY trip_id
) AS inflection
WHERE inflection.trip_id = pt.trip_id
  AND inflection.geom = pt.geom;

-- Set segment numbers
UPDATE point_filtered AS pt
SET segment = segment.index
FROM (
  SELECT id,
    sum(break::integer) OVER (PARTITION BY trip_id ORDER BY time) AS index
  FROM point_filtered
  ORDER BY time
) segment
WHERE pt.id = segment.id;

-- Identify vertex candidates.
DROP TABLE IF EXISTS break_vertex;
CREATE TABLE break_vertex AS
SELECT *
FROM (
  SELECT *,
    row_number() OVER (PARTITION BY trip_id, segment ORDER BY cost) AS priority
  FROM (
    SELECT trip_id,
      segment,
      vertex_id,
      min(cost) AS cost
    FROM (
      SELECT breakpoint.trip_id,
        breakpoint.segment,
        (CASE WHEN ST_LineLocatePoint(way.geom_proj, breakpoint.geom) <= 0.5 THEN
          way.source ELSE way.target END)::int AS vertex_id,
        ST_Distance(breakpoint.geom, way.geom_proj) *
          least(avg(ST_Distance(neighbor.geom, way.geom_proj)/300), 1)
          AS cost
      FROM point_filtered AS breakpoint
      LEFT JOIN ways AS way
        ON ST_DWithin(breakpoint.geom, way.geom_proj, 1320)
      LEFT JOIN point_filtered AS neighbor
        ON neighbor.trip_id = breakpoint.trip_id
          AND (neighbor.segment = breakpoint.segment
            OR neighbor.segment = breakpoint.segment - 1)
          AND ST_DWithin(neighbor.geom, way.geom_proj,
            least(neighbor.accuracy, 300))
      WHERE breakpoint.break = true
      GROUP BY breakpoint.trip_id,
        breakpoint.segment,
        breakpoint.geom,
        way.gid
    ) AS candidates
    GROUP BY trip_id,
      segment,
      vertex_id
  ) AS way_cost
) AS way_priority
WHERE priority <= 5;

-- Inspect vertex candidates.
SELECT bv.*,
  vertex.geom_proj AS geom
FROM break_vertex AS bv
LEFT JOIN ways_vertices_pgr AS vertex
  ON bv.vertex_id = vertex.id;

-- Find the least cost routes between the candidate vertices for each segment.
DROP TABLE IF EXISTS route_step;
CREATE TABLE route_step AS
SELECT trip_id,
  segment,
  (pgr_dijkstra('
    WITH pt AS (
      SELECT *
      FROM point_filtered
      WHERE trip_id = ' || bv.trip_id::text || '
        AND (segment = ' || bv.segment::text || '
          OR (segment = ' || bv.segment::text || ' + 1
          AND break = TRUE))
    ) SELECT way.gid AS id,
      way.source,
      way.target,
      way.length_m * avg(least(ST_Distance(way.geom_proj, pt.geom), 300)) / 300 AS cost
    FROM (
      SELECT ST_Envelope(ST_Collect(geom)) AS geom
      FROM pt
    ) AS envelope
    LEFT JOIN ways AS way
      ON ST_DWithin(way.geom_proj, envelope.geom, 1320)
    LEFT JOIN pt
      ON ST_DWithin(way.geom_proj, pt.geom, least(pt.accuracy, 300))
    GROUP BY way.gid,
      way.source,
      way.target,
      way.length_m',
  array_agg(vertex_id),
  lead(array_agg(vertex_id)) OVER (PARTITION BY trip_id ORDER BY segment),
  directed := false)).*
FROM break_vertex AS bv
GROUP BY trip_id,
  segment;

-- Find the least cost paths between the starting and ending vertex candidates
-- using the identified steps as the ways.
DROP TABLE IF EXISTS route_candidate;
CREATE TABLE route_candidate AS
SELECT start_segment.trip_id,
  (pgr_dijkstra('
    SELECT row_number() OVER () AS id,
      start_vid AS source,
      end_vid AS target,
      agg_cost AS cost
    FROM route_step AS step
    WHERE edge = -1
      AND trip_id = ' || start_segment.trip_id::text,
  start_segment.vids,
  end_segment.vids,
  directed := false)).*
FROM (
  SELECT trip_id,
    array_agg(vertex_id) AS vids
  FROM break_vertex AS bv
  WHERE segment = 1
  GROUP BY trip_id
) AS start_segment
LEFT JOIN (
  SELECT bv.trip_id,
    array_agg(bv.vertex_id) AS vids
  FROM break_vertex AS bv
  INNER JOIN (
    SELECT trip_id,
      max(segment) AS max_segment
    FROM break_vertex AS bv
    GROUP BY trip_id
  ) AS segment_info
    ON bv.trip_id = segment_info.trip_id
      AND bv.segment = segment_info.max_segment
  GROUP BY bv.trip_id
) AS end_segment
  ON start_segment.trip_id = end_segment.trip_id;

-- Inspect selected vertices.
SELECT rc.*,
  vertex.geom_proj AS geom
FROM route_candidate AS rc
INNER JOIN (
  SELECT start_vid,
    end_vid
  FROM route_candidate AS rc
  WHERE edge = -1
  ORDER BY agg_cost
  LIMIT 1
) AS least_cost
  ON rc.start_vid = least_cost.start_vid
    AND rc.end_vid = least_cost.end_vid
LEFT JOIN ways_vertices_pgr AS vertex
  ON vertex.id = rc.node
ORDER BY rc.path_seq;

-- Inspect selected ways.
SELECT rs.*,
  way.geom_proj AS geom
FROM (
  SELECT rc.path_seq AS seq,
    rc.node AS start_vid,
    lead(rc.node) OVER (PARTITION BY rc.trip_id ORDER BY rc.path_seq) AS end_vid
  FROM route_candidate AS rc
  INNER JOIN (
    SELECT start_vid,
      end_vid
    FROM route_candidate AS rc
    WHERE edge = -1
    ORDER BY agg_cost
    LIMIT 1
  ) AS least_cost
    ON rc.start_vid = least_cost.start_vid
      AND rc.end_vid = least_cost.end_vid
) AS segment
LEFT JOIN route_step AS rs
  ON rs.start_vid = segment.start_vid
    AND rs.end_vid = segment.end_vid
INNER JOIN ways AS way
  ON rs.edge = way.gid
ORDER BY segment.seq,
  rs.path_seq;
