$(function(){
	var arrWidth = (($(window).width() >= 840 ) ? $(window).width()+640 : 840+640);
	$('.arrows').css({
		'width': arrWidth,
		'margin-left': -(arrWidth/2),
		'opacity': 0
	});
	
	$(window).load(function(){
		$('.arrows').animate({
			'margin-left': -(840/2),
			'width': 840,
			'opacity': 1
		},1500, 'easeOutBounce');
	});

	$(window).scroll(function(){
		if(document.body.scrollHeight - $(this).scrollTop()  <= $(this).height()){
			$('.demoLight .scroll').show();
			$('.demoDark .scroll').hide();
		}else if($(this).scrollTop() == 0){
			$('.demoLight .scroll').hide();
			$('.demoDark .scroll').show();
		}
	});
	
	$('body')
		.on('click', '.demoLight .scroll', function(){
			$('body, html').animate({
				'scrollTop':0
			}, 400);
		})
		.on('click', '.demoDark .scroll', function(){
			$('body, html').animate({
				'scrollTop':$(window).height()
			}, 400);
		})
	;
	$(window).resize();
});

$(window).resize(function(){
	$('.demoLight, .demoDark').css('min-height', $(this).height()-120);
});