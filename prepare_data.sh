#!/bin/bash

EXTRACT=illinois-latest
PROFILE=bicycle

mkdir -p ./data
curl -o ./data/$EXTRACT.osm.pbf http://download.geofabrik.de/north-america/us/$EXTRACT.osm.pbf

./node_modules/osrm/lib/binding/osrm-extract \
  -p ./node_modules/osrm/profiles/$PROFILE.lua ./data/$EXTRACT.osm.pbf
./node_modules/osrm/lib/binding/osrm-contract ./data/$EXTRACT.osrm

rm ./data/$EXTRACT.osm.pbf
