var express = require('express');
var fs = require('fs');
var bodyParser = require('body-parser');
var lzString = require('lz-string');
var sqlite3 = require('sqlite3').verbose();
var db = new sqlite3.Database('bikemoves.db');
var app = express();

var file_path = '/var/bikemoves/trips.json';

db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='User'",
       function(err, rows) {
  if(err !== null) {
    console.log(err);
  }
  else if(rows === undefined) {
    db.run('CREATE TABLE "User" ' +
           '("id" INTEGER PRIMARY KEY AUTOINCREMENT, ' +
           '"device_uuid" VARCHAR(255), ' +
           '"gender" CHARACTER, ' +
           '"age" INTEGER, ' +
           '"cycling_experience" VARCHAR(255))', function(err) {
      if(err !== null) {
        console.log(err);
      }
      else {
        console.log("SQL Table 'User' initialized.");
      }
    });
  }
  else {
    console.log("SQL Table 'User' already initialized.");
  }
});

db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='Trip'",
       function(err, rows) {
  if(err !== null) {
    console.log(err);
  }
  else if(rows === undefined) {
    db.run('CREATE TABLE "Trip" ' +
           '("id" INTEGER PRIMARY KEY AUTOINCREMENT, ' +
           '"user_id" INTEGER, ' +
           '"origin_type" VARCHAR(255), ' +
           '"destination_type" VARCHAR(255), ' +
           '"start_datetime" TIMESTAMP, ' +
           '"end_datetime" TIMESTAMP, ' +
           '"trip_geom" VARCHAR(255))', function(err) {
      if(err !== null) {
        console.log(err);
      }
      else {
        console.log("SQL Table 'Trip' initialized.");
      }
    });
  }
  else {
    console.log("SQL Table 'Trip' already initialized.");
  }
});

db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='Trip_point'",
       function(err, rows) {
  if(err !== null) {
    console.log(err);
  }
  else if(rows === undefined) {
    db.run('CREATE TABLE "Trip_point" ' +
           '("id" INTEGER PRIMARY KEY AUTOINCREMENT, ' +
           '"trip_id" INTEGER, ' +
           '"datetime" TIMESTAMP, ' +
           '"gps_accuracy" FLOAT, ' +
           '"geom" VARCHAR(255))', function(err) {
      if(err !== null) {
        console.log(err);
      }
      else {
        console.log("SQL Table 'User' initialized.");
      }
    });
  }
  else {
    console.log("SQL Table 'User' already initialized.");
  }
});

app.enable('trust proxy');

app.use(function(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

app.use(bodyParser.json());

app.post('/v0.1/trip', function(req, res) {
  var body = req.body;
  fs.exists(file_path, function(exists) {
    if(!exists){
      fs.mkdir(file_path, function(error){});
    }
  });
  if (body.tripData) {
    var data = JSON.parse(lzString.decompressFromBase64(body.tripData));
    //var data = JSON.parse(body.tripData);
    fs.appendFile(file_path, JSON.stringify(data, null, 2));
  }
  res.send('Trip saved');
});

app.get('/v0.1/trip', function(req, res){
  res.sendFile(file_path, {
    headers: {
      'Content-Type': 'application/json'
    }
  });
});

app.listen(8888);
