$(function(){
	var myCodeMirror = false;

	$('#confControls, #confEffects, #confVinyl, #confStart').on('change', function(){
		var params = {};
		
		params.playlist = [
			{title: 'Hit the road Jack', artist: 'Anton Belyaev', file:'/demo_files/media/Hit the road Jack.mp3', cover:'/demo_files/media/belyaev.jpg', buyLink:'/'},
			{file:'http://91.250.82.237:8004/;', artist:'stream', title:'Rock radio'}
		];
		params.uniqueId = 'plateLightConf';
		
		params.controls = [];
		params.controls.splice(0,params.controls.length);
		$('#confControls input[type=checkbox]:checked').each(function(){
			params.controls.push($(this).attr('name'));
		});
		
		params.coverEffects = [];
		$('#confEffects input[type=checkbox]:checked').each(function(){
			params.coverEffects.push($(this).attr('name'));
		});
		
		if($('#confEffects [name=coverAnimSpeed]').val()){
			params.coverAnimSpeed = parseInt($('#confEffects [name=coverAnimSpeed]').val());
		}
		
		if($('#confVinyl [name=skin]').val()){
			params.skin = $('#confVinyl [name=skin]').val();
		}
		
		if($('#confVinyl [name=width]').val()){
			params.width = parseInt($('#confVinyl [name=width]').val());
		}
		
		if($('#confVinyl [name=playlistHeight]').val()){
			params.playlistHeight = parseInt($('#confVinyl [name=playlistHeight]').val());
		}
		

		params.plateDJ = $('#confVinyl [name=plateDJ]:checked').size() ? true : false;
		params.changeTrackChangePlate = $('#confVinyl [name=changeTrackChangePlate]:checked').size()  ? true : false;
		

		params.onStart = {};
		params.onStart.pause = $('#confStart [name=pause]:checked').size() ? true : false;
		params.onStart.repeat = $('#confStart [name=repeat]:checked').size() ? true : false;
		params.onStart.random = $('#confStart [name=random]:checked').size() ? true : false;
		params.onStart.volume = parseInt($('#confStart [name=volume]').val());
		params.onStart.speed = parseFloat($('#confStart [name=speed]').val());
			
		params.useCookies = $('#confStart [name=useCookies]:checked').size()  ? true : false;
		params.preloadFirstTrack = $('#confStart [name=preloadFirstTrack]:checked').size()  ? true : false;
			
			
		if($('.demoPlate').data('plate')){
			$('.demoPlate').data('plate').destruct();
		}
		
		if(params.skin == 'dark'){
			$('body').addClass('darkSkin');
		}else{
			$('body').removeClass('darkSkin');
		}
		
		$('.demoPlate').plate(params);
		$(window).resize();
		
		
		var demoPlaylist = "\t\tplaylist:[\n\t\t\t//{title:'track title', artist:'artist', file:'/file/path.mp3', cover:'/cover/path.jpg', buyLink:'http://example.com/'},\n\t\t\t//{title:'Your stream', artist:false, file:'http://206.190.135.28:8006/;', cover:false}\n\t\t]";
		var tpmDemoParams = [];
		$.each(params, function(key, val){
			if(key == 'playlist'){
				tpmDemoParams.push(demoPlaylist);
			}else if(key == 'controls'){
				var tmp = (params.controls).join("', '");
				if(tmp){tmp = "'"+tmp+"'"};
				tpmDemoParams.push("controls: ["+tmp+"]");
			}else if(key == 'coverEffects'){
				var tmp = (params.coverEffects).join("', '");
				if(tmp){tmp = "'"+tmp+"'"};
				tpmDemoParams.push("coverEffects: ["+tmp+"]");
			}else if(key == 'uniqueId'){
				//
			}else if(key == 'onStart'){
				var tmpDemoStart = [];
				$.each(params.onStart, function(key, val){
					tmpDemoStart.push('\t\t\t'+key+ ': ' + val);
				});
				tpmDemoParams.push('onStart: {\n'+tmpDemoStart.join(',\n')+'\n\t\t}');
			}else{
				if(typeof(val) == 'string'){
					tpmDemoParams.push(key+ ': ' + "'"+ val +"'");
				}else{
					tpmDemoParams.push(key+ ': ' + val);
				}
			}
		});
		
		if(!myCodeMirror){
			myCodeMirror = CodeMirror($('#code')[0],{
				lineNumbers: true,
				mode: 'javascript',
				readOnly: true
			});
		}
		
		myCodeMirror.setValue("jQuery(function(){\n\tjQuery('.you_div_class').plate({\n"+tpmDemoParams.join(',\n\t\t')+"\n\t});\n});");
	});
	
	$('#confControls').change();
	
	$(window).resize(function(){
		$('body').removeClass('responsive');
	
		if($(this).width() < ($('.demoPlate').outerWidth(true)+$('#code').outerWidth(true))){
			$('body').addClass('responsive');
		}
	}).resize();
	
});