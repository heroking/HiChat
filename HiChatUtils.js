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
			} else if(typeof events === 'object'){
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