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


-- Find the closeset vertex to the start and end points of each trip.
CREATE VIEW trip_vertex AS
SELECT trip_id,
  sum(CASE WHEN point_type = 'start' THEN vertex_id ELSE NULL END) AS start_id,
  sum(CASE WHEN point_type = 'end' THEN vertex_id ELSE NULL END) AS end_id
FROM (
  SELECT DISTINCT ON (endpoint.trip_id, endpoint.point_type)
    endpoint.trip_id,
    endpoint.point_type,
    vertex.id AS vertex_id
  FROM (
    SELECT trip.id AS trip_id,
      'start' AS point_type,
      ST_StartPoint(trip.geom_proj) AS geom
    FROM trip
    UNION SELECT trip.id AS trip_id,
      'end' AS point_type,
      ST_EndPoint(trip.geom_proj) AS geom
    FROM trip
  ) AS endpoint
  LEFT JOIN ways_vertices_pgr AS vertex
    ON ST_DWithin(endpoint.geom, vertex.geom_proj, 1320)
  ORDER BY endpoint.trip_id,
    endpoint.point_type,
    ST_Distance(endpoint.geom, vertex.geom_proj)
) AS nearest
GROUP BY trip_id;


-- First attempt a cost scheme based on the average distance of points
-- to the way. This doesn't work because one point can be very close to the
-- way, but the trip does not use it (e.g., a cross street).
-- SELECT way.gid AS id,
--   way.source,
--   way.target,
--   way.length_m * least(sum(ST_Distance(point.geom_proj, way.geom_proj))/count(*)/100, 1) AS cost
-- FROM trip
-- LEFT JOIN ways AS way
--   ON ST_DWithin(way.geom_proj, ST_Envelope(trip.geom_proj), 1320)
-- LEFT JOIN point
--   ON trip.id = point.trip_id
--     AND ST_DWithin(point.geom_proj, way.geom_proj, 100)
-- WHERE trip.id = 23
-- GROUP BY way.gid;

-- Second attempt: check the distance to the trip line at the start, end, and
-- midpoint of each way.
CREATE TABLE route_pgr AS
SELECT row_number() OVER () AS gid,
  trip_id,
  ST_LineMerge(ST_Collect(geom)) AS geom
FROM (
  SELECT trip_id,
    way.geom_proj AS geom
  FROM (
    SELECT trip_id,
      (pgr_dijkstra('
        SELECT way.gid AS id,
          way.source,
          way.target,
          way.length_m * (least(ST_Distance(
              ST_StartPoint(way.geom_proj), trip.geom_proj), 100) +
            least(ST_Distance(
              ST_EndPoint(way.geom_proj), trip.geom_proj), 100) +
            least(ST_Distance(
              ST_LineInterpolatePoint(way.geom_proj, 0.5), trip.geom_proj), 100)
          )/300 AS cost
        FROM trip
        LEFT JOIN ways AS way
          ON ST_DWithin(way.geom_proj, trip.geom_proj, 1320)
        WHERE trip.id = ' || trip_vertex.trip_id::text,
      trip_vertex.start_id::int, trip_vertex.end_id::int, directed := false)) AS step
    FROM trip_vertex
    WHERE start_id <> end_id
      AND start_id IS DISTINCT FROM NULL
      AND end_id IS DISTINCT FROM NULL
  ) AS route
  LEFT JOIN ways AS way
    ON (route.step).edge = way.gid
  WHERE (step).edge > 0
  ORDER BY trip_id, (step).seq
) AS seg
GROUP BY trip_id
ORDER BY trip_id;

ANALYZE route_pgr;

SELECT Populate_Geometry_Columns(TRUE);
