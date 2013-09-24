HICHAT.namespace("HICHAT.XMLHelper");
HICHAT.XMLHelper = (function($, window) {
	var xmlFrame = HICHAT.XMLFrame,
		VCard = HICHAT.model.VCard,
		WorkInfo = HICHAT.model.WorkInfo,
		HomeInfo = HICHAT.model.HomeInfo,
		PersonalInfo = HICHAT.model.PersonalInfo,
		HeadPortrait = HICHAT.model.HeadPortrait,
		__buildVCard = function(vCard) {
			var result;
			if (vCard.hasHeadPortrait()) {
				result = (new DOMParser()).parseFromString(xmlFrame.vCardWithPhoto, "text/xml");
				result.querySelector("PHOTO TYPE").appendChild(result.createTextNode(vCard.getHeadPortrait().getType()));
				result.querySelector("PHOTO BINVAL").appendChild(result.createTextNode(vCard.getHeadPortrait().getBinval()));
			} else {
				result = (new DOMParser()).parseFromString(xmlFrame.vCardNoPhoto, "text/xml");
			}
			$("N FAMILY", result).text(vCard.getPersonalInfo().getFamilyName());
			$("N GIVEN", result).text(vCard.getPersonalInfo().getName());
			$("N MIDDLE", result).text(vCard.getPersonalInfo().getMiddleName());
			$("ORG ORGNAME", result).text(vCard.getWorkInfo().getCompany());
			$("ORG ORGUNIT", result).text(vCard.getWorkInfo().getDepartment());
			$("FN", result).text(vCard.getPersonalInfo().getName() + " " + vCard.getPersonalInfo().getMiddleName() + " " + vCard.getPersonalInfo().getFamilyName());
			$("URL", result).text(vCard.getWorkInfo().getWebSite());
			$("TITLE", result).text(vCard.getWorkInfo().getTitle());
			$("NICKNAME", result).text(vCard.getPersonalInfo().getNickname());
			$("EMAIL USERID", result).text(vCard.getPersonalInfo().getEmail());
			$("TEL", result).each(function() {
				var that = $(this),
					info;
				if ($("WORK", that).length !== 0) {
					info = vCard.getWorkInfo();
				} else {
					info = vCard.getHomeInfo();
				}
				if ($("PAGER", that).length !== 0) {
					$("NUMBER", that).text(info.getBleeper());
				}
				if ($("CELL", that).length !== 0) {
					$("NUMBER", that).text(info.getTelephone());
				}
				if ($("VOICE", that).length !== 0) {
					$("NUMBER", that).text(info.getPhone());
				}
				if ($("FAX", that).length !== 0) {
					$("NUMBER", that).text(info.getFax());
				}
			});
			$("ADR", result).each(function() {
				var that = $(this),
					info;
				if ($("WORK", that).length !== 0) {
					info = vCard.getWorkInfo();
				} else {
					info = vCard.getHomeInfo();
				}
				$("PCODE", that).text(info.getPostCode());
				$("REGION", that).text(info.getProvince());
				$("STREET", that).text(info.getStreet());
				$("CTRY", that).text(info.getCountry());
				$("LOCALITY", that).text(info.getCity());
			});
			return result.childNodes[0];
		},
		__parseVCard = function(doc) {
			var homeInfo,
				workInfo,
				personalInfo,
				headPortrait,
				vCard,
				info;
			doc = $(doc);
			personalInfo = new PersonalInfo({
				name: $("N GIVEN", doc).text(),
				middleName: $("N MIDDLE", doc).text(),
				familyName: $("N FAMILY", doc).text(),
				nickname: $("NICKNAME", doc).text(),
				email: $("EMAIL USERID", doc).text()
			});
			homeInfo = new HomeInfo({});
			workInfo = new WorkInfo({
				company: $("ORG ORGNAME", doc).text(),
				department: $("ORG ORGUNIT", doc).text(),
				title: $("TITLE", doc).text(),
				webSite: $("URL", doc).text()
			});
			$("TEL", doc).each(function() {
				var that = $(this),
					info;
				if ($("WORK", that).length !== 0) {
					info = workInfo;
				} else {
					info = homeInfo;
				}
				if ($("PAGER", that).length !== 0) {
					info.setBleeper($("NUMBER", that).text());
				}
				if ($("CELL", that).length !== 0) {
					info.setTelephone($("NUMBER", that).text());
				}
				if ($("VOICE", that).length !== 0) {
					info.setPhone($("NUMBER", that).text());
				}
				if ($("FAX", that).length !== 0) {
					info.setFax($("NUMBER", that).text());
				}
			});
			$("ADR", doc).each(function() {
				var that = $(this),
					info;
				if ($("WORK", that).length !== 0) {
					info = workInfo;
				} else {
					info = homeInfo;
				}
				info.setPostCode($("PCODE", that).text());
				info.setProvince($("REGION", that).text());
				info.setStreet($("STREET", that).text());
				info.setCountry($("CTRY", that).text());
				info.setCity($("LOCALITY", that).text());
			});

			headPortrait = new HeadPortrait({
				type: $("PHOTO TYPE", doc).text(),
				binval: $("PHOTO BINVAL", doc).text()
			});
			vCard = new VCard({
				homeInfo: homeInfo,
				workInfo: workInfo,
				personalInfo: personalInfo,
				headPortrait: headPortrait
			});
			return vCard;
		},
		/*
			tag
			autoJoin
			roomJid
			nickname
		*/
		__buildAddBookmark = function(oArgs) {
			var result = $(xmlFrame.addBookmarkStorage),
				confNode = $("conference", result);
			confNode.attr("name", oArgs.tag);
			confNode.attr("autojoin", oArgs.autojoin);
			confNode.attr("jid", oArgs.roomJid);
			$("nick", confNode).text(oArgs.nickname);
			return result.get()[0];
		},
		__buildGetBookmark = function() {
			var result = $(xmlFrame.getBookmarkStorage);
			return result.get()[0];
		};
	return {
		buildVCard: __buildVCard,
		parseVCard: __parseVCard,
		buildAddBookmark: __buildAddBookmark,
		buildGetBookmark: __buildGetBookmark
	};
}(jQuery, window));