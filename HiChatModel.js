HICHAT.namespace("HICHAT.model");

HICHAT.model.klass = function(Parent, props) {
	var Child, F, i;
	Child = function() {
		if (Child.uber && Child.uber.hasOwnProperty("__construct")) {
			Child.uber.__construct.apply(this, arguments);
		}
		if (Child.prototype.hasOwnProperty("__construct")) {
			Child.prototype.__construct.apply(this, arguments);
		}
	};
	Parent = Parent || Object;
	F = function() {};
	F.prototype = Parent.prototype;
	Child.prototype = new F();
	Child.uber = Parent.prototype;
	Child.prototype.constructor = Child;
	for (i in props) {
		if (props.hasOwnProperty(i)) {
			Child.prototype[i] = props[i];
		}
	}
	return Child;
};

HICHAT.model.SimpleUser = HICHAT.model.klass(null, {
	__construct: function(oArgs) {
		if (typeof oArgs === 'string') {
			var result = /([\w\-\u4e00-\u9fa5]+)@([\w\-.]+)(?:\/([\w-]+))?/.exec(oArgs);
			this.jid = result[1];
			this.domain = result[2];
			this.resource = result[3];
			return;
		}
		this.jid = oArgs.jid;
		this.domain = oArgs.domain || HICHAT.config.domain;
		this.resource = oArgs.resource || HICHAT.config.resource;
	},
	setJid: function(jid) {
		this.jid = jid;
		return this;
	},
	getJid: function() {
		return this.jid;
	},
	setDomain: function(domain) {
		this.domain = domain || config.domain;
		return this;
	},
	getDomain: function() {
		return this.domain;
	},
	setResource: function(resource) {
		this.resource = resource || config.resource;
		return this;
	},
	getResource: function() {
		return this.resource;
	},
	toWithResourceString: function() {
		return this.jid + "@" + this.domain + "/" + this.resource;
	},
	toString: function() {
		return this.jid + "@" + this.domain;
	}
});

HICHAT.model.Presence = HICHAT.model.klass(null, {
	__construct: function(oArgs) {
		this.type = oArgs.type;
		this.show = oArgs.show;
		this.status = oArgs.status;
	},
	setType: function(type) {
		this.type = type;
	},
	getType: function() {
		return this.type;
	},
	setShow: function(show) {
		this.show = show;
	},
	getShow: function() {
		return this.show;
	},
	setStatus: function(status) {
		this.status = status;
	},
	getStatus: function() {
		return this.status;
	}

});

HICHAT.model.Friend = HICHAT.model.klass(null, {
	__construct: function(oArgs) {
		this.vCard = oArgs.vCard;
		this.groups = oArgs.groups;
	},
	getVCard: function() {
		return this.vCard;
	},
	setVCard: function(vCard) {
		this.vCard = vCard;
	},
	getGroups: function() {
		return this.groups;
	},
	setGroups: function(groups) {
		this.groups = groups;
	}
});

HICHAT.model.VCard = HICHAT.model.klass(HICHAT.model.SimpleUser, {
	__construct: function(oArgs) {
		this.nickname = oArgs.nickname;
		this.sex = oArgs.sex;
		this.birthday = oArgs.bday;
		this.email = oArgs.email;
		this.telephone = oArgs.tele;
		this.description = oArgs.desc;
		this.headPortrait = oArgs.headPortrait;
	},
	setNickname: function(nickname) {
		this.nickname = nickname;
		return this;
	},
	getNickname: function() {
		return this.nickname;
	},
	setSex: function(sex) {
		this.sex = sex;
		return this;
	},
	getSex: function() {
		return this.sex;
	},
	setBirthday: function(birthday) {
		this.birthday = birthday;
		return this;
	},
	getBirthday: function() {
		return this.birthday;
	},
	setEmail: function(email) {
		this.email = email;
		return this;
	},
	getEmail: function() {
		return this.email;
	},
	setTelephone: function(telephone) {
		this.telephone = telephone;
		return this;
	},
	getTelephone: function() {
		return this.telephone;
	},
	setDescription: function(description) {
		this.description = description;
		return this;
	},
	getDescription: function() {
		return this.description;
	},
	setHeadPortrait: function(headPortrait) {
		this.headPortrait = headPortrait;
	},
	getHeadPortrait: function() {
		return this.headPortrait;
	},
	toSimpleUser: function() {
		return new HICHAT.model.SimpleUser({
			jid: this.jid,
			domain: this.domain,
			resource: this.resource
		});
	}
});

HICHAT.model.Room = HICHAT.model.klass(null, {
	__construct: function(oArgs) {
		if (typeof oArgs === 'string') {
			var result = /([\w\-\u4e00-\u9fa5]+)@([\w-]+)\.([\w-]+)/.exec(oArgs);
			this.roomId = result[1];
			this.groupChatResource = result[2];
			this.domain = result[3];
			return;
		}
		this.roomId = oArgs.roomId;
		this.groupChatResource = oArgs.groupChatResource || HICHAT.config.groupChatResource;
		this.domain = oArgs.domain || HICHAT.config.domain;

		this.allowinvites = oArgs.allowinvites;
		this.roomName = oArgs.roomName;
		this.passwordprotected = oArgs.passwordprotected;
		this.roomsecret = oArgs.roomsecret;
		this.hidden = oArgs.hidden;
		this.temporary = oArgs.temporary;
		this.open = oArgs.open;
		this.unmoderated = oArgs.unmoderated;
		this.nonanonymous = oArgs.nonanonymous;
		this.description = oArgs.description;
		this.changesubject = oArgs.changesubject;
		this.contactjid = oArgs.contactjid;
		this.subject = oArgs.subject;
		this.occupants = oArgs.occupants;
		this.lang = oArgs.lang;
		this.logs = oArgs.logs;
		this.pubsub = oArgs.pubsub;

		this.curUsers = {};
	},
	setJidFromString: function(roomJid) {
		var result = /([\w\-\u4e00-\u9fa5]+)@([\w-]+)\.([\w-]+)/.exec(roomJid);
		this.roomId = result[1];
		this.groupChatResource = result[2];
		this.domain = result[3];
	},
	getRoomName: function() {
		return this.roomName;
	},
	setRoomName: function(roomName) {
		this.roomName = roomName;
	},
	getRoomId: function() {
		return this.roomId;
	},
	setRoomId: function(roomId) {
		this.roomId = roomId;
	},
	getGroupChatResource: function() {
		return this.groupChatResource;
	},
	setGroupChatResource: function(groupChatResource) {
		this.groupChatResource = groupChatResource;
	},
	getDomain: function() {
		return this.domain;
	},
	setDomain: function(domain) {
		this.domain = domain;
	},
	toString: function() {
		return this.roomId + "@" + this.groupChatResource + "." + this.domain;
	},
	getCurUsers: function() {
		return this.curUsers;
	},
	setCurUsers: function(curUserList) {
		this.curUsers = curUserList;
	},
	getAttribute: function(attrName) {
		return this[attrName];
	},
	setAttribute: function(attrName, value) {
		this[attrName] = value;
	}
});

HICHAT.model.RoomInfo = HICHAT.model.klass(HICHAT.model.Room, {
	__construct: function(oArgs) {
		if (typeof oArgs.roomJid === 'string') {
			var result = /([\w\-\u4e00-\u9fa5]+)@([\w-]+)\.([\w-]+)/.exec(oArgs.roomJid);
			this.roomId = result[1];
			this.groupChatResource = result[2];
			this.domain = result[3];
		}
		var key;
		for (key in oArgs) {
			if (Object.prototype.hasOwnProperty.apply(oArgs, [key])) {
				this[key] = oArgs[key];
			}
		}
		/*this.passwordProtected = oArgs.passwordProtected;
		this.hidden = oArgs.hidden;
		this.temporary = oArgs.temporary;
		this.open = oArgs.open;
		this.unmoderated = oArgs.unmoderated;
		this.nonanonymous = oArgs.nonanonymous;
		this.description = oArgs.description;
		this.changesubject = oArgs.changesubject;
		this.contactjid = oArgs.contactjid;
		this.subject = oArgs.subject;
		this.occupants = oArgs.occupants;
		this.language = oArgs.language;
		this.logs = oArgs.logs;
		this.pubsub = oArgs.pubsub;*/
	},
	getAttribute: function(attrName) {
		return this[attrName];
	},
	setAttribute: function(attrName, value) {
		this[attrName] = value;
	}
});

HICHAT.model.RoomUser = HICHAT.model.klass(null, {
	__construct: function(oArgs) {
		if (typeof oArgs === 'string') {
			var result = /([\w\-\u4e00-\u9fa5]+)@([\w-]+)\.([\w-]+)(?:\/([A-Za-z\u00C0-\u1FFF\u2800-\uFFFD-]+))/.exec(oArgs);
			this.room = new HICHAT.model.Room({
				roomId: result[1],
				groupChatResource: result[2],
				domain: result[3]
			});
			this.nickname = result[4];
			return;
		}
		this.jid = oArgs.jid;
		this.room = oArgs.room;
		this.nickname = oArgs.nickname;
		this.role = oArgs.role;
		this.affiliation = oArgs.affiliation;
	},
	getNickname: function() {
		return this.nickname;
	},
	setNickname: function(nickname) {
		this.nickname = nickname;
	},
	toString: function() {
		return this.room.roomId + "@" + this.room.groupChatResource + "." + this.room.domain + "/" + this.nickname;
	},
	getRoom: function() {
		return this.room;
	},
	setRoom: function(room) {
		this.room = room;
	},
	toRoomString: function() {
		return this.room.roomId + "@" + this.room.groupChatResource + "." + this.room.domain;
	},
	getRole: function() {
		return this.role;
	},
	setRole: function(role) {
		this.role = role;
	},
	getAffiliation: function() {
		return this.affiliation;
	},
	setAffiliation: function(affiliation) {
		this.affiliation = affiliation;
	},
	getJid: function() {
		return this.jid;
	},
	setJid: function(jid) {
		this.jid = jid;
	}
});

HICHAT.model.OutcastUser = HICHAT.model.klass(null, {
	__construct: function(oArgs) {
		if (typeof oArgs.user === 'string') {
			oArgs.user = new HICHAT.model.SimpleUser(oArgs.user);
		}
		if (typeof oArgs.room === 'string') {
			oArgs.room = new HICHAT.model.Room(oArgs.room);
		}
		this.user = oArgs.user;
		this.room = oArgs.room;
	},
	getUser: function() {
		return this.user;
	},
	setUser: function(user) {
		this.user = user;
	},
	getRoom: function() {
		return this.room;
	},
	setRoom: function(room) {
		this.room = room;
	}
});

HICHAT.model.RoomConfig = HICHAT.model.klass(null, {
	__construct: function(oArgs) {
		var key;
		for (key in oArgs) {
			if (Object.prototype.hasOwnProperty.apply(oArgs, [key])) {
				this[key] = oArgs[key];
			}
		}
		this.domain = oArgs.domain || HICHAT.config.domain;
		this.groupChatResource = oArgs.groupChatResource || HICHAT.config.groupChatResource;
	},
	getAttribute: function(attrName) {
		return this[attrName];
	},
	setAttribute: function(attrName, value) {
		this[attrName] = value;
	},
	toString: function() {
		return this.roomId + "@" + this.groupChatResource + "." + this.domain;
	},
	getAllValue: function() {
		return this;
	}
});

HICHAT.model.HeadPortrait = HICHAT.model.klass(null, {
	__construct: function(oArgs) {
		this.type = oArgs.type;
		this.binval = oArgs.binval;
	},
	setType: function(type) {
		this.type = type;
	},
	getType: function() {
		return this.type;
	},
	setBinval: function(binval) {
		this.binval = binval;
	},
	getBinval: function() {
		return this.binval;
	},
	toHtmlString: function() {
		return 'data:' + this.type + ';base64,' + this.binval;
	},
	isExist: function() {
		return (Boolean(this.binval) === true);
	}
});

HICHAT.model.Message = HICHAT.model.klass(null, {
	__construct: function(oArgs){
		this.user = oArgs.user;
		this.message = oArgs.message;
		this.time = oArgs.time;
	},
	getUser:function(){
		return this.user;
	},
	setUser:function(user){
		this.user = user;
	},
	getMessage: function(){
		return this.message;
	},
	setMessage: function(message){
		this.message = message;
	},
	getTime:function(){
		return this.time;
	},
	setTime:function(time){
		this.time = time;
	}
});

HICHAT.model.GroupMessage = HICHAT.model.klass(null, {
	__construct: function(oArgs){
		this.groupUser = oArgs.groupUser;
		this.message = oArgs.message;
		this.time = oArgs.time;
	},
	getGroupUser:function(){
		return this.groupUser;
	},
	setGroupUser:function(groupUser){
		this.groupUser = groupUser;
	},
	getMessage: function(){
		return this.message;
	},
	setMessage: function(message){
		this.message = message;
	},
	getTime:function(){
		return this.time;
	},
	setTime:function(time){
		this.time = time;
	}
});