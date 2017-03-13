var gpage = require('webpage').create(),
  ddgpage = require('webpage').create(),
  query = require('system').args[1],
  done = 0;

gpage.viewportSize = ddgpage.viewportSize = gpage.clipRect = ddgpage.clipRect = {
  width: 800,
  height: 600
};

function waitFor(testFx, onReady, timeOutMillis) {
  var maxtimeOutMillis = timeOutMillis ? timeOutMillis : 3000, //< Default Max Timout is 3s
    start = new Date().getTime(),
    condition = false,
    interval = setInterval(function() {
      if ((new Date().getTime() - start < maxtimeOutMillis) && !condition) {
        // If not time-out yet and condition not yet fulfilled
        condition = (typeof(testFx) === "string" ? eval(testFx) : testFx()); //< defensive code
      } else {
        if (!condition) {
          // If condition still not fulfilled (timeout but condition is 'false')
          console.log("'waitFor()' timeout");
          phantom.exit(1);
        } else {
          // Condition fulfilled (timeout and/or condition is 'true')
          console.log("'waitFor()' finished in " + (new Date().getTime() - start) + "ms.");
          typeof(onReady) === "string" ? eval(onReady): onReady(); //< Do what it's supposed to do once the condition is fulfilled
          clearInterval(interval); //< Stop this interval
        }
      }
    }, 250); //< repeat check every 250ms
};

gpage.open('https://www.google.com/search?q=' + query, function(status) {
  console.log("Google Status: " + status);
  if (status === 'fail') {
    phantom.exit(-1);
  }
  gpage.render('google.png');
  done += 1; // race condition?
});

ddgpage.open('https://duckduckgo.com/?q=' + query, function(status) {
  console.log("Duck Duck Go Status: " + status);
  if (status === 'fail') {
    phantom.exit(-1);
  }
  ddgpage.render('duckduckgo.png');
  done += 1;
});

waitFor(function() {
    console.log(done);
    return done >= 2;
  },
  function() {
    phantom.exit(0);
  },
  60000
);
