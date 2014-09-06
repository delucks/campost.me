(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var WebApp = Package.webapp.WebApp;
var main = Package.webapp.main;
var WebAppInternals = Package.webapp.WebAppInternals;
var _ = Package.underscore._;

/* Package-scope variables */
var Spiderable;

(function () {

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                 //
// packages/spiderable/spiderable.js                                                                               //
//                                                                                                                 //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                   //
Spiderable = {};                                                                                                   // 1
                                                                                                                   // 2
                                                                                                                   // 3
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                 //
// packages/spiderable/spiderable_server.js                                                                        //
//                                                                                                                 //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                   //
var fs = Npm.require('fs');                                                                                        // 1
var child_process = Npm.require('child_process');                                                                  // 2
var querystring = Npm.require('querystring');                                                                      // 3
var urlParser = Npm.require('url');                                                                                // 4
                                                                                                                   // 5
// list of bot user agents that we want to serve statically, but do                                                // 6
// not obey the _escaped_fragment_ protocol. The page is served                                                    // 7
// statically to any client whos user agent matches any of these                                                   // 8
// regexps. Users may modify this array.                                                                           // 9
//                                                                                                                 // 10
// An original goal with the spiderable package was to avoid doing                                                 // 11
// user-agent based tests. But the reality is not enough bots support                                              // 12
// the _escaped_fragment_ protocol, so we need to hardcode a list                                                  // 13
// here. I shed a silent tear.                                                                                     // 14
Spiderable.userAgentRegExps = [                                                                                    // 15
    /^facebookexternalhit/i, /^linkedinbot/i, /^twitterbot/i];                                                     // 16
                                                                                                                   // 17
// how long to let phantomjs run before we kill it                                                                 // 18
var REQUEST_TIMEOUT = 15*1000;                                                                                     // 19
// maximum size of result HTML. node's default is 200k which is too                                                // 20
// small for our docs.                                                                                             // 21
var MAX_BUFFER = 5*1024*1024; // 5MB                                                                               // 22
                                                                                                                   // 23
// Exported for tests.                                                                                             // 24
Spiderable._urlForPhantom = function (siteAbsoluteUrl, requestUrl) {                                               // 25
  // reassembling url without escaped fragment if exists                                                           // 26
  var parsedUrl = urlParser.parse(requestUrl);                                                                     // 27
  var parsedQuery = querystring.parse(parsedUrl.query);                                                            // 28
  delete parsedQuery['_escaped_fragment_'];                                                                        // 29
                                                                                                                   // 30
  var parsedAbsoluteUrl = urlParser.parse(siteAbsoluteUrl);                                                        // 31
  // If the ROOT_URL contains a path, Meteor strips that path off of the                                           // 32
  // request's URL before we see it. So we concatenate the pathname from                                           // 33
  // the request's URL with the root URL's pathname to get the full                                                // 34
  // pathname.                                                                                                     // 35
  if (parsedUrl.pathname.charAt(0) === "/") {                                                                      // 36
    parsedUrl.pathname = parsedUrl.pathname.substring(1);                                                          // 37
  }                                                                                                                // 38
  parsedAbsoluteUrl.pathname = urlParser.resolve(parsedAbsoluteUrl.pathname,                                       // 39
                                                 parsedUrl.pathname);                                              // 40
  parsedAbsoluteUrl.query = parsedQuery;                                                                           // 41
  // `url.format` will only use `query` if `search` is absent                                                      // 42
  parsedAbsoluteUrl.search = null;                                                                                 // 43
                                                                                                                   // 44
  return urlParser.format(parsedAbsoluteUrl);                                                                      // 45
};                                                                                                                 // 46
                                                                                                                   // 47
var PHANTOM_SCRIPT = Assets.getText("phantom_script.js");                                                          // 48
                                                                                                                   // 49
WebApp.connectHandlers.use(function (req, res, next) {                                                             // 50
  // _escaped_fragment_ comes from Google's AJAX crawling spec:                                                    // 51
  // https://developers.google.com/webmasters/ajax-crawling/docs/specification                                     // 52
  // This spec was designed during the brief era where using "#!" URLs was                                         // 53
  // common, so it mostly describes how to translate "#!" URLs into                                                // 54
  // _escaped_fragment_ URLs. Since then, "#!" URLs have gone out of style, but                                    // 55
  // the <meta name="fragment" content="!"> (see spiderable.html) approach also                                    // 56
  // described in the spec is still common and used by several crawlers.                                           // 57
  if (/\?.*_escaped_fragment_=/.test(req.url) ||                                                                   // 58
      _.any(Spiderable.userAgentRegExps, function (re) {                                                           // 59
        return re.test(req.headers['user-agent']); })) {                                                           // 60
                                                                                                                   // 61
    var url = Spiderable._urlForPhantom(Meteor.absoluteUrl(), req.url);                                            // 62
                                                                                                                   // 63
    // This string is going to be put into a bash script, so it's important                                        // 64
    // that 'url' (which comes from the network) can neither exploit phantomjs                                     // 65
    // or the bash script. JSON stringification should prevent it from                                             // 66
    // exploiting phantomjs, and since the output of JSON.stringify shouldn't                                      // 67
    // be able to contain newlines, it should be unable to exploit bash as                                         // 68
    // well.                                                                                                       // 69
    var phantomScript = "var url = " + JSON.stringify(url) + ";" +                                                 // 70
          PHANTOM_SCRIPT;                                                                                          // 71
                                                                                                                   // 72
    // Run phantomjs.                                                                                              // 73
    //                                                                                                             // 74
    // Use '/dev/stdin' to avoid writing to a temporary file. We can't                                             // 75
    // just omit the file, as PhantomJS takes that to mean 'use a                                                  // 76
    // REPL' and exits as soon as stdin closes.                                                                    // 77
    //                                                                                                             // 78
    // However, Node 0.8 broke the ability to open /dev/stdin in the                                               // 79
    // subprocess, so we can't just write our string to the process's stdin                                        // 80
    // directly; see https://gist.github.com/3751746 for the gory details. We                                      // 81
    // work around this with a bash heredoc. (We previous used a "cat |"                                           // 82
    // instead, but that meant we couldn't use exec and had to manage several                                      // 83
    // processes.)                                                                                                 // 84
    child_process.execFile(                                                                                        // 85
      '/bin/bash',                                                                                                 // 86
      ['-c',                                                                                                       // 87
       ("exec phantomjs --load-images=no /dev/stdin <<'END'\n" +                                                   // 88
        phantomScript + "END\n")],                                                                                 // 89
      {timeout: REQUEST_TIMEOUT, maxBuffer: MAX_BUFFER},                                                           // 90
      function (error, stdout, stderr) {                                                                           // 91
        if (!error && /<html/i.test(stdout)) {                                                                     // 92
          res.writeHead(200, {'Content-Type': 'text/html; charset=UTF-8'});                                        // 93
          res.end(stdout);                                                                                         // 94
        } else {                                                                                                   // 95
          // phantomjs failed. Don't send the error, instead send the                                              // 96
          // normal page.                                                                                          // 97
          if (error && error.code === 127)                                                                         // 98
            Meteor._debug("spiderable: phantomjs not installed. Download and install from http://phantomjs.org/"); // 99
          else                                                                                                     // 100
            Meteor._debug("spiderable: phantomjs failed:", error, "\nstderr:", stderr);                            // 101
                                                                                                                   // 102
          next();                                                                                                  // 103
        }                                                                                                          // 104
      });                                                                                                          // 105
  } else {                                                                                                         // 106
    next();                                                                                                        // 107
  }                                                                                                                // 108
});                                                                                                                // 109
                                                                                                                   // 110
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package.spiderable = {
  Spiderable: Spiderable
};

})();

//# sourceMappingURL=spiderable.js.map
