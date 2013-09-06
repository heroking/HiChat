HICHAT.namespace("HICHAT.service");
HICHAT.service = (function($, window) {
	var eventProcessor = HICHAT.utils.eventProcessor,
		Friend = HICHAT.model.Friend,
		VCard = HICHAT.model.VCard,
		viewer = null,
		rosterModule = (function() {
			var friends = {};
			eventProcessor.bindEvent({
				service_roster_getOtherVCard: function(event, user) {
					eventProcessor.triggerEvent("connector_vCard_getOtherVCard", [user]);
				},
				service_roster_getedOtherVCard: function(event, vCard) {
					var index = vCard.toString();
					eventProcessor.triggerEvent("viewer_drawRosterDetail", [vCard]);
					friends[index] = vCard;
				},
				service_roster_rosterRequested: function(event, friends) {
					var i;
					for (i = friends.length; i--;) {
						eventProcessor.triggerEvent("viewer_drawRoster", [friends[i]]);
					}
				},
				service_roster_setRosterAvailable: function(event, user, presence) {
					eventProcessor.triggerEvent("viewer_setRosterAvailable", [user, presence]);
				},
				service_roster_setRosterUnavailable: function(event, user, presence) {
					eventProcessor.triggerEvent("viewer_setRosterUnavailable", [user]);
				},
				service_roster_subscribeRequest: function(event, user) {
					eventProcessor.triggerEvent("viewer_confirm", ["来自 " + user.getDomain() + " 的 " + user.getJid() + " 请求加您为好友，是否接受？",
						function() {
							eventProcessor.triggerEvent("connector_privacyChat_sendSubscribed", [user]);
							eventProcessor.triggerEvent("viewer_drawRoster", [new Friend({
									vCard: new VCard({
										jid: user.getJid(),
										domain: user.getDomain()
									}),
									groups: []
								})]);
						},
						function() {
							eventProcessor.triggerEvent("connector_privacyChat_sendUnsubscribed", [user]);
						}
					]);
				},
				service_roster_subscribeAccepted: function(event, user) {
					eventProcessor.triggerEvent("viewer_noticeSuccess", ["来自 " + user.getDomain() + " 的 " + user.getJid() + " 同意了您的好友请求"]);
					eventProcessor.triggerEvent("connector_privacyChat_sendBothSubscribe", [user]);
					eventProcessor.triggerEvent("viewer_drawRoster", [new Friend({
							vCard: new VCard({
								jid: user.getJid(),
								domain: user.getDomain()
							}),
							groups: []
						})]);
				},
				service_roster_subscribeRejected: function(event, user) {
					eventProcessor.triggerEvent("viewer_noticeError", ["来自 " + user.getDomain() + " 的 " + user.getJid() + " 拒绝了您的好友请求"]);
				},
				service_roster_unsubscribeRequest: function(event, user) {
					eventProcessor.triggerEvent("viewer_removeRoster", [user]);
					eventProcessor.triggerEvent("viewer_noticeError", ["来自 " + user.getDomain() + " 的 " + user.getJid() + " 取消了对您的好友关系"]);
					eventProcessor.triggerEvent("connector_privacyChat_removeRoster", [user]);
				},
				service_roster_removedRoster: function(event, user) {
					eventProcessor.triggerEvent("viewer_removeRoster", [user]);
				},
				service_roster_sendSubscribe: function(event, user) {
					eventProcessor.triggerEvent("connector_privacyChat_sendSubscribe", [user]);
				},
				service_roster_sendUnsubscribe: function(event, user) {
					eventProcessor.triggerEvent("connector_privacyChat_sendUnsubscribe", [user]);
					eventProcessor.triggerEvent("viewer_removeRoster", [user]);
				},
				service_roster_changeGroup: function(event, friend) {
					eventProcessor.triggerEvent("connector_privacyChat_changeGroup", [friend]);
				},
				service_roster_changedGroup: function(event, friend) {
					eventProcessor.triggerEvent("viewer_changedGroup", [friend]);
				}
			});
		}()),

		selfControlModule = (function() {
			var vCard;
			eventProcessor.bindEvent({
				service_selfControl_logouted: function(event) {
					eventProcessor.triggerEvent("viewer_logouted", []);
				},
				service_selfControl_logined: function(event, success) {
					if (success === true) {
						eventProcessor.triggerEvent("viewer_logined", []);
					} else {
						eventProcessor.triggerEvent("viewer_logouted", []);
						eventProcessor.triggerEvent("viewer_noticeError", ["登录失败"]);
					}
					eventProcessor.triggerEvent("connector_vCard_getMyVCard");
					eventProcessor.triggerEvent("connector_privacyChat_rosterRequest");
				},
				service_selfControl_getedMyVCard: function(event, vCard) {
					if (typeof vCard === 'undefined') {
						eventProcessor.triggerEvent("viewer_noticeError", ["获取个人信息失败"]);
					} else {
						eventProcessor.triggerEvent("viewer_drawVCard", [vCard]);
					}
				},
				service_selfControl_getMyVCard: function(event) {
					eventProcessor.triggerEvent("connector_vCard_getMyVCard");
				},
				service_selfControl_updateMyVCard: function(evnet, vCard) {
					eventProcessor.triggerEvent("connector_vCard_updateMyVCard", [vCard]);
				},
				service_selfControl_updatedMyVCard: function(evnet, success) {
					if (success) {
						eventProcessor.triggerEvent("viewer_noticeSuccess", ["更新个人信息成功"]);
					} else {
						eventProcessor.triggerEvent("viewer_noticeError", ["发生错误：更新个人信息失败"]);
					}
					eventProcessor.triggerEvent("connector_vCard_getMyVCard");
				},
				service_selfControl_login: function(event, username, password) {
					eventProcessor.triggerEvent("connector_basic_login", [username, password]);
				},
				service_selfControl_logout: function(event) {
					eventProcessor.triggerEvent("connector_basic_logout");
				},
				service_selfControl_changeStatus: function(event, status) {
					eventProcessor.triggerEvent("connector_privacyChat_changeStatus", [status]);
				},
				service_selfControl_register: function(event, username, password) {
					eventProcessor.triggerEvent("connector_basic_register", [username, password]);
				}

			});
		}()),

		privacyChatModule = (function() {
			eventProcessor.bindEvent({
				service_privacyChat_recieveMsg: function(event, message) {
					eventProcessor.triggerEvent("viewer_privacyPrintMsg", [message, 'receive']);
				},
				service_privacyChat_sendMsg: function(event, message) {
					eventProcessor.triggerEvent("connector_privacyChat_sendMsg", [message]);
					eventProcessor.triggerEvent("viewer_privacyPrintMsg", [message, "send"]);
				}
			});
		}()),

		groupChatModule = (function() {
			var rooms = {},
				__getRoomInfo = function(roomJid) {
					return rooms[roomJid].roomInfo;
				},
				__deleteRoomInfo = function(roomJid) {
					delete rooms[roomJid];
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
							eventProcessor.triggerEvent("viewer_drawRoomUser", [users[userJid]]);
						}
					}
					return;
				},
				__setUserAffiliation = function(userJid, roomJid, affiliation) {
					var roomUser = __getRoomUser(userJid, roomJid);
					if (typeof roomUser === "undefined") {
						eventProcessor.triggerEvent("viewer_noticeError", ["该用户不在房间内"]);
						return;
					}
					eventProcessor.triggerEvent("connector_groupChat_changeAffiliation", [roomUser, affiliation]);
				};

			eventProcessor.bindEvent({
				service_groupChat_createRoom: function(event, roomConfig) {
					eventProcessor.triggerEvent("connector_groupChat_createRoom", [roomConfig]);
				},
				service_groupChat_createdRoom: function(event, roomConfig) {
					eventProcessor.triggerEvent("viewer_createdRoom", [roomConfig]);
				},
				service_groupChat_deleteRoom: function(event, roomJid, newRoom, reason) {
					var room = __getRoomInfo(roomJid);
					if (room.getAttribute("passwordprotected")) {
						eventProcessor.triggerEvent("viewer_prompt", ["该房间需要密码，请输入密码",
							function(password) {
								eventProcessor.triggerEvent("connector_groupChat_deleteRoom", room, newRoom, reason, password);
							},
							function(password) {}
						]);
					} else {
						eventProcessor.triggerEvent("connector_groupChat_deleteRoom", room, newRoom, reason);
					}
				},
				service_groupChat_deletedRoom: function(event, roomJid, reason) {
					var msg = "房间" + roomJid + "已被移除。";
					if (typeof reason !== "undefined") {
						msg += "原因：" + reason;
					}
					eventProcessor.triggerEvent("viewer_noticeSuccess", [msg]);
					eventProcessor.triggerEvent("viewer_deleteRoomChatTab", [__getRoomInfo(roomJid)]);
					__deleteRoomInfo(roomJid);
				},
				service_groupChat_joinRoom: function(event, roomUser, password) {
					rooms[roomUser.toRoomString()].selfUser = roomUser;
					eventProcessor.triggerEvent("connector_groupChat_joinRoom", [roomUser, password]);
				},
				service_groupChat_joinedRoom: function(event, roomUser) {
					eventProcessor.triggerEvent("viewer_noticeSuccess", ["加入房间 " + roomUser.getRoom().getRoomName() + " 成功！"]);
					rooms[roomUser.toRoomString()].self = roomUser;
					rooms[roomUser.toRoomString()].roomInfo.getCurUsers()[roomUser.toString()] = roomUser;
					eventProcessor.triggerEvent("viewer_drawRoomChatTab", [roomUser.getRoom()]);
				},
				service_groupChat_listRoom: function(event, groupChatService, domain) {
					eventProcessor.triggerEvent("connector_groupChat_listRoom");
				},
				service_groupChat_listedRoom: function(event, roomList) {
					var i;
					rooms = {};
					eventProcessor.triggerEvent("viewer_listRoom", [roomList]);
					for (i = roomList.length; i--;) {
						rooms[roomList[i].toString()] = {
							roomInfo: roomList[i]
						};
						eventProcessor.triggerEvent("connector_groupChat_getRoomInfo", [roomList[i]]);
					}
				},
				service_groupChat_getedRoomInfo: function(event, room) {
					rooms[room.toString()].roomInfo = room;
					eventProcessor.triggerEvent("viewer_drawRoomDetail", [room]);
				},
				service_groupChat_recieveMsg: function(event, message) {
					eventProcessor.triggerEvent("viewer_groupPrintMsg", [message]);
				},
				service_groupChat_leaveRoom: function(event, room) {
					eventProcessor.triggerEvent("connector_groupChat_leaveRoom", [room]);
				},
				service_groupChat_groupSendMsg: function(event, message) {
					eventProcessor.triggerEvent("connector_groupChat_sendMsg", [message]);
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
									eventProcessor.triggerEvent("viewer_drawRoomUser", [users[userJid]]);
								}
							}
							return;
						}
						eventProcessor.triggerEvent("viewer_drawRoomUser", [roomUser]);
					} catch (e) {
						console.log(e);
					}
				},
				service_groupChat_userLeaveRoom: function(event, roomUser) {
					console.log(roomUser.toString());
					console.log(__getRoomSelf(roomUser.getRoom().toString()).toString());
					if (roomUser.toString() === __getRoomSelf(roomUser.getRoom().toString()).toString()) {
						eventProcessor.triggerEvent("viewer_deleteRoomChatTab", [roomUser.getRoom()]);
						__deleteRoomInfo(roomUser.getRoom().toString());
					} else {
						delete __getRoomInfo(roomUser.toRoomString()).getCurUsers()[roomUser.toString()];
						eventProcessor.triggerEvent("viewer_deleteRoomUser", [roomUser]);
					}
				},
				service_groupChat_kickout: function(event, userJid, roomJid) {
					var roomUser = __getRoomUser(userJid, roomJid);
					eventProcessor.triggerEvent("connector_groupChat_kickout", [roomUser]);
				},
				service_groupChat_kickedout: function(event, roomUser) {
					var roomInfo = __getRoomInfo(roomUser.toRoomString());
					if (roomUser.toString() === __getRoomSelf(roomUser.toRoomString()).toString()) {
						eventProcessor.triggerEvent("viewer_noticeError", ["您被踢出了“" + roomInfo.getRoomName() + "”房间"]);
						eventProcessor.triggerEvent("viewer_deleteRoomChatTab", [roomUser.getRoom()]);
						delete rooms[roomUser.toRoomString()];
					} else {
						eventProcessor.triggerEvent("viewer_noticeError", [roomUser.getNickname() + "已被踢出了“" + roomInfo.getRoomName() + "”房间"]);
						delete __getRoomInfo(roomUser.toRoomString()).getCurUsers()[roomUser.toString()];
						eventProcessor.triggerEvent("viewer_deleteRoomUser", [roomUser]);
					}
				},
				service_groupChat_outcast: function(event, userJid, roomJid, reason) {
					var roomUser = __getRoomUser(userJid, roomJid);
					eventProcessor.triggerEvent("connector_groupChat_outcast", [roomUser, reason, __getRoomSelf(roomJid)]);
				},
				service_groupChat_outcasted: function(event, roomUser, reason) {
					var roomInfo = __getRoomInfo(roomUser.toRoomString());
					if (roomUser.toString() === __getRoomSelf(roomUser.toRoomString()).toString()) {
						eventProcessor.triggerEvent("viewer_noticeError", ["您被禁止进入“" + roomInfo.getRoomName() + "”房间.原因：" + reason]);
						eventProcessor.triggerEvent("viewer_deleteRoomChatTab", [roomUser.getRoom()]);
						delete rooms[roomUser.toRoomString()];
					} else {
						eventProcessor.triggerEvent("viewer_noticeError", [roomUser.getNickname() + "已被踢出了“" + roomInfo.getRoomName() + "”房间。原因:" + reason]);
						delete __getRoomInfo(roomUser.toRoomString()).getCurUsers()[roomUser.toString()];
						eventProcessor.triggerEvent("viewer_deleteRoomUser", [roomUser]);
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
					eventProcessor.triggerEvent("connector_groupChat_getOutcastList", [__getRoomInfo(roomJid)]);
				},
				service_groupChat_getedOutcastList: function(event, outcastUserList, roomJid) {
					eventProcessor.triggerEvent("viewer_drawOutcastList", [outcastUserList, __getRoomInfo(roomJid)]);
				},
				service_groupChat_deleteOutcast: function(event, userJid, roomJid) {
					eventProcessor.triggerEvent("connector_groupChat_deleteOutcast", [userJid, roomJid]);
				},
				service_groupChat_deletedOutCast: function(event, userJid, roomJid) {
					eventProcessor.triggerEvent("viewer_removeOutcast", [userJid, roomJid]);
				},
				service_groupChat_getOldNick: function(event, roomJid) {
					eventProcessor.triggerEvent("connector_groupChat_getOldNickInRoom", [__getRoomInfo(roomJid)]);
				},
				service_groupChat_getedOldNick: function(event, roomJid, oldNick) {
					eventProcessor.triggerEvent("viewer_setOldNick", [__getRoomInfo(roomJid), oldNick]);
				},
				service_groupChat_changeNickInRoom: function(event, roomJid, newNickname) {
					eventProcessor.triggerEvent("connector_groupChat_changeNickInRoom", [__getRoomSelf(roomJid), newNickname]);
				},
				service_groupChat_changedNickInRoom: function(event, roomUser, newNickname) {
					var selfUser = __getRoomSelf(roomUser.toRoomString()),
						user;
					if (roomUser.toString() === selfUser.toString()) {
						selfUser.setNickname(newNickname);
					}
					user = __getRoomUser(roomUser.toString(), roomUser.toRoomString());
					eventProcessor.triggerEvent("viewer_deleteRoomUser", [user]);
					user.setNickname(newNickname);
					eventProcessor.triggerEvent("viewer_drawRoomUser", [user]);
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
			eventProcessor.triggerEvent("viewer_noticeError", [msg]);
		},
		service_noticeSuccess: function(event, msg) {
			eventProcessor.triggerEvent("viewer_noticeSuccess", [msg]);
		}
	});

	return {
		getSelfInRoom: groupChatModule.getSelfInRoom,
		getRoomInfo: groupChatModule.getRoomInfo,

		bindModules: function(oArgs) {
			viewer = oArgs.viewer;
		}
	};
}(jQuery, window));