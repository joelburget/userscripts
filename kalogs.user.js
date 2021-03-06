// ==UserScript==
// @match https://appengine.google.com/logs*
// ==/UserScript==

/**
 * @fileoverview Custom tweaks to Google App Engine logs as viewed in their
 * web UI to make some things stand out more, and clean up some noise.
 *
 * @author Ben Komalo (benkomalo@gmail.com)
 */

var $ = function(s, node) {
    return (node || document).querySelector(s);
};
var $$ = function(s, node) {
    return (node || document).querySelectorAll(s);
};
var forEach = function(s, nodeOrFunc, node) {
    var handler;
    if (typeof nodeOrFunc === 'function') {
        handler = nodeOrFunc;
        node = node || document;
    } else {
        handler = node;
        node = nodeOrFunc;
    }
    var list = $$(s, node);
    for (var i = 0, el; el = list[i]; i++) {
        handler(el);
    }
};

/**
 * A flag to indicate we're modifying the DOM from our own fixes.
 * This prevents infinite loops, since we want to re-apply the fixes
 * everytime the DOM changes.
 */
var fixing = false;
var applyFixes = function() {
    if (fixing) {
        return;
    }

    fixing = true;

    // Highlight any internal error codes.
    forEach('.ae-logs-reqlog span[title=\'Status\']', function(statusBox) {
        if (statusBox.innerText === '500') {
            statusBox.style.color = 'red';
            statusBox.style.fontWeight = 'bold';
        }
    });

    // Supress all DEBUG lines that are part of the event logger.
    forEach('.ae-logs-applog span[title=\'Logging Severity: Debug\']',
        function(severity) {
            var line = $('span.snippet', severity.parentNode).innerText;
            if (line.indexOf('KALOG;') === 0) {
                severity.parentNode.style.display = 'none';
            }
        });

    // Suppress all response sizes.
    forEach('.ae-logs-reqlog span[title=\'Response Size\']', function(el) {
        el.style.visibility = 'hidden';
    });

    // Color response times
    forEach('.ae-logs-reqlog span[title=\'Request Time/Latency\']',
        function(el) {
            var msTime = Number(el.innerText.slice(0, -2)),
                color;

            if (msTime < 500) {
                color = 'green';
            } else if (msTime < 1000) {
                color = 'orange';
            } else {
                color = 'red';
            }

            el.style.color = color;
        });

    // Simplify datetime stamps.
    forEach('.ae-logs-reqlog h5 > span:first-child', function(el) {
        var datetimeStr = el.innerText;
        var datetime = datetimeStr.split(' ');
        if (datetime.length !== 2) {
            return;
        }
        var time = datetime[1];
        el.setAttribute('title', datetimeStr);
        el.innerText = time.split('.')[0];
        el.style.fontFamily = 'Courier, monospace';
        el.style.fontSize = '14px';
    });
    forEach('.ae-logs-applog h5 > span:nth-child(2)', function(el) {
        // The timestamps for individual log lines aren't that useful in
        // collapsed mode, since the header line has a timestamp.
        // We probably want to show it in expanded mode, though.
        var entryParent = el.parentNode.parentNode.parentNode.parentNode;
        if (entryParent.className.indexOf('ae-log-expanded') === -1) {
            el.style.display = 'none';
        }
    });

    // Simplify user agents.
    var collapseUserAgent = function(el, simplified) {
        var title = el.innerText;
        el.setAttribute('title', title);
        el.innerText = simplified;
    };
    forEach('.ae-logs-reqlog span[title=\'User Agent\']', function(el) {
        var contents = el.innerText;
        if (contents.indexOf('AppEngine-Google;') === 0) {
            collapseUserAgent(el, 'GAE Internal');
        } else if (contents.indexOf('iPad') > -1) {
            collapseUserAgent(el, 'iPad');
        } else if (contents.indexOf('Chrome/') > -1) {
            // TODO: care about Chrome mobile?
            collapseUserAgent(el, 'Chrome');
        }

        var match;
        if (match = /MSIE\s+([^;]*);/.exec(contents)) {
            collapseUserAgent(el, 'IE ' + match[1]);
        } else if (match = /Firefox\/([^\s]*)/.exec(contents)) {
            collapseUserAgent(el, 'Firefox ' + match[1]);
        } else if (match = /Version\/([^\s]*) Safari\//.exec(contents)) {
            collapseUserAgent(el, 'Safari ' + match[1]);
        } else if (match = /Android ([^;]*);/.exec(contents)) {
            // TODO: distinguish between Android browsers
            collapseUserAgent(el, 'Android ' + match[1]);
        }
    });

    window.setTimeout(function() {
        fixing = false;
    }, 1000);
};

var init = function() {
    applyFixes();

    // Navigation or additional filters in the logs web UI modify the internal
    // DOM structure instead of does full page loads. We listen for them
    // here so we can re-apply the changes we want.
    var observer = new WebKitMutationObserver(function(mutations) {
        if (!fixing) {
            window.setTimeout(applyFixes, 0);
        }
    });

    observer.observe($('#ae-logs'), {
        subtree: true,
        attributes: true
    });
};

init();
