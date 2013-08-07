HICHAT.namespace("HICHAT.service");
HICHAT.service = (function($, window) {
	var eventProcessor = HICHAT.utils.eventProcessor,
		connector = null,
		viewer = null,
		rosterModule = (function() {
			var friends = {};
			eventProcessor.bindEvent({
				service_roster_getOtherVCard : function(event, user){
					connector.getOtherVCard(user);
				},
				service_roster_getedOtherVCard: function(event, vCard) {
					var index = vCard.toString();
					if (typeof friends[index] === 'undefined') {
						viewer.addRoster(vCard);
					} else {
						viewer.removeRoster(vCard.toSimpleUser());
						viewer.addRoster(vCard);
					}
					friends[index] = vCard;
				},
				service_roster_setRosterAvailable: function(event, user, presence) {
					viewer.setRosterAvailable(user);
				},
				service_roster_subscribeRequest: function(event, user) {
					viewer.confirm(
						"来自 " + user.getDomain() + " 的 " + user.getJid() + " 请求订阅您，是否接受？", function() {
						connector.sendSubscribed(user);
						connector.getOtherVCard(user);
					}, function() {
						connector.sendUnsubscribed(user);
					});
				},
				service_roster_subscribeAccepted: function(event, user) {
					viewer.noticeSuccess("来自 " + user.getDomain() + " 的 " + user.getJid() + " 同意了您的订阅");
					connector.sendBothSubscribe(user);
					connector.getOtherVCard(user);
				},
				service_roster_subscribeRejected: function(event, user) {
					viewer.noticeError("来自 " + user.getDomain() + " 的 " + user.getJid() + " 拒绝了您的订阅");
				},
				service_roster_unsubscribeRequest: function(event, user) {
					viewer.removeRoster(user);
					viewer.noticeError("来自 " + user.getDomain() + " 的 " + user.getJid() + " 取消了对您的订阅");
					connector.removeRoster(user);
				},
				service_roster_removedRoster: function(event, user) {
					viewer.removeRoster(user);
				},
				service_roster_sendSubscribe: function(event, user) {
					connector.sendSubscribe(user);
				},
				service_roster_sendUnsubscribe: function(event, user) {
					connector.sendUnsubscribe(user);
					viewer.removeRoster(user);
				}
			});
		}()),

		selfControlModule = (function() {
			var vCard;
			eventProcessor.bindEvent({
				service_selfControl_logouted: function(event) {
					viewer.setSideBarToLogin();
				},
				service_selfControl_logined: function(event, success) {
					console.log("logined");
					console.log(viewer);
					if (success === true) {
						viewer.setSideBarToMain();
					} else {
						viewer.setSideBarToLogin();
						viewer.noticeError("登录失败");
					}
					connector.getMyVCard();
					connector.rosterRequest();
				},
				service_selfControl_drawMyVCard: function(event, vCard) {
					if (typeof vCard === 'undefined') {
						viewer.noticeError("获取个人名片失败");
					} else {
						viewer.drawVCard(vCard);
					}
				},
				service_selfControl_getMyVCard: function(event) {
					connector.getMyVCard();
				},
				service_selfControl_updateMyVCard: function(evnet, vCard) {
					connector.updateMyVCard(vCard);
				},
				service_selfControl_login: function(event, username, password) {
					connector.login(username, password);
				},
				service_selfControl_logout: function(event) {
					connector.logout();
				}
			});
		}()),

		privacyChatModule = (function() {
			eventProcessor.bindEvent({
				service_privacyChat_recieve: function(event, user, msgBody) {
					viewer.privacyPrintMsg(user, msgBody, 'receive');
				},
				service_privacyChat_sendMsg: function(event, msgBody, user) {
					connector.privacySendMsg(msgBody, user);
					viewer.privacyPrintMsg(user, msgBody, "send");
				}
			});
		}()),

		groupChatModule = (function() {
			var rooms = {},
				__getRoomInfo = function(roomJid) {
					return rooms[roomJid].roomInfo;
				},
				__getRoomUser = function(userJid, roomJid) {
					return rooms[roomJid].roomInfo.getCurUsers()[userJid];
				},
				__getRoomSelf = function(roomJid) {
					return rooms[roomJid].selfUser;
				},
				__setRoomUser = function(roomUser) {
					rooms[roomUser.toRoomString()].roomInfo.getCurUsers()[roomUser.toString()] = roomUser;
				},
				__setRoomSelf = function(roomUser) {
					rooms[roomUser.toRoomString()].selfUser = roomUser;
				},
				__refreshRoomUserList = function(roomJid) {
					var users = __getRoomInfo(roomJid),
						userJid;
					for (userJid in users) {
						if (Object.prototype.hasOwnProperty.apply(users, [userJid])) {
							viewer.drawRoomUser(users[userJid]);
						}
					}
					return;
				},
				__setUserAffiliation = function(userJid, roomJid, affiliation) {
					var roomUser = __getRoomUser(userJid, roomJid);
					if (typeof roomUser === "undefined") {
						viewer.noticeError("该用户不在房间内");
						return;
					}
					connector.changeAffiliation(roomUser, affiliation);
				};

			eventProcessor.bindEvent({
				service_groupChat_createRoom: function(event, roomConfig) {
					connector.createRoom(roomConfig);
				},
				service_groupChat_createdRoom: function(event, roomConfig) {
					viewer.createdRoom(roomConfig);
				},
				service_groupChat_deleteRoom: function(event, roomId) {

				},
				service_groupChat_deletedRoom: function(event, roomId) {
					viewer.noticeSuccess("移除房间" + roomId + "成功！");
				},
				service_groupChat_joinRoom: function(event, roomUser, password) {
					rooms[roomUser.toRoomString()].selfUser = roomUser;
					connector.joinRoom(roomUser, password);
				},
				service_groupChat_joinedRoom: function(event, roomUser) {
					viewer.noticeSuccess("加入房间 " + roomUser.getRoom().getRoomName() + " 成功！");
					rooms[roomUser.toRoomString()].self = roomUser;
					rooms[roomUser.toRoomString()].roomInfo.getCurUsers()[roomUser.toString()] = roomUser;
					viewer.drawRoomChatTab(roomUser.getRoom());
				},
				service_groupChat_listRoom: function(event, groupChatService, domain) {
					connector.listRoom();
				},
				service_groupChat_listedRoom: function(event, roomList) {
					var i;
					rooms = {};
					viewer.listRoom(roomList);
					for (i = roomList.length; i--;) {
						rooms[roomList[i].toString()] = {
							roomInfo: roomList[i]
						};
						connector.getRoomInfo(roomList[i]);
					}
				},
				service_groupChat_getedRoomInfo: function(event, room) {
					rooms[room.toString()].roomInfo = room;
					viewer.drawRoomDetail(room);
				},
				service_groupChat_recieve: function(event, roomUser, msgBody) {
					viewer.groupPrintMsg(roomUser, msgBody);
				},
				service_groupChat_leaveRoom: function(event) {
					connector.leaveRoom(room);
				},
				service_groupChat_groupSendMsg: function(event, room, msgBody) {
					connector.groupSendMsg(room, msgBody);
				},
				service_groupChat_userJoinRoom: function(event, roomUser) {
					var users,
						userJid;
					try {
						__setRoomUser(roomUser);
						if (roomUser.toString() === __getRoomSelf.toString()) {
							__setRoomSelf(roomUser);
							users = __getRoomInfo(roomUser.toRoomString()).getCurUsers();
							for (userJid in users) {
								if (Object.prototype.hasOwnProperty.apply(users, [userJid])) {
									viewer.drawRoomUser(users[userJid]);
								}
							}
							return;
						}
						viewer.drawRoomUser(roomUser);
					} catch (e) {
						console.log(e);
					}
				},
				service_groupChat_userLeaveRoom: function(event, roomUser) {
					delete __getRoomInfo(roomUser.toRoomString()).getCurUsers()[roomUser.toString()];
					viewer.deleteRoomUser(roomUser);
				},
				service_groupChat_kickout: function(event, userJid, roomJid) {
					var roomUser = __getRoomUser(userJid, roomJid);
					connector.kickout(roomUser);
				},
				service_groupChat_kickedout: function(event, roomUser) {
					var roomInfo = __getRoomInfo(roomUser.toRoomString());
					if (roomUser.toString() === __getRoomSelf(roomUser.toRoomString()).toString()) {
						viewer.noticeError("您被踢出了“" + roomInfo.getRoomName() + "”房间");
						viewer.deleteRoomChatTab(roomUser.getRoom());
						delete rooms[roomUser.toRoomString()];
					} else {
						viewer.noticeError(roomUser.getNickname() + "已被踢出了“" + roomInfo.getRoomName() + "”房间");
						delete __getRoomInfo(roomUser.toRoomString()).getCurUsers()[roomUser.toString()];
						viewer.deleteRoomUser(roomUser);
					}
				},
				service_groupChat_outcast: function(event, userJid, roomJid, reason) {
					var roomUser = __getRoomUser(userJid, roomJid);
					connector.outcast(roomUser, reason, __getRoomSelf(roomJid));
				},
				service_groupChat_outcasted: function(event, roomUser, reason) {
					var roomInfo = __getRoomInfo(roomUser.toRoomString());
					if (roomUser.toString() === __getRoomSelf(roomUser.toRoomString()).toString()) {
						viewer.noticeError("您被禁止进入“" + roomInfo.getRoomName() + "”房间.原因：" + reason);
						viewer.deleteRoomChatTab(roomUser.getRoom());
						delete rooms[roomUser.toRoomString()];
					} else {
						viewer.noticeError(roomUser.getNickname() + "已被踢出了“" + roomInfo.getRoomName() + "”房间。原因:" + reason);
						delete __getRoomInfo(roomUser.toRoomString()).getCurUsers()[roomUser.toString()];
						viewer.deleteRoomUser(roomUser);
					}
				},
				service_groupChat_setRoomAdmin: function(event, userJid, roomJid) {
					__setUserAffiliation(userJid, roomJid, "admin");
				},
				service_groupChat_setRoomOwner: function(event, userJid, roomJid) {
					__setUserAffiliation(userJid, roomJid, "owner");
				},
				service_groupChat_setRoomMember: function(event, userJid, roomJid) {
					__setUserAffiliation(userJid, roomJid, "member");
				},
				service_groupChat_setRoomVisitor: function(event, userJid, roomJid) {
					__setUserAffiliation(userJid, roomJid, "none");
				},
				service_groupChat_getOutcastList: function(event, roomJid) {
					connector.getOutcastList(__getRoomInfo(roomJid));
				},
				service_groupChat_getedOutcastList: function(event, outcastUserList, roomJid) {
					viewer.drawOutcastList(outcastUserList, __getRoomInfo(roomJid));
				},
				service_groupChat_deleteOutcast: function(event, userJid, roomJid) {
					connector.deleteOutcast(userJid, roomJid);
				},
				service_groupChat_deletedOutCast: function(event, userJid, roomJid) {
					console.log("service_groupChat_deletedOutCast");
					viewer.removeOutcast(userJid, roomJid);
				},
				service_groupChat_getOldNick: function(event, roomJid) {
					connector.getOldNickInRoom(__getRoomInfo(roomJid));
				},
				service_groupChat_getedOldNick: function(event, roomJid, oldNick) {
					view.setOldNick(__getRoomInfo(roomJid), oldNick);
				},
				service_groupChat_changeNickInRoom: function(event, roomJid, newNickname) {
					connector.changeNickInRoom(__getRoomSelf(roomJid), newNickname);
				},
				service_groupChat_changedNickname: function(event, roomUser, newNickname) {
					var selfUser = __getRoomSelf(roomUser.toRoomString()),
						user;
					if (roomUser.toString() === selfUser.toString()) {
						selfUser.setNickname(newNickname);
					}
					user = __getRoomUser(roomUser.toString(), roomUser.toRoomString());
					viewer.deleteRoomUser(user);
					user.setNickname(newNickname);
					viewer.drawRoomUser(user);
				}
			});

			return {
				getSelfInRoom: function(roomJid) {
					return rooms[roomJid].selfUser;
				},
				getRoomInfo: function(roomJid) {
					return rooms[roomJid].roomInfo;
				}
			};
		}()),

		registerModule = (function() {
			return {};
		}());

	eventProcessor.bindEvent({
		service_noticeError: function(event, msg) {
			viewer.noticeError(msg);
		},
		service_noticeSuccess: function(event, msg) {
			viewer.noticeSuccess(msg);
		}
	});

	return {
		//群聊
		getSelfInRoom: groupChatModule.getSelfInRoom,
		getRoomInfo: groupChatModule.getRoomInfo,

		bindModules: function(oArgs) {
			connector = oArgs.connector;
			viewer = oArgs.viewer;
		}
	};
}(jQuery, window));