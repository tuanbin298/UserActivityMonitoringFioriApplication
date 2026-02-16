sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"useraudit/test/integration/pages/UserAuthLogMain"
], function (JourneyRunner, UserAuthLogMain) {
    'use strict';

    var runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('useraudit') + '/test/flp.html#app-preview',
        pages: {
			onTheUserAuthLogMain: UserAuthLogMain
        },
        async: true
    });

    return runner;
});

