$(document).ready(function(){

	var socket = io();
	console.log(socket);

	var pics; var nbPics;
	var dirCaptions = '../caption/'
	var intervalPics = 5000; // ms
	var refreshRateGallery = 1; // minutes

	var currentPic;
	var currentUrl;
	var tl;
	var gallery = $("#gallery");
	var preview = $("#preview");
	var photoA = gallery.find('.photo-a');
	var photoB = gallery.find('.photo-b');

	// var notifications = $('#notifications');
	// var notificationsText = notifications.find('span');

	getLastPics();

	// window.setInterval(function(){
	// 	getLastPics();
	// 	console.log("refreshed >>>>>>");
	// }, 60000 * refreshRateGallery);

	socket.on('lastPic', function(url) {
		preview.css('background-image', 'url(' + url + ')');
		preview.addClass('show');
		tl.pause();
		setTimeout(function(){
			preview.removeClass('show');
			// tl.play();
			getLastPics();
		}, 10000);
	});

	function getLastPics () {

		$.post("/last-pics", function(data) {

			pics = data;
			console.log(pics);
			nbPics = pics.length;
			gallery.html('');
			for(var i = 0; i < nbPics; i++ ) {
				gallery.append('<div class="photo-' + i + '"></div>');
				currentPic = $(".photo-" + i);
				currentUrl = dirCaptions + pics[i];
				currentPic.css('background-image', 'url(' + currentUrl + ')');
			}
			buildTimeline();
			tl.play();

		});
	}

	function buildTimeline() {
		tl = new TimelineMax({repeat: -1});
		tl.pause();
		var delay = 2;
		console.log('>>>>>>');
		for(var i = 0; i < nbPics; i++ ) {
			currentPic = $(".photo-" + i);
			tl.set(currentPic,  {className:'+=show'});
			tl.set(currentPic, {className:'-=show'}, delay * i + delay);
			console.log(delay * i + delay);
		}
		console.log(tl);
	}

});
