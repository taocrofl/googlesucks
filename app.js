// TODO switch from guid -> mongo OID
// TODO surrogate id = sha1(OID) expressed as base64url
// TODO bootstrap: create index for guid (make unique)
// TODO cleanup filesystem if request stopped part-way (temp files might still exist)
'use strict';
var express = require('express'),
  assert = require('assert'),
  bodyParser = require('body-parser'),
  fs = require('fs'),
  gm = require('gm'),
  mongodb = require('mongodb'),
  phantom = require('phantom'),
  Promise = require('bluebird'),
  rimrafAsync = Promise.promisify(require('rimraf'));

Promise.promisifyAll(express.response);
Promise.promisifyAll(fs);
Promise.promisifyAll(gm.prototype);
Promise.promisifyAll(mongodb);

var app = express(),
  MongoClient = mongodb.MongoClient,
  MONGO_HOST = process.env.MONGO_HOST,
  MONGO_PORT = process.env.MONGO_PORT,
  MONGO_DB = process.env.MONGO_DB;

var db;

if (!MONGO_HOST) {
  console.log("error: MONGO_HOST not set");
  process.exit(1);
}

if (!MONGO_PORT) {
  console.log("error: MONGO_PORT not set");
  process.exit(1);
}

if (!MONGO_DB) {
  console.log("error: MONGO_DB not set");
  process.exit(1);
}

MongoClient.connect('mongodb://' + MONGO_HOST + ':' + MONGO_PORT + '/' + MONGO_DB, function(err, _db) {
  assert.equal(null, err);
  console.log('Connected to db');
  db = _db;
  start_webserver();
});

function getRandomDir() {
  // http://stackoverflow.com/questions/105034/create-guid-uuid-in-javascript
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  }
  return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
    s4() + '-' + s4() + s4() + s4();
}

function _do_query(query, search_engine, dir) {
  var _ph, _page, url;
  if (search_engine == 'google') {
    url = 'https://google.com/search?q=';
  } else if (search_engine == 'duckduckgo') {
    url = 'https://duckduckgo.com/?q=';
  } else {
    return Promise.reject('unknown search engine ' + search_engine);
  }
  return phantom.create().then(ph => {
    _ph = ph;
    return _ph.createPage();
  }).then(page => {
    _page = page;
    return _page.open(url + query);
  }).then(status => {
    return _page.render(dir + '/' + search_engine + '.png');
  }).then(() => {
    _page.close();
    _ph.exit();
  });
}

function do_query(query, cb) {
  var _promises = [],
    dir = getRandomDir();

  try {
    fs.mkdirSync(dir);
    console.log('created directory ' + dir);
  } catch (e) {
    console.log(e);
  }
  _promises.push(_do_query(query, 'google', dir), _do_query(query, 'duckduckgo', dir));

  Promise.all(_promises).then(() => {
      console.log('printing directory contents of /myapp/' + dir);
      return fs.readdirAsync('/myapp/' + dir);
    })
    .each(f => {
      console.log(f);
    })
    .then(() => {
      return gm('/myapp/' + dir + '/google.png')
        .append('/myapp/' + dir + '/duckduckgo.png', true)
        .writeAsync('/myapp/' + dir + '/new.png');
    })
    .then(() => {
      console.log('calling res.sendFile()');
      return cb.sendFileAsync('/myapp/' + dir + '/new.png');
    })
    .then(() => {
      console.log('renaming file');
      return fs.renameAsync('/myapp/' + dir + '/new.png', '/myapp/' + dir + '.png');
    })
    .then(() => {
      console.log('adding mongo entry');
      return db.collection(MONGO_DB).insertAsync([{
        query: query,
        guid: dir
      }]);
    })
    .then(() => {
      console.log('removing dir');
      return rimrafAsync(dir);
    })
    .then(() => console.log('removed directory ' + dir))
    .catch(e => {
      console.log(e);
      // clean up
      db.collection(MONGO_DB).deleteOne({
        guid: dir
      });
      rimrafAsync('/myapp/' + dir + '.png');
      rimrafAsync(dir);
    });
}

function get_share(res, guid) {
  var path = '/myapp/' + guid + '.png';
  return db.collection(MONGO_DB).find({
      guid: guid
    }).toArrayAsync()
    .then(items => {
      console.log('request for resource ' + guid);
      if (items.length == 0) {
        console.log('resource ' + guid + ' not found');
        return res.status(404).send('resource not found');
      }
      assert.equal(1, items.length);
      if (!fs.existsSync(path)) {
        console.log('unable to find resource ' + guid + ' on disk: ' + JSON.stringify(items[0]));
        return res.status(500).end();
      }
      return res.sendFileAsync(path);
    })
    .catch(e => console.log(e));
}

function start_webserver() {
  app.use(express.static('public'));
  app.use(bodyParser.urlencoded({
    extended: false
  }));

  app.get('/', function(req, res) {
    res.sendFile('/myapp/public/html/index.html');
  });

  app.get('/s/:guid', function(req, res) {
    get_share(res, req.params.guid);
  });

  app.post('/q', function(req, res) {
    console.log(JSON.stringify(req.body));
    if (!req.body.q) {
      res.send('Invalid request.');
    } else {
      do_query(req.body.q, res);
    }
  });

  app.listen(3000, function() {
    console.log('Example app listening on port 3000!');
  });
}
