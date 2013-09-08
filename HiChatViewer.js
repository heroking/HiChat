HICHAT.namespace("HICHAT.viewer");
HICHAT.viewer = (function($, window) {
	var eventProcessor = HICHAT.utils.eventProcessor,
		service = HICHAT.service,
		User = HICHAT.model.User,
		VCard = HICHAT.model.VCard,
		Room = HICHAT.model.Room,
		RoomUser = HICHAT.model.RoomUser,
		RoomConfig = HICHAT.model.RoomConfig,
		HeadPortrait = HICHAT.model.HeadPortrait,
		Friend = HICHAT.model.Friend,
		Message = HICHAT.model.Message,
		GroupMessage = HICHAT.model.GroupMessage,
		groups = {
			"noGroup": {}
		},
		selfVCard,
		friendVCard = {},
		privacyChatPanels = {},
		groupChatPanels = {},
		vCardPanels = {},
		wasteChatPanels = {},
		mainDiv = $("#mainDiv"),
		loginDiv = $("#loginDiv"),
		rosterTb = $("#rosterTb"),
		chatTabs = $("#chatTabs"),
		chatTabUl = $("#chatTabUl"),
		myStatus = $("#myStatus"),
		chatTabContent = $("#chatTabContent"),
		vCardDialog = $("#vCardDialog"),
		subscribeDialog = $("#subscribeDialog"),
		createRoomDialog = $("#createRoomDialog"),
		findRoomDialog = $("#findRoomDialog"),
		joinRoomDialog = $("#joinRoomDialog"),
		outcastDialog = $("#outcastDialog"),
		rosterVCardDialog = $("#rosterVCardDialog"),
		registerDialog = $("#registerDialog"),
		rosterGroupDialog = $("#rosterGroupDialog"),
		groupUserContextMenu = $("#groupUserContextMenu"),
		groupConfigContextMenu = $("#groupConfigContextMenu"),
		rosterContextMenu = $("#rosterContextMenu"),
		statusContextMenu = $("#statusContextMenu"),
		changeGroupMenu = $("#changeGroupMenu"),
		__deleteUserInGroups = function(jid) {
			var groupName;
			for (groupName in groups) {
				if (groups.hasOwnProperty(groupName) && typeof groups[groupName][jid] !== "undefined") {
					delete groups[groupName][jid];
				}
			}
		},
		__addUserInGroups = function(jid, groupList) {
			var i;
			console.log(jid, groupList);
			if (groupList.length === 0) {
				groups["noGroup"][jid] = false;
				return;
			}
			for (i = groupList.length; i--;) {
				if (typeof groups[groupList[i]] === "undefined") {
					groups[groupList[i]] = {};
				}
				groups[groupList[i]][jid] = false;
			}
		},
		__initOutcastDialog = function() {
			outcastDialog.dialog({
				autoOpen: false,
				closeOnEscape: true,
				draggable: true,
				resizable: false,
				modal: false,
				width: 800,
				title: "黑名单管理",
				show: "fade",
				hide: "fade",
				buttons: [{
						text: "刷新",
						click: function(event) {
							eventProcessor.triggerEvent("service_groupChat_getOutcastList", [groupConfigContextMenu.data("roomJid")]);
						}
					}
				]
			});
		},
		__initGroupConfigContextMenu = function() {
			$("li[name='changeConfig']", groupConfigContextMenu).click(function(event) {});
			$("li[name='getOutcastList']", groupConfigContextMenu).click(function(event) {
				eventProcessor.triggerEvent("service_groupChat_getOutcastList", [groupConfigContextMenu.data("roomJid")]);
			});
			$("li[name='deleteRoom']", groupConfigContextMenu).click(function(event) {
				eventProcessor.triggerEvent("service_groupChat_deleteRoom", [groupConfigContextMenu.data("roomJid")]);
			});
			$("li[name='changeNickname']", groupConfigContextMenu).click(function(event) {
				__prompt("请输入要更改的昵称:", function(str) {
					eventProcessor.triggerEvent("service_groupChat_changeNickInRoom", [groupConfigContextMenu.data("roomJid"), str]);
				}, function(str) {
					return;
				});
			});
			$("li[name='changeStatus']", groupConfigContextMenu).click(function(event) {
				eventProcessor.triggerEvent("service_groupChat_changeStatusInRoom", [groupConfigContextMenu.data("roomJid")]);
			});
		},
		__showGroupConfigContextMenu = function(selfAffailiation, roomJid, left, top) {
			$("li", groupConfigContextMenu).show();
			if (selfAffailiation !== 'owner') {
				$("li[affiliation='owner']", groupConfigContextMenu).hide();
			}
			if (selfAffailiation !== 'admin' && selfAffailiation !== 'owner') {
				$("li[affiliation='admin']", groupConfigContextMenu).hide();
			}
			groupConfigContextMenu.data("roomJid", roomJid).css("left", left + "px").css("top", top - groupConfigContextMenu.height() + "px").fadeIn();
		},
		__initGroupUserContextMenu = function() {
			$("li[name='admin']", groupUserContextMenu).click(function(event) {
				eventProcessor.triggerEvent("service_groupChat_setRoomAdmin", [groupUserContextMenu.data("userJid"), groupUserContextMenu.data("roomJid")]);
			});
			$("li[name='owner']", groupUserContextMenu).click(function(event) {
				eventProcessor.triggerEvent("service_groupChat_setRoomOwner", [groupUserContextMenu.data("userJid"), groupUserContextMenu.data("roomJid")]);
			});
			$("li[name='member']", groupUserContextMenu).click(function(event) {
				eventProcessor.triggerEvent("service_groupChat_setRoomMember", [groupUserContextMenu.data("userJid"), groupUserContextMenu.data("roomJid")]);
			});
			$("li[name='none']", groupUserContextMenu).click(function(event) {
				eventProcessor.triggerEvent("service_groupChat_setRoomVisitor", [groupUserContextMenu.data("userJid"), groupUserContextMenu.data("roomJid")]);
			});
			$("li[name='kickout']", groupUserContextMenu).click(function(event) {
				eventProcessor.triggerEvent("service_groupChat_kickout", [groupUserContextMenu.data("userJid"), groupUserContextMenu.data("roomJid")]);
			});
			$("li[name='outcast']", groupUserContextMenu).click(function(event) {
				__prompt("确定要将" + groupUserContextMenu.data("userJid") + "用户加入黑名单中？若需要加入，填入您将其加入黑名单的理由", function(reason) {
					eventProcessor.triggerEvent("service_groupChat_outcast", [groupUserContextMenu.data("userJid"), groupUserContextMenu.data("roomJid"), reason]);
				}, function(reason) {
					return;
				});
			});
		},
		__showGroupUserContextMenu = function(userAffiliation, selfAffailiation, idArgs, left, top) {
			$("li", groupUserContextMenu).show();
			if (selfAffailiation !== 'owner' && selfAffailiation !== 'admin') {
				return;
			}
			if (selfAffailiation !== "owner") {
				$("li[affiliation='owner']", groupUserContextMenu).hide();
			}
			groupUserContextMenu.data(idArgs).css("left", left + "px").css("top", top - groupUserContextMenu.height() + "px").fadeIn();
		},
		__drawRoomUser = function(roomUser) {
			var content = groupChatPanels[roomUser.toRoomString()].content,
				liNode;
			if (typeof content !== "undefined") {
				if ($(".u-mdu ul li[uid='" + roomUser.toString() + "']", content).length !== 0) {
					$(".u-mdu ul li[uid='" + roomUser.toString() + "']", content).remove();
				}
				if (roomUser.getAffiliation() === 'owner') {
					liNode = $("<li>" + roomUser.getNickname() + "(创建人)" + "</li>");
				} else if (roomUser.getAffiliation() === 'admin') {
					liNode = $("<li>" + roomUser.getNickname() + "(管理员)" + "</li>");
				} else if (roomUser.getAffiliation() === 'member') {
					liNode = $("<li>" + roomUser.getNickname() + "(会员)" + "</li>");
				} else {
					liNode = $("<li>" + roomUser.getNickname() + "(游客)" + "</li>");
				}
				liNode.attr('uid', roomUser.toString()).data({
					affiliation: roomUser.getAffiliation(),
					roomJid: roomUser.toRoomString(),
					uid: roomUser.toString()
				}).click(function(event) {
					var that = $(this),
						uid = that.data("uid"),
						affiliation = that.data("affiliation"),
						roomJid = that.data("roomJid"),
						selfUser = service.getSelfInRoom(roomJid),
						left = event.pageX,
						top = event.pageY;
					__showGroupUserContextMenu(affiliation, selfUser.getAffiliation(), {
						roomJid: roomJid,
						userJid: uid,
						selfJid: selfUser.toString()
					}, left, top);
					event.stopPropagation();
					event.preventDefault();
					return false;
				}).contextmenu(function(event) {
					var that = $(this),
						uid = that.data("uid"),
						affiliation = that.data("affiliation"),
						roomJid = that.data("roomJid"),
						selfUser = service.getSelfInRoom(roomJid),
						left = event.pageX,
						top = event.pageY;
					__showGroupUserContextMenu(affiliation, selfUser.getAffiliation(), {
						roomJid: roomJid,
						userJid: uid,
						selfJid: selfUser.toString()
					}, left, top);
					event.stopPropagation();
					event.preventDefault();
					return false;
				});
				$(".u-mdu ul", content).append(liNode);
				$(".u-mdu .u-mc").text("当前在线" + $(".u-mdu ul li", content).length + "人");

			}
		},
		__deleteRoomUser = function(roomUser) {
			var content = groupChatPanels[roomUser.toRoomString()].content;
			if (typeof content !== "undefined") {
				$(".u-mdu ul li[uid='" + roomUser.toString() + "']", content).remove();
				$(".u-mdu .u-mc").text("当前在线" + $(".u-mdu ul li", content).length + "人");
			}
		},
		__drawRoomChatTab = function(room) {
			var index = room.toString(),
				newTab,
				newContent,
				chatPanel,
				chatTextArea,
				sendBtn,
				sendTextArea,
				sendDiv,
				groupMemberDiv,
				closeChatPanelSpan,
				dropupDiv,
				memberUl,
				members,
				i,
				m;

			if (typeof groupChatPanels[index] === "undefined") {
				groupChatPanels[index] = {
					messageQueue: []
				};
			}

			if (typeof groupChatPanels[index].content === "undefined") {
				if (typeof wasteChatPanels[index] === "undefined") {
					newTab = $("<li><a href='#chatPanel_" + room.getRoomId() + "_" + room.getGroupChatResource() + "_" + room.getDomain() + "'>" + room.getRoomName() + "<span><img src='resources/closeChatPanelIcon.png'></span></a></li>");
					chatTabUl.append(newTab);
					chatTextArea = $("<div class='u-cta'><table><thead></thead><tbody></tbody></table></div>").css("max-height", $("body").height() - 150 + "px");
					sendTextArea = $("<textarea></textarea>").bind("keypress", function(event) {
						if (event.ctrlKey && event.which === 13 || event.which === 10) {
							$(".u-sbtn", $(this).parent()).trigger("click");
						}
					});
					sendBtn = $("<button class='btn btn-success u-sbtn'>发送</button>").data("room", room).bind("click", function(event) {
						var room = $(this).data("room"),
							msgBody = $("textarea", $(this).parent()).val().trim();
						if (msgBody === "") {
							return;
						}
						eventProcessor.triggerEvent("service_groupChat_groupSendMsg", [new GroupMessage({
								groupUser: new RoomUser({
									room: room
								}),
								message: msgBody
							})]);
						$("textarea", $(this).parent()).focus().val("");
					});

					memberUl = $("<ul class='dropdown-menu pull-right' roomJid='" + index + "'></ul>");
					dropupDiv = $("<div style='margin-left:50px' class='u-mdu'></div>")
						.data("member", 0)
						.addClass("btn-group dropup")
						.append("<button class='btn btn-success u-mc'></button>")
						.append("<button class='btn btn-success dropdown-toggle' data-toggle='dropdown' style='padding:5px 12px 11px 12px'><span class='caret'></span></button>")
						.append(memberUl);
					$(".u-mc", dropupDiv).data({
						roomJid: index,
						selfAffailiation: service.getSelfInRoom(index).getAffiliation()
					}).click(function(event) {
						var that = $(this),
							roomJid = that.data("roomJid"),
							selfAffailiation = that.data("selfAffailiation"),
							left = event.pageX,
							top = event.pageY;
						__showGroupConfigContextMenu(selfAffailiation, roomJid, left, top);
						event.stopPropagation();
						event.preventDefault();
						return false;
					}).contextmenu(function(event) {
						var that = $(this),
							roomJid = that.data("roomJid"),
							selfAffailiation = that.data("selfAffailiation"),
							left = event.pageX,
							top = event.pageY;
						__showGroupConfigContextMenu(selfAffailiation, roomJid, left, top);
						event.stopPropagation();
						event.preventDefault();
						return false;
					});

					sendDiv = $("<div class='u-sd s-sd'></div>").append(sendTextArea).append(sendBtn).append(dropupDiv);
					chatPanel = $("<div class='m-cp'></div>").css("height", $("body").height() - 150 + "px").append(chatTextArea).append(sendDiv);
					newContent = $("<div id='chatPanel_" + room.getRoomId() + "_" + room.getGroupChatResource() + "_" + room.getDomain() + "'></div>").append(chatPanel);
					chatTabs.append(newContent);
					chatTabs.tabs("refresh");
					$("a", newTab).trigger("click");
					$("img", newTab).click(function(event) {
						__deleteRoomChatTab(room);
						eventProcessor.triggerEvent("service_groupChat_leaveRoom", [room]);
						event.stopPropagation();
					});
					groupChatPanels[index].tab = newTab;
					groupChatPanels[index].content = newContent;
					members = room.getCurUsers();
					for (i in members) {
						if (Object.prototype.hasOwnProperty.apply(members, [i])) {
							__drawRoomUser(members[i]);
						}
					}
				} else {
					groupChatPanels[index].tab = wasteChatPanels[index].tab.fadeIn();
					groupChatPanels[index].content = wasteChatPanels[index].content.fadeIn();
					chatTabs.tabs("refresh");
					$("a", groupChatPanels[index].tab).trigger("click");
					delete wasteChatPanels[index].tab;
					delete wasteChatPanels[index].content;
					delete wasteChatPanels[index];
				}
			} else {
				$("a", groupChatPanels[index].tab).tab('show');
			}
			for (i = 0, m = groupChatPanels[index].messageQueue.length; i < m; i++) {
				__printPrivacyMsg(
					new Message({
					user: user,
					message: groupChatPanels[index].messageQueue[i].msgBody,
					time: new Date().getTime()
				}),
					groupChatPanels[index].messageQueue[i].type);
			}
		},
		__deleteRoomChatTab = function(room) {
			var index = room,
				prev;
			if (typeof room !== 'string') {
				index = room.toString();
			}
			while (true) {
				prev = groupChatPanels[index].tab.prev();
				if (prev.length === 0) {
					break;
				}
				if (prev.css("display") !== "none") {
					$("a", prev).trigger("click");
					break;
				}
			}
			if (typeof groupChatPanels[index] !== "undefined") {
				wasteChatPanels[index] = {};
				wasteChatPanels[index].tab = groupChatPanels[index].tab;
				wasteChatPanels[index].content = groupChatPanels[index].content;
				delete groupChatPanels[index].tab;
				delete groupChatPanels[index].content;
				wasteChatPanels[index].tab.fadeOut();
				wasteChatPanels[index].content.fadeOut();
			}
			chatTabs.tabs("refresh");
		},
		__destoryRoomChatTab = function(room) {
			var index = room;
			if (typeof index !== 'string') {
				index = room.toString();
			}
			groupChatPanels[index].tab.remove();
			groupChatPanels[index].content.remove();
			delete groupChatPanels[index].tab;
			delete groupChatPanels[index].content;
			delete groupChatPanels[index];
		},
		__createTab = function(user, nickname) {
			var index = user.toString(),
				newTab,
				newContent,
				chatPanel,
				chatTextArea,
				sendBtn,
				sendTextArea,
				sendDiv,
				closeChatPanelSpan,
				i,
				m;
			nickname = nickname || user.toString();
			if (typeof privacyChatPanels[index] === "undefined") {
				privacyChatPanels[index] = {
					messageQueue: []
				};
			}

			if (typeof privacyChatPanels[index].content === "undefined") {
				if (typeof wasteChatPanels[index] === "undefined") {
					newTab = $("<li><a href='#chatPanel_" + user.getJid() + "_" + user.getDomain() + "'>" + nickname + "<span><img src='resources/closeChatPanelIcon.png'></span></a></li>");
					chatTabUl.append(newTab);
					chatTextArea = $("<div class='u-cta'><table><thead></thead><tbody></tbody></table></div>").css("max-height", $("body").height() - 150 + "px");
					sendTextArea = $("<textarea></textarea>").bind("keypress", function(event) {
						if (event.ctrlKey && event.which === 13 || event.which === 10) {
							$(".u-sbtn", $(this).parent()).trigger("click");
						}
					});
					sendBtn = $("<button class='btn btn-success u-sbtn'>发送</button>").data("user", user).bind("click", function(event) {
						var user = $(this).data("user"),
							msgBody = $("textarea", $(this).parent()).val().trim();
						if (msgBody === "") {
							return;
						}
						eventProcessor.triggerEvent("service_privacyChat_sendMsg", [new Message({
								user: user,
								message: msgBody,
								time: new Date().getTime()
							})]);
						$("textarea", $(this).parent()).focus().val("");
					});
					sendDiv = $("<div class='u-sd s-sd'></div>").append(sendTextArea).append(sendBtn);
					chatPanel = $("<div class='m-cp'></div>").css("height", $("body").height() - 150 + "px").append(chatTextArea).append(sendDiv);
					newContent = $("<div id='chatPanel_" + user.getJid() + "_" + user.getDomain() + "'></div>").append(chatPanel);
					chatTabs.append(newContent).tabs("refresh");
					$("a", newTab).trigger("click");
					$("img", newTab).addClass("u-del").click(function(event) {
						__deleteTab(user);
						event.stopPropagation();
					});
					privacyChatPanels[index].tab = newTab;
					privacyChatPanels[index].content = newContent;
				} else {
					privacyChatPanels[index].tab = wasteChatPanels[index].tab.fadeIn();
					privacyChatPanels[index].content = wasteChatPanels[index].content.fadeIn();
					chatTabs.tabs("refresh");
					$("a", privacyChatPanels[index].tab).trigger("click");
					delete wasteChatPanels[index].tab;
					delete wasteChatPanels[index].content;
					delete wasteChatPanels[index];
				}
			} else {
				$("a", privacyChatPanels[index].tab).trigger("click");
			}
			for (i = 0, m = privacyChatPanels[index].messageQueue.length; i < m; i++) {
				__printPrivacyMsg(
					privacyChatPanels[index].messageQueue[i].message,
					privacyChatPanels[index].messageQueue[i].type);
			}
			$("div[jid='" + user.getJid() + "_" + user.getDomain() + "'] .u-mc", rosterTb).hide();
		},

		__deleteTab = function(user) {
			var index = user,
				prev;
			if (typeof user !== 'string') {
				index = user.toString();
			}
			while (true) {
				prev = privacyChatPanels[index].tab.prev();
				if (prev.length === 0) {
					break;
				}
				if (prev.css("display") !== "none") {
					$("a", prev).trigger("click");
					break;
				}
			}
			if (typeof privacyChatPanels[index] !== "undefined") {
				wasteChatPanels[index] = {};
				wasteChatPanels[index].tab = privacyChatPanels[index].tab;
				wasteChatPanels[index].content = privacyChatPanels[index].content;
				delete privacyChatPanels[index].tab;
				delete privacyChatPanels[index].content;
				wasteChatPanels[index].tab.fadeOut();
				wasteChatPanels[index].content.fadeOut();
			}
			chatTabs.tabs("refresh");
		},
		__destoryPrivacyTab = function(user) {
			var index = user;
			if (typeof user !== 'string') {
				index = user.toString();
			}
			privacyChatPanels[index].tab.remove();
			privacyChatPanels[index].content.remove();
			delete privacyChatPanels[index].tab;
			delete privacyChatPanels[index].content;
			delete privacyChatPanels[index];
		},
		__drawRoster = function(friend) {
			var divNode,
				statusNode,
				user = friend.getVCard().toSimpleUser();
			__addUserInGroups(user.toString(), friend.getGroups());
			// 绘制好友信息并添加到好友列表中
			if ($("div[jid='" + user.getJid() + "_" + user.getDomain() + "']", rosterTb).length === 0) {
				divNode = $("<div class='g-line' jid='" + user.getJid() + "_" + user.getDomain() + "' ></div>").css("opacity", "0.3");
				statusNode = $("<img class='u-status' src='resources/status_offline.png'/>");
				divNode.append(statusNode);
				divNode.append("<div class='u-head'><div><span class='u-mc' style='display:none'></span><img src='resources/defaultHeader.jpg'></div></div>");
				divNode.append("<div class='u-nick'>" + user.toString() + "</div>");
				$(".u-head img", divNode).bind("dblclick", function(event) {
					var vCard = $(this).parent().parent().parent().data("vCard");
					__createTab(vCard.toSimpleUser(), vCard.getNickname());
				}).contextmenu(function(event) {
					var left = event.pageX,
						top = event.pageY,
						vCard = $(this).parent().parent().parent().data("vCard");
					top -= rosterContextMenu.height();
					rosterContextMenu.data("vCard", vCard).css("left", left + "px").css("top", top + "px").fadeIn();
					event.stopPropagation();
					event.preventDefault();
				});
				divNode.data("status", "offline").data("user", user);
				rosterTb.append(divNode);
				Tipped.create($(".u-nick", divNode), user.toString(), {
					skin: "blue",
					target: "mouse",
					hook: "rightmiddle"
				});
				eventProcessor.triggerEvent("connector_vCard_getOtherVCard", [user]);
			}
		},
		__drawRosterDetail = function(vCard) {
			var divNode = $("div[jid='" + vCard.getJid() + "_" + vCard.getDomain() + "']", rosterTb);
			divNode.data("vCard", vCard);
			if (vCard.getHeadPortrait().isExist()) {
				$(".u-head img", divNode).attr("src", vCard.getHeadPortrait().toHtmlString());
			}
			if (vCard.getNickname()) {
				$(".u-nick", divNode).text(vCard.getNickname());
			}
		},
		__deleteRoster = function(user) {
			$("div[jid='" + user.getJid() + "_" + user.getDomain() + "']", rosterTb).remove();
		},
		__printPrivacyMsg = function(message, type) {
			var user = message.getUser(),
				msgBody = message.getMessage(),
				time = message.getTime(),
				index = user.toString(),
				container,
				msgDiv = $("<div></div>"),
				fragment = $("<td></td>"),
				i,
				m,
				msgQueueLength,
				msgCountSpan,
				result = "",
				friendNickname;
			if (typeof privacyChatPanels[index] === "undefined") {
				privacyChatPanels[index] = {
					messageQueue: []
				};
			}
			container = privacyChatPanels[index];
			if (typeof container.content !== "undefined") {
				if (type === 'send') {
					if (selfVCard.getNickname()) {
						result += selfVCard.getNickname();
					} else {
						result += selfVCard.toString();
					}
					fragment.css("float", "right");
					msgDiv.addClass("u-smsg");
				} else {
					friendNickname = friendVCard[user.toString()].getNickname();
					if (friendNickname) {
						result += friendNickname;
					} else {
						result += user.toString();
					}
					fragment.css("float", "left");
					msgDiv.addClass("u-rmsg");
				}
				result += " (" + new Date(message.getTime()).toLocaleTimeString() + ") :";
				result += msgBody;
				msgDiv.text(result);
				fragment.append(msgDiv);
				$("table tbody", container.content).append($("<tr></tr>").append(fragment));
				$(".u-cta", container.content).scrollTop($(".u-cta", container.content)[0].scrollHeight);
			} else {
				container.messageQueue.push({
					type: type,
					message: message
				});
				msgQueueLength = container.messageQueue.length;
				msgCountSpan = $("div[jid='" + user.getJid() + "_" + user.getDomain() + "'] .u-mc", rosterTb);
				if (msgQueueLength > 0) {
					msgCountSpan.text(msgQueueLength).show();
				} else {
					msgCountSpan.text(msgQueueLength).hide();
				}
			}
		},
		__printGroupMsg = function(message) {
			var roomUser = message.getGroupUser(),
				msgBody = message.getMessage(),
				index = roomUser.toRoomString(),
				container,
				msgDiv = $("<div></div>"),
				fragment = $("<td></td>"),
				i,
				m,
				msgQueueLength,
				msgCountSpan,
				result = "";
			if (typeof groupChatPanels[index] === "undefined") {
				groupChatPanels[index] = {
					messageQueue: []
				};
			}
			container = groupChatPanels[index];
			if (typeof container.content !== "undefined") {
				if (roomUser.getNickname() === service.getSelfInRoom(index).getNickname()) {
					fragment.css("float", "right");
					msgDiv.addClass("u-rmsg");
				} else {
					fragment.css("float", "left");
					msgDiv.addClass("u-smsg");
				}
				result += roomUser.getNickname();
				result += " (" + new Date(message.getTime()).toLocaleTimeString() + "):";
				result += msgBody;
				msgDiv.text(result);
				fragment.append(msgDiv);
				$("table tbody", container.content).append($("<tr></tr>").append(fragment));
				$(".u-cta", container.content).scrollTop($(".u-cta", container.content)[0].scrollHeight);
			} else {
				msgCountSpan = $("div[jid='" + user.getJid() + "_" + user.getDomain() + "'] .msgCount", rosterTb);
				if (msgQueueLength > 0) {
					msgCountSpan.text(msgQueueLength).show();
				} else {
					msgCountSpan.text(msgQueueLength).hide();
				}
				//提示消息到来
			}
		},
		__vCardDlgModifyPrepare = function() {
			$("table tbody tr", vCardDialog).each(function() {
				$("td:eq(1)", this).hide();
				$("td:eq(2)", this).show();
			});
			vCardDialog.dialog("option", "buttons", [{
					text: "提交",
					click: __vCardDlgModifySubmit
				}, {
					text: "返回",
					click: __vCardDlgModifyCancel
				}
			]);
		},

		__vCardDlgModifySubmit = function() {
			var vCardTb = $("table tbody tr", vCardDialog),
				newVCard = new VCard({
					sex: $("select", vCardTb).val(),
					desc: $("textarea", vCardTb).val(),
					email: $("input[name='email']", vCardTb).val(),
					tele: $("input[name='tele']", vCardTb).val(),
					bday: $("input[name='bday']", vCardTb).val(),
					nickname: $("input[name='nickname']", vCardTb).val()
				}),
				headPortraitFile = $("input[name='image']", vCardTb).get()[0].files[0];
			if (typeof headPortraitFile !== "undefined") {
				var reader = new FileReader();
				reader.readAsDataURL(headPortraitFile);
				reader.onprogress = function(evt) {
					if (evt.lengthComputable) {
						// evt.loaded and evt.total are ProgressEvent properties
						var loaded = (evt.loaded / evt.total);
						if (loaded < 1) {
							// Increase the prog bar length
							// style.width = (loaded * 200) + "px";
						}
					}
				};
				reader.onload = function(evt) {
					var fileString = evt.target.result,
						binval = /^data:(\w+\/\w+);base64,(.*)/.exec(fileString);
					newVCard.setHeadPortrait(new HeadPortrait({
						type: headPortraitFile.type,
						binval: binval[2]
					}));
					eventProcessor.triggerEvent("service_selfControl_updateMyVCard", [newVCard]);
					__vCardDlgModifyCancel();
				};
				reader.onerror = function(evt) {
					if (evt.target.error.name == "NotReadableError") {
						alert("文件读取失败，请上传正确的文件");
					}
				};
			} else {
				newVCard.setHeadPortrait(new HeadPortrait({}));
				eventProcessor.triggerEvent("service_selfControl_updateMyVCard", [newVCard]);
				__vCardDlgModifyCancel();
			}
		},

		__vCardDlgModifyCancel = function() {
			$("table tbody tr", vCardDialog).each(function() {
				$("td:eq(1)", this).show();
				$("td:eq(2)", this).hide();
			});
			vCardDialog.dialog("option", "buttons", [{
					text: "修改",
					click: __vCardDlgModifyPrepare
				}
			]);
		},
		__initRoomDialogs = function() {
			/*------------创建房间初始化-------------*/
			createRoomDialog.dialog({
				autoOpen: false,
				closeOnEscape: true,
				draggable: true,
				resizable: false,
				modal: false,
				width: 600,
				title: "创建房间",
				show: "fade",
				hide: "fade",
				open: function(event, ui) {
					$("input", createRoomDialog).val("");
					$("textarea", createRoomDialog).val("");
					$("ul", createRoomDialog).html("");
				},
				buttons: [{
						text: "提交",
						click: function(event) {
							var roomConfig,
								oArgs = {
									roomId: $("input[name='roomId']", createRoomDialog).val(),
									roomname: $("input[name='roomname']", createRoomDialog).val(),
									roomdesc: $("textarea[name='roomdesc']").val(),
									enablelogging: $("input[name='enablelogging']").get()[0].checked,
									changesubject: $("input[name='changesubject']").get()[0].checked,
									allowinvites: $("input[name='allowinvites']").get()[0].checked,
									maxusers: $("select[name='maxusers']").val(),
									publicroom: $("input[name='publicroom']").get()[0].checked,
									persistentroom: $("input[name='persistentroom']").get()[0].checked,
									moderatedroom: $("input[name='moderatedroom']").get()[0].checked,
									membersonly: $("input[name='membersonly']").get()[0].checked,
									passwordprotectedroom: $("input[name='passwordprotectedroom']").get()[0].checked,
									roomsecret: $("input[name='roomsecret']").val(),
									whois: $("input[name='whois']").get()[0].checked,
									roomadmins: []
								};

							$("ul[name='roomadmins'] li", createRoomDialog).each(function() {
								oArgs.roomadmins.push($(this).attr("jid"));
							});
							roomConfig = new RoomConfig(oArgs);
							eventProcessor.triggerEvent("service_groupChat_createRoom", roomConfig);
						}
					}
				]
			});
			$("#addAdminBtn", createRoomDialog).click(function(event) {
				var liNode = $("<li></li>"),
					userJid = $("input[name='userJid']", createRoomDialog).val(),
					deleteSpan = $("<span><img src='resources/closeChatPanelIcon.png'/></span>");
				deleteSpan.click(function(event) {
					$(this).parent().remove();
				});
				liNode.attr("jid", userJid).text(userJid);
				liNode.append(deleteSpan);
				$("ul[name='roomadmins']").append(liNode);
				event.stopPropagation();
				event.preventDefault();
			});

			$("input[name='passwordprotectedroom']", createRoomDialog).bind("click", function(event) {
				if (this.checked === false) {
					$("input[name='roomsecret']", createRoomDialog).parent().parent().hide();
				} else {
					$("input[name='roomsecret']", createRoomDialog).parent().parent().show();
				}
			});
			//加入房间对话框
			joinRoomDialog.dialog({
				autoOpen: false,
				closeOnEscape: true,
				draggable: true,
				resizable: false,
				modal: false,
				width: 600,
				title: "加入房间",
				show: "fade",
				hide: "fade",
				open: function(event, ui) {
					$("input", joinRoomDialog).val("");
					if (!service.getRoomInfo(joinRoomDialog.data("roomJid")).getAttribute("passwordprotected")) {
						$("table tbody tr:eq(1)", joinRoomDialog).hide();
					} else {
						$("table tbody tr:eq(1)", joinRoomDialog).show();
						eventProcessor.triggerEvent("service_groupChat_getOldNick", [joinRoomDialog.data("roomJid")]);
					}
				},
				buttons: [{
						text: "确认",
						click: function(event, ui) {
							var roomUser = new RoomUser({
								room: service.getRoomInfo(joinRoomDialog.data("roomJid")),
								nickname: $("input[name='nickname']", joinRoomDialog).val()
							});
							if (!service.getRoomInfo(joinRoomDialog.data("roomJid")).getAttribute("passwordprotected")) {
								eventProcessor.triggerEvent("service_groupChat_joinRoom", [roomUser]);
							} else {
								eventProcessor.triggerEvent("service_groupChat_joinRoom", [roomUser, $("input[name='password']", joinRoomDialog).val()]);
							}
							joinRoomDialog.dialog("close");
						}
					}
				]
			});

			findRoomDialog.dialog({
				autoOpen: false,
				closeOnEscape: true,
				draggable: true,
				resizable: false,
				modal: false,
				width: 600,
				title: "查找房间",
				show: "fade",
				hide: "fade",
				open: function(event, ui) {
					eventProcessor.triggerEvent("service_groupChat_listRoom", []);
				}
			});
		},
		__initSubscribeDialog = function() {
			/*------------订阅对话框初始化-------------*/
			subscribeDialog.dialog({
				autoOpen: false,
				closeOnEscape: true,
				draggable: true,
				resizable: false,
				modal: false,
				width: 800,
				title: "添加好友",
				show: "fade",
				hide: "fade",
				buttons: [{
						text: "申请",
						click: function() {
							var destJid = $("input", subscribeDialog).val();
							if (typeof destJid === "undefined") {
								__noticeError("查找的jid不能为空");
								return;
							}
							eventProcessor.triggerEvent("service_roster_sendSubscribe", [destJid]);
							subscribeDialog.dialog("close");
						}
					}
				],
				open: function(event, ui) {
					$("input", subscribeDialog).val("");
				}
			});
		},
		__initButtonSet = function() {
			/*------------下方按钮初始化------------*/
			$("#subscribeBtn").click(function(event) {
				subscribeDialog.dialog("open");
			});
			$("#optionBtn").click(function(event) {
				vCardDialog.dialog("open");
			});
			$("#chatHistoryBtn").click(function(event) {
				alert("还在开发中...");
			});
			$("#groupChatBtn").click(function(event) {
				$('#groupMenu').slideToggle();
			});
			$("#logoutBtn").click(function(event) {
				rosterTb.html("");
				eventProcessor.triggerEvent("service_selfControl_logout", []);
			});
			$("#createRoomBtn").click(function(event) {
				createRoomDialog.dialog("open");
			});
			$("#joinRoomBtn").click(function(event) {
				findRoomDialog.dialog("open");
			});

			Tipped.create("#subscribeBtn", "添加好友", {
				skin: 'blue'
			});
			Tipped.create("#optionBtn", "个人信息", {
				skin: 'blue'
			});
			Tipped.create("#chatHistoryBtn", "历史记录", {
				skin: 'blue'
			});
			Tipped.create("#groupChatBtn", "群聊", {
				skin: 'blue'
			});
			Tipped.create("#logoutBtn", "退出", {
				skin: 'blue'
			});
			Tipped.create("#createRoomBtn", "创建房间", {
				skin: 'blue'
			});
			Tipped.create("#joinRoomBtn", "加入房间", {
				skin: 'blue'
			});
		},
		__initVCardDialog = function() {
			/*------------头像及个人信息修改初始化------------*/
			$("#myHeader").bind("dblclick", function(event) {
				vCardDialog.dialog("open");
			});
			Tipped.create("#myHeader", "双击打开个人名片", {
				skin: "blue",
				hook: "rightmiddle",
				target: "mouse"
			});
			$("input[name='image']", vCardDialog).bind("change", function(event) {
				var that = $(this),
					file = that.get()[0].files[0];
				if (file.size > 150 * 1024) {
					__noticeError("头像文件不合法：头像大小不能超过150KB");
					that.val("");
					return;
				}
				if (file.type !== "image/gif" && file.type !== "image/jpeg" && file.type !== "image/png" && file.type !== "image/bmp") {
					__noticeError("头像文件不合法：必须为jpg、png、gif或bmp格式");
					that.val("");
					return;
				}
			});

			vCardDialog.dialog({
				autoOpen: false,
				closeOnEscape: true,
				draggable: true,
				resizable: false,
				modal: false,
				title: "个人名片",
				width: 400,
				show: "fade",
				hide: "fade",
				buttons: [{
						text: "修改",
						click: __vCardDlgModifyPrepare
					}
				],
				open: function(event, ui) {
					var dialog = $(this);
					$("table tbody tr", dialog).each(function() {
						$("td:eq(1)", this).show();
						$("td:eq(2)", this).hide();
					});
				}
			});
		},
		__initLoginPanel = function() {
			/*------------登陆初始化------------*/
			$("form", loginDiv).bind("submit", function(event) {
				var username = $("input[name='username']", this).val(),
					password = $("input[name='password']", this).val();
				eventProcessor.triggerEvent("service_selfControl_login", [username, password]);
				event.stopPropagation();
				event.preventDefault();
			});
			/*------------注册初始化------------*/
			$("#registerBtn").bind("click", function(event) {
				registerDialog.dialog("open");
				event.preventDefault();
				event.stopPropagation();
			});
			/*------------注册对话框初始化------*/
			registerDialog.dialog({
				autoOpen: false,
				closeOnEscape: true,
				draggable: true,
				resizable: false,
				modal: false,
				title: "个人名片",
				width: 400,
				show: "fade",
				hide: "fade",
				open: function(event, ui) {
					$("input", this).val("");
				}
			});
			/*----------注册表单提交初始化-------*/
			$("#registerForm").submit(function(event) {
				var username = this.username.value,
					password = this.password.value,
					passRepeat = this.password.value;
				/*表单验证--未完成*/
				eventProcessor.triggerEvent("service_selfControl_register", [username, password]);
				event.preventDefault();
				event.stopPropagation();
			});
		},
		__initChatTabs = function() {
			/*------------tab初始化------------*/
			$("#chatTabs").tabs({});
		},
		__initContextMenus = function() {
			$(document).bind("click", function(event) {
				if (event.button === 0) {
					$(".m-ctm").fadeOut();
				}
			});
		},
		__initMyStatus = function() {
			myStatus.bind("click", function(event) {
				var left = event.pageX,
					top = event.pageY;
				statusContextMenu.css("left", left + "px").css("top", top - statusContextMenu.height() + "px").fadeIn();
				event.stopPropagation();
			});
			Tipped.create("#myStatus", "点击切换在线状态", {
				skin: "blue",
				hook: "rightmiddle",
				target: "mouse"
			});
		},
		__initStatusContextMenu = function() {
			$("li", statusContextMenu).bind("click", function(event) {
				var status = $(this).attr("value");
				eventProcessor.triggerEvent("service_selfControl_changeStatus", [status]);
				myStatus.attr("src", "resources/user-" + status + ".png");
			});
		},
		__initRosterContextMenu = function() {
			$("li[value='delete']", rosterContextMenu).bind("click", function(event) {
				eventProcessor.triggerEvent("service_roster_sendUnsubscribe", [rosterContextMenu.data("vCard")]);
			});
			$("li[value='info']", rosterContextMenu).bind("click", function(event) {
				rosterVCardDialog.data("vCard", rosterContextMenu.data("vCard"));
				rosterVCardDialog.dialog("close");
				rosterVCardDialog.dialog("open");
			});
			$("li[value='chat']", rosterContextMenu).bind("click", function(event) {
				var vCard = rosterContextMenu.data("vCard");
				__createTab(vCard.toSimpleUser(), vCard.getNickname());
			});
			$("li[value='group']", rosterContextMenu).bind("click", function(event) {
				rosterGroupDialog.data("vCard", rosterContextMenu.data("vCard")).dialog("open");
			});
		},
		__initRosterGroupDialog = function() {
			/*-----------初始化分组对话框-------------*/
			rosterGroupDialog.dialog({
				autoOpen: false,
				closeOnEscape: true,
				draggable: true,
				resizable: false,
				modal: false,
				title: "好友分组",
				width: 400,
				show: "fade",
				hide: "fade",
				open: function(event, ui) {
					var vCard = $(this).data("vCard"),
						groupName,
						groupList = $("ul", this);
					$("strong", this).text("要将 " + vCard.getNickname() + "(" + vCard.toString() + ") 加入哪些分组？");
					groupList.html("");
					for (groupName in groups) {
						if (groups.hasOwnProperty(groupName)) {
							if (groupName !== "noGroup") {
								groupList.append("<li>" + groupName + "<input type='checkbox' name='" + groupName + "'/></li>");
							}
						}
					}
				}
			});
			/*------------分组新建按钮初始化---------------*/
			$("#groupCreateBtn").bind("click", function() {
				__prompt("请填入需要新的分组名称：", function(groupName) {
					$("ul", rosterGroupDialog).append("<li>" + groupName + "<input type='checkbox' name='" + groupName + "'/></li>");
				}, function() {});
				event.stopPropagation();
				event.preventDefault();
			});
			/*-----------分组表单初始化----------------*/
			$("#groupForm").submit(function(event) {
				var groupList = [];
				$("ul input[type=checkbox]", this).each(function() {
					if (this.checked) {
						groupList.push($(this).attr("name"));
					}
				});
				eventProcessor.triggerEvent("service_roster_changeGroup", [new Friend({
						vCard: rosterGroupDialog.data("vCard"),
						groups: groupList
					})]);
				event.stopPropagation();
				event.preventDefault();
			});
		},
		__displayRosterAsGroupFun = function(groupName, tag) {
			return function() {
				$("#changeGroupBtn").text(tag);
				$("div.g-line", rosterTb).each(function() {
					var that = $(this),
						user = that.data("user");
					console.log(groups[groupName][user.toString()]);
					if (typeof groups[groupName][user.toString()] !== "undefined") {
						that.show();
					} else {
						that.hide();
					}
				});
			};
		},
		__initChangeGroupMenu = function() {
			$("ul li[value='all']", changeGroupMenu).bind("click", function() {
				$("div.g-line", rosterTb).show();
				$("#changeGroupBtn").text("全部好友");
			});
			$("ul li[value='online']", changeGroupMenu).bind("click", function() {
				$("div.g-line", rosterTb).each(function() {
					var that = $(this),
						status = that.data("status");
					if (status === "online") {
						that.show();
					} else {
						that.hide();
					}
					$("#changeGroupBtn").text("在线好友");
				});
			});
			// $("ul li[value='noGroup']", changeGroupMenu).bind("click", __displayRosterAsGroupFun("noGroup"));
			$("#changeGroupBtn").bind("click", function(event) {
				var left = event.pageX,
					top = event.pageY,
					groupName,
					liNode;
				$("ul li", changeGroupMenu).each(function() {
					var that = $(this);
					if (that.attr("value") !== "all" && that.attr("value") !== "online") {
						that.remove();
					}
				});
				for (groupName in groups) {
					if (groups.hasOwnProperty(groupName)) {
						if (groupName === "noGroup") {
							liNode = $("<li value='" + groupName + "'>未分组</li>");
							liNode.bind("click", __displayRosterAsGroupFun("noGroup", "未分组"));
						} else {
							liNode = $("<li value='" + groupName + "'>" + groupName + "</li>");
							liNode.bind("click", __displayRosterAsGroupFun(groupName, groupName));
						}
						$("ul", changeGroupMenu).append(liNode);
					}
				}
				changeGroupMenu.css("left", left + "px").css("top", top - changeGroupMenu.height() + "px").fadeIn();
				event.stopPropagation();
				event.preventDefault();
			});
			Tipped.create("#changeGroupBtn", "点击切换分组", {
				skin: "blue",
				hook: "rightmiddle",
				target: "mouse"
			});
		},
		__initSideBar = function() {
			var clientHeight = document.body.clientHeight;
			rosterTb.css("height", clientHeight - 300 + "px");
		},
		/*<!-- "<tr><td>JID</td><td>" + index + "</td></tr>" +
          "<tr><td>昵称</td><td>" + vCard.getNickname() + "</td></tr>" +
          "<tr><td>性别</td><td>" + vCard.getSex() + "</td></tr>" +
          "<tr><td>生日</td><td>" + vCard.getBirthday() + "</td></tr>" +
          "<tr><td>邮箱</td><td>" + vCard.getEmail() + "</td></tr>" +
          "<tr><td>手机</td><td>" + vCard.getTelephone() + "</td></tr>" +
          "<tr><td>自我描述</td><td>" + vCard.getDescription() + "</td></tr>" -->*/
		__initRosterVCardDialog = function() {
			rosterVCardDialog.dialog({
				autoOpen: false,
				closeOnEscape: true,
				draggable: true,
				resizable: false,
				modal: false,
				width: 400,
				show: "fade",
				hide: "fade",
				open : function(event, ui){
					var that = $(this),
						vCard = that.data("vCard"),
						tbody = $("table tbody", rosterVCardDialog);
					$("td[name='jid']", tbody).text(vCard.toString());
					$("td[name='nickname']", tbody).text(vCard.getNickname());
					$("td[name='sex']", tbody).text(vCard.getSex());
					$("td[name='birthday']", tbody).text(vCard.getBirthday());
					$("td[name='email']", tbody).text(vCard.getEmail());
					$("td[name='telephone']", tbody).text(vCard.getTelephone());
					$("td[name='desc']", tbody).text(vCard.getDescription());
					if(vCard.getNickname()){
						rosterVCardDialog.dialog("option","title",vCard.getNickname() + "的个人信息");
					} else {
						rosterVCardDialog.dialog("option","title",vCard.toString()  + "的个人信息");
					}
				}
			});
		},
		__noticeError = function(msg) {
			alertify.error(msg);
		},
		__noticeSuccess = function(msg) {
			alertify.success(msg);
		},
		__confirm = function(msg, fnOk, fnCancel) {
			alertify.confirm(msg, function(e) {
				if (e) {
					fnOk.call(this);
				} else {
					fnCancel.call(this);
				}
			});
		},
		__prompt = function(msg, fnOk, fnCancel) {
			alertify.prompt(msg, function(e, str) {
				if (e) {
					fnOk.call(this, str);
				} else {
					fnCancel.call(this, str);
				}
			});
		};

	(function() {
		__initSideBar();
		__initChatTabs();
		__initLoginPanel();
		__initVCardDialog();
		__initButtonSet();
		__initSubscribeDialog();
		__initRoomDialogs();
		__initGroupUserContextMenu();
		__initGroupConfigContextMenu();
		__initOutcastDialog();
		__initContextMenus();
		__initMyStatus();
		__initStatusContextMenu();
		__initRosterContextMenu();
		__initRosterGroupDialog();
		__initChangeGroupMenu();
		__initRosterVCardDialog();
	}());

	eventProcessor.bindEvent({
		viewer_logouted: function(event) {
			var index;
			mainDiv.slideUp();
			loginDiv.slideDown();
			for (index in privacyChatPanels) {
				if (Object.prototype.hasOwnProperty.apply(privacyChatPanels, [index])) {
					__destoryPrivacyTab(index);
				}
			}
			privacyChatPanels = {};
			for (index in groupChatPanels) {
				if (Object.prototype.hasOwnProperty.apply(groupChatPanels, [index])) {
					__destoryRoomChatTab(index);
				}
			}
			groupChatPanels = {};
			rosterTb.html("");
			myStatus.attr("src", "resources/user-chat.png");
			$(".dialog").dialog("close");
		},
		viewer_logined: function(event) {
			loginDiv.slideUp();
			mainDiv.slideDown();
			registerDialog.dialog("close");
		},
		viewer_drawRoster: function(event, friend) {
			__drawRoster(friend);
		},
		viewer_drawRosterDetail: function(event, vCard) {
			friendVCard[vCard.toString()] = vCard;
			__drawRosterDetail(vCard);
		},
		viewer_removeRoster: function(event, user) {
			__deleteRoster(user);
		},
		viewer_setRosterUnavailable: function(event, user) {
			var userDiv = $("div[jid='" + user.getJid() + "_" + user.getDomain() + "']", rosterTb);
			userDiv.data("status", "offline");
			$(".u-status", userDiv).attr("src", "resources/status_offline.png");
			rosterTb.append($("div[jid='" + user.getJid() + "_" + user.getDomain() + "']", rosterTb).css("opacity", "0.3"));
		},
		viewer_setRosterAvailable: function(event, user, presence) {
			var userDiv = $("div[jid='" + user.getJid() + "_" + user.getDomain() + "']", rosterTb);
			userDiv.data("status", "online");
			if (typeof presence.getShow() !== "undefined" && presence.getShow() !== "") {
				$(".u-status", userDiv).attr("src", "resources/status_" + presence.getShow() + ".png");
			} else {
				$(".u-status", userDiv).attr("src", "resources/status_chat.png");
			}
			rosterTb.prepend(userDiv.css("opacity", "1"));
		},
		viewer_privacyPrintMsg: function(event, message, type) {
			__printPrivacyMsg(message, type);
		},
		viewer_groupPrintMsg: function(event, message) {
			__printGroupMsg(message);
		},
		viewer_noticeError: function(event, msg) {
			__noticeError(msg);
		},
		viewer_noticeSuccess: function(event, msg) {
			__noticeSuccess(msg);
		},
		viewer_confirm: function(event, msg, fnOk, fnCancel) {
			__confirm(msg, fnOk, fnCancel);
		},
		viewer_prompt: function(event, msg, fnOk, fnCancel) {
			__prompt(msg, fnOk, fnCancel);
		},
		viewer_drawVCard: function(event, vCard) {
			var trs = $("table tbody tr", vCardDialog.data("vCard", vCard)),
				i,
				type,
				curNode;
			for (i = trs.length; i--;) {
				type = $(trs[i]).attr("itemType");
				if (type === 'sex') {
					if (vCard.getSex() === 'male') {
						$("td:eq(1)", trs[i]).text("男");
						$("td:eq(2) option:eq(0)", trs[i]).attr("selected", true);
					} else if (vCard.getSex() === 'female') {
						$("td:eq(1)", trs[i]).text("女");
						$("td:eq(2) option:eq(1)", trs[i]).attr("selected", true);
					} else {
						$("td:eq(1)", trs[i]).text("未填写");
					}
				} else if (type === 'bday') {
					$("td:eq(1)", trs[i]).text(vCard.getBirthday());
					$("td:eq(2) input", trs[i]).val(vCard.getBirthday());
				} else if (type === 'desc') {
					$("td:eq(1)", trs[i]).text(vCard.getDescription());
					$("td:eq(2) textarea", trs[i]).val(vCard.getDescription());
				} else if (type === 'tele') {
					$("td:eq(1)", trs[i]).text(vCard.getTelephone());
					$("td:eq(2) input", trs[i]).val(vCard.getTelephone());
				} else if (type === 'email') {
					$("td:eq(1)", trs[i]).text(vCard.getEmail());
					$("td:eq(2) input", trs[i]).val(vCard.getEmail());
				} else if (type === 'nickname') {
					$("td:eq(1)", trs[i]).text(vCard.getNickname());
					$("td:eq(2) input", trs[i]).val(vCard.getNickname());
				} else if (type === 'photo') {
					curNode = $("td:eq(1)", trs[i]);
					if ($("img", curNode).length === 0) {
						curNode.append("<img width=90 height=90/>");
					}
					if (vCard.getHeadPortrait().isExist()) {
						$("img", curNode).attr("src", vCard.getHeadPortrait().toHtmlString());
					} else {
						$("img", curNode).attr("src", "resources/defaultHeader.jpg");
					}
				}
			}
			if (vCard.getNickname()) {
				$("#myNameAndHeader h3").text(vCard.getNickname());
			} else {
				$("#myNameAndHeader h3").text(vCard.toString());
			}
			Tipped.create("#myNameAndHeader h3", vCard.toString(), {
				skin: "blue",
				hook: "rightmiddle",
				target: "mouse"
			});
			if (vCard.getHeadPortrait().isExist()) {
				$("#myHeader").attr("src", vCard.getHeadPortrait().toHtmlString());
			} else {
				$("#myHeader").attr("src", "resources/defaultHeader.jpg");
			}
			selfVCard = vCard;
		},
		viewer_listRoom: function(event, roomList) {
			console.log(roomList);
			try {
				var newNodesStr = "",
					i;
				for (i = roomList.length; i--;) {
					newNodesStr += "<tr><td>" + roomList[i].getRoomName() + "</td><td><button roomJid='" + roomList[i].toString() + "' class='btn btn-primary'>进入</button></td></tr>";
				}
				$("tbody", findRoomDialog).html("").append(newNodesStr);
				$("tbody button", findRoomDialog).bind("click", function(event) {
					joinRoomDialog.data("roomJid", $(this).attr("roomJid")).dialog("open");
					findRoomDialog.dialog("close");
				});
			} catch (e) {
				console.log(e.message);
			}
		},
		viewer_drawRoomDetail: function(event, room) {
			if (room.getAttribute("passwordprotected")) {
				$("button[roomJid='" + room.toString() + "']", findRoomDialog).parent().prepend("<img src='resources/msgWarnIcon.png'/>");
			}
		},
		viewer_drawRoomChatTab: function(event, room) {
			__drawRoomChatTab(room);
			eventProcessor.triggerEvent("connector_groupChat_addBookmark",[room.toString(), room, selfVCard.getNickname(), false]);
		},
		viewer_deleteRoomChatTab: function(event, room) {
			__destoryRoomChatTab(room);
		},
		viewer_drawRoomUser: function(evnet, roomUser) {
			__drawRoomUser(roomUser);
		},
		viewer_deleteRoomUser: function(event, roomUser) {
			__deleteRoomUser(roomUser);
		},
		viewer_drawOutcastList: function(event, outcastUserList, room) {
			var tbody = $("tbody", outcastDialog),
				i,
				user,
				trNode;
			tbody.html("");
			if (outcastUserList.length === 0) {
				tbody.append("<tr><td colspan=2>没有人被加入黑名单</td></tr>");
				outcastDialog.dialog("open");
				return;
			}
			for (i = outcastUserList.length; i--;) {
				user = outcastUserList[i];
				outcastDialog.dialog("option", "title", room.getRoomName());
				trNode = $("<tr roomJid='" + room.toString() + "' jid='" + user.toString() + "'><td>" + user.toString() + "</td><td><button class='btn btn-danger'>删除</button></td></tr>");
				$("button", trNode).data({
					jid: user.toString(),
					roomJid: room.toString()
				});
				tbody.append(trNode);
			}
			$("button", tbody).click(function(event) {
				eventProcessor.triggerEvent("service_groupChat_deleteOutcast", [$(this).data("jid"), $(this).data("roomJid")]);
			});
			outcastDialog.dialog("open");
		},
		viewer_setOldNick: function(event, roomInfo, oldNick) {
			$("input[name='nickname']", joinRoomDialog).val(oldNick);
		},
		viewer_removeOutcast: function(event, userJid, roomJid) {
			$("tr[jid='" + userJid + "']", outcastDialog).remove();
		},
		viewer_createdRoom: function(event, roomConfig) {
			__noticeSuccess("创建房间" + roomConfig.getAttribute("roomname") + "成功");
			createRoomDialog.dialog("close");
		},
		viewer_changedGroup: function(event, friend) {
			__deleteUserInGroups(friend.getVCard().toString());
			__addUserInGroups(friend.getVCard().toString(), friend.getGroups());
			rosterGroupDialog.dialog("close");
			__noticeSuccess("分组修改成功");
		}
	});
}(jQuery, window));