// Client-side JavaScript, bundled and sent to client.

// Define Minimongo collections to match server/publish.js.
Cams = new Mongo.Collection("cams");


Cams.allow({
  insert: function (userId, cam) {
    return true; // no cowboy inserts -- use createParty method
  },
  update: function (userId, cam, fields, modifier) {
    return true;
  },
  remove: function (userId, party) {
    // You can only remove parties that you created and nobody is going to.
    return true;
  }
});

// Name of currently selected tag for filtering
Session.setDefault('tag_filter', null);

// When adding tag to a cam, ID of the cam
Session.setDefault('editing_addtag', null);

// When editing a list name, ID of the list
Session.setDefault('editing_listname', null);

// When editing cam text, ID of the cam
Session.setDefault('editing_itemname', null);

var camsHandle = null;
// Always be subscribed to the cams for the selected list.
Deps.autorun(function () {
  camsHandle = Meteor.subscribe('cams');
});


////////// Helpers for in-place editing //////////

// Returns an event map that handles the "escape" and "return" keys and
// "blur" events on a text input (given by selector) and interprets them
// as "ok" or "cancel".
var okCancelEvents = function (selector, callbacks) {
  var ok = callbacks.ok || function () {};
  var cancel = callbacks.cancel || function () {};

  var events = {};
  events['keyup '+selector+', keydown '+selector+', focusout '+selector] =
    function (evt) {
      if (evt.type === "keydown" && evt.which === 27) {
        // escape = cancel
        cancel.call(this, evt);

      } else if (evt.type === "keyup" && evt.which === 13 ||
                 evt.type === "focusout") {
        // blur/return/enter = ok/submit if non-empty
        var value = String(evt.target.value || "");
        if (value)
          ok.call(this, value, evt);
        else
          cancel.call(this, evt);
      }
    };

  return events;
};

var activateInput = function (input) {
  input.focus();
  input.select();
};

////////// Cams //////////

Template.cams.loading = function () {
  return camsHandle && !camsHandle.ready();
};

Template.cams.any_list_selected = function () {
  return true;
};

//dealing with the search bar
/*


*/
Template.cams.events(okCancelEvents(
  '#search',
  {
    ok: function (text, evt) {
      //do stuff -----var tag = Session.get('tag_filter'); 
    if (Session.equals('tag_filter', this.tag))
      Session.set('tag_filter', null);
    else
      Session.set('tag_filter', this.tag);
    }
  }));

Template.cams.cams = function () {
  // Determine which cams to display in main pane,
  var sel = {};
  var tag_filter = Session.get('tag_filter');
  if (tag_filter)
    sel.tags = tag_filter;
  var searchs = document.getElementById('search');
  if (searchs && searchs.value != '') {
    searchs = searchs.value;
    return Cams.find({ 'text':{'$regex':searchs}}, {sort: {timestamp: 1}});
  }
  return Cams.find(sel, {sort: {timestamp: 1}});
};

Template.cam_item.tag_objs = function () {
  var cam_id = this._id;
  return _.map(this.tags || [], function (tag) {
    return {cam_id: cam_id, tag: tag};
  });
};

Template.cam_item.done_class = function () {
  return this.done ? 'done' : '';
};

Template.cam_item.editing = function () {
  return Session.equals('editing_itemname', this._id);
};

Template.cam_item.adding_tag = function () {
  return Session.equals('editing_addtag', this._id);
};

Template.cam_item.events({
  'click .check': function () {
    Cams.update(this._id, {$set: {done: !this.done}});
  },

  'click .destroy': function () {
    Cams.remove(this._id);
  },

  'click .addtag': function (evt, tmpl) {
    Session.set('editing_addtag', this._id);
    Deps.flush(); // update DOM before focus
    activateInput(tmpl.find("#edittag-input"));
  },

  'dblclick .display .cam-text': function (evt, tmpl) {
    Session.set('editing_itemname', this._id);
    Deps.flush(); // update DOM before focus
    activateInput(tmpl.find("#cam-input"));
  },

  'click .remove': function (evt) {
    var tag = this.tag;
    var id = this.cam_id;

    evt.target.parentNode.style.opacity = 0;
    // wait for CSS animation to finish
    Meteor.setTimeout(function () {
      Cams.update({_id: id}, {$pull: {tags: tag}});
    }, 300);
  },
  
  'click .voteup': function () {
    var id = this.cam_id;
    Meteor.setTimeout(function () {
      Cams.update({_id: id}, {$inc: {up: 1}});
    }, 300);
  },

  'click .votedown': function () {
    alert('up');
  }

});

Template.cam_item.events(okCancelEvents(
  '#cam-input',
  {
    ok: function (value) {
      Cams.update(this._id, {$set: {text: value}});
      Session.set('editing_itemname', null);
      Session.set('editing_itemname', null);
    }
  }));

Template.cam_item.events(okCancelEvents(
  '#edittag-input',
  {
    ok: function (value) {
      Cams.update(this._id, {$addToSet: {tags: value}});
      Session.set('editing_addtag', null);
    },
    cancel: function () {
      Session.set('editing_addtag', null);
    }
  }));

////////// Tag Filter //////////

// Pick out the unique tags from all cams in current list.
Template.tag_filter.tags = function () {
  var tag_infos = [];
  var total_count = 0;

  Cams.find({}).forEach(function (cam) {
    _.each(cam.tags, function (tag) {
      var tag_info = _.find(tag_infos, function (x) { return x.tag === tag; });
      if (! tag_info)
        tag_infos.push({tag: tag, count: 1});
      else
        tag_info.count++;
    });
    total_count++;
  });

  tag_infos = _.sortBy(tag_infos, function (x) { return x.tag; });
  tag_infos.unshift({tag: null, count: total_count});

  return tag_infos;
};

Template.tag_filter.tag_text = function () {
  return this.tag || "All items";
};

Template.tag_filter.selected = function () {
  return Session.equals('tag_filter', this.tag) ? 'selected' : '';
};

Template.tag_filter.events({
  'mousedown .tag': function () {
    if (Session.equals('tag_filter', this.tag))
      Session.set('tag_filter', null);
    else
      Session.set('tag_filter', this.tag);
  }
});

////////// Tracking selected list in URL //////////
Meteor.startup(function () {
  //Backbone.history.start({pushState: true});
});

////////Ups and Downs//////////


