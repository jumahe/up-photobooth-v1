var express = require('express');
var app = express();
var http = require('http').Server(app);
var fs = require('fs');
var io = require('socket.io')(http);
var PythonShell = require('python-shell');
const util = require('util');

// -- CONFIG
var TWITTER_ON = true;
var VISION_ON = false;

// -- the GOOGLE Cloud Vision API
var vision = require('@google-cloud/vision')({
	keyFilename: '/home/pi/cam/vision-demo-f45b8dcb2f85.json',
	projectId: 'vision-demo-xxxx'
});

// -- stack users and manage orders
var users = [];
var last_usr_id = "";
var canTakePicture = true;

// -------------------------------------------------------------------------------------------------
// -- twitter API
// -------------------------------------------------------------------------------------------------

// -- Second Lib (twitter)
// https://www.npmjs.com/package/twitter
var Twitter = require('twitter');

// -- PROD2
var twitterClient = new Twitter({
	consumer_key: 'xxx',
	consumer_secret: 'xxx',
	access_token_key: 'xxx',
	access_token_secret: 'xxx'
});

// -------------------------------------------------------------------------------------------------
// -- DEFAULT TWITTER MESSAGE
// -------------------------------------------------------------------------------------------------
var TW_MSG = "Hello World!";
// -------------------------------------------------------------------------------------------------

// -- Where the captions are stored
var dirCaptions = __dirname + '/www/captions/';

// -- define the static paths
app.use('/css', express.static(__dirname + '/www/css'));
app.use('/fonts', express.static(__dirname + '/www/fonts'));
app.use('/js', express.static(__dirname + '/www/js'));
//app.use('/imgs', express.static(__dirname + '/www/imgs'));

// -----------------------------------------------------------------
// -- Entry point / default page
// -----------------------------------------------------------------
app.get('/', function(req,res)
{
	res.type('text/plain');
	res.send('Hello You!');
	//res.sendFile(__dirname + '/www/index.html');
});

app.get('/home', function(req,res)
{
	res.sendFile(__dirname + '/www/index.html');
});

// -- check from arduino: is the system ready?
app.get('/isready', function(req,res)
{
	if(canTakePicture)
	{
		res.sendStatus(1);
	}
	else
	{
		res.sendStatus(0);
	}
});

// -- trigger the shot?
app.get('/trigger', function(req,res)
{
	console.log(">> TRIGGER");
});

// -- capture picture
app.get('/capture', function(req,res)
{
	canTakePicture = false;
	var currentUser = getCurrentUser();

	var ts = getTimestamp();
	var options = {
		scriptPath:'/home/pi/cam/',
		args: [ts]
	};

	// -- run the capture python script
	PythonShell.run('capture.py', options, function (err, result)
	{
		if (err)
		{
			console.log('CAPTURE ERROR: ' + err);
			//throw err;
			if(currentUser)
			{
				currentUser.socket.emit('finished', false);
			}
			// io.sockets.emit('errorCapture', err);
		}

		console.log('CAPTURE OK: ' + result);

		if(currentUser)
		{
			currentUser.socket.emit('finished', true);
		}

		var img_url = "/caption/" + ts + ".jpg";
		var response = {
			url : img_url,
			file_name: ts
		}

		// -- SEND TO TWITTER ------------------------------------------------
		if(TWITTER_ON == true) publish2Twitter( dirCaptions + ts + ".jpg" );
		// -------------------------------------------------------------------

		io.sockets.emit('lastPic', img_url);

		// -- release lock 4s later
		setTimeout(function(){ canTakePicture = true; }, 4000);

		res.json(response);
	});

	// -- RAZ anyway
	setTimeout(raz_booth, 10000);
});

// -- the restart page
app.get('/restart', function(req,res)
{
	var currentUser = getCurrentUser();
	currentUser.try -= 1;
	var response = {};
	console.log(currentUser.try);

	if(currentUser.try <= 0)
	{
		// -- send no try
		response.canRetry = false;
		res.json(response);
	}
	else
	{
		// -- send ok
		response.canRetry = true;
		// + delete the current picture

		res.json(response);
	}
});

// -- validate page
app.get('/validated', function(req,res)
{
	var currentUser = getCurrentUser();

	// -- remove access token
	removeUser(currentUser.id);

	// usr.socket.emit('set_master');
	res.send('ok');
});

// -- download the picture
app.get('/download/:file', function(req, res)
{
	var fileName = req.params.file;
	console.log(fileName);

	var file = dirCaptions + fileName + ".jpg";
	console.log(file);

	res.download(file, function(err)
	{
		if(err)
		{
			console.log(err);
		}
	});
});

// -- get/share page
app.get('/getshare', function(req,res)
{
	res.type('text/plain');
	res.send('GET or SHARE');
});

// -- gallery page
app.get('/gallery', function(req,res)
{
	res.sendFile(__dirname + '/www/gallery.html');
});

// -- get the 10 lasts captions
app.post('/last-pics', function(req,res)
{
	var files = fs.readdirSync(dirCaptions)
	.map(function(v)
	{
		return { name:v, time:fs.statSync(dirCaptions + v).mtime.getTime() };
	})
	.sort(function(a, b) { return b.time - a.time; })
	.map(function(v) { return v.name; });

	var result = [];

	for(var i = 0; i < 10 - 1; i ++ )
	{
		if(files[i])
		{
			result.push(files[i]);
		}
	}

	res.send(result);
});

// -- get UI images
app.get('/imgs/:file', function (req, res)
{
	var file = req.params.file;
	var img = fs.readFileSync(__dirname + "/www/imgs/" + file);
	res.writeHead(200, {'Content-Type': 'image/jpg'});
	res.end(img, 'binary');
});

// -- get one caption
app.get('/caption/:file', function (req, res)
{
	var file = req.params.file;
	var img = fs.readFileSync(dirCaptions + file);
	res.writeHead(200, {'Content-Type': 'image/jpg'});
	res.end(img, 'binary');
});

// -- catch any other request
app.get('*', function(req,res)
{
	res.redirect('/');
});

// -----------------------------------------------------------------
// -- RAZ booth
// -----------------------------------------------------------------
var raz_booth = function()
{
	console.log("------> raz_booth");

	// -- setup screen
	var options = {
		scriptPath:'/home/pi/cam/'
	};

	// -- display SYSTEM READY on the screen
	PythonShell.run('ready.py', options, function (err, result)
	{
		if (err)
		{
			console.log('Ready Python Script ERROR: ' + err);
			//throw err;
		}
		console.log('SYSTEM IS READY');
	});
}

// -- get date + time
var getDateTime = function()
{
	var t = new Date();
	var y = t.getFullYear();
	var m = addLeadingZero( t.getMonth() + 1 );
	var d = addLeadingZero( t.getDate() );
	var h = addLeadingZero( t.getHours() );
	var mn = addLeadingZero( t.getMinutes() );

	//return "" + d + "/" + m + "/" + y + " - " + h + ":" + mn;
	return "" + h + "h" + mn;
}

// -- generate a String timestamp
var getTimestamp = function()
{
	var t = new Date();
	var y = t.getFullYear();
	var m = addLeadingZero( t.getMonth() + 1 );
	var d = addLeadingZero( t.getDate() );
	var h = addLeadingZero( t.getHours() );
	var mn = addLeadingZero( t.getMinutes() );
	var s = addLeadingZero( t.getSeconds() );

	return "" + y + m + d + h + mn + s;
}

// -- add leading zero (9 -> 09)
function addLeadingZero(val)
{
	return (val < 10) ? ("0" + val) : ("" + val);
}

// -----------------------------------------------------------------
// -- Twitter publish (but first vision detect)
// -----------------------------------------------------------------
function publish2Twitter(img_path)
{
	console.log("--> publish2Twitter");
	console.log(img_path);

	var data = require('fs').readFileSync(img_path);

	// -- for google cloud vision api
	var types = ['label'];
	//var test = '/home/pi/cam/test.jpg';

	if(VISION_ON == true)
	{
		vision.detect(img_path, types, function(err, text, apiResponse)
		{
			if(!err)
			{
				console.log("CVAPI text: ", text);
				console.log("CVAPI resp: ", apiResponse);

				var tlen = text.length;
				var tags = "";
				if(tlen > 0)
				{
					for(var i = 0; i < tlen; i++)
					{
						console.log("   - " + text[i]);

						var ht = text[i];
						ht = ht.replace(" ", "");
						tags += "#" + ht + " ";
					}
				}

				// ----------------------------------------------------------------------------
				sendToTwitter(data, cleanString(TW_MSG + ' ' + getDateTime() + ' ' + tags));
				// ----------------------------------------------------------------------------
			}
			else
			{
				console.log("CVAPI error: ", err);

				// ----------------------------------------------------------------------------
				sendToTwitter(data, TW_MSG + ' ' + getDateTime() );
				// ----------------------------------------------------------------------------
			}
		});
	}
	else
	{
		// ----------------------------------------------------------------------------
		sendToTwitter(data, TW_MSG + ' ' + getDateTime() );
		// ----------------------------------------------------------------------------
	}

	/*
	// -- previous way to send to twitter
	twitter.uploadMedia(
	{
		media:image_datas,
		isBase64:true
	},
	twitter_access_token,
	twitter_token_secret,
	function(error, data, response)
	{
		if (error)
		{
			console.log("Error uploading to twitter: " + error);
		}
		else
		{
			console.log("Picture successfully sent to twitter: " + response);
			console.log( util.inspect(response, { showHidden: false, depth: null }) );
		}
	});
	*/
}

// -- send picture to twitter
function sendToTwitter(data, status_msg)
{
	// -- upload the picture to twitter
	 twitterClient.post('media/upload', {media: data}, function(error, media, response)
	 {
	 	if(!error)
	 	{
	 		console.log("Upload to Twitter OK: " + media.media_id_string);

	 		var status = {
	 			//status: '' + getDateTime(),
				status: status_msg,
	 			media_ids: media.media_id_string
	 		}

			// -- update the status related to this picture
	 		twitterClient.post('statuses/update', status, function(error, tweet, response)
	 		{
	 			if(!error)
	 			{
	 				console.log("Tweet OK: " + tweet);
	 			}
	 			else
	 			{
	 				console.log("Error update status: ");
	 				console.log( util.inspect(error, { showHidden: false, depth: null }) ); // deep debug
	 			}
	 		});
	 	}
	 	else
	 	{
	 		console.log("Error upload: ");
	 		console.log( util.inspect(error, { showHidden: false, depth: null }) ); // deep debug
	 	}
	});
}

// -- convert picture to Base64
function base64_encode(img_path)
{
	var bitmap = fs.readFileSync(img_path);
	return new Buffer(bitmap).toString('base64');
}

// -- for twitter, <140 chars
function cleanString(str_in)
{
	if(str_in.length > 140)
	{
		return (str_in.substr(0,136) + "...");
	}
	else return str_in;
}

// -----------------------------------------------------------------
// -- ON NEW IO CONNECTION
// -----------------------------------------------------------------
io.on('connection', function(socket)
{
	console.log('a user is connected: ' + socket.id);

	// -- create and add user to stack
	var usr = {};
	usr.id = socket.id;
	usr.socket = socket;
	usr.try = 2;
	addUser(usr);

	// -- ON DISCONNECT
	socket.on('disconnect', function()
	{
		console.log('user disconnected: ' + this.id);
		if(this.id == last_usr_id) raz_booth();
		removeUser(this.id);
	});

	// -- logout
	socket.on('logout', function()
	{
		console.log('logout from: ' + this.id);
		this.disconnect();
	});

	// -- receive action
	socket.on('action', function(val)
	{
		if(this.id == last_usr_id)
		{
			// only if master
			// ...
		}
		else
		{
			console.log("nope, last_usr_id = " + last_usr_id);
		}
	});
})

// -- add user to stack
function addUser(usr)
{
	users.push(usr);
	if(last_usr_id == "") findMaster();

	getUsersQueue();
}

// -- get current master
function getCurrentUser()
{
	var currentId = findMaster();
	return findUserByID(last_usr_id);
}

// -- define master user
function findMaster()
{
	var len = users.length;
	if(len > 0)
	{
		var usr = users[0];
		usr.socket.emit('set_master');
		//if(last_usr_id != usr.id) send_init();
		last_usr_id = usr.id;
	}
	else raz_booth();
}

// -- remove user from stack
function removeUser(usrid)
{
	// -- the user
	var usr = findUserByID(usrid);
	var ref = findUserRefByID(usrid);

	// -- tells the user that he has been disconnected
	usr.socket.emit("logout");

	// -- reset the master ref to empty
	if(last_usr_id == usr.id) last_usr_id = "";

	// -- remove from list
	users.splice(ref, 1);
	getUsersQueue();

	// -- if the list contains users, look for the new master
	var len = users.length;
	if(len > 0) findMaster();
	else raz_booth();
}

// -- find user by id
function findUserByID(usrid)
{
	var len = users.length;
	if(len > 0)
	{
		var i;
		var usr;
		for(i=0; i<len; i++)
		{
			usr = users[i];
			if(usr.id == usrid) return usr;
		}
		return null;
	}
	else return null;
}

// -- find user ref (in the users list) by id
function findUserRefByID(usrid)
{
	var len = users.length;
	if(len > 0)
	{
		var i;
		var usr;
		for(i=0; i<len; i++)
		{
			usr = users[i];
			if(usr.id == usrid) return i;
		}
		return null;
	}
	else return null;
}

// -- get users queue
function getUsersQueue()
{
	for(var i = 0; i < users.length; i ++) {
		var currentUser = users[i];
		var obj = {
			userPosition : i+1,
			totalUsers : users.length
		}
		currentUser.socket.emit('usersQueue', obj );
	}
}

// -----------------------------------------------------------------
// -- launch HTTP SERVER
// -----------------------------------------------------------------
http.listen(80, function()
{
	console.log('listening on *:80');
	setTimeout(raz_booth, 10000);
});
