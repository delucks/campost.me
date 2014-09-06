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
var Template = Package.templating.Template;
var _ = Package.underscore._;
var Blaze = Package.blaze.Blaze;
var UI = Package.blaze.UI;
var Handlebars = Package.blaze.Handlebars;
var HTML = Package.htmljs.HTML;

/* Package-scope variables */
var Spiderable;

(function () {

//////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                          //
// packages/spiderable/spiderable.js                                                        //
//                                                                                          //
//////////////////////////////////////////////////////////////////////////////////////////////
                                                                                            //
Spiderable = {};                                                                            // 1
                                                                                            // 2
                                                                                            // 3
//////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

//////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                          //
// packages/spiderable/spiderable_client.js                                                 //
//                                                                                          //
//////////////////////////////////////////////////////////////////////////////////////////////
                                                                                            //
// We want to provide a deteriministic indicator of when the page is 'done'                 // 1
// This is non-trivial: e.g. an infinite stream of tweets is never done.                    // 2
//                                                                                          // 3
// We do this instead:                                                                      // 4
//   We are done sometime after all initial subscriptions are ready                         // 5
//   Initial subscriptions are those started in the top-level script execution,             // 6
//   or from a Meteor.startup callback when Meteor.startup is called in                     // 7
//   top-level script execution.                                                            // 8
//                                                                                          // 9
// Note that we don't guarantee that we won't wait longer than we have to;                  // 10
// extra subscriptions may be made, and extra data past the minimum may be                  // 11
// received.                                                                                // 12
//                                                                                          // 13
// We set this 'started' flag as Package.spiderable.Spiderable._initialSubscriptionsStarted // 14
// This is used by our phantomjs to determine when the subscriptions are started;           // 15
// it then polls until all subscriptions are ready.                                         // 16
                                                                                            // 17
Spiderable._initialSubscriptionsStarted = false;                                            // 18
                                                                                            // 19
var startupCallbacksDone = function () {                                                    // 20
  Spiderable._initialSubscriptionsStarted = true;                                           // 21
};                                                                                          // 22
                                                                                            // 23
// This extra indirection is how we get called last                                         // 24
var topLevelCodeDone = function () {                                                        // 25
  // We'd like to use Meteor.startup here I think, but docs/behaviour of that is wrong      // 26
  Meteor._setImmediate(function () { startupCallbacksDone(); });                            // 27
};                                                                                          // 28
                                                                                            // 29
Meteor.startup(function () { topLevelCodeDone(); });                                        // 30
                                                                                            // 31
//////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package.spiderable = {
  Spiderable: Spiderable
};

})();

//# sourceMappingURL=15e83f35886e22f2be2943f973bc7bb284bf8153.map
