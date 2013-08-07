HICHAT.namespace("HICHAT.connector");
HICHAT.connector = (function($, window) {
	var eventProcessor = HICHAT.utils.eventProcessor,
		config = HICHAT.config,
		User = HICHAT.model.SimpleUser,
		GroupUser = HICHAT.model.GroupChatUser,
		VCard = HICHAT.model.VCard,
		Presence = HICHAT.model.Presence,
		Room = HICHAT.model.Room,
		RoomUser = HICHAT.model.RoomUser,
		OutcastUser = HICHAT.model.OutcastUser,
		con,
		handles = (function() {
			var waste,
				__handleGroupChatPresence = function(aPresence) {
					var roomUser = new RoomUser(aPresence.getFrom()),
						$_presence = $(aPresence.getDoc()),
						type = aPresence.getType(),
						status = $("status", $_presence);
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
								eventProcessor.triggerEvent("service_groupChat_changedNickname", [roomUser, $("item", $_presence).attr("nick")]);
							}
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
					console.log(aPresence.xml());
				};
			return {
				handleIQ: function(aIQ) {
					console.log("handleIQ:" + aIQ.xml());
				},
				handleMessage: function(aJSJaCPacket) {
					try {
						if (aJSJaCPacket.getType() === "groupchat") {
							eventProcessor.triggerEvent("service_groupChat_recieve", [new RoomUser(aJSJaCPacket.getFrom()), aJSJaCPacket.getBody().htmlEnc()]);
						} else {
							eventProcessor.triggerEvent("service_privacyChat_recieve", [new User(aJSJaCPacket.getFrom()), aJSJaCPacket.getBody().htmlEnc()]);
						}
					} catch (e) {
						console.log(e);
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
					var errorCode = $(e).attr("code");
					if (Number(errorCode) === 401) {
						eventProcessor.triggerEvent("service_selfControl_logined", [false]);
					}
					__disconnect();
				},
				handleStatusChanged: function(status) {
					console.log("Status changed : ", status);
				},
				handleConnected: function() {
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
		messageModule = (function() {
			return {
				privacySendMsg: function(msgBody, user, CBPrivacySendMsg) {
					var msg = new JSJaCMessage();
					msg.setTo(user.toString());
					msg.setBody(msgBody);
					con.send(msg);
					/**/
				},
				groupBroadcastMsg: function(room, msgBody, CBGroupBroadcastMsg) {
					var aMessage = new JSJaCMessage(),
						bodyNode = aMessage.buildNode("body");
					aMessage.setTo(room.toString()).setType("groupchat");
					bodyNode.appendChild(document.createTextNode(msgBody));
					aMessage.appendNode(bodyNode);
					con.send(aMessage);
				}
			};
		}()),
		vCardModule = (function() {
			return {
				getOtherVCard: function(user, CBGetOtherVCard) {
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
							var vCardXml = $("vCard", $(aJSJaCPacket.xml())),
								vCard = new VCard({
									jid: user.getJid(),
									domain: user.getDomain(),
									nickname: $("NICKNAME", vCardXml).text(),
									sex: $("SEX", vCardXml).text(),
									bday: $("BDAY", vCardXml).text(),
									email: $("EMAIL", vCardXml).text(),
									tele: $("TELE", vCardXml).text(),
									desc: $("DESC", vCardXml).text()
								}),
								aPresence = new JSJaCPresence();
							eventProcessor.triggerEvent("service_roster_getedOtherVCard", [vCard]);
							aPresence.setTo(user.toString());
							con.send(aPresence);
						},
						default_handler: function() {}
					});
				},
				getMyVCard: function(CBGetMyVCard) {
					var aIQ = new JSJaCIQ(),
						aVCardNode = aIQ.buildNode("vCard");
					aIQ.setType("get");
					aVCardNode.setAttribute('xmlns', NS_VCARD);
					aIQ.appendNode(aVCardNode);
					con.sendIQ(aIQ, {
						error_handler: function() {
							//CBGetMyVCard.call(eventProcessor);
						},
						result_handler: function(aJSJaCPacket) {
							var vCardXml = $("vCard", $(aJSJaCPacket.xml())),
								vCard = new VCard({
									jid: aJSJaCPacket.getToJID().getNode(),
									domain: aJSJaCPacket.getToJID().getDomain(),
									nickname: $("NICKNAME", vCardXml).text(),
									sex: $("SEX", vCardXml).text(),
									bday: $("BDAY", vCardXml).text(),
									email: $("EMAIL", vCardXml).text(),
									tele: $("TELE", vCardXml).text(),
									desc: $("DESC", vCardXml).text()
								});
							eventProcessor.triggerEvent("service_selfControl_drawMyVCard", [vCard]);
						},
						default_handler: function() {
							//CBGetMyVCard.call(eventProcessor);
						}
					});
				},
				updateMyVCard: function(vCard, CBDrawVCard) {
					var aIQ = new JSJaCIQ(),
						avcardNode = aIQ.buildNode("vCard"),
						arg,
						that = this;
					aIQ.setType("set");
					avcardNode.setAttribute("xmlns", NS_VCARD);
					/*
						this.nickname = oArgs.nickname;
						this.sex = oArgs.sex;
						this.birthday = oArgs.bday;
						this.email = oArgs.email;
						this.telephone = oArgs.tele;
						this.description = oArgs.desc;
						*/
					avcardNode.appendChild(aIQ.buildNode("NICKNAME", vCard.getNickname()));
					avcardNode.appendChild(aIQ.buildNode("SEX", vCard.getSex()));
					avcardNode.appendChild(aIQ.buildNode("BDAY", vCard.getBirthday()));
					avcardNode.appendChild(aIQ.buildNode("EMAIL", vCard.getEmail()));
					avcardNode.appendChild(aIQ.buildNode("TELE", vCard.getTelephone()));
					avcardNode.appendChild(aIQ.buildNode("DESC", vCard.getDescription()));
					aIQ.appendNode(avcardNode);
					con.sendIQ(aIQ, {
						error_handler: function() {
							eventProcessor.triggerEvent("service_selfControl_drawMyVCard");
						},
						result_handler: function(aJSJaCPacket) {
							that.getMyVCard();
						},
						default_handler: function() {
							eventProcessor.triggerEvent("service_selfControl_drawMyVCard");
						}
					});
				}
			};
		}()),

		subscribeModule = (function() {
			return {
				sendSubscribe: function(user, tag, CBSendSubscribe) {
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
				sendSubscribed: function(user, tag, CBSendSubscribed) {
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
				sendUnsubscribed: function(user, CBSendUnsubscribed) {
					var aPresence = new JSJaCPresence();
					aPresence.setTo(user.toString());
					aPresence.setType("unsubscribed");
					con.send(aPresence);
					if (typeof CBSendUnsubscribed === "function") {}
				},
				sendUnsubscribe: function(user, CBSendUnsubscribe) {
					var aPresence = new JSJaCPresence();
					aPresence.setTo(user.toString());
					aPresence.setType("unsubscribe");
					con.send(aPresence);
					if (typeof CBSendUnsubscribe === "function") {}
				},
				sendBothSubscribe: function(user, tag) {
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
				}
			};
		}()),

		rosterModule = (function() {
			return {
				rosterRequest: function(CBRosterRequest) {
					var aIQ = new JSJaCIQ();
					aIQ.setType("get").setQuery(NS_ROSTER);
					con.sendIQ(aIQ, {
						error_handler: function() {},
						result_handler: function(aIQ) {
							$("item", aIQ.getQuery()).each(function() {
								var that = $(this),
									wholeJid = that.attr("jid"),
									user = new User({
										jid: wholeJid.substring(0, wholeJid.indexOf("@")),
										domain: wholeJid.substring(wholeJid.indexOf("@") + 1)
									});
								if (that.attr("subscription") === 'both') {
									vCardModule.getOtherVCard(user);
								}
							});
							con.send(new JSJaCPresence());
						},
						default_handler: function() {}
					});
				},
				removeRoster: function(user, CBRemoveRoster) {
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
				}
			};
		}()),

		connectModule = (function() {
			return {
				login: function(username, password) {
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
						pass: password
					};
					con.connect(connArgs);
				},

				logout: function() {
					var p = new JSJaCPresence();
					p.setType("unavailable");
					con.send(p);
					con.disconnect();
				}
			};
		}()),

		roomModule = (function() {
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
			return {
				/*
					oArgs = {
						roomId: $("input[name='roomId']", createRoomDialog).val(),
						roomName: $("input[name='roomName']", createRoomDialog).val(),
						roomDesc: $("textarea[name='roomDesc']").val(),
						enableloging: $("textarea[name='enableloging']").val(),
						changesubject: $("input[name='changesubject']").val(),
						allowinvites: $("input[name='allowinvites']").val(),
						maxusers: $("select[name='maxusers']").val(),
						publicroom: $("input[name='publicroom']").val(),
						persistentroom: $("input[name='persistentroom']").val(),
						moderatedroom: $("input[name='moderatedroom']").val(),
						membersonly: $("input[name='membersonly']").val(),
						passwordprotectedroom: $("input[name='passwordprotectedroom']").val(),
						roomsecret: $("input[name='roomsecret']").val(),
						whois: $("input[name='whois']").val(),
						roomadmins: []
					};

				*/
				createRoom: function(roomConfig, CBCreateRoom) {
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
				deleteRoom: function(room, newRoom, reason, password, CBDeleteRoom) {
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
							eventProcessor.triggerEvent("service_groupChat_deletedRoom", [aJSJaCPacket.getFromJID().getNode()]);
						},
						default_handler: function(aJSJaCPacket) {
							console.log(aJSJaCPacket.xml());
						}
					});
				},
				listRoom: function(groupChatResource, domain) {
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
							eventProcessor.triggerEvent("service_groupChat_listedRoom", [roomList]);
						}
					});
				},
				listGroupChatResource: function(domain) {

				},
				/*
					roomUser
					password (optional)
				*/
				joinRoom: function(roomUser, password, CBJoinRoom) {
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
						var $_presence = $(aJSJaCPacket.getDoc());
						if (aJSJaCPacket.getType() === "error") {
							__errorhandler(aJSJaCPacket);
							return;
						}
						roomUser.setRole($("item", $_presence).attr("role"));
						roomUser.setAffiliation($("item", $_presence).attr("affiliation"));
						roomUser.setJid($("item", $_presence).attr("jid"));
						eventProcessor.triggerEvent("service_groupChat_joinedRoom", [roomUser]);
					});
				},
				/*
					domain
					groupChatResource
				*/
				findRoom: function(groupChatResource, domain, CBFindRoom) {
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
				getRoomInfo: function(room, CBGetRoomInfo) {
					var aIQ = new JSJaCIQ();
					aIQ.setTo(room.toString()).setType("get").setQuery(NS_DISCO_INFO);
					con.sendIQ(aIQ, {
						error_handler: __errorhandler,
						result_handler: function(aJSJaCPacket) {
							try {
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
								eventProcessor.triggerEvent("service_groupChat_getedRoomInfo", [room]);
							} catch (e) {
								console.log(e.message);
							}
						}
					});
				},
				/*
					groupChateventProcessor
					domain
					roomID
					nickname
					status (optional)
				*/
				leaveRoom: function(room, status, CBLeaveRoom) {
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
				listRoomUsers: function(room, CBListRoomUsers) {
					var aIQ = new JSJaCIQ();
					//aIQ.setTo(room.to);
				},
				/*
					nickname
					domain
					roomID
					groupChateventProcessor
					show
					status
				*/
				changeUserStatus: function(roomUser, show, status, CBChangeUserStatus) {
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
				changeAffiliation: function(roomUser, affiliation, CBChangeAffiliation) {
					var aIQ = new JSJaCIQ(),
						queryNode,
						itemNode;
					aIQ.setTo(roomUser.toRoomString()).setType("set");
					queryNode = aIQ.setQuery(NS_MUC_ADMIN);
					itemNode = aIQ.buildNode("item");
					itemNode.setAttribute("affiliation", affiliation);
					itemNode.setAttribute("jid", roomUser.getJid());
					queryNode.appendChild(itemNode);
					con.sendIQ(aIQ, {
						error_handler: __errorhandler,
						result_handler: function(aJSJaCPacket) {
							console.log(aJSJaCPacket.xml());
						}
					});
				},
				kickoutUser: function(roomUser, reason, CBKickoutUser) {
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
				outcastUser: function(roomUser, reason, actor, CBOutcastUser) {
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
				getOutcastList: function(room) {
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
							eventProcessor.triggerEvent("service_groupChat_getedOutcastList", [outcastUserList, roomJid]);
						}
					});
				},
				getOldNickInRoom: function(room) {
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
								eventProcessor.triggerEvent("service_groupChat_getedOldNick", [$_iq.attr("from"), $_identity.attr("name")]);
							} else {
								eventProcessor.triggerEvent("service_groupChat_getedOldNick", [$_iq.attr("from")]);
							}
						}
					});
				},
				deleteOutcast: function(userJid, roomJid) {
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
				changeNickInRoom: function(roomUser, nickname) {
					var aPresence = new JSJaCPresence();
					aPresence.setTo(roomUser.toRoomString() + "/" + nickname);
					con.send(aPresence);
				}
			};
		}());

	__initConnection = function() {
		con.registerHandler('message', handles.handleMessage);
		con.registerHandler('presence', handles.handlePresence);
		con.registerHandler('iq', handles.handleIQ);
		con.registerHandler('onconnect', handles.handleConnected);
		con.registerHandler('onerror', handles.handleError);
		con.registerHandler('status_changed', handles.handleStatusChanged);
		con.registerHandler('ondisconnect', handles.handleDisconnected);
		con.registerIQGet('query', NS_VERSION, handles.handleIqVersion);
		con.registerIQGet('query', NS_TIME, handles.handleIqTime);
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

	return {
		login: connectModule.login,
		logout: connectModule.logout,

		getMyVCard: vCardModule.getMyVCard,
		updateMyVCard: vCardModule.updateMyVCard,
		getOtherVCard: vCardModule.getOtherVCard,

		privacySendMsg: messageModule.privacySendMsg,
		groupSendMsg: messageModule.groupBroadcastMsg,

		sendSubscribe: subscribeModule.sendSubscribe,
		sendSubscribed: subscribeModule.sendSubscribed,
		sendUnsubscribe: subscribeModule.sendUnsubscribe,
		sendUnsubscribed: subscribeModule.sendUnsubscribed,
		sendBothSubscribe: subscribeModule.sendBothSubscribe,

		rosterRequest: rosterModule.rosterRequest,
		removeRoster: rosterModule.removeRoster,

		createRoom: roomModule.createRoom,
		deleteRoom: roomModule.deleteRoom,
		joinRoom: roomModule.joinRoom,
		getRoomInfo: roomModule.getRoomInfo,
		listRoom: roomModule.listRoom,
		leaveRoom: roomModule.leaveRoom,
		changeAffiliation: roomModule.changeAffiliation,
		kickout: roomModule.kickoutUser,
		outcast: roomModule.outcastUser,
		getOutcastList: roomModule.getOutcastList,
		getOldNickInRoom: roomModule.getOldNickInRoom,
		deleteOutcast: roomModule.deleteOutcast,
		changeNickInRoom: roomModule.changeNickInRoom,

		isConnected: __isConnected,
		closeConnect: __disconnect,
		bindModules: function(oArgs) {
			config = oArgs.config;
		}
	};
}(jQuery, window));