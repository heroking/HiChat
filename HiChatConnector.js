HICHAT.namespace("HICHAT.connector");
HICHAT.connector = (function($, window) {
	var eventProcessor = HICHAT.utils.eventProcessor,
		config = HICHAT.config,
		XMLHelper = HICHAT.XMLHelper,
		User = HICHAT.model.SimpleUser,
		GroupUser = HICHAT.model.GroupChatUser,
		Friend = HICHAT.model.Friend,
		VCard = HICHAT.model.VCard,
		WorkInfo = HICHAT.model.WorkInfo,
		HomeInfo = HICHAT.model.HomeInfo,
		PersonalInfo = HICHAT.model.PersonalInfo,
		HeadPortrait = HICHAT.model.HeadPortrait,
		Presence = HICHAT.model.Presence,
		Room = HICHAT.model.Room,
		RoomUser = HICHAT.model.RoomUser,
		OutcastUser = HICHAT.model.OutcastUser,
		Message = HICHAT.model.Message,
		GroupMessage = HICHAT.model.GroupMessage,
		ChatState = HICHAT.model.ChatState,
		Bookmark = HICHAT.model.Bookmark,
		con,
		handleModule = (function() {
			var waste,
				__handleGroupChatPresence = function(aPresence) {
					var roomUser = new RoomUser(aPresence.getFrom()),
						$_presence = $(aPresence.getDoc()),
						type = aPresence.getType(),
						status = $("status", $_presence),
						destroy = $("destroy", $_presence);
					if (type === "unavailable") {
						if (status.length !== 0) {
							if (status.attr("code") === "307") {
								eventProcessor.triggerEvent("service_groupChat_kickedout", [roomUser]);
								return;
							}
							if (status.attr("code") === "301") {
								eventProcessor.triggerEvent("service_groupChat_outcasted", [roomUser, $("reason", $_presence).text()]);
								return;
							}
							if (status.attr("code") === "303") {
								eventProcessor.triggerEvent("service_groupChat_changedNickInRoom", [roomUser, $("item", $_presence).attr("nick")]);
							}
						} else if (destroy.length !== 0) {
							eventProcessor.triggerEvent("service_groupChat_deletedRoom", [roomUser.getRoom().toString(), $("reason", $_presence).text()]);
						}
						eventProcessor.triggerEvent("service_groupChat_userLeaveRoom", [roomUser]);
					} else {
						roomUser.setAffiliation($("item", $_presence).attr("affiliation"));
						roomUser.setRole($("item", $_presence).attr("role"));
						roomUser.setJid($("item", $_presence).attr("jid"));
						eventProcessor.triggerEvent("service_groupChat_userJoinRoom", [roomUser]);
					}
				},
				__handleSubscribe = function(aPresence) {
					var type = aPresence.getType(),
						user = new User(aPresence.getFrom());
					if (type === "subscribe") {
						eventProcessor.triggerEvent("service_roster_subscribeRequest", [user]);
					} else if (type === "subscribed") {
						eventProcessor.triggerEvent("service_roster_subscribeAccepted", [user]);
					} else if (type === "unsubscribe") {
						eventProcessor.triggerEvent("service_roster_unsubscribeRequest", [user]);
					} else {
						eventProcessor.triggerEvent("service_roster_subscribeRejected", [user]);
					}
				},
				__handleAvailable = function(aPresence) {
					var type = aPresence.getType() || "available",
						user = new User(aPresence.getFrom()),
						presence = new Presence({
							type: type,
							show: aPresence.getShow(),
							status: aPresence.getStatus()
						});
					if (type === "unavailable") {
						eventProcessor.triggerEvent("service_roster_setRosterUnavailable", [user, presence]);
					} else {
						eventProcessor.triggerEvent("service_roster_setRosterAvailable", [user, presence]);
					}
				},
				__handleProbe = function(aPresence) {
					console.log(aPresence.xml());
				},
				__handleError = function(aPresence) {
					console.log("handleError : ", aPresence.xml());
					var errorCode = $("error", aPresence.getDoc()).attr("code"),
						from = aPresence.getFrom();
					switch (errorCode) {
						case "404":
							eventProcessor.triggerEvent("service_noticeError", ["未找到" + from]);
							break;
						default:
							eventProcessor.triggerEvent("service_noticeError", ["发生错误，请稍后再试！"]);
					}
				};
			return {
				handleIQ: function(aIQ) {
					console.log("handleIQ:" + aIQ.xml());
				},
				handleMessage: function(aJSJaCPacket) {
					console.log(aJSJaCPacket.xml());
					var message,
						delay,
						$_message = $(aJSJaCPacket.getDoc()),
						chatState,
						user;
					try {
						if (aJSJaCPacket.getType() === "groupchat") {
							user = new RoomUser(aJSJaCPacket.getFrom());
							message = new GroupMessage({
								groupUser: user,
								message: aJSJaCPacket.getBody().htmlEnc()
							});
							delay = $("delay", $_message);
							if (delay.length === 0) {
								message.setTime(new Date().getTime());
							} else {
								message.setTime(new Date(delay.attr("stamp")).getTime());
							}
							eventProcessor.triggerEvent("service_groupChat_recieveMsg", [message]);
						} else {
							user = new User(aJSJaCPacket.getFrom());
							if ($("body", $_message).length !== 0) {
								message = new Message({
									user: user,
									message: aJSJaCPacket.getBody().htmlEnc()
								});
								delay = $("delay", $_message);
								if (delay.length === 0) {
									message.setTime(new Date().getTime());
								} else {
									message.setTime(new Date(delay.attr("stamp")).getTime());
								}
								eventProcessor.triggerEvent("service_privacyChat_recieveMsg", [message]);
							}
							if (true) {
								//xep - 0085 聊天状态处理，未完成
							}
						}
					} catch (e) {
						console.dir(e);
					}

				},
				handlePresence: function(aPresence) {
					console.log("handle Presence : " + aPresence.xml());
					var type = aPresence.getType() || "available";
					if ($("x[xmlns='" + NS_MUC_USER + "']", aPresence.getDoc()).length > 0) {
						__handleGroupChatPresence(aPresence);
					} else {
						if (typeof type === "undefined") {
							type = "available";
						}
						switch (type) {
							case "subscribe":
							case "subscribed":
							case "unsubscribe":
							case "unsubscribed":
								__handleSubscribe(aPresence);
								break;
							case "unavailable":
							case "available":
								__handleAvailable(aPresence);
								break;
							case "probe":
								__handleProbe(aPresence);
								break;
							case "error":
								__handleError(aPresence);
								break;
							default:
								__handleError(aPresence);
								break;
						}
					}
				},
				handleError: function(e) {
					console.log(e.xml());
					var errorCode = $(e).attr("code");
					if (Number(errorCode) === 401) {
						eventProcessor.triggerEvent("service_selfControl_logined", [false]);
					}
					__disconnect();
				},
				handleStatusChanged: function(status) {
					console.log("Status changed : ", status);
				},
				handleConnected: function(e) {
					eventProcessor.triggerEvent("service_selfControl_logined", [true]);
				},
				handleDisconnected: function() {
					eventProcessor.triggerEvent("service_selfControl_logouted");
				},
				handleIqVersion: function(iq) {
					con.send(iq.reply([
						iq.buildNode('name', config.resource),
						iq.buildNode('version', JSJaC.Version),
						iq.buildNode('os', navigator.userAgent)
					]));
					return true;
				},
				handleIqTime: function(iq) {
					var now = new Date();
					con.send(iq.reply([iq.buildNode('display',
							now.toLocaleString()),
						iq.buildNode('utc',
							now.jabberDate()),
						iq.buildNode('tz',
							now.toLocaleString().substring(now.toLocaleString().lastIndexOf(' ') + 1))
					]));
					return true;
				}
			};
		}()),
		basicModule = (function() {
			var __buildConnector = function(username, password, isRegister) {
				var connArgs = {
					httpbase: config.httpbase,
					timerval: config.timerval
				};

				if (config.type === 'binding') {
					con = new JSJaCHttpBindingConnection(connArgs);
				} else {
					con = new JSJaCHttpPollingConnection(connArgs);
				}

				__initConnection();

				connArgs = {
					domain: config.domain,
					username: username,
					resource: config.resource,
					pass: password,
					register: isRegister,
					host: config.host,
					port: config.port
				};
				con.connect(connArgs);
			};
			eventProcessor.bindEvent({
				connector_basic_login: function(event, username, password) {
					__buildConnector(username, password, false);
				},
				connector_basic_logout: function(event) {
					var p = new JSJaCPresence();
					p.setType("unavailable");
					con.send(p);
					con.disconnect();
				},
				connector_basic_register: function(event, username, password) {
					__buildConnector(username, password, true);
				}

			});
		}()),
		VCardModule = (function() {
			eventProcessor.bindEvent({
				connector_vCard_getOtherVCard: function(event, callbackName, user) {
					console.log(user);
					var aIQ = new JSJaCIQ(),
						aVCardNode = aIQ.buildNode("vCard"),
						destJid = user.toString();
					aIQ.setType("get");
					aIQ.setTo(destJid);
					aVCardNode.setAttribute("xmlns", NS_VCARD);
					aIQ.appendNode(aVCardNode);
					con.sendIQ(aIQ, {
						error_handler: function() {},
						result_handler: function(aJSJaCPacket) {
							var vCard = XMLHelper.parseVCard($("vCard", $(aJSJaCPacket.xml())).get()[0]);
							vCard.setJid(user.getJid());
							vCard.setDomain(user.getDomain());
							aPresence = new JSJaCPresence();
							eventProcessor.triggerEvent(callbackName, [vCard]);
							aPresence.setTo(user.toString());
							con.send(aPresence);
						},
						default_handler: function() {}
					});
				},
				connector_vCard_getMyVCard: function(event, callbackName, CBGetMyVCard) {
					var aIQ = new JSJaCIQ(),
						aVCardNode = aIQ.buildNode("vCard");
					aIQ.setType("get");
					aVCardNode.setAttribute('xmlns', NS_VCARD);
					aIQ.appendNode(aVCardNode);
					con.sendIQ(aIQ, {
						error_handler: function(e) {
							console.log(e.xml());
						},
						result_handler: function(aJSJaCPacket) {
							var vCard = XMLHelper.parseVCard($("vCard", $(aJSJaCPacket.xml())).get()[0]);
							vCard.setJid(aJSJaCPacket.getToJID().getNode());
							vCard.setDomain(aJSJaCPacket.getToJID().getDomain());
							eventProcessor.triggerEvent(callbackName, [vCard]);
						},
						default_handler: function(e) {
							console.log(e.xml());
						}
					});
				},
				connector_vCard_updateMyVCard: function(event, vCard, CBDrawVCard) {
					var aIQ = new JSJaCIQ();
					aIQ.setType("set");
					aIQ.appendNode(XMLHelper.buildVCard(vCard));
					con.sendIQ(aIQ, {
						error_handler: function(aJSJaCPacket) {
							eventProcessor.triggerEvent("service_selfControl_updatedMyVCard", [false]);
						},
						result_handler: function(aJSJaCPacket) {
							eventProcessor.triggerEvent("service_selfControl_updatedMyVCard", [true]);
						},
						default_handler: function(aJSJaCPacket) {
							eventProcessor.triggerEvent("service_selfControl_updatedMyVCard", [false]);
						}
					});
				}
			});
		}()),
		privacyChatModule = (function() {
			eventProcessor.bindEvent({
				connector_privacyChat_sendMsg: function(event, message, CBPrivacySendMsg) {
					var user = message.getUser(),
						msgBody = message.getMessage(),
						msg = new JSJaCMessage();
					msg.setTo(user.toString());
					msg.setBody(msgBody);
					con.send(msg);
				},
				connector_privacyChat_sendSubscribe: function(event, user, tag, CBSendSubscribe) {
					var aIQ = new JSJaCIQ(),
						queryNode = aIQ.setQuery(NS_ROSTER),
						itemNode = aIQ.buildNode("item");
					aIQ.setType("set");
					itemNode.setAttribute("jid", user.toString());
					itemNode.setAttribute("subscription", "from");
					itemNode.setAttribute("ask", "subscribe");
					if (typeof tag === 'string') {
						itemNode.setAttribute("name", tag);
					}
					queryNode.appendChild(itemNode);
					con.sendIQ(aIQ, {
						error_handler: function(aJSJaCPacket) {
							console.log("Error handler : " + aJSJaCPacket.xml());
						},
						result_handler: function(aJSJaCPacket) {
							var aPresence = new JSJaCPresence();
							aPresence.setTo(user.toString());
							aPresence.setType("subscribe");
							con.send(aPresence, function(aJSJaCPacket) {
								var aPresence = new JSJaCPresence();
								aPresence.setTo(user.toString());
								con.send(aPresence);
							});
						}
					});
				},
				connector_privacyChat_sendSubscribed: function(event, user, tag, CBSendSubscribed) {
					var aIQ = new JSJaCIQ(),
						queryNode = aIQ.setQuery(NS_ROSTER),
						itemNode = aIQ.buildNode("item");
					aIQ.setType("set");
					itemNode.setAttribute("jid", user.toString());
					itemNode.setAttribute("subscription", "both");
					if (typeof tag === 'string') {
						itemNode.setAttribute("name", tag);
					}
					queryNode.appendChild(itemNode);
					con.sendIQ(aIQ, {
						error_handler: function(aJSJaCPacket) {
							console.log("error handler: " + aJSJaCPacket.xml());
						},
						result_handler: function(aJSJaCPacket) {
							var aPresence = new JSJaCPresence();
							aPresence.setTo(user.toString());
							aPresence.setType("subscribed");
							con.send(aPresence, function(aJSJaCPacket) {
								var aPresence = new JSJaCPresence();
								aPresence.setTo(user.toString());
								con.send(aPresence);
							});
						}
					});
				},
				connector_privacyChat_sendUnsubscribed: function(event, user, CBSendUnsubscribed) {
					var aPresence = new JSJaCPresence();
					aPresence.setTo(user.toString());
					aPresence.setType("unsubscribed");
					con.send(aPresence);
					if (typeof CBSendUnsubscribed === "function") {}
				},
				connector_privacyChat_sendUnsubscribe: function(event, user, CBSendUnsubscribe) {
					var aPresence = new JSJaCPresence();
					aPresence.setTo(user.toString());
					aPresence.setType("unsubscribe");
					con.send(aPresence);
					if (typeof CBSendUnsubscribe === "function") {}
				},
				connector_privacyChat_sendBothSubscribe: function(event, user, tag) {
					var aPresence = new JSJaCPresence();
					aPresence.setType("subscribed").setTo(user.toString());
					con.send(aPresence, function(aJSJaCPacket) {
						var aIQ = new JSJaCIQ(),
							queryNode = aIQ.setQuery(NS_ROSTER),
							itemNode = aIQ.buildNode("item");
						aIQ.setType("set");
						itemNode.setAttribute("jid", user.toString());
						itemNode.setAttribute("subscription", "both");
						if (typeof tag === 'string') {
							itemNode.setAttribute("name", tag);
						}
						queryNode.appendChild(itemNode);
						con.sendIQ(aIQ, {
							error_handler: function(aJSJaCPacket) {
								console.log("error handler: " + aJSJaCPacket.xml());
							},
							result_handler: function(aJSJaCPacket) {
								var aPresence = new JSJaCPresence();
								aPresence.setTo(user.toString());
								con.send(aPresence);
							}
						});
					});
				},
				connector_privacyChat_rosterRequest: function(event, CBRosterRequest) {
					var aIQ = new JSJaCIQ();
					aIQ.setType("get").setQuery(NS_ROSTER);
					con.sendIQ(aIQ, {
						error_handler: function(aJSJaCPacket) {
							console.log(aJSJaCPacket.xml());
						},
						result_handler: function(aIQ) {
							var friends = [];
							$("item", aIQ.getQuery()).each(function() {
								var that = $(this),
									wholeJid = that.attr("jid"),
									groups = [],
									friend = new Friend({
										vCard: new VCard({
											jid: wholeJid.substring(0, wholeJid.indexOf("@")),
											domain: wholeJid.substring(wholeJid.indexOf("@") + 1)
										})
									});
								$("group", that).each(function() {
									groups.push($(this).text());
								});
								friend.setGroups(groups);
								if (that.attr("subscription") === 'both') {
									friends.push(friend);
								}
							});
							eventProcessor.triggerEvent("service_roster_rosterRequested", [friends]);
							con.send(new JSJaCPresence());
						},
						default_handler: function(aJSJaCPacket) {
							console.log(aJSJaCPacket.xml());
						}
					});
				},
				connector_privacyChat_removeRoster: function(event, user, CBRemoveRoster) {
					var aIQ = new JSJaCIQ(),
						queryNode,
						itemNode;
					aIQ.setType("set");
					queryNode = aIQ.setQuery(NS_ROSTER);
					itemNode = aIQ.buildNode("item");
					itemNode.setAttribute("jid", user.toString());
					itemNode.setAttribute("subscription", "remove");
					queryNode.appendChild(itemNode);
					con.sendIQ(aIQ, {
						result_handler: function(aJSJaCPacket) {
							eventProcessor.triggerEvent("service_roster_removedRoster", [user]);
						}
					});
					if (typeof CBRemoveRoster === "function") {}
				},
				connector_privacyChat_changeStatus: function(event, status) {
					var aPresence = new JSJaCPresence(),
						showNode = aPresence.buildNode("show");
					showNode.appendChild(document.createTextNode(status));
					aPresence.appendNode(showNode);
					con.send(aPresence);
				},
				connector_privacyChat_changeGroup: function(event, friend) {
					var aIQ = new JSJaCIQ(),
						queryNode = aIQ.setType("set").setQuery(NS_ROSTER),
						itemNode = aIQ.buildNode("item"),
						groups = friend.getGroups(),
						i;
					itemNode.setAttribute("jid", friend.getVCard().toString());
					itemNode.setAttribute("subscription", "both");
					for (i = groups.length; i--;) {
						itemNode.appendChild(aIQ.buildNode("group", groups[i]));
					}
					queryNode.appendChild(itemNode);
					con.sendIQ(aIQ, {
						error_handler: function(aJSJaCPacket) {
							console.log("发生错误", aJSJaCPacket.xml());
						},
						result_handler: function(aJSJaCPacket) {
							eventProcessor.triggerEvent("service_roster_changedGroup", [friend]);
						},
						default_handler: function(aJSJaCPacket) {
							console.log("发生错误", aJSJaCPacket.xml());
						}
					});
				}
			});
		}()),
		groupChatModule = (function() {
			var __errorhandler = function(aJSJaCPacket) {
				var errorCode = Number($("error", aJSJaCPacket.xml()).attr("code"));
				switch (errorCode) {
					case 401:
						eventProcessor.triggerEvent("service_noticeError", ["输入的密码不正确！"]);
						break;
					case 403:
						eventProcessor.triggerEvent("service_noticeError", ["您已被该房间禁止进入！"]);
						break;
					case 404:
						eventProcessor.triggerEvent("service_noticeError", ["该房间不存在！"]);
						break;
					case 405:
						eventProcessor.triggerEvent("service_noticeError", ["您被限制创建房间！"]);
						break;
					case 406:
						eventProcessor.triggerEvent("service_noticeError", ["您必须使用该房间设定的昵称！"]);
						break;
					case 407:
						eventProcessor.triggerEvent("service_noticeError", ["您不在该房间的成员列表中！"]);
						break;
					case 409:
						eventProcessor.triggerEvent("service_noticeError", ["您的昵称已被使用，请更换昵称！"]);
						break;
					case 503:
						eventProcessor.triggerEvent("service_noticeError", ["该房间已满！"]);
						break;
					default:
						eventProcessor.triggerEvent("service_noticeError", ["发生错误，请稍后再试！"]);
				}
			};
			eventProcessor.bindEvent({
				connector_groupChat_sendMsg: function(event, message, CBGroupBroadcastMsg) {
					var room = message.getGroupUser().getRoom(),
						msgBody = message.getMessage(),
						aMessage = new JSJaCMessage(),
						bodyNode = aMessage.buildNode("body");
					aMessage.setTo(room.toString()).setType("groupchat");
					bodyNode.appendChild(document.createTextNode(msgBody));
					aMessage.appendNode(bodyNode);
					console.log(aMessage.xml());
					con.send(aMessage);
				},
				connector_groupChat_createRoom: function(event, roomConfig, CBCreateRoom) {
					var aPresence = new JSJaCPresence(),
						aX = aPresence.buildNode("x"),
						roomJID = roomConfig.toString();
					aPresence.setTo(roomJID + "/" + "creater");
					aX.setAttribute("xmlns", NS_MUC);
					aPresence.appendNode(aX);
					con.send(aPresence, function(aPresence) {
						var aIQ = new JSJaCIQ();
						aIQ.setTo(roomJID).setType("get");
						aIQ.setQuery(NS_MUC_OWNER);
						con.sendIQ(aIQ, {
							error_handler: __errorhandler,
							result_handler: function(aJSJaCPacket) {
								try {
									var aIQ = new JSJaCIQ().setTo(roomJID).setType("set"),
										queryNode = aIQ.setQuery(NS_MUC_OWNER),
										$_xNode = $("<x></x>").attr("xmlns", NS_XDATA).attr("type", "submit"),
										$_tmpFieldNode,
										$_tmpValueNode,
										index,
										allValue,
										key,
										i;
									$_xNode.append("<field var='FORM_TYPE'><value>http://jabber.org/protocol/muc#roomconfig</value></field>");

									allValue = roomConfig.getAllValue();

									for (key in allValue) {
										if (Object.prototype.hasOwnProperty.apply(allValue, [key])) {
											$_tmpFieldNode = $("<field></field>").attr("var", "muc#roomconfig_" + key);
											if (typeof allValue[key] === 'string' || typeof allValue[key] === 'number') {
												$_tmpValueNode = $("<value></value>").text(allValue[key]);
												$_tmpFieldNode.append($_tmpValueNode);
											} else if (typeof allValue[key] === 'boolean') {
												if (allValue[key] === true) {
													$_tmpValueNode = $("<value>1</value>");
												} else {
													$_tmpValueNode = $("<value>0</value>");
												}
												$_tmpFieldNode.append($_tmpValueNode);
											} else if (typeof allValue[key] === 'object') {
												for (i = allValue[key].length; i--;) {
													$_tmpValueNode = $("<value></value>").text(allValue[key][i]);
													$_tmpFieldNode.append($_tmpValueNode);
												}
											}
											$_xNode.append($_tmpFieldNode);
										}
									}
									queryNode.appendChild($_xNode.get()[0]);
									con.sendIQ(aIQ, {
										error_handler: __errorhandler,
										result_handler: function(aJSJaCPacket) {
											eventProcessor.triggerEvent("service_groupChat_createdRoom", [roomConfig]);
										},
										default_handler: function(aJSJaCPacket) {}
									});
								} catch (e) {
									console.log(e.message);
								}
							},
							default_handler: function(aJSJaCPacket) {}
						});
					});
				},
				connector_groupChat_deleteRoom: function(event, room, newRoom, reason, password, CBDeleteRoom) {
					var aIQ = new JSJaCIQ(),
						queryNode = aIQ.setType("set").setTo(room.toString()).setQuery(NS_MUC_OWNER),
						destroyNode = aIQ.buildNode("destroy"),
						reasonNode,
						passwordNode;
					if (newRoom instanceof Room) {
						destroyNode.setAttribute("jid", newRoom.toString());
					}
					if (typeof reason === 'string') {
						reasonNode = aIQ.buildNode("reason");
						reasonNode.appendChild(document.createTextNode(reason));
						destroyNode.appendChild(reasonNode);
					}
					if (typeof password === "string") {
						passwordNode = aIQ.buildNode("password");
						reasonNode.appendChild(document.createTextNode(password));
						destroyNode.appendChild(passwordNode);
					}
					queryNode.appendChild(destroyNode);
					con.sendIQ(aIQ, {
						error_handler: __errorhandler,
						result_handler: function(aJSJaCPacket) {
							eventProcessor.triggerEvent("service_groupChat_deletedRoom", [aJSJaCPacket.getFrom(), reason]);
						},
						default_handler: function(aJSJaCPacket) {
							console.log(aJSJaCPacket.xml());
						}
					});
				},
				connector_groupChat_listRoom: function(event, callbackName, groupChatResource, domain) {
					var aIQ = new JSJaCIQ();
					groupChatResource = groupChatResource || config.groupChatResource;
					domain = domain || config.domain;
					aIQ.setTo(groupChatResource + "." + domain).setType("get");
					aIQ.setQuery(NS_DISCO_ITEMS);
					con.sendIQ(aIQ, {
						error_handler: __errorhandler,
						result_handler: function(aIQ) {
							var roomNodes = $("item", $(aIQ.xml())),
								i,
								roomList = [],
								newRoom,
								curNode;
							for (i = roomNodes.length; i--;) {
								curNode = $(roomNodes[i]);
								newRoom = new Room(curNode.attr("jid"));
								newRoom.setRoomName(curNode.attr("name"));
								roomList.push(newRoom);
							}
							eventProcessor.triggerEvent(callbackName, [roomList]);
						}
					});
				},
				connector_groupChat_listGroupChatResource: function(event, domain) {

				},
				connector_groupChat_joinRoom: function(event, roomUser, password, CBJoinRoom) {
					var aIQ = new JSJaCIQ();
					aIQ.setTo(roomUser.toRoomString()).setType("get").setQuery(NS_DISCO_INFO);
					con.sendIQ(aIQ, {
						error_handler: function(aJSJaCPacket) {
							console.log(aJSJaCPacket.xml());
						},
						result_handler: function(aJSJaCPacket) {
							var $_roomInfo = $(aJSJaCPacket.getDoc()),
								room,
								curUsers = {};
							room = new HICHAT.model.Room({
								roomName: $("identity", $_roomInfo).attr("name"),
								passwordprotected: $("feature[var$='passwordprotected']", $_roomInfo).length > 0 ? true : false,
								hidden: $("feature[var$='hidden']", $_roomInfo).length > 0 ? true : false,
								temporary: $("feature[var$='temporary']", $_roomInfo).length > 0 ? true : false,
								open: $("feature[var$='open']", $_roomInfo).length > 0 ? true : false,
								unmoderated: $("feature[var$='unmoderated']", $_roomInfo).length > 0 ? true : false,
								nonanonymous: $("feature[var$='nonanonymous']", $_roomInfo).length > 0 ? true : false,
								description: $("field[var$='description'] value", $_roomInfo).text(),
								changesubject: Boolean($("field[var$='changesubject'] value", $_roomInfo).text()),
								contactjid: $("field[var$='contactjid'] value", $_roomInfo).text(),
								subject: $("field[var$='subject'] value", $_roomInfo).text(),
								occupants: Number($("field[var$='occupants'] value", $_roomInfo).text()),
								language: $("field[var$='lang'] value", $_roomInfo).text(),
								logs: $("field[var$='logs'] value", $_roomInfo).text(),
								pubsub: $("field[var$='pubsub'] value", $_roomInfo).text()
							});
							curUsers[roomUser.toString()] = roomUser;
							room.setCurUsers(curUsers);
							room.setJidFromString(aJSJaCPacket.getFrom());
							roomUser.setRoom(room);

							var aPresence = new JSJaCPresence(),
								xNode = aPresence.buildNode("x"),
								passwordNode;
							aPresence.setTo(roomUser.toString());
							xNode.setAttribute("xmlns", NS_MUC);
							aPresence.appendNode(xNode);
							if (typeof password === 'string') {
								passwordNode = aPresence.buildNode("password");
								passwordNode.appendChild(document.createTextNode(password));
								xNode.appendChild(passwordNode);
							}
							con.send(aPresence, function(aJSJaCPacket) {
								var $_presence = $(aJSJaCPacket.getDoc()),
									aIQ = new JSJaCIQ(),
									curUsers = {};
								if (aJSJaCPacket.getType() === "error") {
									__errorhandler(aJSJaCPacket);
									return;
								}
								roomUser.setRole($("item", $_presence).attr("role"));
								roomUser.setAffiliation($("item", $_presence).attr("affiliation"));
								roomUser.setJid($("item", $_presence).attr("jid"));
								eventProcessor.triggerEvent("service_groupChat_joinedRoom", [roomUser]);
							});
						}
					});
				},
				connector_groupChat_findRoom: function(event, groupChatResource, domain, CBFindRoom) {
					try {
						var aIQ = new JSJaCIQ();
						groupChatResource = groupChatResource || config.groupChatResource;
						domain = domain || config.domain;
						aIQ.setType("get").setTo(groupChatResource + "." + domain).setQuery(NS_DISCO_ITEMS);
						con.sendIQ(aIQ, {
							error_handler: __errorhandler,
							result_handler: function(aJSJaCPacket) {
								console.log(aJSJaCPacket.getDoc());
							}
						});
					} catch (e) {
						console.log(e.message);
					}
				},
				connector_groupChat_getRoomInfo: function(event, callbackName, room) {
					var aIQ = new JSJaCIQ();
					aIQ.setTo(room.toString()).setType("get").setQuery(NS_DISCO_INFO);
					con.sendIQ(aIQ, {
						error_handler: __errorhandler,
						result_handler: function(aJSJaCPacket) {
							var $_roomInfo = $(aJSJaCPacket.getDoc()),
								room;
							room = new HICHAT.model.Room({
								roomName: $("identity", $_roomInfo).attr("name"),
								passwordprotected: $("feature[var$='passwordprotected']", $_roomInfo).length > 0 ? true : false,
								hidden: $("feature[var$='hidden']", $_roomInfo).length > 0 ? true : false,
								temporary: $("feature[var$='temporary']", $_roomInfo).length > 0 ? true : false,
								open: $("feature[var$='open']", $_roomInfo).length > 0 ? true : false,
								unmoderated: $("feature[var$='unmoderated']", $_roomInfo).length > 0 ? true : false,
								nonanonymous: $("feature[var$='nonanonymous']", $_roomInfo).length > 0 ? true : false,
								description: $("field[var$='description'] value", $_roomInfo).text(),
								changesubject: Boolean($("field[var$='changesubject'] value", $_roomInfo).text()),
								contactjid: $("field[var$='contactjid'] value", $_roomInfo).text(),
								subject: $("field[var$='subject'] value", $_roomInfo).text(),
								occupants: Number($("field[var$='occupants'] value", $_roomInfo).text()),
								language: $("field[var$='lang'] value", $_roomInfo).text(),
								logs: $("field[var$='logs'] value", $_roomInfo).text(),
								pubsub: $("field[var$='pubsub'] value", $_roomInfo).text()
							});
							room.setJidFromString(aJSJaCPacket.getFrom());
							eventProcessor.triggerEvent(callbackName, [room]);
						}
					});
				},
				connector_groupChat_leaveRoom: function(event, room, status, CBLeaveRoom) {
					var aPresence = new JSJaCPresence(),
						statusNode;
					aPresence.setTo(room.toString()).setType("unavailable");
					if (typeof status === 'string') {
						statusNode = aPresence.buildNode("status");
						status.appendChild(document.createTextNode(status));
					}
					aPresence.appendNode(statusNode);
					con.send(aPresence, function(aJSJaCPacket) {
						console.log(aJSJaCPacket.getDoc());
					});
				},
				connector_groupChat_listRoomUsers: function(event, room, CBListRoomUsers) {
					var aIQ = new JSJaCIQ();
					//aIQ.setTo(room.to);
				},
				connector_groupChat_changeUserStatus: function(event, roomUser, show, status, CBChangeUserStatus) {
					var aPresence = new JSJaCPresence(),
						showNode = aPresence.buildNode("show"),
						statusNode = aPresence.buildNode("status");
					aPresence.setTo(roomUser.toRoomString());
					showNode.appendChild(document.createTextNode(oArgs.show));
					statusNode.appendChild(document.createTextNode(oArgs.status));
					aPresence.appendNode(showNode);
					aPresence.appendNode(statusNode);
					con.send(aPresence, function(aJSJaCPacket) {
						console.log(aJSJaCPacket.xml());
					});
				},
				connector_groupChat_changeAffiliation: function(event, roomUser, affiliation, CBChangeAffiliation) {
					var aIQ = new JSJaCIQ(),
						queryNode,
						itemNode;
					aIQ.setTo(roomUser.toRoomString()).setType("set");
					queryNode = aIQ.setQuery(NS_MUC_ADMIN);
					itemNode = aIQ.buildNode("item");
					itemNode.setAttribute("affiliation", affiliation);
					itemNode.setAttribute("jid", roomUser.getJid());
					queryNode.appendChild(itemNode);
					console.log(aIQ.xml());
					con.sendIQ(aIQ, {
						error_handler: __errorhandler,
						result_handler: function(aJSJaCPacket) {
							console.log(aJSJaCPacket.xml());
						}
					});
				},
				connector_groupChat_kickout: function(event, roomUser, reason, CBKickoutUser) {
					var aIQ = new JSJaCIQ(),
						queryNode,
						itemNode,
						reasonNode;
					aIQ.setTo(roomUser.toRoomString()).setType("set");
					queryNode = aIQ.setQuery(NS_MUC_ADMIN);
					itemNode = aIQ.buildNode("item");
					itemNode.setAttribute("nick", roomUser.getNickname());
					itemNode.setAttribute("role", "none");
					if (typeof reason === "string") {
						reasonNode = aIQ.buildNode("reason");
						reasonNode.appendChild(document.createTextNode(reason));
						itemNode.appendChild(reasonNode);
					}
					queryNode.appendChild(itemNode);
					con.sendIQ(aIQ, {
						error_handler: __errorhandler,
						result_handler: function(aJSJaCPacket) {
							console.log(aJSJaCPacket.xml());
						}
					});
				},
				connector_groupChat_outcast: function(event, roomUser, reason, actor, CBOutcastUser) {
					var aIQ = new JSJaCIQ(),
						queryNode,
						itemNode,
						reasonNode,
						actorNode;
					aIQ.setTo(roomUser.toRoomString()).setType("set");
					queryNode = aIQ.setQuery(NS_MUC_ADMIN);
					itemNode = aIQ.buildNode("item");
					itemNode.setAttribute("jid", roomUser.getJid());
					itemNode.setAttribute("affiliation", "outcast");
					if (typeof reason === "string") {
						reasonNode = aIQ.buildNode("reason");
						reasonNode.appendChild(document.createTextNode(reason));
						itemNode.appendChild(reasonNode);
					}
					if (actor instanceof RoomUser) {
						actorNode = aIQ.buildNode("actor");
						actorNode.setAttribute("jid", actor.getJid());
						itemNode.appendChild(actorNode);
					}
					queryNode.appendChild(itemNode);
					con.sendIQ(aIQ, {
						error_handler: __errorhandler,
						result_handler: function(aJSJaCPacket) {
							console.log(aJSJaCPacket.xml());
						}
					});
				},
				connector_groupChat_getOutcastList: function(event, callbackName, room) {
					var aIQ = new JSJaCIQ(),
						querrNode,
						itemNode;
					aIQ.setTo(room.toString()).setType("get");
					queryNode = aIQ.setQuery(NS_MUC_ADMIN);
					itemNode = aIQ.buildNode("item");
					itemNode.setAttribute("affiliation", "outcast");
					queryNode.appendChild(itemNode);
					con.sendIQ(aIQ, {
						error_handler: __errorhandler,
						result_handler: function(aJSJaCPacket) {
							var roomJid = $("iq", aJSJaCPacket.getDoc()).attr("from"),
								$_items = $("item", aJSJaCPacket.getDoc()),
								outcastUserList = [],
								i,
								outcastUser,
								$_item;
							for (i = $_items.length; i--;) {
								$_item = $($_items[i]);
								outcastUser = new User($_item.attr("jid"));
								outcastUserList.push(outcastUser);
							}
							eventProcessor.triggerEvent(callbackName, [outcastUserList, roomJid]);
						}
					});
				},
				connector_groupChat_getOldNickInRoom: function(event, callbackName, room) {
					var aIQ = new JSJaCIQ(),
						queryNode;
					aIQ.setTo(room.toString()).setType("get");
					queryNode = aIQ.setQuery(NS_DISCO_INFO);
					queryNode.setAttribute("node", "x-roomuser-item");
					con.sendIQ(aIQ, {
						error_handler: __errorhandler,
						result_handler: function(aJSJaCPacket) {
							var $_iq = $("iq", aJSJaCPacket.getDoc()),
								$_identity = $("identity", aJSJaCPacket.getDoc());
							if ($_identity.length > 0) {
								$_identity = $($_identity[0]);
								eventProcessor.triggerEvent(callbackName, [$_iq.attr("from"), $_identity.attr("name")]);
							} else {
								eventProcessor.triggerEvent(callbackName, [$_iq.attr("from")]);
							}
						}
					});
				},
				connector_groupChat_deleteOutcast: function(event, userJid, roomJid) {
					var aIQ = new JSJaCIQ(),
						queryNode,
						itemNode;
					aIQ.setTo(roomJid).setType("set");
					queryNode = aIQ.setQuery(NS_MUC_ADMIN);
					itemNode = aIQ.buildNode("item");
					itemNode.setAttribute("affiliation", "none");
					itemNode.setAttribute("jid", userJid);
					queryNode.appendChild(itemNode);
					con.sendIQ(aIQ, {
						error_handler: __errorhandler,
						result_handler: function(aJSJaCPacket) {
							eventProcessor.triggerEvent("service_groupChat_deletedOutCast", [userJid, roomJid]);
						}
					});
				},
				connector_groupChat_changeNickInRoom: function(event, roomUser, nickname) {
					var aPresence = new JSJaCPresence();
					aPresence.setTo(roomUser.toRoomString() + "/" + nickname);
					con.send(aPresence);
				},
				connector_groupChat_addBookmark: function(event, bookmark) {
					var aIQ = new JSJaCIQ(),
						queryNode = aIQ.setType("get").setQuery(NS_PRIVATE);
					queryNode.appendChild(XMLHelper.buildGetBookmark());
					con.sendIQ(aIQ, {
						error_handler: function(aJSJaCPacket) {
							console.log(aJSJaCPacket.xml());
						},
						result_handler: function(aJSJaCPacket) {
							var $_storage = $("storage", aJSJaCPacket.getDoc()),
								aIQ = new JSJaCIQ(),
								queryNode = aIQ.setType("set").setQuery(NS_PRIVATE);
							if ($("conference[jid='" + bookmark.getRoomJid() + "']", $_storage).length !== 0) {
								eventProcessor.triggerEvent("service_groupChat_addedBookmarkFailed", ["该房间的书签已经存在"]);
								return;
							}
							$_storage.append($("conference", XMLHelper.buildAddBookmark({
								tag: bookmark.getTag(),
								autojoin: bookmark.isAutojoin(),
								roomJid: bookmark.getRoomJid(),
								nickname: bookmark.getNickname()
							})));
							queryNode.appendChild($_storage.get()[0]);
							con.sendIQ(aIQ, {
								error_handler: function(aJSJaCPacket) {
									console.log(aJSJaCPacket.xml());
								},
								result_handler: function(aJSJaCPacket) {
									eventProcessor.triggerEvent("service_groupChat_addedBookmark");
								},
								default_handler: function(aJSJaCPacket) {
									console.log(aJSJaCPacket.xml());
								}
							});
						},
						default_handler: function(aJSJaCPacket) {
							console.log(aJSJaCPacket.xml());
						}
					});
				},
				connector_groupChat_getBookmarks: function(event, callbackName) {
					var aIQ = new JSJaCIQ(),
						queryNode = aIQ.setType("get").setQuery(NS_PRIVATE);
					queryNode.appendChild(XMLHelper.buildGetBookmark());
					con.sendIQ(aIQ, {
						error_handler: function(aJSJaCPacket) {
							console.log(aJSJaCPacket.xml());
						},
						result_handler: function(aJSJaCPacket) {
							var conferenceNodes = $("conference", aJSJaCPacket.getDoc()),
								i,
								bookmarks = [],
								cur;
							for (i = conferenceNodes.length; i--;) {
								cur = $(conferenceNodes[i]);
								bookmarks.push(new Bookmark({
									tag: cur.attr("name"),
									autojoin: cur.attr("autojoin") === "true" ? true : false,
									roomJid: cur.attr("jid"),
									nickname: $("nick", cur).text()
								}));
							}
							eventProcessor.triggerEvent(callbackName, [bookmarks]);
						},
						default_handler: function(aJSJaCPacket) {
							console.log(aJSJaCPacket.xml());
						}
					});
				},
				connector_groupChat_deleteBookmark: function(event, roomJid) {
					var aIQ = new JSJaCIQ(),
						queryNode = aIQ.setType("get").setQuery(NS_PRIVATE);
					queryNode.appendChild(XMLHelper.buildGetBookmark());
					con.sendIQ(aIQ, {
						error_handler: function(aJSJaCPacket) {
							console.log(aJSJaCPacket.xml());
						},
						result_handler: function(aJSJaCPacket) {
							var $_storage = $("storage", aJSJaCPacket.getDoc()),
								aIQ = new JSJaCIQ(),
								queryNode = aIQ.setType("set").setQuery(NS_PRIVATE);
							$("conference[jid='" + roomJid + "']", $_storage).remove();
							queryNode.appendChild($_storage.get()[0]);
							con.sendIQ(aIQ, {
								error_handler: function(aJSJaCPacket) {
									console.log(aJSJaCPacket.xml());
								},
								result_handler: function(aJSJaCPacket) {
									eventProcessor.triggerEvent("service_groupChat_deletedBookmark");
								},
								default_handler: function(aJSJaCPacket) {
									console.log(aJSJaCPacket.xml());
								}
							});
						},
						default_handler: function(aJSJaCPacket) {
							console.log(aJSJaCPacket.xml());
						}
					});
				},
				connector_groupChat_updateBookmark: function(event, bookmark) {
					var aIQ = new JSJaCIQ(),
						queryNode = aIQ.setType("get").setQuery(NS_PRIVATE);
					queryNode.appendChild(XMLHelper.buildGetBookmark());
					con.sendIQ(aIQ, {
						error_handler: function(aJSJaCPacket) {
							console.log(aJSJaCPacket.xml());
						},
						result_handler: function(aJSJaCPacket) {
							var $_storage = $("storage", aJSJaCPacket.getDoc()),
								aIQ = new JSJaCIQ(),
								queryNode = aIQ.setType("set").setQuery(NS_PRIVATE),
								conferenceNode;
							conferenceNode = $("conference[jid='" + bookmark.getRoomJid() + "']", $_storage);
							if (conferenceNode.length === 0) {
								/*不存在*/
								return;
							}
							conferenceNode.attr("jid", bookmark.getRoomJid()).attr("name", bookmark.getTag()).attr("autojoin", bookmark.isAutojoin() ? "true" : "false");
							if ($("nick", conferenceNode).length === 0) {
								conferenceNode.append($("<nick></nick>"));
								$("nick", conferenceNode).text(bookmark.getNickname());
							}
							queryNode.appendChild($_storage.get()[0]);
							con.sendIQ(aIQ, {
								error_handler: function(aJSJaCPacket) {
									console.log(aJSJaCPacket.xml());
								},
								result_handler: function(aJSJaCPacket) {
									eventProcessor.triggerEvent("service_groupChat_updatedBookmark", [bookmark]);
								},
								default_handler: function(aJSJaCPacket) {
									console.log(aJSJaCPacket.xml());
								}
							});
						},
						default_handler: function(aJSJaCPacket) {
							console.log(aJSJaCPacket.xml());
						}
					});
				}
			});
		}()),
		__initConnection = function() {
			con.registerHandler('message', handleModule.handleMessage);
			con.registerHandler('presence', handleModule.handlePresence);
			con.registerHandler('iq', handleModule.handleIQ);
			con.registerHandler('onconnect', handleModule.handleConnected);
			con.registerHandler('onerror', handleModule.handleError);
			con.registerHandler('status_changed', handleModule.handleStatusChanged);
			con.registerHandler('ondisconnect', handleModule.handleDisconnected);
			con.registerIQGet('query', NS_VERSION, handleModule.handleIqVersion);
			con.registerIQGet('query', NS_TIME, handleModule.handleIqTime);
		},
		__isConnected = function() {
			if (con && con.connected()) {
				return true;
			}
			return false;
		},
		__disconnect = function() {
			if (__isConnected()) {
				con.disconnect();
			}
		};
}(jQuery, window));