'use strict';
var assert = require('assert'),
  mongodb = require('mongodb'),
  MongoClient = mongodb.MongoClient,
  MONGO_HOST = process.env.MONGO_HOST,
  MONGO_PORT = process.env.MONGO_PORT,
  MONGO_DB = process.env.MONGO_DB,
  db;

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

function bootstrap() {
  console.log('Running bootstrap script');
  db.listCollections({
      name: MONGO_DB
    }).toArray()
    .then(coll => {
      if (coll.length > 0) {
        console.log('Dropping collection ' + MONGO_DB);
        return db.dropCollection(MONGO_DB);
      } else {
        return Promise.resolve();
      }
    }).then(_ => {
      return db.collection(MONGO_DB).createIndex({
        surrogate_id: 1
      }, {
        unique: true
      });
    }).then(_ => {
      console.log('Created index surrogate_id');
      db.close();
    }).then(_ => {
      console.log('Bootstrap complete');
    }).catch(e => {
      console.log(e);
      db.close();
    });
}

MongoClient.connect('mongodb://' + MONGO_HOST + ':' + MONGO_PORT + '/' + MONGO_DB, function(err, _db) {
  assert.equal(null, err);
  console.log('Connected to db');
  db = _db;
  bootstrap();
});
