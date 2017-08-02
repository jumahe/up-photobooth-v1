$(document).ready(function(){

	var socket = io();
	// var socket = io('http://10.10.0.1');
	console.log(socket);

	/**
		* REGISTER VAR
	**/
	var canTakePicture;
	var imageUrl;
	/**
		* REGISTER DOM
	**/
	var notifications = $('#notifications');
	var notificationsText = notifications.find('span');


	var screenCapture = $('#screen_capture');
	var btnCapture = screenCapture.find('a.btn-capture');
	var userCount = screenCapture.find('span.total-users');
	var userCurrentPlace = screenCapture.find('span.user-current-place');
	var btnCapture = screenCapture.find('.btn-wrapper .btn-capture');

	var screenPreview = $('#screen_preview');
	var previewBig = screenPreview.find('.photo-preview-big');
	var btnValidate = screenPreview.find('.btn-validate');
	var btnRestart = screenPreview.find('.btn-restart');

	var screenValidated = $('#screen_validated');
	var previewSmall = screenValidated.find('.photo-preview-small');
	var btnDownload = screenValidated.find('.btn-download');

	btnCapture.on('click', function(e){
		e.preventDefault();
		console.log("button CAPTURE pressed");
		if(canTakePicture) {

			$.get("/capture", function(data) {
				console.log('capture...');
				console.log(data);

				socket.on('finished', function(response){
					console.log('finished', response);

					if (response == true) {
						imageUrl = data.url;
						fileName = data.file_name;
						console.log(imageUrl);
						previewBig.css('background-image', 'url(' + imageUrl + ')');

						screenCapture.removeClass('show');

						screenPreview.show();
						screenPreview.addClass('show').delay(250);
					}
				});

			}).fail(function(e) {
				console.log( "error", e );
			});
		} else {
			console.log('not first in queue');
		}
	});

	btnRestart.on('click', function(e){
		e.preventDefault();
		console.log("button RESTART pressed");

		$.get("/restart", function(response) {
			console.log(response);
			console.log(response.canRetry);
			if(response.canRetry) {
				screenPreview.hide();
				screenPreview.removeClass('show');
				screenCapture.show();
				screenCapture.addClass('show');
			} else {
				notifications.css('background-color', 'red');
				notificationsText.html('Vous avez épuisé tous vos essais, veuillez valider ou recharger la page')
				notifications.addClass("show").delay(5000).queue(function(){
					$(this).removeClass("show").dequeue();
				});
			}

		});
	});

	btnValidate.on('click', function(e){
		e.preventDefault();
		console.log("button VALIDATE pressed");

		$.get("/validated", function(data) {
			previewSmall.css('background-image', 'url(' + imageUrl + ')');
			screenPreview.removeClass('show');
			screenValidated.show();
			screenValidated.addClass('show').delay(250);
		});
	});

	btnDownload.on('click', function(e){
		e.preventDefault();
		console.log("button DOWNLOAD pressed");
		console.log(fileName);
		window.open('/download/' + fileName);
		// $.get("/download/" + fileName, function(){
		// 	console.log("downloading ...");
		// });
	});

	socket.on('usersQueue', function(response){
		userCurrentPlace.html(response.userPosition);
		userCount.html(response.totalUsers);
		console.log("user count", response);
		if(response.userPosition == 1) {
			canTakePicture = true;
			btnCapture.addClass('active');
		}
	});
});
