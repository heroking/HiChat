HICHAT.namespace("HICHAT.XMLFrame");
HICHAT.XMLFrame = (function($, window) {
	return {
		vCardWithPhoto: '<vCard xmlns="vcard-temp"><N><FAMILY/><GIVEN/><MIDDLE/></N><ORG><ORGNAME/><ORGUNIT/></ORG><FN/><URL/><TITLE/><NICKNAME/><PHOTO><BINVAL></BINVAL><TYPE></TYPE></PHOTO><EMAIL><HOME/><INTERNET/><PREF/><USERID/></EMAIL><TEL><PAGER/><WORK/><NUMBER/></TEL><TEL><CELL/><WORK/><NUMBER/></TEL><TEL><VOICE/><WORK/><NUMBER/></TEL><TEL><FAX/><WORK/><NUMBER/></TEL><TEL><PAGER/><HOME/><NUMBER/></TEL><TEL><CELL/><HOME/><NUMBER/></TEL><TEL><VOICE/><HOME/><NUMBER/></TEL><TEL><FAX/><HOME/><NUMBER/></TEL><ADR><WORK/><PCODE/><REGION/><STREET/><CTRY/><LOCALITY/></ADR><ADR><HOME/><PCODE/><REGION/><STREET/><CTRY/><LOCALITY/></ADR></vCard>',
		vCardNoPhoto: '<vCard xmlns="vcard-temp"><N><FAMILY/><GIVEN/><MIDDLE/></N><ORG><ORGNAME/><ORGUNIT/></ORG><FN/><URL/><TITLE/><NICKNAME/><EMAIL><HOME/><INTERNET/><PREF/><USERID/></EMAIL><TEL><PAGER/><WORK/><NUMBER/></TEL><TEL><CELL/><WORK/><NUMBER/></TEL><TEL><VOICE/><WORK/><NUMBER/></TEL><TEL><FAX/><WORK/><NUMBER/></TEL><TEL><PAGER/><HOME/><NUMBER/></TEL><TEL><CELL/><HOME/><NUMBER/></TEL><TEL><VOICE/><HOME/><NUMBER/></TEL><TEL><FAX/><HOME/><NUMBER/></TEL><ADR><WORK/><PCODE/><REGION/><STREET/><CTRY/><LOCALITY/></ADR><ADR><HOME/><PCODE/><REGION/><STREET/><CTRY/><LOCALITY/></ADR></vCard>',
		addBookmarkStorage: "<storage xmlns='storage:bookmarks'><conference name='' autojoin='' jid=''><nick></nick></conference></storage>",
		getBookmarkStorage: "<storage xmlns='storage:bookmarks'/>"
	};
}(jQuery, window));