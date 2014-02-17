(function($, window) {
	alertify.set({
		labels: {
			ok: "确认",
			cancel: "取消"
		},
		delay : 5000
	});

	HICHAT.service.bindModules({
		viewer: HICHAT.viewer
	});

}($, window));