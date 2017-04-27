#!/bin/bash

./node_modules/protobufjs/bin/pbjs -t static-module -w commonjs -o messages.js bikemoves.proto
./node_modules/protobufjs/bin/pbts -o messages.d.ts messages.js
