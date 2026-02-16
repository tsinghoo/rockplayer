/**
 * Copyright (c) 2014, CKSource - Frederico Knabben. All rights reserved.
 * Licensed under the terms of the MIT License (see LICENSE.md).
 * 
 * Basic sample plugin inserting current date and time into the CKEditor editing
 * area.
 * 
 * Created out of the CKEditor Plugin SDK:
 * http://docs.ckeditor.com/#!/guide/plugin_sdk_intro
 */
var currentEditor = null;

// Register the plugin within the editor.
CKEDITOR.plugins.add( 'mediaUpload', {

	// Register the icons. They must match command names.
	icons: 'mediaUpload',

	// The plugin initialization logic goes inside this method.
	init: function( editor ) {

		// Define the editor command that inserts a timestamp.
		editor.addCommand( 'mediaUpload', {

			// Define the function that will be fired when the command is
			// executed.
			exec: function( editor ) {
				
				// onImageUpload(editor);
				currentEditor = editor;
				/*
				 * var impageUploadPluginForm = $("#impageUploadPluginForm");
				 * if(impageUploadPluginForm == null ||
				 * impageUploadPluginForm.length == 0) { var
				 * imageUploadPluginFormStr = '<form class="form-horizontal "
				 * action="${pageContext.request.contextPath}/common/perform_upload_file"
				 * method="post" enctype="multipart/form-data"
				 * id="impageUploadPluginForm" style="display:none;">' + '
				 * <p class="pt20">' + ' <input type="file"
				 * name="imageUploadFileField" class="dn"
				 * id="imageUploadFileField"/>' + ' <input type="hidden"
				 * id="savePath" name="savePath"
				 * value="image_upload_plugin_image"/>' + ' <input type="hidden"
				 * id="resizeHeight" name="resizeHeight" value=""/>' + ' <input
				 * type="hidden" id="resizeWidth" name="resizeWidth" value=""/>' + '
				 * <input type="hidden" id="extraInfo" name="extraInfo"
				 * value=""/>' + ' </p>' + '</form>';
				 * 
				 * $('body').append(imageUploadPluginFormStr); }
				 */
				$("#mediaUploadFileField").click();
			}
		});

		// Create the toolbar button that executes the above command.
		editor.ui.addButton( 'mediaUpload', {
			label: '上传视频',
			command: 'mediaUpload',
			toolbar: 'mediaUpload'
		});
	}
});

var storeKey = null;
var storeAs = null;

var progress = function (p,checkpoint) {
	  return function (done) {
	  	if(storeKey!=null){
	  		 var storage = window.localStorage; 
	  		$("#uploadProgress").html("视频上传进度:"+(p*100).toFixed(2)+"%");
	  		checkpoint.storeAs = storeAs;
	  		 storage.setItem(storeKey,JSON.stringify(checkpoint));
	  	}
	    done();
	  }
};

function myS4() {
    return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
}
function myguid() {
    return (myS4()+myS4()+"-"+myS4()+"-"+myS4()+"-"+myS4()+"-"+myS4()+myS4()+myS4());
}

var OSSClient = null;
var stsToken = null;

$(function(){
	var ac = $("#getAliToken").attr("action")
	 $.ajax({
	        type: "POST",
	        url: ac,
	        dataType: "json",
	        success:function(response){
	        	stsToken = response.data.stsToken;
	        	OSSClient = new OSS.Wrapper({
	        	    region: stsToken.region,
	        	    accessKeyId: stsToken.accessKey,
	        	    accessKeySecret: stsToken.accessSeret,
	        	    stsToken: stsToken.accessToken,
	        	    bucket: stsToken.bucket
	        	  });
 		},
 		error:function() { 
	        	alert("系统访问出错，可能是您的网络问题，请稍后再试");
	    	}
	    });
	
	
	$("#mediaUploadFileField").on('change', function(e){
		showLoadingHs();
		 var file = e.target.files[0];
	      if(file.type!='video/mp4'){
	    	  alert("请上传mp4格式的视频");
	    	  hideLoadingHs();
	    	  return false;
	      }
	      storeAs = 'hospital/doctorvideo/'+myguid()+'.mp4';
	      var storage = window.localStorage; 
	      storeKey = file.name+""+file.size;
	      var checkpoint = storage.getItem(storeKey);
	      if(checkpoint!=null){
	    	  if(!confirm("是否继续上传？")){
	    		  checkpoint = null;
	    	  }else{
	    		  checkpoint = JSON.parse(checkpoint);
	    		  checkpoint.file = file;
	    		  storeAs = checkpoint.storeAs;
	    	  }
	      }
	      var options = {};
	      if(checkpoint!=null){
	    	  options.checkpoint = checkpoint;
	      }
	      options.progress = progress;
	      $("#uploadProgress").html("视频上传进度:0%");
	      $("#uploadProgress").show();
	      OSSClient.multipartUpload(storeAs, file, options).then(function (result) {
    		window.localStorage.removeItem(storeKey);
    		hideLoadingHs();
    		var src ="https://"+stsToken.bucket+"."+stsToken.region+".aliyuncs.com/"+storeAs;
    		currentEditor.insertHtml( '<video src="' + src + '" >浏览器不支持</video><br/>');
    		$("#uploadProgress").hide();
          }).catch(function (err) {
        	  hideLoadingHs();
              console.log(err);
          });;
	});
});
