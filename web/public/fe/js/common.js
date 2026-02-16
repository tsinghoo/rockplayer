Common = {
	VerifiedNoSignature: 0,
	VerifiedSucc: 1,
	VerifiedFail: 2,
	VerifiedForbidden: 3
};

var email_regex = /^[\w\-\.]+@[\w\-\.]+(\.\w+)+$/;
function validateEmail(email) {
	return email_regex.test(email);
}
function showError(msg) {
	alert(msg);
}

function myConfirm(dialogText, okFunc, cancelFunc, dialogTitle) {
	$('<div style="padding: 10px; max-width: 500px; word-wrap: break-word;">' + dialogText + '</div>').dialog({
		draggable: true,
		modal: true,
		resizable: true,
		width: 'auto',
		title: dialogTitle || 'Confirm',
		minHeight: 75,
		buttons: {
			OK: function () {
				if (typeof (okFunc) == 'function') {
					setTimeout(okFunc, 50);
				}
				$(this).dialog('destroy');
			},
			Cancel: function () {
				if (typeof (cancelFunc) == 'function') {
					setTimeout(cancelFunc, 50);
				}
				$(this).dialog('destroy');
			}
		}
	});
}


