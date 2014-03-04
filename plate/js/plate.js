'use strict';
(function($){

var oldIE = '\v'=='v';	

function platePlayer(options){
	var that = this;
	
	this.opt = options;
	
	this.on = {
		canplay: function(){},
		ended: function(){},
		pause: function(){},
		play: function(){},
		timeupdate: function(){},
		durationChange: function(){},
		playlistChange: function(){},
		error: function(){},
		startLoad: function(){},
		progress: function(){}
	};
	
	this.controls = {
		pause: false,
		repeat: false,
		random: false,
		speed: 1,
		volume: 50
	};
	
	this.playlist = {
		curr: false,
		normalTurn: [],
		randomTurn: [],
		tracks: {}
	};
	
	this.loadFromOptions();
	
	this.loadFromCookie();


	this.player = null;
	if(oldIE){
		var $iePl = $('<object/><param name="volume"/>');
		$iePl.attr('classid', 'clsid:6BF52A52-394A-11d3-B153-00C04F79FAA6');
		this.player = $iePl[0];
	}else{
		this.player = new Audio();
	}
	
	//def settings
	if(oldIE){
		this.player.settings.autoStart = false;
	}
	
	this.setVolume(this.controls.volume);
	this.setSpeed(this.controls.speed);
	
	//bind events
	if(oldIE){
		this.timeupInterval = null; 
		this.bufferInterval = null; 
	
		this.player.attachEvent('PlayStateChange', function(st){
			if(st == 10){
				that.on.canplay();
			}else if(st == 3){
				that.timeupInterval = window.setInterval(function(){
					that.on.timeupdate(that.getCurrTime());
				},500);
				that.controls.pause = false;
				that.on.play();
			}else if(st == 2){
				window.clearInterval(that.timeupInterval);
				that.controls.pause = true;
				that.on.pause();
			}else if(st == 8){
				window.clearInterval(that.timeupInterval);
				that.controls.pause = true;
				that.on.ended();
			}
		});
		
		this.player.attachEvent('OpenStateChange', function(st){
			if(st == 13){
				that.on.durationChange(that.getDuration());
			}
		});
		
		this.player.attachEvent('buffering', function(start){
			if(start){
				that.bufferInterval = window.setInterval(function(){
					that.on.progress(that.getBuffer());
				},500);
			}else{
				that.on.progress(that.getBuffer());
				window.clearInterval(that.bufferInterval);
			}
		});
		
	}else{
		$(this.player)
			.on('canplay.ePlate', function(e){
				that.on.canplay();
			})
			.on('progress.ePlate', function(e){
				that.on.progress(that.getBuffer());
			})
			.on('play.ePlate', function(e){					
				that.controls.pause = false;
				that.on.play();
				
				that.setSpeed(that.controls.speed);//important fix! speed for new track is default
			})
			.on('volumechange.ePlate', function(e){//TODO for android, ipad change volume?
				
			})
			.on('durationchange.ePlate', function(e){
				that.on.durationChange(that.getDuration());
			})
			.on('timeupdate.ePlate', function(e){
				if(that.player.currentTime === that.player.duration){
					that.on.ended();
				}else{
					that.on.timeupdate(that.getCurrTime());
				}
			})
			.on('error.ePlate', function(e){
				that.on.error(e, 'error');
			})
			.on('stalled.ePlate', function(e){
				that.on.error(e, 'stalled');
			})
			.on('loadstart.ePlate', function(e){
				that.on.startLoad();
			})
			.on('pause.ePlate', function(e){
				that.controls.pause = true;
				if(0 === that.player.currentTime || that.player.currentTime === that.player.duration){
					that.on.ended();
				}else{
					that.on.pause();
				}
			})
		;
	}
}

platePlayer.prototype.loadFromCookie = function(){
	if(this.opt.useCookies && $.cookie){
		this.controls = $.extend(this.controls, $.parseJSON($.cookie(this.opt.uniqueId+'_controls')));
	}
	
};

platePlayer.prototype.saveToCookie = function(){
	if(this.opt.useCookies && $.cookie){
		$.cookie(this.opt.uniqueId+'_controls', JSON.stringify(this.controls), {expires: 7, path: '/'});
	}
};

platePlayer.prototype.loadFromOptions = function(){
	//controls
	this.controls = $.extend(this.controls, this.opt.onStart);
	
	//playlist
	if(typeof(this.opt.playlist) != 'object' && this.opt.defContent){
		var tracks = this.opt.defContent.replace(/[\f\n\r\t ]*/gim, '').split(',');
		this.opt.playlist = new Array();
		$.each(tracks, function(i, src){
			this.opt.playlist[i] = {file:src};
		});
	}
	
	var that = this;
	$.each(this.opt.playlist, function(i, val){		
		//convert pls/m3u
		if((-1 !== val.file.indexOf('.pls') || -1 !== val.file.indexOf('.m3u'))){
			$.ajax({
				dataType: 'json',
				url: that.opt.phpGetter,
				type: 'GET',
				data: {
					method: 'parsePlaylist',
					playlist: val.file
				},
				success: function(subPlaylist){
					var newPlaylist = {};
					
					$.each(that.playlist.tracks, function(n, currTr){
						if(n == 't'+i){
							$.each(subPlaylist, function(j, subTrack){
								newPlaylist[n+'_'+j] = $.extend({title: currTr.title, artist: currTr.artist, cover: currTr.cover, file: false}, subTrack);
								if(0 === newPlaylist[n+'_'+j].title.indexOf('(#')){newPlaylist[n+'_'+j].title = newPlaylist[n+'_'+j].title.substring(newPlaylist[n+'_'+j].title.indexOf(')')+2);}
								if('radio' == newPlaylist[n+'_'+j].type){newPlaylist[n+'_'+j].file  += '/;';}
							});
						}else{
							newPlaylist[n] = currTr;
						}
					});
					
					that.playlist.tracks = newPlaylist;
					that.playlistSolitaire();
					that.on.playlistChange();
				}
			});
		}else if(0 === val.file.indexOf('folder:')){
			$.ajax({
				dataType: 'json',
				url: that.opt.phpGetter,
				type: 'GET',
				data: {
					method: 'parseFolder',
					path: val.file.replace('folder:', '')
				},
				success: function(subPlaylist){
					var newPlaylist = {};
					
					$.each(that.playlist.tracks, function(n, currTr){
						if(n == 't'+i){
							$.each(subPlaylist, function(j, subTrack){
								newPlaylist[n+'_'+j] = $.extend({title: null, artist: null, cover: null, file: false}, subTrack);
							});
						}else{
							newPlaylist[n] = currTr;
						}
					});
					
					that.playlist.tracks = newPlaylist;
					that.playlistSolitaire();
					that.on.playlistChange();
				}
			});
		}
		that.playlist.tracks['t'+i] = $.extend({title: null, artist:null, cover:null, file:false}, val);
	});
	
	this.playlistSolitaire();
};

platePlayer.prototype.playlistSolitaire = function(){
	this.playlist.normalTurn = new Array();
	this.playlist.randomTurn = new Array();
	
	var that = this;
	$.each(this.playlist.tracks, function(id, val){
		if(val.file && !val.disabled){
			that.playlist.normalTurn.push(id);
			that.playlist.randomTurn.push(id);
		}
	});

	var i = this.playlist.randomTurn.length, j, t;
	while(i){
		j = Math.floor( ( i-- ) * Math.random() );
		t = this.playlist.randomTurn[i];
		this.playlist.randomTurn[i] = this.playlist.randomTurn[j];
		this.playlist.randomTurn[j] = t;
	}
};

platePlayer.prototype.grabID3 = function(id, cb){
	if(typeof(this.playlist.tracks[id] == 'object')){
		var track = this.playlist.tracks[id];
		
		if((!track.title || !track.artist || !track.cover) && !track.isLoadID3){
			track.isLoadID3 = true;
			
			$.ajax({
				dataType: 'json',
				url: this.opt.phpGetter,
				type: 'GET',
				data: {
					method: 'getID3',
					file: track.file
				},
				success: function(tags){
					if(!track.title){track.title = tags.title || false;}
					if(!track.artist){track.artist = tags.artist || false;}
					if(!track.cover){track.cover = tags.cover || false;}
				},
				complete: function(){
					if($.isFunction(cb)){cb(id);}
				}
			});
		}
	}
};

platePlayer.prototype.grabLastFMCover = function(id, cb){
	var track = this.playlist.tracks[id];

	if(track.artist && track.title && !track.cover && !track.isLoadLastFM){
		track.isLoadLastFM = true;

		$.ajax({
			dataType: 'jsonp',
			data: {
				method: 'track.getInfo',
				api_key: this.opt.lastFM_API_key,
				artist: track.artist,
				track: track.title.split('(')[0],
				format: 'json'
			},
			url: encodeURI('http://ws.audioscrobbler.com/2.0/'),
			success: function(res){
				try{
					track.cover = res.track.album.image[3]['#text'];
				}catch(e){
					track.cover = false;
				}
			},
			complete: function(){
				if($.isFunction(cb)){cb(id);}
			}
		});
	}
};

platePlayer.prototype.setSrc = function(url){
	if(oldIE){
		this.player.URL = url;
	}else{
		this.player.src = url;
		this.player.load();
	}
};

platePlayer.prototype.play = function(){
	if(oldIE){
		try{
			this.player.controls.play();
		}catch(e){
			
		}
	}else{
		this.player.play();
	}
};

platePlayer.prototype.pause = function(){
	if(oldIE){
		this.player.controls.pause();
	}else{
		this.player.pause();
	}
};

platePlayer.prototype.playedReverse = function(){
	if(this.controls.pause){
		this.controls.pause = false;
		this.play();
	}else{
		this.controls.pause = true;
		this.pause();
	}
};

platePlayer.prototype.toTrack = function(id, preload){
	if(typeof(this.playlist.tracks[id]) == 'object'){
		this.playlist.curr = id;
		this.setSrc(this.playlist.tracks[id].file);
		if(!preload){
			this.play();
		}
		return true;
	}else{
		return false;
	}
};

platePlayer.prototype.toNext = function(revers, preload){
	if(this.controls.random){
		var tmpTurn = this.playlist.randomTurn;
	}else{
		var tmpTurn = this.playlist.normalTurn;
	}
	
	var tmpIndex = $.inArray(this.playlist.curr, tmpTurn);

	var prev = tmpTurn[tmpIndex-1];
	var next = tmpTurn[tmpIndex+1];
	
	if(tmpIndex === 0){
		prev = tmpTurn[tmpTurn.length-1];
	}else if(tmpIndex === tmpTurn.length-1){
		next = tmpTurn[0];
	}

	next = (typeof(revers) != 'undefined' && revers) ? prev : next;
	if(typeof(this.playlist.tracks[next]) != 'object'){
		next = tmpTurn[0];
	}
	
	return this.toTrack(next, preload);
};

platePlayer.prototype.getVolume = function(){
	if(oldIE){
		return this.player.settings.volume;
	}else{
		return this.player.volume*100;
	}
};

platePlayer.prototype.setVolume = function(val){
	var oldVal = this.controls.volume;
	if(!isNaN(val)){
		this.controls.volume = Math.abs(val);
		if(oldIE){
			this.player.settings.volume = this.controls.volume;
		}else{
			this.player.volume = this.controls.volume/100;
		}
		if(val <= 0 || oldVal <= 0){
			return true;
		}
	}else{
		this.controls.volume *= -1;
		
		if(this.controls.volume == 0 || oldVal == 0){
			this.controls.volume = 50;
		}
		
		var tmpVol = (this.controls.volume >= 0) ? this.controls.volume : 0;
		
		if(oldIE){
			this.player.settings.volume = tmpVol;
		}else{
			this.player.volume = tmpVol/100;
		}
		
		return true;
	}
};

platePlayer.prototype.getCurrTime = function(){
	if(oldIE){
		return this.player.controls.currentPosition;
	}else{
		return this.player.currentTime;
	}
};

platePlayer.prototype.setCurrTime = function(time){
	if(!isNaN(time) && time >= 0 && time <= this.getDuration()){
		if(oldIE){
			this.player.controls.currentPosition = time;
		}else{
			this.player.currentTime = time;
		}
	}
};

platePlayer.prototype.getSpeed = function(){
	if(oldIE){
		return this.player.settings.rate;
	}else{
		return this.player.playbackRate;
	}
};

platePlayer.prototype.setSpeed = function(s){
	if(typeof(s) != 'undefined' && !isNaN(s)){
		this.controls.speed = s;
	}else{
		var tmpIndex = $.inArray(this.controls.speed, this.opt.speeds);
		if(tmpIndex != -1 && (tmpIndex != this.opt.speeds.length - 1)){
			this.controls.speed = this.opt.speeds[tmpIndex+1];
		}else{
			this.controls.speed = this.opt.speeds[0];
		}
	}
	
	if(oldIE){
		this.player.settings.rate = this.controls.speed;
		return true;
	}else{
		this.player.playbackRate = this.controls.speed;
		return true;
	}
};

platePlayer.prototype.getBuffer = function(){
	if(oldIE){
		return [[0, this.player.network.bufferingProgress]];
	}else{
		var buffer = [];
		var duration = this.getDuration();
		for(var i = 0; i < this.player.buffered.length; i++){
			buffer[i] = [this.player.buffered.start(i)*100/duration, this.player.buffered.end(i)*100/duration];
		}
		return buffer;
	}
};

platePlayer.prototype.getDuration = function(){
	if(oldIE){
		return this.player.currentMedia.duration;
	}else{
		return this.player.duration;
	}
};

platePlayer.prototype.destruct = function(){
	this.pause();
	
	if(oldIE){
		//TODO normal unbind for old ie
	}else{
		$(this.player).unbind('.ePlate');
	}
	delete this.player;
};


function plateView(container, statusData, options){
	this.container = container;
	this.st = statusData;
	this.opt = options;

	this.DOM = '\
		<div class="album">\
			<a href="#" class="buyButton"></a>\
			<img class="record" alt="" src="'+this.opt.images.record+'"/>\
			<img class="record_light" alt="" src="'+this.opt.images.recordLight+'"/>\
			<img class="cover_border" alt="" src="'+this.opt.images.coverShadow+'"/>\
			<img class="cover_hide" src="" alt="">\
			<img class="cover" src="" alt="">\
			<div class="glass"></div>\
		</div>\
		<div class="clr"></div>\
		<div class="volume">\
			<div class="mute"></div>\
			<div class="vl_slider"></div>\
		</div>\
		\
		<div class="info">\
			<div class="title oneline"></div>\
			<div class="artist oneline"></div>\
		</div>\
		<div class="clr"></div>\
		<div class="progress">\
			<div class="time curTime"></div>\
			<div class="time allTime"></div>\
		</div>\
		<div class="clr"></div>\
		<div class="control">\
			<div class="prev"></div>\
			<div class="play"></div>\
			<div class="next"></div>\
			<div class="speed"></div>\
			<div class="random"></div>\
			<div class="repeat"></div>\
			<div class="clr"></div>\
		</div>\
		<div class="clr"></div>\
		<div class="playlist">\
			<div class="pl_inside"></div>\
		</div>\
	';
	
	var animSpeed = animSpeed;
	
	this.coverEffects = {
		opacity: function($cover, cb){
			$cover.animate({
				'opacity': 0
			}, animSpeed, cb);
		},
		toLeft: function($cover, cb){
			$cover.animate({
				'margin-left': '-100%'
			}, animSpeed, cb);
		},
		toTop: function($cover, cb){
			$cover.animate({
				'margin-top': '-100%'
			}, animSpeed, cb);
		},
		zoomLeftTop: function($cover, cb){
			$cover.animate({
				'width': 0,
				'height': 0
			}, animSpeed, cb);
		},
		zoomRightTop: function($cover, cb){
			$cover.animate({
				'width': 0,
				'height': 0,
				'left': $cover.position().left+$cover.width()
			}, animSpeed, cb);
		},
		zoomRightBottom: function($cover, cb){
			$cover.animate({
				'width': 0,
				'height': 0,
				'top': $cover.position().top + $cover.height(),
				'left': $cover.position().left + $cover.width()
			}, animSpeed, cb);
		},
		zoomLeftBottom: function($cover, cb){
			$cover.animate({
				'width': 0,
				'height': 0,
				'top': $cover.position().top + $cover.height()
			}, animSpeed, cb);
		},
		zoomCenter: function($cover, cb){
			$cover.animate({
				'width': 0,
				'height': 0,
				'top': $cover.position().top+$cover.height()/2,
				'left': $cover.position().left+$cover.width()/2
			}, animSpeed, cb);
		}
	};
	
	this.usedEffects = false;

	this.drawFace();
	this.resizeAlbum();
	this.clearFace();
	this.loadUsedEffects();
	
	this.drawControl();
	this.drawPlaylist();
};

plateView.prototype.secToDeg = function(sec){
	return sec*360/((78/this.st.getSpeed())/60);
};

plateView.prototype.secToMin = function(sec){
	if(isNaN(sec) || sec === Infinity){
		return '∞';
	}else{
		sec = Number(sec);
		var mod = Math.floor(sec % 60);
		if(mod < 10){mod = '0' + mod;}
		return Math.floor(sec/60) + ':' + mod;
	}
};

plateView.prototype.drawFace = function(){
	var $tmpDom = $('<div/>').html(this.DOM);

	var controls = {
		cover: false,
		vinyl: false,
		trackInfo: false,
		volume: false,
		progress: false,
		repeat: false,
		random: false,
		speed: false,
		playlist: false,
		play: false,
		prev: false,
		next: false
	};
	
	for(var i = 0; i < this.opt.controls.length; i++){
		controls[this.opt.controls[i]] = true;
	}
	
	if(!controls.cover){
		$tmpDom.find('.cover_border').remove();
		$tmpDom.find('.cover_hide').remove();
		$tmpDom.find('.cover').remove();
		$tmpDom.find('.glass').remove();
	}
	
	if(!controls.vinyl){
		$tmpDom.find('.record').remove();
		$tmpDom.find('.record_light').remove();
	}
	
	if(!controls.buyButton){
		$tmpDom.find('.buyButton').remove();
	}
	
	if(!controls.cover && !controls.vinyl){
		$tmpDom.find('.album').remove();
	}
	
	if(!controls.trackInfo){
		$tmpDom.find('.info').remove();
	}
	
	if(!controls.volume){
		$tmpDom.find('.volume').remove();
	}
	
	if(!controls.next){
		$tmpDom.find('.control .next').remove();
	}
	
	if(!controls.prev){
		$tmpDom.find('.control .prev').remove();
	}
	
	if(!controls.play){
		$tmpDom.find('.control .play').remove();
	}
	
	if(!controls.progress){
		$tmpDom.find('.progress').remove();
	}
	
	if(!controls.repeat){
		$tmpDom.find('.repeat').remove();
	}
	
	if(!controls.random){
		$tmpDom.find('.random').remove();
	}
	
	if(!controls.speed){
		$tmpDom.find('.speed').remove();
	}
	
	if(!controls.playlist){
		$tmpDom.find('.playlist').remove();
	}
	
	this.container.addClass('plate').addClass(this.opt.skin).html($tmpDom.html());

	if($().slider){
		this.container.find('.progress').slider({animate:true, range:'min', disabled:true, value:0, min:0, max:100, step:1});
		this.container.find('.vl_slider').slider({animate:true, range:'min', value:50, min:0, max:100, step:1, change:function(e, ui){
			$(ui.handle).css({'margin-left':-((ui.value)*$(ui.handle).width()/100)});
		}});
	}

	if($().perfectScrollbar){
		this.container.find('.pl_inside').perfectScrollbar({wheelSpeed:50, wheelPropagation:this.opt.playlistScrollPropagation, minScrollbarLength:10});
	}
};

plateView.prototype.resizeAlbum = function(){
	var sizeCoef = this.opt.width/320;
	
	var oldCoverSize = this.container.find('.cover').height();
	var oldCoverMarg = parseInt(this.container.find('.cover').css('top'), 10);
	this.container.find('.cover, .cover_hide, .glass').css({
		'width': oldCoverSize*sizeCoef,
		'height': oldCoverSize*sizeCoef,
		'top': oldCoverMarg*sizeCoef,
		'left': oldCoverMarg*sizeCoef
	});
	
	this.container.find('.glass').css({
		'width': '',
		'right': (parseInt(this.container.find('.glass').css('right'), 10)*sizeCoef)
	});
	
	var oldAlbumSize = this.container.find('.album').height();
	this.container.find('.album, .cover_border').css({
		'width': oldAlbumSize*sizeCoef,
		'height': oldAlbumSize*sizeCoef
	});
	
	var oldRecordSize = this.container.find('.record').height();
	this.container.find('.record, .record_light').css({
		'width': oldRecordSize*sizeCoef,
		'height': oldRecordSize*sizeCoef,
		'top': (parseInt(this.container.find('.record').css('top'), 10)*sizeCoef),
		'right': (parseInt(this.container.find('.record').css('right'), 10)*sizeCoef)
	});
	
	this.container.find('.buyButton').css({
		'left': oldCoverMarg*sizeCoef-4,
		'bottom': oldCoverMarg*sizeCoef-3
	});
	
	this.coverStartStyle = this.container.find('.cover').attr('style');
};

plateView.prototype.clearFace = function(){
	this.container.css({width:this.opt.width});
	
	this.container.find('.album').addClass('center');
	this.container.find('.album .cover').attr('src', this.opt.images.albumCover);
	this.container.find('.album .buyButton').attr('href', '#');
	
	this.container.find('.info .title, .info .artist').html('&nbsp;');
	
	if($().slider){
		this.container.find('.progress').slider('option', 'disabled', true);
	}
	
	this.container.find('.control .speed, .control .random, .control .repeat').addClass('disabled');
	
	this.container.find('.play').addClass('pause');
	this.container.find('.speed').html('1.0x');
	
	this.container.find('.curTime').html('0:00');
	this.container.find('.allTime').html('∞');
	
	this.container.find('.playlist .track.active').removeClass('active');
	this.container.find('.playlist .pl_inside').css({'height': this.opt.playlistHeight});
	if($().perfectScrollbar){
		this.container.find('.playlist .pl_inside').perfectScrollbar('update');
	}
	
	this.container.find('.progress .bufer').remove();
};

plateView.prototype.drawControl = function(){
	var st = this.st.controls;

	var $repeat = this.container.find('.repeat');
	if(st.repeat !== null){
		$repeat.removeClass('disabled');
		if(st.repeat === true){$repeat.addClass('active');}
		else{$repeat.removeClass('active');}
	}else{
		$repeat.addClass('disabled');
	}
	
	var $random = this.container.find('.random');
	if(st.random !== null){
		$random.removeClass('disabled');
		if(st.random === true){$random.addClass('active');}
		else{$random.removeClass('active');}
	}else{
		$random.addClass('disabled');
	}
	
	var $play = this.container.find('.play');
	if(st.pause){$play.addClass('pause');}
	else{$play.removeClass('pause');}
	
	var $speed = this.container.find('.speed');
	
	if(st.speed !== null){
		$speed.removeClass('disabled');
		$speed.html(st.speed.toFixed(1)+'x');
		if(st.speed != 1){$speed.addClass('active');}
		else{$speed.removeClass('active');}
	}else{
		$speed.addClass('disabled');
	}

	var $mute = this.container.find('.volume .mute');
	if(st.volume <= 0){
		$mute.addClass('active');
	}else{
		$mute.removeClass('active');
	}

	var tmpVol = 0;
	if(st.volume > 0){
		var tmpVol = st.volume;
	}
	if($().slider){
		this.container.find('.vl_slider').slider('option', 'value', tmpVol);
	}
};

plateView.prototype.drawPlaylist = function(){
	this.container.find('.pl_inside .track').remove();
	for(var id in this.st.playlist.tracks){
		this.container.find('.pl_inside').append('\
			<div class="track" rel="'+id+'">\
				<div class="play"></div>\
				<img class="cover" alt="" src="">\
				<div class="title oneline"></div>\
				<div class="artist oneline"></div>\
				<div class="clr"></div>\
			</div>\
		');
		this.drawTrack(id);
	};
	
	
	if($().perfectScrollbar){
		this.container.find('.pl_inside').perfectScrollbar('update');
	}
};

plateView.prototype.drawTrack = function(id){
	var track = $.extend({title: null, artist:null, cover:null, file:false}, this.st.playlist.tracks[id]);

	var that = this;

	if(!track.title){track.title = 'Unknown Title';}
	if(!track.artist){track.artist = 'Unknown Artist';}
	if(!track.cover){track.cover = this.opt.images.playlistCover;}
	
	this.st.grabID3(id, function(id){
		that.drawTrack(id);
		that.st.grabLastFMCover(id, function(id){
			that.drawTrack(id);
		});
	});

	var $track = this.container.find('.pl_inside .track[rel="'+id+'"]');
	
	if(!track.file || track.disable){$track.addClass('disabled');}
	else{$track.removeClass('disabled');}

	$track.find('.cover').attr('src', track.cover);
	$track.find('.title').html(track.title);
	$track.find('.artist').html(track.artist);
	
	
	if(id == this.st.playlist.curr){
		this.drawCurrTrack();
	}
};

plateView.prototype.drawCurrTrack = function(){
	var id = this.st.playlist.curr;
	var info = $.extend({title: null, artist:null, cover:null, file:false}, this.st.playlist.tracks[id]);
	info.duration = this.st.getDuration();
	
	this.setCover(info.cover);
	
	if(info.buyLink){
		this.container.find('.album .buyButton').attr('href', info.buyLink).show();
	}else{
		this.container.find('.album .buyButton').hide();
	}

	var $title = this.container.find('.info .title');
	if(info.title){
		$title.html(info.title);
	}else{
		$title.html('Unknown Title');
	}

	var $artist = this.container.find('.info .artist');
	if(info.artist){$artist.html(info.artist);}
	else{$artist.html('Unknown Artist');}

	var $duration = this.container.find('.allTime');
	if(!isNaN(info.duration) && info.duration !== Infinity && info.duration > 0){
		$duration.html(this.secToMin(info.duration));
		if($().slider){
			this.container.find('.progress')
				.slider('option', 'disabled', false)
				.slider('option', 'max', info.duration)
				.slider('option', 'value', 0)
			;
		}
	}else{
		$duration.html('∞');
		if($().slider){
			this.container.find('.progress')
				.slider('option', 'max', 0)
				.slider('option', 'disabled', true)
				.slider('option', 'value', 0)
			;
		}
	}
	
	this.drawBuffer();
	

	this.container.find('.pl_inside .track.active').removeClass('active');
	var $activeTrack = this.container.find('.pl_inside .track[rel="'+id+'"]');
	$activeTrack.addClass('active');
	var firstIndex = this.container.find('.pl_inside .track:first').index();
	
	if(this.opt.playlistHeight >= $activeTrack.outerHeight(true)*2){
		var scPos = ($activeTrack.index() - (1+firstIndex)) * $activeTrack.outerHeight(true);
	}else{
		var scPos = ($activeTrack.index() - firstIndex) * $activeTrack.outerHeight(true);
	}

	this.container.find('.pl_inside').stop().animate({'scrollTop': scPos}, 300, function(){
		if($().perfectScrollbar){
			$(this).perfectScrollbar('update');
		}
	});
};

plateView.prototype.loadUsedEffects = function(){
	if(typeof(this.opt.coverEffects) == 'object'){
		this.usedEffects = this.opt.coverEffects;
	}else if(this.opt.coverEffects == true){
		this.usedEffects = [];
		var that = this;
		$.each(this.coverEffects, function(i){
			that.usedEffects.push(i);
		});
	}else{
		this.usedEffects = false;
	}
};

plateView.prototype.setCover = function(src){
	var $cover = this.container.find('.album .cover');
	
	var newCover = false;
	if(src){newCover = src;}
	else{newCover = this.opt.images.albumCover;}
	
	var $album = this.container.find('.album');
	if($album.width() == $album.height()){
		$album.stop().animate({width:'100%'}, 700, function(){
			$album.removeClass('center');
		});
	}
	
	if($cover.attr('src') != newCover){
		var that = this;

		if(!oldIE){//TODO remove
			$album.find('.record').css('backgroundImage', 'url('+newCover+')');
		}
		
		if(this.opt.changeTrackChangePlate){
			if($album.css('width') == '100%'){
				$album.removeClass('center');
			}
			
			$album.stop().animate({width:$album.height()}, 400, function(){
				$(this).stop().animate({width:'100%'}, 700, function(){
					$album.removeClass('center');
				});
			});
		}
		
		this.container.find('.album .cover_hide').attr('src', newCover).load(function(e){
			if(that.usedEffects){
				var currEffect = that.coverEffects[that.usedEffects[Math.floor(Math.random()*that.usedEffects.length)]];
				if(typeof(currEffect) == 'function'){
					$cover.stop();
					currEffect($cover, function(){
						$cover.attr('src', newCover).load(function(e){
							$(this).attr('style', that.coverStartStyle).unbind(e);
						});
					});
				}else{
					$cover.attr('src', newCover);
				}
			}else{
				$cover.attr('src', newCover);
			}
			$(this).unbind(e);
		});
	}
};

plateView.prototype.destruct = function(){
	this.container.html(this.opt.defContent);
	this.container.removeClass(this.opt.skin);
};

plateView.prototype.drawPosition = function(){
	var pos = this.st.getCurrTime();
	
	if(!isNaN(pos)){
		if($().slider){
			this.container.find('.progress').slider('option', 'value', pos);
		}
		this.container.find('.curTime').html(this.secToMin(pos));
		if(!oldIE && $().rotate){//TODO oldie
			this.container.find('.record').rotate({animateTo:this.secToDeg(pos)});
		}
	}
};

plateView.prototype.drawBuffer = function(){
	this.container.find('.bufer').hide();
	var buf = this.st.getBuffer();
	for(var i = 0; i < buf.length; i++){
		var $seg = this.container.find('.bufer.seg'+i);
		if(!$seg.size()){
			$seg = $('<div class="bufer seg'+i+'"></div>').appendTo(this.container.find('.progress'));
		}
		$seg.css({
			left: buf[i][0]+'%'
		}).stop().animate({
			width: buf[i][1]+'%'
		}, 100).show();
	}
};


var methods = {
	init: function(options){
		options = $.extend({
			onStart:{
				pause: true,
				repeat: false,
				random: false,
				volume: 50,
				speed: 1.0
			},
			
			useCookies: false,
			uniqueId: 'plate',
			speeds:[0.5, 0.7, 1, 1.1, 1.2, 1.5, 2],
			controls:['cover', 'vinyl', 'trackInfo', 'volume', 'progress', 'repeat', 'random', 'speed', 'playlist', 'buyButton', 'next', 'play', 'prev'],
			width: 320,
			playlistHeight: 200,
			changeTrackChangePlate: true,
			skin: false,
			
			coverEffects: true,
			plateDJ: true,
			coverAnimSpeed: 300,
			
			playlistScrollPropagation: false,
			playlist: false,
			
			preloadFirstTrack: false,
			images: {
				albumCover: 'data:image/jpg;base64,/9j/4QAYRXhpZgAASUkqAAgAAAAAAAAAAAAAAP/sABFEdWNreQABAAQAAABkAAD/4QMraHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLwA8P3hwYWNrZXQgYmVnaW49Iu+7vyIgaWQ9Ilc1TTBNcENlaGlIenJlU3pOVGN6a2M5ZCI/PiA8eDp4bXBtZXRhIHhtbG5zOng9ImFkb2JlOm5zOm1ldGEvIiB4OnhtcHRrPSJBZG9iZSBYTVAgQ29yZSA1LjMtYzAxMSA2Ni4xNDU2NjEsIDIwMTIvMDIvMDYtMTQ6NTY6MjcgICAgICAgICI+IDxyZGY6UkRGIHhtbG5zOnJkZj0iaHR0cDovL3d3dy53My5vcmcvMTk5OS8wMi8yMi1yZGYtc3ludGF4LW5zIyI+IDxyZGY6RGVzY3JpcHRpb24gcmRmOmFib3V0PSIiIHhtbG5zOnhtcD0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLyIgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0UmVmPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VSZWYjIiB4bXA6Q3JlYXRvclRvb2w9IkFkb2JlIFBob3Rvc2hvcCBDUzYgKFdpbmRvd3MpIiB4bXBNTTpJbnN0YW5jZUlEPSJ4bXAuaWlkOjVFRTNEMDQxNDE5NDExRTNBQTBFQjBCRDc0OTA1MjFCIiB4bXBNTTpEb2N1bWVudElEPSJ4bXAuZGlkOjVFRTNEMDQyNDE5NDExRTNBQTBFQjBCRDc0OTA1MjFCIj4gPHhtcE1NOkRlcml2ZWRGcm9tIHN0UmVmOmluc3RhbmNlSUQ9InhtcC5paWQ6NUVFM0QwM0Y0MTk0MTFFM0FBMEVCMEJENzQ5MDUyMUIiIHN0UmVmOmRvY3VtZW50SUQ9InhtcC5kaWQ6NUVFM0QwNDA0MTk0MTFFM0FBMEVCMEJENzQ5MDUyMUIiLz4gPC9yZGY6RGVzY3JpcHRpb24+IDwvcmRmOlJERj4gPC94OnhtcG1ldGE+IDw/eHBhY2tldCBlbmQ9InIiPz7/7gAmQWRvYmUAZMAAAAABAwAVBAMGCg0AAAhIAAAKsgAAD9oAABlw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',
				playlistCover: 'data:image/jpg;base64,/9j/4QAYRXhpZgAASUkqAAgAAAAAAAAAAAAAAP/sABFEdWNreQABAAQAAABkAAD/4QMraHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLwA8P3hwYWNrZXQgYmVnaW49Iu+7vyIgaWQ9Ilc1TTBNcENlaGlIenJlU3pOVGN6a2M5ZCI/PiA8eDp4bXBtZXRhIHhtbG5zOng9ImFkb2JlOm5zOm1ldGEvIiB4OnhtcHRrPSJBZG9iZSBYTVAgQ29yZSA1LjMtYzAxMSA2Ni4xNDU2NjEsIDIwMTIvMDIvMDYtMTQ6NTY6MjcgICAgICAgICI+IDxyZGY6UkRGIHhtbG5zOnJkZj0iaHR0cDovL3d3dy53My5vcmcvMTk5OS8wMi8yMi1yZGYtc3ludGF4LW5zIyI+IDxyZGY6RGVzY3JpcHRpb24gcmRmOmFib3V0PSIiIHhtbG5zOnhtcE1NPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvbW0vIiB4bWxuczpzdFJlZj0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL3NUeXBlL1Jlc291cmNlUmVmIyIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bXBNTTpEb2N1bWVudElEPSJ4bXAuZGlkOjAzMDA1MEIwMzcwRDExRTM4RjRFRjhDQjA5NUNDQjUyIiB4bXBNTTpJbnN0YW5jZUlEPSJ4bXAuaWlkOjAzMDA1MEFGMzcwRDExRTM4RjRFRjhDQjA5NUNDQjUyIiB4bXA6Q3JlYXRvclRvb2w9IkFkb2JlIFBob3Rvc2hvcCBDUzYgKFdpbmRvd3MpIj4gPHhtcE1NOkRlcml2ZWRGcm9tIHN0UmVmOmluc3RhbmNlSUQ9InhtcC5paWQ6NDkxMzc4NjYzNzBCMTFFMzkzM0I4MUQ3NjRDRjBDNzMiIHN0UmVmOmRvY3VtZW50SUQ9InhtcC5kaWQ6NDkxMzc4NjczNzBCMTFFMzkzM0I4MUQ3NjRDRjBDNzMiLz4gPC9yZGY6RGVzY3JpcHRpb24+IDwvcmRmOlJERj4gPC94OnhtcG1ldGE+IDw/eHBhY2tldCBlbmQ9InIiPz7/7gAmQWRvYmUAZMAAAAABAwAVBAMGCg0AAAU5AAAF1AAABmwAAAc2/9sAhAABAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAgICAgICAgICAgIDAwMDAwMDAwMDAQEBAQEBAQIBAQICAgECAgMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwP/wgARCAAeAB4DAREAAhEBAxEB/8QAqwAAAwEBAQAAAAAAAAAAAAAAAgYHBQQJAQEBAQEBAAAAAAAAAAAAAAAAAQIGAxAAAQQCAgMBAAAAAAAAAAAAAAECAwQTFEAiERIFBhEAAgECBQMBCQAAAAAAAAAAAQIDERIAITEiBBBREzJhcYGhQpIjUwUSAQAAAAAAAAAAAAAAAAAAAEATAAICAAUDBAMAAAAAAAAAAAERACEQMUFRYXGRoTDwgeGx0fH/2gAMAwEAAhEDEQAAAfUXouXz17kITdJL5171N/RFJllStDhcFMaQz//aAAgBAQABBQLKT3EhEmRTKbBYuvjmrrIsWwZz9LbVrWSY2ZzsfQbR2U8+vY//2gAIAQIAAQUC4H//2gAIAQMAAQUC4H//2gAIAQICBj8CB//aAAgBAwIGPwIH/9oACAEBAQY/AsKKx3sy7WOfjOr0GdPbiqkEHQjMEdx01xOHuDeWSpatzZ7d59Qs07YhJ5b+Ixq4jiURNVt1DLuZox2y68AXet5kX3sIwAPicJH+tET7VAPz68aT+g6WrxOcq8eZfwSqwj80hk+mWJRsA3GuWeFpWlq21rW20W+rdp3z6f/aAAgBAQMBPyHrEHCuAxWIrAsyHWBwLzOBDImoM6xADDow9agCxCMwOa9aUoDB2Ij0XXtSoRmdsdNOnSNuPfzM/qzVnOawQRVOd9dbI249/MeyIhvdk0slMFAumh0flwjUr5Lj2T//2gAIAQIDAT8h9E43jc//2gAIAQMDAT8heDj9X//aAAwDAQACEQMRAAAQIpm4nGUy/9oACAEBAwE/EE+0fqZ6kyopLYChkUUCYNlMYQhtYn2j9Qc4UsUsGxqFpAe3nYiIANGJlUABDkWMQlPZ0LgWUonJP5XT8Np/CECQglJgBDFGOgNYUeAUBYGxYFtc/hCOX3+4QF+qN/5uIiLATsEZBJREFxRdqc05ff7n/9oACAECAwE/EK57CZZNxcnsJXPYYHVpwAoI1xLiO07YuIjtgPMvB//aAAgBAwMBPxBNh5gLyA8xNvzE2HnDTLzNYjvgMLiO8D+YjvEd5//Z',
				record: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAANEAAADRCAYAAABSOlfvAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyJpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENTNiAoV2luZG93cykiIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6ODIyQjhCOEQ0MThCMTFFM0IzM0ZFNkEyQ0RENkVCRkQiIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6ODIyQjhCOEU0MThCMTFFM0IzM0ZFNkEyQ0RENkVCRkQiPiA8eG1wTU06RGVyaXZlZEZyb20gc3RSZWY6aW5zdGFuY2VJRD0ieG1wLmlpZDo4MjJCOEI4QjQxOEIxMUUzQjMzRkU2QTJDREQ2RUJGRCIgc3RSZWY6ZG9jdW1lbnRJRD0ieG1wLmRpZDo4MjJCOEI4QzQxOEIxMUUzQjMzRkU2QTJDREQ2RUJGRCIvPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/PkULnnYAAJzmSURBVHja7H0JuF1l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',
				recordLight: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAANEAAADRCAYAAABSOlfvAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyJpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENTNiAoV2luZG93cykiIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6OURGOUNDMjI0MTkyMTFFM0IwOURGNUI4N0IwQTg0OUYiIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6OURGOUNDMjM0MTkyMTFFM0IwOURGNUI4N0IwQTg0OUYiPiA8eG1wTU06RGVyaXZlZEZyb20gc3RSZWY6aW5zdGFuY2VJRD0ieG1wLmlpZDo5REY5Q0MyMDQxOTIxMUUzQjA5REY1Qjg3QjBBODQ5RiIgc3RSZWY6ZG9jdW1lbnRJRD0ieG1wLmRpZDo5REY5Q0MyMTQxOTIxMUUzQjA5REY1Qjg3QjBBODQ5RiIvPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/PnWW8XQAABtCSURBVHja7F0Nk+wo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',
				coverShadow: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAOgAAADoCAYAAADlqah4AAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyJpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENTNiAoV2luZG93cykiIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6QUVDRUQyNEU0MTg3MTFFMzg3RDdFNTQxRUZEMjFFQzkiIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6QUVDRUQyNEY0MTg3MTFFMzg3RDdFNTQxRUZEMjFFQzkiPiA8eG1wTU06RGVyaXZlZEZyb20gc3RSZWY6aW5zdGFuY2VJRD0ieG1wLmlpZDpBRUNFRDI0QzQxODcxMUUzODdEN0U1NDFFRkQyMUVDOSIgc3RSZWY6ZG9jdW1lbnRJRD0ieG1wLmRpZDpBRUNFRDI0RDQxODcxMUUzODdEN0U1NDFFRkQyMUVDOSIvPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/Pryn1mgAAAPQSURBVHja7NrRTuJAFIDhttQqZn2Vff+n2LdRKVK6UzPDHscaEyTNXnxfclJQvGny5wxI23zUfnMFbmf+5tr0IcASYZcfd+FxK1K4eZzLnFeul9fUgS5B7lZGqHD7MJeZqmliqH21OZcY7/IM+dqvhAr8PM5Tmrc8x/y8DdfLETfGuYT5kGaf5j5PH0IVKFyvbM0S55jmkBscq+Pu3Idjawl0ifMxzVO+llCHsEWB6zZo2ZzHHORLmuew+OKG/bRBhxzk0zzPf9xP2Ebbtr+r7bpcz/ET27JB7/PmBLazD28nL28ly3G1HHH7/KK9+wWbBzrkBrsYaP0vlhIpsJ2h2p6fNmjcooP7BZu6a/59CHvpMn4iW39RAdjO2peCmjrQeNwFtrP6JSAhwn9eLSBQQKAgUECgIFBAoIBAQaCAQEGggEABgYJAAYGCQN0CECggUBAoIFBAoCBQQKAgUECggEBBoIBAQaCAQAGBgkABgYJAAYECAgWBAgIFgQICBQQKAgUECgIFBAoIFAQKCBQECggUECgIFBAoCBQQKCBQECggUBAoIFBAoCBQQKAgUECggEBBoIBAQaCAQAGBgkABgYJAAYECAgWBAgIFgQICBQQKAgUECgIFBAoIFAQKCBQECggUECgIFBAoCBQQKCBQECggUBAoIFBAoCBQQKAgUECggEBBoIBAQaCAQAGBgkABgYJAAYECAgWBAgIFgQICBQQKAgUECgIFBAoIFAQKCBQECggUECgIFBAoCBQQKCBQECggUBAoIFBAoCBQQKAgUECggEBBoIBAQaCAQAGBgkABgYJAAYECAgWBAgIFgQICBQQKAgUECgIFBAoIFAQKCBQECggUECgIFBAoCBQQKCBQECggUBAoIFBAoCBQQKAgUECggEBBoIBAQaCAQAGBgkABgYJAAYECAgWBAgIFgQICBQQKAgUECgIFBApcFehcXYFtzN8FOuc55wG2U7qbY6x1oMsLpjQn9ws2dQqBXjZq90WcR/cLNvWW25viJu2qo+2UXzi6X7CpMbc3xbeYXTj/xjhf3C/Y1Gs+uZ7C+9GmW9mehzTP7hds6qXaou/vQdsc6S7NXZohzUOaxzS/0uzz8/v8+13jf6dwrbIMT+G0+prjfM6PD2GTTn14D1o+IBrDsXfMYZY4dzlq4DrnKtJj7uxQHXHfN2gf/qhs1BjsmF9TNqftCT/foqWvKYRaPsWNgc5tCLMNEe7CdOF3tif8PNC4Sc8h1vizT4HGUGOQbfV74DZbtGk+fnuontXgvopRnHD7TVo///DzvwIMAHi+w71OOmqGAAAAAElFTkSuQmCC'
			},
			phpGetter: '/plate/php/plate.php',
			lastFM_API_key: '645753db26e26465663a7be06260b60c',
			titleUpdateTime: 4
		}, options);
		
		
		return this.each(function(){
			var $this = $(this);
			var data = $this.data('plate');

			if(!data){
				options.defContent = $this.text();

				var pPlayer = new platePlayer(options);
				var pView = new plateView($this, pPlayer, options);
			
				pPlayer.on.canplay = function(){
					$this.trigger('plateCanPlay', [pPlayer, pView]);
					if(!pPlayer.controls.pause){
						pPlayer.play();
						pView.drawControl();
					}
				};
			
				pPlayer.on.durationChange = function(duration){
					$this.trigger('plateDurationChange', [pPlayer, pView]);
					pView.drawCurrTrack();
				};
			
				pPlayer.on.ended = function(){
					$this.trigger('plateEnded', [pPlayer, pView]);
					if(pPlayer.controls.repeat){
						if(pPlayer.toTrack(pPlayer.playlist.curr)){
							pView.drawCurrTrack();
						}
					}else{
						if(pPlayer.toNext()){
							pView.drawCurrTrack();
						}
					}
				};
			
				pPlayer.on.pause = function(){
					$this.trigger('platePause', [pPlayer, pView]);
					pView.drawControl();
				};
				
				pPlayer.on.play = function(){
					$this.trigger('platePlay', [pPlayer, pView]);
					pView.drawControl();
				};
				
				pPlayer.on.progress = function(buffer){
					pView.drawBuffer();
				};
				
				pPlayer.on.timeupdate = function(pos){
					$this.trigger('plateTimeUpdate', [pPlayer, pView]);
					pView.drawPosition();
				};
				
				pPlayer.on.playlistChange = function(){
					pView.drawPlaylist();
				};
				
				pPlayer.on.startLoad = function(){
					$this.find('.curTime').text('loading...');
				};
				
				pPlayer.on.error = function(error, type){
					$this.trigger('plateError', [pPlayer, pView, error]);
					var currTrack = pPlayer.playlist.tracks[pPlayer.playlist.curr];
					if(currTrack.altFile){
						pPlayer.setSrc(currTrack.altFile);
					}else{
						if('error' === type){
							currTrack.disable = true;
							pView.drawTrack(pPlayer.playlist.curr);
						}
						/*if(pPlayer.toNext()){
							pView.drawCurrTrack();
						}*/
					}
				};
			
				$this
					.on('click.plateControls', '.prev:not(.disabled)', function(){
						if(pPlayer.toNext(-1)){
							pView.drawCurrTrack();
						}
					})
					.on('click.plateControls', '.next:not(.disabled)', function(){
						if(pPlayer.toNext()){
							pView.drawCurrTrack();
						}
					})
					.on('click.plateControls', '.play:not(.disabled)', function(){
						if(!pPlayer.playlist.curr){
							pPlayer.toNext();
						}else{
							pPlayer.playedReverse();
						}
					//	pPlayer.saveToCookie();
						pView.drawControl();
					})
					.on('click.plateControls', '.random:not(.disabled)', function(){
						pPlayer.controls.random = !pPlayer.controls.random;
						pPlayer.saveToCookie();
						pView.drawControl();
					})
					.on('click.plateControls', '.repeat:not(.disabled)', function(){
						pPlayer.controls.repeat = !pPlayer.controls.repeat;
						pPlayer.saveToCookie();
						pView.drawControl();
					})
					.on('click.plateControls', '.speed:not(.disabled)', function(){
						pPlayer.setSpeed();
						pPlayer.saveToCookie();
						pView.drawControl();
					})
					.on('click.plateControls', '.mute:not(.disabled)', function(){
						if(pPlayer.setVolume()){
							pView.drawControl();
						}
					})
					.on('click.plateControls', '.pl_inside .track:not(.disabled, .active)', function(){
						if(pPlayer.toTrack($(this).attr('rel'))){
							pView.drawCurrTrack();
						}
					})
				;
				
				$this.find('.vl_slider').on('slide.plateControls', function(e, ui){
					if(pPlayer.setVolume(ui.value)){
						pView.drawControl();
					}
					pPlayer.saveToCookie();
					$(ui.handle).css({'margin-left':-((ui.value)*$(ui.handle).width()/100)});
				});
				
				$this.find('.progress').on('slide.plateControls', function(e, ui){
					pPlayer.setCurrTime(ui.value);
					pView.drawPosition();
				});
			
				if(options.plateDJ && !oldIE){//TODO ie
					$this.find('.record_light').addClass('dj');
					$this.on('mousedown.plateDJ', '.record_light', function(e){
						e.preventDefault();
						var oldPause = pPlayer.controls.pause;
						if(oldPause){
							pPlayer.play();
						}
						var oldy = e.pageY;
						var rotParam = 180/$(this).height()*(78/pPlayer.getSpeed())/60/360;
						
						$this.on('mousemove.plateDJMM', '.record_light', function(e){
							var oldTime = pPlayer.getCurrTime();
							pPlayer.setCurrTime(oldTime + (e.pageY - oldy)*rotParam);
							oldy = e.pageY;
						});
						
						$(document).on('mouseup.plateDJ', function(e){
							if(oldPause){
								pPlayer.pause();
							}
							$this.unbind('.plateDJMM');
							$(document).unbind(e);
						});
					});
				}
				
				//first run
				if(!pPlayer.controls.pause){
					pPlayer.toNext();
				}else if(options.preloadFirstTrack){
					pPlayer.toNext(undefined, true);
				}
				
				$this
					.on('platePlay', function(e, audio, face){
						audio.upPosition = 0;
					})
					.on('plateTimeUpdate', function(e, audio, face){
						if(Infinity == audio.getDuration() && (audio.getCurrTime() > audio.upPosition)){
							audio.upPosition += options.titleUpdateTime;
							var trackId = audio.playlist.curr;
							var track = audio.playlist.tracks[trackId];
							$.ajax({
								url: audio.opt.phpGetter,
								type: 'GET',
								dataType: 'json',
								data: {
									method: 'parseStreamTitle',
									stream: track.file
								},
								success:function(data){
									if(track.artist != data.artist || track.title != data.title){
										track.artist = data.artist;
										track.title = data.title;
										if(!track.defCover){track.defCover = track.cover;}
										track.cover = false;
										track.isLoadLastFM = false;
										audio.grabLastFMCover(trackId, function(){
											var oldEfect = face.opt.changeTrackChangePlate;
											face.opt.changeTrackChangePlate = false;
											if(!track.cover){track.cover = track.defCover;}
											face.drawCurrTrack();
											face.opt.changeTrackChangePlate = oldEfect;
										});
									}
								}
							});
						}
					})
				;

				
				$(this).data('plate', {
					target : $this,
					pView : pView,
					pPlayer : pPlayer,
					//old API support
					destruct: function(){$this.plate('destroy');},
					play: function(){$this.plate('play');},
					pause: function(){$this.plate('pause');}
				});
			}
		});
	},
	play: function(){
		return this.each(function(){
			var data = $(this).data('plate');
			
			if(data){
				data.pPlayer.play();
				data.pView.drawControl();
			}
		});
	},
	pause: function(){
		return this.each(function(){
			var data = $(this).data('plate');
			
			if(data){
				data.pPlayer.pause();
				data.pView.drawControl();
			}
		});
	},
	destroy: function(){
		return this.each(function(){
			var $this = $(this);
			var data = $this.data('plate');
			
			$this.unbind('.plateControls');
			$this.unbind('.plateDJ');
			$this.unbind('.plateDJMM');
			$(document).unbind('.plateDJ');
			$this.find('.progress').unbind('.plateControls');
			$this.find('.vl_slider').unbind('.plateControls');
			
			data.pView.destruct();
			data.pPlayer.destruct();
			
			$this.removeData('plate');
		});
	}
};

$.fn.plate = function(method){
	if(methods[method]){
		return methods[method].apply(this, Array.prototype.slice.call(arguments, 1));
	}else if(typeof method === 'object' || ! method){
		return methods.init.apply(this, arguments);
	}else{
		$.error('Method “'+ method+'” not found in Plate.');
	}    
};

})(jQuery);

jQuery(function(){
	jQuery('.quickPlate').plate();
});