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
var JSON = Package.json.JSON;
var _ = Package.underscore._;

/* Package-scope variables */
var EJSON, EJSONTest, base64Encode, base64Decode;

(function () {

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                   //
// packages/ejson/ejson.js                                                                                           //
//                                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                     //
EJSON = {};                                                                                                          // 1
EJSONTest = {};                                                                                                      // 2
                                                                                                                     // 3
var customTypes = {};                                                                                                // 4
// Add a custom type, using a method of your choice to get to and                                                    // 5
// from a basic JSON-able representation.  The factory argument                                                      // 6
// is a function of JSON-able --> your object                                                                        // 7
// The type you add must have:                                                                                       // 8
// - A toJSONValue() method, so that Meteor can serialize it                                                         // 9
// - a typeName() method, to show how to look it up in our type table.                                               // 10
// It is okay if these methods are monkey-patched on.                                                                // 11
// EJSON.clone will use toJSONValue and the given factory to produce                                                 // 12
// a clone, but you may specify a method clone() that will be                                                        // 13
// used instead.                                                                                                     // 14
// Similarly, EJSON.equals will use toJSONValue to make comparisons,                                                 // 15
// but you may provide a method equals() instead.                                                                    // 16
                                                                                                                     // 17
/**                                                                                                                  // 18
 * @summary Add a custom datatype to EJSON.                                                                          // 19
 * @locus Anywhere                                                                                                   // 20
 * @param {String} name A tag for your custom type; must be unique among custom data types defined in your project, and must match the result of your type's `typeName` method.
 * @param {Function} factory A function that deserializes a JSON-compatible value into an instance of your type.  This should match the serialization performed by your type's `toJSONValue` method.
 */                                                                                                                  // 23
EJSON.addType = function (name, factory) {                                                                           // 24
  if (_.has(customTypes, name))                                                                                      // 25
    throw new Error("Type " + name + " already present");                                                            // 26
  customTypes[name] = factory;                                                                                       // 27
};                                                                                                                   // 28
                                                                                                                     // 29
var isInfOrNan = function (obj) {                                                                                    // 30
  return _.isNaN(obj) || obj === Infinity || obj === -Infinity;                                                      // 31
};                                                                                                                   // 32
                                                                                                                     // 33
var builtinConverters = [                                                                                            // 34
  { // Date                                                                                                          // 35
    matchJSONValue: function (obj) {                                                                                 // 36
      return _.has(obj, '$date') && _.size(obj) === 1;                                                               // 37
    },                                                                                                               // 38
    matchObject: function (obj) {                                                                                    // 39
      return obj instanceof Date;                                                                                    // 40
    },                                                                                                               // 41
    toJSONValue: function (obj) {                                                                                    // 42
      return {$date: obj.getTime()};                                                                                 // 43
    },                                                                                                               // 44
    fromJSONValue: function (obj) {                                                                                  // 45
      return new Date(obj.$date);                                                                                    // 46
    }                                                                                                                // 47
  },                                                                                                                 // 48
  { // NaN, Inf, -Inf. (These are the only objects with typeof !== 'object'                                          // 49
    // which we match.)                                                                                              // 50
    matchJSONValue: function (obj) {                                                                                 // 51
      return _.has(obj, '$InfNaN') && _.size(obj) === 1;                                                             // 52
    },                                                                                                               // 53
    matchObject: isInfOrNan,                                                                                         // 54
    toJSONValue: function (obj) {                                                                                    // 55
      var sign;                                                                                                      // 56
      if (_.isNaN(obj))                                                                                              // 57
        sign = 0;                                                                                                    // 58
      else if (obj === Infinity)                                                                                     // 59
        sign = 1;                                                                                                    // 60
      else                                                                                                           // 61
        sign = -1;                                                                                                   // 62
      return {$InfNaN: sign};                                                                                        // 63
    },                                                                                                               // 64
    fromJSONValue: function (obj) {                                                                                  // 65
      return obj.$InfNaN/0;                                                                                          // 66
    }                                                                                                                // 67
  },                                                                                                                 // 68
  { // Binary                                                                                                        // 69
    matchJSONValue: function (obj) {                                                                                 // 70
      return _.has(obj, '$binary') && _.size(obj) === 1;                                                             // 71
    },                                                                                                               // 72
    matchObject: function (obj) {                                                                                    // 73
      return typeof Uint8Array !== 'undefined' && obj instanceof Uint8Array                                          // 74
        || (obj && _.has(obj, '$Uint8ArrayPolyfill'));                                                               // 75
    },                                                                                                               // 76
    toJSONValue: function (obj) {                                                                                    // 77
      return {$binary: base64Encode(obj)};                                                                           // 78
    },                                                                                                               // 79
    fromJSONValue: function (obj) {                                                                                  // 80
      return base64Decode(obj.$binary);                                                                              // 81
    }                                                                                                                // 82
  },                                                                                                                 // 83
  { // Escaping one level                                                                                            // 84
    matchJSONValue: function (obj) {                                                                                 // 85
      return _.has(obj, '$escape') && _.size(obj) === 1;                                                             // 86
    },                                                                                                               // 87
    matchObject: function (obj) {                                                                                    // 88
      if (_.isEmpty(obj) || _.size(obj) > 2) {                                                                       // 89
        return false;                                                                                                // 90
      }                                                                                                              // 91
      return _.any(builtinConverters, function (converter) {                                                         // 92
        return converter.matchJSONValue(obj);                                                                        // 93
      });                                                                                                            // 94
    },                                                                                                               // 95
    toJSONValue: function (obj) {                                                                                    // 96
      var newObj = {};                                                                                               // 97
      _.each(obj, function (value, key) {                                                                            // 98
        newObj[key] = EJSON.toJSONValue(value);                                                                      // 99
      });                                                                                                            // 100
      return {$escape: newObj};                                                                                      // 101
    },                                                                                                               // 102
    fromJSONValue: function (obj) {                                                                                  // 103
      var newObj = {};                                                                                               // 104
      _.each(obj.$escape, function (value, key) {                                                                    // 105
        newObj[key] = EJSON.fromJSONValue(value);                                                                    // 106
      });                                                                                                            // 107
      return newObj;                                                                                                 // 108
    }                                                                                                                // 109
  },                                                                                                                 // 110
  { // Custom                                                                                                        // 111
    matchJSONValue: function (obj) {                                                                                 // 112
      return _.has(obj, '$type') && _.has(obj, '$value') && _.size(obj) === 2;                                       // 113
    },                                                                                                               // 114
    matchObject: function (obj) {                                                                                    // 115
      return EJSON._isCustomType(obj);                                                                               // 116
    },                                                                                                               // 117
    toJSONValue: function (obj) {                                                                                    // 118
      var jsonValue = Meteor._noYieldsAllowed(function () {                                                          // 119
        return obj.toJSONValue();                                                                                    // 120
      });                                                                                                            // 121
      return {$type: obj.typeName(), $value: jsonValue};                                                             // 122
    },                                                                                                               // 123
    fromJSONValue: function (obj) {                                                                                  // 124
      var typeName = obj.$type;                                                                                      // 125
      if (!_.has(customTypes, typeName))                                                                             // 126
        throw new Error("Custom EJSON type " + typeName + " is not defined");                                        // 127
      var converter = customTypes[typeName];                                                                         // 128
      return Meteor._noYieldsAllowed(function () {                                                                   // 129
        return converter(obj.$value);                                                                                // 130
      });                                                                                                            // 131
    }                                                                                                                // 132
  }                                                                                                                  // 133
];                                                                                                                   // 134
                                                                                                                     // 135
EJSON._isCustomType = function (obj) {                                                                               // 136
  return obj &&                                                                                                      // 137
    typeof obj.toJSONValue === 'function' &&                                                                         // 138
    typeof obj.typeName === 'function' &&                                                                            // 139
    _.has(customTypes, obj.typeName());                                                                              // 140
};                                                                                                                   // 141
                                                                                                                     // 142
                                                                                                                     // 143
// for both arrays and objects, in-place modification.                                                               // 144
var adjustTypesToJSONValue =                                                                                         // 145
EJSON._adjustTypesToJSONValue = function (obj) {                                                                     // 146
  // Is it an atom that we need to adjust?                                                                           // 147
  if (obj === null)                                                                                                  // 148
    return null;                                                                                                     // 149
  var maybeChanged = toJSONValueHelper(obj);                                                                         // 150
  if (maybeChanged !== undefined)                                                                                    // 151
    return maybeChanged;                                                                                             // 152
                                                                                                                     // 153
  // Other atoms are unchanged.                                                                                      // 154
  if (typeof obj !== 'object')                                                                                       // 155
    return obj;                                                                                                      // 156
                                                                                                                     // 157
  // Iterate over array or object structure.                                                                         // 158
  _.each(obj, function (value, key) {                                                                                // 159
    if (typeof value !== 'object' && value !== undefined &&                                                          // 160
        !isInfOrNan(value))                                                                                          // 161
      return; // continue                                                                                            // 162
                                                                                                                     // 163
    var changed = toJSONValueHelper(value);                                                                          // 164
    if (changed) {                                                                                                   // 165
      obj[key] = changed;                                                                                            // 166
      return; // on to the next key                                                                                  // 167
    }                                                                                                                // 168
    // if we get here, value is an object but not adjustable                                                         // 169
    // at this level.  recurse.                                                                                      // 170
    adjustTypesToJSONValue(value);                                                                                   // 171
  });                                                                                                                // 172
  return obj;                                                                                                        // 173
};                                                                                                                   // 174
                                                                                                                     // 175
// Either return the JSON-compatible version of the argument, or undefined (if                                       // 176
// the item isn't itself replaceable, but maybe some fields in it are)                                               // 177
var toJSONValueHelper = function (item) {                                                                            // 178
  for (var i = 0; i < builtinConverters.length; i++) {                                                               // 179
    var converter = builtinConverters[i];                                                                            // 180
    if (converter.matchObject(item)) {                                                                               // 181
      return converter.toJSONValue(item);                                                                            // 182
    }                                                                                                                // 183
  }                                                                                                                  // 184
  return undefined;                                                                                                  // 185
};                                                                                                                   // 186
                                                                                                                     // 187
/**                                                                                                                  // 188
 * @summary Serialize an EJSON-compatible value into its plain JSON representation.                                  // 189
 * @locus Anywhere                                                                                                   // 190
 * @param {EJSON} val A value to serialize to plain JSON.                                                            // 191
 */                                                                                                                  // 192
EJSON.toJSONValue = function (item) {                                                                                // 193
  var changed = toJSONValueHelper(item);                                                                             // 194
  if (changed !== undefined)                                                                                         // 195
    return changed;                                                                                                  // 196
  if (typeof item === 'object') {                                                                                    // 197
    item = EJSON.clone(item);                                                                                        // 198
    adjustTypesToJSONValue(item);                                                                                    // 199
  }                                                                                                                  // 200
  return item;                                                                                                       // 201
};                                                                                                                   // 202
                                                                                                                     // 203
// for both arrays and objects. Tries its best to just                                                               // 204
// use the object you hand it, but may return something                                                              // 205
// different if the object you hand it itself needs changing.                                                        // 206
//                                                                                                                   // 207
var adjustTypesFromJSONValue =                                                                                       // 208
EJSON._adjustTypesFromJSONValue = function (obj) {                                                                   // 209
  if (obj === null)                                                                                                  // 210
    return null;                                                                                                     // 211
  var maybeChanged = fromJSONValueHelper(obj);                                                                       // 212
  if (maybeChanged !== obj)                                                                                          // 213
    return maybeChanged;                                                                                             // 214
                                                                                                                     // 215
  // Other atoms are unchanged.                                                                                      // 216
  if (typeof obj !== 'object')                                                                                       // 217
    return obj;                                                                                                      // 218
                                                                                                                     // 219
  _.each(obj, function (value, key) {                                                                                // 220
    if (typeof value === 'object') {                                                                                 // 221
      var changed = fromJSONValueHelper(value);                                                                      // 222
      if (value !== changed) {                                                                                       // 223
        obj[key] = changed;                                                                                          // 224
        return;                                                                                                      // 225
      }                                                                                                              // 226
      // if we get here, value is an object but not adjustable                                                       // 227
      // at this level.  recurse.                                                                                    // 228
      adjustTypesFromJSONValue(value);                                                                               // 229
    }                                                                                                                // 230
  });                                                                                                                // 231
  return obj;                                                                                                        // 232
};                                                                                                                   // 233
                                                                                                                     // 234
// Either return the argument changed to have the non-json                                                           // 235
// rep of itself (the Object version) or the argument itself.                                                        // 236
                                                                                                                     // 237
// DOES NOT RECURSE.  For actually getting the fully-changed value, use                                              // 238
// EJSON.fromJSONValue                                                                                               // 239
var fromJSONValueHelper = function (value) {                                                                         // 240
  if (typeof value === 'object' && value !== null) {                                                                 // 241
    if (_.size(value) <= 2                                                                                           // 242
        && _.all(value, function (v, k) {                                                                            // 243
          return typeof k === 'string' && k.substr(0, 1) === '$';                                                    // 244
        })) {                                                                                                        // 245
      for (var i = 0; i < builtinConverters.length; i++) {                                                           // 246
        var converter = builtinConverters[i];                                                                        // 247
        if (converter.matchJSONValue(value)) {                                                                       // 248
          return converter.fromJSONValue(value);                                                                     // 249
        }                                                                                                            // 250
      }                                                                                                              // 251
    }                                                                                                                // 252
  }                                                                                                                  // 253
  return value;                                                                                                      // 254
};                                                                                                                   // 255
                                                                                                                     // 256
/**                                                                                                                  // 257
 * @summary Deserialize an EJSON value from its plain JSON representation.                                           // 258
 * @locus Anywhere                                                                                                   // 259
 * @param {JSONCompatible} val A value to deserialize into EJSON.                                                    // 260
 */                                                                                                                  // 261
EJSON.fromJSONValue = function (item) {                                                                              // 262
  var changed = fromJSONValueHelper(item);                                                                           // 263
  if (changed === item && typeof item === 'object') {                                                                // 264
    item = EJSON.clone(item);                                                                                        // 265
    adjustTypesFromJSONValue(item);                                                                                  // 266
    return item;                                                                                                     // 267
  } else {                                                                                                           // 268
    return changed;                                                                                                  // 269
  }                                                                                                                  // 270
};                                                                                                                   // 271
                                                                                                                     // 272
/**                                                                                                                  // 273
 * @summary Serialize a value to a string.                                                                           // 274
                                                                                                                     // 275
For EJSON values, the serialization fully represents the value. For non-EJSON values, serializes the same way as `JSON.stringify`.
 * @locus Anywhere                                                                                                   // 277
 * @param {EJSON} val A value to stringify.                                                                          // 278
 * @param {Object} [options]                                                                                         // 279
 * @param {Boolean | Integer | String} options.indent Indents objects and arrays for easy readability.  When `true`, indents by 2 spaces; when an integer, indents by that number of spaces; and when a string, uses the string as the indentation pattern.
 * @param {Boolean} options.canonical When `true`, stringifies keys in an object in sorted order.                    // 281
 */                                                                                                                  // 282
EJSON.stringify = function (item, options) {                                                                         // 283
  var json = EJSON.toJSONValue(item);                                                                                // 284
  if (options && (options.canonical || options.indent)) {                                                            // 285
    return EJSON._canonicalStringify(json, options);                                                                 // 286
  } else {                                                                                                           // 287
    return JSON.stringify(json);                                                                                     // 288
  }                                                                                                                  // 289
};                                                                                                                   // 290
                                                                                                                     // 291
/**                                                                                                                  // 292
 * @summary Parse a string into an EJSON value. Throws an error if the string is not valid EJSON.                    // 293
 * @locus Anywhere                                                                                                   // 294
 * @param {String} str A string to parse into an EJSON value.                                                        // 295
 */                                                                                                                  // 296
EJSON.parse = function (item) {                                                                                      // 297
  if (typeof item !== 'string')                                                                                      // 298
    throw new Error("EJSON.parse argument should be a string");                                                      // 299
  return EJSON.fromJSONValue(JSON.parse(item));                                                                      // 300
};                                                                                                                   // 301
                                                                                                                     // 302
/**                                                                                                                  // 303
 * @summary Returns true if `x` is a buffer of binary data, as returned from [`EJSON.newBinary`](#ejson_new_binary). // 304
 * @param {Object} x The variable to check.                                                                          // 305
 * @locus Anywhere                                                                                                   // 306
 */                                                                                                                  // 307
EJSON.isBinary = function (obj) {                                                                                    // 308
  return !!((typeof Uint8Array !== 'undefined' && obj instanceof Uint8Array) ||                                      // 309
    (obj && obj.$Uint8ArrayPolyfill));                                                                               // 310
};                                                                                                                   // 311
                                                                                                                     // 312
/**                                                                                                                  // 313
 * @summary Return true if `a` and `b` are equal to each other.  Return false otherwise.  Uses the `equals` method on `a` if present, otherwise performs a deep comparison.
 * @locus Anywhere                                                                                                   // 315
 * @param {EJSON} a                                                                                                  // 316
 * @param {EJSON} b                                                                                                  // 317
 * @param {Object} [options]                                                                                         // 318
 * @param {Boolean} options.keyOrderSensitive Compare in key sensitive order, if supported by the JavaScript implementation.  For example, `{a: 1, b: 2}` is equal to `{b: 2, a: 1}` only when `keyOrderSensitive` is `false`.  The default is `false`.
 */                                                                                                                  // 320
EJSON.equals = function (a, b, options) {                                                                            // 321
  var i;                                                                                                             // 322
  var keyOrderSensitive = !!(options && options.keyOrderSensitive);                                                  // 323
  if (a === b)                                                                                                       // 324
    return true;                                                                                                     // 325
  if (_.isNaN(a) && _.isNaN(b))                                                                                      // 326
    return true; // This differs from the IEEE spec for NaN equality, b/c we don't want                              // 327
                 // anything ever with a NaN to be poisoned from becoming equal to anything.                         // 328
  if (!a || !b) // if either one is falsy, they'd have to be === to be equal                                         // 329
    return false;                                                                                                    // 330
  if (!(typeof a === 'object' && typeof b === 'object'))                                                             // 331
    return false;                                                                                                    // 332
  if (a instanceof Date && b instanceof Date)                                                                        // 333
    return a.valueOf() === b.valueOf();                                                                              // 334
  if (EJSON.isBinary(a) && EJSON.isBinary(b)) {                                                                      // 335
    if (a.length !== b.length)                                                                                       // 336
      return false;                                                                                                  // 337
    for (i = 0; i < a.length; i++) {                                                                                 // 338
      if (a[i] !== b[i])                                                                                             // 339
        return false;                                                                                                // 340
    }                                                                                                                // 341
    return true;                                                                                                     // 342
  }                                                                                                                  // 343
  if (typeof (a.equals) === 'function')                                                                              // 344
    return a.equals(b, options);                                                                                     // 345
  if (typeof (b.equals) === 'function')                                                                              // 346
    return b.equals(a, options);                                                                                     // 347
  if (a instanceof Array) {                                                                                          // 348
    if (!(b instanceof Array))                                                                                       // 349
      return false;                                                                                                  // 350
    if (a.length !== b.length)                                                                                       // 351
      return false;                                                                                                  // 352
    for (i = 0; i < a.length; i++) {                                                                                 // 353
      if (!EJSON.equals(a[i], b[i], options))                                                                        // 354
        return false;                                                                                                // 355
    }                                                                                                                // 356
    return true;                                                                                                     // 357
  }                                                                                                                  // 358
  // fallback for custom types that don't implement their own equals                                                 // 359
  switch (EJSON._isCustomType(a) + EJSON._isCustomType(b)) {                                                         // 360
    case 1: return false;                                                                                            // 361
    case 2: return EJSON.equals(EJSON.toJSONValue(a), EJSON.toJSONValue(b));                                         // 362
  }                                                                                                                  // 363
  // fall back to structural equality of objects                                                                     // 364
  var ret;                                                                                                           // 365
  if (keyOrderSensitive) {                                                                                           // 366
    var bKeys = [];                                                                                                  // 367
    _.each(b, function (val, x) {                                                                                    // 368
        bKeys.push(x);                                                                                               // 369
    });                                                                                                              // 370
    i = 0;                                                                                                           // 371
    ret = _.all(a, function (val, x) {                                                                               // 372
      if (i >= bKeys.length) {                                                                                       // 373
        return false;                                                                                                // 374
      }                                                                                                              // 375
      if (x !== bKeys[i]) {                                                                                          // 376
        return false;                                                                                                // 377
      }                                                                                                              // 378
      if (!EJSON.equals(val, b[bKeys[i]], options)) {                                                                // 379
        return false;                                                                                                // 380
      }                                                                                                              // 381
      i++;                                                                                                           // 382
      return true;                                                                                                   // 383
    });                                                                                                              // 384
    return ret && i === bKeys.length;                                                                                // 385
  } else {                                                                                                           // 386
    i = 0;                                                                                                           // 387
    ret = _.all(a, function (val, key) {                                                                             // 388
      if (!_.has(b, key)) {                                                                                          // 389
        return false;                                                                                                // 390
      }                                                                                                              // 391
      if (!EJSON.equals(val, b[key], options)) {                                                                     // 392
        return false;                                                                                                // 393
      }                                                                                                              // 394
      i++;                                                                                                           // 395
      return true;                                                                                                   // 396
    });                                                                                                              // 397
    return ret && _.size(b) === i;                                                                                   // 398
  }                                                                                                                  // 399
};                                                                                                                   // 400
                                                                                                                     // 401
/**                                                                                                                  // 402
 * @summary Return a deep copy of `val`.                                                                             // 403
 * @locus Anywhere                                                                                                   // 404
 * @param {EJSON} val A value to copy.                                                                               // 405
 */                                                                                                                  // 406
EJSON.clone = function (v) {                                                                                         // 407
  var ret;                                                                                                           // 408
  if (typeof v !== "object")                                                                                         // 409
    return v;                                                                                                        // 410
  if (v === null)                                                                                                    // 411
    return null; // null has typeof "object"                                                                         // 412
  if (v instanceof Date)                                                                                             // 413
    return new Date(v.getTime());                                                                                    // 414
  // RegExps are not really EJSON elements (eg we don't define a serialization                                       // 415
  // for them), but they're immutable anyway, so we can support them in clone.                                       // 416
  if (v instanceof RegExp)                                                                                           // 417
    return v;                                                                                                        // 418
  if (EJSON.isBinary(v)) {                                                                                           // 419
    ret = EJSON.newBinary(v.length);                                                                                 // 420
    for (var i = 0; i < v.length; i++) {                                                                             // 421
      ret[i] = v[i];                                                                                                 // 422
    }                                                                                                                // 423
    return ret;                                                                                                      // 424
  }                                                                                                                  // 425
  // XXX: Use something better than underscore's isArray                                                             // 426
  if (_.isArray(v) || _.isArguments(v)) {                                                                            // 427
    // For some reason, _.map doesn't work in this context on Opera (weird test                                      // 428
    // failures).                                                                                                    // 429
    ret = [];                                                                                                        // 430
    for (i = 0; i < v.length; i++)                                                                                   // 431
      ret[i] = EJSON.clone(v[i]);                                                                                    // 432
    return ret;                                                                                                      // 433
  }                                                                                                                  // 434
  // handle general user-defined typed Objects if they have a clone method                                           // 435
  if (typeof v.clone === 'function') {                                                                               // 436
    return v.clone();                                                                                                // 437
  }                                                                                                                  // 438
  // handle other custom types                                                                                       // 439
  if (EJSON._isCustomType(v)) {                                                                                      // 440
    return EJSON.fromJSONValue(EJSON.clone(EJSON.toJSONValue(v)), true);                                             // 441
  }                                                                                                                  // 442
  // handle other objects                                                                                            // 443
  ret = {};                                                                                                          // 444
  _.each(v, function (value, key) {                                                                                  // 445
    ret[key] = EJSON.clone(value);                                                                                   // 446
  });                                                                                                                // 447
  return ret;                                                                                                        // 448
};                                                                                                                   // 449
                                                                                                                     // 450
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                   //
// packages/ejson/stringify.js                                                                                       //
//                                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                     //
// Based on json2.js from https://github.com/douglascrockford/JSON-js                                                // 1
//                                                                                                                   // 2
//    json2.js                                                                                                       // 3
//    2012-10-08                                                                                                     // 4
//                                                                                                                   // 5
//    Public Domain.                                                                                                 // 6
//                                                                                                                   // 7
//    NO WARRANTY EXPRESSED OR IMPLIED. USE AT YOUR OWN RISK.                                                        // 8
                                                                                                                     // 9
function quote(string) {                                                                                             // 10
  return JSON.stringify(string);                                                                                     // 11
}                                                                                                                    // 12
                                                                                                                     // 13
var str = function (key, holder, singleIndent, outerIndent, canonical) {                                             // 14
                                                                                                                     // 15
  // Produce a string from holder[key].                                                                              // 16
                                                                                                                     // 17
  var i;          // The loop counter.                                                                               // 18
  var k;          // The member key.                                                                                 // 19
  var v;          // The member value.                                                                               // 20
  var length;                                                                                                        // 21
  var innerIndent = outerIndent;                                                                                     // 22
  var partial;                                                                                                       // 23
  var value = holder[key];                                                                                           // 24
                                                                                                                     // 25
  // What happens next depends on the value's type.                                                                  // 26
                                                                                                                     // 27
  switch (typeof value) {                                                                                            // 28
  case 'string':                                                                                                     // 29
    return quote(value);                                                                                             // 30
  case 'number':                                                                                                     // 31
    // JSON numbers must be finite. Encode non-finite numbers as null.                                               // 32
    return isFinite(value) ? String(value) : 'null';                                                                 // 33
  case 'boolean':                                                                                                    // 34
    return String(value);                                                                                            // 35
  // If the type is 'object', we might be dealing with an object or an array or                                      // 36
  // null.                                                                                                           // 37
  case 'object':                                                                                                     // 38
    // Due to a specification blunder in ECMAScript, typeof null is 'object',                                        // 39
    // so watch out for that case.                                                                                   // 40
    if (!value) {                                                                                                    // 41
      return 'null';                                                                                                 // 42
    }                                                                                                                // 43
    // Make an array to hold the partial results of stringifying this object value.                                  // 44
    innerIndent = outerIndent + singleIndent;                                                                        // 45
    partial = [];                                                                                                    // 46
                                                                                                                     // 47
    // Is the value an array?                                                                                        // 48
    if (_.isArray(value) || _.isArguments(value)) {                                                                  // 49
                                                                                                                     // 50
      // The value is an array. Stringify every element. Use null as a placeholder                                   // 51
      // for non-JSON values.                                                                                        // 52
                                                                                                                     // 53
      length = value.length;                                                                                         // 54
      for (i = 0; i < length; i += 1) {                                                                              // 55
        partial[i] = str(i, value, singleIndent, innerIndent, canonical) || 'null';                                  // 56
      }                                                                                                              // 57
                                                                                                                     // 58
      // Join all of the elements together, separated with commas, and wrap them in                                  // 59
      // brackets.                                                                                                   // 60
                                                                                                                     // 61
      if (partial.length === 0) {                                                                                    // 62
        v = '[]';                                                                                                    // 63
      } else if (innerIndent) {                                                                                      // 64
        v = '[\n' + innerIndent + partial.join(',\n' + innerIndent) + '\n' + outerIndent + ']';                      // 65
      } else {                                                                                                       // 66
        v = '[' + partial.join(',') + ']';                                                                           // 67
      }                                                                                                              // 68
      return v;                                                                                                      // 69
    }                                                                                                                // 70
                                                                                                                     // 71
                                                                                                                     // 72
    // Iterate through all of the keys in the object.                                                                // 73
    var keys = _.keys(value);                                                                                        // 74
    if (canonical)                                                                                                   // 75
      keys = keys.sort();                                                                                            // 76
    _.each(keys, function (k) {                                                                                      // 77
      v = str(k, value, singleIndent, innerIndent, canonical);                                                       // 78
      if (v) {                                                                                                       // 79
        partial.push(quote(k) + (innerIndent ? ': ' : ':') + v);                                                     // 80
      }                                                                                                              // 81
    });                                                                                                              // 82
                                                                                                                     // 83
                                                                                                                     // 84
    // Join all of the member texts together, separated with commas,                                                 // 85
    // and wrap them in braces.                                                                                      // 86
                                                                                                                     // 87
    if (partial.length === 0) {                                                                                      // 88
      v = '{}';                                                                                                      // 89
    } else if (innerIndent) {                                                                                        // 90
      v = '{\n' + innerIndent + partial.join(',\n' + innerIndent) + '\n' + outerIndent + '}';                        // 91
    } else {                                                                                                         // 92
      v = '{' + partial.join(',') + '}';                                                                             // 93
    }                                                                                                                // 94
    return v;                                                                                                        // 95
  }                                                                                                                  // 96
}                                                                                                                    // 97
                                                                                                                     // 98
// If the JSON object does not yet have a stringify method, give it one.                                             // 99
                                                                                                                     // 100
EJSON._canonicalStringify = function (value, options) {                                                              // 101
  // Make a fake root object containing our value under the key of ''.                                               // 102
  // Return the result of stringifying the value.                                                                    // 103
  options = _.extend({                                                                                               // 104
    indent: "",                                                                                                      // 105
    canonical: false                                                                                                 // 106
  }, options);                                                                                                       // 107
  if (options.indent === true) {                                                                                     // 108
    options.indent = "  ";                                                                                           // 109
  } else if (typeof options.indent === 'number') {                                                                   // 110
    var newIndent = "";                                                                                              // 111
    for (var i = 0; i < options.indent; i++) {                                                                       // 112
      newIndent += ' ';                                                                                              // 113
    }                                                                                                                // 114
    options.indent = newIndent;                                                                                      // 115
  }                                                                                                                  // 116
  return str('', {'': value}, options.indent, "", options.canonical);                                                // 117
};                                                                                                                   // 118
                                                                                                                     // 119
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                   //
// packages/ejson/base64.js                                                                                          //
//                                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                     //
// Base 64 encoding                                                                                                  // 1
                                                                                                                     // 2
var BASE_64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";                              // 3
                                                                                                                     // 4
var BASE_64_VALS = {};                                                                                               // 5
                                                                                                                     // 6
for (var i = 0; i < BASE_64_CHARS.length; i++) {                                                                     // 7
  BASE_64_VALS[BASE_64_CHARS.charAt(i)] = i;                                                                         // 8
};                                                                                                                   // 9
                                                                                                                     // 10
base64Encode = function (array) {                                                                                    // 11
  var answer = [];                                                                                                   // 12
  var a = null;                                                                                                      // 13
  var b = null;                                                                                                      // 14
  var c = null;                                                                                                      // 15
  var d = null;                                                                                                      // 16
  for (var i = 0; i < array.length; i++) {                                                                           // 17
    switch (i % 3) {                                                                                                 // 18
    case 0:                                                                                                          // 19
      a = (array[i] >> 2) & 0x3F;                                                                                    // 20
      b = (array[i] & 0x03) << 4;                                                                                    // 21
      break;                                                                                                         // 22
    case 1:                                                                                                          // 23
      b = b | (array[i] >> 4) & 0xF;                                                                                 // 24
      c = (array[i] & 0xF) << 2;                                                                                     // 25
      break;                                                                                                         // 26
    case 2:                                                                                                          // 27
      c = c | (array[i] >> 6) & 0x03;                                                                                // 28
      d = array[i] & 0x3F;                                                                                           // 29
      answer.push(getChar(a));                                                                                       // 30
      answer.push(getChar(b));                                                                                       // 31
      answer.push(getChar(c));                                                                                       // 32
      answer.push(getChar(d));                                                                                       // 33
      a = null;                                                                                                      // 34
      b = null;                                                                                                      // 35
      c = null;                                                                                                      // 36
      d = null;                                                                                                      // 37
      break;                                                                                                         // 38
    }                                                                                                                // 39
  }                                                                                                                  // 40
  if (a != null) {                                                                                                   // 41
    answer.push(getChar(a));                                                                                         // 42
    answer.push(getChar(b));                                                                                         // 43
    if (c == null)                                                                                                   // 44
      answer.push('=');                                                                                              // 45
    else                                                                                                             // 46
      answer.push(getChar(c));                                                                                       // 47
    if (d == null)                                                                                                   // 48
      answer.push('=');                                                                                              // 49
  }                                                                                                                  // 50
  return answer.join("");                                                                                            // 51
};                                                                                                                   // 52
                                                                                                                     // 53
var getChar = function (val) {                                                                                       // 54
  return BASE_64_CHARS.charAt(val);                                                                                  // 55
};                                                                                                                   // 56
                                                                                                                     // 57
var getVal = function (ch) {                                                                                         // 58
  if (ch === '=') {                                                                                                  // 59
    return -1;                                                                                                       // 60
  }                                                                                                                  // 61
  return BASE_64_VALS[ch];                                                                                           // 62
};                                                                                                                   // 63
                                                                                                                     // 64
/**                                                                                                                  // 65
 * @summary Allocate a new buffer of binary data that EJSON can serialize.                                           // 66
 * @locus Anywhere                                                                                                   // 67
 * @param {Number} size The number of bytes of binary data to allocate.                                              // 68
 */                                                                                                                  // 69
EJSON.newBinary = function (len) {                                                                                   // 70
  if (typeof Uint8Array === 'undefined' || typeof ArrayBuffer === 'undefined') {                                     // 71
    var ret = [];                                                                                                    // 72
    for (var i = 0; i < len; i++) {                                                                                  // 73
      ret.push(0);                                                                                                   // 74
    }                                                                                                                // 75
    ret.$Uint8ArrayPolyfill = true;                                                                                  // 76
    return ret;                                                                                                      // 77
  }                                                                                                                  // 78
  return new Uint8Array(new ArrayBuffer(len));                                                                       // 79
};                                                                                                                   // 80
                                                                                                                     // 81
base64Decode = function (str) {                                                                                      // 82
  var len = Math.floor((str.length*3)/4);                                                                            // 83
  if (str.charAt(str.length - 1) == '=') {                                                                           // 84
    len--;                                                                                                           // 85
    if (str.charAt(str.length - 2) == '=')                                                                           // 86
      len--;                                                                                                         // 87
  }                                                                                                                  // 88
  var arr = EJSON.newBinary(len);                                                                                    // 89
                                                                                                                     // 90
  var one = null;                                                                                                    // 91
  var two = null;                                                                                                    // 92
  var three = null;                                                                                                  // 93
                                                                                                                     // 94
  var j = 0;                                                                                                         // 95
                                                                                                                     // 96
  for (var i = 0; i < str.length; i++) {                                                                             // 97
    var c = str.charAt(i);                                                                                           // 98
    var v = getVal(c);                                                                                               // 99
    switch (i % 4) {                                                                                                 // 100
    case 0:                                                                                                          // 101
      if (v < 0)                                                                                                     // 102
        throw new Error('invalid base64 string');                                                                    // 103
      one = v << 2;                                                                                                  // 104
      break;                                                                                                         // 105
    case 1:                                                                                                          // 106
      if (v < 0)                                                                                                     // 107
        throw new Error('invalid base64 string');                                                                    // 108
      one = one | (v >> 4);                                                                                          // 109
      arr[j++] = one;                                                                                                // 110
      two = (v & 0x0F) << 4;                                                                                         // 111
      break;                                                                                                         // 112
    case 2:                                                                                                          // 113
      if (v >= 0) {                                                                                                  // 114
        two = two | (v >> 2);                                                                                        // 115
        arr[j++] = two;                                                                                              // 116
        three = (v & 0x03) << 6;                                                                                     // 117
      }                                                                                                              // 118
      break;                                                                                                         // 119
    case 3:                                                                                                          // 120
      if (v >= 0) {                                                                                                  // 121
        arr[j++] = three | v;                                                                                        // 122
      }                                                                                                              // 123
      break;                                                                                                         // 124
    }                                                                                                                // 125
  }                                                                                                                  // 126
  return arr;                                                                                                        // 127
};                                                                                                                   // 128
                                                                                                                     // 129
EJSONTest.base64Encode = base64Encode;                                                                               // 130
                                                                                                                     // 131
EJSONTest.base64Decode = base64Decode;                                                                               // 132
                                                                                                                     // 133
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package.ejson = {
  EJSON: EJSON,
  EJSONTest: EJSONTest
};

})();

//# sourceMappingURL=d8bb9054cb9f171f1bb50e9dd745d8f8057a470d.map
