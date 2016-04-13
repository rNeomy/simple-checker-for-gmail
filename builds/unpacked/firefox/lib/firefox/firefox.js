'use strict';

// Load Firefox based resources
var self = require('sdk/self'),
    sp = require('sdk/simple-prefs'),
    tabs = require('sdk/tabs'),
    timers = require('sdk/timers'),
    unload = require('sdk/system/unload'),
    buttons = require('sdk/ui/button/action'),
    XMLHttpRequest = require('sdk/net/xhr').XMLHttpRequest, // jshint ignore:line
    {Cc, Ci, Cu} = require('chrome'),
    {on, off, once, emit} = require('sdk/event/core'),
    {all, defer, race, resolve}  = require('sdk/core/promise');

var {WebRequest} = Cu.import('resource://gre/modules/WebRequest.jsm', {});
var {MatchPattern} = Cu.import('resource://gre/modules/MatchPattern.jsm');
var prefService = Cc['@mozilla.org/preferences-service;1']
  .getService(Ci.nsIPrefService);

// Event Emitter
exports.on = on.bind(null, exports);
exports.once = once.bind(null, exports);
exports.emit = emit.bind(null, exports);
exports.removeListener = function removeListener (type, listener) {
  off(exports, type, listener);
};

exports.browserAction = (function () {
  let onClicks = [];
  let button = buttons.ActionButton({
    id: self.name,
    label: 'Simple Checker for Gmail™',
    icon: {
      '16': './icons/16.png',
      '32': './icons/32.png',
      '64': './icons/64.png'
    },
    onClick: () => onClicks.forEach(c => c())
  });

  return {
    onClicked: {
      addListener: (c) => onClicks.push(c)
    },
    setTitle: (obj) => button.label = obj.title,
    setBadgeText: (obj) => button.badge = obj.text
  };
})();

exports.storage = {
  local: {
    set: (obj, callback) => {
      Object.keys(obj).forEach(key => sp.prefs[key] = obj[key]);
      callback();
    },
    get: function (arr, callback) {
      if (typeof arr === 'string') {
        arr = [arr];
      }
      let tmp = {};
      arr.forEach(str => tmp[str] = sp.prefs[str]);
      callback(tmp);
    }
  },
  onChanged: {
    addListener: function (callback) {
      let branch = prefService.getBranch('extensions.jid1-fmmMm36yhukioOuza@jetpack.');
      let observer = {
        observe: function (branch, method, name) {
          let tmp = {};
          tmp[name] = {
            newValue: sp.prefs[name]
          };
          callback(tmp);
        }
      };
      branch.addObserver('', observer, false);
      unload.when(function () {
        branch.removeObserver('', observer);
      });
    }
  }
};

sp.prefs.sss = 1;

exports.tabs = {
  create: function (props) {
    tabs.open({
      url: props.url,
      inBackground: !props.active
    });
  },
  query: function (props, callback) {
    let tmp = [];
    for each (var tab in tabs) {
      tmp.push(tab);
    }
    callback(tmp);
  }
};

exports.runtime = {
  getManifest: () => ({
    version: self.version
  })
};

exports.window = (function () {
  let Promise = function (callback) {
    let d = defer();
    callback(d.resolve, d.reject);
    return d.promise;
  };
  Promise.defer = defer;
  Promise.all = all;
  Promise.race = race;
  Promise.resolve = resolve;

  return {
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
    XMLHttpRequest,
    Promise,
    DOMParser: function () {
      return Cc['@mozilla.org/xmlextras/domparser;1'].createInstance(Ci.nsIDOMParser);
    }
  };
})();

exports.webRequest = {
  onBeforeRequest: {
    addListener: function (callback, filter, opt_extraInfoSpec) {
      filter.urls = new MatchPattern(filter.urls);
      WebRequest.onBeforeRequest.addListener(callback, filter, opt_extraInfoSpec);
      unload.when(() => WebRequest.onBeforeRequest.removeListener(callback));
    }
  }
};

//startup
exports.startup = function (callback) {
  if (self.loadReason === 'install' || self.loadReason === 'startup') {
    callback();
  }
};
