var HICHAT = {};
HICHAT.namespace = function(ns_string) {
	var parts = ns_string.split('.'),
		parent = HICHAT;
	if (parts[0] === 'HICHAT') {
		parts = parts.slice(1);
	}
	for (var i = 0, m = parts.length; i < m; i++) {
		if (typeof parent[parts[i]] === "undefined") {
			parent[parts[i]] = {};
		}
		parent = parent[parts[i]];
	}
	return parent;
};

HICHAT.namespace("HICHAT.utils");
HICHAT.utils.eventProcessor = (function($, window) {
	var eventListener = $({});
	return {
		bindEvent: function(events, handler) {
			var eName;
			if (typeof events === 'string') {
				eventListener.bind(events, handler);
			} else if (typeof events === 'object') {
				for (eName in events) {
					if (Object.prototype.hasOwnProperty.apply(events, [eName])) {
						if (typeof events[eName] === 'function') {
							eventListener.bind(eName, events[eName]);
						}
					}
				}
			}
		},
		triggerEvent: function(eventName, args) {
			console.log(eventName, args);
			return eventListener.trigger(eventName, args);
		}
	};
}(jQuery, window));

HICHAT.namespace("HICHAT.emotions");
HICHAT.emotions = {
	"angry.png": {
		regexp: ">\\:o",
		emoStr: ">:o "
	},
	"blush.png": {
		regexp: "\\:-\\[",
		emoStr: ":-[ "
	},
	"confused.png": {
		regexp: "\\?\\:\\|",
		emoStr: "?:| "
	},
	"cool.png": {
		regexp: "B-\\)",
		emoStr: "B-) "
	},
	"cry.png": {
		regexp: "\\:'\\(",
		emoStr: ":'( "
	},
	"devil.png": {
		regexp: "\\]\\:\\)",
		emoStr: "]:) "
	},
	"grin.png": {
		regexp: "\\:-D",
		emoStr: ":-D "
	},
	"happy.png": {
		regexp: "\\:-\\)",
		emoStr: ":-) "
	},
	"laugh.png": {
		regexp: "\\:\\^0",
		emoStr: ":^0 "
	},
	"love.png": {
		regexp: "\\:x",
		emoStr: ":x "
	},
	"mischief.png": {
		regexp: ";\\\\",
		emoStr: ";\\ "
	},
	"plain.png": {
		regexp: "\\:\\|",
		emoStr: ":| "
	},
	"sad.png": {
		regexp: "\\:-\\(",
		emoStr: ":-( "
	},
	"shocked.png": {
		regexp: "\\:0",
		emoStr: ":0 "
	},
	"silly.png": {
		regexp: "\\:-p",
		emoStr: ":-p "
	},
	"wink.png": {
		regexp: ";-\\)",
		emoStr: ";-) "
	}
};



jQuery.fn.extend({
	slideRightShow: function(callback) {
		return this.each(function() {
			$(this).show('slide', {
				direction: 'right'
			}, 1000, callback);
		});
	},
	slideLeftHide: function(callback) {
		return this.each(function() {
			$(this).hide('slide', {
				direction: 'left'
			}, 1000, callback);
		});
	},
	slideRightHide: function(callback) {
		return this.each(function() {
			$(this).hide('slide', {
				direction: 'right'
			}, 1000, callback);
		});
	},
	slideLeftShow: function(callback) {
		return this.each(function() {
			$(this).show('slide', {
				direction: 'left'
			}, 1000, callback);
		});
	}
});

String.prototype.htmlEncode = function() {
	return document.createElement("a").appendChild(document.createTextNode(this)).parentNode.innerHTML;
};

String.prototype.htmlDecode = function() {
	var a = document.createElement("a");
	a.innerHTML = this;
	return a.textContent;
};