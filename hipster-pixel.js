// By teadrinker, 2025
// License: GNU GPL v3


ST_vertexGen_Square = {
	shapeScale : 1,
	softCorners : 0,
}

ST_layer = {	
	offset : [0,0],
	scale : [1,1],
	rotation : 0,
	strokeAndFill : ['#FFFFFF', 0,    1,    '#FFFFFF', 0.5],
	gridEnable :   1,
	gridStroke1 :   ['#FFFFFF', 0.08, 1],
//	gridStroke2 :   ['#FFFFFF', 0.1,  1],
//	gridEvery : [1, 4],
	pixelData : [],
	pixelCount : 1000,
	aspectRatio : 1,  // 2.5 means  1 : 2.5  ( X : Y )
	generatorName : 'triangular',
	generatorOptions : deepcopy(ST_vertexGen_Square),
	internalId : 0,
}

var IN_vertexGen = {
	name : 'nullImpl',
	init              : function(self, pixelCount, aspectRatio, options) { },
	generateGridVerts : function(self)                { return ARRAY_OF_UNKNOWN() },
	generateVerts     : function(self, y, pixelData)  { return ARRAY_OF_UNKNOWN() },
	getRowCount       : function(self)                { return UNKNOWN_NUMBER() },
	getChunkSize      : function(self)                { return UNKNOWN_NUMBER() },
	getRowLength      : function(self)                { return self.getRowCount(self) },
	getRow            : function(self, adr)           { return Math.floor(adr / (self.w * self.getChunkSize(self))) }, 
	getPixelAdress    : function(self, x, y)          { return UNKNOWN_NUMBER() },
}

IN_layer = {
	gridVertices1 : [],
	gridVertices2 : [],
	vertices : [],
	vertexGen : deepcopy(IN_vertexGen),
	//vertexGenPixelCount : -1,  // track changes
	//vertexGenAspectRatio : -1, // track changes
	valid : false,
}

ST_MadMatrixApp = {
	name : '',
	layers : [  deepcopy(ST_layer)  ],
}









function getQueryString() {
	var result = {}, queryString = location.search.substring(1);
	var re = /([^&=]+)=([^&]*)/g, m;
	
	while (m = re.exec(queryString)) {
		result[decodeURIComponent(m[1])] = decodeURIComponent(m[2]);
	}
	
	return result;
}

function getHashParams() {
	var result = {}, hash = window.location.hash.substring(1);
	var re = /([^&=]+)=([^&]*)/g, m;
	
	while (m = re.exec(hash)) {
		result[decodeURIComponent(m[1])] = decodeURIComponent(m[2]);
	}
	
	return result;
}
/*
function updateHashParams(params) {
	var currentHash = getHashParams();
	var newHash = Object.assign({}, currentHash, params);
	var hashString = Object.entries(newHash)
		.filter(([_, v]) => v !== undefined && v !== null)
		.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
		.join('&');
	window.location.hash = hashString;
}
*/
var query = getQueryString();
var hashParams = getHashParams();
var canvasQuality = parseFloat(query["scale"]) || parseFloat(hashParams.q) || 1;

// State management
var isUpdatingHash = false;
var lastSetHash = '';
var pendingPixelUpdate = false;

var useRLE = true;

function compressPixels(pixels) {
    if (useRLE) {
        if (pixels.length === 0) return 'R';
        
        const result = [];
        let currentValue = 0;  // starts at 0 as per spec
        let i = 0;
        
        while (i < pixels.length) {
            if (pixels[i] === currentValue) {
                // Count run of current value
                let runLength = 1;
                while (i + runLength < pixels.length && 
                       pixels[i + runLength] === currentValue && 
                       runLength < 255) {
                    runLength++;
                }
                result.push(runLength);
                i += runLength;
				currentValue = 1 - currentValue;
            } else {
                // Set new value (0 token followed by new value)
                result.push(0, pixels[i] ? 1 : 0);
                currentValue = pixels[i];
                i++;
            }
        }
        
        // Convert to base64 with 'R' prefix
        const binaryString = String.fromCharCode(...result);
        return 'R' + btoa(binaryString);
    } else {
        // Original binary compression (kept for compatibility)
        let binary = '';
        let byte = 0;
        let bitPos = 0;
        
        for (let i = 0; i < pixels.length; i++) {
            if (pixels[i]) {
                byte |= (1 << bitPos);
            }
            bitPos++;
            if (bitPos === 8) {
                binary += String.fromCharCode(byte);
                byte = 0;
                bitPos = 0;
            }
        }
        if (bitPos > 0) {
            binary += String.fromCharCode(byte);
        }
        return 'B' + btoa(binary);
    }
}

function uncompressPixels(compressed, length) {
    if (!compressed || length === 0) return null;
    
    try {
        if (useRLE && compressed[0] === 'R') {
            if (compressed.length === 1) return new Array(length).fill(0); // Empty RLE data
            
            const binaryString = atob(compressed.substring(1));
            if (binaryString.length === 0) return new Array(length).fill(0);
            
            const pixels = new Array(length).fill(0);
            let pos = 0;
            let currentValue = 0;
            let i = 0;
            
            while (i < binaryString.length && pos < length) {
                const token = binaryString.charCodeAt(i++);
                
                if (token === 0) {
                    // Set current value (next byte is the actual value)
                    if (i >= binaryString.length) break;
                    currentValue = binaryString.charCodeAt(i++) ? 1 : 0;
                    if (pos < length) {
                        pixels[pos++] = currentValue;
                    }
                } else {
                    // Repeat current value N times
                    const count = Math.min(token, length - pos);
                    for (let j = 0; j < count && pos < length; j++) {
                        pixels[pos++] = currentValue;
                    }
					currentValue = 1 - currentValue;
                }
            }
            
            return pixels;
        } else {
            // Original binary decompression (kept for compatibility)
            const prefix = compressed[0] === 'B' ? 1 : 0;
            const binary = atob(compressed.substring(prefix));
            const pixels = new Array(length).fill(0);
            for (let i = 0; i < binary.length; i++) {
                const byte = binary.charCodeAt(i);
                for (let j = 0; j < 8 && (i * 8 + j) < length; j++) {
                    if (byte & (1 << j)) {
                        pixels[i * 8 + j] = 1;
                    }
                }
            }
            return pixels;
        }
    } catch (e) {
        console.error('Error uncompressing pixels:', e);
        return null;
    }
}

// Update application state from URL hash
function setStateFromHash() {

	var hashParams = {}

    var currentHash = window.location.hash.substring(1);
    if (isUpdatingHash || currentHash === lastSetHash) {
		console.log('setStateFromHash: already updating or hash unchanged');
        return; // Skip if we're the ones who set this hash or if hash hasn't changed
    }

	lastSetHash = ''
    
	if(currentHash == 'new=1')
	{
		showMenu = 1
		console.log('setStateFromHash: hash is new=1 : showMenu = 1');
		wantRepaint();
		if(window.htmlUIUpdate) htmlUIUpdate(hashParams)
		return;
	}

	showMenu = 0

    isUpdatingHash = true;
    try {
        hashParams = getHashParams();
        var needsRepaint = false;
        
        // Update background state if specified
        if (hashParams.bg !== undefined) {
            const newBgState = hashParams.bg === '1';
            if (showBg !== newBgState) {
                showBg = newBgState;
                needsRepaint = true;
            }
        }
        
        // Update grid state
        if (typeof geoPixelApp !== 'undefined' && geoPixelApp.state?.layers?.[0]) {
            const layer = geoPixelApp.state.layers[0];
            const intLayer = geoPixelApp.layers?.[layer.internalId];
            const gen = intLayer?.vertexGen;
            
            // Update grid enable state
            var newGridState = hashParams.grid !== undefined ? parseInt(hashParams.grid) : 1;
            if (layer.gridEnable !== newGridState) {
                layer.gridEnable = newGridState;
                needsRepaint = true;
            }
            
			var invalidate = false;
            // Update vertex generator dimensions if present
            if (gen && hashParams.w && hashParams.h) {
                const newWidth = parseInt(hashParams.w);
                const newHeight = parseInt(hashParams.h);
                gen.w = newWidth;
                gen.h = newHeight;
                invalidate = true;
            }
            
            // Update vertex generator type if present
            if (hashParams.t && layer.generatorName !== hashParams.t && 
                geoPixelApp.vertexGen[hashParams.t]) {
                layer.generatorName = hashParams.t;
				
                invalidate = true;
            }
            
            if (hashParams.p) {
                const pixelCount = gen.w * gen.h * gen.getChunkSize(gen);
                const pixels = uncompressPixels(hashParams.p, pixelCount);
                if (pixels && pixels.length === pixelCount) {
                    layer.pixelData= pixels
                    invalidate = true;
                }
				else
				{
					console.error('Failed to uncompress pixels: ' + hashParams.p);
				}
            }
			
			if (invalidate)
			{
				// console.log('setStateFromHash: invalidate layer ' + layer.internalId);
				geoPixelApp.invalidateLayer(layer.internalId);
				needsRepaint = true;
			}
        }
        
        // Update render quality if needed
        var newQuality = parseFloat(hashParams.q);
        if (!isNaN(newQuality) && newQuality !== canvasQuality) {
            canvasQuality = newQuality;
            if (typeof fullscreenCanvas !== 'undefined') {
                fullscreenCanvas.setCanvasQuality(canvasQuality);
                needsRepaint = true;
            }
        }
        
        if (needsRepaint) {
            // console.log('setStateFromHash: needsRepaint ' + drawRequestedStatus);
            wantRepaint();
        }
    } finally {
        isUpdatingHash = false;
    }

	if(window.htmlUIUpdate) htmlUIUpdate(hashParams)
}

// Update URL hash from application state
function setHashFromState(includePixels = false) {
	//console.log('setHashFromState called with includePixels:', includePixels);
    if (isUpdatingHash) return; // Prevent reentrancy
    
	if(showMenu)
	{
		if(window.location.hash != '#new=1')
			window.location.hash = 'new=1';

		if(window.htmlUIUpdate) htmlUIUpdate({'new':1})
		return;
	}

	var state = {}
    isUpdatingHash = true;
    try {
        
        // Add grid state and quality state
        if (geoPixelApp?.state?.layers?.[0]) {
            const layer = geoPixelApp.state.layers[0];
            state.grid = layer.gridEnable ? '1' : '0';
            
            // Add background state
            state.bg = showBg ? '1' : '0';
            
            // Add vertex generator type and dimensions if available
            state.t = layer.generatorName;
            const intLayer = geoPixelApp.layers?.[layer.internalId];
            const gen = intLayer?.vertexGen;
            if (gen) 
			{
				if(gen.w && gen.h )
				{
                    state.w = gen.w.toString();
                    state.h = gen.h.toString();

                    if (includePixels && layer.pixelData) {
                        state.p = compressPixels(layer.pixelData);
                    }
				}
				else
				{
                    console.warn('setHashFromState: gen.w or gen.h is undefined');
				}
			}
		}	
		else
		{
			console.warn('setHashFromState: geoPixelApp.state.layers[0] is undefined');
		}
        
        // Add quality state
        state.q = canvasQuality.toString();
        
        // Generate the new hash string
        var hashString = Object.entries(state)
            .filter(([_, v]) => v !== undefined && v !== null)
            .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
            .join('&');
        
        // Only update if the hash has actually changed
        if (hashString !== lastSetHash) {
            lastSetHash = hashString;
            window.location.hash = hashString;
        }
    } finally {
		// console.log('setHashFromState finally');

        isUpdatingHash = false;
    }
	if(window.htmlUIUpdate) htmlUIUpdate(state)
}

// Listen for hash changes
window.addEventListener('hashchange', setStateFromHash);


function clamp(v,mi,ma)	{ if(mi==undefined) mi=0; if(ma==undefined) ma=1; return (v<mi)?(mi):(  (v>ma)?ma:v  )}
function ca(n,d) { if(!n) return new Array; var i,a=new Array(n); if(d!=undefined) for(i=0;i<n;i++) a[i]=d; return a}

function forIV(a, f) {
	for(var i = 0; i < a.length; i++) {
		f(i, a[i])
	}
}

function forKV(o, f) {
	for(var k in o) {
		f(k, o[k])
	}
}

function deepcopy(v) {
	if( typeof(v) == "object" ) {
        var clone
		if( v.splice ) {
			clone = new Array(v.length)
	        for(var i = 0; i < v.length; i++) {
				clone[i] = deepcopy(v[i])
			}
		} else {
			clone = {}
	        for(var i in v) {
				clone[i] = deepcopy(v[i])
			}
        }
        return clone;
    } else {
		return v
	}
}

function isPointInTriangle(x,y, x1,y1, x2,y2, x3,y3) {
  function Sign(x1,y1, x2,y2, x3,y3) {
   return (x1 - x3) * (y2 - y3) - (x2 - x3) * (y1 - y3);
  }
  var b1, b2, b3
  b1 = Sign(x,y, x1,y1, x2,y2) < 0
  b2 = Sign(x,y, x2,y2, x3,y3) < 0
  b3 = Sign(x,y, x3,y3, x1,y1) < 0

  return (b1 == b2) && (b2 == b3)
}

function addCoord(a, x, y) {
	var i = a.length
	a.length += 2;
	a[i    ] = x1 ; a[i + 1] = y1
}
function addLine(a, x1, y1, x2, y2) {
	var i = a.length
	a.length += 6;
	a[i    ] = x1 ; a[i + 1] = y1
	a[i + 2] = x2 ; a[i + 3] = y2
	a[i + 4] = undefined
	a[i + 5] = undefined
}
function addTriangle(a, x1, y1,  x2, y2,  x3, y3) {
	var i = a.length
	a.length += 7;
	a[i    ] = x1 ; a[i + 1] = y1
	a[i + 2] = x2 ; a[i + 3] = y2
	a[i + 4] = x3 ; a[i + 5] = y3
	a[i + 6] = undefined
}
function addQuad(a, x1, y1,  x2, y2,  x3, y3,  x4, y4) {
	var i = a.length
	a.length += 9;
	a[i    ] = x1 ; a[i + 1] = y1
	a[i + 2] = x2 ; a[i + 3] = y2
	a[i + 4] = x3 ; a[i + 5] = y3
	a[i + 6] = x4 ; a[i + 7] = y4
	a[i + 8] = undefined
}
function addHexagon(a, x1, y1,  x2, y2,  x3, y3,  x4, y4,  x5, y5,  x6, y6) {
	var i = a.length
	a.length += 13;
	a[i    ] = x1 ; a[i + 1] = y1
	a[i + 2] = x2 ; a[i + 3] = y2
	a[i + 4] = x3 ; a[i + 5] = y3
	a[i + 6] = x4 ; a[i + 7] = y4
	a[i + 8] = x5 ; a[i + 9] = y5
	a[i +10] = x6 ; a[i +11] = y6
	a[i +12] = undefined
}
function addRect(a, x, y,  w, h) {
//x+=1; y+=1; w-=2; h-=2;
	var i = a.length
	a.length += 9;
	a[i    ] = x ; a[i + 1] = y
	a[i + 2] = x + w ; a[i + 3] = y
	a[i + 4] = x + w ; a[i + 5] = y + h
	a[i + 6] = x ; a[i + 7] = y + h
	a[i + 8] = undefined
}

var drawWidth = 300
var drawHeight = 300

function int(x)		{ return x>0?Math.floor(x):Math.ceil(x)}

geoPixelApp = {
	vertexGen : {
		square : {
			init : function(self, pixelCount, aspectRatio, options) {
				var sqItems = Math.sqrt(pixelCount)
				aspectRatio = Math.sqrt(aspectRatio)
				self.h = Math.floor(sqItems * aspectRatio)
				self.w = Math.floor(sqItems / aspectRatio)
				self.sx = 1
				self.sy = 1
			},		
			generateGridVerts : function(self) {
				var v = []
				var sx = self.sx
				var sy = self.sy
				var w = self.w
				var h = self.h
				for(var y = 0; y < h; y++) {
						addLine(v, 0, y*sy, w*sx, y*sy)
					}
				for(var x = 0; x < w; x++) {
						addLine(v, x*sy, 0, x*sx, h*sy)
					}
				return v
			},
			generateVerts : function(self, y, pixelData) {
				var v = []
				var sx = self.sx
				var sy = self.sy
				var w = self.w
//				var h = self.h
//				for(var y = 0; y < h; y++) {
					for(var x = 0; x < w; x++) {
						if(pixelData[x + y * w]) {
							addRect(v, x*sx, y*sy, sx, sy)
						}
					}
//				}
				return v
			},
			getChunkSize : function(self) { return 1 },
			getRowCount : function(self) { return self.h },
			getRowLength : function(self) { return (self.w - 1) * self.sx },
			getRow : function(self, adr) { return Math.floor(adr / self.w) },
			getPixelAdress : function(self, x, y) {
				var sx = self.sx
				var sy = self.sy
				var w = self.w
				return Math.floor(x/sx) + Math.floor(y/sy) * w
			},
		},


		
		square4 : {
			init : function(self, pixelCount, aspectRatio, options) {
				var sqItems = Math.sqrt(pixelCount / 4)
				aspectRatio = Math.sqrt(aspectRatio)
				self.h = Math.floor(sqItems * aspectRatio)
				self.w = Math.floor(sqItems / aspectRatio)
				self.sx = 1
				self.sy = 1
			},		
			generateGridVerts : function(self) {
				var v = []
				var sx = self.sx
				var sy = self.sy
				var w = self.w
				var h = self.h
				for(var y = 0; y < h; y++) {
						addLine(v, 0, y*sy, w*sx, y*sy)
					}
				for(var x = 0; x < w; x++) {
						addLine(v, x*sy, 0, x*sx, h*sy)
					}
				for(var x = 0; x < w * 2 ; x++) {		
						addLine(v, 0, x*sy, x*sx, 0)	//   /				
						addLine(v, 0, (h - x)*sy, x*sx, h*sy)     //   \
					}
				return v
			},
			generateVerts : function(self, y, pixelData) {
				var v = []
				var sx = self.sx
				var sy = self.sy
				var w = self.w
				var spanStart = -1
//				var h = self.h 
//				for(var y = 0; y < h; y++) {
					for(var x = 0; x < w; x++) {
						var p1 = pixelData[(x + y * w) * 4]
						var p2 = pixelData[(x + y * w) * 4 + 1]
						var p3 = pixelData[(x + y * w) * 4 + 2]
						var p4 = pixelData[(x + y * w) * 4 + 3]
						if(p1 && p2 && p3 && p4) {
							if(spanStart == -1) {
								spanStart = x
							}						
							//addRect(v, x*sx, y*sy, sx, sy)
						} else {
							if(spanStart != -1) {
								addRect(v, spanStart*sx, y*sy, (x - spanStart)*sx, sy)		
								spanStart = -1
							}						
							if(p1) {
								addTriangle(v,	x*sx		, y*sy, 
												(x+0.5)*sx	, (y+0.5)*sy,
												x*sx		, (y+1)*sy)
							}
							if(p2) {
								addTriangle(v,	x*sx		, (y+1)*sy, 
												(x+0.5)*sx	, (y+0.5)*sy,
												(x+1)*sx	, (y+1)*sy)
							}
							if(p3) {
								addTriangle(v,	x*sx		, y*sy, 
												(x+1)*sx	, y*sy,
												(x+0.5)*sx	, (y+0.5)*sy)
							}
							if(p4) {
								addTriangle(v,	(x+1)*sx	, y*sy, 
												(x+1)*sx	, (y+1)*sy,
												(x+0.5)*sx	, (y+0.5)*sy)
							}
						}
					}
					if(spanStart != -1) {
						addRect(v, spanStart*sx, y*sy, (x - spanStart)*sx, sy)
					}						
//				}

				return v
			},
			getChunkSize : function(self) { return 4 },
			getRowCount : function(self) { return self.h },
			getRowLength : function(self) { return (self.w - 1) * self.sx },
			getRow : function(self, adr) { return Math.floor(adr / (self.w*4)) },
			getPixelAdress : function(self, x, y) {
				var sx = self.sx
				var sy = self.sy
				var w = self.w
				x /= sx
				y /= sy
				var ix = Math.floor(x)
				var iy = Math.floor(y)
				x -= ix
				y -= iy
				return (ix + iy * w) * 4 + ((x-y>0) && 2 || 0) + ((x+y>1) && 1 || 0)
			},
		},
		
		square8 : {
			init : function(self, pixelCount, aspectRatio, options) {
				var sqItems = Math.sqrt(pixelCount / 8)
				aspectRatio = Math.sqrt(aspectRatio)
				self.h = Math.floor(sqItems * aspectRatio)
				self.w = Math.floor(sqItems / aspectRatio)
				self.sx = 1
				self.sy = 1
			},		
			generateGridVerts : function(self) {
				var v = []
				var sx = self.sx
				var sy = self.sy
				var w = self.w
				var h = self.h
				for(var y = 0; y < h; y+=0.5) {
						addLine(v, 0, y*sy, w*sx, y*sy)
					}
				for(var x = 0; x < w; x+=0.5) {
						addLine(v, x*sy, 0, x*sx, h*sy)
					}
				for(var x = 0; x < w * 2 ; x++) {		
						addLine(v, 0, x*sy, x*sx, 0)	//   /				
						addLine(v, 0, (h - x)*sy, x*sx, h*sy)     //   \
					}
				return v
			},
			generateVerts : function(self, y, pixelData) {
				var v = []
				var sx = self.sx
				var sy = self.sy
				var w = self.w
				var spanStart = -1
//				var h = self.h 
//				for(var y = 0; y < h; y++) {
					for(var x = 0; x < w; x++) {
						var p0 = pixelData[(x + y * w) * 8]
						var p1 = pixelData[(x + y * w) * 8 + 1]
						var p2 = pixelData[(x + y * w) * 8 + 2]
						var p3 = pixelData[(x + y * w) * 8 + 3]
						var p4 = pixelData[(x + y * w) * 8 + 4]
						var p5 = pixelData[(x + y * w) * 8 + 5]
						var p6 = pixelData[(x + y * w) * 8 + 6]
						var p7 = pixelData[(x + y * w) * 8 + 7]
						if(p0 && p1 && p2 && p3 && p4 && p5 && p6 && p7) {
							if(spanStart == -1) {
								spanStart = x
							}
						//	addRect(v, x*sx, y*sy, sx, sy)
						} else {
							if(spanStart != -1) {
								addRect(v, spanStart*sx, y*sy, (x - spanStart)*sx, sy)		
								spanStart = -1
							}

							if(p0 && p1) {
								addTriangle(v,	x*sx		, y*sy, 
												(x+0.5)*sx	, (y+0.5)*sy,
												x*sx		, (y+1)*sy)
							} else if(p1) {
								addTriangle(v,	x*sx		, y*sy, 
												(x+0.5)*sx	, (y+0.5)*sy,
												x*sx		, (y+0.5)*sy)								
							} else if(p0) {
								addTriangle(v,	x*sx		, (y+0.5)*sy, 
												(x+0.5)*sx	, (y+0.5)*sy,
												x*sx		, (y+1)*sy)								
							}
							
							if(p2 && p3) {
								addTriangle(v,	x*sx		, (y+1)*sy, 
												(x+0.5)*sx	, (y+0.5)*sy,
												(x+1)*sx	, (y+1)*sy)
							} else if(p3) {
								addTriangle(v,	(x+0.5)*sx	, (y+1)*sy, 
												(x+0.5)*sx	, (y+0.5)*sy,
												(x+1)*sx	, (y+1)*sy)							
							} else if(p2) {
								addTriangle(v,	x*sx		, (y+1)*sy, 
												(x+0.5)*sx	, (y+0.5)*sy,
												(x+0.5)*sx	, (y+1)*sy)					
							}
							
							if(p4 && p5) {
								addTriangle(v,	x*sx		, y*sy, 
												(x+1)*sx	, y*sy,
												(x+0.5)*sx	, (y+0.5)*sy)
							} else if(p5) {
								addTriangle(v,	x*sx		, y*sy, 
												(x+0.5)*sx	, y*sy,
												(x+0.5)*sx	, (y+0.5)*sy)
							} else if(p4) {
								addTriangle(v,	(x+0.5)*sx	, y*sy, 
												(x+1)*sx	, y*sy,
												(x+0.5)*sx	, (y+0.5)*sy)
							}
							
							if(p6 && p7) {
								addTriangle(v,	(x+1)*sx	, y*sy, 
												(x+1)*sx	, (y+1)*sy,
												(x+0.5)*sx	, (y+0.5)*sy)
							} else if(p7) {
								addTriangle(v,	(x+1)*sx	, (y+0.5)*sy, 
												(x+1)*sx	, (y+1)*sy,
												(x+0.5)*sx	, (y+0.5)*sy)
							} else if(p6) {
								addTriangle(v,	(x+1)*sx	, y*sy, 
												(x+1)*sx	, (y+0.5)*sy,
												(x+0.5)*sx	, (y+0.5)*sy)
							}
						}
					}
					
					if(spanStart != -1) {
						addRect(v, spanStart*sx, y*sy, (x - spanStart)*sx, sy)		
					}

//				}

				return v
			},
			getChunkSize : function(self) { return 8 },
			getRowCount : function(self) { return self.h },
			getRowLength : function(self) { return (self.w - 1) * self.sx },
			getRow : function(self, adr) { return Math.floor(adr / (self.w*8)) },
			getPixelAdress : function(self, x, y) {
				var sx = self.sx
				var sy = self.sy
				var w = self.w
				x /= sx
				y /= sy
				var ix = Math.floor(x)
				var iy = Math.floor(y)
				x -= ix
				y -= iy
				return (ix + iy * w) * 8 + ((x-y>0) && 4 || 0) + ((x+y>1) && 2 || 0) + ((x<0.5 && y<0.5 || x>0.5 && y>0.5) && 1 || 0)
			},
		},
		
		
		tri24 : {
			init : function(self, pixelCount, aspectRatio, options) {
				var sqrt3 = 1.732050807 //sqrt(3)
				var sqItems = Math.sqrt(pixelCount / 24)
				aspectRatio = Math.sqrt(aspectRatio / sqrt3)
				self.h = Math.floor(sqItems * aspectRatio)
				self.w = Math.floor(sqItems / aspectRatio)
				self.sx = 1 / sqrt3	
				self.sy = 1
			},
			generateGridVerts : function(self) {
				var v = []
				var sx = self.sx
				var sy = self.sy
				var w = self.w
				var h = self.h
				for(var y = 0; y < h; y++) {
					addLine(v, 0, y*sy, w*sx, y*sy)	
					addLine(v, 0, (y + 0.5)*sy, w*sx, (y + 0.5)*sy)
				}
				for(var x = 0; x < w; x+=0.5) {
					addLine(v, x*sx, 0, x*sx, h*sy)
				}		
				for(var x = 0; x < w * 1.7 ; x++) {		
					addLine(v, 0, x*sy, x*sx, 0)	          //    /				
					addLine(v, 0, (h - x)*sy, x*sx, h*sy)     //    \
					
					addLine(v, 0, x*sy, x*sx*3, 0)	          //    				
					addLine(v, 0, (h - x)*sy, x*sx*3, h*sy)     //    
					
					addLine(v, 0, (x     - 2/3)*sy, x*sx*3, (-2/3)*sy)	          //    				
					addLine(v, 0, (h - x - 2/3)*sy, x*sx*3, (-2/3 +h)*sy)     //    
					
					addLine(v, 0, (x     - 1/3)*sy, x*sx*3, (-1/3)*sy)	          //    				
					addLine(v, 0, (h - x - 1/3)*sy, x*sx*3, (-1/3 +h)*sy)     //    			
				}
				return v
			},
			generateVerts : function(self, y, pixelData) {
				var v = []
				var sx = self.sx
				var sy = self.sy
				var w = self.w
				var count, id, spanStart = -1
//				var h = self.h
//				for(var y = 0; y < h; y++) {
					for(var x = 0; x < w; x++) {
						count = 0
						id = (x + y * w) * 24
						for(var i = 0; i < 24; i++) {
							if(pixelData[id + i]) {
								count++
							}
						}
						if(count == 24) {
							if(spanStart == -1) {
								spanStart = x
							}
						} else {
							if(spanStart != -1) {
								addRect(v, spanStart*sx, y*sy, (x - spanStart)*sx, sy)		
								spanStart = -1
							}
							if(count > 0) {
								
								for(var yflip = 0; yflip < 24 ; yflip+=12)
								for(var xflip = 0; xflip < 12 ; xflip+=6)
								for(var rot180 = 0; rot180 < 6 ; rot180+=3) {
									var adr = id + xflip + yflip + rot180
									var p0 = pixelData[adr]
									var p1 = pixelData[adr+1]
									var p2 = pixelData[adr+2]
									if(p0 || p1 || p2) {
										var txs = xflip ? -1 : 1
										var txa = xflip ? 1 : 0
										var tys = yflip ? -1 : 1
										var tya = yflip ? 1 : 0
										if(rot180) {
											txs = - txs; txa = 0.5;
											tys = - tys; tya = 0.5;
										}
										if(p0 && p1 && p2) {
												addTriangle(v,  (x            + txa)*sx, (y + tya              )      *sy,
																(x + 0.5 *txs + txa)*sx, (y + tya + tys*(    0.5))    *sy,
																(x + 0.5 *txs + txa)*sx, (y + tya              )      *sy)							
										} else {
											if(p0) {
												addTriangle(v,  (x            + txa)*sx, (y + tya              )      *sy,
																(x + 0.5 *txs + txa)*sx, (y + tya + tys*(0.1666666666))*sy,
																(x + 0.5 *txs + txa)*sx, (y + tya              )      *sy)							
											}                                                       
											if(p1) {                                                
												addTriangle(v,  (x            + txa)*sx, (y + tya              )      *sy,
																(x + 0.25*txs + txa)*sx, (y + tya + tys*(    0.25))   *sy,
																(x + 0.5 *txs + txa)*sx, (y + tya + tys*(0.1666666666))*sy)							
											}                                                       
											if(p2) {                                                
												addTriangle(v,  (x + 0.25*txs + txa)*sx, (y + tya + tys*(    0.25))   *sy,
																(x + 0.5 *txs + txa)*sx, (y + tya + tys*(    0.5))    *sy,
																(x + 0.5 *txs + txa)*sx, (y + tya + tys*(0.1666666666))*sy)							
											}
										}
									}
								}
	/*						
								
								if(pixelData[id + 0+12]) {
									addTriangle(v,   x       *sx, (y + 1)  *sy,
													(x + 0.5)*sx, (y + 1-1/6)*sy,
													(x + 0.5)*sx, (y + 1)*sy)							
								}
								if(pixelData[id + 1+12]) {
									addTriangle(v,   x        *sx, (y + 1)    *sy,
													(x + 0.25)*sx, (y + 0.75) *sy,
													(x + 0.5) *sx, (y + 1-1/6)*sy)							
								}
								if(pixelData[id + 2+12]) {
									addTriangle(v,  (x + 0.25)*sx, (y + 0.75) *sy,
													(x + 0.5) *sx, (y + 0.5)  *sy,
													(x + 0.5) *sx, (y + 1-1/6)*sy)							
								}
								
								
								if(pixelData[id + 3+12]) {
									addTriangle(v,  (x + 0.5 )     *sx, (y + 1.5 - 1)  *sy,
													(x + 0.5 - 0.5)*sx, (y + 1.5 - (1-1/6))*sy,
													(x + 0.5 - 0.5)*sx, (y + 1.5 - 1)*sy)							
								}
								if(pixelData[id + 4+12]) {
									addTriangle(v,  (x + 0.5 )      *sx, (y + 1.5 - 1)    *sy,
													(x + 0.5 - 0.25)*sx, (y + 1.5 - 0.75) *sy,
													(x + 0.5 - 0.5) *sx, (y + 1.5 - (1-1/6))*sy)							
								}
								if(pixelData[id + 5+12]) {
									addTriangle(v,  (x + 0.5 - 0.25)*sx, (y + 1.5 - 0.75) *sy,
													(x + 0.5 - 0.5) *sx, (y + 1.5 - 0.5)  *sy,
													(x + 0.5 - 0.5) *sx, (y + 1.5 - (1-1/6))*sy)							
								}
	*/						}	
						}
					}
//				}

				return v
			},
			getChunkSize : function(self) { return 24 },
			getRowCount : function(self) { return self.h },
			getRowLength : function(self) { return (self.w - 1) * self.sx },
			getRow : function(self, adr) { return Math.floor(adr / (self.w * 24) ) },
			getPixelAdress : function(self, x, y) {
				var sx = self.sx
				var sy = self.sy
				var w = self.w
				x /= sx
				y /= sy
				var ix = Math.floor(x)
				var iy = Math.floor(y)
				x -= ix
				y -= iy
				
				var id = 0
				if(x > 0.5) {
					x = 1 - x
					id = 6
				}
				if(y > 0.5) {
					y = 1 - y
					id += 12
				}
				if(x - y < 0) {
					x = 0.5 - x
					y = 0.5 - y
					id += 3
				}
				if(1 - x - 3*y < 0) {
					id += 2
				} else if(x - 3*y < 0) {
					id += 1
				}
				return (ix + iy * w) * 24 + id				
			},
		},		

		
		
		
		triangular : {
			init : function(self, pixelCount, aspectRatio, options) {
				var sqrt3 = 1.732050807 //sqrt(3)
				var sqItems = Math.sqrt(pixelCount / 4)
				aspectRatio = Math.sqrt(aspectRatio / sqrt3)
				self.h = Math.floor(sqItems * aspectRatio)
				self.w = Math.floor(sqItems / aspectRatio)
				self.sx = 1 / sqrt3
				self.sy = 1
			},
			generateGridVerts : function(self) {
				var v = []
				var sx = self.sx
				var sy = self.sy
				var w = self.w
				var h = self.h
				for(var y = 0; y < h; y++) {
						addLine(v, 0, y*sy, w*sx, y*sy)	
						addLine(v, 0, (y + 0.5)*sy, w*sx, (y + 0.5)*sy)
					}
				for(var x = 0; x < w * 1.7 ; x++) {		
						addLine(v, 0, x*sy, x*sx, 0)	//   /				
						addLine(v, 0, (h - x)*sy, x*sx, h*sy)     //   \
					}
				return v
			},
			generateVerts : function(self, y, pixelData) {
				var p0,p1,p2,p3,v = []
				var sx = self.sx
				var sy = self.sy
				var w = self.w
				var spanStart = -1
				
//				var h = self.h
//				for(var y = 0; y < h; y++) {
					for(var x = 0; x < w; x++) {
						p0 = pixelData[(x + y * w) * 4]
						p1 = pixelData[(x + y * w) * 4 + 1]
						p2 = pixelData[(x + y * w) * 4 + 2]
						p3 = pixelData[(x + y * w) * 4 + 3]
						if(p0 && p1 && p2 && p3) {
							if(spanStart == -1) {
								spanStart = x
							}							
						} else {
							if(spanStart != -1) {
								addHexagon(v,	(spanStart + 0)      *sx,  y       *sy,
															 x       *sx,  y       *sy,					
															(x - 0.5)*sx, (y + 0.5)*sy,
															 x       *sx, (y + 1)  *sy,
												(spanStart + 0)      *sx, (y + 1)  *sy,
												(spanStart + 0 - 0.5)*sx, (y + 0.5)*sy)
								spanStart = -1
							}									
							if(p0) {
								addTriangle(v,   x       *sx,  y       *sy,
												(x + 0.5)*sx, (y + 0.5)*sy,
												(x - 0.5)*sx, (y + 0.5)*sy)
							}
							if(p1) {
								addTriangle(v,   x       *sx,  y       *sy,
												(x + 1)  *sx,  y       *sy,
												(x + 0.5)*sx, (y + 0.5)*sy)
							}						
							if(p2) {
								addTriangle(v,  (x - 0.5)*sx, (y + 0.5)*sy,
												(x + 0.5)*sx, (y + 0.5)*sy,
												 x       *sx, (y + 1)  *sy)
							}						
							if(p3) {
								addTriangle(v,  (x + 0.5)*sx, (y + 0.5)*sy,
												(x + 1)  *sx, (y + 1)  *sy,
												 x       *sx, (y + 1)  *sy)
							}						
						
						}
					}
//				}
					if(spanStart != -1) {
						addHexagon(v,	(spanStart + 0)      *sx,  y       *sy,
														x       *sx,  y       *sy,					
													(x - 0.5)*sx, (y + 0.5)*sy,
														x       *sx, (y + 1)  *sy,
										(spanStart + 0)      *sx, (y + 1)  *sy,
										(spanStart + 0 - 0.5)*sx, (y + 0.5)*sy)
						spanStart = -1
					}	
				return v
			},
			getPixelAdressInternal : function(self, fx, fy) {
				var w = self.w
				var ix = Math.floor(fx)
				var iy = Math.floor(fy)
				var x = fx - ix;
				var y = fy - iy;
				var r
				if(isPointInTriangle(	x, y,
										0, 0,
										0.5, 0.5,
										-0.5, 0.5)) {
					r = 0		
				} else if(isPointInTriangle(	x, y,
												0, 0,
												1, 0,
												0.5, 0.5)) {
					r = 1							
				} else if(isPointInTriangle(	x, y,
												-0.5, 0.5,
												0.5, 0.5,
												0, 1)) {
					r = 2									
				} else if(isPointInTriangle(	x, y,
												0.5, 0.5,
												1, 1,
												0, 1)) {										
					r = 3
				} else {

//					return self.getPixelAdressInternal(self, fx + 1, fy)
					if(isPointInTriangle(	x - 1, y,
											0, 0,
											0.5, 0.5,
											-0.5, 0.5)) {
						r = 0 + 4
					} else if(isPointInTriangle(	x - 1, y,
													-0.5, 0.5,
													0.5, 0.5,
													0, 1)) {
						r = 2 + 4							
					} else {
						return 2 // should never happen
					}
				}
				return (ix + iy * w) * 4 + r
			},
			getChunkSize : function(self) { return 4 },
			getRowCount : function(self) { return self.h },
			getRowLength : function(self) { return (self.w - 1) * self.sx },
			getRow : function(self, adr) { return Math.floor(adr / (self.w * 4)) },
			getPixelAdress : function(self, x, y) {
				var sx = self.sx
				var sy = self.sy
				return self.getPixelAdressInternal(self, x / sx, y / sy)
			},
		},		
	},
	
	init : function(self, generatorName, rot) {
		self.layers = {}
		self.state = deepcopy(ST_MadMatrixApp)
		
		if(generatorName) {self.state.layers[0].generatorName = generatorName}
		if(rot) {self.state.layers[0].rotation = rot}
		
		var pixelCount = self.state.layers[0].pixelCount
		self.state.layers[0].pixelData = new Array(pixelCount)
		var data = self.state.layers[0].pixelData
		for(var i=0; i<pixelCount ;i++)
			data[i] = 0
		self.update(self)

		// Initial state sync
		//setStateFromHash();		
	},
	
	update : function(self) {
		var intLayer, intLayers = self.layers
		forIV(self.state.layers, function(i, layer) {
			intLayer = intLayers[layer.internalId]
			if( intLayer == undefined ) {
				intLayer = deepcopy(IN_layer)
				intLayers[layer.internalId] = intLayer
			}
			if( ! intLayer.valid ) {
				// console.log('update: intLayer.valid == false')
				var old_w = -1 // todo this is bad... generator were not supposed to have state...
				var old_h = -1
				if(intLayer.vertexGen && intLayer.vertexGen.w && intLayer.vertexGen.h) {
					old_w = intLayer.vertexGen.w
					old_h = intLayer.vertexGen.h
					// console.log('update: intLayer.vertexGen != undefined ' + old_w + ' ' + old_h)
				}
				var gen = undefined
				if(	intLayer.vertexGenName != layer.generatorName 
					//|| intLayer.vertexGenPixelCount  != layer.pixelCount ||
					// intLayer.vertexGenAspectRatio != layer.aspectRatio
					 // check changes of  layer.generatorOptions
					) {
					var newgen = self.vertexGen[layer.generatorName]
					if(newgen) {
						
						gen = deepcopy(newgen)
						gen.init(gen, layer.pixelCount, layer.aspectRatio, layer.generatorOptions)
						intLayer.vertexGen = gen
						intLayer.vertexGenName = layer.generatorName
						if(old_w != -1 && old_h != -1) {
							gen.w = old_w
							gen.h = old_h
						}
						//intLayer.vertexGenPixelCount = layer.pixelCount
						//intLayer.vertexGenAspectRatio = layer.aspectRatio
						intLayer.rowCount = gen.getRowCount(gen)
						intLayer.rowDirty = ca(intLayer.rowCount, true)
						intLayer.vertices = ca(intLayer.rowCount)
					}
				} else {
					gen = intLayer.vertexGen
				}
				if( gen ) {
					intLayer.gridVertices1 = gen.generateGridVerts(gen)
					for(y = 0; y < intLayer.rowCount ; y++) {
						if(intLayer.rowDirty[y]) {
							intLayer.rowDirty[y] = false
							intLayer.vertices[y] = gen.generateVerts(gen, y, layer.pixelData)
						}
					}
					intLayer.valid = true
				}
			}
		})
	},
	
	invalidateLayer : function(layerId) {
		if (this.layers && this.layers[layerId]) {
			const intLayer = this.layers[layerId];
			intLayer.valid = false;

			if(intLayer.vertexGen) {	
				if (!intLayer.rowDirty || intLayer.rowDirty.length != intLayer.vertexGen.h || intLayer.rowCount != intLayer.vertexGen.h) {
					intLayer.rowCount = intLayer.vertexGen.h
					intLayer.rowDirty = ca(intLayer.vertexGen.h, true);
				}
			}

			for (let i = 0; i < intLayer.rowCount; i++) {
				intLayer.rowDirty[i] = true;
			}

		}
	},
	shiftPixels : function(self, dx, dy) {
		forIV(self.state.layers, function(i, layer) {
			var intLayer = self.layers[layer.internalId]
			var gen = intLayer.vertexGen
			if( gen ) {
				var chunkSize = gen.getChunkSize(gen)
				var w = gen.w
				var h = gen.h
				var newData = new Array(layer.pixelData.length)	
				for(var y = 0; y < h ; y++) {
					for(var x = 0; x < w ; x++) {
						//var nx = clamp(x + dx, 0, w - 1)
						//var ny = clamp(y + dy, 0, h - 1)
						var nx = (x + dx + w) % w
						var ny = (y + dy + h) % h
						for	(var i = 0; i < chunkSize ; i++) {
							newData[(x + y * w) * chunkSize + i] = layer.pixelData[(nx + ny * w) * chunkSize + i]
						}
					}
				}
				layer.pixelData = newData
				self.invalidateLayer(layer.internalId)
			}
		})
		setHashFromState(true)
	},

	resizeCanvas : function(self, dx, dy) {
		forIV(self.state.layers, function(i, layer) {
			var intLayer = self.layers[layer.internalId]
			var gen = intLayer.vertexGen

			if(layer.generatorName == 'triangular' || layer.generatorName == 'tri24') 
				dy /= 2;		
			
			if( gen ) {
				var chunkSize = gen.getChunkSize(gen)
				var pw = gen.w
				var ph = gen.h
				var w = Math.floor(Math.max(4, pw + dx * 2))
				var h = Math.floor(Math.max(4, ph + dy * 2))
				var newData = new Array(w * h * chunkSize)	
				for(var y = 0; y < h ; y++) {
					for(var x = 0; x < w ; x++) {
						var nx = x // - int(dx)
						var ny = y // - int(dy)
						for	(var i = 0; i < chunkSize ; i++) {
							newData[(x + y * w) * chunkSize + i] = nx >= pw || ny >= ph || nx < 0 || ny < 0 ? 0 : layer.pixelData[(nx + ny * pw) * chunkSize + i]
						}
					}
				}
				gen.w = w
				gen.h = h	
				layer.pixelData = newData
				layer.pixelCount = w * h * chunkSize
				self.invalidateLayer(layer.internalId)
			}
		})
		setHashFromState(true)	
	},

	getPixelState : function(self, x, y) {
		x = (x - self.ox) / self.sx
		y = (y - self.oy) / self.sy
		var layer = self.state.layers[self.state.layers.length - 1]
		var intLayer = self.layers[layer.internalId]
		var gen = intLayer.vertexGen
		if( gen ) {
			var adr = gen.getPixelAdress(gen, x, y)
			return layer.pixelData[adr]
			}
		},
	
	setPixelState : function(self, x, y, state) {
		x = (x - self.ox) / self.sx
		y = (y - self.oy) / self.sy
		var layer = self.state.layers[self.state.layers.length - 1]
		var intLayer = self.layers[layer.internalId]
		var gen = intLayer.vertexGen
		if( gen ) {
			var adr = gen.getPixelAdress(gen, x, y)
			if( layer.pixelData[adr] != state) {
				layer.pixelData[adr] = state
				self.layers[layer.internalId].valid = false
				self.layers[layer.internalId].rowDirty[gen.getRow(gen, adr)] = true
			}
		}
	},
	
	setDisplaySize : function(self, w, h) {
		self.displayW = w
		self.displayH = h
	},
	
	draw : function(self) {

		drawWidth = g_ctx.canvas.width
		drawHeight = g_ctx.canvas.height
	
		if(!showBg)
			drawClear('#555', 1)

		self.update(self)

		forIV(self.state.layers, function(i, layer) {
			var intLayer = self.layers[layer.internalId]
			var gen = intLayer.vertexGen
			if( gen ) {
				var sx, sy, ox=0, oy=0
				if(self.displayW > self.displayH) {
					sy = sx = self.displayW / gen.getRowLength(gen)
				} else {
					sx = sy = self.displayH / gen.getRowCount(gen)
				}
				self.sx = sx
				self.sy = sy
				self.ox = ox
				self.oy = oy
				
	//		    g_ctx.save();
	//            var center = [400, 400]
	//            var offs = { x:	window.innerWidth/2  - center[0],
	//						 y:	window.innerHeight/2 - center[1] }									
	//			g_ctx.translate(offs.x, offs.y);	// center		            
	//			g_ctx.translate(center[0], center[1]);
	//			g_ctx.rotate(layer.rotation * Math.PI / 180);
	//			g_ctx.translate(-center[0], -center[1]);			
						
		//        g_ctx.translate(window.innerWidth, window.innerHeight);
		
				if(layer.gridEnable) {
					gfx_drawVerts(intLayer.gridVertices1, layer.gridStroke1, sx, sy, ox, oy)
				}
					
				for(y = 0; y < intLayer.rowCount; y++) {
					gfx_drawVerts(intLayer.vertices[y], layer.strokeAndFill, sx, sy, ox, oy)
				}
	//			gfx_drawVerts(intLayer.gridVertices2, layer.gridStroke2)
				
	//	        g_ctx.restore();			
			}
		})
	}

}



var F = function(getf, setf) { return ['__f', getf, setf] }
var E = function(eventCode) { return ['__e', eventCode] }
var get = function(view, member)      { var f = view.__get[member]; return f ? f(view) : view[member] }
var set = function(view, member, val) { var f = view.__set[member]; if(f) f(view, val); else view[member] = val }
var execEvent = function(view, member, arg){ if(view[member] == undefined || view[member] == "") return; var f = view.__event[member]; if(f) f(view, arg); else alert('missing event '+member);  }

ST_Gui_Base = {
	active : false,
	pos : [0,0],
	size : [100,20],
	onDown : "",
	onDrag : "",
	onUp : "",
	image : "button__fc2.png",
}

var drawRequestedStatus = 'noneed'
var geoGlueDraw
wantRepaint = function() {
	if(drawRequestedStatus == 'noneed') {
		drawRequestedStatus = 'need'
		setTimeout(geoGlueDraw, 0.1)
	} else if(drawRequestedStatus == 'drawing') {
		drawRequestedStatus = 'needOneMore'
	}
}

// Schedule pixel data update to hash (to be called on mouse up)
function schedulePixelUpdate() {
    pendingPixelUpdate = true;
}

// Process pending pixel update (call this periodically or when needed)
function processPixelUpdate() {
    if (pendingPixelUpdate) {
        pendingPixelUpdate = false;
        setHashFromState(true);
    }
}

// Process pixel updates periodically (every 100ms)
setInterval(processPixelUpdate, 100);

createGUISystem = function(gui) {
	var images = {}
	var root = gui
	
	var initRec = function(inView) {
		inView.__get = {}
		inView.__set = {}
		inView.__event = {}
		for(var key in inView) {
			if(typeof inView[key] == 'object') {
				if(inView[key][0] == '__f') {
					inView.__get[key] = eval("(function(self) {var r = " + inView[key][1] + "; return r; })")
					if(inView[key][2]) {
						inView.__set[key] = eval("(function(self, x) {" + inView[key][2] + " })")
					} else {
		//				inView.__set[key] = eval("(function(self, x) {" + inView[key][1] + " = x; })") // assume global
					}
				} else if(inView[key][0] == '__e') {
					inView.__event[key] = eval("(function(self, event) {" + inView[key][1] + "})")
				}
			}
		}
		if(! inView.subViews) {
			inView.subViews = []
		}
		for(var i = 0; i < inView.subViews.length; i++) {
			initRec(inView.subViews[i])
			inView.subViews[i].parent = inView
		}
	}
	initRec(root)
	
	var drawRec = function(inView, parentPos) {
		var pos = get(inView,'pos')
		pos = [parentPos[0] + pos[0], parentPos[1] + pos[1]]
		var imgName = get(inView,'image')
		if(imgName) {
			var imObj = images[imgName]
			if( ! imObj) {
				imObj = {}
				imObj.im = new Image() 
				//imObj.im.crossOrigin = "anonymous";
				imObj.im.onload = function() { imObj.imageLoaded = true }
				imObj.im.src = imgName
				images[imgName] = imObj
			}
			if(imObj.imageLoaded) {
				var size = get(inView,'size')
				drawFillAlpha(get(inView,'opacity') || 1)
				drawImage(imObj.im, pos[0], pos[1], size[0], size[1])
			} else {
				wantRepaint()
			}			
		}
		
		var onDraw = get(inView,'onDraw')
		if(onDraw) {
			execEvent(inView, 'onDraw', { pos: pos } )
		}
		
		for(var i = 0; i < inView.subViews.length; i++) {
			var view = inView.subViews[i]
			if( get(view,'active') != false ) {
				drawRec(view, pos)
			}
		}
	}

	var hitTestRec = function(inView, targetPos, parentPos) {
		var pos = get(inView,'pos')
		var size = get(inView,'size')
		pos = [parentPos[0] + pos[0], parentPos[1] + pos[1]]
		
		if( targetPos[0] >= pos[0] && targetPos[0] < pos[0] + size[0] &&
			targetPos[1] >= pos[1] && targetPos[1] < pos[1] + size[1] ) {
			var ret
			for(var i = 0; i < inView.subViews.length; i++) {
				var view = inView.subViews[i]
				if( get(view,'active') != false ) {
					ret = hitTestRec(view, targetPos, pos)
					if(ret) {
						return ret; // hit found!
					}
				}
			}
			
			if(!ret && get(inView,'onDown')) {
				return inView;
			}
		}
	}
	
	var selection = {}
	
	return {
		draw : function() {
			drawRec(root, [0,0])
		},
		inputDown : function(id, pos) {
			var view = hitTestRec(root, pos, [0,0])
			if(view) {
				var event = {pos : pos} // client is allowed to store stuff in this object
				selection[id] = {v:view, e:event} 
				execEvent(view, 'onDown', event)
				return true
			}
		},
		inputDrag : function(id, pos, diff) {
			var sel = selection[id]
			if(sel) {
				sel.e.pos = pos
				sel.e.diff = diff
				execEvent(sel.v, 'onDrag', sel.e)
				return true
			}
		},
		inputUp : function(id, pos) {
			var sel = selection[id]
			if(sel) {
				sel.e.pos = pos
				//sel.e.diff = undefined   // leave last drag diff, might be useful
				execEvent(sel.v, 'onUp', sel.e)
				selection[id] = undefined
				return true
			}
		},
	}
}



function gfx_drawVerts(v, drawStyle, sx, sy, ox, oy) {

	if( drawStyle[1] && drawStyle[1] !=0 ) { // do stroke
		drawStrokeEnable(true)
		drawStrokeColor(drawStyle[0])
		drawStrokeAlpha(drawStyle[1])
		drawStrokeWidth(drawStyle[2])
	} else {
		drawStrokeEnable(false)	
	}

	if( drawStyle[4] && drawStyle[4] !=0 ) { // do fill
		drawFillEnable(true)
		drawFillColor(drawStyle[3])
		drawFillAlpha(drawStyle[4])
	} else {
		drawFillEnable(false)	
	}

	if( v.length > 1) {
		var move = true
		drawBegin()
		for(var i = 0; i < v.length; ) {
			if(move) {
				drawMoveTo(v[i]*sx + ox, v[i + 1]*sy + oy)
				i += 2
				move = false
			} else {
				if(v[i] == undefined) {
					i++
					if(v[i] == undefined) { // double nil trigger flush
						i++
						if(i < v.length) {
							drawEnd()
							drawBegin()
						}
					}
					move = true
				} else {
					drawLineTo(v[i]*sx + ox, v[i + 1]*sy + oy)
					i += 2
				}
			}
		}
		drawEnd()
	}
}




var renderQuality=1

var g_fill_enable=0
var g_fill_alpha=1
var g_stroke_enable=1
var g_stroke_alpha=1
g_ctx = 0

var canvasImpl = {		
	drawClear		: function(c,a)			{ var tmp=g_ctx.fillStyle; g_ctx.fillStyle=c; g_ctx.globalAlpha=a; drawFillRect(0,0,drawWidth,drawHeight); g_ctx.fillStyle=tmp; g_ctx.globalAlpha=g_fill_alpha},
	drawBegin		: function()			{ g_ctx.beginPath()},
	drawMoveTo		: function(x,y)			{ g_ctx.moveTo(x,y)},
	drawLineTo		: function(x,y)			{ g_ctx.lineTo(x,y)},
	drawEnd			: function()			{ if(g_fill_enable) g_ctx.fill(); if(g_stroke_enable) { g_ctx.globalAlpha=g_stroke_alpha; g_ctx.stroke(); g_ctx.globalAlpha=g_fill_alpha; } },
	drawFillRect	: function(x,y,w,h)		{ g_ctx.fillRect(x,y,w,h)},
	drawFillEnable	: function(b)			{ g_fill_enable=b},
	drawFillColor	: function(c)			{ g_ctx.fillStyle=c},
	drawFillAlpha	: function(a)			{ g_ctx.globalAlpha=a; g_fill_alpha=a},
	drawStrokeEnable: function(b)			{ g_stroke_enable=b},
	drawStrokeColor	: function(c)			{ g_ctx.strokeStyle=c},
	drawStrokeAlpha	: function(a)			{ g_stroke_alpha=a},
	drawStrokeWidth	: function(w)			{ g_ctx.lineWidth=w},
	drawImage		: function(i,x,y,w,h)	{ if(w==undefined) g_ctx.drawImage(i,x,y); else g_ctx.drawImage(i,x,y,w,h)},
}
	
var g_svg=[]
var g_svgfe=0
var g_svgfc="#000000"
var g_svgfa=1
var g_svgse=1
var g_svgsc="#000000"
var g_svgsa=1
var g_svgsw=1

var svgImpl = {	
	drawBegin        : function()        { g_svg.push("<path d=\"")},
	drawMoveTo       : function(x,y)     { g_svg.push("M "+x+","+y+" ")},
	drawLineTo       : function(x,y)     { g_svg.push("L "+x+","+y+" ")},
	drawEnd          : function()        { g_svg.push("\" style=\"stroke:" +(g_svgse?(g_svgsc+ "; stroke-width:" + g_svgsw + ";"):"none;") + ((g_svgse && g_svgsa!=1)?"stroke-opacity:"+g_svgsa+";":"")+
														"fill:"  + (g_svgfe?g_svgfc+";":"none;") + ((g_svgfe && g_svgfa!=1)?"fill-opacity:"  +g_svgfa+";":"") + "\"\/>\n")},
	drawFillRect     : function(x,y,w,h) { g_svg.push("<rect x=\"" +x+ "\" y=\"" +y+ "\" width=\"" +w+ "\" height=\"" +h+ "\" style=\"fill:" +g_svgfc+(g_svgfa!=1?";fill-opacity:"+g_svgfa:"")+ "\"\/>\n")},
	drawClear        : function(c,a)     { var tmp=g_svgfc, tmpa=g_svgfa; g_svgfc=c; g_svgfa=a; drawFillRect(0,0,drawWidth,drawHeight); g_svgfc=tmp; g_svgfa=tmpa},
	drawClearAll     : function(c,a)     { g_svg= ["<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"no\"?>\n" +
										"<svg xmlns:svg=\"http:\/\/www.w3.org\/2000\/svg\" xmlns=\"http:\/\/www.w3.org\/2000\/svg\" xmlns:xlink=\"http:\/\/www.w3.org\/1999\/xlink\" version=\"1.0\" " +
										"width=\"" +drawWidth+ "\" height=\"" +drawHeight+ "\">\n<g>\n"] },
	drawFillEnable   : function(b)       { g_svgfe=b},
	drawFillColor    : function(c)       { g_svgfc=c},
	drawFillAlpha    : function(a)       { g_svgfa=a},
	drawStrokeEnable : function(b)       { g_svgse=b},
	drawStrokeColor  : function(c)       { g_svgsc=c},
	drawStrokeAlpha  : function(a)       { g_svgsa=a},
	drawStrokeWidth  : function(a)       { g_svgsw=a},
	drawImage        : function(im,x,y,w,h) { g_svg.push("<image xlink:href=\"" +im.src+ "\" x=\"" +x+ "\" y=\"" +y+ (w==undefined?"":"\" width=\"" +w+ "\" height=\"" +h) + "\"/>\n")},
	drawText         : function(text,x,y,sx,sy,align) { var ssy = 1; if(!(sy==undefined||abs(sx-sy)<0.000001)) ssy=sy/sx; g_svg.push("<text x=\"" +x+ "\" y=\"" +(y/ssy)+ "\" xml:space=\"preserve\" style=\"font-size:" +(sx||12)+ "px;font-style:normal;font-weight:normal;letter-spacing:0px;word-spacing:0px;stroke:none;font-family:Sans;text-anchor:"+(align=='center'?'middle':(align=='left'?'start':'end'))+";text-align:"+(align||"center")+";fill:" +g_svgfc+(g_svgfa!=1?";fill-opacity:"+g_svgfa:"")+ "\" "+(ssy==1?"":"transform=\"scale(1,"+ssy+")\"")+">" +text+ "<\/text>\n")}
}				  

function svgFlushAndReturnSVG() {
	g_svg.push( "<\/g>\n<\/svg>\n" )
	return g_svg.join("")
}
				  
function SetDrawImplementation(impl) {
	var i, G = window.self
	for(k in impl) {
		G[k] = impl[k]
	}
}

SetDrawImplementation(canvasImpl)

ExportSVG = function() {
	SetDrawImplementation(svgImpl)
	drawClearAll("#000000", 1)
	drawClear("#000000", 1)
	geoPixelApp.draw(geoPixelApp)
	SetDrawImplementation(canvasImpl)
	return svgFlushAndReturnSVG()
}

ExportSVGAndSaveInBrowser = function() {
	var svg = ExportSVG()
	var blob = new Blob([svg], {type: "image/svg+xml"})
	var url = URL.createObjectURL(blob)
	var a = document.createElement("a")
	a.href = url
	a.download = "hipster-drawing.svg"
	a.click()
	URL.revokeObjectURL(url)
}


ExportPNGAndSaveInBrowser = function() {
    var canvas = g_ctx.canvas;
    // Convert canvas to data URL
    var dataURL = canvas.toDataURL('image/png');
    
    // Convert data URL to binary data
    var binaryString = atob(dataURL.split(',')[1]);
    var bytes = new Uint8Array(binaryString.length);
    
    for (var i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Create a Blob from the binary data
    var blob = new Blob([bytes], { type: 'image/png' });
    
    // Create and trigger download
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'hipster-drawing.png';
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    setTimeout(function() {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
}






createFullScreenCanvas = function(options) {

	options = options || {} // copy options?
	
	var dprX
	var dprY
    var prevIW
    var prevIH
	var forceNext = false
	
	var recreate = function(canvasW, canvasH, pageW, pageH) {
		document.getElementById(options.htmlId).innerHTML = "<canvas id=\"" + options.htmlId + "_canvas\" style=\"width:"+pageW+"px;height:"+pageH+"px;margin:0;margin:0;border:0\" width=\""+canvasW+"px\" height=\""+canvasH+"px\" style=\"background-color:#333333;\" >no canvas support!<\/canvas>"
		var canvasElement = document.getElementById(options.htmlId + "_canvas")
		if(options.onChangeSize) {
			options.onChangeSize(canvasElement, canvasW, canvasH, pageW, pageH, dprX, dprY)
		}
	}
	
	var setCanvasQuality = function(w,h) {
		w = w || 1
		h = h || w
		dprX = (window.devicePixelRatio || 1) * (w || 1)
		dprY = (window.devicePixelRatio || 1) * (h || 1)
		forceNext = true
	}	
	
	var handleRescale = function() {
		var w = Math.floor(window.innerWidth * dprX)
		var h = Math.floor(window.innerHeight * dprY)
		if( forceNext || ! (prevIW == w && prevIH == h) ) {
			forceNext = false
			prevIW = w
			prevIH = h
			recreate(w, h, window.innerWidth, window.innerHeight)
		}
	}
	
	setCanvasQuality(options.canvasQualityW, options.canvasQualityH)
	handleRescale()
	
	return {
		handleRescale : handleRescale,
		setCanvasQuality : setCanvasQuality,
		getPageToCanvasScalingFactors : function() { return [dprX, dprY] },
	}
}


var noInitialHash = window.location.hash.length < 1 

showMenu = noInitialHash
showBg = true

fullscreenCanvas = 0

pageToCanvasX = 1
pageToCanvasY = 1
pageSizeW = 120
pageSizeH = 120
pageSizeMax = 120

geoGlue = function(options) {
		var scale = options.scale || 1
//		var	canvas = document.getElementById(options.id), ctxt = canvas.getContext("2d");	
//		g_ctx = ctxt
		
//		drawWidth = Math.floor(window.innerWidth * scale)
//		drawHeight = Math.floor(window.innerHeight * scale)
		
//		canvas.width = drawWidth
//		canvas.height = drawHeight

//		ctxt.lineWidth = options.size || Math.ceil(Math.random() * 35);
//		ctxt.lineCap = options.lineCap || "round";
//		ctxt.pX = undefined;
//		ctxt.pY = undefined;
//
//		ctxt.fillStyle = '#333';
//		ctxt.fillRect(0,0,10000,10000);
//		
//		var pastInputData = {}
//		var radius = 40
//		var colorInc = 0
		
		var guiSystem = createGUISystem( 
			{	
				pos : [0,0],
				size : F("[pageSizeW, pageSizeH]"),
				subViews : [
				
//					{
//						pos : F("[Math.min(0, Math.floor((pageSizeW - 1280) / 2)),  Math.min(0, Math.floor((pageSizeH - 1280) / 2))]"),
//						size : F("[ Math.max(1280, pageSizeW), Math.max(1280, pageSizeH)]"),
//						image : "back1280.jpg",
//					},
					{
						active : F("showBg || showMenu"),
						pos : F("[Math.floor((pageSizeW - pageSizeMax) / 2),Math.floor((pageSizeH - pageSizeMax) / 2)]"),
						size : F("[ pageSizeMax, pageSizeMax]"),
						image : "back1280.png",
					},
					
					{
						active : F(" ! showMenu"),
						pos : [0,0],
						size : F("[pageSizeW, pageSizeH]"),
						onDraw : E("geoPixelApp.draw(geoPixelApp)"),
					},
				/*
					{
						active : F("showMenu"),
						pos : F("[(pageSizeW - get(self,'size')[0]) / 2, pageSizeH * 0.6 - get(self,'size')[1]*1.3]"),
						size : F("[pageSizeH * 0.364*1.4, pageSizeH * 0.217*1.4]"), //[364,217],
						image : "hipsterPixelLogo.png",
					},
					*/
					
					{
						active : F("showMenu"),
						pos : F("[(pageSizeW - get(self,'size')[0]) / 2, pageSizeH * 0.6 - get(self,'size')[1]*1.3]"),
						size : F("[pageSizeH * 0.2066*3.4, pageSizeH * 0.0998*3.4]"), // [2066,998]
						image : "hipsterPixelLogo2.png",
					},
					
					{
						active : F("showMenu"),
						onDown : E("geoPixelApp.init(geoPixelApp, 'triangular') ; showMenu = false ; wantRepaint() ; setHashFromState()"),
						pos : F("[pageSizeW * 0.2 - get(self,'size')[0]/2, pageSizeH * 0.7 - get(self,'size')[1]/2]"),
						size : F("[pageSizeW * 0.2, pageSizeW * 0.2]"), //[163,166],
						image : "TypeTri.png",
					},
					{
						active : F("showMenu"),
						onDown : E("geoPixelApp.init(geoPixelApp, 'tri24') ; showMenu = false ; wantRepaint() ; setHashFromState()"),
						pos : F("[pageSizeW * 0.4 - get(self,'size')[0]/2, pageSizeH * 0.7 - get(self,'size')[1]/2]"),
						size : F("[pageSizeW * 0.2, pageSizeW * 0.2]"), //[164,165],
						image : "TypeTri24.png",
					},
					{
						active : F("showMenu"),
						onDown : E("geoPixelApp.init(geoPixelApp, 'square4') ; showMenu = false ; wantRepaint() ; setHashFromState()"),
						pos : F("[pageSizeW * 0.6 - get(self,'size')[0]/2, pageSizeH * 0.7 - get(self,'size')[1]/2]"),
						size : F("[pageSizeW * 0.2, pageSizeW * 0.2]"), //[164,166],
						image : "TypeSquare4.png",
					},				
					{
						active : F("showMenu"),
						onDown : E("geoPixelApp.init(geoPixelApp, 'square8', 40) ; showMenu = false ; wantRepaint() ; setHashFromState()"),
						pos : F("[pageSizeW * 0.8 - get(self,'size')[0]/2, pageSizeH * 0.7 - get(self,'size')[1]/2]"),
						size : F("[pageSizeW * 0.2, pageSizeW * 0.2]"), //[163,165],
						image : "TypeSquare8.png",
//						opacity : 0.2,
					},

					// quality
					/*
					{
						onDown : E("renderQuality = clamp(renderQuality + (event.diff[0] + event.diff[1])/100, 0.2, 2); fullscreenCanvas.setCanvasQuality(renderQuality); updateHashParams({q: renderQuality})"),
						onUp : E("if(!event.diff) { renderQuality = renderQuality || 1; if(renderQuality != 0.25 && renderQuality != 0.5 && renderQuality != 1 && renderQuality != 2) renderQuality = 1; else { renderQuality *= 0.5; if(renderQuality < 0.24) renderQuality = 2;} fullscreenCanvas.setCanvasQuality(renderQuality); updateHashParams({q: renderQuality}) }"),
						image : "quality.png",
						pos : F("[pageSizeW - pageSizeMax * 0.08, pageSizeH - pageSizeMax * 0.08]"),
						size : F("[pageSizeMax * 0.08, pageSizeMax * 0.08]"),
					},
					*/
// color?
/*
					{
						active : F(" ! showMenu"),
						onDown : E("geoPixelApp.state.layers[0].gridEnable = !geoPixelApp.state.layers[0].gridEnable ; wantRepaint()"),
						image : "quality.png",
						onDraw : E("drawFillAlpha(1) ; drawFillColor(geoPixelApp.state.layers[0].strokeAndFill[3]) ; drawFillRect(event.pos[0] + pageSizeMax * 0.01, event.pos[1] + pageSizeMax * 0.01, pageSizeMax * 0.08 - 2 * pageSizeMax * 0.01, pageSizeMax * 0.08 - 2 * pageSizeMax * 0.01)"),
						pos : F("[pageSizeW - 6 * pageSizeMax * 0.08, pageSizeH - pageSizeMax * 0.08]"),
						size : F("[pageSizeMax * 0.08, pageSizeMax * 0.08]"),
					},
*/

// grid
/*
					{
						active : F(" ! showMenu"),
						onDown : E("geoPixelApp.state.layers[0].gridEnable = !geoPixelApp.state.layers[0].gridEnable ; wantRepaint()"),
						image : "quality.png",
						pos : F("[pageSizeW - 5 * pageSizeMax * 0.08, pageSizeH - pageSizeMax * 0.08]"),
						size : F("[pageSizeMax * 0.08, pageSizeMax * 0.08]"),
					},
*/

/*
					{
						active : F(" ! showMenu"),
						onDown : E("showMenu = !showMenu ; wantRepaint()"),
						image : "back.png",
						pos : F("[0, pageSizeH - pageSizeMax * 0.08]"),
						size : F("[pageSizeMax * 0.08, pageSizeMax * 0.08]"),
					},
*/					
				]
			}
		)
		
		geoPixelApp.init(geoPixelApp)
		
		geoGlueDraw = function() {
			drawRequestedStatus = 'drawing'
//			g_ctx.fillStyle = '#333';
//			g_ctx.globalAlpha = 1;
//			g_ctx.fillRect(0,0,10000,10000);
//			
//			geoPixelApp.draw(geoPixelApp)
			
			guiSystem.draw()
			

			
//			for(var k in inputData) { var v = inputData[k]
//				if(v) {
//					ctxt.fillStyle = v.color
//					if(v.del) {
//						ctxt.fillRect(v.x-radius, v.y-radius, 5, radius*2);
//						ctxt.fillRect(v.x+radius-5, v.y-radius, 5, radius*2);
//					} else if(v.first) {
//						ctxt.fillRect(v.x-radius, v.y-radius, radius*2, 5);
//						ctxt.fillRect(v.x-radius, v.y+radius-5, radius*2, 5);							
//					} else {
//						ctxt.fillRect(v.x-radius, v.y-radius, radius*2, radius*2);
//					}
//				}
//			}		
			if(drawRequestedStatus == 'needOneMore') {
				drawRequestedStatus = 'noneed'
				wantRepaint()
			} else {
				drawRequestedStatus = 'noneed'
			}
		}
		
		var handleRescale

		var inputData = {}
		var input = function(id, pos, a3) {
			pos = {x:pos.x * pageToCanvasX, y:pos.y * pageToCanvasY}
			if(a3.x) a3 = {x:a3.x * pageToCanvasX, y:a3.y * pageToCanvasY}
		
			var captured = false

			if(a3 == true) {
				captured = guiSystem.inputDown(id, [pos.x, pos.y])			
			} else if(a3 == false) {
				captured = guiSystem.inputUp(id, [pos.x, pos.y])				
			} else {
				captured = guiSystem.inputDrag(id, [pos.x, pos.y], [a3.x, a3.y])
			}
			
			if(captured) {
				return
			}
						
		
			if(a3 == true) {
				if(inputData[id] != undefined) { throw('inputData['+id+'] != undefined') } 
				var state = geoPixelApp.getPixelState(geoPixelApp, pos.x, pos.y) ?? 0
				inputData[id] = {	x : pos.x,
									y : pos.y,
									first : 1,
									pixelState : state,
								}
				geoPixelApp.setPixelState(geoPixelApp, pos.x, pos.y, 1 - inputData[id].pixelState)
				wantRepaint()
				
			} else if(a3 == false) {
				if(inputData[id] == undefined) { throw('inputData['+id+'] == undefined') } 
				inputData[id].del = 1
				schedulePixelUpdate(); // Schedule pixel data update to hash
			} else {
				if(inputData[id] == undefined) { throw('inputData['+id+'] == undefined  move') }
				
				var px = inputData[id].x, py = inputData[id].y
				var diff = [ pos.x - px, pos.y - py ]
				var len = Math.sqrt(diff[0]*diff[0] + diff[1]*diff[1])
				for(var i = 10; i < len; i += 10) {
					geoPixelApp.setPixelState(geoPixelApp,	px + diff[0] * i / len, 
															py + diff[1] * i / len, 1 - inputData[id].pixelState)			
				}

				inputData[id].x = pos.x
				inputData[id].y = pos.y
				geoPixelApp.setPixelState(geoPixelApp, pos.x, pos.y, 1 - inputData[id].pixelState)
				wantRepaint()
			}
			

	//				draw()
			
			inputData[id].first = 0
			if(inputData[id].del == 1) {
				inputData[id] = undefined	
			}
			
			if(options.idInfo) {
				var text = 'input:  '
				for(var k in inputData) { var v = inputData[k]
					if(v) {
						text = text + k +' ('+ v.x +' '+ v.y+')  ' 
					}
				}
				document.getElementById(options.idInfo).innerHTML = text
			}

		}
		
		fullscreenCanvas = createFullScreenCanvas( {
			canvasQualityW : canvasQuality,
			canvasQualityH : canvasQuality,
			htmlId : "hipsterPixel",
			onChangeSize : function(canvas, canvasW, canvasH, pageW, pageH, dprX, dprY) {
					mdiBindInput(canvas, input, input)
					g_ctx = canvas.getContext("2d")
					pageToCanvasX = dprX
					pageToCanvasY = dprY
					pageSizeW = pageW * dprX
					pageSizeH = pageH * dprY
					pageSizeMax = Math.max(pageSizeW, pageSizeH)
					
					geoPixelApp.setDisplaySize(geoPixelApp, canvasW, canvasH)
					wantRepaint()
				},
			} )
			
		window.setInterval(fullscreenCanvas.handleRescale, 1000 / 30);
			
		if(noInitialHash)
			setHashFromState()
		else
			setStateFromHash(true)
	}

