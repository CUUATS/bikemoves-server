var express = require('express');
var fs = require('fs');
var bodyParser = require('body-parser');
var lzString = require('lz-string');
var app = express();

var file_path = '/var/bikemoves/trips.json';

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
  if (body.tripData) {
    var data = JSON.parse(lzString.decompressFromBase64(body.tripData));
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
