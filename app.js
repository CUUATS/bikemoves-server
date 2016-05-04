var express = require('express');
var fs = require('fs');
var bodyParser = require('body-parser');
var lzString = require('lz-string');
var app = express();

var pg = require('pg');

var username = process.env.POSTGRES_ENV_POSTGRES_USER;
var password = process.env.POSTGRES_ENV_POSTGRES_PASSWORD;
var addr = process.env.POSTGRES_PORT_5432_TCP_ADDR;
var port = process.env.POSTGRES_PORT_5432_TCP_PORT;
var db = process.env.POSTGRES_ENV_POSTGRES_DB;
var conString = "postgres://" + username + ":" + password + "@" + addr + ":" + port + "/" + db;

var file_path = '/var/bikemoves/trips.json';

app.enable('trust proxy');

app.use(function(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

pg.connect(conString, function(err, client, done) {
    if(err){
      done();
      console.log(err);
      return console.error('error connecting');
    }

    client.query('CREATE TABLE IF NOT EXISTS Users(id serial primary key, device_uuid varchar(255), gender varchar(255), age varchar(255), cycling_experience varchar(255))', function(err, qry){
        client.query('CREATE TABLE IF NOT EXISTS Trip(id serial primary key, user_id integer, origin_type varchar(255), destination_type varchar(255), start_datetime varchar(255), end_datetime varchar(255))', function(err, qry){
            client.query('CREATE TABLE IF NOT EXISTS Point(id serial primary key, trip_id integer, datetime varchar(255), lat float, long float, gps_accuracy float)', function(err, qry){done();});
        });
    });
});

app.use(bodyParser.json());

app.post('/v0.1/trip', function(req, res) {
    var body = req.body;
    if (body.tripData) {
        var tripdata = JSON.parse(lzString.decompressFromBase64(body.tripData));
        if(tripdata.deviceID == null)
          tripdata.deviceID = "none";
fs.appendFile(file_path, JSON.stringify(tripdata, null, 2));
        pg.connect(conString, function(err, client, done) {
            if(err){
              fs.appendFile(file_path, JSON.stringify(tripdata, null, 2));
              done();
              console.log(err);
              return console.error('error connecting');
            }

            client.query('SELECT * FROM Users WHERE device_uuid = \'' + tripdata.deviceID + '\'', function(err, qry){
                if(qry.rows.length==0){
                    client.query('INSERT INTO Users(device_uuid, gender, age, cycling_experience) VALUES ($1, $2, $3, $4) RETURNING id', [tripdata.deviceID, '0', '0', '0'], function(err, qry){
                        var userid = qry.rows[0].id;
                        client.query('INSERT INTO Trip(user_id, origin_type, destination_type, start_datetime, end_datetime) VALUES($1, $2, $3, $4, $5) RETURNING id', [userid, tripdata.from, tripdata.to, tripdata.startTime, tripdata.endTime], function(err, qry){
                            var tripid = qry.rows[0].id;
                            if(tripdata.points.length ==0){
                                done();
                            }
                            else
                            {
                                var statement = "INSERT INTO Point(trip_id, datetime, lat, long, gps_accuracy) VALUES ";
                                for(var i = 0; i < tripdata.points.length; i++){
                                    statement+= "(" + tripid + ", " + tripdata.timestamps[i] + ", " + tripdata.points[i].lat + ", " + tripdata.points[i].lng + ", " + tripdata.acuracys[i] + ")";
                                    if(i!=tripdata.points.length - 1)
                                        statement += ", ";
                                }
                                client.query(statement, function(err, qry){done();});
                            }
                        });
                    });
                }
                else{

                    var userid = qry.rows[0].id;
                    client.query('INSERT INTO Trip(user_id, origin_type, destination_type, start_datetime, end_datetime) VALUES($1, $2, $3, $4, $5) RETURNING id', [userid, tripdata.from, tripdata.to, tripdata.startTime, tripdata.endTime], function(err, qry){
                        var tripid = qry.rows[0].id;
                        if(tripdata.points.length ==0){
                            done();
                        }
                        else
                        {
                            var statement = "INSERT INTO Point(trip_id, datetime, lat, long, gps_accuracy) VALUES ";
                            for(var i = 0; i < tripdata.points.length; i++){
                                statement+= "(" + tripid + ", " + tripdata.timestamps[i] + ", " + tripdata.points[i].lat + ", " + tripdata.points[i].lng + ", " + tripdata.acuracys[i] + ")";
                                if(i!=tripdata.points.length - 1)
                                    statement += ", ";
                            }
                            client.query(statement, function(err, qry){done();});
                        }
                    });
                }
            });
            res.send("Success");
        });
    }
    else{
        res.send("Nothing sent");
    }
});

app.post('/v0.1/user', function(req, res) {
    var body = req.body;
    if (body.userData) {
        var userdata = JSON.parse(lzString.decompressFromBase64(body.userData));
        if(userdata.deviceID ==null)
          userdata.deviceID ="none";
        pg.connect(conString, function(err, client, done) {
            if(err){
              done();
              console.log(err);
              return console.error('error connecting');
            }

            client.query('SELECT * FROM Users WHERE device_uuid = \'' + userdata.deviceID + '\'', function(err, qry){
                if(qry.rows.length==0){
                    client.query('INSERT INTO Users (device_uuid, gender, age, cycling_experience) VALUES ($1, $2, $3, $4)', [userdata.deviceID, userdata.gender, userdata.age, userdata.cycling_experience], function(err, qry){done();});
                }
                else{
                    var userid = qry.rows[0].id;
                    client.query('UPDATE Users SET (gender, age, cycling_experience)=($1, $2, $3) WHERE id=($4)', [userdata.gender, userdata.age, userdata.cycling_experience, userid], function(err, qry){done();});
                }
                res.send("Success");
            });
        });
    }
    else{
        res.send("Nothing sent");
    }
});

app.get('/v0.1/file', function(req, res){
    res.sendFile(file_path, {
    headers: {
      'Content-Type': 'application/json'
    }
  });
});

app.get('/v0.1/trip', function(req, res){
    pg.connect(conString, function(err, client, done) {
        if(err){
          done();
          console.log(err);
          return console.error('error connecting');
        }

        client.query('SELECT * FROM Trip', function(err, qry){
            var str = "There are " + qry.rows.length + " trips\n";
            
            str+=JSON.stringify(qry, null, 2)
            done();
            res.send(str);
        });

    });
});

app.get('/v0.1/point', function(req, res){
    pg.connect(conString, function(err, client, done) {
        if(err){
          done();
          console.log(err);
          return console.error('error connecting');
        }

        client.query('SELECT * FROM Point', function(err, qry){
            var str = "There are " + qry.rows.length + " points\n";
            
            str+=JSON.stringify(qry, null, 2)
            done();
            res.send(str);
        });

    });
});

app.get('/v0.1/user', function(req, res){
    pg.connect(conString, function(err, client, done) {
        if(err){
          done();
          console.log(err);
          return console.error('error connecting');
        }

        client.query('SELECT * FROM Users', function(err, qry){
            var str = "There are " + qry.rows.length + " users\n";
            
            str+=JSON.stringify(qry, null, 2)
            done();
            res.send(str);
        });

    });
});


app.get('/v0.1/clear', function(req, res){
    pg.connect(conString, function(err, client, done) {
        if(err){
          done();
          console.log(err);
          return console.error('error connecting');
        }

        client.query('DROP TABLE Users, Trip, Point', function(err, qry){
            client.query('CREATE TABLE IF NOT EXISTS Users(id serial primary key, device_uuid varchar(255), gender varchar(255), age varchar(255), cycling_experience varchar(255))', function(err, qry){
                client.query('CREATE TABLE IF NOT EXISTS Trip(id serial primary key, user_id integer, origin_type varchar(255), destination_type varchar(255), start_datetime varchar(255), end_datetime varchar(255))', function(err, qry){
                    client.query('CREATE TABLE IF NOT EXISTS Point(id serial primary key, trip_id integer, datetime varchar(255), lat float, long float, gps_accuracy float)', function(err, qry){
                        done();
                        res.send("Cleared");
                    });
                });
            });
        });

    });
});

app.listen(8888);
