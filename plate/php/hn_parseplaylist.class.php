<?PHP
/*******************************************************************************
  * PHP-Script:
  *
  * Parses Playlists of type 'extended m3u' and 'pls version 2'
  * and converts between that types (and also 'simple m3u')
  *
  * - parse_file($filename) reads a file and parses it
  * - parse_string($s)      parses a playlist contained in a string. String must contain LineEndings!
  *
  * - summary($asArray=FALSE) returns Infos as Array or displays Infos: ('file','valid','type','count','errors')
  * - internal holds result in Array $tracks ('title','file','seconds')
  *
  * - sortPlaylist($sortlistArray) sorts the internal Playlist in hirarchically order of the given fieldnameList
  *   - $sortlistArray can be every combination of fieldnames: 'type','path','title','time' (type = [radio | file])
  *
  * - saveAs_m3u($filename,$onlyType='')          save the (optionally sorted or otherwise manipulated) internal Playlist as 'extended m3u' to filename
  * - saveAs_simple_m3u($filename,$onlyType='')   save the (optionally sorted or otherwise manipulated) internal Playlist as 'simple m3u' to filename
  * - saveAs_pls($filename,$onlyType='')          save the (optionally sorted or otherwise manipulated) internal Playlist as 'pls version 2' to filename
  *   NOTE: with the saveAs... methods you to have to ensure yourself to specify the correct filetype-extension with filename: '.m3u' for extended AND simple m3u | '.pls' for pls Version 2
  *         you can optionally pass as second argument 'radio' or 'file' to save only tracks of the desired type to the playlistfile
  *
  * For more Information, read the comments in class itself and
  * see/try the example files.
  *
  * If you don't have them, go to:
  * - http://hn273.users.phpclasses.org/browse/author/45770.html
  * and select the desired classpage, or go directly to:
  * - http://hn273.users.phpclasses.org/browse/package/2048.html
  *
  ******************************************************************************
  *
  * @Author:    Horst Nogajski <horst@nogajski.de>
  * @Copyright: (c) 1999 - 2005
  * @Licence:   GNU GPL (http://www.opensource.org/licenses/gpl-license.html)
  * @Version:   1.0
  *
  * $Source: //BIKO/CVS_REPOSITORY/hn_php/hn_parsePlaylist/hn_parseplaylist.class.php,v $
  * $Id: hn_parseplaylist.class.php,v 1.7 2005/01/06 20:38:08 horst Exp $
  *
  * Tabsize: 4
  *
  **/



class hn_ParsePlaylist
{

	// Playlistfile
	var $file;

	// Resultarray
	var $tracks;

	// Playlist-Type, in this version it can be: m3u; extm3u or pls2
	var $type;

	// TempArray
	var $temp;

	// Is TRUE if file was successfully parsed and the Result is stored in $tracks!
	// On Error it is FALSE
	var $success;

	// Can contain Errors and Warnings, also if $success is TRUE or FALSE
	var $errormsg;

	var $line_ending = "\n";


/** Constructor
  */
	function hn_ParsePlaylist()
	{
		$this->line_ending = $this->isWin() ? "\r\n" : "\n";
	}



/** PUBLIC METHODS
  */


	/** parses Playlistfile, stores Content in Array "$this->tracks"
	  * @public
	  */
	function parse_file($filename)
	{
		$this->_resetVars();
		if(trim($filename)!='' && file_exists($filename) && is_readable($filename))
		{
			$this->file = $filename;
			if($this->_readfile())
			{
				$this->success = $this->_parsePlaylist();
			}
		}
		return $this->success;
	}


	/** parses Playlist contained in a String, stores Content in Array "$this->tracks"
	  * @public
	  */
	function parse_string($s)
	{
		$this->_resetVars();
		if(trim($s)!='')
		{
			$this->file = '';
			// build array with a key for each line
			$this->temp = preg_split("/\r\n|\r|\n/", $s);
			$this->success = $this->_parsePlaylist();
		}
		return $this->success;
	}


	/** displays summary
	  * @public
	  */
	function summary($asArray=FALSE)
	{
		$a = array();
		$a['file']  = $this->file;
		$a['valid'] = $this->success ? 'yes' : 'no';
		$a['type']  = $this->type;
		$a['count'] = count($this->tracks);
		$a['errors'] = $this->errormsg == '' ? 'no' : $this->errormsg;
		if($asArray)
		{
			return $a;
		}
		if(isset($_SERVER['HTTP_HOST'])) echo "<pre>\n";
		foreach($a as $k=>$v)
		{
			echo "$k\t= $v\n";
		}
		if(isset($_SERVER['HTTP_HOST'])) echo "</pre>\n";
	}


	/** sorts the internal playlist in hierarchyc order of given sortlist
	  * you can use any combination of 'type','path','title','time'
	  * @public
	  */
	function sortPlaylist($sortlistArray=array('type','path','title','time'))
	{
		$this->tracks = $this->_hn_array_sort($this->tracks,$sortlistArray);
	}


	/** saves the Array of parsed Playlist to filename as extended m3u-type
	  * @public
	  */
	function saveAs_m3u($filename,$onlyType='')
	{
		if(!$this->success)
		{
			return FALSE;
		}
		if(!$this->hn_is_dir(dirname($filename)))
		{
			return FALSE;
		}
		if($this->type!='extm3u' && $this->type!='pls2')
		{
			return FALSE;
		}
		$s = $this->_buildPlaylist('extm3u',$onlyType);
		return $this->_write2file($s,$filename);
	}


	/** saves the Array of parsed Playlist to filename as pls-type
	  * @public
	  */
	function saveAs_pls($filename,$onlyType='')
	{
		if(!$this->success)
		{
			return FALSE;
		}
		if(!$this->hn_is_dir(dirname($filename)))
		{
			return FALSE;
		}
		if($this->type!='extm3u' && $this->type!='pls2')
		{
			return FALSE;
		}
		$s = $this->_buildPlaylist('pls2',$onlyType);
		return $this->_write2file($s,$filename);
	}


	/** saves the Array of parsed Playlist to filename as simple m3u-type
	  * @public
	  */
	function saveAs_simple_m3u($filename,$onlyType='')
	{
		if(!$this->success)
		{
			return FALSE;
		}
		if(!$this->hn_is_dir(dirname($filename)))
		{
			return FALSE;
		}
		$s = $this->_buildPlaylist('m3u',$onlyType);
		return $this->_write2file($s,$filename);
	}


	/** returns a Playlist of type extended_m3u as string
	  * @public
	  */
	function stringAs_m3u($onlyType='')
	{
		if(!$this->success)
		{
			return FALSE;
		}
		return $this->_buildPlaylist('extm3u',$onlyType);
	}


	/** returns a Playlist of type pls as string
	  * @public
	  */
	function stringAs_pls($onlyType='')
	{
		if(!$this->success)
		{
			return FALSE;
		}
		return $this->_buildPlaylist('pls2',$onlyType);
	}


	/** returns a Playlist of type simple_m3u as string
	  * @public
	  */
	function stringAs_simple_m3u($onlyType='')
	{
		if(!$this->success)
		{
			return FALSE;
		}
		return $this->_buildPlaylist('m3u',$onlyType);
	}


/** PRIVATE METHODS
  */

	/** Reset internal used variables
	  * @private
	  */
	function _resetVars()
	{
		$this->success = FALSE;
		$this->file = NULL;
		$this->tracks = NULL;
		$this->type = NULL;
		$this->temp = NULL;
		$this->errormsg = NULL;
	}


	/** get file into temp-array
	  * @private
	  */
	function _readfile()
	{
		$fp = @fopen($this->file, 'rb');
		if($fp===FALSE)
		{
			return FALSE;
		}
		$size = filesize($this->file);
		clearstatcache();
		if($size<=0)
		{
			fclose($fp);
			return FALSE;
		}
		$s = fread($fp, $size);
		fclose($fp);
		$this->temp = preg_split("/\r\n|\r|\n/", $s);
		return TRUE;
	}


	/** parse temp-array and build result-array
	  * @private
	  */
	function _parsePlaylist()
	{
		$this->_getType();
		if($this->type=='m3u')
		{
			// it is a simple m3u-list, there are no extended informations
			$this->tracks = $this->temp;
			return TRUE;
		}
		if($this->type=='extm3u')
		{
			// there are extended informations which will be parsed now
			$entries = (count($this->temp) -1) / 2;
			$k = 1;
			for($i=0;$i<$entries;$i++)
			{
				if(strstr($this->temp[$k],'#EXTINF:')!==FALSE)
				{
					$matches = array();
					preg_match('/^#EXTINF:(.*?),(.*)$/',$this->temp[$k],$matches);
					$this->tracks[$i]['time'] = isset($matches[1]) ? $matches[1] : '';
					$this->tracks[$i]['title'] = isset($matches[2]) ? $matches[2] : '';
					$k++;
					$this->tracks[$i]['path'] = $this->temp[$k];
					$this->tracks[$i]['type'] = substr($this->temp[$k],0,7)=='http://' ? 'radio' : 'file';
					$k++;
				}
			}
			return TRUE;
		}
		if($this->type=='pls2')
		{
			// there are extended informations which will be parsed now
			$entries = substr($this->temp[count($this->temp) -3],16);
			// doublecheck $entries
			if($entries != (int)((count($this->temp) -3) /3))
			{
				// Log it, but continue
				$this->errormsg .= "The Playlist of type pls, version 2, has inconsistencies!\n";
			}
			foreach($this->temp as $entry)
			{
				$a = explode('=',$entry);
				if(strstr($a[0],'File')!==FALSE)
				{
					$n = str_replace('File','',strstr($a[0],'File'));
					$this->tracks[$n]['path'] = $a[1];
					$this->tracks[$n]['type'] = substr($a[1],0,7)=='http://' ? 'radio' : 'file';
				}
				elseif(strstr($a[0],'Title')!==FALSE)
				{
					$n = str_replace('Title','',strstr($a[0],'Title'));
					$this->tracks[$n]['title'] = $a[1];
				}
				elseif(strstr($a[0],'Length')!==FALSE)
				{
					$n = str_replace('Length','',strstr($a[0],'Length'));
					$this->tracks[$n]['time'] = $a[1];
				}
			}
			return TRUE;
		}
	}


	/** parse internal tracks-array and build Playlist of desired Type
	  * @private
	  */
	function _buildPlaylist($type,$onlyType='')
	{
		switch($type)
		{
			case 'pls2':
				$s = "[playlist]{$this->line_ending}";
				foreach($this->tracks as $i=>$track)
				{
					if($onlyType=='' || $onlyType==$track['type'])
					{
						$s .= "File".($i+1)."={$track['path']}{$this->line_ending}";
						$s .= "Title".($i+1)."={$track['title']}{$this->line_ending}";
						$s .= "Length".($i+1)."={$track['time']}{$this->line_ending}";
					}
				}
				$s .= "NumberOfEntries=".($i+1).$this->line_ending;
				$s .= "Version=2{$this->line_ending}";
				break;

			case 'extm3u':
				$s = "#EXTM3U{$this->line_ending}";
				foreach($this->tracks as $track)
				{
					if($onlyType=='' || $onlyType==$track['type'])
					{
						$s .= "#EXTINF:{$track['time']},{$track['title']}{$this->line_ending}";
						$s .= "{$track['path']}{$this->line_ending}";
					}
				}
				break;

			case 'm3u':
				$s = '';
				foreach($this->tracks as $track)
				{
					if($onlyType=='' || $onlyType==$track['type'])
					{
						$s .= "{$track['path']}{$this->line_ending}";
					}
				}
				break;
		}
		return $s;
	}


	/** get type of playlistfile
	  * @private
	  */
	function _getType()
	{
		if($this->temp[0] == '#EXTM3U')
		{
			$this->type = 'extm3u';
		}
		elseif($this->temp[0] == '[playlist]' && $this->temp[count($this->temp) -2]=='Version=2')
		{
			$this->type = 'pls2';
		}
		else
		{
			// Hhhm, maybe here we should do more checking, ...
			$this->type = 'm3u';
		}
	}




/** lowlevel private methods
  */

	/** writes string to file
	  * @private
	  */
	function _write2file(&$string,$filename)
	{
		$fp = @fopen($filename, 'wb');
		if($fp===FALSE)
		{
			return FALSE;
		}
		$size = strlen($string);
		fwrite($fp,$string,$size);
		fclose($fp);
		return TRUE;
	}


	/** Sorts the values of a given multidimensional Array in hirarchical order of the sortlist
	  *
	  * @shortdesc USAGE: $SORTED_Array = hn_array_sort($orig_array, array('field3','field1','field2'));
	  * @private
	  */
	function _hn_array_sort($a,$sl)
	{
		$GLOBALS['__PPL_SORTVALUE_LIST'] = $sl;
		usort($a, array(&$this, '_hn_sortValue_func'));
		return $a;
	}

	/** Callback-func for hn_array_sort()
	  * @private
	  */
	function _hn_sortValue_func($a,$b)
	{
		foreach($GLOBALS['__PPL_SORTVALUE_LIST'] as $f)
		{
			$strc = strcmp($a[$f],$b[$f]);
			if($strc != 0) return $strc;
		}
		return 0;
	}



	/** A Network-Share like //MACHINE/Resource does not return TRUE when checking with 'is_dir' (on Windows)
	  * (checking UNC-pathes is useful with PHP-Cli-scripts)
	  * @shortdesc checks if a given string is a directory on local machine or in local network
	  * @private
	  */
	function hn_is_dir($dir)
	{
		$dir = $this->noTrailingSlash($dir);
		// checken ob der uebergebene string ein Dir ist auf dem lokalen Rechner, ...
		if(is_dir($dir))
		{
			return TRUE;
		}
		// ... oder im lokalen Netzwerk
		$hdl = @opendir($dir);
		if($hdl!== FALSE)
		{
			closedir($hdl);
			return TRUE;
		}
		return FALSE;
	}

	/** remove optional trailing slash from string
	  * @private
	  */
	function noTrailingSlash($dir)
	{
		$dir = $this->noBacks($dir);
		return substr($dir,strlen($dir)-1,1)=='/' ? substr($dir,0,strlen($dir)-1) : $dir;
	}

	/** Some directory- and file-funcs in some (not all) PHP-Versions on Windows have backslashes in their returns,
	  * also if you pass only strings with forwardslashes!
	  * This is very ugly When concatenate strings like:
	  * $oldfile = 'C:/TEMP/sub1/file.txt';
	  * $new_filename = dirname($oldfile) . '/sub2/newfile.txt';
	  * $newfile now contains C:\TEMP\sub1/sub2/newfile.txt
	  *
	  * @shortdesc corrects BackSlashes to ForwardSlashes
	  * @private
	  */
	function noBacks($PathStr)
	{
		return str_replace("\\","/",$PathStr);
	}

	/** checks if running on WinSystem
	  * @private
	  */
	function isWin()
	{
		return preg_match("/^Windows/",php_uname()) ? TRUE : FALSE;
	}


} // END class hn_ParsePlaylist


?>