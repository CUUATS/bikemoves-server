#!/usr/bin/env bash

set -o errexit
cd
cd docker/bikemoves
docker-compose build
docker-compose up
