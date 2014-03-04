<?php
$res = array();

$settings = array(
	'supported' => array(
		'mp3',
		'ogg',
		'wave',
		'wav',
		'aac',
		'mp4'
	)
);

switch($_GET['method']){
    case 'parseFolder':{
		require_once('getid3/getid3.php');
		$getID3 = new getID3;

		$filesDir = $_GET['path'].'/';
		$files = @scandir($_SERVER['DOCUMENT_ROOT'].$filesDir);
		$jpr = array();
		if($files){
			foreach($files as $fileName){
				if(file_exists($_SERVER['DOCUMENT_ROOT'].$filesDir.$fileName) && in_array(end(explode('.', $fileName)), $settings['supported'])){
					$tag = $getID3->analyze($_SERVER['DOCUMENT_ROOT'].$filesDir.$fileName);
				
					$jpr[] = array(
						'file' => $filesDir.$fileName,
						'title' => $tag['id3v2']['comments']['title'][0] ? $tag['id3v2']['comments']['title'][0] : false,
						'artist' => $tag['id3v2']['comments']['artist'][0] ? $tag['id3v2']['comments']['artist'][0] : false,
						'cover' => $tag['comments']['picture'][0] ? "data:".$tag['comments']['picture'][0]['image_mime'].";base64," . base64_encode($tag['comments']['picture'][0]['data']) : null
					);
				}
			}
		}
		
		$res = $jpr;
	}
    break;
    case 'getID3':{
		require_once('getid3/getid3.php');
		$getID3 = new getID3;
		
		$file = (string)$_GET['file'];
		if(0 === strpos($file, 'http')){
			$filename = tempnam('/tmp','getid3');
            if(file_put_contents($filename, file_get_contents($file, false, null, 0, 35000))){
				$tag = $getID3->analyze($filename);
			}
		}else{
			$file = $_SERVER['DOCUMENT_ROOT'].$file;
			$tag = $getID3->analyze($file);
		}
	
		$res = array(
			'title' => $tag['id3v2']['comments']['title'][0] ? $tag['id3v2']['comments']['title'][0] : false,
			'artist' => $tag['id3v2']['comments']['artist'][0] ? $tag['id3v2']['comments']['artist'][0] : false,
			'cover' => $tag['comments']['picture'][0] ? "data:".$tag['comments']['picture'][0]['image_mime'].";base64," . base64_encode($tag['comments']['picture'][0]['data']) : null
		);
	}
    break;
    case 'parsePlaylist':
        require_once('hn_parseplaylist.class.php');
		
		$file = (string)$_GET['playlist'];
		$file = (0 === strpos($file, 'http')) ? $file : $_SERVER['DOCUMENT_ROOT'].$file;
		
		$ppl = new hn_ParsePlaylist();
		$ppl->parse_string(file_get_contents($file));
		if($ppl->tracks){
			foreach($ppl->tracks as $track){
				$res[] = array(
					'file' => $track['path'],
					'title' => $track['title'],
					'type' => $track['type']
				);
			}
		}
    break;
	case 'parseStreamTitle':
		$url = str_replace('http://', '', $_REQUEST['stream']);

		$fp = @fsockopen($url);
		if($fp){
			fputs($fp, "GET /7.html HTTP/1.0\r\nUser-Agent: Mozilla\r\n\r\n");
			while(!feof($fp)){
				$info = fgets($fp);
			}
			$info = str_replace('</body></html>', "", $info);
			$split = explode(',', $info);
			if(!empty($split[6])){
				$title = str_replace('\'', '`', $split[6]);
				$title = str_replace(',', ' ', $title);
				$title = explode('-', $title);
				$res = array(
					'artist' => trim($title[1]) ? trim($title[0]) : false,
					'title' =>  trim($title[1]) ? trim($title[1]) : trim($title[0])
				);
			}
		}
    break;
}

echo json_encode($res);
exit();
?>