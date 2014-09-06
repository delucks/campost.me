(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var Log = Package.logging.Log;
var _ = Package.underscore._;
var RoutePolicy = Package.routepolicy.RoutePolicy;
var SpacebarsCompiler = Package['spacebars-compiler'].SpacebarsCompiler;
var Spacebars = Package.spacebars.Spacebars;
var HTML = Package.htmljs.HTML;
var Blaze = Package.blaze.Blaze;
var UI = Package.blaze.UI;
var Handlebars = Package.blaze.Handlebars;

/* Package-scope variables */
var WebApp, main, WebAppInternals;

(function () {

///////////////////////////////////////////////////////////////////////////////////////////
//                                                                                       //
// packages/webapp/webapp_server.js                                                      //
//                                                                                       //
///////////////////////////////////////////////////////////////////////////////////////////
                                                                                         //
////////// Requires //////////                                                           // 1
                                                                                         // 2
var fs = Npm.require("fs");                                                              // 3
var http = Npm.require("http");                                                          // 4
var os = Npm.require("os");                                                              // 5
var path = Npm.require("path");                                                          // 6
var url = Npm.require("url");                                                            // 7
var crypto = Npm.require("crypto");                                                      // 8
                                                                                         // 9
var connect = Npm.require('connect');                                                    // 10
var useragent = Npm.require('useragent');                                                // 11
var send = Npm.require('send');                                                          // 12
                                                                                         // 13
var Future = Npm.require('fibers/future');                                               // 14
                                                                                         // 15
var SHORT_SOCKET_TIMEOUT = 5*1000;                                                       // 16
var LONG_SOCKET_TIMEOUT = 120*1000;                                                      // 17
                                                                                         // 18
WebApp = {};                                                                             // 19
WebAppInternals = {};                                                                    // 20
                                                                                         // 21
var bundledJsCssPrefix;                                                                  // 22
                                                                                         // 23
// Keepalives so that when the outer server dies unceremoniously and                     // 24
// doesn't kill us, we quit ourselves. A little gross, but better than                   // 25
// pidfiles.                                                                             // 26
// XXX This should really be part of the boot script, not the webapp package.            // 27
//     Or we should just get rid of it, and rely on containerization.                    // 28
                                                                                         // 29
var initKeepalive = function () {                                                        // 30
  var keepaliveCount = 0;                                                                // 31
                                                                                         // 32
  process.stdin.on('data', function (data) {                                             // 33
    keepaliveCount = 0;                                                                  // 34
  });                                                                                    // 35
                                                                                         // 36
  process.stdin.resume();                                                                // 37
                                                                                         // 38
  setInterval(function () {                                                              // 39
    keepaliveCount ++;                                                                   // 40
    if (keepaliveCount >= 3) {                                                           // 41
      console.log("Failed to receive keepalive! Exiting.");                              // 42
      process.exit(1);                                                                   // 43
    }                                                                                    // 44
  }, 3000);                                                                              // 45
};                                                                                       // 46
                                                                                         // 47
                                                                                         // 48
var sha1 = function (contents) {                                                         // 49
  var hash = crypto.createHash('sha1');                                                  // 50
  hash.update(contents);                                                                 // 51
  return hash.digest('hex');                                                             // 52
};                                                                                       // 53
                                                                                         // 54
var readUtf8FileSync = function (filename) {                                             // 55
  return Future.wrap(fs.readFile)(filename, 'utf8').wait();                              // 56
};                                                                                       // 57
                                                                                         // 58
// #BrowserIdentification                                                                // 59
//                                                                                       // 60
// We have multiple places that want to identify the browser: the                        // 61
// unsupported browser page, the appcache package, and, eventually                       // 62
// delivering browser polyfills only as needed.                                          // 63
//                                                                                       // 64
// To avoid detecting the browser in multiple places ad-hoc, we create a                 // 65
// Meteor "browser" object. It uses but does not expose the npm                          // 66
// useragent module (we could choose a different mechanism to identify                   // 67
// the browser in the future if we wanted to).  The browser object                       // 68
// contains                                                                              // 69
//                                                                                       // 70
// * `name`: the name of the browser in camel case                                       // 71
// * `major`, `minor`, `patch`: integers describing the browser version                  // 72
//                                                                                       // 73
// Also here is an early version of a Meteor `request` object, intended                  // 74
// to be a high-level description of the request without exposing                        // 75
// details of connect's low-level `req`.  Currently it contains:                         // 76
//                                                                                       // 77
// * `browser`: browser identification object described above                            // 78
// * `url`: parsed url, including parsed query params                                    // 79
//                                                                                       // 80
// As a temporary hack there is a `categorizeRequest` function on WebApp which           // 81
// converts a connect `req` to a Meteor `request`. This can go away once smart           // 82
// packages such as appcache are being passed a `request` object directly when           // 83
// they serve content.                                                                   // 84
//                                                                                       // 85
// This allows `request` to be used uniformly: it is passed to the html                  // 86
// attributes hook, and the appcache package can use it when deciding                    // 87
// whether to generate a 404 for the manifest.                                           // 88
//                                                                                       // 89
// Real routing / server side rendering will probably refactor this                      // 90
// heavily.                                                                              // 91
                                                                                         // 92
                                                                                         // 93
// e.g. "Mobile Safari" => "mobileSafari"                                                // 94
var camelCase = function (name) {                                                        // 95
  var parts = name.split(' ');                                                           // 96
  parts[0] = parts[0].toLowerCase();                                                     // 97
  for (var i = 1;  i < parts.length;  ++i) {                                             // 98
    parts[i] = parts[i].charAt(0).toUpperCase() + parts[i].substr(1);                    // 99
  }                                                                                      // 100
  return parts.join('');                                                                 // 101
};                                                                                       // 102
                                                                                         // 103
var identifyBrowser = function (userAgentString) {                                       // 104
  var userAgent = useragent.lookup(userAgentString);                                     // 105
  return {                                                                               // 106
    name: camelCase(userAgent.family),                                                   // 107
    major: +userAgent.major,                                                             // 108
    minor: +userAgent.minor,                                                             // 109
    patch: +userAgent.patch                                                              // 110
  };                                                                                     // 111
};                                                                                       // 112
                                                                                         // 113
// XXX Refactor as part of implementing real routing.                                    // 114
WebAppInternals.identifyBrowser = identifyBrowser;                                       // 115
                                                                                         // 116
WebApp.categorizeRequest = function (req) {                                              // 117
  return {                                                                               // 118
    browser: identifyBrowser(req.headers['user-agent']),                                 // 119
    url: url.parse(req.url, true)                                                        // 120
  };                                                                                     // 121
};                                                                                       // 122
                                                                                         // 123
// HTML attribute hooks: functions to be called to determine any attributes to           // 124
// be added to the '<html>' tag. Each function is passed a 'request' object (see         // 125
// #BrowserIdentification) and should return a string,                                   // 126
var htmlAttributeHooks = [];                                                             // 127
var getHtmlAttributes = function (request) {                                             // 128
  var combinedAttributes  = {};                                                          // 129
  _.each(htmlAttributeHooks || [], function (hook) {                                     // 130
    var attributes = hook(request);                                                      // 131
    if (attributes === null)                                                             // 132
      return;                                                                            // 133
    if (typeof attributes !== 'object')                                                  // 134
      throw Error("HTML attribute hook must return null or object");                     // 135
    _.extend(combinedAttributes, attributes);                                            // 136
  });                                                                                    // 137
  return combinedAttributes;                                                             // 138
};                                                                                       // 139
WebApp.addHtmlAttributeHook = function (hook) {                                          // 140
  htmlAttributeHooks.push(hook);                                                         // 141
};                                                                                       // 142
                                                                                         // 143
// Serve app HTML for this URL?                                                          // 144
var appUrl = function (url) {                                                            // 145
  if (url === '/favicon.ico' || url === '/robots.txt')                                   // 146
    return false;                                                                        // 147
                                                                                         // 148
  // NOTE: app.manifest is not a web standard like favicon.ico and                       // 149
  // robots.txt. It is a file name we have chosen to use for HTML5                       // 150
  // appcache URLs. It is included here to prevent using an appcache                     // 151
  // then removing it from poisoning an app permanently. Eventually,                     // 152
  // once we have server side routing, this won't be needed as                           // 153
  // unknown URLs with return a 404 automatically.                                       // 154
  if (url === '/app.manifest')                                                           // 155
    return false;                                                                        // 156
                                                                                         // 157
  // Avoid serving app HTML for declared routes such as /sockjs/.                        // 158
  if (RoutePolicy.classify(url))                                                         // 159
    return false;                                                                        // 160
                                                                                         // 161
  // we currently return app HTML on all URLs by default                                 // 162
  return true;                                                                           // 163
};                                                                                       // 164
                                                                                         // 165
                                                                                         // 166
// Calculate a hash of all the client resources downloaded by the                        // 167
// browser, including the application HTML, runtime config, code, and                    // 168
// static files.                                                                         // 169
//                                                                                       // 170
// This hash *must* change if any resources seen by the browser                          // 171
// change, and ideally *doesn't* change for any server-only changes                      // 172
// (but the second is a performance enhancement, not a hard                              // 173
// requirement).                                                                         // 174
                                                                                         // 175
var calculateClientHash = function (includeFilter) {                                     // 176
  var hash = crypto.createHash('sha1');                                                  // 177
  // Omit the old hashed client values in the new hash. These may be                     // 178
  // modified in the new boilerplate.                                                    // 179
  hash.update(JSON.stringify(_.omit(__meteor_runtime_config__,                           // 180
               ['autoupdateVersion', 'autoupdateVersionRefreshable']), 'utf8'));         // 181
  _.each(WebApp.clientProgram.manifest, function (resource) {                            // 182
      if ((! includeFilter || includeFilter(resource.type)) &&                           // 183
          (resource.where === 'client' || resource.where === 'internal')) {              // 184
      hash.update(resource.path);                                                        // 185
      hash.update(resource.hash);                                                        // 186
    }                                                                                    // 187
  });                                                                                    // 188
  return hash.digest('hex');                                                             // 189
};                                                                                       // 190
                                                                                         // 191
                                                                                         // 192
// We need to calculate the client hash after all packages have loaded                   // 193
// to give them a chance to populate __meteor_runtime_config__.                          // 194
//                                                                                       // 195
// Calculating the hash during startup means that packages can only                      // 196
// populate __meteor_runtime_config__ during load, not during startup.                   // 197
//                                                                                       // 198
// Calculating instead it at the beginning of main after all startup                     // 199
// hooks had run would allow packages to also populate                                   // 200
// __meteor_runtime_config__ during startup, but that's too late for                     // 201
// autoupdate because it needs to have the client hash at startup to                     // 202
// insert the auto update version itself into                                            // 203
// __meteor_runtime_config__ to get it to the client.                                    // 204
//                                                                                       // 205
// An alternative would be to give autoupdate a "post-start,                             // 206
// pre-listen" hook to allow it to insert the auto update version at                     // 207
// the right moment.                                                                     // 208
                                                                                         // 209
Meteor.startup(function () {                                                             // 210
  WebApp.clientHash = calculateClientHash();                                             // 211
  WebApp.calculateClientHashRefreshable = function () {                                  // 212
    return calculateClientHash(function (name) {                                         // 213
      return name === "css";                                                             // 214
    });                                                                                  // 215
  };                                                                                     // 216
  WebApp.calculateClientHashNonRefreshable = function () {                               // 217
    return calculateClientHash(function (name) {                                         // 218
      return name !== "css";                                                             // 219
    });                                                                                  // 220
  };                                                                                     // 221
});                                                                                      // 222
                                                                                         // 223
                                                                                         // 224
                                                                                         // 225
// When we have a request pending, we want the socket timeout to be long, to             // 226
// give ourselves a while to serve it, and to allow sockjs long polls to                 // 227
// complete.  On the other hand, we want to close idle sockets relatively                // 228
// quickly, so that we can shut down relatively promptly but cleanly, without            // 229
// cutting off anyone's response.                                                        // 230
WebApp._timeoutAdjustmentRequestCallback = function (req, res) {                         // 231
  // this is really just req.socket.setTimeout(LONG_SOCKET_TIMEOUT);                     // 232
  req.setTimeout(LONG_SOCKET_TIMEOUT);                                                   // 233
  // Insert our new finish listener to run BEFORE the existing one which removes         // 234
  // the response from the socket.                                                       // 235
  var finishListeners = res.listeners('finish');                                         // 236
  // XXX Apparently in Node 0.12 this event is now called 'prefinish'.                   // 237
  // https://github.com/joyent/node/commit/7c9b6070                                      // 238
  res.removeAllListeners('finish');                                                      // 239
  res.on('finish', function () {                                                         // 240
    res.setTimeout(SHORT_SOCKET_TIMEOUT);                                                // 241
  });                                                                                    // 242
  _.each(finishListeners, function (l) { res.on('finish', l); });                        // 243
};                                                                                       // 244
                                                                                         // 245
// Will be updated by main before we listen.                                             // 246
var boilerplateFunc = null;                                                              // 247
var boilerplateBaseData = null;                                                          // 248
var memoizedBoilerplate = {};                                                            // 249
                                                                                         // 250
// Given a request (as returned from `categorizeRequest`), return the                    // 251
// boilerplate HTML to serve for that request. Memoizes on HTML                          // 252
// attributes (used by, eg, appcache) and whether inline scripts are                     // 253
// currently allowed.                                                                    // 254
var getBoilerplate = function (request) {                                                // 255
  var htmlAttributes = getHtmlAttributes(request);                                       // 256
                                                                                         // 257
  // The only thing that changes from request to request (for now) are                   // 258
  // the HTML attributes (used by, eg, appcache) and whether inline                      // 259
  // scripts are allowed, so we can memoize based on that.                               // 260
  var boilerplateKey = JSON.stringify({                                                  // 261
    inlineScriptsAllowed: inlineScriptsAllowed,                                          // 262
    htmlAttributes: htmlAttributes                                                       // 263
  });                                                                                    // 264
                                                                                         // 265
  if (! _.has(memoizedBoilerplate, boilerplateKey)) {                                    // 266
    var boilerplateData = _.extend({                                                     // 267
      htmlAttributes: htmlAttributes,                                                    // 268
      inlineScriptsAllowed: WebAppInternals.inlineScriptsAllowed()                       // 269
    }, boilerplateBaseData);                                                             // 270
                                                                                         // 271
    memoizedBoilerplate[boilerplateKey] = "<!DOCTYPE html>\n" +                          // 272
      Blaze.toHTML(Blaze.With(boilerplateData, boilerplateFunc));                        // 273
  }                                                                                      // 274
  return memoizedBoilerplate[boilerplateKey];                                            // 275
};                                                                                       // 276
                                                                                         // 277
// Serve static files from the manifest or added with                                    // 278
// `addStaticJs`. Exported for tests.                                                    // 279
// Options are:                                                                          // 280
//   - staticFiles: object mapping pathname of file in manifest -> {                     // 281
//     path, cacheable, sourceMapUrl, type }                                             // 282
//   - clientDir: root directory for static files from client manifest                   // 283
WebAppInternals.staticFilesMiddleware = function (options, req, res, next) {             // 284
  if ('GET' != req.method && 'HEAD' != req.method) {                                     // 285
    next();                                                                              // 286
    return;                                                                              // 287
  }                                                                                      // 288
  var pathname = connect.utils.parseUrl(req).pathname;                                   // 289
  var staticFiles = options.staticFiles;                                                 // 290
  var clientDir = options.clientDir;                                                     // 291
                                                                                         // 292
  try {                                                                                  // 293
    pathname = decodeURIComponent(pathname);                                             // 294
  } catch (e) {                                                                          // 295
    next();                                                                              // 296
    return;                                                                              // 297
  }                                                                                      // 298
                                                                                         // 299
  var serveStaticJs = function (s) {                                                     // 300
    res.writeHead(200, {                                                                 // 301
      'Content-type': 'application/javascript; charset=UTF-8'                            // 302
    });                                                                                  // 303
    res.write(s);                                                                        // 304
    res.end();                                                                           // 305
  };                                                                                     // 306
                                                                                         // 307
  if (pathname === "/meteor_runtime_config.js" &&                                        // 308
      ! WebAppInternals.inlineScriptsAllowed()) {                                        // 309
    serveStaticJs("__meteor_runtime_config__ = " +                                       // 310
                  JSON.stringify(__meteor_runtime_config__) + ";");                      // 311
    return;                                                                              // 312
  } else if (_.has(additionalStaticJs, pathname) &&                                      // 313
             ! WebAppInternals.inlineScriptsAllowed()) {                                 // 314
    serveStaticJs(additionalStaticJs[pathname]);                                         // 315
    return;                                                                              // 316
  }                                                                                      // 317
                                                                                         // 318
  if (!_.has(staticFiles, pathname)) {                                                   // 319
    next();                                                                              // 320
    return;                                                                              // 321
  }                                                                                      // 322
                                                                                         // 323
  // We don't need to call pause because, unlike 'static', once we call into             // 324
  // 'send' and yield to the event loop, we never call another handler with              // 325
  // 'next'.                                                                             // 326
                                                                                         // 327
  var info = staticFiles[pathname];                                                      // 328
                                                                                         // 329
  // Cacheable files are files that should never change. Typically                       // 330
  // named by their hash (eg meteor bundled js and css files).                           // 331
  // We cache them ~forever (1yr).                                                       // 332
  //                                                                                     // 333
  // We cache non-cacheable files anyway. This isn't really correct, as users            // 334
  // can change the files and changes won't propagate immediately. However, if           // 335
  // we don't cache them, browsers will 'flicker' when rerendering                       // 336
  // images. Eventually we will probably want to rewrite URLs of static assets           // 337
  // to include a query parameter to bust caches. That way we can both get               // 338
  // good caching behavior and allow users to change assets without delay.               // 339
  // https://github.com/meteor/meteor/issues/773                                         // 340
  var maxAge = info.cacheable                                                            // 341
        ? 1000 * 60 * 60 * 24 * 365                                                      // 342
        : 1000 * 60 * 60 * 24;                                                           // 343
                                                                                         // 344
  // Set the X-SourceMap header, which current Chrome understands.                       // 345
  // (The files also contain '//#' comments which FF 24 understands and                  // 346
  // Chrome doesn't understand yet.)                                                     // 347
  //                                                                                     // 348
  // Eventually we should set the SourceMap header but the current version of            // 349
  // Chrome and no version of FF supports it.                                            // 350
  //                                                                                     // 351
  // To figure out if your version of Chrome should support the SourceMap                // 352
  // header,                                                                             // 353
  //   - go to chrome://version. Let's say the Chrome version is                         // 354
  //      28.0.1500.71 and the Blink version is 537.36 (@153022)                         // 355
  //   - go to http://src.chromium.org/viewvc/blink/branches/chromium/1500/Source/core/inspector/InspectorPageAgent.cpp?view=log
  //     where the "1500" is the third part of your Chrome version                       // 357
  //   - find the first revision that is no greater than the "153022"                    // 358
  //     number.  That's probably the first one and it probably has                      // 359
  //     a message of the form "Branch 1500 - blink@r149738"                             // 360
  //   - If *that* revision number (149738) is at least 151755,                          // 361
  //     then Chrome should support SourceMap (not just X-SourceMap)                     // 362
  // (The change is https://codereview.chromium.org/15832007)                            // 363
  //                                                                                     // 364
  // You also need to enable source maps in Chrome: open dev tools, click                // 365
  // the gear in the bottom right corner, and select "enable source maps".               // 366
  //                                                                                     // 367
  // Firefox 23+ supports source maps but doesn't support either header yet,             // 368
  // so we include the '//#' comment for it:                                             // 369
  //   https://bugzilla.mozilla.org/show_bug.cgi?id=765993                               // 370
  // In FF 23 you need to turn on `devtools.debugger.source-maps-enabled`                // 371
  // in `about:config` (it is on by default in FF 24).                                   // 372
  if (info.sourceMapUrl)                                                                 // 373
    res.setHeader('X-SourceMap', info.sourceMapUrl);                                     // 374
                                                                                         // 375
  if (info.type === "js") {                                                              // 376
    res.setHeader("Content-Type", "application/javascript; charset=UTF-8");              // 377
  } else if (info.type === "css") {                                                      // 378
    res.setHeader("Content-Type", "text/css; charset=UTF-8");                            // 379
  }                                                                                      // 380
                                                                                         // 381
  send(req, path.join(clientDir, info.path))                                             // 382
    .maxage(maxAge)                                                                      // 383
    .hidden(true)  // if we specified a dotfile in the manifest, serve it                // 384
    .on('error', function (err) {                                                        // 385
      Log.error("Error serving static file " + err);                                     // 386
      res.writeHead(500);                                                                // 387
      res.end();                                                                         // 388
    })                                                                                   // 389
    .on('directory', function () {                                                       // 390
      Log.error("Unexpected directory " + info.path);                                    // 391
      res.writeHead(500);                                                                // 392
      res.end();                                                                         // 393
    })                                                                                   // 394
    .pipe(res);                                                                          // 395
};                                                                                       // 396
                                                                                         // 397
var runWebAppServer = function () {                                                      // 398
  var shuttingDown = false;                                                              // 399
  var syncQueue = new Meteor._SynchronousQueue();                                        // 400
                                                                                         // 401
  var getItemPathname = function (itemUrl) {                                             // 402
    return decodeURIComponent(url.parse(itemUrl).pathname);                              // 403
  };                                                                                     // 404
                                                                                         // 405
  var staticFiles;                                                                       // 406
                                                                                         // 407
  var clientJsonPath;                                                                    // 408
  var clientDir;                                                                         // 409
  var clientJson;                                                                        // 410
                                                                                         // 411
  WebAppInternals.reloadClientProgram = function () {                                    // 412
    syncQueue.runTask(function() {                                                       // 413
      try {                                                                              // 414
        // read the control for the client we'll be serving up                           // 415
        clientJsonPath = path.join(__meteor_bootstrap__.serverDir,                       // 416
                                   __meteor_bootstrap__.configJson.client);              // 417
        clientDir = path.dirname(clientJsonPath);                                        // 418
        clientJson = JSON.parse(readUtf8FileSync(clientJsonPath));                       // 419
        if (clientJson.format !== "web-program-pre1")                                    // 420
          throw new Error("Unsupported format for client assets: " +                     // 421
                          JSON.stringify(clientJson.format));                            // 422
                                                                                         // 423
        staticFiles = {};                                                                // 424
        _.each(clientJson.manifest, function (item) {                                    // 425
          if (item.url && item.where === "client") {                                     // 426
            staticFiles[getItemPathname(item.url)] = {                                   // 427
              path: item.path,                                                           // 428
              cacheable: item.cacheable,                                                 // 429
              // Link from source to its map                                             // 430
              sourceMapUrl: item.sourceMapUrl,                                           // 431
              type: item.type                                                            // 432
            };                                                                           // 433
                                                                                         // 434
            if (item.sourceMap) {                                                        // 435
              // Serve the source map too, under the specified URL. We assume all        // 436
              // source maps are cacheable.                                              // 437
              staticFiles[getItemPathname(item.sourceMapUrl)] = {                        // 438
                path: item.sourceMap,                                                    // 439
                cacheable: true                                                          // 440
              };                                                                         // 441
            }                                                                            // 442
          }                                                                              // 443
        });                                                                              // 444
        WebApp.clientProgram = {                                                         // 445
          manifest: clientJson.manifest                                                  // 446
          // XXX do we need a "root: clientDir" field here? it used to be here but       // 447
          // was unused.                                                                 // 448
        };                                                                               // 449
                                                                                         // 450
        // Exported for tests.                                                           // 451
        WebAppInternals.staticFiles = staticFiles;                                       // 452
      } catch (e) {                                                                      // 453
        Log.error("Error reloading the client program: " + e.message);                   // 454
        process.exit(1);                                                                 // 455
      }                                                                                  // 456
    });                                                                                  // 457
  };                                                                                     // 458
  WebAppInternals.reloadClientProgram();                                                 // 459
                                                                                         // 460
  if (! clientJsonPath || ! clientDir || ! clientJson)                                   // 461
    throw new Error("Client config file not parsed.");                                   // 462
                                                                                         // 463
  // webserver                                                                           // 464
  var app = connect();                                                                   // 465
                                                                                         // 466
  // Auto-compress any json, javascript, or text.                                        // 467
  app.use(connect.compress());                                                           // 468
                                                                                         // 469
  // Packages and apps can add handlers that run before any other Meteor                 // 470
  // handlers via WebApp.rawConnectHandlers.                                             // 471
  var rawConnectHandlers = connect();                                                    // 472
  app.use(rawConnectHandlers);                                                           // 473
                                                                                         // 474
  // Strip off the path prefix, if it exists.                                            // 475
  app.use(function (request, response, next) {                                           // 476
    var pathPrefix = __meteor_runtime_config__.ROOT_URL_PATH_PREFIX;                     // 477
    var url = Npm.require('url').parse(request.url);                                     // 478
    var pathname = url.pathname;                                                         // 479
    // check if the path in the url starts with the path prefix (and the part            // 480
    // after the path prefix must start with a / if it exists.)                          // 481
    if (pathPrefix && pathname.substring(0, pathPrefix.length) === pathPrefix &&         // 482
       (pathname.length == pathPrefix.length                                             // 483
        || pathname.substring(pathPrefix.length, pathPrefix.length + 1) === "/")) {      // 484
      request.url = request.url.substring(pathPrefix.length);                            // 485
      next();                                                                            // 486
    } else if (pathname === "/favicon.ico" || pathname === "/robots.txt") {              // 487
      next();                                                                            // 488
    } else if (pathPrefix) {                                                             // 489
      response.writeHead(404);                                                           // 490
      response.write("Unknown path");                                                    // 491
      response.end();                                                                    // 492
    } else {                                                                             // 493
      next();                                                                            // 494
    }                                                                                    // 495
  });                                                                                    // 496
                                                                                         // 497
  // Parse the query string into res.query. Used by oauth_server, but it's               // 498
  // generally pretty handy..                                                            // 499
  app.use(connect.query());                                                              // 500
                                                                                         // 501
  // Serve static files from the manifest.                                               // 502
  // This is inspired by the 'static' middleware.                                        // 503
  app.use(function (req, res, next) {                                                    // 504
    return WebAppInternals.staticFilesMiddleware({                                       // 505
      staticFiles: staticFiles,                                                          // 506
      clientDir: clientDir                                                               // 507
    }, req, res, next);                                                                  // 508
  });                                                                                    // 509
                                                                                         // 510
  // Packages and apps can add handlers to this via WebApp.connectHandlers.              // 511
  // They are inserted before our default handler.                                       // 512
  var packageAndAppHandlers = connect();                                                 // 513
  app.use(packageAndAppHandlers);                                                        // 514
                                                                                         // 515
  var suppressConnectErrors = false;                                                     // 516
  // connect knows it is an error handler because it has 4 arguments instead of          // 517
  // 3. go figure.  (It is not smart enough to find such a thing if it's hidden          // 518
  // inside packageAndAppHandlers.)                                                      // 519
  app.use(function (err, req, res, next) {                                               // 520
    if (!err || !suppressConnectErrors || !req.headers['x-suppress-error']) {            // 521
      next(err);                                                                         // 522
      return;                                                                            // 523
    }                                                                                    // 524
    res.writeHead(err.status, { 'Content-Type': 'text/plain' });                         // 525
    res.end("An error message");                                                         // 526
  });                                                                                    // 527
                                                                                         // 528
  app.use(function (req, res, next) {                                                    // 529
    if (! appUrl(req.url))                                                               // 530
      return next();                                                                     // 531
                                                                                         // 532
    if (!boilerplateFunc)                                                                // 533
      throw new Error("boilerplateFunc should be set before listening!");                // 534
    if (!boilerplateBaseData)                                                            // 535
      throw new Error("boilerplateBaseData should be set before listening!");            // 536
                                                                                         // 537
    var headers = {                                                                      // 538
      'Content-Type':  'text/html; charset=utf-8'                                        // 539
    };                                                                                   // 540
    if (shuttingDown)                                                                    // 541
      headers['Connection'] = 'Close';                                                   // 542
                                                                                         // 543
    var request = WebApp.categorizeRequest(req);                                         // 544
                                                                                         // 545
    if (request.url.query && request.url.query['meteor_css_resource']) {                 // 546
      // In this case, we're requesting a CSS resource in the meteor-specific            // 547
      // way, but we don't have it.  Serve a static css file that indicates that         // 548
      // we didn't have it, so we can detect that and refresh.                           // 549
      headers['Content-Type'] = 'text/css; charset=utf-8';                               // 550
      res.writeHead(200, headers);                                                       // 551
      res.write(".meteor-css-not-found-error { width: 0px;}");                           // 552
      res.end();                                                                         // 553
      return undefined;                                                                  // 554
    }                                                                                    // 555
                                                                                         // 556
    var boilerplate;                                                                     // 557
    try {                                                                                // 558
      boilerplate = getBoilerplate(request);                                             // 559
    } catch (e) {                                                                        // 560
      Log.error("Error running template: " + e);                                         // 561
      res.writeHead(500, headers);                                                       // 562
      res.end();                                                                         // 563
      return undefined;                                                                  // 564
    }                                                                                    // 565
                                                                                         // 566
    res.writeHead(200, headers);                                                         // 567
    res.write(boilerplate);                                                              // 568
    res.end();                                                                           // 569
    return undefined;                                                                    // 570
  });                                                                                    // 571
                                                                                         // 572
  // Return 404 by default, if no other handlers serve this URL.                         // 573
  app.use(function (req, res) {                                                          // 574
    res.writeHead(404);                                                                  // 575
    res.end();                                                                           // 576
  });                                                                                    // 577
                                                                                         // 578
                                                                                         // 579
  var httpServer = http.createServer(app);                                               // 580
  var onListeningCallbacks = [];                                                         // 581
                                                                                         // 582
  // After 5 seconds w/o data on a socket, kill it.  On the other hand, if               // 583
  // there's an outstanding request, give it a higher timeout instead (to avoid          // 584
  // killing long-polling requests)                                                      // 585
  httpServer.setTimeout(SHORT_SOCKET_TIMEOUT);                                           // 586
                                                                                         // 587
  // Do this here, and then also in livedata/stream_server.js, because                   // 588
  // stream_server.js kills all the current request handlers when installing its         // 589
  // own.                                                                                // 590
  httpServer.on('request', WebApp._timeoutAdjustmentRequestCallback);                    // 591
                                                                                         // 592
                                                                                         // 593
  // For now, handle SIGHUP here.  Later, this should be in some centralized             // 594
  // Meteor shutdown code.                                                               // 595
  process.on('SIGHUP', Meteor.bindEnvironment(function () {                              // 596
    shuttingDown = true;                                                                 // 597
    // tell others with websockets open that we plan to close this.                      // 598
    // XXX: Eventually, this should be done with a standard meteor shut-down             // 599
    // logic path.                                                                       // 600
    httpServer.emit('meteor-closing');                                                   // 601
                                                                                         // 602
    httpServer.close(Meteor.bindEnvironment(function () {                                // 603
      if (proxy) {                                                                       // 604
        try {                                                                            // 605
          proxy.call('removeBindingsForJob', process.env.GALAXY_JOB);                    // 606
        } catch (e) {                                                                    // 607
          Log.error("Error removing bindings: " + e.message);                            // 608
          process.exit(1);                                                               // 609
        }                                                                                // 610
      }                                                                                  // 611
      process.exit(0);                                                                   // 612
                                                                                         // 613
    }, "On http server close failed"));                                                  // 614
                                                                                         // 615
    // Ideally we will close before this hits.                                           // 616
    Meteor.setTimeout(function () {                                                      // 617
      Log.warn("Closed by SIGHUP but one or more HTTP requests may not have finished."); // 618
      process.exit(1);                                                                   // 619
    }, 5000);                                                                            // 620
                                                                                         // 621
  }, function (err) {                                                                    // 622
    console.log(err);                                                                    // 623
    process.exit(1);                                                                     // 624
  }));                                                                                   // 625
                                                                                         // 626
  // start up app                                                                        // 627
  _.extend(WebApp, {                                                                     // 628
    connectHandlers: packageAndAppHandlers,                                              // 629
    rawConnectHandlers: rawConnectHandlers,                                              // 630
    httpServer: httpServer,                                                              // 631
    // For testing.                                                                      // 632
    suppressConnectErrors: function () {                                                 // 633
      suppressConnectErrors = true;                                                      // 634
    },                                                                                   // 635
    onListening: function (f) {                                                          // 636
      if (onListeningCallbacks)                                                          // 637
        onListeningCallbacks.push(f);                                                    // 638
      else                                                                               // 639
        f();                                                                             // 640
    },                                                                                   // 641
    // Hack: allow http tests to call connect.basicAuth without making them              // 642
    // Npm.depends on another copy of connect. (That would be fine if we could           // 643
    // have test-only NPM dependencies but is overkill here.)                            // 644
    __basicAuth__: connect.basicAuth                                                     // 645
  });                                                                                    // 646
                                                                                         // 647
  // Let the rest of the packages (and Meteor.startup hooks) insert connect              // 648
  // middlewares and update __meteor_runtime_config__, then keep going to set up         // 649
  // actually serving HTML.                                                              // 650
  main = function (argv) {                                                               // 651
    // main happens post startup hooks, so we don't need a Meteor.startup() to           // 652
    // ensure this happens after the galaxy package is loaded.                           // 653
    var AppConfig = Package["application-configuration"].AppConfig;                      // 654
    // We used to use the optimist npm package to parse argv here, but it's              // 655
    // overkill (and no longer in the dev bundle). Just assume any instance of           // 656
    // '--keepalive' is a use of the option.                                             // 657
    var expectKeepalives = _.contains(argv, '--keepalive');                              // 658
                                                                                         // 659
    var boilerplateTemplateSource = Assets.getText("boilerplate.html");                  // 660
                                                                                         // 661
    // Exported to allow client-side only changes to rebuild the boilerplate             // 662
    // without requiring a full server restart.                                          // 663
    WebAppInternals.generateBoilerplate = function () {                                  // 664
      syncQueue.runTask(function() {                                                     // 665
        boilerplateBaseData = {                                                          // 666
          // 'htmlAttributes' and 'inlineScriptsAllowed' are set at render               // 667
          // time, because they are allowed to change from request to                    // 668
          // request.                                                                    // 669
          css: [],                                                                       // 670
          js: [],                                                                        // 671
          head: '',                                                                      // 672
          body: '',                                                                      // 673
          additionalStaticJs: _.map(                                                     // 674
            additionalStaticJs,                                                          // 675
            function (contents, pathname) {                                              // 676
              return {                                                                   // 677
                pathname: pathname,                                                      // 678
                contents: contents                                                       // 679
              };                                                                         // 680
            }                                                                            // 681
          ),                                                                             // 682
          meteorRuntimeConfig: JSON.stringify(__meteor_runtime_config__),                // 683
          rootUrlPathPrefix: __meteor_runtime_config__.ROOT_URL_PATH_PREFIX || '',       // 684
          bundledJsCssPrefix: bundledJsCssPrefix ||                                      // 685
            __meteor_runtime_config__.ROOT_URL_PATH_PREFIX || ''                         // 686
        };                                                                               // 687
                                                                                         // 688
        _.each(WebApp.clientProgram.manifest, function (item) {                          // 689
          if (item.type === 'css' && item.where === 'client') {                          // 690
            boilerplateBaseData.css.push({url: item.url});                               // 691
          }                                                                              // 692
          if (item.type === 'js' && item.where === 'client') {                           // 693
            boilerplateBaseData.js.push({url: item.url});                                // 694
          }                                                                              // 695
          if (item.type === 'head') {                                                    // 696
            boilerplateBaseData.head =                                                   // 697
              readUtf8FileSync(path.join(clientDir, item.path));                         // 698
          }                                                                              // 699
          if (item.type === 'body') {                                                    // 700
            boilerplateBaseData.body =                                                   // 701
              readUtf8FileSync(path.join(clientDir, item.path));                         // 702
          }                                                                              // 703
        });                                                                              // 704
                                                                                         // 705
        var boilerplateRenderCode = SpacebarsCompiler.compile(                           // 706
          boilerplateTemplateSource, { isBody: true });                                  // 707
                                                                                         // 708
        // Note that we are actually depending on eval's local environment capture       // 709
        // so that UI and HTML are visible to the eval'd code.                           // 710
        boilerplateFunc = eval(boilerplateRenderCode);                                   // 711
                                                                                         // 712
        // Clear the memoized boilerplate cache.                                         // 713
        memoizedBoilerplate = {};                                                        // 714
                                                                                         // 715
        WebAppInternals.refreshableAssets = { allCss: boilerplateBaseData.css };         // 716
      });                                                                                // 717
    };                                                                                   // 718
    WebAppInternals.generateBoilerplate();                                               // 719
                                                                                         // 720
    // only start listening after all the startup code has run.                          // 721
    var localPort = parseInt(process.env.PORT) || 0;                                     // 722
    var host = process.env.BIND_IP;                                                      // 723
    var localIp = host || '0.0.0.0';                                                     // 724
    httpServer.listen(localPort, localIp, Meteor.bindEnvironment(function() {            // 725
      if (expectKeepalives)                                                              // 726
        console.log("LISTENING"); // must match run-app.js                               // 727
      var proxyBinding;                                                                  // 728
                                                                                         // 729
      AppConfig.configurePackage('webapp', function (configuration) {                    // 730
        if (proxyBinding)                                                                // 731
          proxyBinding.stop();                                                           // 732
        if (configuration && configuration.proxy) {                                      // 733
          // TODO: We got rid of the place where this checks the app's                   // 734
          // configuration, because this wants to be configured for some things          // 735
          // on a per-job basis.  Discuss w/ teammates.                                  // 736
          proxyBinding = AppConfig.configureService(                                     // 737
            "proxy",                                                                     // 738
            "pre0",                                                                      // 739
            function (proxyService) {                                                    // 740
              if (proxyService && ! _.isEmpty(proxyService)) {                           // 741
                var proxyConf;                                                           // 742
                // XXX Figure out a per-job way to specify bind location                 // 743
                // (besides hardcoding the location for ADMIN_APP jobs).                 // 744
                if (process.env.ADMIN_APP) {                                             // 745
                  var bindPathPrefix = "";                                               // 746
                  if (process.env.GALAXY_APP !== "panel") {                              // 747
                    bindPathPrefix = "/" + bindPathPrefix +                              // 748
                      encodeURIComponent(                                                // 749
                        process.env.GALAXY_APP                                           // 750
                      ).replace(/\./g, '_');                                             // 751
                  }                                                                      // 752
                  proxyConf = {                                                          // 753
                    bindHost: process.env.GALAXY_NAME,                                   // 754
                    bindPathPrefix: bindPathPrefix,                                      // 755
                    requiresAuth: true                                                   // 756
                  };                                                                     // 757
                } else {                                                                 // 758
                  proxyConf = configuration.proxy;                                       // 759
                }                                                                        // 760
                Log("Attempting to bind to proxy at " +                                  // 761
                    proxyService);                                                       // 762
                WebAppInternals.bindToProxy(_.extend({                                   // 763
                  proxyEndpoint: proxyService                                            // 764
                }, proxyConf));                                                          // 765
              }                                                                          // 766
            }                                                                            // 767
          );                                                                             // 768
        }                                                                                // 769
      });                                                                                // 770
                                                                                         // 771
      var callbacks = onListeningCallbacks;                                              // 772
      onListeningCallbacks = null;                                                       // 773
      _.each(callbacks, function (x) { x(); });                                          // 774
                                                                                         // 775
    }, function (e) {                                                                    // 776
      console.error("Error listening:", e);                                              // 777
      console.error(e && e.stack);                                                       // 778
    }));                                                                                 // 779
                                                                                         // 780
    if (expectKeepalives)                                                                // 781
      initKeepalive();                                                                   // 782
    return 'DAEMON';                                                                     // 783
  };                                                                                     // 784
};                                                                                       // 785
                                                                                         // 786
                                                                                         // 787
var proxy;                                                                               // 788
WebAppInternals.bindToProxy = function (proxyConfig) {                                   // 789
  var securePort = proxyConfig.securePort || 4433;                                       // 790
  var insecurePort = proxyConfig.insecurePort || 8080;                                   // 791
  var bindPathPrefix = proxyConfig.bindPathPrefix || "";                                 // 792
  // XXX also support galaxy-based lookup                                                // 793
  if (!proxyConfig.proxyEndpoint)                                                        // 794
    throw new Error("missing proxyEndpoint");                                            // 795
  if (!proxyConfig.bindHost)                                                             // 796
    throw new Error("missing bindHost");                                                 // 797
  if (!process.env.GALAXY_JOB)                                                           // 798
    throw new Error("missing $GALAXY_JOB");                                              // 799
  if (!process.env.GALAXY_APP)                                                           // 800
    throw new Error("missing $GALAXY_APP");                                              // 801
  if (!process.env.LAST_START)                                                           // 802
    throw new Error("missing $LAST_START");                                              // 803
                                                                                         // 804
  // XXX rename pid argument to bindTo.                                                  // 805
  // XXX factor out into a 'getPid' function in a 'galaxy' package?                      // 806
  var pid = {                                                                            // 807
    job: process.env.GALAXY_JOB,                                                         // 808
    lastStarted: +(process.env.LAST_START),                                              // 809
    app: process.env.GALAXY_APP                                                          // 810
  };                                                                                     // 811
  var myHost = os.hostname();                                                            // 812
                                                                                         // 813
  WebAppInternals.usingDdpProxy = true;                                                  // 814
                                                                                         // 815
  // This is run after packages are loaded (in main) so we can use                       // 816
  // Follower.connect.                                                                   // 817
  if (proxy) {                                                                           // 818
    // XXX the concept here is that our configuration has changed and                    // 819
    // we have connected to an entirely new follower set, which does                     // 820
    // not have the state that we set up on the follower set that we                     // 821
    // were previously connected to, and so we need to recreate all of                   // 822
    // our bindings -- analogous to getting a SIGHUP and rereading                       // 823
    // your configuration file. so probably this should actually tear                    // 824
    // down the connection and make a whole new one, rather than                         // 825
    // hot-reconnecting to a different URL.                                              // 826
    proxy.reconnect({                                                                    // 827
      url: proxyConfig.proxyEndpoint                                                     // 828
    });                                                                                  // 829
  } else {                                                                               // 830
    proxy = Package["follower-livedata"].Follower.connect(                               // 831
      proxyConfig.proxyEndpoint, {                                                       // 832
        group: "proxy"                                                                   // 833
      }                                                                                  // 834
    );                                                                                   // 835
  }                                                                                      // 836
                                                                                         // 837
  var route = process.env.ROUTE;                                                         // 838
  var ourHost = route.split(":")[0];                                                     // 839
  var ourPort = +route.split(":")[1];                                                    // 840
                                                                                         // 841
  var outstanding = 0;                                                                   // 842
  var startedAll = false;                                                                // 843
  var checkComplete = function () {                                                      // 844
    if (startedAll && ! outstanding)                                                     // 845
      Log("Bound to proxy.");                                                            // 846
  };                                                                                     // 847
  var makeCallback = function () {                                                       // 848
    outstanding++;                                                                       // 849
    return function (err) {                                                              // 850
      if (err)                                                                           // 851
        throw err;                                                                       // 852
      outstanding--;                                                                     // 853
      checkComplete();                                                                   // 854
    };                                                                                   // 855
  };                                                                                     // 856
                                                                                         // 857
  // for now, have our (temporary) requiresAuth flag apply to all                        // 858
  // routes created by this process.                                                     // 859
  var requiresDdpAuth = !! proxyConfig.requiresAuth;                                     // 860
  var requiresHttpAuth = (!! proxyConfig.requiresAuth) &&                                // 861
        (pid.app !== "panel" && pid.app !== "auth");                                     // 862
                                                                                         // 863
  // XXX a current limitation is that we treat securePort and                            // 864
  // insecurePort as a global configuration parameter -- we assume                       // 865
  // that if the proxy wants us to ask for 8080 to get port 80 traffic                   // 866
  // on our default hostname, that's the same port that we would use                     // 867
  // to get traffic on some other hostname that our proxy listens                        // 868
  // for. Likewise, we assume that if the proxy can receive secure                       // 869
  // traffic for our domain, it can assume secure traffic for any                        // 870
  // domain! Hopefully this will get cleaned up before too long by                       // 871
  // pushing that logic into the proxy service, so we can just ask for                   // 872
  // port 80.                                                                            // 873
                                                                                         // 874
  // XXX BUG: if our configuration changes, and bindPathPrefix                           // 875
  // changes, it appears that we will not remove the routes derived                      // 876
  // from the old bindPathPrefix from the proxy (until the process                       // 877
  // exits). It is not actually normal for bindPathPrefix to change,                     // 878
  // certainly not without a process restart for other reasons, but                      // 879
  // it'd be nice to fix.                                                                // 880
                                                                                         // 881
  _.each(routes, function (route) {                                                      // 882
    var parsedUrl = url.parse(route.url, /* parseQueryString */ false,                   // 883
                              /* slashesDenoteHost aka workRight */ true);               // 884
    if (parsedUrl.protocol || parsedUrl.port || parsedUrl.search)                        // 885
      throw new Error("Bad url");                                                        // 886
    parsedUrl.host = null;                                                               // 887
    parsedUrl.path = null;                                                               // 888
    if (! parsedUrl.hostname) {                                                          // 889
      parsedUrl.hostname = proxyConfig.bindHost;                                         // 890
      if (! parsedUrl.pathname)                                                          // 891
        parsedUrl.pathname = "";                                                         // 892
      if (! parsedUrl.pathname.indexOf("/") !== 0) {                                     // 893
        // Relative path                                                                 // 894
        parsedUrl.pathname = bindPathPrefix + parsedUrl.pathname;                        // 895
      }                                                                                  // 896
    }                                                                                    // 897
    var version = "";                                                                    // 898
                                                                                         // 899
    var AppConfig = Package["application-configuration"].AppConfig;                      // 900
    version = AppConfig.getStarForThisJob() || "";                                       // 901
                                                                                         // 902
                                                                                         // 903
    var parsedDdpUrl = _.clone(parsedUrl);                                               // 904
    parsedDdpUrl.protocol = "ddp";                                                       // 905
    // Node has a hardcoded list of protocols that get '://' instead                     // 906
    // of ':'. ddp needs to be added to that whitelist. Until then, we                   // 907
    // can set the undocumented attribute 'slashes' to get the right                     // 908
    // behavior. It's not clear whether than is by design or accident.                   // 909
    parsedDdpUrl.slashes = true;                                                         // 910
    parsedDdpUrl.port = '' + securePort;                                                 // 911
    var ddpUrl = url.format(parsedDdpUrl);                                               // 912
                                                                                         // 913
    var proxyToHost, proxyToPort, proxyToPathPrefix;                                     // 914
    if (! _.has(route, 'forwardTo')) {                                                   // 915
      proxyToHost = ourHost;                                                             // 916
      proxyToPort = ourPort;                                                             // 917
      proxyToPathPrefix = parsedUrl.pathname;                                            // 918
    } else {                                                                             // 919
      var parsedFwdUrl = url.parse(route.forwardTo, false, true);                        // 920
      if (! parsedFwdUrl.hostname || parsedFwdUrl.protocol)                              // 921
        throw new Error("Bad forward url");                                              // 922
      proxyToHost = parsedFwdUrl.hostname;                                               // 923
      proxyToPort = parseInt(parsedFwdUrl.port || "80");                                 // 924
      proxyToPathPrefix = parsedFwdUrl.pathname || "";                                   // 925
    }                                                                                    // 926
                                                                                         // 927
    if (route.ddp) {                                                                     // 928
      proxy.call('bindDdp', {                                                            // 929
        pid: pid,                                                                        // 930
        bindTo: {                                                                        // 931
          ddpUrl: ddpUrl,                                                                // 932
          insecurePort: insecurePort                                                     // 933
        },                                                                               // 934
        proxyTo: {                                                                       // 935
          tags: [version],                                                               // 936
          host: proxyToHost,                                                             // 937
          port: proxyToPort,                                                             // 938
          pathPrefix: proxyToPathPrefix + '/websocket'                                   // 939
        },                                                                               // 940
        requiresAuth: requiresDdpAuth                                                    // 941
      }, makeCallback());                                                                // 942
    }                                                                                    // 943
                                                                                         // 944
    if (route.http) {                                                                    // 945
      proxy.call('bindHttp', {                                                           // 946
        pid: pid,                                                                        // 947
        bindTo: {                                                                        // 948
          host: parsedUrl.hostname,                                                      // 949
          port: insecurePort,                                                            // 950
          pathPrefix: parsedUrl.pathname                                                 // 951
        },                                                                               // 952
        proxyTo: {                                                                       // 953
          tags: [version],                                                               // 954
          host: proxyToHost,                                                             // 955
          port: proxyToPort,                                                             // 956
          pathPrefix: proxyToPathPrefix                                                  // 957
        },                                                                               // 958
        requiresAuth: requiresHttpAuth                                                   // 959
      }, makeCallback());                                                                // 960
                                                                                         // 961
      // Only make the secure binding if we've been told that the                        // 962
      // proxy knows how terminate secure connections for us (has an                     // 963
      // appropriate cert, can bind the necessary port..)                                // 964
      if (proxyConfig.securePort !== null) {                                             // 965
        proxy.call('bindHttp', {                                                         // 966
          pid: pid,                                                                      // 967
          bindTo: {                                                                      // 968
            host: parsedUrl.hostname,                                                    // 969
            port: securePort,                                                            // 970
            pathPrefix: parsedUrl.pathname,                                              // 971
            ssl: true                                                                    // 972
          },                                                                             // 973
          proxyTo: {                                                                     // 974
            tags: [version],                                                             // 975
            host: proxyToHost,                                                           // 976
            port: proxyToPort,                                                           // 977
            pathPrefix: proxyToPathPrefix                                                // 978
          },                                                                             // 979
          requiresAuth: requiresHttpAuth                                                 // 980
        }, makeCallback());                                                              // 981
      }                                                                                  // 982
    }                                                                                    // 983
  });                                                                                    // 984
                                                                                         // 985
  startedAll = true;                                                                     // 986
  checkComplete();                                                                       // 987
};                                                                                       // 988
                                                                                         // 989
// (Internal, unsupported interface -- subject to change)                                // 990
//                                                                                       // 991
// Listen for HTTP and/or DDP traffic and route it somewhere. Only                       // 992
// takes effect when using a proxy service.                                              // 993
//                                                                                       // 994
// 'url' is the traffic that we want to route, interpreted relative to                   // 995
// the default URL where this app has been told to serve itself. It                      // 996
// may not have a scheme or port, but it may have a host and a path,                     // 997
// and if no host is provided the path need not be absolute. The                         // 998
// following cases are possible:                                                         // 999
//                                                                                       // 1000
//   //somehost.com                                                                      // 1001
//     All incoming traffic for 'somehost.com'                                           // 1002
//   //somehost.com/foo/bar                                                              // 1003
//     All incoming traffic for 'somehost.com', but only when                            // 1004
//     the first two path components are 'foo' and 'bar'.                                // 1005
//   /foo/bar                                                                            // 1006
//     Incoming traffic on our default host, but only when the                           // 1007
//     first two path components are 'foo' and 'bar'.                                    // 1008
//   foo/bar                                                                             // 1009
//     Incoming traffic on our default host, but only when the path                      // 1010
//     starts with our default path prefix, followed by 'foo' and                        // 1011
//     'bar'.                                                                            // 1012
//                                                                                       // 1013
// (Yes, these scheme-less URLs that start with '//' are legal URLs.)                    // 1014
//                                                                                       // 1015
// You can select either DDP traffic, HTTP traffic, or both. Both                        // 1016
// secure and insecure traffic will be gathered (assuming the proxy                      // 1017
// service is capable, eg, has appropriate certs and port mappings).                     // 1018
//                                                                                       // 1019
// With no 'forwardTo' option, the traffic is received by this process                   // 1020
// for service by the hooks in this 'webapp' package. The original URL                   // 1021
// is preserved (that is, if you bind "/a", and a user visits "/a/b",                    // 1022
// the app receives a request with a path of "/a/b", not a path of                       // 1023
// "/b").                                                                                // 1024
//                                                                                       // 1025
// With 'forwardTo', the process is instead sent to some other remote                    // 1026
// host. The URL is adjusted by stripping the path components in 'url'                   // 1027
// and putting the path components in the 'forwardTo' URL in their                       // 1028
// place. For example, if you forward "//somehost/a" to                                  // 1029
// "//otherhost/x", and the user types "//somehost/a/b" into their                       // 1030
// browser, then otherhost will receive a request with a Host header                     // 1031
// of "somehost" and a path of "/x/b".                                                   // 1032
//                                                                                       // 1033
// The routing continues until this process exits. For now, all of the                   // 1034
// routes must be set up ahead of time, before the initial                               // 1035
// registration with the proxy. Calling addRoute from the top level of                   // 1036
// your JS should do the trick.                                                          // 1037
//                                                                                       // 1038
// When multiple routes are present that match a given request, the                      // 1039
// most specific route wins. When routes with equal specificity are                      // 1040
// present, the proxy service will distribute the traffic between                        // 1041
// them.                                                                                 // 1042
//                                                                                       // 1043
// options may be:                                                                       // 1044
// - ddp: if true, the default, include DDP traffic. This includes                       // 1045
//   both secure and insecure traffic, and both websocket and sockjs                     // 1046
//   transports.                                                                         // 1047
// - http: if true, the default, include HTTP/HTTPS traffic.                             // 1048
// - forwardTo: if provided, should be a URL with a host, optional                       // 1049
//   path and port, and no scheme (the scheme will be derived from the                   // 1050
//   traffic type; for now it will always be a http or ws connection,                    // 1051
//   never https or wss, but we could add a forwardSecure flag to                        // 1052
//   re-encrypt).                                                                        // 1053
var routes = [];                                                                         // 1054
WebAppInternals.addRoute = function (url, options) {                                     // 1055
  options = _.extend({                                                                   // 1056
    ddp: true,                                                                           // 1057
    http: true                                                                           // 1058
  }, options || {});                                                                     // 1059
                                                                                         // 1060
  if (proxy)                                                                             // 1061
    // In the future, lift this restriction                                              // 1062
    throw new Error("Too late to add routes");                                           // 1063
                                                                                         // 1064
  routes.push(_.extend({ url: url }, options));                                          // 1065
};                                                                                       // 1066
                                                                                         // 1067
// Receive traffic on our default URL.                                                   // 1068
WebAppInternals.addRoute("");                                                            // 1069
                                                                                         // 1070
runWebAppServer();                                                                       // 1071
                                                                                         // 1072
                                                                                         // 1073
var inlineScriptsAllowed = true;                                                         // 1074
                                                                                         // 1075
WebAppInternals.inlineScriptsAllowed = function () {                                     // 1076
  return inlineScriptsAllowed;                                                           // 1077
};                                                                                       // 1078
                                                                                         // 1079
WebAppInternals.setInlineScriptsAllowed = function (value) {                             // 1080
  inlineScriptsAllowed = value;                                                          // 1081
};                                                                                       // 1082
                                                                                         // 1083
WebAppInternals.setBundledJsCssPrefix = function (prefix) {                              // 1084
  bundledJsCssPrefix = prefix;                                                           // 1085
};                                                                                       // 1086
                                                                                         // 1087
// Packages can call `WebAppInternals.addStaticJs` to specify static                     // 1088
// JavaScript to be included in the app. This static JS will be inlined,                 // 1089
// unless inline scripts have been disabled, in which case it will be                    // 1090
// served under `/<sha1 of contents>`.                                                   // 1091
var additionalStaticJs = {};                                                             // 1092
WebAppInternals.addStaticJs = function (contents) {                                      // 1093
  additionalStaticJs["/" + sha1(contents) + ".js"] = contents;                           // 1094
};                                                                                       // 1095
                                                                                         // 1096
// Exported for tests                                                                    // 1097
WebAppInternals.getBoilerplate = getBoilerplate;                                         // 1098
WebAppInternals.additionalStaticJs = additionalStaticJs;                                 // 1099
                                                                                         // 1100
///////////////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package.webapp = {
  WebApp: WebApp,
  main: main,
  WebAppInternals: WebAppInternals
};

})();

//# sourceMappingURL=webapp.js.map
