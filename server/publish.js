
Cams = new Mongo.Collection("cams");

// Publish all items for requested list_id.
Meteor.publish('cams', function () {
  return Cams.find();
});

