#!/bin/bash

SOURCE=http://download.geofabrik.de
EXTRACT=illinois-latest
PROFILE=bicycle
DATA=/osrm
MODULE=./node_modules/osrm
BIN=$MODULE/lib/binding

mkdir -p $DATA
curl -o $DATA/$EXTRACT.osm.pbf $SOURCE/north-america/us/$EXTRACT.osm.pbf

$BIN/osrm-extract -p $MODULE/profiles/$PROFILE.lua $DATA/$EXTRACT.osm.pbf
$BIN/osrm-contract $DATA/$EXTRACT.osrm

rm $DATA/$EXTRACT.osm.pbf
