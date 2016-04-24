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

    client.query('CREATE TABLE IF NOT EXISTS User(id serial primary key, device_uuid varchar(255), gender character, age integer, cycling_experience integer)', function(err, qry){});
    client.query('CREATE TABLE IF NOT EXISTS Trip(id serial primary key, user_id integer, origin_type varchar(255), destination_type varchar(255), start_datetime timestamp, end_datetime timestamp)', function(err, qry){});
    client.query('CREATE TABLE IF NOT EXISTS Point(id serial primary key, trip_id integer, datetime timestamp, lat float, long float, gps_accuracy float)', function(err, qry){});

});

app.use(bodyParser.json());

app.post('/v0.1/trip', function(req, res) {
    var body = req.body;
    if (body.tripData) {
        var tripdata = JSON.parse(lzString.decompressFromBase64(body.tripData));

        pg.connect(conString, function(err, client, done) {
            if(err){
              fs.appendFile(file_path, JSON.stringify(tripdata, null, 2));
              done();
              console.log(err);
              return console.error('error connecting');
            }

            client.query('SELECT * FROM User WHERE device_uuid = \'' + userdata.deviceID + '\'', function(err, qry){
                if(qry.rows.length==0){
                    client.query('INSERT INTO User(device_uuid, gender, age, cycling_experience) values($1, $2, $3, $4)', [tripdata.deviceID, '0', 0, 0], function(err, qry){
                        client.query('SELECT * FROM User WHERE device_uuid = ' + tripdata.deviceID, function(err, qry){

                            var userid = qry.rows[0].id;
                            client.query('INSERT INTO Trip(user_id, origin_type, destination_type, start_datetime, end_datetime) values($1, $2, $3, $4, $5)', [userid, tripdata.from, tripdata.to, tripdata.startTime, tripdata.endTime], function(err, qry){
                                client.query('SELECT * FROM Trip WHERE user_id = ' + userid + ' AND start_datetime = ' + tripdata.startTime, function(err, qry){
                                    var tripid = qry.rows[0].id;
                                    for(var i = 0; i < tripdata.points.length; i++){
                                        client.query('INSERT INTO Point(trip_id, lat, lat) values($1, $2, $3)', [tripid, tripdata.points[i].lat, tripdata.points[i].lng], function(err, qry){});
                                    }
                                });
                            });

                        });
                    });
                }
                else{

                    var userid = qry.rows[0].id;
                    client.query('INSERT INTO Trip(user_id, origin_type, destination_type, start_datetime, end_datetime) values($1, $2, $3, $4, $5)', [userid, tripdata.from, tripdata.to, tripdata.startTime, tripdata.endTime], function(err, qry){
                        client.query('SELECT * FROM Trip WHERE user_id = ' + userid + ' AND start_datetime = ' + tripdata.startTime, function(err, qry){
                            var tripid = qry.rows[0].id;
                            for(var i = 0; i < tripdata.points.length; i++){
                                client.query('INSERT INTO Point(trip_id, lat, long, datetime, gps_accuracy) values($1, $2, $3, $4, $5)', [tripid, tripdata.points[i].lat, tripdata.points[i].lng, tripdata.timestamps[i], tripdata.accuracys[i]], function(err, qry){});
                            }
                        });
                    });

                }
            });

        });
    }
});

app.post('/v0.1/user', function(req, res) {
    var body = req.body;
    if (body.userData) {
        var userdata = JSON.parse(lzString.decompressFromBase64(body.userData));
        pg.connect(conString, function(err, client, done) {
            if(err){
              done();
              console.log(err);
              return console.error('error connecting');
            }

            client.query('SELECT * FROM User WHERE device_uuid = \'' + userdata.deviceID + '\'', function(err, qry){
                if(qry.rows.length==0){
                    client.query('INSERT INTO User(device_uuid, gender, age, cycling_experience) values($1, $2, $3, $4)', [userdata.deviceID, userdata.gender, userdata.age, userdata.cycling_experience], function(err, qry){});
                }
                else{
                    var userid = qry.rows[0].id;
                    client.query('UPDATE User SET (gender, age, cycling_experience)=($1, $2, $3) WHERE id=($4)', [userdata.gender, userdata.age, userdata.cycling_experience, userid], function(err, qry){});
                }
            });

        });
    }
});

app.get('/v0.1/trip', function(req, res){
  /*res.sendFile(file_path, {
    headers: {
      'Content-Type': 'application/json'
    }
  });*/
    pg.connect(conString, function(err, client, done) {
        if(err){
          done();
          console.log(err);
          return console.error('error connecting');
        }

        client.query('SELECT * FROM Trip', function(err, qry){
            var str = "There are " + qry.rows.length + " users \n";
            
            str+=JSON.stringify(qry, null, 2)
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

        /*client.query('SELECT * FROM User', function(err, qry){
            var str = "There are " + qry.rows.length + " users \n";
            for(var j=0; j < qry.fields.length; j++){
                str+= qry.fields[j].name + "\t";
            }
            str+='\n';
            for(var i=0; i < qry.rows.length; i++){
                for(var j=0; j < qry.fields.length; j++){
                    str+= qry.rows[i]. + "\t";
                }
                str+= "\n";
            }
            res.send(str);
        });*/
        client.query('SELECT * FROM User', function(err, qry){
            var str = "There are " + qry.rows.length + " users \n";
            
            str+=JSON.stringify(qry, null, 2)
            res.send(str);
        });

    });
});

app.listen(8888);
