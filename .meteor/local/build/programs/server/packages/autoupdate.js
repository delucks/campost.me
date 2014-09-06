(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var WebApp = Package.webapp.WebApp;
var main = Package.webapp.main;
var WebAppInternals = Package.webapp.WebAppInternals;
var DDP = Package.ddp.DDP;
var DDPServer = Package.ddp.DDPServer;
var MongoInternals = Package.mongo.MongoInternals;
var Mongo = Package.mongo.Mongo;
var _ = Package.underscore._;

/* Package-scope variables */
var Autoupdate, ClientVersions;

(function () {

///////////////////////////////////////////////////////////////////////////////////
//                                                                               //
// packages/autoupdate/autoupdate_server.js                                      //
//                                                                               //
///////////////////////////////////////////////////////////////////////////////////
                                                                                 //
// Publish the current client versions to the client.  When a client             // 1
// sees the subscription change and that there is a new version of the           // 2
// client available on the server, it can reload.                                // 3
//                                                                               // 4
// By default there are two current client versions. The refreshable client      // 5
// version is identified by a hash of the client resources seen by the browser   // 6
// that are refreshable, such as CSS, while the non refreshable client version   // 7
// is identified by a hash of the rest of the client assets                      // 8
// (the HTML, code, and static files in the `public` directory).                 // 9
//                                                                               // 10
// If the environment variable `AUTOUPDATE_VERSION` is set it will be            // 11
// used as the client id instead.  You can use this to control when              // 12
// the client reloads.  For example, if you want to only force a                 // 13
// reload on major changes, you can use a custom AUTOUPDATE_VERSION              // 14
// which you only change when something worth pushing to clients                 // 15
// immediately happens.                                                          // 16
//                                                                               // 17
// For backwards compatibility, SERVER_ID can be used instead of                 // 18
// AUTOUPDATE_VERSION.                                                           // 19
//                                                                               // 20
// The server publishes a `meteor_autoupdate_clientVersions`                     // 21
// collection. There are two documents in this collection, a document            // 22
// with _id 'version' which represnets the non refreshable client assets,        // 23
// and a document with _id 'version-refreshable' which represents the            // 24
// refreshable client assets. Each document has a 'version' field                // 25
// which is equivalent to the hash of the relevant assets. The refreshable       // 26
// document also contains a list of the refreshable assets, so that the client   // 27
// can swap in the new assets without forcing a page refresh. Clients can        // 28
// observe changes on these documents to detect when there is a new              // 29
// version available.                                                            // 30
//                                                                               // 31
// In this implementation only two documents are present in the collection       // 32
// the current refreshable client version and the current nonRefreshable client  // 33
// version.  Developers can easily experiment with different versioning and      // 34
// updating models by forking this package.                                      // 35
                                                                                 // 36
var Future = Npm.require("fibers/future");                                       // 37
                                                                                 // 38
Autoupdate = {};                                                                 // 39
                                                                                 // 40
// The collection of acceptable client versions.                                 // 41
ClientVersions = new Mongo.Collection("meteor_autoupdate_clientVersions",        // 42
  { connection: null });                                                         // 43
                                                                                 // 44
// The client hash includes __meteor_runtime_config__, so wait until             // 45
// all packages have loaded and have had a chance to populate the                // 46
// runtime config before using the client hash as our default auto               // 47
// update version id.                                                            // 48
                                                                                 // 49
// Note: Tests allow people to override Autoupdate.autoupdateVersion before      // 50
// startup.                                                                      // 51
Autoupdate.autoupdateVersion = null;                                             // 52
Autoupdate.autoupdateVersionRefreshable = null;                                  // 53
                                                                                 // 54
var syncQueue = new Meteor._SynchronousQueue();                                  // 55
                                                                                 // 56
// updateVersions can only be called after the server has fully loaded.          // 57
var updateVersions = function (shouldReloadClientProgram) {                      // 58
  // Step 1: load the current client program on the server and update the        // 59
  // hash values in __meteor_runtime_config__.                                   // 60
  if (shouldReloadClientProgram) {                                               // 61
    WebAppInternals.reloadClientProgram();                                       // 62
  }                                                                              // 63
                                                                                 // 64
  // If we just re-read the client program, or if we don't have an autoupdate    // 65
  // version, calculate it.                                                      // 66
  if (shouldReloadClientProgram || Autoupdate.autoupdateVersion === null) {      // 67
    Autoupdate.autoupdateVersion =                                               // 68
      process.env.AUTOUPDATE_VERSION ||                                          // 69
      process.env.SERVER_ID || // XXX COMPAT 0.6.6                               // 70
      WebApp.calculateClientHashNonRefreshable();                                // 71
  }                                                                              // 72
  // If we just recalculated it OR if it was set by (eg) test-in-browser,        // 73
  // ensure it ends up in __meteor_runtime_config__.                             // 74
  __meteor_runtime_config__.autoupdateVersion =                                  // 75
    Autoupdate.autoupdateVersion;                                                // 76
                                                                                 // 77
  Autoupdate.autoupdateVersionRefreshable =                                      // 78
    __meteor_runtime_config__.autoupdateVersionRefreshable =                     // 79
      process.env.AUTOUPDATE_VERSION ||                                          // 80
      process.env.SERVER_ID || // XXX COMPAT 0.6.6                               // 81
      WebApp.calculateClientHashRefreshable();                                   // 82
                                                                                 // 83
  // Step 2: form the new client boilerplate which contains the updated          // 84
  // assets and __meteor_runtime_config__.                                       // 85
  if (shouldReloadClientProgram) {                                               // 86
    WebAppInternals.generateBoilerplate();                                       // 87
  }                                                                              // 88
                                                                                 // 89
  // XXX COMPAT WITH 0.8.3                                                       // 90
  if (! ClientVersions.findOne({current: true})) {                               // 91
    // To ensure apps with version of Meteor prior to 0.9.0 (in                  // 92
    // which the structure of documents in `ClientVersions` was                  // 93
    // different) also reload.                                                   // 94
    ClientVersions.insert({current: true});                                      // 95
  }                                                                              // 96
                                                                                 // 97
  if (! ClientVersions.findOne({_id: "version"})) {                              // 98
    ClientVersions.insert({                                                      // 99
      _id: "version",                                                            // 100
      version: Autoupdate.autoupdateVersion,                                     // 101
    });                                                                          // 102
  } else {                                                                       // 103
    ClientVersions.update("version", { $set: {                                   // 104
      version: Autoupdate.autoupdateVersion,                                     // 105
    }});                                                                         // 106
  }                                                                              // 107
                                                                                 // 108
  if (! ClientVersions.findOne({_id: "version-refreshable"})) {                  // 109
    ClientVersions.insert({                                                      // 110
      _id: "version-refreshable",                                                // 111
      version: Autoupdate.autoupdateVersionRefreshable,                          // 112
      assets: WebAppInternals.refreshableAssets                                  // 113
    });                                                                          // 114
  } else {                                                                       // 115
    ClientVersions.update("version-refreshable", { $set: {                       // 116
      version: Autoupdate.autoupdateVersionRefreshable,                          // 117
      assets: WebAppInternals.refreshableAssets                                  // 118
    }});                                                                         // 119
  }                                                                              // 120
};                                                                               // 121
                                                                                 // 122
Meteor.publish(                                                                  // 123
  "meteor_autoupdate_clientVersions",                                            // 124
  function () {                                                                  // 125
    return ClientVersions.find();                                                // 126
  },                                                                             // 127
  {is_auto: true}                                                                // 128
);                                                                               // 129
                                                                                 // 130
Meteor.startup(function () {                                                     // 131
  updateVersions(false);                                                         // 132
});                                                                              // 133
                                                                                 // 134
var fut = new Future();                                                          // 135
                                                                                 // 136
// We only want SIGUSR2 to trigger 'updateVersions' AFTER onListen,              // 137
// so we add a queued task that waits for onListen before SIGUSR2 can queue      // 138
// tasks. Note that the `onListening` callbacks do not fire until after          // 139
// Meteor.startup, so there is no concern that the 'updateVersions' calls        // 140
// from SIGUSR2 will overlap with the `updateVersions` call from Meteor.startup. // 141
                                                                                 // 142
syncQueue.queueTask(function () {                                                // 143
  fut.wait();                                                                    // 144
});                                                                              // 145
                                                                                 // 146
WebApp.onListening(function () {                                                 // 147
  fut.return();                                                                  // 148
});                                                                              // 149
                                                                                 // 150
// Listen for SIGUSR2, which signals that a client asset has changed.            // 151
process.on('SIGUSR2', Meteor.bindEnvironment(function () {                       // 152
  syncQueue.queueTask(function () {                                              // 153
    updateVersions(true);                                                        // 154
  });                                                                            // 155
}));                                                                             // 156
                                                                                 // 157
///////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package.autoupdate = {
  Autoupdate: Autoupdate
};

})();

//# sourceMappingURL=autoupdate.js.map
