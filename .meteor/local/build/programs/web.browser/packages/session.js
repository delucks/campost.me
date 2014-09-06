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
var _ = Package.underscore._;
var ReactiveDict = Package['reactive-dict'].ReactiveDict;
var EJSON = Package.ejson.EJSON;

/* Package-scope variables */
var Session;

(function () {

///////////////////////////////////////////////////////////////////////////////////////////
//                                                                                       //
// packages/session/session.js                                                           //
//                                                                                       //
///////////////////////////////////////////////////////////////////////////////////////////
                                                                                         //
var migratedKeys = {};                                                                   // 1
if (Package.reload) {                                                                    // 2
  var migrationData = Package.reload.Reload._migrationData('session');                   // 3
  if (migrationData && migrationData.keys) {                                             // 4
    migratedKeys = migrationData.keys;                                                   // 5
  }                                                                                      // 6
}                                                                                        // 7
                                                                                         // 8
// Documentation here is really awkward because the methods are defined                  // 9
// elsewhere                                                                             // 10
                                                                                         // 11
/**                                                                                      // 12
 * @memberOf Session                                                                     // 13
 * @method set                                                                           // 14
 * @summary Set a variable in the session. Notify any listeners that the value has changed (eg: redraw templates, and rerun any [`Tracker.autorun`](#tracker_autorun) computations, that called [`Session.get`](#session_get) on this `key`.)
 * @locus Client                                                                         // 16
 * @param {String} key The key to set, eg, `selectedItem`                                // 17
 * @param {EJSONable | undefined} value The new value for `key`                          // 18
 */                                                                                      // 19
                                                                                         // 20
/**                                                                                      // 21
 * @memberOf Session                                                                     // 22
 * @method setDefault                                                                    // 23
 * @summary Set a variable in the session if it is undefined. Otherwise works exactly the same as [`Session.set`](#session_set).
 * @locus Client                                                                         // 25
 * @param {String} key The key to set, eg, `selectedItem`                                // 26
 * @param {EJSONable | undefined} value The new value for `key`                          // 27
 */                                                                                      // 28
                                                                                         // 29
/**                                                                                      // 30
 * @memberOf Session                                                                     // 31
 * @method get                                                                           // 32
 * @summary Get the value of a session variable. If inside a [reactive computation](#reactivity), invalidate the computation the next time the value of the variable is changed by [`Session.set`](#session_set). This returns a clone of the session value, so if it's an object or an array, mutating the returned value has no effect on the value stored in the session.
 * @locus Client                                                                         // 34
 * @param {String} key The name of the session variable to return                        // 35
 */                                                                                      // 36
                                                                                         // 37
/**                                                                                      // 38
 * @memberOf Session                                                                     // 39
 * @method equals                                                                        // 40
 * @summary Test if a session variable is equal to a value. If inside a [reactive computation](#reactivity), invalidate the computation the next time the variable changes to or from the value.
 * @locus Client                                                                         // 42
 * @param {String} key The name of the session variable to test                          // 43
 * @param {String | Number | Boolean | null | undefined} value The value to test against // 44
 */                                                                                      // 45
                                                                                         // 46
Session = new ReactiveDict(migratedKeys);                                                // 47
                                                                                         // 48
if (Package.reload) {                                                                    // 49
  Package.reload.Reload._onMigrate('session', function () {                              // 50
    return [true, {keys: Session.keys}];                                                 // 51
  });                                                                                    // 52
}                                                                                        // 53
                                                                                         // 54
///////////////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package.session = {
  Session: Session
};

})();

//# sourceMappingURL=67f84c96ef6ef655024c55a257280828029d2d0c.map
