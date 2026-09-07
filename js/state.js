/* Completion state for the three stations. In memory only: nothing about a
   visitor is stored or sent anywhere. */

(function (global) {
  'use strict';

  var APPS = ['gr', 'putaway', 'interlock'];
  var done = [];
  var listeners = [];

  function isDone(app) { return done.indexOf(app) !== -1; }
  function count() { return done.length; }
  function allDone() { return done.length === APPS.length; }

  function complete(app) {
    if (APPS.indexOf(app) === -1 || isDone(app)) { return false; }
    done.push(app);
    notify(app);
    return true;
  }

  function reset() {
    done = [];
    notify(null);
  }

  function notify(app) {
    listeners.forEach(function (fn) {
      fn({ app: app, count: count(), all: allDone() });
    });
  }

  function subscribe(fn) {
    listeners.push(fn);
    return function () {
      listeners = listeners.filter(function (item) { return item !== fn; });
    };
  }

  global.WarehouseState = {
    apps: APPS,
    isDone: isDone,
    count: count,
    allDone: allDone,
    complete: complete,
    reset: reset,
    subscribe: subscribe
  };
})(window);
