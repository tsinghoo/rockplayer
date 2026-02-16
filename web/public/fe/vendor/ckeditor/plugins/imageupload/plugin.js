/**
 * Copyright (c) 2014, CKSource - Frederico Knabben. All rights reserved.
 * Licensed under the terms of the MIT License (see LICENSE.md).
 *
 * Basic sample plugin inserting current date and time into the CKEditor editing area.
 *
 * Created out of the CKEditor Plugin SDK:
 * http://docs.ckeditor.com/#!/guide/plugin_sdk_intro
 */
var currentEditor = null;

// Register the plugin within the editor.
CKEDITOR.plugins.add( 'imageupload', {

	// Register the icons. They must match command names.
	icons: 'imageupload',

	// The plugin initialization logic goes inside this method.
	init: function( editor ) {

		// Define the editor command that inserts a timestamp.
		editor.addCommand( 'uploadImage', {

			// Define the function that will be fired when the command is executed.
			exec: function( editor ) {
				
				//onImageUpload(editor);
				currentEditor = editor;
				/*
				var impageUploadPluginForm = $("#impageUploadPluginForm");
				if(impageUploadPluginForm == null || impageUploadPluginForm.length == 0)
				{
					var imageUploadPluginFormStr = 
						'<form class="form-horizontal " action="${pageContext.request.contextPath}/common/perform_upload_file" method="post" enctype="multipart/form-data" id="impageUploadPluginForm" style="display:none;">' +
						'	<p class="pt20">' +
						'    	<input type="file" name="imageUploadFileField" class="dn" id="imageUploadFileField"/>' +
						'        <input type="hidden" id="savePath" name="savePath" value="image_upload_plugin_image"/>' +
						'        <input type="hidden" id="resizeHeight" name="resizeHeight" value=""/>' +
						'        <input type="hidden" id="resizeWidth" name="resizeWidth" value=""/>' +
						'        <input type="hidden" id="extraInfo" name="extraInfo" value=""/>' +
						'    </p>' +
						'</form>';
					
					$('body').append(imageUploadPluginFormStr);
				}
				*/
				$("#imageUploadFileField").click();
			}
		});

		// Create the toolbar button that executes the above command.
		editor.ui.addButton( 'Imageupload', {
			label: '上传图片',
			command: 'uploadImage',
			toolbar: 'imageupload'
		});
	}
});

$(function(){
	$("#imageUploadFileField").on('change', function(event){
		$("#impageUploadPluginForm").attr("action") ? ac = $("#impageUploadPluginForm").attr("action") : ac = '/common/perform_upload_file';
		showLoadingHs();
		$("#impageUploadPluginForm").ajaxSubmit({
	        type: "post",
	        url: ac,
	        cache: false,
	        success: function(data) {
	        	hideLoadingHs();
	        	
	        	if($.isBlank(data.errorMessage))
	        	{
	        		currentEditor.insertHtml( '<img src="' + data.fileFieldStorageFileName + '" />');
	        	}
	        	else
	        	{
	        		$.alert(data.commonMessage);
	        	}
	        },
	        error: function(XMLHttpRequest, textStatus, errorThrown) {
	        	hideLoadingHs();
	            alert("上传失败，请检查网络后重试");
	        }
	    });
	});
});
