// Backbone.NestedRouter v0.1.0
// ----------------------------------
// (c) 2015 Andrew Henderson
// Backbone Nested Router may be freely distributed under the MIT license.

(function(factory) {

  // Establish the root object, `window` (`self`) in the browser, or `global` on the server.
  // We use `self` instead of `window` for `WebWorker` support.
  var root = (typeof self == 'object' && self.self == self && self) ||
    (typeof global == 'object' && global.global == global && global);

  // Set up Backbone appropriately for the environment. Start with AMD.
  if (typeof define === 'function' && define.amd) {
    define(['backbone', 'underscore'], function(Backbone, _) {
      factory(root, Backbone, _);
    });

    // Next for Node.js or CommonJS. jQuery may not be needed as a module.
  } else if (typeof exports !== 'undefined') {
    var Backbone = require('backbone');
    var _ = require('underscore');
    module.exports = factory(root, Backbone, _);

    // Finally, as a browser global.
  } else {
    factory(root, root.Backbone, root._);
  }

}(function(root, Backbone, _) {

  Backbone.Router = Backbone.Router.extend({

    // Overriding route method to account for nested routes
    route: function(route, name, callback) {
      if (!_.isRegExp(route)) route = this._routeToRegExp(route);
      if (_.isFunction(name) || _.isArray(name)) {
        callback = name;
        name = '';
      }
      // Handle chained route
      if (this.isChained(name) || _.isArray(callback)) {
        callback = this.composeChainedRoute(name, callback);
      }
      if (!callback) callback = this[name];
      var router = this;
      Backbone.history.route(route, function(fragment) {
        var args = router._extractParameters(route, fragment);
        if (router.execute(callback, args, name) !== false) {
          router.trigger.apply(router, ['route:' + name].concat(args));
          router.trigger('route', name, args);
          Backbone.history.trigger('route', router, name, args);
        }
      });
      return this;
    },

    isChained: function(name) {
      return name.indexOf('.') >= 0;
    },

    getCallbacksArray: function(name){
      var chain = name.split('.');
      return chain.map(function(name, i){
        if ( name.indexOf('[') >= 0 ) {
          // Remove any brackets from callback name so it can be located as a callback on router.
          name = name.substring(1, name.length - 1);
          this[name].hasBrackets = true; // boolean used when composing route
        }
        return this[name];
      }, this).reverse(); // Must be reversed so routes execute left to right
    },

    handleCallbacksArg: function(name, callbacks) {
      if (name.length && name.indexOf('[') >= 0) {
        var chain = name.split('.');
        _.each(chain, function(name, i) {
          if (name.indexOf('[') >= 0) {
            callbacks[i].hasBrackets = true; // boolean used when composing route
          }
        });
      }
      return callbacks.reverse();
    },

    // Modification of Underscore's compose method
    // (Underscore.js 1.8.3) http://underscorejs.org/#compose
    composeChainedRoute: function(name, callbacks) {
      callbacks = _.isArray(callbacks) ? this.handleCallbacksArg(name, callbacks) : this.getCallbacksArray(name);
      var start = callbacks.length - 1;
      return function() {
        var i = start;
        var args = _.values(arguments); // Create a mutatable array.
        var firstRoute = callbacks[start];
        var firstArgs = [];
        if (firstRoute.hasBrackets || args[0] === null) {
          firstArgs.push(null); // Routes with brackets are not passed fragment params. Start at null.
        } else {
          firstArgs.push(args[0], null); // don't pass double "null"
          args.shift(); // Remove the used argument before calling the next route.
        }
        var result = firstRoute.apply(this, firstArgs);

        while (i--) {
          var nextRoute = callbacks[i];
          if (result) {
            // result should be at front of arguments
            if (args.length >= 2) {
              args = _.initial(args); // A route param was passed, use the param, without "null";
            } else {
              args.shift(); // Otherwise, start with an empty array.
            }
            args.push(result);
            args = _.flatten(args);
            if (!_.isNull(_.last(args))) {
              args.push(null);
            }
            result = nextRoute.apply(this, args);
          } else { // No result returned
            if (_.isUndefined(args[0])) {
              args = [null]; // Ensure each route at least has null as an argument
            }
            if (nextRoute.hasBrackets) {
              result = nextRoute.apply(this, [null]);
            } else {
              result = nextRoute.apply(this, args);
              args.shift();
            }
          }
        }
        return result;
      };
    }
  });
}));