//////////////////////////////////////////////////////////////////////////
//                                                                      //
// This is a generated file. You can view the original                  //
// source in your browser if your browser supports source maps.         //
//                                                                      //
// If you are using Chrome, open the Developer Tools and click the gear //
// icon in its lower right corner. In the General Settings panel, turn  //
// on 'Enable source maps'.                                             //
//                                                                      //
// If you are using Firefox 23, go to `about:config` and set the        //
// `devtools.debugger.source-maps-enabled` preference to true.          //
// (The preference should be on by default in Firefox 24; versions      //
// older than 23 do not support source maps.)                           //
//                                                                      //
//////////////////////////////////////////////////////////////////////////


(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var Random = Package.random.Random;
var EJSON = Package.ejson.EJSON;
var JSON = Package.json.JSON;
var _ = Package.underscore._;
var LocalCollection = Package.minimongo.LocalCollection;
var Minimongo = Package.minimongo.Minimongo;
var Log = Package.logging.Log;
var DDP = Package.ddp.DDP;
var Tracker = Package.tracker.Tracker;
var Deps = Package.tracker.Deps;
var check = Package.check.check;
var Match = Package.check.Match;

/* Package-scope variables */
var Mongo, LocalCollectionDriver;

(function () {

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// packages/mongo/local_collection_driver.js                                                                          //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
LocalCollectionDriver = function () {                                                                                 // 1
  var self = this;                                                                                                    // 2
  self.noConnCollections = {};                                                                                        // 3
};                                                                                                                    // 4
                                                                                                                      // 5
var ensureCollection = function (name, collections) {                                                                 // 6
  if (!(name in collections))                                                                                         // 7
    collections[name] = new LocalCollection(name);                                                                    // 8
  return collections[name];                                                                                           // 9
};                                                                                                                    // 10
                                                                                                                      // 11
_.extend(LocalCollectionDriver.prototype, {                                                                           // 12
  open: function (name, conn) {                                                                                       // 13
    var self = this;                                                                                                  // 14
    if (!name)                                                                                                        // 15
      return new LocalCollection;                                                                                     // 16
    if (! conn) {                                                                                                     // 17
      return ensureCollection(name, self.noConnCollections);                                                          // 18
    }                                                                                                                 // 19
    if (! conn._mongo_livedata_collections)                                                                           // 20
      conn._mongo_livedata_collections = {};                                                                          // 21
    // XXX is there a way to keep track of a connection's collections without                                         // 22
    // dangling it off the connection object?                                                                         // 23
    return ensureCollection(name, conn._mongo_livedata_collections);                                                  // 24
  }                                                                                                                   // 25
});                                                                                                                   // 26
                                                                                                                      // 27
// singleton                                                                                                          // 28
LocalCollectionDriver = new LocalCollectionDriver;                                                                    // 29
                                                                                                                      // 30
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// packages/mongo/collection.js                                                                                       //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
// options.connection, if given, is a LivedataClient or LivedataServer                                                // 1
// XXX presently there is no way to destroy/clean up a Collection                                                     // 2
                                                                                                                      // 3
/**                                                                                                                   // 4
 * @summary Namespace for MongoDB-related items                                                                       // 5
 * @namespace                                                                                                         // 6
 */                                                                                                                   // 7
Mongo = {};                                                                                                           // 8
                                                                                                                      // 9
/**                                                                                                                   // 10
 * @summary Constructor for a Collection                                                                              // 11
 * @locus Anywhere                                                                                                    // 12
 * @instancename collection                                                                                           // 13
 * @class                                                                                                             // 14
 * @param {String} name The name of the collection.  If null, creates an unmanaged (unsynchronized) local collection. // 15
 * @param {Object} [options]                                                                                          // 16
 * @param {Object} options.connection The server connection that will manage this collection. Uses the default connection if not specified.  Pass the return value of calling [`DDP.connect`](#ddp_connect) to specify a different server. Pass `null` to specify no connection. Unmanaged (`name` is null) collections cannot specify a connection.
 * @param {String} options.idGeneration The method of generating the `_id` fields of new documents in this collection.  Possible values:
                                                                                                                      // 19
 - **`'STRING'`**: random strings                                                                                     // 20
 - **`'MONGO'`**:  random [`Mongo.ObjectID`](#mongo_object_id) values                                                 // 21
                                                                                                                      // 22
The default id generation technique is `'STRING'`.                                                                    // 23
 * @param {Function} options.transform An optional transformation function. Documents will be passed through this function before being returned from `fetch` or `findOne`, and before being passed to callbacks of `observe`, `map`, `forEach`, `allow`, and `deny`. Transforms are *not* applied for the callbacks of `observeChanges` or to cursors returned from publish functions.
 */                                                                                                                   // 25
Mongo.Collection = function (name, options) {                                                                         // 26
  var self = this;                                                                                                    // 27
  if (! (self instanceof Mongo.Collection))                                                                           // 28
    throw new Error('use "new" to construct a Mongo.Collection');                                                     // 29
                                                                                                                      // 30
  if (!name && (name !== null)) {                                                                                     // 31
    Meteor._debug("Warning: creating anonymous collection. It will not be " +                                         // 32
                  "saved or synchronized over the network. (Pass null for " +                                         // 33
                  "the collection name to turn off this warning.)");                                                  // 34
    name = null;                                                                                                      // 35
  }                                                                                                                   // 36
                                                                                                                      // 37
  if (name !== null && typeof name !== "string") {                                                                    // 38
    throw new Error(                                                                                                  // 39
      "First argument to new Mongo.Collection must be a string or null");                                             // 40
  }                                                                                                                   // 41
                                                                                                                      // 42
  if (options && options.methods) {                                                                                   // 43
    // Backwards compatibility hack with original signature (which passed                                             // 44
    // "connection" directly instead of in options. (Connections must have a "methods"                                // 45
    // method.)                                                                                                       // 46
    // XXX remove before 1.0                                                                                          // 47
    options = {connection: options};                                                                                  // 48
  }                                                                                                                   // 49
  // Backwards compatibility: "connection" used to be called "manager".                                               // 50
  if (options && options.manager && !options.connection) {                                                            // 51
    options.connection = options.manager;                                                                             // 52
  }                                                                                                                   // 53
  options = _.extend({                                                                                                // 54
    connection: undefined,                                                                                            // 55
    idGeneration: 'STRING',                                                                                           // 56
    transform: null,                                                                                                  // 57
    _driver: undefined,                                                                                               // 58
    _preventAutopublish: false                                                                                        // 59
  }, options);                                                                                                        // 60
                                                                                                                      // 61
  switch (options.idGeneration) {                                                                                     // 62
  case 'MONGO':                                                                                                       // 63
    self._makeNewID = function () {                                                                                   // 64
      var src = name ? DDP.randomStream('/collection/' + name) : Random;                                              // 65
      return new Mongo.ObjectID(src.hexString(24));                                                                   // 66
    };                                                                                                                // 67
    break;                                                                                                            // 68
  case 'STRING':                                                                                                      // 69
  default:                                                                                                            // 70
    self._makeNewID = function () {                                                                                   // 71
      var src = name ? DDP.randomStream('/collection/' + name) : Random;                                              // 72
      return src.id();                                                                                                // 73
    };                                                                                                                // 74
    break;                                                                                                            // 75
  }                                                                                                                   // 76
                                                                                                                      // 77
  self._transform = LocalCollection.wrapTransform(options.transform);                                                 // 78
                                                                                                                      // 79
  if (! name || options.connection === null)                                                                          // 80
    // note: nameless collections never have a connection                                                             // 81
    self._connection = null;                                                                                          // 82
  else if (options.connection)                                                                                        // 83
    self._connection = options.connection;                                                                            // 84
  else if (Meteor.isClient)                                                                                           // 85
    self._connection = Meteor.connection;                                                                             // 86
  else                                                                                                                // 87
    self._connection = Meteor.server;                                                                                 // 88
                                                                                                                      // 89
  if (!options._driver) {                                                                                             // 90
    // XXX This check assumes that webapp is loaded so that Meteor.server !==                                         // 91
    // null. We should fully support the case of "want to use a Mongo-backed                                          // 92
    // collection from Node code without webapp", but we don't yet.                                                   // 93
    // #MeteorServerNull                                                                                              // 94
    if (name && self._connection === Meteor.server &&                                                                 // 95
        typeof MongoInternals !== "undefined" &&                                                                      // 96
        MongoInternals.defaultRemoteCollectionDriver) {                                                               // 97
      options._driver = MongoInternals.defaultRemoteCollectionDriver();                                               // 98
    } else {                                                                                                          // 99
      options._driver = LocalCollectionDriver;                                                                        // 100
    }                                                                                                                 // 101
  }                                                                                                                   // 102
                                                                                                                      // 103
  self._collection = options._driver.open(name, self._connection);                                                    // 104
  self._name = name;                                                                                                  // 105
                                                                                                                      // 106
  if (self._connection && self._connection.registerStore) {                                                           // 107
    // OK, we're going to be a slave, replicating some remote                                                         // 108
    // database, except possibly with some temporary divergence while                                                 // 109
    // we have unacknowledged RPC's.                                                                                  // 110
    var ok = self._connection.registerStore(name, {                                                                   // 111
      // Called at the beginning of a batch of updates. batchSize is the number                                       // 112
      // of update calls to expect.                                                                                   // 113
      //                                                                                                              // 114
      // XXX This interface is pretty janky. reset probably ought to go back to                                       // 115
      // being its own function, and callers shouldn't have to calculate                                              // 116
      // batchSize. The optimization of not calling pause/remove should be                                            // 117
      // delayed until later: the first call to update() should buffer its                                            // 118
      // message, and then we can either directly apply it at endUpdate time if                                       // 119
      // it was the only update, or do pauseObservers/apply/apply at the next                                         // 120
      // update() if there's another one.                                                                             // 121
      beginUpdate: function (batchSize, reset) {                                                                      // 122
        // pause observers so users don't see flicker when updating several                                           // 123
        // objects at once (including the post-reconnect reset-and-reapply                                            // 124
        // stage), and so that a re-sorting of a query can take advantage of the                                      // 125
        // full _diffQuery moved calculation instead of applying change one at a                                      // 126
        // time.                                                                                                      // 127
        if (batchSize > 1 || reset)                                                                                   // 128
          self._collection.pauseObservers();                                                                          // 129
                                                                                                                      // 130
        if (reset)                                                                                                    // 131
          self._collection.remove({});                                                                                // 132
      },                                                                                                              // 133
                                                                                                                      // 134
      // Apply an update.                                                                                             // 135
      // XXX better specify this interface (not in terms of a wire message)?                                          // 136
      update: function (msg) {                                                                                        // 137
        var mongoId = LocalCollection._idParse(msg.id);                                                               // 138
        var doc = self._collection.findOne(mongoId);                                                                  // 139
                                                                                                                      // 140
        // Is this a "replace the whole doc" message coming from the quiescence                                       // 141
        // of method writes to an object? (Note that 'undefined' is a valid                                           // 142
        // value meaning "remove it".)                                                                                // 143
        if (msg.msg === 'replace') {                                                                                  // 144
          var replace = msg.replace;                                                                                  // 145
          if (!replace) {                                                                                             // 146
            if (doc)                                                                                                  // 147
              self._collection.remove(mongoId);                                                                       // 148
          } else if (!doc) {                                                                                          // 149
            self._collection.insert(replace);                                                                         // 150
          } else {                                                                                                    // 151
            // XXX check that replace has no $ ops                                                                    // 152
            self._collection.update(mongoId, replace);                                                                // 153
          }                                                                                                           // 154
          return;                                                                                                     // 155
        } else if (msg.msg === 'added') {                                                                             // 156
          if (doc) {                                                                                                  // 157
            throw new Error("Expected not to find a document already present for an add");                            // 158
          }                                                                                                           // 159
          self._collection.insert(_.extend({_id: mongoId}, msg.fields));                                              // 160
        } else if (msg.msg === 'removed') {                                                                           // 161
          if (!doc)                                                                                                   // 162
            throw new Error("Expected to find a document already present for removed");                               // 163
          self._collection.remove(mongoId);                                                                           // 164
        } else if (msg.msg === 'changed') {                                                                           // 165
          if (!doc)                                                                                                   // 166
            throw new Error("Expected to find a document to change");                                                 // 167
          if (!_.isEmpty(msg.fields)) {                                                                               // 168
            var modifier = {};                                                                                        // 169
            _.each(msg.fields, function (value, key) {                                                                // 170
              if (value === undefined) {                                                                              // 171
                if (!modifier.$unset)                                                                                 // 172
                  modifier.$unset = {};                                                                               // 173
                modifier.$unset[key] = 1;                                                                             // 174
              } else {                                                                                                // 175
                if (!modifier.$set)                                                                                   // 176
                  modifier.$set = {};                                                                                 // 177
                modifier.$set[key] = value;                                                                           // 178
              }                                                                                                       // 179
            });                                                                                                       // 180
            self._collection.update(mongoId, modifier);                                                               // 181
          }                                                                                                           // 182
        } else {                                                                                                      // 183
          throw new Error("I don't know how to deal with this message");                                              // 184
        }                                                                                                             // 185
                                                                                                                      // 186
      },                                                                                                              // 187
                                                                                                                      // 188
      // Called at the end of a batch of updates.                                                                     // 189
      endUpdate: function () {                                                                                        // 190
        self._collection.resumeObservers();                                                                           // 191
      },                                                                                                              // 192
                                                                                                                      // 193
      // Called around method stub invocations to capture the original versions                                       // 194
      // of modified documents.                                                                                       // 195
      saveOriginals: function () {                                                                                    // 196
        self._collection.saveOriginals();                                                                             // 197
      },                                                                                                              // 198
      retrieveOriginals: function () {                                                                                // 199
        return self._collection.retrieveOriginals();                                                                  // 200
      }                                                                                                               // 201
    });                                                                                                               // 202
                                                                                                                      // 203
    if (!ok)                                                                                                          // 204
      throw new Error("There is already a collection named '" + name + "'");                                          // 205
  }                                                                                                                   // 206
                                                                                                                      // 207
  self._defineMutationMethods();                                                                                      // 208
                                                                                                                      // 209
  // autopublish                                                                                                      // 210
  if (Package.autopublish && !options._preventAutopublish && self._connection                                         // 211
      && self._connection.publish) {                                                                                  // 212
    self._connection.publish(null, function () {                                                                      // 213
      return self.find();                                                                                             // 214
    }, {is_auto: true});                                                                                              // 215
  }                                                                                                                   // 216
};                                                                                                                    // 217
                                                                                                                      // 218
///                                                                                                                   // 219
/// Main collection API                                                                                               // 220
///                                                                                                                   // 221
                                                                                                                      // 222
                                                                                                                      // 223
_.extend(Mongo.Collection.prototype, {                                                                                // 224
                                                                                                                      // 225
  _getFindSelector: function (args) {                                                                                 // 226
    if (args.length == 0)                                                                                             // 227
      return {};                                                                                                      // 228
    else                                                                                                              // 229
      return args[0];                                                                                                 // 230
  },                                                                                                                  // 231
                                                                                                                      // 232
  _getFindOptions: function (args) {                                                                                  // 233
    var self = this;                                                                                                  // 234
    if (args.length < 2) {                                                                                            // 235
      return { transform: self._transform };                                                                          // 236
    } else {                                                                                                          // 237
      check(args[1], Match.Optional(Match.ObjectIncluding({                                                           // 238
        fields: Match.Optional(Match.OneOf(Object, undefined)),                                                       // 239
        sort: Match.Optional(Match.OneOf(Object, Array, undefined)),                                                  // 240
        limit: Match.Optional(Match.OneOf(Number, undefined)),                                                        // 241
        skip: Match.Optional(Match.OneOf(Number, undefined))                                                          // 242
     })));                                                                                                            // 243
                                                                                                                      // 244
      return _.extend({                                                                                               // 245
        transform: self._transform                                                                                    // 246
      }, args[1]);                                                                                                    // 247
    }                                                                                                                 // 248
  },                                                                                                                  // 249
                                                                                                                      // 250
  /**                                                                                                                 // 251
   * @summary Find the documents in a collection that match the selector.                                             // 252
   * @locus Anywhere                                                                                                  // 253
   * @method find                                                                                                     // 254
   * @memberOf Mongo.Collection                                                                                       // 255
   * @instance                                                                                                        // 256
   * @param {MongoSelector} [selector] A query describing the documents to find                                       // 257
   * @param {Object} [options]                                                                                        // 258
   * @param {MongoSortSpecifier} options.sort Sort order (default: natural order)                                     // 259
   * @param {Number} options.skip Number of results to skip at the beginning                                          // 260
   * @param {Number} options.limit Maximum number of results to return                                                // 261
   * @param {MongoFieldSpecifier} options.fields Dictionary of fields to return or exclude.                           // 262
   * @param {Boolean} options.reactive (Client only) Default `true`; pass `false` to disable reactivity               // 263
   * @param {Function} options.transform Overrides `transform` on the  [`Collection`](#collections) for this cursor.  Pass `null` to disable transformation.
   */                                                                                                                 // 265
  find: function (/* selector, options */) {                                                                          // 266
    // Collection.find() (return all docs) behaves differently                                                        // 267
    // from Collection.find(undefined) (return 0 docs).  so be                                                        // 268
    // careful about the length of arguments.                                                                         // 269
    var self = this;                                                                                                  // 270
    var argArray = _.toArray(arguments);                                                                              // 271
    return self._collection.find(self._getFindSelector(argArray),                                                     // 272
                                 self._getFindOptions(argArray));                                                     // 273
  },                                                                                                                  // 274
                                                                                                                      // 275
  /**                                                                                                                 // 276
   * @summary Finds the first document that matches the selector, as ordered by sort and skip options.                // 277
   * @locus Anywhere                                                                                                  // 278
   * @method findOne                                                                                                  // 279
   * @memberOf Mongo.Collection                                                                                       // 280
   * @instance                                                                                                        // 281
   * @param {MongoSelector} [selector] A query describing the documents to find                                       // 282
   * @param {Object} [options]                                                                                        // 283
   * @param {MongoSortSpecifier} options.sort Sort order (default: natural order)                                     // 284
   * @param {Number} options.skip Number of results to skip at the beginning                                          // 285
   * @param {MongoFieldSpecifier} options.fields Dictionary of fields to return or exclude.                           // 286
   * @param {Boolean} options.reactive (Client only) Default true; pass false to disable reactivity                   // 287
   * @param {Function} options.transform Overrides `transform` on the [`Collection`](#collections) for this cursor.  Pass `null` to disable transformation.
   */                                                                                                                 // 289
  findOne: function (/* selector, options */) {                                                                       // 290
    var self = this;                                                                                                  // 291
    var argArray = _.toArray(arguments);                                                                              // 292
    return self._collection.findOne(self._getFindSelector(argArray),                                                  // 293
                                    self._getFindOptions(argArray));                                                  // 294
  }                                                                                                                   // 295
                                                                                                                      // 296
});                                                                                                                   // 297
                                                                                                                      // 298
Mongo.Collection._publishCursor = function (cursor, sub, collection) {                                                // 299
  var observeHandle = cursor.observeChanges({                                                                         // 300
    added: function (id, fields) {                                                                                    // 301
      sub.added(collection, id, fields);                                                                              // 302
    },                                                                                                                // 303
    changed: function (id, fields) {                                                                                  // 304
      sub.changed(collection, id, fields);                                                                            // 305
    },                                                                                                                // 306
    removed: function (id) {                                                                                          // 307
      sub.removed(collection, id);                                                                                    // 308
    }                                                                                                                 // 309
  });                                                                                                                 // 310
                                                                                                                      // 311
  // We don't call sub.ready() here: it gets called in livedata_server, after                                         // 312
  // possibly calling _publishCursor on multiple returned cursors.                                                    // 313
                                                                                                                      // 314
  // register stop callback (expects lambda w/ no args).                                                              // 315
  sub.onStop(function () {observeHandle.stop();});                                                                    // 316
};                                                                                                                    // 317
                                                                                                                      // 318
// protect against dangerous selectors.  falsey and {_id: falsey} are both                                            // 319
// likely programmer error, and not what you want, particularly for destructive                                       // 320
// operations.  JS regexps don't serialize over DDP but can be trivially                                              // 321
// replaced by $regex.                                                                                                // 322
Mongo.Collection._rewriteSelector = function (selector) {                                                             // 323
  // shorthand -- scalars match _id                                                                                   // 324
  if (LocalCollection._selectorIsId(selector))                                                                        // 325
    selector = {_id: selector};                                                                                       // 326
                                                                                                                      // 327
  if (!selector || (('_id' in selector) && !selector._id))                                                            // 328
    // can't match anything                                                                                           // 329
    return {_id: Random.id()};                                                                                        // 330
                                                                                                                      // 331
  var ret = {};                                                                                                       // 332
  _.each(selector, function (value, key) {                                                                            // 333
    // Mongo supports both {field: /foo/} and {field: {$regex: /foo/}}                                                // 334
    if (value instanceof RegExp) {                                                                                    // 335
      ret[key] = convertRegexpToMongoSelector(value);                                                                 // 336
    } else if (value && value.$regex instanceof RegExp) {                                                             // 337
      ret[key] = convertRegexpToMongoSelector(value.$regex);                                                          // 338
      // if value is {$regex: /foo/, $options: ...} then $options                                                     // 339
      // override the ones set on $regex.                                                                             // 340
      if (value.$options !== undefined)                                                                               // 341
        ret[key].$options = value.$options;                                                                           // 342
    }                                                                                                                 // 343
    else if (_.contains(['$or','$and','$nor'], key)) {                                                                // 344
      // Translate lower levels of $and/$or/$nor                                                                      // 345
      ret[key] = _.map(value, function (v) {                                                                          // 346
        return Mongo.Collection._rewriteSelector(v);                                                                  // 347
      });                                                                                                             // 348
    } else {                                                                                                          // 349
      ret[key] = value;                                                                                               // 350
    }                                                                                                                 // 351
  });                                                                                                                 // 352
  return ret;                                                                                                         // 353
};                                                                                                                    // 354
                                                                                                                      // 355
// convert a JS RegExp object to a Mongo {$regex: ..., $options: ...}                                                 // 356
// selector                                                                                                           // 357
var convertRegexpToMongoSelector = function (regexp) {                                                                // 358
  check(regexp, RegExp); // safety belt                                                                               // 359
                                                                                                                      // 360
  var selector = {$regex: regexp.source};                                                                             // 361
  var regexOptions = '';                                                                                              // 362
  // JS RegExp objects support 'i', 'm', and 'g'. Mongo regex $options                                                // 363
  // support 'i', 'm', 'x', and 's'. So we support 'i' and 'm' here.                                                  // 364
  if (regexp.ignoreCase)                                                                                              // 365
    regexOptions += 'i';                                                                                              // 366
  if (regexp.multiline)                                                                                               // 367
    regexOptions += 'm';                                                                                              // 368
  if (regexOptions)                                                                                                   // 369
    selector.$options = regexOptions;                                                                                 // 370
                                                                                                                      // 371
  return selector;                                                                                                    // 372
};                                                                                                                    // 373
                                                                                                                      // 374
var throwIfSelectorIsNotId = function (selector, methodName) {                                                        // 375
  if (!LocalCollection._selectorIsIdPerhapsAsObject(selector)) {                                                      // 376
    throw new Meteor.Error(                                                                                           // 377
      403, "Not permitted. Untrusted code may only " + methodName +                                                   // 378
        " documents by ID.");                                                                                         // 379
  }                                                                                                                   // 380
};                                                                                                                    // 381
                                                                                                                      // 382
// 'insert' immediately returns the inserted document's new _id.                                                      // 383
// The others return values immediately if you are in a stub, an in-memory                                            // 384
// unmanaged collection, or a mongo-backed collection and you don't pass a                                            // 385
// callback. 'update' and 'remove' return the number of affected                                                      // 386
// documents. 'upsert' returns an object with keys 'numberAffected' and, if an                                        // 387
// insert happened, 'insertedId'.                                                                                     // 388
//                                                                                                                    // 389
// Otherwise, the semantics are exactly like other methods: they take                                                 // 390
// a callback as an optional last argument; if no callback is                                                         // 391
// provided, they block until the operation is complete, and throw an                                                 // 392
// exception if it fails; if a callback is provided, then they don't                                                  // 393
// necessarily block, and they call the callback when they finish with error and                                      // 394
// result arguments.  (The insert method provides the document ID as its result;                                      // 395
// update and remove provide the number of affected docs as the result; upsert                                        // 396
// provides an object with numberAffected and maybe insertedId.)                                                      // 397
//                                                                                                                    // 398
// On the client, blocking is impossible, so if a callback                                                            // 399
// isn't provided, they just return immediately and any error                                                         // 400
// information is lost.                                                                                               // 401
//                                                                                                                    // 402
// There's one more tweak. On the client, if you don't provide a                                                      // 403
// callback, then if there is an error, a message will be logged with                                                 // 404
// Meteor._debug.                                                                                                     // 405
//                                                                                                                    // 406
// The intent (though this is actually determined by the underlying                                                   // 407
// drivers) is that the operations should be done synchronously, not                                                  // 408
// generating their result until the database has acknowledged                                                        // 409
// them. In the future maybe we should provide a flag to turn this                                                    // 410
// off.                                                                                                               // 411
                                                                                                                      // 412
/**                                                                                                                   // 413
 * @summary Insert a document in the collection.  Returns its unique _id.                                             // 414
 * @locus Anywhere                                                                                                    // 415
 * @method  insert                                                                                                    // 416
 * @memberOf Mongo.Collection                                                                                         // 417
 * @instance                                                                                                          // 418
 * @param {Object} doc The document to insert. May not yet have an _id attribute, in which case Meteor will generate one for you.
 * @param {Function} [callback] Optional.  If present, called with an error object as the first argument and, if no error, the _id as the second.
 */                                                                                                                   // 421
                                                                                                                      // 422
/**                                                                                                                   // 423
 * @summary Modify one or more documents in the collection. Returns the number of affected documents.                 // 424
 * @locus Anywhere                                                                                                    // 425
 * @method update                                                                                                     // 426
 * @memberOf Mongo.Collection                                                                                         // 427
 * @instance                                                                                                          // 428
 * @param {MongoSelector} selector Specifies which documents to modify                                                // 429
 * @param {MongoModifier} modifier Specifies how to modify the documents                                              // 430
 * @param {Object} [options]                                                                                          // 431
 * @param {Boolean} options.multi True to modify all matching documents; false to only modify one of the matching documents (the default).
 * @param {Boolean} options.upsert True to insert a document if no matching documents are found.                      // 433
 * @param {Function} [callback] Optional.  If present, called with an error object as the first argument and, if no error, the number of affected documents as the second.
 */                                                                                                                   // 435
                                                                                                                      // 436
/**                                                                                                                   // 437
 * @summary Remove documents from the collection                                                                      // 438
 * @locus Anywhere                                                                                                    // 439
 * @method remove                                                                                                     // 440
 * @memberOf Mongo.Collection                                                                                         // 441
 * @instance                                                                                                          // 442
 * @param {MongoSelector} selector Specifies which documents to remove                                                // 443
 * @param {Function} [callback] Optional.  If present, called with an error object as its argument.                   // 444
 */                                                                                                                   // 445
                                                                                                                      // 446
_.each(["insert", "update", "remove"], function (name) {                                                              // 447
  Mongo.Collection.prototype[name] = function (/* arguments */) {                                                     // 448
    var self = this;                                                                                                  // 449
    var args = _.toArray(arguments);                                                                                  // 450
    var callback;                                                                                                     // 451
    var insertId;                                                                                                     // 452
    var ret;                                                                                                          // 453
                                                                                                                      // 454
    // Pull off any callback (or perhaps a 'callback' variable that was passed                                        // 455
    // in undefined, like how 'upsert' does it).                                                                      // 456
    if (args.length &&                                                                                                // 457
        (args[args.length - 1] === undefined ||                                                                       // 458
         args[args.length - 1] instanceof Function)) {                                                                // 459
      callback = args.pop();                                                                                          // 460
    }                                                                                                                 // 461
                                                                                                                      // 462
    if (name === "insert") {                                                                                          // 463
      if (!args.length)                                                                                               // 464
        throw new Error("insert requires an argument");                                                               // 465
      // shallow-copy the document and generate an ID                                                                 // 466
      args[0] = _.extend({}, args[0]);                                                                                // 467
      if ('_id' in args[0]) {                                                                                         // 468
        insertId = args[0]._id;                                                                                       // 469
        if (!insertId || !(typeof insertId === 'string'                                                               // 470
              || insertId instanceof Mongo.ObjectID))                                                                 // 471
          throw new Error("Meteor requires document _id fields to be non-empty strings or ObjectIDs");                // 472
      } else {                                                                                                        // 473
        var generateId = true;                                                                                        // 474
        // Don't generate the id if we're the client and the 'outermost' call                                         // 475
        // This optimization saves us passing both the randomSeed and the id                                          // 476
        // Passing both is redundant.                                                                                 // 477
        if (self._connection && self._connection !== Meteor.server) {                                                 // 478
          var enclosing = DDP._CurrentInvocation.get();                                                               // 479
          if (!enclosing) {                                                                                           // 480
            generateId = false;                                                                                       // 481
          }                                                                                                           // 482
        }                                                                                                             // 483
        if (generateId) {                                                                                             // 484
          insertId = args[0]._id = self._makeNewID();                                                                 // 485
        }                                                                                                             // 486
      }                                                                                                               // 487
    } else {                                                                                                          // 488
      args[0] = Mongo.Collection._rewriteSelector(args[0]);                                                           // 489
                                                                                                                      // 490
      if (name === "update") {                                                                                        // 491
        // Mutate args but copy the original options object. We need to add                                           // 492
        // insertedId to options, but don't want to mutate the caller's options                                       // 493
        // object. We need to mutate `args` because we pass `args` into the                                           // 494
        // driver below.                                                                                              // 495
        var options = args[2] = _.clone(args[2]) || {};                                                               // 496
        if (options && typeof options !== "function" && options.upsert) {                                             // 497
          // set `insertedId` if absent.  `insertedId` is a Meteor extension.                                         // 498
          if (options.insertedId) {                                                                                   // 499
            if (!(typeof options.insertedId === 'string'                                                              // 500
                  || options.insertedId instanceof Mongo.ObjectID))                                                   // 501
              throw new Error("insertedId must be string or ObjectID");                                               // 502
          } else {                                                                                                    // 503
            options.insertedId = self._makeNewID();                                                                   // 504
          }                                                                                                           // 505
        }                                                                                                             // 506
      }                                                                                                               // 507
    }                                                                                                                 // 508
                                                                                                                      // 509
    // On inserts, always return the id that we generated; on all other                                               // 510
    // operations, just return the result from the collection.                                                        // 511
    var chooseReturnValueFromCollectionResult = function (result) {                                                   // 512
      if (name === "insert") {                                                                                        // 513
        if (!insertId && result) {                                                                                    // 514
          insertId = result;                                                                                          // 515
        }                                                                                                             // 516
        return insertId;                                                                                              // 517
      } else {                                                                                                        // 518
        return result;                                                                                                // 519
      }                                                                                                               // 520
    };                                                                                                                // 521
                                                                                                                      // 522
    var wrappedCallback;                                                                                              // 523
    if (callback) {                                                                                                   // 524
      wrappedCallback = function (error, result) {                                                                    // 525
        callback(error, ! error && chooseReturnValueFromCollectionResult(result));                                    // 526
      };                                                                                                              // 527
    }                                                                                                                 // 528
                                                                                                                      // 529
    // XXX see #MeteorServerNull                                                                                      // 530
    if (self._connection && self._connection !== Meteor.server) {                                                     // 531
      // just remote to another endpoint, propagate return value or                                                   // 532
      // exception.                                                                                                   // 533
                                                                                                                      // 534
      var enclosing = DDP._CurrentInvocation.get();                                                                   // 535
      var alreadyInSimulation = enclosing && enclosing.isSimulation;                                                  // 536
                                                                                                                      // 537
      if (Meteor.isClient && !wrappedCallback && ! alreadyInSimulation) {                                             // 538
        // Client can't block, so it can't report errors by exception,                                                // 539
        // only by callback. If they forget the callback, give them a                                                 // 540
        // default one that logs the error, so they aren't totally                                                    // 541
        // baffled if their writes don't work because their database is                                               // 542
        // down.                                                                                                      // 543
        // Don't give a default callback in simulation, because inside stubs we                                       // 544
        // want to return the results from the local collection immediately and                                       // 545
        // not force a callback.                                                                                      // 546
        wrappedCallback = function (err) {                                                                            // 547
          if (err)                                                                                                    // 548
            Meteor._debug(name + " failed: " + (err.reason || err.stack));                                            // 549
        };                                                                                                            // 550
      }                                                                                                               // 551
                                                                                                                      // 552
      if (!alreadyInSimulation && name !== "insert") {                                                                // 553
        // If we're about to actually send an RPC, we should throw an error if                                        // 554
        // this is a non-ID selector, because the mutation methods only allow                                         // 555
        // single-ID selectors. (If we don't throw here, we'll see flicker.)                                          // 556
        throwIfSelectorIsNotId(args[0], name);                                                                        // 557
      }                                                                                                               // 558
                                                                                                                      // 559
      ret = chooseReturnValueFromCollectionResult(                                                                    // 560
        self._connection.apply(self._prefix + name, args, {returnStubValue: true}, wrappedCallback)                   // 561
      );                                                                                                              // 562
                                                                                                                      // 563
    } else {                                                                                                          // 564
      // it's my collection.  descend into the collection object                                                      // 565
      // and propagate any exception.                                                                                 // 566
      args.push(wrappedCallback);                                                                                     // 567
      try {                                                                                                           // 568
        // If the user provided a callback and the collection implements this                                         // 569
        // operation asynchronously, then queryRet will be undefined, and the                                         // 570
        // result will be returned through the callback instead.                                                      // 571
        var queryRet = self._collection[name].apply(self._collection, args);                                          // 572
        ret = chooseReturnValueFromCollectionResult(queryRet);                                                        // 573
      } catch (e) {                                                                                                   // 574
        if (callback) {                                                                                               // 575
          callback(e);                                                                                                // 576
          return null;                                                                                                // 577
        }                                                                                                             // 578
        throw e;                                                                                                      // 579
      }                                                                                                               // 580
    }                                                                                                                 // 581
                                                                                                                      // 582
    // both sync and async, unless we threw an exception, return ret                                                  // 583
    // (new document ID for insert, num affected for update/remove, object with                                       // 584
    // numberAffected and maybe insertedId for upsert).                                                               // 585
    return ret;                                                                                                       // 586
  };                                                                                                                  // 587
});                                                                                                                   // 588
                                                                                                                      // 589
/**                                                                                                                   // 590
 * @summary Modify one or more documents in the collection, or insert one if no matching documents were found. Returns an object with keys `numberAffected` (the number of documents modified)  and `insertedId` (the unique _id of the document that was inserted, if any).
 * @locus Anywhere                                                                                                    // 592
 * @param {MongoSelector} selector Specifies which documents to modify                                                // 593
 * @param {MongoModifier} modifier Specifies how to modify the documents                                              // 594
 * @param {Object} [options]                                                                                          // 595
 * @param {Boolean} options.multi True to modify all matching documents; false to only modify one of the matching documents (the default).
 * @param {Function} [callback] Optional.  If present, called with an error object as the first argument and, if no error, the number of affected documents as the second.
 */                                                                                                                   // 598
Mongo.Collection.prototype.upsert = function (selector, modifier,                                                     // 599
                                               options, callback) {                                                   // 600
  var self = this;                                                                                                    // 601
  if (! callback && typeof options === "function") {                                                                  // 602
    callback = options;                                                                                               // 603
    options = {};                                                                                                     // 604
  }                                                                                                                   // 605
  return self.update(selector, modifier,                                                                              // 606
              _.extend({}, options, { _returnObject: true, upsert: true }),                                           // 607
              callback);                                                                                              // 608
};                                                                                                                    // 609
                                                                                                                      // 610
// We'll actually design an index API later. For now, we just pass through to                                         // 611
// Mongo's, but make it synchronous.                                                                                  // 612
Mongo.Collection.prototype._ensureIndex = function (index, options) {                                                 // 613
  var self = this;                                                                                                    // 614
  if (!self._collection._ensureIndex)                                                                                 // 615
    throw new Error("Can only call _ensureIndex on server collections");                                              // 616
  self._collection._ensureIndex(index, options);                                                                      // 617
};                                                                                                                    // 618
Mongo.Collection.prototype._dropIndex = function (index) {                                                            // 619
  var self = this;                                                                                                    // 620
  if (!self._collection._dropIndex)                                                                                   // 621
    throw new Error("Can only call _dropIndex on server collections");                                                // 622
  self._collection._dropIndex(index);                                                                                 // 623
};                                                                                                                    // 624
Mongo.Collection.prototype._dropCollection = function () {                                                            // 625
  var self = this;                                                                                                    // 626
  if (!self._collection.dropCollection)                                                                               // 627
    throw new Error("Can only call _dropCollection on server collections");                                           // 628
  self._collection.dropCollection();                                                                                  // 629
};                                                                                                                    // 630
Mongo.Collection.prototype._createCappedCollection = function (byteSize) {                                            // 631
  var self = this;                                                                                                    // 632
  if (!self._collection._createCappedCollection)                                                                      // 633
    throw new Error("Can only call _createCappedCollection on server collections");                                   // 634
  self._collection._createCappedCollection(byteSize);                                                                 // 635
};                                                                                                                    // 636
                                                                                                                      // 637
/**                                                                                                                   // 638
 * @summary Create a Mongo-style `ObjectID`.  If you don't specify a `hexString`, the `ObjectID` will generated randomly (not using MongoDB's ID construction rules).
 * @locus Anywhere                                                                                                    // 640
 * @class                                                                                                             // 641
 * @param {String} hexString Optional.  The 24-character hexadecimal contents of the ObjectID to create               // 642
 */                                                                                                                   // 643
Mongo.ObjectID = LocalCollection._ObjectID;                                                                           // 644
                                                                                                                      // 645
/**                                                                                                                   // 646
 * @summary To create a cursor, use find. To access the documents in a cursor, use forEach, map, or fetch.            // 647
 * @class                                                                                                             // 648
 * @instanceName cursor                                                                                               // 649
 */                                                                                                                   // 650
Mongo.Cursor = LocalCollection.Cursor;                                                                                // 651
                                                                                                                      // 652
/**                                                                                                                   // 653
 * @deprecated in 0.9.1                                                                                               // 654
 */                                                                                                                   // 655
Mongo.Collection.Cursor = Mongo.Cursor;                                                                               // 656
                                                                                                                      // 657
/**                                                                                                                   // 658
 * @deprecated in 0.9.1                                                                                               // 659
 */                                                                                                                   // 660
Mongo.Collection.ObjectID = Mongo.ObjectID;                                                                           // 661
                                                                                                                      // 662
///                                                                                                                   // 663
/// Remote methods and access control.                                                                                // 664
///                                                                                                                   // 665
                                                                                                                      // 666
// Restrict default mutators on collection. allow() and deny() take the                                               // 667
// same options:                                                                                                      // 668
//                                                                                                                    // 669
// options.insert {Function(userId, doc)}                                                                             // 670
//   return true to allow/deny adding this document                                                                   // 671
//                                                                                                                    // 672
// options.update {Function(userId, docs, fields, modifier)}                                                          // 673
//   return true to allow/deny updating these documents.                                                              // 674
//   `fields` is passed as an array of fields that are to be modified                                                 // 675
//                                                                                                                    // 676
// options.remove {Function(userId, docs)}                                                                            // 677
//   return true to allow/deny removing these documents                                                               // 678
//                                                                                                                    // 679
// options.fetch {Array}                                                                                              // 680
//   Fields to fetch for these validators. If any call to allow or deny                                               // 681
//   does not have this option then all fields are loaded.                                                            // 682
//                                                                                                                    // 683
// allow and deny can be called multiple times. The validators are                                                    // 684
// evaluated as follows:                                                                                              // 685
// - If neither deny() nor allow() has been called on the collection,                                                 // 686
//   then the request is allowed if and only if the "insecure" smart                                                  // 687
//   package is in use.                                                                                               // 688
// - Otherwise, if any deny() function returns true, the request is denied.                                           // 689
// - Otherwise, if any allow() function returns true, the request is allowed.                                         // 690
// - Otherwise, the request is denied.                                                                                // 691
//                                                                                                                    // 692
// Meteor may call your deny() and allow() functions in any order, and may not                                        // 693
// call all of them if it is able to make a decision without calling them all                                         // 694
// (so don't include side effects).                                                                                   // 695
                                                                                                                      // 696
(function () {                                                                                                        // 697
  var addValidator = function(allowOrDeny, options) {                                                                 // 698
    // validate keys                                                                                                  // 699
    var VALID_KEYS = ['insert', 'update', 'remove', 'fetch', 'transform'];                                            // 700
    _.each(_.keys(options), function (key) {                                                                          // 701
      if (!_.contains(VALID_KEYS, key))                                                                               // 702
        throw new Error(allowOrDeny + ": Invalid key: " + key);                                                       // 703
    });                                                                                                               // 704
                                                                                                                      // 705
    var self = this;                                                                                                  // 706
    self._restricted = true;                                                                                          // 707
                                                                                                                      // 708
    _.each(['insert', 'update', 'remove'], function (name) {                                                          // 709
      if (options[name]) {                                                                                            // 710
        if (!(options[name] instanceof Function)) {                                                                   // 711
          throw new Error(allowOrDeny + ": Value for `" + name + "` must be a function");                             // 712
        }                                                                                                             // 713
                                                                                                                      // 714
        // If the transform is specified at all (including as 'null') in this                                         // 715
        // call, then take that; otherwise, take the transform from the                                               // 716
        // collection.                                                                                                // 717
        if (options.transform === undefined) {                                                                        // 718
          options[name].transform = self._transform;  // already wrapped                                              // 719
        } else {                                                                                                      // 720
          options[name].transform = LocalCollection.wrapTransform(                                                    // 721
            options.transform);                                                                                       // 722
        }                                                                                                             // 723
                                                                                                                      // 724
        self._validators[name][allowOrDeny].push(options[name]);                                                      // 725
      }                                                                                                               // 726
    });                                                                                                               // 727
                                                                                                                      // 728
    // Only update the fetch fields if we're passed things that affect                                                // 729
    // fetching. This way allow({}) and allow({insert: f}) don't result in                                            // 730
    // setting fetchAllFields                                                                                         // 731
    if (options.update || options.remove || options.fetch) {                                                          // 732
      if (options.fetch && !(options.fetch instanceof Array)) {                                                       // 733
        throw new Error(allowOrDeny + ": Value for `fetch` must be an array");                                        // 734
      }                                                                                                               // 735
      self._updateFetch(options.fetch);                                                                               // 736
    }                                                                                                                 // 737
  };                                                                                                                  // 738
                                                                                                                      // 739
  /**                                                                                                                 // 740
   * @summary Allow users to write directly to this collection from client code, subject to limitations you define.   // 741
   * @locus Server                                                                                                    // 742
   * @param {Object} options                                                                                          // 743
   * @param {Function} options.insert                                                                                 // 744
   * @param {Function} options.update                                                                                 // 745
   * @param {Function} options.remove Functions that look at a proposed modification to the database and return true if it should be allowed.
   * @param {String[]} options.fetch Optional performance enhancement. Limits the fields that will be fetched from the database for inspection by your `update` and `remove` functions.
   * @param {Function} options.transform Overrides `transform` on the  [`Collection`](#collections).  Pass `null` to disable transformation.
   */                                                                                                                 // 749
  Mongo.Collection.prototype.allow = function(options) {                                                              // 750
    addValidator.call(this, 'allow', options);                                                                        // 751
  };                                                                                                                  // 752
                                                                                                                      // 753
  /**                                                                                                                 // 754
   * @summary Override `allow` rules.                                                                                 // 755
   * @locus Server                                                                                                    // 756
   * @param {Object} options                                                                                          // 757
   * @param {Function} options.insert                                                                                 // 758
   * @param {Function} options.update                                                                                 // 759
   * @param {Function} options.remove Functions that look at a proposed modification to the database and return true if it should be denied, even if an `allow` rule says otherwise.
   * @param {String[]} options.fetch Optional performance enhancement. Limits the fields that will be fetched from the database for inspection by your `update` and `remove` functions.
   * @param {Function} options.transform Overrides `transform` on the  [`Collection`](#collections).  Pass `null` to disable transformation.
   */                                                                                                                 // 763
  Mongo.Collection.prototype.deny = function(options) {                                                               // 764
    addValidator.call(this, 'deny', options);                                                                         // 765
  };                                                                                                                  // 766
})();                                                                                                                 // 767
                                                                                                                      // 768
                                                                                                                      // 769
Mongo.Collection.prototype._defineMutationMethods = function() {                                                      // 770
  var self = this;                                                                                                    // 771
                                                                                                                      // 772
  // set to true once we call any allow or deny methods. If true, use                                                 // 773
  // allow/deny semantics. If false, use insecure mode semantics.                                                     // 774
  self._restricted = false;                                                                                           // 775
                                                                                                                      // 776
  // Insecure mode (default to allowing writes). Defaults to 'undefined' which                                        // 777
  // means insecure iff the insecure package is loaded. This property can be                                          // 778
  // overriden by tests or packages wishing to change insecure mode behavior of                                       // 779
  // their collections.                                                                                               // 780
  self._insecure = undefined;                                                                                         // 781
                                                                                                                      // 782
  self._validators = {                                                                                                // 783
    insert: {allow: [], deny: []},                                                                                    // 784
    update: {allow: [], deny: []},                                                                                    // 785
    remove: {allow: [], deny: []},                                                                                    // 786
    upsert: {allow: [], deny: []}, // dummy arrays; can't set these!                                                  // 787
    fetch: [],                                                                                                        // 788
    fetchAllFields: false                                                                                             // 789
  };                                                                                                                  // 790
                                                                                                                      // 791
  if (!self._name)                                                                                                    // 792
    return; // anonymous collection                                                                                   // 793
                                                                                                                      // 794
  // XXX Think about method namespacing. Maybe methods should be                                                      // 795
  // "Meteor:Mongo:insert/NAME"?                                                                                      // 796
  self._prefix = '/' + self._name + '/';                                                                              // 797
                                                                                                                      // 798
  // mutation methods                                                                                                 // 799
  if (self._connection) {                                                                                             // 800
    var m = {};                                                                                                       // 801
                                                                                                                      // 802
    _.each(['insert', 'update', 'remove'], function (method) {                                                        // 803
      m[self._prefix + method] = function (/* ... */) {                                                               // 804
        // All the methods do their own validation, instead of using check().                                         // 805
        check(arguments, [Match.Any]);                                                                                // 806
        var args = _.toArray(arguments);                                                                              // 807
        try {                                                                                                         // 808
          // For an insert, if the client didn't specify an _id, generate one                                         // 809
          // now; because this uses DDP.randomStream, it will be consistent with                                      // 810
          // what the client generated. We generate it now rather than later so                                       // 811
          // that if (eg) an allow/deny rule does an insert to the same                                               // 812
          // collection (not that it really should), the generated _id will                                           // 813
          // still be the first use of the stream and will be consistent.                                             // 814
          //                                                                                                          // 815
          // However, we don't actually stick the _id onto the document yet,                                          // 816
          // because we want allow/deny rules to be able to differentiate                                             // 817
          // between arbitrary client-specified _id fields and merely                                                 // 818
          // client-controlled-via-randomSeed fields.                                                                 // 819
          var generatedId = null;                                                                                     // 820
          if (method === "insert" && !_.has(args[0], '_id')) {                                                        // 821
            generatedId = self._makeNewID();                                                                          // 822
          }                                                                                                           // 823
                                                                                                                      // 824
          if (this.isSimulation) {                                                                                    // 825
            // In a client simulation, you can do any mutation (even with a                                           // 826
            // complex selector).                                                                                     // 827
            if (generatedId !== null)                                                                                 // 828
              args[0]._id = generatedId;                                                                              // 829
            return self._collection[method].apply(                                                                    // 830
              self._collection, args);                                                                                // 831
          }                                                                                                           // 832
                                                                                                                      // 833
          // This is the server receiving a method call from the client.                                              // 834
                                                                                                                      // 835
          // We don't allow arbitrary selectors in mutations from the client: only                                    // 836
          // single-ID selectors.                                                                                     // 837
          if (method !== 'insert')                                                                                    // 838
            throwIfSelectorIsNotId(args[0], method);                                                                  // 839
                                                                                                                      // 840
          if (self._restricted) {                                                                                     // 841
            // short circuit if there is no way it will pass.                                                         // 842
            if (self._validators[method].allow.length === 0) {                                                        // 843
              throw new Meteor.Error(                                                                                 // 844
                403, "Access denied. No allow validators set on restricted " +                                        // 845
                  "collection for method '" + method + "'.");                                                         // 846
            }                                                                                                         // 847
                                                                                                                      // 848
            var validatedMethodName =                                                                                 // 849
                  '_validated' + method.charAt(0).toUpperCase() + method.slice(1);                                    // 850
            args.unshift(this.userId);                                                                                // 851
            method === 'insert' && args.push(generatedId);                                                            // 852
            return self[validatedMethodName].apply(self, args);                                                       // 853
          } else if (self._isInsecure()) {                                                                            // 854
            if (generatedId !== null)                                                                                 // 855
              args[0]._id = generatedId;                                                                              // 856
            // In insecure mode, allow any mutation (with a simple selector).                                         // 857
            // XXX This is kind of bogus.  Instead of blindly passing whatever                                        // 858
            //     we get from the network to this function, we should actually                                       // 859
            //     know the correct arguments for the function and pass just                                          // 860
            //     them.  For example, if you have an extraneous extra null                                           // 861
            //     argument and this is Mongo on the server, the _wrapAsync'd                                         // 862
            //     functions like update will get confused and pass the                                               // 863
            //     "fut.resolver()" in the wrong slot, where _update will never                                       // 864
            //     invoke it. Bam, broken DDP connection.  Probably should just                                       // 865
            //     take this whole method and write it three times, invoking                                          // 866
            //     helpers for the common code.                                                                       // 867
            return self._collection[method].apply(self._collection, args);                                            // 868
          } else {                                                                                                    // 869
            // In secure mode, if we haven't called allow or deny, then nothing                                       // 870
            // is permitted.                                                                                          // 871
            throw new Meteor.Error(403, "Access denied");                                                             // 872
          }                                                                                                           // 873
        } catch (e) {                                                                                                 // 874
          if (e.name === 'MongoError' || e.name === 'MinimongoError') {                                               // 875
            throw new Meteor.Error(409, e.toString());                                                                // 876
          } else {                                                                                                    // 877
            throw e;                                                                                                  // 878
          }                                                                                                           // 879
        }                                                                                                             // 880
      };                                                                                                              // 881
    });                                                                                                               // 882
    // Minimongo on the server gets no stubs; instead, by default                                                     // 883
    // it wait()s until its result is ready, yielding.                                                                // 884
    // This matches the behavior of macromongo on the server better.                                                  // 885
    // XXX see #MeteorServerNull                                                                                      // 886
    if (Meteor.isClient || self._connection === Meteor.server)                                                        // 887
      self._connection.methods(m);                                                                                    // 888
  }                                                                                                                   // 889
};                                                                                                                    // 890
                                                                                                                      // 891
                                                                                                                      // 892
Mongo.Collection.prototype._updateFetch = function (fields) {                                                         // 893
  var self = this;                                                                                                    // 894
                                                                                                                      // 895
  if (!self._validators.fetchAllFields) {                                                                             // 896
    if (fields) {                                                                                                     // 897
      self._validators.fetch = _.union(self._validators.fetch, fields);                                               // 898
    } else {                                                                                                          // 899
      self._validators.fetchAllFields = true;                                                                         // 900
      // clear fetch just to make sure we don't accidentally read it                                                  // 901
      self._validators.fetch = null;                                                                                  // 902
    }                                                                                                                 // 903
  }                                                                                                                   // 904
};                                                                                                                    // 905
                                                                                                                      // 906
Mongo.Collection.prototype._isInsecure = function () {                                                                // 907
  var self = this;                                                                                                    // 908
  if (self._insecure === undefined)                                                                                   // 909
    return !!Package.insecure;                                                                                        // 910
  return self._insecure;                                                                                              // 911
};                                                                                                                    // 912
                                                                                                                      // 913
var docToValidate = function (validator, doc, generatedId) {                                                          // 914
  var ret = doc;                                                                                                      // 915
  if (validator.transform) {                                                                                          // 916
    ret = EJSON.clone(doc);                                                                                           // 917
    // If you set a server-side transform on your collection, then you don't get                                      // 918
    // to tell the difference between "client specified the ID" and "server                                           // 919
    // generated the ID", because transforms expect to get _id.  If you want to                                       // 920
    // do that check, you can do it with a specific                                                                   // 921
    // `C.allow({insert: f, transform: null})` validator.                                                             // 922
    if (generatedId !== null) {                                                                                       // 923
      ret._id = generatedId;                                                                                          // 924
    }                                                                                                                 // 925
    ret = validator.transform(ret);                                                                                   // 926
  }                                                                                                                   // 927
  return ret;                                                                                                         // 928
};                                                                                                                    // 929
                                                                                                                      // 930
Mongo.Collection.prototype._validatedInsert = function (userId, doc,                                                  // 931
                                                         generatedId) {                                               // 932
  var self = this;                                                                                                    // 933
                                                                                                                      // 934
  // call user validators.                                                                                            // 935
  // Any deny returns true means denied.                                                                              // 936
  if (_.any(self._validators.insert.deny, function(validator) {                                                       // 937
    return validator(userId, docToValidate(validator, doc, generatedId));                                             // 938
  })) {                                                                                                               // 939
    throw new Meteor.Error(403, "Access denied");                                                                     // 940
  }                                                                                                                   // 941
  // Any allow returns true means proceed. Throw error if they all fail.                                              // 942
  if (_.all(self._validators.insert.allow, function(validator) {                                                      // 943
    return !validator(userId, docToValidate(validator, doc, generatedId));                                            // 944
  })) {                                                                                                               // 945
    throw new Meteor.Error(403, "Access denied");                                                                     // 946
  }                                                                                                                   // 947
                                                                                                                      // 948
  // If we generated an ID above, insert it now: after the validation, but                                            // 949
  // before actually inserting.                                                                                       // 950
  if (generatedId !== null)                                                                                           // 951
    doc._id = generatedId;                                                                                            // 952
                                                                                                                      // 953
  self._collection.insert.call(self._collection, doc);                                                                // 954
};                                                                                                                    // 955
                                                                                                                      // 956
var transformDoc = function (validator, doc) {                                                                        // 957
  if (validator.transform)                                                                                            // 958
    return validator.transform(doc);                                                                                  // 959
  return doc;                                                                                                         // 960
};                                                                                                                    // 961
                                                                                                                      // 962
// Simulate a mongo `update` operation while validating that the access                                               // 963
// control rules set by calls to `allow/deny` are satisfied. If all                                                   // 964
// pass, rewrite the mongo operation to use $in to set the list of                                                    // 965
// document ids to change ##ValidatedChange                                                                           // 966
Mongo.Collection.prototype._validatedUpdate = function(                                                               // 967
    userId, selector, mutator, options) {                                                                             // 968
  var self = this;                                                                                                    // 969
                                                                                                                      // 970
  options = options || {};                                                                                            // 971
                                                                                                                      // 972
  if (!LocalCollection._selectorIsIdPerhapsAsObject(selector))                                                        // 973
    throw new Error("validated update should be of a single ID");                                                     // 974
                                                                                                                      // 975
  // We don't support upserts because they don't fit nicely into allow/deny                                           // 976
  // rules.                                                                                                           // 977
  if (options.upsert)                                                                                                 // 978
    throw new Meteor.Error(403, "Access denied. Upserts not " +                                                       // 979
                           "allowed in a restricted collection.");                                                    // 980
                                                                                                                      // 981
  // compute modified fields                                                                                          // 982
  var fields = [];                                                                                                    // 983
  _.each(mutator, function (params, op) {                                                                             // 984
    if (op.charAt(0) !== '$') {                                                                                       // 985
      throw new Meteor.Error(                                                                                         // 986
        403, "Access denied. In a restricted collection you can only update documents, not replace them. Use a Mongo update operator, such as '$set'.");
    } else if (!_.has(ALLOWED_UPDATE_OPERATIONS, op)) {                                                               // 988
      throw new Meteor.Error(                                                                                         // 989
        403, "Access denied. Operator " + op + " not allowed in a restricted collection.");                           // 990
    } else {                                                                                                          // 991
      _.each(_.keys(params), function (field) {                                                                       // 992
        // treat dotted fields as if they are replacing their                                                         // 993
        // top-level part                                                                                             // 994
        if (field.indexOf('.') !== -1)                                                                                // 995
          field = field.substring(0, field.indexOf('.'));                                                             // 996
                                                                                                                      // 997
        // record the field we are trying to change                                                                   // 998
        if (!_.contains(fields, field))                                                                               // 999
          fields.push(field);                                                                                         // 1000
      });                                                                                                             // 1001
    }                                                                                                                 // 1002
  });                                                                                                                 // 1003
                                                                                                                      // 1004
  var findOptions = {transform: null};                                                                                // 1005
  if (!self._validators.fetchAllFields) {                                                                             // 1006
    findOptions.fields = {};                                                                                          // 1007
    _.each(self._validators.fetch, function(fieldName) {                                                              // 1008
      findOptions.fields[fieldName] = 1;                                                                              // 1009
    });                                                                                                               // 1010
  }                                                                                                                   // 1011
                                                                                                                      // 1012
  var doc = self._collection.findOne(selector, findOptions);                                                          // 1013
  if (!doc)  // none satisfied!                                                                                       // 1014
    return 0;                                                                                                         // 1015
                                                                                                                      // 1016
  var factoriedDoc;                                                                                                   // 1017
                                                                                                                      // 1018
  // call user validators.                                                                                            // 1019
  // Any deny returns true means denied.                                                                              // 1020
  if (_.any(self._validators.update.deny, function(validator) {                                                       // 1021
    if (!factoriedDoc)                                                                                                // 1022
      factoriedDoc = transformDoc(validator, doc);                                                                    // 1023
    return validator(userId,                                                                                          // 1024
                     factoriedDoc,                                                                                    // 1025
                     fields,                                                                                          // 1026
                     mutator);                                                                                        // 1027
  })) {                                                                                                               // 1028
    throw new Meteor.Error(403, "Access denied");                                                                     // 1029
  }                                                                                                                   // 1030
  // Any allow returns true means proceed. Throw error if they all fail.                                              // 1031
  if (_.all(self._validators.update.allow, function(validator) {                                                      // 1032
    if (!factoriedDoc)                                                                                                // 1033
      factoriedDoc = transformDoc(validator, doc);                                                                    // 1034
    return !validator(userId,                                                                                         // 1035
                      factoriedDoc,                                                                                   // 1036
                      fields,                                                                                         // 1037
                      mutator);                                                                                       // 1038
  })) {                                                                                                               // 1039
    throw new Meteor.Error(403, "Access denied");                                                                     // 1040
  }                                                                                                                   // 1041
                                                                                                                      // 1042
  // Back when we supported arbitrary client-provided selectors, we actually                                          // 1043
  // rewrote the selector to include an _id clause before passing to Mongo to                                         // 1044
  // avoid races, but since selector is guaranteed to already just be an ID, we                                       // 1045
  // don't have to any more.                                                                                          // 1046
                                                                                                                      // 1047
  return self._collection.update.call(                                                                                // 1048
    self._collection, selector, mutator, options);                                                                    // 1049
};                                                                                                                    // 1050
                                                                                                                      // 1051
// Only allow these operations in validated updates. Specifically                                                     // 1052
// whitelist operations, rather than blacklist, so new complex                                                        // 1053
// operations that are added aren't automatically allowed. A complex                                                  // 1054
// operation is one that does more than just modify its target                                                        // 1055
// field. For now this contains all update operations except '$rename'.                                               // 1056
// http://docs.mongodb.org/manual/reference/operators/#update                                                         // 1057
var ALLOWED_UPDATE_OPERATIONS = {                                                                                     // 1058
  $inc:1, $set:1, $unset:1, $addToSet:1, $pop:1, $pullAll:1, $pull:1,                                                 // 1059
  $pushAll:1, $push:1, $bit:1                                                                                         // 1060
};                                                                                                                    // 1061
                                                                                                                      // 1062
// Simulate a mongo `remove` operation while validating access control                                                // 1063
// rules. See #ValidatedChange                                                                                        // 1064
Mongo.Collection.prototype._validatedRemove = function(userId, selector) {                                            // 1065
  var self = this;                                                                                                    // 1066
                                                                                                                      // 1067
  var findOptions = {transform: null};                                                                                // 1068
  if (!self._validators.fetchAllFields) {                                                                             // 1069
    findOptions.fields = {};                                                                                          // 1070
    _.each(self._validators.fetch, function(fieldName) {                                                              // 1071
      findOptions.fields[fieldName] = 1;                                                                              // 1072
    });                                                                                                               // 1073
  }                                                                                                                   // 1074
                                                                                                                      // 1075
  var doc = self._collection.findOne(selector, findOptions);                                                          // 1076
  if (!doc)                                                                                                           // 1077
    return 0;                                                                                                         // 1078
                                                                                                                      // 1079
  // call user validators.                                                                                            // 1080
  // Any deny returns true means denied.                                                                              // 1081
  if (_.any(self._validators.remove.deny, function(validator) {                                                       // 1082
    return validator(userId, transformDoc(validator, doc));                                                           // 1083
  })) {                                                                                                               // 1084
    throw new Meteor.Error(403, "Access denied");                                                                     // 1085
  }                                                                                                                   // 1086
  // Any allow returns true means proceed. Throw error if they all fail.                                              // 1087
  if (_.all(self._validators.remove.allow, function(validator) {                                                      // 1088
    return !validator(userId, transformDoc(validator, doc));                                                          // 1089
  })) {                                                                                                               // 1090
    throw new Meteor.Error(403, "Access denied");                                                                     // 1091
  }                                                                                                                   // 1092
                                                                                                                      // 1093
  // Back when we supported arbitrary client-provided selectors, we actually                                          // 1094
  // rewrote the selector to {_id: {$in: [ids that we found]}} before passing to                                      // 1095
  // Mongo to avoid races, but since selector is guaranteed to already just be                                        // 1096
  // an ID, we don't have to any more.                                                                                // 1097
                                                                                                                      // 1098
  return self._collection.remove.call(self._collection, selector);                                                    // 1099
};                                                                                                                    // 1100
                                                                                                                      // 1101
/**                                                                                                                   // 1102
 * @deprecated in 0.9.1                                                                                               // 1103
 */                                                                                                                   // 1104
Meteor.Collection = Mongo.Collection;                                                                                 // 1105
                                                                                                                      // 1106
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package.mongo = {
  Mongo: Mongo
};

})();

//# sourceMappingURL=5634407501007199842e07f5237a78dd43fb8276.map
