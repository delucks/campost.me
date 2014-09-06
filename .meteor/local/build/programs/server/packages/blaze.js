(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var Tracker = Package.tracker.Tracker;
var Deps = Package.tracker.Deps;
var _ = Package.underscore._;
var HTML = Package.htmljs.HTML;
var ObserveSequence = Package['observe-sequence'].ObserveSequence;
var ReactiveVar = Package['reactive-var'].ReactiveVar;

/* Package-scope variables */
var Blaze, UI, Handlebars;

(function () {

////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                            //
// packages/blaze/preamble.js                                                                 //
//                                                                                            //
////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                              //
Blaze = {};                                                                                   // 1
                                                                                              // 2
// Utility to HTML-escape a string.  Included for legacy reasons.                             // 3
Blaze._escape = (function() {                                                                 // 4
  var escape_map = {                                                                          // 5
    "<": "&lt;",                                                                              // 6
    ">": "&gt;",                                                                              // 7
    '"': "&quot;",                                                                            // 8
    "'": "&#x27;",                                                                            // 9
    "`": "&#x60;", /* IE allows backtick-delimited attributes?? */                            // 10
    "&": "&amp;"                                                                              // 11
  };                                                                                          // 12
  var escape_one = function(c) {                                                              // 13
    return escape_map[c];                                                                     // 14
  };                                                                                          // 15
                                                                                              // 16
  return function (x) {                                                                       // 17
    return x.replace(/[&<>"'`]/g, escape_one);                                                // 18
  };                                                                                          // 19
})();                                                                                         // 20
                                                                                              // 21
Blaze._warn = function (msg) {                                                                // 22
  msg = 'Warning: ' + msg;                                                                    // 23
                                                                                              // 24
  if ((typeof 'Log' !== 'undefined') && Log && Log.warn)                                      // 25
    Log.warn(msg); // use Meteor's "logging" package                                          // 26
  else if ((typeof 'console' !== 'undefined') && console.log)                                 // 27
    console.log(msg);                                                                         // 28
};                                                                                            // 29
                                                                                              // 30
////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                            //
// packages/blaze/exceptions.js                                                               //
//                                                                                            //
////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                              //
var debugFunc;                                                                                // 1
                                                                                              // 2
// We call into user code in many places, and it's nice to catch exceptions                   // 3
// propagated from user code immediately so that the whole system doesn't just                // 4
// break.  Catching exceptions is easy; reporting them is hard.  This helper                  // 5
// reports exceptions.                                                                        // 6
//                                                                                            // 7
// Usage:                                                                                     // 8
//                                                                                            // 9
// ```                                                                                        // 10
// try {                                                                                      // 11
//   // ... someStuff ...                                                                     // 12
// } catch (e) {                                                                              // 13
//   reportUIException(e);                                                                    // 14
// }                                                                                          // 15
// ```                                                                                        // 16
//                                                                                            // 17
// An optional second argument overrides the default message.                                 // 18
                                                                                              // 19
// Set this to `true` to cause `reportException` to throw                                     // 20
// the next exception rather than reporting it.  This is                                      // 21
// useful in unit tests that test error messages.                                             // 22
Blaze._throwNextException = false;                                                            // 23
                                                                                              // 24
Blaze._reportException = function (e, msg) {                                                  // 25
  if (Blaze._throwNextException) {                                                            // 26
    Blaze._throwNextException = false;                                                        // 27
    throw e;                                                                                  // 28
  }                                                                                           // 29
                                                                                              // 30
  if (! debugFunc)                                                                            // 31
    // adapted from Tracker                                                                   // 32
    debugFunc = function () {                                                                 // 33
      return (typeof Meteor !== "undefined" ? Meteor._debug :                                 // 34
              ((typeof console !== "undefined") && console.log ? console.log :                // 35
               function () {}));                                                              // 36
    };                                                                                        // 37
                                                                                              // 38
  // In Chrome, `e.stack` is a multiline string that starts with the message                  // 39
  // and contains a stack trace.  Furthermore, `console.log` makes it clickable.              // 40
  // `console.log` supplies the space between the two arguments.                              // 41
  debugFunc()(msg || 'Exception caught in template:', e.stack || e.message);                  // 42
};                                                                                            // 43
                                                                                              // 44
Blaze._wrapCatchingExceptions = function (f, where) {                                         // 45
  if (typeof f !== 'function')                                                                // 46
    return f;                                                                                 // 47
                                                                                              // 48
  return function () {                                                                        // 49
    try {                                                                                     // 50
      return f.apply(this, arguments);                                                        // 51
    } catch (e) {                                                                             // 52
      Blaze._reportException(e, 'Exception in ' + where + ':');                               // 53
    }                                                                                         // 54
  };                                                                                          // 55
};                                                                                            // 56
                                                                                              // 57
////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                            //
// packages/blaze/view.js                                                                     //
//                                                                                            //
////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                              //
/// [new] Blaze.View([name], renderMethod)                                                    // 1
///                                                                                           // 2
/// Blaze.View is the building block of reactive DOM.  Views have                             // 3
/// the following features:                                                                   // 4
///                                                                                           // 5
/// * lifecycle callbacks - Views are created, rendered, and destroyed,                       // 6
///   and callbacks can be registered to fire when these things happen.                       // 7
///                                                                                           // 8
/// * parent pointer - A View points to its parentView, which is the                          // 9
///   View that caused it to be rendered.  These pointers form a                              // 10
///   hierarchy or tree of Views.                                                             // 11
///                                                                                           // 12
/// * render() method - A View's render() method specifies the DOM                            // 13
///   (or HTML) content of the View.  If the method establishes                               // 14
///   reactive dependencies, it may be re-run.                                                // 15
///                                                                                           // 16
/// * a DOMRange - If a View is rendered to DOM, its position and                             // 17
///   extent in the DOM are tracked using a DOMRange object.                                  // 18
///                                                                                           // 19
/// When a View is constructed by calling Blaze.View, the View is                             // 20
/// not yet considered "created."  It doesn't have a parentView yet,                          // 21
/// and no logic has been run to initialize the View.  All real                               // 22
/// work is deferred until at least creation time, when the onViewCreated                     // 23
/// callbacks are fired, which happens when the View is "used" in                             // 24
/// some way that requires it to be rendered.                                                 // 25
///                                                                                           // 26
/// ...more lifecycle stuff                                                                   // 27
///                                                                                           // 28
/// `name` is an optional string tag identifying the View.  The only                          // 29
/// time it's used is when looking in the View tree for a View of a                           // 30
/// particular name; for example, data contexts are stored on Views                           // 31
/// of name "with".  Names are also useful when debugging, so in                              // 32
/// general it's good for functions that create Views to set the name.                        // 33
/// Views associated with templates have names of the form "Template.foo".                    // 34
Blaze.View = function (name, render) {                                                        // 35
  if (! (this instanceof Blaze.View))                                                         // 36
    // called without `new`                                                                   // 37
    return new Blaze.View(name, render);                                                      // 38
                                                                                              // 39
  if (typeof name === 'function') {                                                           // 40
    // omitted "name" argument                                                                // 41
    render = name;                                                                            // 42
    name = '';                                                                                // 43
  }                                                                                           // 44
  this.name = name;                                                                           // 45
  this._render = render;                                                                      // 46
                                                                                              // 47
  this._callbacks = {                                                                         // 48
    created: null,                                                                            // 49
    rendered: null,                                                                           // 50
    destroyed: null                                                                           // 51
  };                                                                                          // 52
                                                                                              // 53
  // Setting all properties here is good for readability,                                     // 54
  // and also may help Chrome optimize the code by keeping                                    // 55
  // the View object from changing shape too much.                                            // 56
  this.isCreated = false;                                                                     // 57
  this._isCreatedForExpansion = false;                                                        // 58
  this.isRendered = false;                                                                    // 59
  this._isAttached = false;                                                                   // 60
  this.isDestroyed = false;                                                                   // 61
  this._isInRender = false;                                                                   // 62
  this.parentView = null;                                                                     // 63
  this._domrange = null;                                                                      // 64
                                                                                              // 65
  this.renderCount = 0;                                                                       // 66
};                                                                                            // 67
                                                                                              // 68
Blaze.View.prototype._render = function () { return null; };                                  // 69
                                                                                              // 70
Blaze.View.prototype.onViewCreated = function (cb) {                                          // 71
  this._callbacks.created = this._callbacks.created || [];                                    // 72
  this._callbacks.created.push(cb);                                                           // 73
};                                                                                            // 74
                                                                                              // 75
Blaze.View.prototype._onViewRendered = function (cb) {                                        // 76
  this._callbacks.rendered = this._callbacks.rendered || [];                                  // 77
  this._callbacks.rendered.push(cb);                                                          // 78
};                                                                                            // 79
                                                                                              // 80
Blaze.View.prototype.onViewReady = function (cb) {                                            // 81
  var self = this;                                                                            // 82
  var fire = function () {                                                                    // 83
    Tracker.afterFlush(function () {                                                          // 84
      if (! self.isDestroyed) {                                                               // 85
        Blaze._withCurrentView(self, function () {                                            // 86
          cb.call(self);                                                                      // 87
        });                                                                                   // 88
      }                                                                                       // 89
    });                                                                                       // 90
  };                                                                                          // 91
  self._onViewRendered(function onViewRendered() {                                            // 92
    if (self.isDestroyed)                                                                     // 93
      return;                                                                                 // 94
    if (! self._domrange.attached)                                                            // 95
      self._domrange.onAttached(fire);                                                        // 96
    else                                                                                      // 97
      fire();                                                                                 // 98
  });                                                                                         // 99
};                                                                                            // 100
                                                                                              // 101
Blaze.View.prototype.onViewDestroyed = function (cb) {                                        // 102
  this._callbacks.destroyed = this._callbacks.destroyed || [];                                // 103
  this._callbacks.destroyed.push(cb);                                                         // 104
};                                                                                            // 105
                                                                                              // 106
/// View#autorun(func)                                                                        // 107
///                                                                                           // 108
/// Sets up a Tracker autorun that is "scoped" to this View in two                            // 109
/// important ways: 1) Blaze.currentView is automatically set                                 // 110
/// on every re-run, and 2) the autorun is stopped when the                                   // 111
/// View is destroyed.  As with Tracker.autorun, the first run of                             // 112
/// the function is immediate, and a Computation object that can                              // 113
/// be used to stop the autorun is returned.                                                  // 114
///                                                                                           // 115
/// View#autorun is meant to be called from View callbacks like                               // 116
/// onViewCreated, or from outside the rendering process.  It may not                         // 117
/// be called before the onViewCreated callbacks are fired (too early),                       // 118
/// or from a render() method (too confusing).                                                // 119
///                                                                                           // 120
/// Typically, autoruns that update the state                                                 // 121
/// of the View (as in Blaze.With) should be started from an onViewCreated                    // 122
/// callback.  Autoruns that update the DOM should be started                                 // 123
/// from either onViewCreated (guarded against the absence of                                 // 124
/// view._domrange), or onViewReady.                                                          // 125
Blaze.View.prototype.autorun = function (f, _inViewScope) {                                   // 126
  var self = this;                                                                            // 127
                                                                                              // 128
  // The restrictions on when View#autorun can be called are in order                         // 129
  // to avoid bad patterns, like creating a Blaze.View and immediately                        // 130
  // calling autorun on it.  A freshly created View is not ready to                           // 131
  // have logic run on it; it doesn't have a parentView, for example.                         // 132
  // It's when the View is materialized or expanded that the onViewCreated                    // 133
  // handlers are fired and the View starts up.                                               // 134
  //                                                                                          // 135
  // Letting the render() method call `this.autorun()` is problematic                         // 136
  // because of re-render.  The best we can do is to stop the old                             // 137
  // autorun and start a new one for each render, but that's a pattern                        // 138
  // we try to avoid internally because it leads to helpers being                             // 139
  // called extra times, in the case where the autorun causes the                             // 140
  // view to re-render (and thus the autorun to be torn down and a                            // 141
  // new one established).                                                                    // 142
  //                                                                                          // 143
  // We could lift these restrictions in various ways.  One interesting                       // 144
  // idea is to allow you to call `view.autorun` after instantiating                          // 145
  // `view`, and automatically wrap it in `view.onViewCreated`, deferring                     // 146
  // the autorun so that it starts at an appropriate time.  However,                          // 147
  // then we can't return the Computation object to the caller, because                       // 148
  // it doesn't exist yet.                                                                    // 149
  if (! self.isCreated) {                                                                     // 150
    throw new Error("View#autorun must be called from the created callback at the earliest"); // 151
  }                                                                                           // 152
  if (this._isInRender) {                                                                     // 153
    throw new Error("Can't call View#autorun from inside render(); try calling it from the created or rendered callback");
  }                                                                                           // 155
  if (Tracker.active) {                                                                       // 156
    throw new Error("Can't call View#autorun from a Tracker Computation; try calling it from the created or rendered callback");
  }                                                                                           // 158
                                                                                              // 159
  var c = Tracker.autorun(function viewAutorun(c) {                                           // 160
    return Blaze._withCurrentView(_inViewScope || self, function () {                         // 161
      return f.call(self, c);                                                                 // 162
    });                                                                                       // 163
  });                                                                                         // 164
  self.onViewDestroyed(function () { c.stop(); });                                            // 165
                                                                                              // 166
  return c;                                                                                   // 167
};                                                                                            // 168
                                                                                              // 169
Blaze.View.prototype.firstNode = function () {                                                // 170
  if (! this._isAttached)                                                                     // 171
    throw new Error("View must be attached before accessing its DOM");                        // 172
                                                                                              // 173
  return this._domrange.firstNode();                                                          // 174
};                                                                                            // 175
                                                                                              // 176
Blaze.View.prototype.lastNode = function () {                                                 // 177
  if (! this._isAttached)                                                                     // 178
    throw new Error("View must be attached before accessing its DOM");                        // 179
                                                                                              // 180
  return this._domrange.lastNode();                                                           // 181
};                                                                                            // 182
                                                                                              // 183
Blaze._fireCallbacks = function (view, which) {                                               // 184
  Blaze._withCurrentView(view, function () {                                                  // 185
    Tracker.nonreactive(function fireCallbacks() {                                            // 186
      var cbs = view._callbacks[which];                                                       // 187
      for (var i = 0, N = (cbs && cbs.length); i < N; i++)                                    // 188
        cbs[i].call(view);                                                                    // 189
    });                                                                                       // 190
  });                                                                                         // 191
};                                                                                            // 192
                                                                                              // 193
Blaze._createView = function (view, parentView, forExpansion) {                               // 194
  if (view.isCreated)                                                                         // 195
    throw new Error("Can't render the same View twice");                                      // 196
                                                                                              // 197
  view.parentView = (parentView || null);                                                     // 198
  view.isCreated = true;                                                                      // 199
  if (forExpansion)                                                                           // 200
    view._isCreatedForExpansion = true;                                                       // 201
                                                                                              // 202
  Blaze._fireCallbacks(view, 'created');                                                      // 203
};                                                                                            // 204
                                                                                              // 205
Blaze._materializeView = function (view, parentView) {                                        // 206
  Blaze._createView(view, parentView);                                                        // 207
                                                                                              // 208
  var domrange;                                                                               // 209
  var lastHtmljs;                                                                             // 210
  // We don't expect to be called in a Computation, but just in case,                         // 211
  // wrap in Tracker.nonreactive.                                                             // 212
  Tracker.nonreactive(function () {                                                           // 213
    view.autorun(function doRender(c) {                                                       // 214
      // `view.autorun` sets the current view.                                                // 215
      view.renderCount++;                                                                     // 216
      view._isInRender = true;                                                                // 217
      // Any dependencies that should invalidate this Computation come                        // 218
      // from this line:                                                                      // 219
      var htmljs = view._render();                                                            // 220
      view._isInRender = false;                                                               // 221
                                                                                              // 222
      Tracker.nonreactive(function doMaterialize() {                                          // 223
        var materializer = new Blaze._DOMMaterializer({parentView: view});                    // 224
        var rangesAndNodes = materializer.visit(htmljs, []);                                  // 225
        if (c.firstRun || ! Blaze._isContentEqual(lastHtmljs, htmljs)) {                      // 226
          if (c.firstRun) {                                                                   // 227
            domrange = new Blaze._DOMRange(rangesAndNodes);                                   // 228
            view._domrange = domrange;                                                        // 229
            domrange.view = view;                                                             // 230
            view.isRendered = true;                                                           // 231
          } else {                                                                            // 232
            domrange.setMembers(rangesAndNodes);                                              // 233
          }                                                                                   // 234
          Blaze._fireCallbacks(view, 'rendered');                                             // 235
        }                                                                                     // 236
      });                                                                                     // 237
      lastHtmljs = htmljs;                                                                    // 238
                                                                                              // 239
      // Causes any nested views to stop immediately, not when we call                        // 240
      // `setMembers` the next time around the autorun.  Otherwise,                           // 241
      // helpers in the DOM tree to be replaced might be scheduled                            // 242
      // to re-run before we have a chance to stop them.                                      // 243
      Tracker.onInvalidate(function () {                                                      // 244
        domrange.destroyMembers();                                                            // 245
      });                                                                                     // 246
    });                                                                                       // 247
                                                                                              // 248
    var teardownHook = null;                                                                  // 249
                                                                                              // 250
    domrange.onAttached(function attached(range, element) {                                   // 251
      view._isAttached = true;                                                                // 252
                                                                                              // 253
      teardownHook = Blaze._DOMBackend.Teardown.onElementTeardown(                            // 254
        element, function teardown() {                                                        // 255
          Blaze._destroyView(view, true /* _skipNodes */);                                    // 256
        });                                                                                   // 257
    });                                                                                       // 258
                                                                                              // 259
    // tear down the teardown hook                                                            // 260
    view.onViewDestroyed(function () {                                                        // 261
      teardownHook && teardownHook.stop();                                                    // 262
      teardownHook = null;                                                                    // 263
    });                                                                                       // 264
  });                                                                                         // 265
                                                                                              // 266
  return domrange;                                                                            // 267
};                                                                                            // 268
                                                                                              // 269
// Expands a View to HTMLjs, calling `render` recursively on all                              // 270
// Views and evaluating any dynamic attributes.  Calls the `created`                          // 271
// callback, but not the `materialized` or `rendered` callbacks.                              // 272
// Destroys the view immediately, unless called in a Tracker Computation,                     // 273
// in which case the view will be destroyed when the Computation is                           // 274
// invalidated.  If called in a Tracker Computation, the result is a                          // 275
// reactive string; that is, the Computation will be invalidated                              // 276
// if any changes are made to the view or subviews that might affect                          // 277
// the HTML.                                                                                  // 278
Blaze._expandView = function (view, parentView) {                                             // 279
  Blaze._createView(view, parentView, true /*forExpansion*/);                                 // 280
                                                                                              // 281
  view._isInRender = true;                                                                    // 282
  var htmljs = Blaze._withCurrentView(view, function () {                                     // 283
    return view._render();                                                                    // 284
  });                                                                                         // 285
  view._isInRender = false;                                                                   // 286
                                                                                              // 287
  var result = Blaze._expand(htmljs, view);                                                   // 288
                                                                                              // 289
  if (Tracker.active) {                                                                       // 290
    Tracker.onInvalidate(function () {                                                        // 291
      Blaze._destroyView(view);                                                               // 292
    });                                                                                       // 293
  } else {                                                                                    // 294
    Blaze._destroyView(view);                                                                 // 295
  }                                                                                           // 296
                                                                                              // 297
  return result;                                                                              // 298
};                                                                                            // 299
                                                                                              // 300
// Options: `parentView`                                                                      // 301
Blaze._HTMLJSExpander = HTML.TransformingVisitor.extend();                                    // 302
Blaze._HTMLJSExpander.def({                                                                   // 303
  visitObject: function (x) {                                                                 // 304
    if (x instanceof Blaze.Template)                                                          // 305
      x = x.constructView();                                                                  // 306
    if (x instanceof Blaze.View)                                                              // 307
      return Blaze._expandView(x, this.parentView);                                           // 308
                                                                                              // 309
    // this will throw an error; other objects are not allowed!                               // 310
    return HTML.TransformingVisitor.prototype.visitObject.call(this, x);                      // 311
  },                                                                                          // 312
  visitAttributes: function (attrs) {                                                         // 313
    // expand dynamic attributes                                                              // 314
    if (typeof attrs === 'function')                                                          // 315
      attrs = Blaze._withCurrentView(this.parentView, attrs);                                 // 316
                                                                                              // 317
    // call super (e.g. for case where `attrs` is an array)                                   // 318
    return HTML.TransformingVisitor.prototype.visitAttributes.call(this, attrs);              // 319
  },                                                                                          // 320
  visitAttribute: function (name, value, tag) {                                               // 321
    // expand attribute values that are functions.  Any attribute value                       // 322
    // that contains Views must be wrapped in a function.                                     // 323
    if (typeof value === 'function')                                                          // 324
      value = Blaze._withCurrentView(this.parentView, value);                                 // 325
                                                                                              // 326
    return HTML.TransformingVisitor.prototype.visitAttribute.call(                            // 327
      this, name, value, tag);                                                                // 328
  }                                                                                           // 329
});                                                                                           // 330
                                                                                              // 331
// Return Blaze.currentView, but only if it is being rendered                                 // 332
// (i.e. we are in its render() method).                                                      // 333
var currentViewIfRendering = function () {                                                    // 334
  var view = Blaze.currentView;                                                               // 335
  return (view && view._isInRender) ? view : null;                                            // 336
};                                                                                            // 337
                                                                                              // 338
Blaze._expand = function (htmljs, parentView) {                                               // 339
  parentView = parentView || currentViewIfRendering();                                        // 340
  return (new Blaze._HTMLJSExpander(                                                          // 341
    {parentView: parentView})).visit(htmljs);                                                 // 342
};                                                                                            // 343
                                                                                              // 344
Blaze._expandAttributes = function (attrs, parentView) {                                      // 345
  parentView = parentView || currentViewIfRendering();                                        // 346
  return (new Blaze._HTMLJSExpander(                                                          // 347
    {parentView: parentView})).visitAttributes(attrs);                                        // 348
};                                                                                            // 349
                                                                                              // 350
Blaze._destroyView = function (view, _skipNodes) {                                            // 351
  if (view.isDestroyed)                                                                       // 352
    return;                                                                                   // 353
  view.isDestroyed = true;                                                                    // 354
                                                                                              // 355
  Blaze._fireCallbacks(view, 'destroyed');                                                    // 356
                                                                                              // 357
  // Destroy views and elements recursively.  If _skipNodes,                                  // 358
  // only recurse up to views, not elements, for the case where                               // 359
  // the backend (jQuery) is recursing over the elements already.                             // 360
                                                                                              // 361
  if (view._domrange)                                                                         // 362
    view._domrange.destroyMembers(_skipNodes);                                                // 363
};                                                                                            // 364
                                                                                              // 365
Blaze._destroyNode = function (node) {                                                        // 366
  if (node.nodeType === 1)                                                                    // 367
    Blaze._DOMBackend.Teardown.tearDownElement(node);                                         // 368
};                                                                                            // 369
                                                                                              // 370
// Are the HTMLjs entities `a` and `b` the same?  We could be                                 // 371
// more elaborate here but the point is to catch the most basic                               // 372
// cases.                                                                                     // 373
Blaze._isContentEqual = function (a, b) {                                                     // 374
  if (a instanceof HTML.Raw) {                                                                // 375
    return (b instanceof HTML.Raw) && (a.value === b.value);                                  // 376
  } else if (a == null) {                                                                     // 377
    return (b == null);                                                                       // 378
  } else {                                                                                    // 379
    return (a === b) &&                                                                       // 380
      ((typeof a === 'number') || (typeof a === 'boolean') ||                                 // 381
       (typeof a === 'string'));                                                              // 382
  }                                                                                           // 383
};                                                                                            // 384
                                                                                              // 385
Blaze.currentView = null;                                                                     // 386
                                                                                              // 387
Blaze._withCurrentView = function (view, func) {                                              // 388
  var oldView = Blaze.currentView;                                                            // 389
  try {                                                                                       // 390
    Blaze.currentView = view;                                                                 // 391
    return func();                                                                            // 392
  } finally {                                                                                 // 393
    Blaze.currentView = oldView;                                                              // 394
  }                                                                                           // 395
};                                                                                            // 396
                                                                                              // 397
// Blaze.render publicly takes a View or a Template.                                          // 398
// Privately, it takes any HTMLJS (extended with Views and Templates)                         // 399
// except null or undefined, or a function that returns any extended                          // 400
// HTMLJS.                                                                                    // 401
var checkRenderContent = function (content) {                                                 // 402
  if (content === null)                                                                       // 403
    throw new Error("Can't render null");                                                     // 404
  if (typeof content === 'undefined')                                                         // 405
    throw new Error("Can't render undefined");                                                // 406
                                                                                              // 407
  if ((content instanceof Blaze.View) ||                                                      // 408
      (content instanceof Blaze.Template) ||                                                  // 409
      (typeof content === 'function'))                                                        // 410
    return;                                                                                   // 411
                                                                                              // 412
  try {                                                                                       // 413
    // Throw if content doesn't look like HTMLJS at the top level                             // 414
    // (i.e. verify that this is an HTML.Tag, or an array,                                    // 415
    // or a primitive, etc.)                                                                  // 416
    (new HTML.Visitor).visit(content);                                                        // 417
  } catch (e) {                                                                               // 418
    // Make error message suitable for public API                                             // 419
    throw new Error("Expected Template or View");                                             // 420
  }                                                                                           // 421
};                                                                                            // 422
                                                                                              // 423
// For Blaze.render and Blaze.toHTML, take content and                                        // 424
// wrap it in a View, unless it's a single View or                                            // 425
// Template already.                                                                          // 426
var contentAsView = function (content) {                                                      // 427
  checkRenderContent(content);                                                                // 428
                                                                                              // 429
  if (content instanceof Blaze.Template) {                                                    // 430
    return content.constructView();                                                           // 431
  } else if (content instanceof Blaze.View) {                                                 // 432
    return content;                                                                           // 433
  } else {                                                                                    // 434
    var func = content;                                                                       // 435
    if (typeof func !== 'function') {                                                         // 436
      func = function () {                                                                    // 437
        return content;                                                                       // 438
      };                                                                                      // 439
    }                                                                                         // 440
    return Blaze.View('render', func);                                                        // 441
  }                                                                                           // 442
};                                                                                            // 443
                                                                                              // 444
// For Blaze.renderWithData and Blaze.toHTMLWithData, wrap content                            // 445
// in a function, if necessary, so it can be a content arg to                                 // 446
// a Blaze.With.                                                                              // 447
var contentAsFunc = function (content) {                                                      // 448
  checkRenderContent(content);                                                                // 449
                                                                                              // 450
  if (typeof content !== 'function') {                                                        // 451
    return function () {                                                                      // 452
      return content;                                                                         // 453
    };                                                                                        // 454
  } else {                                                                                    // 455
    return content;                                                                           // 456
  }                                                                                           // 457
};                                                                                            // 458
                                                                                              // 459
Blaze.render = function (content, parentElement, nextNode, parentView) {                      // 460
  if (! parentElement) {                                                                      // 461
    Blaze._warn("Blaze.render without a parent element is deprecated. " +                     // 462
                "You must specify where to insert the rendered content.");                    // 463
  }                                                                                           // 464
                                                                                              // 465
  if (nextNode instanceof Blaze.View) {                                                       // 466
    // handle omitted nextNode                                                                // 467
    parentView = nextNode;                                                                    // 468
    nextNode = null;                                                                          // 469
  }                                                                                           // 470
                                                                                              // 471
  // parentElement must be a DOM node. in particular, can't be the                            // 472
  // result of a call to `$`. Can't check if `parentElement instanceof                        // 473
  // Node` since 'Node' is undefined in IE8.                                                  // 474
  if (parentElement && typeof parentElement.nodeType !== 'number')                            // 475
    throw new Error("'parentElement' must be a DOM node");                                    // 476
  if (nextNode && typeof nextNode.nodeType !== 'number') // 'nextNode' is optional            // 477
    throw new Error("'nextNode' must be a DOM node");                                         // 478
                                                                                              // 479
  parentView = parentView || currentViewIfRendering();                                        // 480
                                                                                              // 481
  var view = contentAsView(content);                                                          // 482
  Blaze._materializeView(view, parentView);                                                   // 483
                                                                                              // 484
  if (parentElement) {                                                                        // 485
    view._domrange.attach(parentElement, nextNode);                                           // 486
  }                                                                                           // 487
                                                                                              // 488
  return view;                                                                                // 489
};                                                                                            // 490
                                                                                              // 491
Blaze.insert = function (view, parentElement, nextNode) {                                     // 492
  Blaze._warn("Blaze.insert has been deprecated.  Specify where to insert the " +             // 493
              "rendered content in the call to Blaze.render.");                               // 494
                                                                                              // 495
  if (! (view && (view._domrange instanceof Blaze._DOMRange)))                                // 496
    throw new Error("Expected template rendered with UI.render");                             // 497
                                                                                              // 498
  view._domrange.attach(parentElement, nextNode);                                             // 499
};                                                                                            // 500
                                                                                              // 501
Blaze.renderWithData = function (content, data, parentElement, nextNode, parentView) {        // 502
  // We defer the handling of optional arguments to Blaze.render.  At this point,             // 503
  // `nextNode` may actually be `parentView`.                                                 // 504
  return Blaze.render(Blaze._TemplateWith(data, contentAsFunc(content)),                      // 505
                      parentElement, nextNode, parentView);                                   // 506
};                                                                                            // 507
                                                                                              // 508
Blaze.remove = function (view) {                                                              // 509
  if (! (view && (view._domrange instanceof Blaze._DOMRange)))                                // 510
    throw new Error("Expected template rendered with UI.render");                             // 511
                                                                                              // 512
  if (! view.isDestroyed) {                                                                   // 513
    var range = view._domrange;                                                               // 514
    if (range.attached && ! range.parentRange)                                                // 515
      range.detach();                                                                         // 516
    range.destroy();                                                                          // 517
  }                                                                                           // 518
};                                                                                            // 519
                                                                                              // 520
Blaze.toHTML = function (content, parentView) {                                               // 521
  parentView = parentView || currentViewIfRendering();                                        // 522
                                                                                              // 523
  return HTML.toHTML(Blaze._expandView(contentAsView(content), parentView));                  // 524
};                                                                                            // 525
                                                                                              // 526
Blaze.toHTMLWithData = function (content, data, parentView) {                                 // 527
  parentView = parentView || currentViewIfRendering();                                        // 528
                                                                                              // 529
  return HTML.toHTML(Blaze._expandView(Blaze._TemplateWith(                                   // 530
    data, contentAsFunc(content)), parentView));                                              // 531
};                                                                                            // 532
                                                                                              // 533
Blaze._toText = function (htmljs, parentView, textMode) {                                     // 534
  if (typeof htmljs === 'function')                                                           // 535
    throw new Error("Blaze._toText doesn't take a function, just HTMLjs");                    // 536
                                                                                              // 537
  if ((parentView != null) && ! (parentView instanceof Blaze.View)) {                         // 538
    // omitted parentView argument                                                            // 539
    textMode = parentView;                                                                    // 540
    parentView = null;                                                                        // 541
  }                                                                                           // 542
  parentView = parentView || currentViewIfRendering();                                        // 543
                                                                                              // 544
  if (! textMode)                                                                             // 545
    throw new Error("textMode required");                                                     // 546
  if (! (textMode === HTML.TEXTMODE.STRING ||                                                 // 547
         textMode === HTML.TEXTMODE.RCDATA ||                                                 // 548
         textMode === HTML.TEXTMODE.ATTRIBUTE))                                               // 549
    throw new Error("Unknown textMode: " + textMode);                                         // 550
                                                                                              // 551
  return HTML.toText(Blaze._expand(htmljs, parentView), textMode);                            // 552
};                                                                                            // 553
                                                                                              // 554
Blaze.getData = function (elementOrView) {                                                    // 555
  var theWith;                                                                                // 556
                                                                                              // 557
  if (! elementOrView) {                                                                      // 558
    theWith = Blaze.getView('with');                                                          // 559
  } else if (elementOrView instanceof Blaze.View) {                                           // 560
    var view = elementOrView;                                                                 // 561
    theWith = (view.name === 'with' ? view :                                                  // 562
               Blaze.getView(view, 'with'));                                                  // 563
  } else if (typeof elementOrView.nodeType === 'number') {                                    // 564
    if (elementOrView.nodeType !== 1)                                                         // 565
      throw new Error("Expected DOM element");                                                // 566
    theWith = Blaze.getView(elementOrView, 'with');                                           // 567
  } else {                                                                                    // 568
    throw new Error("Expected DOM element or View");                                          // 569
  }                                                                                           // 570
                                                                                              // 571
  return theWith ? theWith.dataVar.get() : null;                                              // 572
};                                                                                            // 573
                                                                                              // 574
// For back-compat                                                                            // 575
Blaze.getElementData = function (element) {                                                   // 576
  Blaze._warn("Blaze.getElementData has been deprecated.  Use " +                             // 577
              "Blaze.getData(element) instead.");                                             // 578
                                                                                              // 579
  if (element.nodeType !== 1)                                                                 // 580
    throw new Error("Expected DOM element");                                                  // 581
                                                                                              // 582
  return Blaze.getData(element);                                                              // 583
};                                                                                            // 584
                                                                                              // 585
// Both arguments are optional.                                                               // 586
Blaze.getView = function (elementOrView, _viewName) {                                         // 587
  var viewName = _viewName;                                                                   // 588
                                                                                              // 589
  if ((typeof elementOrView) === 'string') {                                                  // 590
    // omitted elementOrView; viewName present                                                // 591
    viewName = elementOrView;                                                                 // 592
    elementOrView = null;                                                                     // 593
  }                                                                                           // 594
                                                                                              // 595
  // We could eventually shorten the code by folding the logic                                // 596
  // from the other methods into this method.                                                 // 597
  if (! elementOrView) {                                                                      // 598
    return Blaze._getCurrentView(viewName);                                                   // 599
  } else if (elementOrView instanceof Blaze.View) {                                           // 600
    return Blaze._getParentView(elementOrView, viewName);                                     // 601
  } else if (typeof elementOrView.nodeType === 'number') {                                    // 602
    return Blaze._getElementView(elementOrView, viewName);                                    // 603
  } else {                                                                                    // 604
    throw new Error("Expected DOM element or View");                                          // 605
  }                                                                                           // 606
};                                                                                            // 607
                                                                                              // 608
// Gets the current view or its nearest ancestor of name                                      // 609
// `name`.                                                                                    // 610
Blaze._getCurrentView = function (name) {                                                     // 611
  var view = Blaze.currentView;                                                               // 612
  // Better to fail in cases where it doesn't make sense                                      // 613
  // to use Blaze._getCurrentView().  There will be a current                                 // 614
  // view anywhere it does.  You can check Blaze.currentView                                  // 615
  // if you want to know whether there is one or not.                                         // 616
  if (! view)                                                                                 // 617
    throw new Error("There is no current view");                                              // 618
                                                                                              // 619
  if (name) {                                                                                 // 620
    while (view && view.name !== name)                                                        // 621
      view = view.parentView;                                                                 // 622
    return view || null;                                                                      // 623
  } else {                                                                                    // 624
    // Blaze._getCurrentView() with no arguments just returns                                 // 625
    // Blaze.currentView.                                                                     // 626
    return view;                                                                              // 627
  }                                                                                           // 628
};                                                                                            // 629
                                                                                              // 630
Blaze._getParentView = function (view, name) {                                                // 631
  var v = view.parentView;                                                                    // 632
                                                                                              // 633
  if (name) {                                                                                 // 634
    while (v && v.name !== name)                                                              // 635
      v = v.parentView;                                                                       // 636
  }                                                                                           // 637
                                                                                              // 638
  return v || null;                                                                           // 639
};                                                                                            // 640
                                                                                              // 641
Blaze._getElementView = function (elem, name) {                                               // 642
  var range = Blaze._DOMRange.forElement(elem);                                               // 643
  var view = null;                                                                            // 644
  while (range && ! view) {                                                                   // 645
    view = (range.view || null);                                                              // 646
    if (! view) {                                                                             // 647
      if (range.parentRange)                                                                  // 648
        range = range.parentRange;                                                            // 649
      else                                                                                    // 650
        range = Blaze._DOMRange.forElement(range.parentElement);                              // 651
    }                                                                                         // 652
  }                                                                                           // 653
                                                                                              // 654
  if (name) {                                                                                 // 655
    while (view && view.name !== name)                                                        // 656
      view = view.parentView;                                                                 // 657
    return view || null;                                                                      // 658
  } else {                                                                                    // 659
    return view;                                                                              // 660
  }                                                                                           // 661
};                                                                                            // 662
                                                                                              // 663
Blaze._addEventMap = function (view, eventMap, thisInHandler) {                               // 664
  thisInHandler = (thisInHandler || null);                                                    // 665
  var handles = [];                                                                           // 666
                                                                                              // 667
  if (! view._domrange)                                                                       // 668
    throw new Error("View must have a DOMRange");                                             // 669
                                                                                              // 670
  view._domrange.onAttached(function attached_eventMaps(range, element) {                     // 671
    _.each(eventMap, function (handler, spec) {                                               // 672
      var clauses = spec.split(/,\s+/);                                                       // 673
      // iterate over clauses of spec, e.g. ['click .foo', 'click .bar']                      // 674
      _.each(clauses, function (clause) {                                                     // 675
        var parts = clause.split(/\s+/);                                                      // 676
        if (parts.length === 0)                                                               // 677
          return;                                                                             // 678
                                                                                              // 679
        var newEvents = parts.shift();                                                        // 680
        var selector = parts.join(' ');                                                       // 681
        handles.push(Blaze._EventSupport.listen(                                              // 682
          element, newEvents, selector,                                                       // 683
          function (evt) {                                                                    // 684
            if (! range.containsElement(evt.currentTarget))                                   // 685
              return null;                                                                    // 686
            var handlerThis = thisInHandler || this;                                          // 687
            var handlerArgs = arguments;                                                      // 688
            return Blaze._withCurrentView(view, function () {                                 // 689
              return handler.apply(handlerThis, handlerArgs);                                 // 690
            });                                                                               // 691
          },                                                                                  // 692
          range, function (r) {                                                               // 693
            return r.parentRange;                                                             // 694
          }));                                                                                // 695
      });                                                                                     // 696
    });                                                                                       // 697
  });                                                                                         // 698
                                                                                              // 699
  view.onViewDestroyed(function () {                                                          // 700
    _.each(handles, function (h) {                                                            // 701
      h.stop();                                                                               // 702
    });                                                                                       // 703
    handles.length = 0;                                                                       // 704
  });                                                                                         // 705
};                                                                                            // 706
                                                                                              // 707
////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                            //
// packages/blaze/builtins.js                                                                 //
//                                                                                            //
////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                              //
Blaze._calculateCondition = function (cond) {                                                 // 1
  if (cond instanceof Array && cond.length === 0)                                             // 2
    cond = false;                                                                             // 3
  return !! cond;                                                                             // 4
};                                                                                            // 5
                                                                                              // 6
Blaze.With = function (data, contentFunc) {                                                   // 7
  var view = Blaze.View('with', contentFunc);                                                 // 8
                                                                                              // 9
  view.dataVar = new ReactiveVar;                                                             // 10
                                                                                              // 11
  view.onViewCreated(function () {                                                            // 12
    if (typeof data === 'function') {                                                         // 13
      // `data` is a reactive function                                                        // 14
      view.autorun(function () {                                                              // 15
        view.dataVar.set(data());                                                             // 16
      }, view.parentView);                                                                    // 17
    } else {                                                                                  // 18
      view.dataVar.set(data);                                                                 // 19
    }                                                                                         // 20
  });                                                                                         // 21
                                                                                              // 22
  return view;                                                                                // 23
};                                                                                            // 24
                                                                                              // 25
Blaze.If = function (conditionFunc, contentFunc, elseFunc, _not) {                            // 26
  var conditionVar = new ReactiveVar;                                                         // 27
                                                                                              // 28
  var view = Blaze.View(_not ? 'unless' : 'if', function () {                                 // 29
    return conditionVar.get() ? contentFunc() :                                               // 30
      (elseFunc ? elseFunc() : null);                                                         // 31
  });                                                                                         // 32
  view.__conditionVar = conditionVar;                                                         // 33
  view.onViewCreated(function () {                                                            // 34
    this.autorun(function () {                                                                // 35
      var cond = Blaze._calculateCondition(conditionFunc());                                  // 36
      conditionVar.set(_not ? (! cond) : cond);                                               // 37
    }, this.parentView);                                                                      // 38
  });                                                                                         // 39
                                                                                              // 40
  return view;                                                                                // 41
};                                                                                            // 42
                                                                                              // 43
Blaze.Unless = function (conditionFunc, contentFunc, elseFunc) {                              // 44
  return Blaze.If(conditionFunc, contentFunc, elseFunc, true /*_not*/);                       // 45
};                                                                                            // 46
                                                                                              // 47
Blaze.Each = function (argFunc, contentFunc, elseFunc) {                                      // 48
  var eachView = Blaze.View('each', function () {                                             // 49
    var subviews = this.initialSubviews;                                                      // 50
    this.initialSubviews = null;                                                              // 51
    if (this._isCreatedForExpansion) {                                                        // 52
      this.expandedValueDep = new Tracker.Dependency;                                         // 53
      this.expandedValueDep.depend();                                                         // 54
    }                                                                                         // 55
    return subviews;                                                                          // 56
  });                                                                                         // 57
  eachView.initialSubviews = [];                                                              // 58
  eachView.numItems = 0;                                                                      // 59
  eachView.inElseMode = false;                                                                // 60
  eachView.stopHandle = null;                                                                 // 61
  eachView.contentFunc = contentFunc;                                                         // 62
  eachView.elseFunc = elseFunc;                                                               // 63
  eachView.argVar = new ReactiveVar;                                                          // 64
                                                                                              // 65
  eachView.onViewCreated(function () {                                                        // 66
    // We evaluate argFunc in an autorun to make sure                                         // 67
    // Blaze.currentView is always set when it runs (rather than                              // 68
    // passing argFunc straight to ObserveSequence).                                          // 69
    eachView.autorun(function () {                                                            // 70
      eachView.argVar.set(argFunc());                                                         // 71
    }, eachView.parentView);                                                                  // 72
                                                                                              // 73
    eachView.stopHandle = ObserveSequence.observe(function () {                               // 74
      return eachView.argVar.get();                                                           // 75
    }, {                                                                                      // 76
      addedAt: function (id, item, index) {                                                   // 77
        Tracker.nonreactive(function () {                                                     // 78
          var newItemView = Blaze.With(item, eachView.contentFunc);                           // 79
          eachView.numItems++;                                                                // 80
                                                                                              // 81
          if (eachView.expandedValueDep) {                                                    // 82
            eachView.expandedValueDep.changed();                                              // 83
          } else if (eachView._domrange) {                                                    // 84
            if (eachView.inElseMode) {                                                        // 85
              eachView._domrange.removeMember(0);                                             // 86
              eachView.inElseMode = false;                                                    // 87
            }                                                                                 // 88
                                                                                              // 89
            var range = Blaze._materializeView(newItemView, eachView);                        // 90
            eachView._domrange.addMember(range, index);                                       // 91
          } else {                                                                            // 92
            eachView.initialSubviews.splice(index, 0, newItemView);                           // 93
          }                                                                                   // 94
        });                                                                                   // 95
      },                                                                                      // 96
      removedAt: function (id, item, index) {                                                 // 97
        Tracker.nonreactive(function () {                                                     // 98
          eachView.numItems--;                                                                // 99
          if (eachView.expandedValueDep) {                                                    // 100
            eachView.expandedValueDep.changed();                                              // 101
          } else if (eachView._domrange) {                                                    // 102
            eachView._domrange.removeMember(index);                                           // 103
            if (eachView.elseFunc && eachView.numItems === 0) {                               // 104
              eachView.inElseMode = true;                                                     // 105
              eachView._domrange.addMember(                                                   // 106
                Blaze._materializeView(                                                       // 107
                  Blaze.View('each_else',eachView.elseFunc),                                  // 108
                  eachView), 0);                                                              // 109
            }                                                                                 // 110
          } else {                                                                            // 111
            eachView.initialSubviews.splice(index, 1);                                        // 112
          }                                                                                   // 113
        });                                                                                   // 114
      },                                                                                      // 115
      changedAt: function (id, newItem, oldItem, index) {                                     // 116
        Tracker.nonreactive(function () {                                                     // 117
          var itemView;                                                                       // 118
          if (eachView.expandedValueDep) {                                                    // 119
            eachView.expandedValueDep.changed();                                              // 120
          } else if (eachView._domrange) {                                                    // 121
            itemView = eachView._domrange.getMember(index).view;                              // 122
          } else {                                                                            // 123
            itemView = eachView.initialSubviews[index];                                       // 124
          }                                                                                   // 125
          itemView.dataVar.set(newItem);                                                      // 126
        });                                                                                   // 127
      },                                                                                      // 128
      movedTo: function (id, item, fromIndex, toIndex) {                                      // 129
        Tracker.nonreactive(function () {                                                     // 130
          if (eachView.expandedValueDep) {                                                    // 131
            eachView.expandedValueDep.changed();                                              // 132
          } else if (eachView._domrange) {                                                    // 133
            eachView._domrange.moveMember(fromIndex, toIndex);                                // 134
          } else {                                                                            // 135
            var subviews = eachView.initialSubviews;                                          // 136
            var itemView = subviews[fromIndex];                                               // 137
            subviews.splice(fromIndex, 1);                                                    // 138
            subviews.splice(toIndex, 0, itemView);                                            // 139
          }                                                                                   // 140
        });                                                                                   // 141
      }                                                                                       // 142
    });                                                                                       // 143
                                                                                              // 144
    if (eachView.elseFunc && eachView.numItems === 0) {                                       // 145
      eachView.inElseMode = true;                                                             // 146
      eachView.initialSubviews[0] =                                                           // 147
        Blaze.View('each_else', eachView.elseFunc);                                           // 148
    }                                                                                         // 149
  });                                                                                         // 150
                                                                                              // 151
  eachView.onViewDestroyed(function () {                                                      // 152
    if (eachView.stopHandle)                                                                  // 153
      eachView.stopHandle.stop();                                                             // 154
  });                                                                                         // 155
                                                                                              // 156
  return eachView;                                                                            // 157
};                                                                                            // 158
                                                                                              // 159
Blaze._TemplateWith = function (arg, contentBlock) {                                          // 160
  var w;                                                                                      // 161
                                                                                              // 162
  var argFunc = arg;                                                                          // 163
  if (typeof arg !== 'function') {                                                            // 164
    argFunc = function () {                                                                   // 165
      return arg;                                                                             // 166
    };                                                                                        // 167
  }                                                                                           // 168
                                                                                              // 169
  // This is a little messy.  When we compile `{{> UI.contentBlock}}`, we                     // 170
  // wrap it in Blaze._InOuterTemplateScope in order to skip the intermediate                 // 171
  // parent Views in the current template.  However, when there's an argument                 // 172
  // (`{{> UI.contentBlock arg}}`), the argument needs to be evaluated                        // 173
  // in the original scope.  There's no good order to nest                                    // 174
  // Blaze._InOuterTemplateScope and Spacebars.TemplateWith to achieve this,                  // 175
  // so we wrap argFunc to run it in the "original parentView" of the                         // 176
  // Blaze._InOuterTemplateScope.                                                             // 177
  //                                                                                          // 178
  // To make this better, reconsider _InOuterTemplateScope as a primitive.                    // 179
  // Longer term, evaluate expressions in the proper lexical scope.                           // 180
  var wrappedArgFunc = function () {                                                          // 181
    var viewToEvaluateArg = null;                                                             // 182
    if (w.parentView && w.parentView.name === 'InOuterTemplateScope') {                       // 183
      viewToEvaluateArg = w.parentView.originalParentView;                                    // 184
    }                                                                                         // 185
    if (viewToEvaluateArg) {                                                                  // 186
      return Blaze._withCurrentView(viewToEvaluateArg, argFunc);                              // 187
    } else {                                                                                  // 188
      return argFunc();                                                                       // 189
    }                                                                                         // 190
  };                                                                                          // 191
                                                                                              // 192
  w = Blaze.With(wrappedArgFunc, contentBlock);                                               // 193
  w.__isTemplateWith = true;                                                                  // 194
  return w;                                                                                   // 195
};                                                                                            // 196
                                                                                              // 197
Blaze._InOuterTemplateScope = function (templateView, contentFunc) {                          // 198
  var view = Blaze.View('InOuterTemplateScope', contentFunc);                                 // 199
  var parentView = templateView.parentView;                                                   // 200
                                                                                              // 201
  // Hack so that if you call `{{> foo bar}}` and it expands into                             // 202
  // `{{#with bar}}{{> foo}}{{/with}}`, and then `foo` is a template                          // 203
  // that inserts `{{> UI.contentBlock}}`, the data context for                               // 204
  // `UI.contentBlock` is not `bar` but the one enclosing that.                               // 205
  if (parentView.__isTemplateWith)                                                            // 206
    parentView = parentView.parentView;                                                       // 207
                                                                                              // 208
  view.onViewCreated(function () {                                                            // 209
    this.originalParentView = this.parentView;                                                // 210
    this.parentView = parentView;                                                             // 211
  });                                                                                         // 212
  return view;                                                                                // 213
};                                                                                            // 214
                                                                                              // 215
// XXX COMPAT WITH 0.9.0                                                                      // 216
Blaze.InOuterTemplateScope = Blaze._InOuterTemplateScope;                                     // 217
                                                                                              // 218
////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                            //
// packages/blaze/lookup.js                                                                   //
//                                                                                            //
////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                              //
Blaze._globalHelpers = {};                                                                    // 1
                                                                                              // 2
// Documented as Template.registerHelper.                                                     // 3
// This definition also provides back-compat for `UI.registerHelper`.                         // 4
Blaze.registerHelper = function (name, func) {                                                // 5
  Blaze._globalHelpers[name] = func;                                                          // 6
};                                                                                            // 7
                                                                                              // 8
                                                                                              // 9
var bindIfIsFunction = function (x, target) {                                                 // 10
  if (typeof x !== 'function')                                                                // 11
    return x;                                                                                 // 12
  return function () {                                                                        // 13
    return x.apply(target, arguments);                                                        // 14
  };                                                                                          // 15
};                                                                                            // 16
                                                                                              // 17
// If `x` is a function, binds the value of `this` for that function                          // 18
// to the current data context.                                                               // 19
var bindDataContext = function (x) {                                                          // 20
  if (typeof x === 'function') {                                                              // 21
    return function () {                                                                      // 22
      var data = Blaze.getData();                                                             // 23
      if (data == null)                                                                       // 24
        data = {};                                                                            // 25
      return x.apply(data, arguments);                                                        // 26
    };                                                                                        // 27
  }                                                                                           // 28
  return x;                                                                                   // 29
};                                                                                            // 30
                                                                                              // 31
var wrapHelper = function (f) {                                                               // 32
  return Blaze._wrapCatchingExceptions(f, 'template helper');                                 // 33
};                                                                                            // 34
                                                                                              // 35
// Looks up a name, like "foo" or "..", as a helper of the                                    // 36
// current template; a global helper; the name of a template;                                 // 37
// or a property of the data context.  Called on the View of                                  // 38
// a template (i.e. a View with a `.template` property,                                       // 39
// where the helpers are).  Used for the first name in a                                      // 40
// "path" in a template tag, like "foo" in `{{foo.bar}}` or                                   // 41
// ".." in `{{frobulate ../blah}}`.                                                           // 42
//                                                                                            // 43
// Returns a function, a non-function value, or null.  If                                     // 44
// a function is found, it is bound appropriately.                                            // 45
//                                                                                            // 46
// NOTE: This function must not establish any reactive                                        // 47
// dependencies itself.  If there is any reactivity in the                                    // 48
// value, lookup should return a function.                                                    // 49
Blaze.View.prototype.lookup = function (name, _options) {                                     // 50
  var template = this.template;                                                               // 51
  var lookupTemplate = _options && _options.template;                                         // 52
                                                                                              // 53
  if (/^\./.test(name)) {                                                                     // 54
    // starts with a dot. must be a series of dots which maps to an                           // 55
    // ancestor of the appropriate height.                                                    // 56
    if (!/^(\.)+$/.test(name))                                                                // 57
      throw new Error("id starting with dot must be a series of dots");                       // 58
                                                                                              // 59
    return Blaze._parentData(name.length - 1, true /*_functionWrapped*/);                     // 60
                                                                                              // 61
  } else if (template && (name in template)) {                                                // 62
    return wrapHelper(bindDataContext(template[name]));                                       // 63
  } else if (lookupTemplate && (name in Blaze.Template) &&                                    // 64
             (Blaze.Template[name] instanceof Blaze.Template)) {                              // 65
    return Blaze.Template[name];                                                              // 66
  } else if (UI._globalHelpers[name]) {                                                       // 67
    return wrapHelper(bindDataContext(UI._globalHelpers[name]));                              // 68
  } else {                                                                                    // 69
    return function () {                                                                      // 70
      var isCalledAsFunction = (arguments.length > 0);                                        // 71
      var data = Blaze.getData();                                                             // 72
      if (lookupTemplate && ! (data && data[name])) {                                         // 73
        throw new Error("No such template: " + name);                                         // 74
      }                                                                                       // 75
      if (isCalledAsFunction && ! (data && data[name])) {                                     // 76
        throw new Error("No such function: " + name);                                         // 77
      }                                                                                       // 78
      if (! data)                                                                             // 79
        return null;                                                                          // 80
      var x = data[name];                                                                     // 81
      if (typeof x !== 'function') {                                                          // 82
        if (isCalledAsFunction) {                                                             // 83
          throw new Error("Can't call non-function: " + x);                                   // 84
        }                                                                                     // 85
        return x;                                                                             // 86
      }                                                                                       // 87
      return x.apply(data, arguments);                                                        // 88
    };                                                                                        // 89
  }                                                                                           // 90
  return null;                                                                                // 91
};                                                                                            // 92
                                                                                              // 93
// Implement Spacebars' {{../..}}.                                                            // 94
// @param height {Number} The number of '..'s                                                 // 95
Blaze._parentData = function (height, _functionWrapped) {                                     // 96
  var theWith = Blaze.getView('with');                                                        // 97
  for (var i = 0; (i < height) && theWith; i++) {                                             // 98
    theWith = Blaze.getView(theWith, 'with');                                                 // 99
  }                                                                                           // 100
                                                                                              // 101
  if (! theWith)                                                                              // 102
    return null;                                                                              // 103
  if (_functionWrapped)                                                                       // 104
    return function () { return theWith.dataVar.get(); };                                     // 105
  return theWith.dataVar.get();                                                               // 106
};                                                                                            // 107
                                                                                              // 108
                                                                                              // 109
Blaze.View.prototype.lookupTemplate = function (name) {                                       // 110
  return this.lookup(name, {template:true});                                                  // 111
};                                                                                            // 112
                                                                                              // 113
////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                            //
// packages/blaze/template.js                                                                 //
//                                                                                            //
////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                              //
// [new] Blaze.Template([viewName], renderFunction)                                           // 1
//                                                                                            // 2
// `Blaze.Template` is the class of templates, like `Template.foo` in                         // 3
// Meteor, which is `instanceof Template`.                                                    // 4
//                                                                                            // 5
// `viewKind` is a string that looks like "Template.foo" for templates                        // 6
// defined by the compiler.                                                                   // 7
Blaze.Template = function (viewName, renderFunction) {                                        // 8
  if (! (this instanceof Blaze.Template))                                                     // 9
    // called without `new`                                                                   // 10
    return new Blaze.Template(viewName, renderFunction);                                      // 11
                                                                                              // 12
  if (typeof viewName === 'function') {                                                       // 13
    // omitted "viewName" argument                                                            // 14
    renderFunction = viewName;                                                                // 15
    viewName = '';                                                                            // 16
  }                                                                                           // 17
  if (typeof viewName !== 'string')                                                           // 18
    throw new Error("viewName must be a String (or omitted)");                                // 19
  if (typeof renderFunction !== 'function')                                                   // 20
    throw new Error("renderFunction must be a function");                                     // 21
                                                                                              // 22
  this.viewName = viewName;                                                                   // 23
  this.renderFunction = renderFunction;                                                       // 24
                                                                                              // 25
  this.__eventMaps = [];                                                                      // 26
};                                                                                            // 27
var Template = Blaze.Template;                                                                // 28
                                                                                              // 29
Blaze.isTemplate = function (t) {                                                             // 30
  return (t instanceof Blaze.Template);                                                       // 31
};                                                                                            // 32
                                                                                              // 33
Template.prototype.constructView = function (contentFunc, elseFunc) {                         // 34
  var self = this;                                                                            // 35
  var view = Blaze.View(self.viewName, self.renderFunction);                                  // 36
  view.template = self;                                                                       // 37
                                                                                              // 38
  view.templateContentBlock = (                                                               // 39
    contentFunc ? new Template('(contentBlock)', contentFunc) : null);                        // 40
  view.templateElseBlock = (                                                                  // 41
    elseFunc ? new Template('(elseBlock)', elseFunc) : null);                                 // 42
                                                                                              // 43
  if (self.__eventMaps || typeof self.events === 'object') {                                  // 44
    view._onViewRendered(function () {                                                        // 45
      if (view.renderCount !== 1)                                                             // 46
        return;                                                                               // 47
                                                                                              // 48
      if (! self.__eventMaps.length && typeof self.events === "object") {                     // 49
        // Provide limited back-compat support for `.events = {...}`                          // 50
        // syntax.  Pass `template.events` to the original `.events(...)`                     // 51
        // function.  This code must run only once per template, in                           // 52
        // order to not bind the handlers more than once, which is                            // 53
        // ensured by the fact that we only do this when `__eventMaps`                        // 54
        // is falsy, and we cause it to be set now.                                           // 55
        Template.prototype.events.call(self, self.events);                                    // 56
      }                                                                                       // 57
                                                                                              // 58
      _.each(self.__eventMaps, function (m) {                                                 // 59
        Blaze._addEventMap(view, m, view);                                                    // 60
      });                                                                                     // 61
    });                                                                                       // 62
  }                                                                                           // 63
                                                                                              // 64
  view._templateInstance = new Blaze.TemplateInstance(view);                                  // 65
  view.templateInstance = function () {                                                       // 66
    // Update data, firstNode, and lastNode, and return the TemplateInstance                  // 67
    // object.                                                                                // 68
    var inst = view._templateInstance;                                                        // 69
                                                                                              // 70
    inst.data = Blaze.getData(view);                                                          // 71
                                                                                              // 72
    if (view._domrange && !view.isDestroyed) {                                                // 73
      inst.firstNode = view._domrange.firstNode();                                            // 74
      inst.lastNode = view._domrange.lastNode();                                              // 75
    } else {                                                                                  // 76
      // on 'created' or 'destroyed' callbacks we don't have a DomRange                       // 77
      inst.firstNode = null;                                                                  // 78
      inst.lastNode = null;                                                                   // 79
    }                                                                                         // 80
                                                                                              // 81
    return inst;                                                                              // 82
  };                                                                                          // 83
                                                                                              // 84
  if (self.created) {                                                                         // 85
    view.onViewCreated(function () {                                                          // 86
      self.created.call(view.templateInstance());                                             // 87
    });                                                                                       // 88
  }                                                                                           // 89
                                                                                              // 90
  if (self.rendered) {                                                                        // 91
    view.onViewReady(function () {                                                            // 92
      self.rendered.call(view.templateInstance());                                            // 93
    });                                                                                       // 94
  }                                                                                           // 95
                                                                                              // 96
  if (self.destroyed) {                                                                       // 97
    view.onViewDestroyed(function () {                                                        // 98
      self.destroyed.call(view.templateInstance());                                           // 99
    });                                                                                       // 100
  }                                                                                           // 101
                                                                                              // 102
  return view;                                                                                // 103
};                                                                                            // 104
                                                                                              // 105
Blaze.TemplateInstance = function (view) {                                                    // 106
  if (! (this instanceof Blaze.TemplateInstance))                                             // 107
    // called without `new`                                                                   // 108
    return new Blaze.TemplateInstance(view);                                                  // 109
                                                                                              // 110
  if (! (view instanceof Blaze.View))                                                         // 111
    throw new Error("View required");                                                         // 112
                                                                                              // 113
  view._templateInstance = this;                                                              // 114
  this.view = view;                                                                           // 115
  this.data = null;                                                                           // 116
  this.firstNode = null;                                                                      // 117
  this.lastNode = null;                                                                       // 118
};                                                                                            // 119
                                                                                              // 120
Blaze.TemplateInstance.prototype.$ = function (selector) {                                    // 121
  var view = this.view;                                                                       // 122
  if (! view._domrange)                                                                       // 123
    throw new Error("Can't use $ on template instance with no DOM");                          // 124
  return view._domrange.$(selector);                                                          // 125
};                                                                                            // 126
                                                                                              // 127
Blaze.TemplateInstance.prototype.findAll = function (selector) {                              // 128
  return Array.prototype.slice.call(this.$(selector));                                        // 129
};                                                                                            // 130
                                                                                              // 131
Blaze.TemplateInstance.prototype.find = function (selector) {                                 // 132
  var result = this.$(selector);                                                              // 133
  return result[0] || null;                                                                   // 134
};                                                                                            // 135
                                                                                              // 136
Blaze.TemplateInstance.prototype.autorun = function (f) {                                     // 137
  return this.view.autorun(f);                                                                // 138
};                                                                                            // 139
                                                                                              // 140
Template.prototype.helpers = function (dict) {                                                // 141
  for (var k in dict)                                                                         // 142
    this[k] = dict[k];                                                                        // 143
};                                                                                            // 144
                                                                                              // 145
Template.prototype.events = function (eventMap) {                                             // 146
  var template = this;                                                                        // 147
  var eventMap2 = {};                                                                         // 148
  for (var k in eventMap) {                                                                   // 149
    eventMap2[k] = (function (k, v) {                                                         // 150
      return function (event/*, ...*/) {                                                      // 151
        var view = this; // passed by EventAugmenter                                          // 152
        var data = Blaze.getData(event.currentTarget);                                        // 153
        if (data == null)                                                                     // 154
          data = {};                                                                          // 155
        var args = Array.prototype.slice.call(arguments);                                     // 156
        var tmplInstance = view.templateInstance();                                           // 157
        args.splice(1, 0, tmplInstance);                                                      // 158
        return v.apply(data, args);                                                           // 159
      };                                                                                      // 160
    })(k, eventMap[k]);                                                                       // 161
  }                                                                                           // 162
                                                                                              // 163
  template.__eventMaps.push(eventMap2);                                                       // 164
};                                                                                            // 165
                                                                                              // 166
Template.instance = function () {                                                             // 167
  var view = Blaze.currentView;                                                               // 168
                                                                                              // 169
  while (view && ! view.template)                                                             // 170
    view = view.parentView;                                                                   // 171
                                                                                              // 172
  if (! view)                                                                                 // 173
    return null;                                                                              // 174
                                                                                              // 175
  return view.templateInstance();                                                             // 176
};                                                                                            // 177
                                                                                              // 178
// Note: Template.currentData() is documented to take zero arguments,                         // 179
// while Blaze.getData takes up to one.                                                       // 180
Template.currentData = Blaze.getData;                                                         // 181
                                                                                              // 182
Template.parentData = Blaze._parentData;                                                      // 183
                                                                                              // 184
Template.registerHelper = Blaze.registerHelper;                                               // 185
                                                                                              // 186
////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                            //
// packages/blaze/backcompat.js                                                               //
//                                                                                            //
////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                              //
UI = Blaze;                                                                                   // 1
                                                                                              // 2
Blaze.ReactiveVar = ReactiveVar;                                                              // 3
UI._templateInstance = Blaze.Template.instance;                                               // 4
                                                                                              // 5
Handlebars = {};                                                                              // 6
Handlebars.registerHelper = Blaze.registerHelper;                                             // 7
                                                                                              // 8
Handlebars._escape = Blaze._escape;                                                           // 9
                                                                                              // 10
// Return these from {{...}} helpers to achieve the same as returning                         // 11
// strings from {{{...}}} helpers                                                             // 12
Handlebars.SafeString = function(string) {                                                    // 13
  this.string = string;                                                                       // 14
};                                                                                            // 15
Handlebars.SafeString.prototype.toString = function() {                                       // 16
  return this.string.toString();                                                              // 17
};                                                                                            // 18
                                                                                              // 19
////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package.blaze = {
  Blaze: Blaze,
  UI: UI,
  Handlebars: Handlebars
};

})();

//# sourceMappingURL=blaze.js.map
