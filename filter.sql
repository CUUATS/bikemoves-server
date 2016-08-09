CREATE TEMP TABLE rTable (id int,trip geometry) on commit drop;

DO
$filter$
DECLARE item RECORD;
BEGIN
FOR item in SELECT trip_id FROM public.point GROUP BY trip_id ORDER BY trip_id LOOP
DROP TABLE IF EXISTS spikeFilter;
CREATE TEMP TABLE spikeFilter
on commit drop AS 
WITH segs
AS (SELECT
  seg.start_point,
  seg.end_point,
  ST_MAKELINE(seg.pt1, seg.pt2) AS line,
  DEGREES(ST_AZIMUTH(seg.pt1, seg.pt2)) AS azimuth,
  ST_DISTANCE(seg.pt1, seg.pt2) * 1000 AS dist
FROM (SELECT
  pts.id AS start_point,
  pts2.id AS end_point,
  pts.geom AS pt1,
  pts2.geom AS pt2
FROM public.point AS pts
JOIN public.point AS pts2
  ON pts2.id = pts.id + 1
WHERE pts.trip_id = item.trip_id
AND pts2.trip_id = item.trip_id) AS seg),
spiked 
AS (SELECT row_number() over() as id,* 
FROM(
SELECT 
  segs1.start_point AS start_point,
  segs1.end_point AS end_point,
  segs1.azimuth AS azimuth,
  segs1.line AS line,
  ABS(ABS(segs2.azimuth - segs1.azimuth) + 180 % 360 - 180) AS dif
FROM segs AS segs1
JOIN segs AS segs2
  ON segs1.end_point = segs2.start_point
WHERE ABS(ABS(segs2.azimuth - segs1.azimuth) + 180 % 360 - 180) < 20
UNION ALL
SELECT workAround.start_point AS start_point,
  workAround.end_point AS end_point,
  workAround.azimuth AS azimuth,
  workAround.line AS line,
  0 as dif
  FROM(SELECT* FROM segs ORDER BY start_point DESC LIMIT 1) as workAround
) as  dupl),
 points AS (
SELECT *
FROM (
SELECT start_point
FROM spiked
UNION
SELECT end_point
FROM spiked
) as points
ORDER BY start_point
)

SELECT  row_number() OVER () AS row, t.* FROM public.point as t
  INNER JOIN points as tr
	ON t.id = tr.start_point;

DROP TABLE IF EXISTS smooth;	
CREATE TEMPORARY TABLE smooth
on commit drop AS 	
WITH vectors AS (
SELECT pt.id,pt.geom AS pt, nextPt.geom AS nextPt, farPt.geom AS farPt, mdPt.id AS mdPt
FROM spikeFilter as pt
JOIN spikeFilter as nextPt
ON pt.row = nextPt.row-1
JOIN spikeFilter as mdPt
ON pt.row = mdPt.row-2
JOIN spikeFilter as farPt
ON pt.row = farPt.row-3

), difs AS (
SELECT id, mdpt, ABS(ABS(DEGREES(ST_AZIMUTH(pt, nextPt)) - DEGREES(ST_AZIMUTH(nextPt, farPT))) + 180 % 360 - 180) AS dif
FROM vectors
), lag1 AS (
SELECT *, (CASE WHEN dif < 20 THEN 5 ELSE 0 END ) AS flag
FROM difs
) 

SELECT *
FROM lag1;
DO
$flags$
BEGIN
FOR i IN 1..4 LOOP
With new AS(
	SELECT id,(CASE WHEN dif < 20 - LAG(flag,1) OVER (ORDER BY id)- LAG(flag,2) OVER ()- LAG(flag,3) OVER () - LAG(flag,4) OVER () THEN 5 ELSE 1 END) AS calced
	FROM smooth)
	
	UPDATE smooth set flag = new.calced
	FROM new
	WHERE smooth.id = new.id;
END LOOP;
END 
$flags$;

ALTER TABLE spikeFilter add flag int;

WITH removals AS(
SELECT id, flag 
FROM smooth
WHERE flag = 5
)

UPDATE spikeFilter set flag = removals.flag
FROM removals
WHERE removals.id = spikeFilter.id;

DELETE FROM spikeFilter 
WHERE flag = 5;

DROP TABLE IF EXISTS filterTrip;
CREATE TEMP TABLE filterTrip
on commit DROP as

WITH trip AS(
SELECT gps.trip_id, ST_MAKELINE(gps.geom)
	FROM spikeFilter as gps
	GROUP BY gps.trip_id
)

SELECT *
FROM trip;

INSERT INTO rTable
SELECT * FROM filtertrip;
END LOOP;
END 
$filter$;

SELECT *
FROM rTable





	