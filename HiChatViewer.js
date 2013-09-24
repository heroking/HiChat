HICHAT.namespace("HICHAT.viewer");
HICHAT.viewer = (function($, window) {
	var eventProcessor = HICHAT.utils.eventProcessor,
		validator = HICHAT.utils.Validator,
		service = HICHAT.service,
		config = HICHAT.config,
		emotions = HICHAT.emotions,

		Room = HICHAT.model.Room,
		RoomUser = HICHAT.model.RoomUser,
		RoomConfig = HICHAT.model.RoomConfig,
		NewVCard = HICHAT.model.VCard,
		WorkInfo = HICHAT.model.WorkInfo,
		HomeInfo = HICHAT.model.HomeInfo,
		PersonalInfo = HICHAT.model.PersonalInfo,
		HeadPortrait = HICHAT.model.HeadPortrait,
		Friend = HICHAT.model.Friend,
		Message = HICHAT.model.Message,
		GroupMessage = HICHAT.model.GroupMessage,
		Bookmark = HICHAT.model.Bookmark,

		friends = {},
		rooms = {},
		groups = {
			"noGroup": {}
		},
		selfVCard,
		privacyChatPanels = {},
		groupChatPanels = {},
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
		addBookmarkDialog = $("#addBookmarkDialog"),
		bookmarkDialog = $("#bookmarkDialog"),
		aboutDialog = $("#aboutDialog"),
		groupUserContextMenu = $("#groupUserContextMenu"),
		groupConfigContextMenu = $("#groupConfigContextMenu"),
		rosterContextMenu = $("#rosterContextMenu"),
		statusContextMenu = $("#statusContextMenu"),
		mainPageContextMenu = $("#mainPageContextMenu"),
		changeGroupMenu = $("#changeGroupMenu"),
		emotionsPanel = $("#emotionsPanel"),
		/*初始化表情面板*/
		__initEmotionsPanel = function() {
			var emotion,
				imgNode,
				divNode,
				__emotionClickFun = function(event) {
					var jid = emotionsPanel.data("jid"),
						that = $("img" ,this),
						textarea;
					if (typeof privacyChatPanels[jid] !== "undefined") {
						textarea = $(".s-sd textarea", privacyChatPanels[jid].content);
						textarea.val(textarea.val() + that.data("emoStr"));
					} else if (typeof groupChatPanels[jid] !== "undefined") {
						textarea = $(".s-sd textarea", groupChatPanels[jid].content);
						textarea.val(textarea.val() + that.data("emoStr"));
					}
					event.stopPropagation();
					event.preventDefault();
				};
			for (emotion in emotions) {
				divNode = $("<div class='u-emoic'></div>");
				imgNode = $("<img src='resources/emotions/" + emotion + "' />").data("emoStr", emotions[emotion].emoStr);
				divNode.append(imgNode).click(__emotionClickFun);
				emotionsPanel.append(divNode);
			}
		},
		/*初始化关于对话框*/
		__initAboutDialog = function() {
			aboutDialog.dialog({
				title: "关于我们",
				autoOpen: false,
				closeOnEscape: true,
				draggable: true,
				resizable: false,
				modal: false,
				width: 800,
				show: "fade",
				hide: "fade"
			});
		},
		/*将用于显示的消息内的表情符号转化为表情图片*/
		__genEmotionMsg = function(message) {
			var emotion;
			for (emotion in emotions) {
				message = message.replace(new RegExp(emotions[emotion].regexp, "g"), "<img src='resources/emotions/" + emotion + "' />");
			}
			return message;
		},
		/*初始化主页面菜单栏*/
		__initMainPageContextMenu = function() {
			/*主页右键单击显示*/
			$(document).contextmenu(function(event) {
				var left = event.pageX,
					top = event.pageY - mainPageContextMenu.height();
				mainPageContextMenu.css({
					left: left + "px",
					top: top + "px"
				}).fadeIn();
				event.preventDefault();
				event.stopPropagation();
			});
			/*我的名片选项*/
			$("li[value='myInfo']", mainPageContextMenu).bind("click", function(event) {
				vCardDialog.dialog("open");
			});
			/*关闭当前聊天窗口*/
			$("li[value='closeCur']", mainPageContextMenu).bind("click", function(event) {
				var curIndex = chatTabs.tabs("option", "active"),
					liNode = $($("li", chatTabUl)[curIndex]);
				if (curIndex === false) {
					return;
				}
				if (liNode.css("display") !== "none") {
					$("a span img", liNode).trigger("click");
				}
			});
			/*关闭所有聊天窗口*/
			$("li[value='closeAll']", mainPageContextMenu).bind("click", function(event) {
				var index;
				for (index in privacyChatPanels) {
					if (Object.prototype.hasOwnProperty.apply(privacyChatPanels, [index])) {
						__deleteTab(index);
					}
				}
				for (index in groupChatPanels) {
					if (Object.prototype.hasOwnProperty.apply(groupChatPanels, [index])) {
						eventProcessor.triggerEvent("service_groupChat_leaveRoom", rooms[index].getRoom());
						__deleteRoomChatTab(index);
					}
				}
			});
			/*开启配置窗口，未完成*/
			$("li[value='config']", mainPageContextMenu).bind("click", function(event) {
				alert("功能开发中...");
			});
			/*开启关于窗口*/
			$("li[value='about']", mainPageContextMenu).bind("click", function(event) {
				aboutDialog.dialog("open");
			});
			/*用户登出*/
			$("li[value='logout']", mainPageContextMenu).bind("click", function(event) {
				rosterTb.html("");
				eventProcessor.triggerEvent("service_selfControl_logout");
			});
		},
		/*从分组中删除用户*/
		__deleteUserInGroups = function(jid) {
			var groupName;
			for (groupName in groups) {
				if (groups.hasOwnProperty(groupName) && typeof groups[groupName][jid] !== "undefined") {
					delete groups[groupName][jid];
				}
			}
		},
		/*在分组冲添加用户*/
		__addUserInGroups = function(jid, groupList) {
			var i;
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
		/*初始化黑名单对话框*/
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
		/*初始化群聊个人菜单栏*/
		__initGroupConfigContextMenu = function() {
			$("li[name='changeConfig']", groupConfigContextMenu).click(function(event) {});
			$("li[name='getOutcastList']", groupConfigContextMenu).click(function(event) {
				eventProcessor.triggerEvent("service_groupChat_getOutcastList", [groupConfigContextMenu.data("roomJid")]);
			});
			$("li[name='deleteRoom']", groupConfigContextMenu).click(function(event) {
				eventProcessor.triggerEvent("service_groupChat_deleteRoom", [groupConfigContextMenu.data("roomJid")]);
			});
			$("li[name='addBookmark']", groupConfigContextMenu).click(function(event) {
				addBookmarkDialog.data("roomJid", groupConfigContextMenu.data("roomJid")).dialog("open");
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
		/*
			显示群聊个人配置菜单栏
				根据用户权限的不同，显示不同的功能项
		*/
		__showGroupConfigContextMenu = function(selfAffailiation, roomJid, left, top) {
			$("li", groupConfigContextMenu).show();
			if (selfAffailiation !== 'owner') {
				$("li[affiliation='owner']", groupConfigContextMenu).hide();
			}
			if (selfAffailiation !== 'admin' && selfAffailiation !== 'owner') {
				$("li[affiliation='admin']", groupConfigContextMenu).hide();
			}
			groupConfigContextMenu.data("roomJid", roomJid).css({
				left: left + "px",
				top: top - groupConfigContextMenu.height() + "px"
			}).fadeIn();
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
			groupUserContextMenu.data(idArgs).css({
				left: left + "px",
				top: top - groupUserContextMenu.height() + "px"
			}).fadeIn();
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
						//selfUser = service.getSelfInRoom(roomJid),
						selfUser = rooms[roomJid],
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
						selfUser = rooms[roomJid],
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
		__drawRoomChatTab = function(room, users) {
			var index = room.toString(),
				newTab,
				newContent,
				chatPanel,
				chatTextArea,
				sendBtn,
				emotionBtn,
				sendTextArea,
				sendDiv,
				groupMemberDiv,
				closeChatPanelSpan,
				dropupDiv,
				memberUl,
				members,
				i,
				m,
				userJid;

			if (typeof groupChatPanels[index] === "undefined") {
				groupChatPanels[index] = {
					messageQueue: []
				};
			}

			if (typeof groupChatPanels[index].content === "undefined") {
				if (typeof wasteChatPanels[index] === "undefined") {
					newTab = $("<li><a href='#chatPanel_" + room.getRoomId() + "_" + room.getGroupChatResource() + "_" + room.getDomain() + "'>" + room.getRoomName() + "<span><img src='resources/closeChatPanelIcon.png'></span></a></li>");
					newTab.attr("jid", index).data({
						type: "room",
						jid: index
					});
					chatTabUl.append(newTab);
					chatTextArea = $("<div class='u-cta'><table><thead></thead><tbody></tbody></table></div>").css("max-height", $("body").height() - 150 + "px");
					sendTextArea = $("<textarea></textarea>").bind("keypress", function(event) {
						if (event.ctrlKey && event.which === 13 || event.which === 10) {
							$(".u-sbtn", $(this).parent()).trigger("click");
						}
					});
					sendBtn = $("<button class='btn btn-success u-sbtn'>发送</button>").data("roomJid", room.toString()).bind("click", function(event) {
						var room = rooms[$(this).data("roomJid")].getRoom(),
							msgBody = $("textarea", $(this).parent()).val().trim();
						if (msgBody === "") {
							return;
						}
						eventProcessor.triggerEvent("service_groupChat_groupSendMsg", [new GroupMessage({
								groupUser: rooms[index],
								message: msgBody
							})]);
						$("textarea", $(this).parent()).focus().val("");
					});
					emotionBtn = $("<span class='u-emo'><img src='resources/emotionIcon.png'/></span>").data("jid", index).click(function(event) {
						var that = $(this),
							left = event.pageX,
							top = event.pageY - emotionsPanel.height();
						emotionsPanel.data("jid", that.data("jid")).css({
							left : left + "px",
							top : top + "px"
						}).fadeIn();
						event.stopPropagation();
						event.preventDefault();
					});
					memberUl = $("<ul class='dropdown-menu pull-right' roomJid='" + index + "'></ul>");
					dropupDiv = $("<div style='margin-left:50px' class='u-mdu'></div>")
						.data("member", 0)
						.addClass("btn-group dropup")
						.append("<button class='btn btn-success u-mc'></button>")
						.append("<button class='btn btn-success dropdown-toggle' data-toggle='dropdown' style='padding:5px 12px 12px 12px'><span class='caret'></span></button>")
						.append(memberUl);
					$(".u-mc", dropupDiv).data({
						roomJid: index,
						// selfAffailiation: service.getSelfInRoom(index).getAffiliation()
						selfAffailiation: rooms[index].getAffiliation()
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

					sendDiv = $("<div class='u-sd s-sd'></div>").append(sendTextArea).append(sendBtn).append(emotionBtn).append(dropupDiv);
					chatPanel = $("<div class='m-cp'></div>").css("height", $("body").height() - 150 + "px").append(chatTextArea).append(sendDiv);
					newContent = $("<div id='chatPanel_" + room.getRoomId() + "_" + room.getGroupChatResource() + "_" + room.getDomain() + "'></div>").append(chatPanel);
					newContent.attr("jid", index);
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
				for (userJid in users) {
					if (users.hasOwnProperty(userJid)) {
						__drawRoomUser(users[userJid]);
					}
				}
				$(".u-cta table tbody", groupChatPanels[index].content).html("");
			} else {
				$("a", groupChatPanels[index].tab).tab('show');
			}
		},
		__deleteRoomChatTab = function(room) {
			var index = room,
				prev;
			if (typeof room !== 'string') {
				index = room.toString();
			}
			if (typeof groupChatPanels[index] !== "undefined") {
				wasteChatPanels[index] = groupChatPanels[index];
				$(".u-mdu ul li", wasteChatPanels[index].content).remove();
				delete groupChatPanels[index];
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
		__createTab = function(user) {
			var index = user.toString(),
				tag,
				newTab,
				newContent,
				chatPanel,
				chatTextArea,
				sendBtn,
				sendTextArea,
				sendDiv,
				emotionBtn,
				closeChatPanelSpan,
				i,
				m;
			tag = friends[index].getTag() || user.getJid();
			if (typeof privacyChatPanels[index] === "undefined") {
				privacyChatPanels[index] = {
					messageQueue: []
				};
			}

			if (typeof privacyChatPanels[index].content === "undefined") {
				if (typeof wasteChatPanels[index] === "undefined") {
					newTab = $("<li><a href='#chatPanel_" + user.getJid() + "_" + user.getDomain() + "'>" + tag + "<span><img src='resources/closeChatPanelIcon.png'></span></a></li>");
					newTab.attr("jid", index).data({
						type: "privacy",
						jid: index
					});
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
					emotionBtn = $("<span class='u-emo'><img src='resources/emotionIcon.png'/></span>").data("jid", index).click(function(event) {
						var that = $(this),
							left = event.pageX,
							top = event.pageY - emotionsPanel.height();
						emotionsPanel.data("jid", that.data("jid")).css({
							left : left + "px",
							top : top + "px"
						}).fadeIn();
						event.stopPropagation();
						event.preventDefault();
					});
					sendDiv = $("<div class='u-sd s-sd'></div>").append(sendTextArea).append(sendBtn).append(emotionBtn);
					chatPanel = $("<div class='m-cp'></div>").css("height", $("body").height() - 150 + "px").append(chatTextArea).append(sendDiv);
					newContent = $("<div id='chatPanel_" + user.getJid() + "_" + user.getDomain() + "'></div>").append(chatPanel);
					newContent.attr("jid", index);
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
			privacyChatPanels[index].messageQueue = [];
			$("div[jid='" + user.getJid() + "_" + user.getDomain() + "'] .u-mc", rosterTb).hide();
		},
		__deleteTab = function(user) {
			var index = user,
				prev;
			if (typeof user !== 'string') {
				index = user.toString();
			}
			if (typeof privacyChatPanels[index] !== "undefined") {
				wasteChatPanels[index] = privacyChatPanels[index];
				delete privacyChatPanels[index];
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
		__destoryWastedChatTab = function(user) {
			var index = user;
			if (typeof user !== 'string') {
				index = user.toString();
			}
			wasteChatPanels[index].tab.remove();
			wasteChatPanels[index].content.remove();
			delete wasteChatPanels[index].tab;
			delete wasteChatPanels[index].content;
			delete wasteChatPanels[index];
		},
		__drawRoster = function(friend) {
			var divNode,
				statusNode,
				user = friend.getVCard().toSimpleUser();
			__addUserInGroups(user.toString(), friend.getGroups());
			if ($("div[jid='" + user.getJid() + "_" + user.getDomain() + "']", rosterTb).length === 0) {
				divNode = $("<div class='g-line' jid='" + user.getJid() + "_" + user.getDomain() + "' ></div>").css("opacity", "0.3");
				statusNode = $("<img class='u-status' src='resources/status_offline.png'/>");
				divNode.append(statusNode);
				divNode.append("<div class='u-head'><div><span class='u-mc' style='display:none'></span><img src='resources/defaultHeader.jpg'></div></div>");
				if (friend.getTag()) {
					divNode.append("<div class='u-nick'>" + friend.getTag() + "</div>");
				} else {
					divNode.append("<div class='u-nick'>" + user.getJid() + "</div>");
				}
				$(".u-head img", divNode).bind("dblclick", function(event) {
					var vCard = friends[$(this).parent().parent().parent().data("jid")].getVCard();
					__createTab(vCard.toSimpleUser(), vCard.getPersonalInfo().getNickname());
				}).contextmenu(function(event) {
					var left = event.pageX,
						top = event.pageY,
						vCard = friends[$(this).parent().parent().parent().data("jid")].getVCard();
					top -= rosterContextMenu.height();
					rosterContextMenu.data("jid", vCard.toString()).css("left", left + "px").css("top", top + "px").fadeIn();
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
				__blockElement(divNode, "加载中..");
				eventProcessor.triggerEvent("service_roster_getOtherVCard", [user]);
			}
		},
		__drawRosterDetail = function(vCard) {
			var divNode = $("div[jid='" + vCard.getJid() + "_" + vCard.getDomain() + "']", rosterTb);
			divNode.data("jid", vCard.toString());
			if (vCard.hasHeadPortrait()) {
				$(".u-head img", divNode).attr("src", vCard.getHeadPortrait().toHtmlString());
			}
			/*if (vCard.getPersonalInfo().getNickname()) {
				$(".u-nick", divNode).text(vCard.getPersonalInfo().getNickname());
			}*/
			__unBlockElement(divNode);
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
					if (selfVCard.getPersonalInfo().getNickname()) {
						result += selfVCard.getPersonalInfo().getNickname();
					} else {
						result += selfVCard.getJid();
					}
					fragment.css("float", "right");
					msgDiv.addClass("u-smsg");
				} else {
					friendNickname = friends[user.toString()].getVCard().getPersonalInfo().getNickname();
					if (friendNickname) {
						result += friendNickname;
					} else {
						result += user.getJid();
					}
					fragment.css("float", "left");
					msgDiv.addClass("u-rmsg");
				}
				if (new Date(message.getTime()).toDateString() === new Date().toDateString()) {
					result += " (" + new Date(message.getTime()).toLocaleTimeString() + ") : ";
				} else {
					result += " (" + new Date(message.getTime()).toLocaleString() + ") : ";
				}
				result += __genEmotionMsg(msgBody.htmlDecode());
				console.log(result);
				msgDiv[0].innerHTML = result;
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
				//if (roomUser.getNickname() === service.ge1tSelfInRoom(index).getNickname()) {
				if (roomUser.getNickname() === rooms[index].getNickname()) {
					fragment.css("float", "right");
					msgDiv.addClass("u-rmsg");
				} else {
					fragment.css("float", "left");
					msgDiv.addClass("u-smsg");
				}
				result += roomUser.getNickname();
				if (new Date(message.getTime()).toDateString() === new Date().toDateString()) {
					result += " (" + new Date(message.getTime()).toLocaleTimeString() + ") : ";
				} else {
					result += " (" + new Date(message.getTime()).toLocaleString() + ") : ";
				}
				result += __genEmotionMsg(msgBody.htmlDecode());
				msgDiv[0].innerHTML = result;
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
					$("input[name=nickname]", joinRoomDialog).val(selfVCard.getJid());
					if (!rooms[joinRoomDialog.data("roomJid")].getRoom().getAttribute("passwordprotected")) {
						$("table tbody tr:eq(1)", joinRoomDialog).hide();
					} else {
						$("table tbody tr:eq(1)", joinRoomDialog).show();
						//eventProcessor.triggerEvent("service_groupChat_getOldNick", [joinRoomDialog.data("roomJid")]);
					}
				},
				buttons: [{
						text: "确认",
						click: function(event, ui) {
							var roomUser = new RoomUser({
								room: rooms[joinRoomDialog.data("roomJid")].getRoom(),
								nickname: $("input[name='nickname']", joinRoomDialog).val()
							});
							if (!rooms[joinRoomDialog.data("roomJid")].getRoom().getAttribute("passwordprotected")) {
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
					__blockElement(findRoomDialog, "查找房间中...");
					eventProcessor.triggerEvent("service_groupChat_listRoom");
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
							if (!destJid) {
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
				eventProcessor.triggerEvent("service_selfControl_logout");
			});
			$("#createRoomBtn").click(function(event) {
				createRoomDialog.dialog("open");
			});
			$("#joinRoomBtn").click(function(event) {
				findRoomDialog.dialog("open");
			});
			$("#bookmarkBtn").click(function(event) {
				bookmarkDialog.dialog("open");
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
			Tipped.create("#bookmarkBtn", "我的书签", {
				skin: 'blue'
			});
		},
		__initVCardDialog = function() {
			var __vCardDlgModifySave = function() {
				var vCardForm = $("#vCardForm", vCardDialog).get()[0],
					vCard;
				vCard = new NewVCard({
					homeInfo: new HomeInfo({
						street: vCardForm.home_street.value,
						city: vCardForm.home_city.value,
						province: vCardForm.home_province.value,
						postCode: vCardForm.home_postCode.value,
						country: vCardForm.home_country.value,
						phone: vCardForm.home_phone.value,
						fax: vCardForm.home_fax.value,
						bleeper: vCardForm.home_bleeper.value,
						telephone: vCardForm.home_telephone.value
					}),
					workInfo: new WorkInfo({
						street: vCardForm.work_street.value,
						city: vCardForm.work_city.value,
						province: vCardForm.work_province.value,
						postCode: vCardForm.work_postCode.value,
						country: vCardForm.work_country.value,
						phone: vCardForm.work_phone.value,
						fax: vCardForm.work_fax.value,
						bleeper: vCardForm.work_bleeper.value,
						telephone: vCardForm.work_telephone.value,
						company: vCardForm.company.value,
						title: vCardForm.title.value,
						department: vCardForm.department.value,
						webSite: vCardForm.webSite.value
					}),
					personalInfo: new PersonalInfo({
						name: vCardForm.name.value,
						middleName: vCardForm.middleName.value,
						familyName: vCardForm.familyName.value,
						nickname: vCardForm.nickname.value,
						email: vCardForm.email.value
					}),
					headPortrait: $("#avatarPreview").data("avatar")
				});
				eventProcessor.triggerEvent("service_selfControl_updateMyVCard", [vCard]);
			};
			$("#myHeader").bind("dblclick", function(event) {
				vCardDialog.dialog("open");
			});
			Tipped.create("#myHeader", "双击打开个人名片", {
				skin: "blue",
				hook: "rightmiddle",
				target: "mouse"
			});
			$("input[name='avatar']", vCardDialog).bind("change", function(event) {
				var that = $(this),
					file = that.get()[0].files[0],
					imgNode;
				if (file.size > 160 * 1024) {
					__noticeError("头像文件不合法：头像大小不能超过160KB");
					that.val("");
					return;
				}
				if (file.type !== "image/gif" && file.type !== "image/jpeg" && file.type !== "image/png" && file.type !== "image/bmp") {
					__noticeError("头像文件不合法：必须为jpg、png、gif或bmp格式");
					that.val("");
					return;
				}
				if (typeof file !== "undefined") {
					__blockElement(vCardDialog);
					var reader = new FileReader();
					reader.readAsDataURL(file);
					reader.onprogress = function(evt) {
						if (evt.lengthComputable) {
							// evt.loaded and evt.total are ProgressEvent properties
							var loaded = (evt.loaded / evt.total);
							if (loaded < 1) {}
						}
					};
					reader.onload = function(evt) {
						var fileString = evt.target.result,
							binval = /^data:(\w+\/\w+);base64,(.*)/.exec(fileString);
						$("#avatarPreview").attr("src", fileString).data("avatar", new HeadPortrait({
							type: file.type,
							binval: binval[2]
						}));
						__unBlockElement(vCardDialog);
					};
					reader.onerror = function(evt) {
						if (evt.target.error.name == "NotReadableError") {
							alert("文件读取失败，请上传正确的文件");
							__unBlockElement(vCardDialog);
						}
					};
				}
				/*检查尺寸--未完成*/
			});

			$("#vCardTabs").tabs();

			vCardDialog.dialog({
				autoOpen: false,
				closeOnEscape: true,
				draggable: true,
				resizable: false,
				modal: false,
				title: "个人名片",
				width: 800,
				show: "fade",
				hide: "fade",
				buttons: [{
						text: "保存",
						click: __vCardDlgModifySave
					}
				],
				open: function(event, ui) {
					var vCard = selfVCard,
						vCardForm = $("#vCardForm", vCardDialog);
					$("input[name='name']", vCardForm).val(vCard.getPersonalInfo().getName());
					$("input[name='middleName']", vCardForm).val(vCard.getPersonalInfo().getMiddleName());
					$("input[name='familyName']", vCardForm).val(vCard.getPersonalInfo().getFamilyName());
					$("input[name='nickname']", vCardForm).val(vCard.getPersonalInfo().getNickname());
					$("input[name='email']", vCardForm).val(vCard.getPersonalInfo().getEmail());

					$("input[name='company']", vCardForm).val(vCard.getWorkInfo().getCompany());
					$("input[name='title']", vCardForm).val(vCard.getWorkInfo().getTitle());
					$("input[name='department']", vCardForm).val(vCard.getWorkInfo().getDepartment());
					$("input[name='webSite']", vCardForm).val(vCard.getWorkInfo().getWebSite());
					$("input[name='work_street']", vCardForm).val(vCard.getWorkInfo().getStreet());
					$("input[name='work_city']", vCardForm).val(vCard.getWorkInfo().getCity());
					$("input[name='work_province']", vCardForm).val(vCard.getWorkInfo().getProvince());
					$("input[name='work_postCode']", vCardForm).val(vCard.getWorkInfo().getPostCode());
					$("input[name='work_country']", vCardForm).val(vCard.getWorkInfo().getCountry());
					$("input[name='work_phone']", vCardForm).val(vCard.getWorkInfo().getPhone());
					$("input[name='work_fax']", vCardForm).val(vCard.getWorkInfo().getFax());
					$("input[name='work_bleeper']", vCardForm).val(vCard.getWorkInfo().getBleeper());
					$("input[name='work_telephone']", vCardForm).val(vCard.getWorkInfo().getTelephone());

					$("input[name='home_street']", vCardForm).val(vCard.getHomeInfo().getStreet());
					$("input[name='home_city']", vCardForm).val(vCard.getHomeInfo().getCity());
					$("input[name='home_province']", vCardForm).val(vCard.getHomeInfo().getProvince());
					$("input[name='home_postCode']", vCardForm).val(vCard.getHomeInfo().getPostCode());
					$("input[name='home_country']", vCardForm).val(vCard.getHomeInfo().getCountry());
					$("input[name='home_phone']", vCardForm).val(vCard.getHomeInfo().getPhone());
					$("input[name='home_fax']", vCardForm).val(vCard.getHomeInfo().getFax());
					$("input[name='home_bleeper']", vCardForm).val(vCard.getHomeInfo().getBleeper());
					$("input[name='home_telephone']", vCardForm).val(vCard.getHomeInfo().getTelephone());
					if (vCard.hasHeadPortrait()) {
						$("#avatarPreview").attr("src", "data:" + vCard.getHeadPortrait().getType() + ";base64," + vCard.getHeadPortrait().getBinval()).data("avatar", vCard.getHeadPortrait());
					} else {
						$("#avatarPreview").attr("src", "resources/defaultHeader.jpg").data("avatar", null);
					}
				}
			});
		},
		__initLoginPanel = function() {
			/*------------输入框初始化------------*/
			if ($.cookie("rememberMe") === "true") {
				$("input[name='rememberMe']", loginDiv).get()[0].checked = true;
				$("input[name='username']", loginDiv).val($.cookie("username"));
				$("input[name='password']", loginDiv).val($.cookie("password"));
				$("input[name='host']", loginDiv).val($.cookie("host"));
				$("input[name='port']", loginDiv).val($.cookie("port"));
				$("input[name='groupResources']", loginDiv).val($.cookie("groupResources"));
				$("input[name='resources']", loginDiv).val($.cookie("resources"));
				$("input[name='clientHost']", loginDiv).val($.cookie("clientHost"));
				$("input[name='domain']", loginDiv).val($.cookie("domain"));
			} else {
				$("input[name='rememberMe']", loginDiv).get()[0].checked = false;
				$("input[name='host']", loginDiv).val(config.host);
				$("input[name='port']", loginDiv).val(config.port);
				$("input[name='groupResources']", loginDiv).val(config.groupChatResource);
				$("input[name='resources']", loginDiv).val(config.resource);
				$("input[name='clientHost']", loginDiv).val(config.httpbase);
				$("input[name='domain']", loginDiv).val(config.domain);
			}
			/*------------高级登陆选项初始化----*/
			$(".adSetting", loginDiv).hide();
			$("#loginConfigBtn").click(function(event) {
				if ($("img", this).attr("src") === "resources/upArrow.png") {
					$("img", this).attr("src", "resources/downArrow.png");
					$(".adSetting", loginDiv).fadeOut();
				} else {
					$("img", this).attr("src", "resources/upArrow.png");
					$(".adSetting", loginDiv).fadeIn();
				}
			});
			/*------------登陆初始化------------*/
			$("form", loginDiv).bind("submit", function(event) {
				var username = $("input[name='username']", this).val(),
					password = $("input[name='password']", this).val(),
					host = $("input[name='host']", this).val(),
					port = $("input[name='port']", this).val(),
					domain = $("input[name='domain']", this).val(),
					groupResources = $("input[name='groupResources']", this).val(),
					resources = $("input[name='resources']", this).val(),
					clientHost = $("input[name='clientHost']", this).val(),
					rememberMe = $("input[name='rememberMe']", this).get()[0].checked;
				if (!$(this).valid()) {
					return;
				}
				__blockPage("登录中，请稍后...");
				$.cookie("rememberMe", rememberMe, {
					expires: 7
				});
				if (rememberMe) {
					$.cookie("username", username, {
						expires: 7
					});
					$.cookie("host", host, {
						expires: 7
					});
					$.cookie("port", port, {
						expires: 7
					});
					$.cookie("groupResources", groupResources, {
						expires: 7
					});
					$.cookie("resources", resources, {
						expires: 7
					});
					$.cookie("clientHost", clientHost, {
						expires: 7
					});
					$.cookie("domain", domain, {
						expires: 7
					});
				} else {
					$.cookie("username", null);
					$.cookie("host", null);
					$.cookie("port", null);
					$.cookie("groupResources", null);
					$.cookie("resources", null);
					$.cookie("clientHost", null);
					$.cookie("domain", null);
				}
				config.host = host;
				config.port = port;
				config.groupChatResource = groupResources;
				config.resource = resources;
				config.httpbase = clientHost;
				config.domain = domain;
				eventProcessor.triggerEvent("service_selfControl_login", [username, password]);
				event.stopPropagation();
				event.preventDefault();
			}).validate({
				rules: {
					username: {
						required: true
					},
					password: {
						required: true
					}
				},
				messages: {
					username: {
						required: "请填写用户名"
					},
					password: {
						required: "请填写密码"
					}
				}
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
					passRepeat = this.passRepeat.value;
				if (!$(this).valid()) {
					return;
				}
				__blockPage("注册中，请稍后...");
				eventProcessor.triggerEvent("service_selfControl_register", [username, password]);
				event.preventDefault();
				event.stopPropagation();
			}).validate({
				rules: {
					username: {
						required: true,
						rangelength: [5, 12]
					},
					password: {
						required: true,
						rangelength: [5, 12]
					},
					passRepeat: {
						required: true,
						equalTo: "#regPass"
					}
				},
				messages: {
					username: {
						required: "请填写用户名",
						rangelength: "请填写长度为5-12的用户名"
					},
					password: {
						required: "请填写密码",
						rangelength: "请填写长度为5-12的密码"
					},
					passRepeat: {
						required: "请再次填写密码",
						equalTo: "两次输入的密码不一致"
					}
				}
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
				eventProcessor.triggerEvent("service_roster_sendUnsubscribe", [friends[rosterContextMenu.data("jid")].getVCard()]);
			});
			$("li[value='info']", rosterContextMenu).bind("click", function(event) {
				rosterVCardDialog.data("jid", rosterContextMenu.data("jid"));
				rosterVCardDialog.dialog("close");
				rosterVCardDialog.dialog("open");
			});
			$("li[value='tag']", rosterContextMenu).bind("click", function(event) {
				__prompt("请输入新的备注：", function(tag) {
					var groupName,
						user = friends[rosterContextMenu.data("jid")].getVCard(),
						groupList = [];
					console.log(groups);
					for (groupName in groups) {
						if (groups.hasOwnProperty(groupName)) {
							if (typeof groups[groupName][user.toString()] !== "undefined" && groupName !== "noGroup") {
								groupList.push(groupName);
							}
						}
					}
					eventProcessor.triggerEvent("service_roster_changeRosterTag", [user, groupList, tag]);
				}, function(tag) {
					return;
				});
			});
			$("li[value='chat']", rosterContextMenu).bind("click", function(event) {
				var vCard = friends[rosterContextMenu.data("jid")].getVCard();
				__createTab(vCard.toSimpleUser(), vCard.getPersonalInfo().getNickname());
			});
			$("li[value='group']", rosterContextMenu).bind("click", function(event) {
				rosterGroupDialog.data("jid", rosterContextMenu.data("jid")).dialog("open");
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
					var vCard = friends[$(this).data("jid")].getVCard(),
						groupName,
						groupList = $("ul", this);
					$("strong", this).text("要将 " + vCard.getPersonalInfo().getNickname() + "(" + vCard.toString() + ") 加入哪些分组？");
					groupList.html("");
					for (groupName in groups) {
						if (groups.hasOwnProperty(groupName)) {
							if (groupName !== "noGroup") {
								if (typeof groups[groupName][vCard.toString()] !== "undefined") {
									groupList.append("<li>" + groupName + "<input type='checkbox' name='" + groupName + "' checked='checked'/></li>");
								} else {
									groupList.append("<li>" + groupName + "<input type='checkbox' name='" + groupName + "'/></li>");
								}
							}
						}
					}
				}
			});
			/*------------分组新建按钮初始化---------------*/
			$("#groupCreateBtn").bind("click", function(event) {
				__prompt("请填入需要新的分组名称：", function(groupName) {
					$("ul", rosterGroupDialog).append("<li>" + groupName + "<input type='checkbox' name='" + groupName + "'/></li>");
				}, function() {});
				event.stopPropagation();
				event.preventDefault();
			});
			/*-----------分组表单初始化----------------*/
			$("#groupForm").submit(function(event) {
				var groupList = [],
					friend = friends[rosterGroupDialog.data("jid")];
				$("ul input[type=checkbox]", this).each(function() {
					if (this.checked) {
						groupList.push($(this).attr("name"));
					}
				});
				friend.setGroups(groupList);
				eventProcessor.triggerEvent("service_roster_changeGroup", [friend]);
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
		__initRosterVCardDialog = function() {
			$("#otherVCardTabs").tabs();
			rosterVCardDialog.dialog({
				autoOpen: false,
				closeOnEscape: true,
				draggable: true,
				resizable: false,
				modal: false,
				title: "好友信息",
				width: 800,
				show: "fade",
				hide: "fade",
				open: function(event, ui) {
					var vCard = friends[rosterVCardDialog.data("jid")].getVCard();
					$("tbody tr td", rosterVCardDialog).each(function() {
						var that = $(this),
							type = that.attr("vType"),
							value = "";
						switch (type) {
							case "name":
								value = vCard.getPersonalInfo().getName();
								break;
							case "middleName":
								value = vCard.getPersonalInfo().getMiddleName();
								break;
							case "familyName":
								value = vCard.getPersonalInfo().getFamilyName();
								break;
							case "nickname":
								value = vCard.getPersonalInfo().getNickname();
								break;
							case "email":
								value = vCard.getPersonalInfo().getEmail();
								break;

							case "company":
								vCard.getWorkInfo().getCompany();
								break;
							case "title":
								value = vCard.getWorkInfo().getTitle();
								break;
							case "department":
								value = vCard.getWorkInfo().getDepartment();
								break;
							case "webSite":
								value = vCard.getWorkInfo().getWebSite();
								break;
							case "work_street":
								value = vCard.getWorkInfo().getStreet();
								break;
							case "work_city":
								value = vCard.getWorkInfo().getCity();
								break;
							case "work_province":
								value = vCard.getWorkInfo().getProvince();
								break;
							case "work_postCode":
								value = vCard.getWorkInfo().getPostCode();
								break;
							case "work_country":
								value = vCard.getWorkInfo().getCountry();
								break;
							case "work_phone":
								value = vCard.getWorkInfo().getPhone();
								break;
							case "work_fax":
								value = vCard.getWorkInfo().getFax();
								break;
							case "work_bleeper":
								value = vCard.getWorkInfo().getBleeper();
								break;
							case "work_telephone":
								value = vCard.getWorkInfo().getTelephone();
								break;

							case "home_street":
								value = vCard.getHomeInfo().getStreet();
								break;
							case "home_city":
								value = vCard.getHomeInfo().getCity();
								break;
							case "home_province":
								value = vCard.getHomeInfo().getProvince();
								break;
							case "home_postCode":
								value = vCard.getHomeInfo().getPostCode();
								break;
							case "home_country":
								value = vCard.getHomeInfo().getCountry();
								break;
							case "home_phone":
								value = vCard.getHomeInfo().getPhone();
								break;
							case "home_fax":
								value = vCard.getHomeInfo().getFax();
								break;
							case "home_bleeper":
								value = vCard.getHomeInfo().getBleeper();
								break;
							case "home_telephone":
								value = vCard.getHomeInfo().getTelephone();
								break;
							default:
								value = "";
						}
						if (typeof type !== "undefined") {
							if (typeof value === "undefined" || value === "") {
								that.text("未填写");
							} else {
								that.text(value);
							}
						}
					});
				}
			});
		},
		__initAddBookmarkDialog = function() {
			addBookmarkDialog.dialog({
				title: "添加书签",
				autoOpen: false,
				closeOnEscape: true,
				draggable: true,
				resizable: false,
				modal: false,
				width: 400,
				show: "fade",
				hide: "fade",
				open: function(event, ui) {
					$("input", addBookmarkDialog).val("");
					$("input[name='nickname']", addBookmarkDialog).val(selfVCard.getJid());
					$("#bookmarkRoomName").text(rooms[addBookmarkDialog.data("roomJid")].getRoom().getRoomName());
				}
			});
			$("#addBookmarkForm").submit(function(event) {
				__blockElement(addBookmarkDialog, "书签添加中...");
				var roomJid = addBookmarkDialog.data("roomJid"),
					tag = this.tag.value,
					nickname = this.nickname.value,
					autojoin = this.autojoin.checked;
				if (!$(this).valid()) {
					return;
				}
				eventProcessor.triggerEvent("service_groupChat_addBookmark", [new Bookmark({
						roomJid: roomJid,
						tag: tag,
						nickname: nickname,
						autojoin: autojoin
					})]);
				event.preventDefault();
				event.stopPropagation();
			}).validate({
				rules: {
					tag: {
						required: true,
						rangelength: [1, 10]
					},
					nickname: {
						required: true,
						rangelength: [1, 12]
					}
				},
				messages: {
					tag: {
						required: "请填写书签名称",
						rangelength: "请填写长度为1-10个字符的名称"
					},
					nickname: {
						required: "请填写进入房间使用的昵称",
						rangelength: "请填写长度为1-12个字符的昵称"
					}
				}
			});
		},
		__initBookmarkDialog = function() {
			bookmarkDialog.dialog({
				title: "我的书签",
				autoOpen: false,
				closeOnEscape: true,
				draggable: true,
				resizable: false,
				modal: false,
				width: 800,
				show: "fade",
				hide: "fade",
				open: function(event, ui) {
					__blockElement(bookmarkDialog);
					$("table tbody", bookmarkDialog).html("");
					eventProcessor.triggerEvent("service_groupChat_getBookmarks");
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
		},
		__blockElement = function($_ele, msg) {
			$_ele.block({
				message: msg,
				css: {
					border: 'none',
					padding: '15px',
					backgroundColor: '#000',
					'-webkit-border-radius': '10px',
					'-moz-border-radius': '10px',
					opacity: 0.5,
					color: '#fff'
				}
			});
		},
		__unBlockElement = function($_ele) {
			$_ele.unblock();
		},
		__blockPage = function(msg) {
			$.blockUI({
				message: msg,
				css: {
					border: 'none',
					padding: '15px',
					backgroundColor: '#000',
					'-webkit-border-radius': '10px',
					'-moz-border-radius': '10px',
					opacity: 0.5,
					color: '#fff'
				}
			});
		},
		__unBlockPage = function() {
			$.unblockUI();
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
		__initAddBookmarkDialog();
		__initBookmarkDialog();
		__initEmotionsPanel();
		__initMainPageContextMenu();
		__initAboutDialog();
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
			for (index in groupChatPanels) {
				if (Object.prototype.hasOwnProperty.apply(groupChatPanels, [index])) {
					__destoryRoomChatTab(index);
				}
			}
			for (index in wasteChatPanels) {
				if (Object.prototype.hasOwnProperty.apply(wasteChatPanels, [index])) {
					__destoryWastedChatTab(index);
				}
			}
			privacyChatPanels = {};
			groupChatPanels = {};
			wasteChatPanels = {};
			rosterTb.html("");
			myStatus.attr("src", "resources/user-chat.png");
			//$(".dialog").dialog("close");
			__unBlockPage();
		},
		viewer_logined: function(event) {
			loginDiv.slideUp();
			mainDiv.slideDown();
			registerDialog.dialog("close");
		},
		viewer_drawRoster: function(event, friend) {
			friends[friend.getVCard().toString()] = friend;
			__drawRoster(friend);
		},
		viewer_drawRosterDetail: function(event, vCard) {
			friends[vCard.toString()].setVCard(vCard);
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
			if (vCard.getPersonalInfo().getNickname() !== "" && typeof vCard.getPersonalInfo().getNickname() !== "undefined") {
				$("#myNameAndHeader h3").text(vCard.getPersonalInfo().getNickname());
			} else {
				$("#myNameAndHeader h3").text(vCard.getJid());
			}
			if (vCard.hasHeadPortrait()) {
				$("#myHeader").attr("src", vCard.getHeadPortrait().toHtmlString());
			} else {
				$("#myHeader").attr("src", "resources/defaultHeader.jpg");
			}
			Tipped.create("#myNameAndHeader h3", vCard.toString(), {
				skin: "blue",
				hook: "rightmiddle",
				target: "mouse"
			});
			selfVCard = vCard;
			__unBlockPage();
		},
		viewer_listRoom: function(event, roomList) {
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
			__unBlockElement(findRoomDialog);
		},
		viewer_drawRoomDetail: function(event, room) {
			rooms[room.toString()] = new RoomUser({
				room: room
			});
			if (room.getAttribute("passwordprotected")) {
				$("button[roomJid='" + room.toString() + "']", findRoomDialog).parent().prepend("<img src='resources/msgWarnIcon.png'/>");
			}
		},
		viewer_drawRoomChatTab: function(event, roomUser, users) {
			rooms[roomUser.toRoomString()] = roomUser;
			__drawRoomChatTab(roomUser.getRoom(), users);
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
			friends[friend.getVCard().toString()] = friend;
			__deleteUserInGroups(friend.getVCard().toString());
			__addUserInGroups(friend.getVCard().toString(), friend.getGroups());
			rosterGroupDialog.dialog("close");
			__noticeSuccess("分组修改成功");
		},
		viewer_addedBookmark: function(event) {
			__unBlockElement(addBookmarkDialog);
			addBookmarkDialog.dialog("close");
			__noticeSuccess("添加书签成功");
		},
		viewer_addedBookmarkFailed: function(event, reason) {
			__unBlockElement(addBookmarkDialog);
			__noticeError(reason);
		},
		viewer_getedBookmarks: function(event, bookmarks) {
			var tbody = $("table tbody", bookmarkDialog),
				trNode,
				tdNode,
				btnNode,
				joinBtn,
				i,
				__deleteFun = function(event) {
					var bookmark = $(this).parent().parent().data("bookmark");
					eventProcessor.triggerEvent("service_groupChat_deleteBookmark", [bookmark.getRoomJid()]);
					event.stopPropagation();
					event.preventDefault();
				},
				__joinFun = function(event) {
					var that = $(this),
						bookmark = that.parent().parent().data("bookmark");
					roomUser = new RoomUser({
						room: new Room(bookmark.getRoomJid()),
						nickname: bookmark.getNickname()
					});
					eventProcessor.triggerEvent("service_groupChat_joinRoom", [roomUser]);
					event.stopPropagation();
					event.preventDefault();
				},
				__modifyFun = function(event) {
					var that = $(this),
						trNode = that.parent().parent(),
						bookmark = trNode.data("bookmark"),
						buttons = $("button", trNode);
					var tagInput = $("<input type='text' style='width:100px;margin:0' name='tag' placeholder='书签名称'/>"),
						nicknameInput = $("<input type='text' style='width:100px;margin:0' name='nickname' placeholder='昵称'/>"),
						autojoinInput = $("<input type='checkbox' name='autojoin'/>");
					tagInput.val(bookmark.getTag());
					nicknameInput.val(bookmark.getNickname());
					$("td:eq(0)", trNode).html(tagInput);
					$("td:eq(2)", trNode).html(nicknameInput);
					if (bookmark.isAutojoin()) {
						autojoinInput.get()[0].checked = true;
					} else {
						autojoinInput.get()[0].checked = false;
					}
					$("td:eq(3)", trNode).html(autojoinInput);
					$(buttons[0]).hide();
					$(buttons[1]).hide();
					$(buttons[2]).hide();
					$(buttons[3]).show();
					$(buttons[4]).show();
				},
				__saveFun = function(event) {
					var that = $(this),
						trNode = that.parent().parent(),
						buttons = $("button", trNode),
						bookmark = new Bookmark({
							tag: $("input[name='tag']", trNode).val(),
							roomJid: $("td:eq(1)", trNode).text(),
							nickname: $("input[name='nickname']", trNode).val(),
							autojoin: $("input[name='autojoin']", trNode).get()[0].checked
						});
					__blockElement(bookmarkDialog);
					eventProcessor.triggerEvent("service_groupChat_updateBookmark", [bookmark]);
				},
				__returnFun = function(event) {
					var that = $(this),
						trNode = that.parent().parent(),
						bookmark = trNode.data("bookmark"),
						buttons = $("button", trNode);
					$("td:eq(0)", trNode).html(bookmark.getTag());
					$("td:eq(1)", trNode).html(bookmark.getRoomJid());
					$("td:eq(2)", trNode).html(bookmark.getNickname());
					$("td:eq(3)", trNode).html(bookmark.isAutojoin() ? "是" : "否");
					$(buttons[0]).show();
					$(buttons[1]).show();
					$(buttons[2]).show();
					$(buttons[3]).hide();
					$(buttons[4]).hide();
				};
			for (i = bookmarks.length; i--;) {
				trNode = $("<tr jid='" + bookmarks[i].getRoomJid() + "'></tr>").data("bookmark", bookmarks[i]);
				trNode.append("<td>" + bookmarks[i].getTag() + "</td>");
				trNode.append("<td>" + bookmarks[i].getRoomJid() + "</td>");
				trNode.append("<td>" + bookmarks[i].getNickname() + "</td>");
				if (bookmarks[i].isAutojoin()) {
					trNode.append("<td>是</td>");
				} else {
					trNode.append("<td>否</td>");
				}
				tdNode = $("<td></td>");
				btnNode = $("<button class='btn btn-success'>加入</button>");
				btnNode.bind("click", __joinFun);
				tdNode.append(btnNode);

				btnNode = $("<button class='btn btn-primary'>修改</button>");
				btnNode.bind("click", __modifyFun);
				tdNode.append(btnNode);

				btnNode = $("<button class='btn btn-danger'>删除</button>");
				btnNode.bind("click", __deleteFun);
				tdNode.append(btnNode);

				btnNode = $("<button style='display:none' class='btn btn-success'>保存</button>");
				btnNode.bind("click", __saveFun);
				tdNode.append(btnNode);

				btnNode = $("<button style='display:none' class='btn btn-primary'>返回</button>");
				btnNode.bind("click", __returnFun);
				tdNode.append(btnNode);

				trNode.append(tdNode);
				tbody.append(trNode);
			}
			__unBlockElement(bookmarkDialog);
		},
		viewer_deletedBookmark: function(event) {
			__noticeSuccess("移除书签成功");
			bookmarkDialog.dialog("close").dialog("open");
		},
		viewer_updatedBookmark: function(event, bookmark) {
			var trNode = $("table tbody tr[jid='" + bookmark.getRoomJid() + "']", bookmarkDialog),
				buttons = $("button", trNode);
			trNode.data("bookmark", bookmark);
			$("td:eq(0)", trNode).html(bookmark.getTag());
			$("td:eq(1)", trNode).html(bookmark.getRoomJid());
			$("td:eq(2)", trNode).html(bookmark.getNickname());
			$("td:eq(3)", trNode).html(bookmark.isAutojoin() ? "是" : "否");
			$(buttons[0]).show();
			$(buttons[1]).show();
			$(buttons[2]).show();
			$(buttons[3]).hide();
			$(buttons[4]).hide();
			__unBlockElement(bookmarkDialog);
		},
		viewer_changedRosterTag: function(event, user, tag) {
			friends[user.toString()].setTag(tag);
			$("div[jid='" + user.getJid() + "_" + user.getDomain() + "'] .u-nick", rosterTb).text(tag);
		}
	});
}(jQuery, window));