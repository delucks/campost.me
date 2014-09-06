(function(){
Template.body.addContent((function() {
  var view = this;
  return [ HTML.DIV({
    id: "top-tag-filter"
  }, "\n    ", Spacebars.include(view.lookupTemplate("tag_filter")), "\n  "), "\n\n  ", HTML.DIV({
    id: "main-pane"
  }, "\n    ", Spacebars.include(view.lookupTemplate("todos")), "\n  ") ];
}));
Meteor.startup(Template.body.renderToDocument);

Template.__checkName("lists");
Template["lists"] = new Template("Template.lists", (function() {
  var view = this;
  return [ HTML.Raw("<h3>Todo Lists</h3>\n  "), Blaze.If(function() {
    return Spacebars.call(view.lookup("loading"));
  }, function() {
    return [ "\n    ", HTML.DIV({
      id: "lists"
    }, "Loading..."), "\n  " ];
  }, function() {
    return [ "\n    ", HTML.DIV({
      id: "lists"
    }, "\n      ", Blaze.Each(function() {
      return Spacebars.call(view.lookup("lists"));
    }, function() {
      return [ "\n        ", HTML.DIV({
        "class": function() {
          return [ "list ", Spacebars.mustache(view.lookup("selected")) ];
        }
      }, "\n          ", Blaze.If(function() {
        return Spacebars.call(view.lookup("editing"));
      }, function() {
        return [ "\n            ", HTML.DIV({
          "class": "edit"
        }, "\n              ", HTML.INPUT({
          "class": "list-name-input",
          id: "list-name-input",
          type: "text",
          value: function() {
            return Spacebars.mustache(view.lookup("name"));
          }
        }), "\n            "), "\n          " ];
      }, function() {
        return [ "\n            ", HTML.DIV({
          "class": "display"
        }, "\n              ", HTML.A({
          "class": function() {
            return [ "list-name ", Spacebars.mustache(view.lookup("name_class")) ];
          },
          href: function() {
            return [ "/", Spacebars.mustache(view.lookup("_id")) ];
          }
        }, "\n                ", Blaze.View(function() {
          return Spacebars.mustache(view.lookup("name"));
        }), "\n              "), "\n            "), "\n          " ];
      }), "\n        "), "\n      " ];
    }), "\n    "), "\n    ", HTML.DIV({
      id: "createList"
    }, "\n      ", HTML.INPUT({
      type: "text",
      id: "new-list",
      placeholder: "New list"
    }), "\n    "), "\n  " ];
  }) ];
}));

Template.__checkName("todos");
Template["todos"] = new Template("Template.todos", (function() {
  var view = this;
  return Blaze.If(function() {
    return Spacebars.call(view.lookup("any_list_selected"));
  }, function() {
    return [ "\n    ", HTML.DIV({
      id: "items-view"
    }, "\n      ", Blaze.If(function() {
      return Spacebars.call(view.lookup("loading"));
    }, function() {
      return "\n        Loading...\n      ";
    }, function() {
      return [ "\n        ", HTML.DIV({
        id: "new-todo-box"
      }, "\n          ", HTML.INPUT({
        type: "text",
        id: "new-todo",
        placeholder: "Search for Webcams"
      }), "\n        "), "\n        ", HTML.UL({
        id: "item-list"
      }, "\n          ", Blaze.Each(function() {
        return Spacebars.call(view.lookup("todos"));
      }, function() {
        return [ "\n            ", Spacebars.include(view.lookupTemplate("todo_item")), "\n          " ];
      }), "\n        "), "\n      " ];
    }), "\n    "), "\n  " ];
  });
}));

Template.__checkName("todo_item");
Template["todo_item"] = new Template("Template.todo_item", (function() {
  var view = this;
  return HTML.LI({
    "class": function() {
      return [ "todo ", Spacebars.mustache(view.lookup("done_class")) ];
    }
  }, "\n    ", Blaze.If(function() {
    return Spacebars.call(view.lookup("editing"));
  }, function() {
    return [ "\n      ", HTML.DIV({
      "class": "edit"
    }, "\n        ", HTML.INPUT({
      id: "todo-input",
      type: "text",
      value: function() {
        return Spacebars.mustache(view.lookup("text"));
      }
    }), "\n      "), "\n    " ];
  }, function() {
    return [ "\n      ", HTML.DIV({
      "class": "destroy"
    }), "\n      ", HTML.DIV({
      "class": "display"
    }, "\n        ", HTML.INPUT({
      "class": "check",
      name: "markdone",
      type: "checkbox",
      checked: function() {
        return Spacebars.mustache(view.lookup("done"));
      }
    }), "\n        ", HTML.DIV({
      "class": "todo-text"
    }, Blaze.View(function() {
      return Spacebars.mustache(view.lookup("text"));
    })), "\n      "), "\n    " ];
  }), "\n    ", HTML.DIV({
    "class": "item-tags"
  }, "\n      ", Blaze.Each(function() {
    return Spacebars.call(view.lookup("tag_objs"));
  }, function() {
    return [ "\n        ", HTML.DIV({
      "class": "tag removable_tag"
    }, "\n          ", HTML.DIV({
      "class": "name"
    }, Blaze.View(function() {
      return Spacebars.mustache(view.lookup("tag"));
    })), "\n          ", HTML.DIV({
      "class": "remove"
    }), "\n        "), "\n      " ];
  }), "\n      ", Blaze.If(function() {
    return Spacebars.call(view.lookup("adding_tag"));
  }, function() {
    return [ "\n        ", HTML.DIV({
      "class": "tag edittag"
    }, "\n          ", HTML.INPUT({
      type: "text",
      id: "edittag-input",
      value: ""
    }), "\n        "), "\n      " ];
  }, function() {
    return [ "\n        ", HTML.DIV({
      "class": "tag addtag"
    }, "\n          +tag\n        "), "\n      " ];
  }), "\n    "), "\n  ");
}));

Template.__checkName("tag_filter");
Template["tag_filter"] = new Template("Template.tag_filter", (function() {
  var view = this;
  return HTML.DIV({
    id: "tag-filter",
    "class": "tag-list"
  }, HTML.Raw('\n    <div class="label">Show:</div>\n    '), Blaze.Each(function() {
    return Spacebars.call(view.lookup("tags"));
  }, function() {
    return [ "\n      ", HTML.DIV({
      "class": function() {
        return [ "tag ", Spacebars.mustache(view.lookup("selected")) ];
      }
    }, "\n        ", Blaze.View(function() {
      return Spacebars.mustache(view.lookup("tag_text"));
    }), " ", HTML.SPAN({
      "class": "count"
    }, "(", Blaze.View(function() {
      return Spacebars.mustache(view.lookup("count"));
    }), ")"), "\n      "), "\n    " ];
  }), "\n  ");
}));

})();
