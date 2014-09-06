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
var Blaze = Package.blaze.Blaze;
var UI = Package.blaze.UI;
var Handlebars = Package.blaze.Handlebars;
var HTML = Package.htmljs.HTML;

/* Package-scope variables */
var Template;

(function () {

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                              //
// packages/templating/templating.js                                                                            //
//                                                                                                              //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                //
                                                                                                                // 1
// Packages and apps add templates on to this object.                                                           // 2
Template = Blaze.Template;                                                                                      // 3
                                                                                                                // 4
// Check for duplicate template names and illegal names that won't work.                                        // 5
Template.__checkName = function (name) {                                                                        // 6
  if (name in Template) {                                                                                       // 7
    if ((Template[name] instanceof Template) && name !== "body")                                                // 8
      throw new Error("There are multiple templates named '" + name + "'. Each template needs a unique name."); // 9
    throw new Error("This template name is reserved: " + name);                                                 // 10
  }                                                                                                             // 11
};                                                                                                              // 12
                                                                                                                // 13
// XXX COMPAT WITH 0.8.3                                                                                        // 14
Template.__define__ = function (name, renderFunc) {                                                             // 15
  Template.__checkName(name);                                                                                   // 16
  Template[name] = new Template("Template." + name, renderFunc);                                                // 17
};                                                                                                              // 18
                                                                                                                // 19
// Define a template `Template.body` that renders its                                                           // 20
// `contentViews`.  `<body>` tags (of which there may be                                                        // 21
// multiple) will have their contents added to it.                                                              // 22
Template.body = new Template('body', function () {                                                              // 23
  var parts = Template.body.contentViews;                                                                       // 24
  // enable lookup by setting `view.template`                                                                   // 25
  for (var i = 0; i < parts.length; i++)                                                                        // 26
    parts[i].template = Template.body;                                                                          // 27
  return parts;                                                                                                 // 28
});                                                                                                             // 29
Template.body.contentViews = []; // array of Blaze.Views                                                        // 30
Template.body.view = null;                                                                                      // 31
                                                                                                                // 32
Template.body.addContent = function (renderFunc) {                                                              // 33
  var kind = 'body_content_' + Template.body.contentViews.length;                                               // 34
                                                                                                                // 35
  Template.body.contentViews.push(Blaze.View(kind, renderFunc));                                                // 36
};                                                                                                              // 37
                                                                                                                // 38
// This function does not use `this` and so it may be called                                                    // 39
// as `Meteor.startup(Template.body.renderIntoDocument)`.                                                       // 40
Template.body.renderToDocument = function () {                                                                  // 41
  // Only do it once.                                                                                           // 42
  if (Template.body.view)                                                                                       // 43
    return;                                                                                                     // 44
                                                                                                                // 45
  var view = UI.render(Template.body, document.body);                                                           // 46
  Template.body.view = view;                                                                                    // 47
};                                                                                                              // 48
                                                                                                                // 49
// XXX COMPAT WITH 0.9.0                                                                                        // 50
UI.body = Template.body;                                                                                        // 51
                                                                                                                // 52
// XXX COMPAT WITH 0.9.0                                                                                        // 53
// (<body> tags in packages built with 0.9.0)                                                                   // 54
Template.__body__ = Template.body;                                                                              // 55
Template.__body__.__contentParts = Template.body.contentViews;                                                  // 56
Template.__body__.__instantiate = Template.body.renderToDocument;                                               // 57
                                                                                                                // 58
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package.templating = {
  Template: Template
};

})();

//# sourceMappingURL=07af27af7aaadd08918b0013abd7ca0c5ce5aaa8.map
