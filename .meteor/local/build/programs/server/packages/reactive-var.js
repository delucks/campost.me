(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var Tracker = Package.tracker.Tracker;
var Deps = Package.tracker.Deps;

/* Package-scope variables */
var ReactiveVar;

(function () {

/////////////////////////////////////////////////////////////////////////////
//                                                                         //
// packages/reactive-var/reactive-var.js                                   //
//                                                                         //
/////////////////////////////////////////////////////////////////////////////
                                                                           //
/*                                                                         // 1
 * ## [new] ReactiveVar(initialValue, [equalsFunc])                        // 2
 *                                                                         // 3
 * A ReactiveVar holds a single value that can be get and set,             // 4
 * such that calling `set` will invalidate any Computations that           // 5
 * called `get`, according to the usual contract for reactive              // 6
 * data sources.                                                           // 7
 *                                                                         // 8
 * A ReactiveVar is much like a Session variable -- compare `foo.get()`    // 9
 * to `Session.get("foo")` -- but it doesn't have a global name and isn't  // 10
 * automatically migrated across hot code pushes.  Also, while Session     // 11
 * variables can only hold JSON or EJSON, ReactiveVars can hold any value. // 12
 *                                                                         // 13
 * An important property of ReactiveVars, which is sometimes the reason    // 14
 * to use one, is that setting the value to the same value as before has   // 15
 * no effect, meaning ReactiveVars can be used to absorb extra             // 16
 * invalidations that wouldn't serve a purpose.  However, by default,      // 17
 * ReactiveVars are extremely conservative about what changes they         // 18
 * absorb.  Calling `set` with an object argument will *always* trigger    // 19
 * invalidations, because even if the new value is `===` the old value,    // 20
 * the object may have been mutated.  You can change the default behavior  // 21
 * by passing a function of two arguments, `oldValue` and `newValue`,      // 22
 * to the constructor as `equalsFunc`.                                     // 23
 *                                                                         // 24
 * This class is extremely basic right now, but the idea is to evolve      // 25
 * it into the ReactiveVar of Geoff's Lickable Forms proposal.             // 26
 */                                                                        // 27
                                                                           // 28
ReactiveVar = function (initialValue, equalsFunc) {                        // 29
  if (! (this instanceof ReactiveVar))                                     // 30
    // called without `new`                                                // 31
    return new ReactiveVar(initialValue, equalsFunc);                      // 32
                                                                           // 33
  this.curValue = initialValue;                                            // 34
  this.equalsFunc = equalsFunc;                                            // 35
  this.dep = new Tracker.Dependency;                                       // 36
};                                                                         // 37
                                                                           // 38
ReactiveVar._isEqual = function (oldValue, newValue) {                     // 39
  var a = oldValue, b = newValue;                                          // 40
  // Two values are "equal" here if they are `===` and are                 // 41
  // number, boolean, string, undefined, or null.                          // 42
  if (a !== b)                                                             // 43
    return false;                                                          // 44
  else                                                                     // 45
    return ((!a) || (typeof a === 'number') || (typeof a === 'boolean') || // 46
            (typeof a === 'string'));                                      // 47
};                                                                         // 48
                                                                           // 49
ReactiveVar.prototype.get = function () {                                  // 50
  if (Tracker.active)                                                      // 51
    this.dep.depend();                                                     // 52
                                                                           // 53
  return this.curValue;                                                    // 54
};                                                                         // 55
                                                                           // 56
ReactiveVar.prototype.set = function (newValue) {                          // 57
  var oldValue = this.curValue;                                            // 58
                                                                           // 59
  if ((this.equalsFunc || ReactiveVar._isEqual)(oldValue, newValue))       // 60
    // value is same as last time                                          // 61
    return;                                                                // 62
                                                                           // 63
  this.curValue = newValue;                                                // 64
  this.dep.changed();                                                      // 65
};                                                                         // 66
                                                                           // 67
ReactiveVar.prototype.toString = function () {                             // 68
  return 'ReactiveVar{' + this.get() + '}';                                // 69
};                                                                         // 70
                                                                           // 71
ReactiveVar.prototype._numListeners = function() {                         // 72
  // Tests want to know.                                                   // 73
  // Accesses a private field of Tracker.Dependency.                       // 74
  var count = 0;                                                           // 75
  for (var id in this.dep._dependentsById)                                 // 76
    count++;                                                               // 77
  return count;                                                            // 78
};                                                                         // 79
                                                                           // 80
/////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['reactive-var'] = {
  ReactiveVar: ReactiveVar
};

})();

//# sourceMappingURL=reactive-var.js.map
