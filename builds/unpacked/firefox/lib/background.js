'use strict';

var app = app || require('./firefox/firefox');
var window = window || app.window; // jshint ignore:line

var config = {
  urls: {
    faqs: 'http://add0n.com/simple-checker-for-gmail.html',
    feed: 'https://mail.google.com/mail/u/id/feed/atom',
    inbox: 'https://mail.google.com/mail/u/id/#inbox'
  },
  gmail: {
    id: 0
  },
  times: {
    start: 10, // seconds
    period: 5, // minutes,
    act: 2000 // mSeconds
  }
};

function fetch (id) {
  let d = window.Promise.defer();
  let req = new window.XMLHttpRequest();
  req.open('GET', config.urls.feed.replace('id', id));
  req.onload = () => d.resolve(req);
  req.onerror = (e) => d.reject(e);
  req.send();
  return d.promise;
}

function check () {
  return fetch(config.gmail.id).then(function (req) {
    let parser = new window.DOMParser();
    let xml = parser.parseFromString(req.responseText, 'text/xml');
    let title = '', fullcount = '';
    try {
      title = xml.querySelector('title').textContent;
    }
    catch (e) {}
    try {
      fullcount = xml.querySelector('fullcount').textContent;
    }
    catch (e) {}
    return {
      title,
      fullcount
    };
  });
}

function once () {
  return check().catch(() => {}).then(function (obj) {
    let fullcount = obj.fullcount || '';
    if (fullcount === '0') {
      fullcount = '';
    }
    app.browserAction.setBadgeText({
      text: fullcount
    });
    let email = obj.title.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi);
    app.browserAction.setTitle({
      title: 'Simple Checker for Gmail\n\nEmail: ' + (email || 'Not Connected') + '\nUnread: ' + obj.fullcount || '-'
    });
  }).catch(e => console.error(e));
}

var id;
function doIt () {
  console.error('checking');
  window.clearTimeout(id);
  once().then(() => {
    id = window.setTimeout(doIt, config.times.period * 60 * 1000);
  });
}
// init
app.storage.local.get(['times.period', 'gmail.id'], function (obj) {
  config.gmail.id = obj['gmail.id'] || config.gmail.id;
  config.times.period = parseInt(obj['times.period']) || config.times.period;
  window.setTimeout(doIt, config.times.delay * 1000);
});
app.storage.onChanged.addListener(function (changes) {
  if ('times.period' in changes) {
    if (changes['times.period'].newValue < 2) {
      return app.storage.local.set({
        'times.period': 2
      });
    }
    config.times.period = parseInt(changes['times.period'].newValue);
    console.error('New time interval is', config.times.period);
    doIt();
  }
  if ('gmail.id' in changes) {
    config.gmail.id = changes['gmail.id'].newValue;
    console.error('Gmail feed id is updated to', config.gmail.id);
    doIt();
  }
});

app.browserAction.onClicked.addListener(() => app.tabs.create({
  url: config.urls.inbox.replace('id', config.gmail.id),
  active: true
}));

app.webRequest.onBeforeRequest.addListener(function (details) {
    if (
      details.url.indexOf('act=') !== -1 ||
      details.url.indexOf('ServiceLogin') !== -1 ||
      details.type === 'main_frame'
    ) {
      window.setTimeout(doIt, config.times.act);
    }
  },
  {urls: ['https://mail.google.com/mail/u/*', 'https://accounts.google.com/*']},
  []
);

app.startup(function () {
  let version = app.runtime.getManifest().version;
  app.storage.local.get('version', function (obj) {
    if (obj.version !== version) {
      app.storage.local.set({version: version}, () => app.tabs.create({
        url: config.urls.faqs + `?version=${version}&type=${obj.version ? 'update' : 'install'}`,
        active: true
      }));
    }
  });
});
