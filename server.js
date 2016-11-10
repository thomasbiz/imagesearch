var express = require('express');
var bodyParser = require('body-parser');
var request = require('request');
var app = express();

var mongodb = require('mongodb');
var MongoClient = mongodb.MongoClient;

app.use(bodyParser.urlencoded({ extended: true }));

var connectDB = function(req, res, next) {
    MongoClient.connect(process.env.MONGOLAB_URI, function(err, db) {
       if (err) {
           res.status(500).send(JSON.stringify({'error': 'internal server error'}));
           console.error('Unable to connect to mongodb, URI: ' + process.env.MONGOLAB_URI);
       } else {
           res.on('finish', function() {
               db.close();
               console.log('Closed db.');
           })
           console.log('We have db!');
           req.db = db;
           next();
       }
    }); 
}

app.use(connectDB);

var IMGUR_API = 'https://api.imgur.com/3/gallery/search/top'

app.get('/api/imagesearch/:query', function(req, res) {
    var offset = 0;
    if (req.query.offset) {
        offset = req.query.offset;
    }
    var query = req.params.query;
    
    req.db.collection('search').insertOne({ term: query, when: new Date() }, function(err, r) {
        if (err) {
            res.status(500).send(JSON.stringify({'error': 'internal server error'}));
            console.log(err);
            return;
        }
        
        
        var auth = 'Client-ID ' + process.env.IMGUR_CLIENTID;
        var url = IMGUR_API + offset + '?q=' + query;
        var options = {
            url: url,
            headers: {
                Authorization: auth
            }
        };
        request.get(options, function(error, response, body) {
            var data = JSON.parse(body).data;
            var output = data.map(function(img) {
                return { url: img.link, snippet: img.title, context: 'https://imgur.com/user/' + img.account_url }
            });
            res.send(output);
        });        
    });
    

});

app.get('/api/latest/imagesearch', function(req, res) {
    req.db.collection('search').find({}).project({_id:0}).toArray(function(err, docs) {
        if (err) {
            res.status(500).send(JSON.stringify({'error': 'internal server error'}));
            console.log(err);
        } else {
            res.json(docs);
        }
    });
    
});

app.listen(process.env.PORT, function() {
    console.log('- Listening on port ' + process.env.PORT);
});