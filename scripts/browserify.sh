#!/bin/bash

browserify src/public/lib/turf-build.js -s turf > \
  src/public/lib/turf-browser.js
