// By teadrinker, 2025
// License: GNU GPL v3


// Minimal Drag Input
mdiBindInput = function(	element,		// html element

						posChange,		// posChange(id, data, diff)     
										//	 * id for inputtype, numbers for touch fingers, "mouse0", "mouse1" etc for mousebuttons
										//	 * data currently only holds position data (x and y), but can be expanded
										//   * diff gives relative change since last event
										
						statusChange,	// (optional) statusChange(id, data, status)
										//	 * id   (see above)
										//	 * data (see above)
										//   * status (bool) tells if the input was added/removed
										
						getPageOffset	// (optional) getPageOffset(element) { ... return {x: ... , y: ... } }
										//   if you need more precise positioning 
										
										
						) {
					
	statusChange = statusChange || function() { }
	getPageOffset = getPageOffset || function(obj) {
			var xpos = 0, ypos = 0
			if (obj.nodeName == "TR") { // TR is not reliable. Need to get TD.
				obj = obj.getElementsByTagName("td")[0]
			}
			while (obj) {
				xpos += obj.offsetLeft
				ypos += obj.offsetTop
				obj = obj.offsetParent
			}
			return {x:xpos, y:ypos}
		}
	
	var prevMPos
	var preventDefault = function(e) { if(e.preventDefault) e.preventDefault(); else e.returnValue = false }
	var getMousePos = function(e) { return {x:e.clientX + (window.scrollX || window.document.body.scrollLeft),  
											y:e.clientY + (window.scrollY || window.document.body.scrollTop) } }
	var offset = function(pos,isMouse) { var o = getPageOffset(element); if(isMouse) { var t = getScroll(); o.x+=t.x; o.y+=t.y } return {x:pos.x - o.x, y:pos.y - o.y} }
	
	var mousemove = function(e) {
		var k, v, mp = getMousePos(e)
		for(k in mdiMouseButtons) { v = mdiMouseButtons[k]
			if(v) {
				posChange(k, offset({x:mp.x, y:mp.y}), {x:mp.x - prevMPos[0], y:mp.y - prevMPos[1]})
			}
		}
		prevMPos = [mp.x, mp.y]
		preventDefault(e)
//		e.preventDefault();
//		e.stopPropagation();	  
//		return false
	}
	
	var mouseup = function(e) {
		var k, i = 0, mp = getMousePos(e)
		var id = 'mouse' + (e.button || '0')
		if(mdiMouseButtons[id]) {
			statusChange(id, offset({x:mp.x, y:mp.y}), false)
			mdiMouseButtons[id] = undefined
		}
		for(k in mdiMouseButtons) { if(mdiMouseButtons[k]) { i++; break } }
		if(i == 0) {
			document.removeEventListener('mousemove', mousemove, false)
			document.removeEventListener('mouseup', mouseup, false)
			mdiMouseMove = 0
		}
		preventDefault(e)
//		e.preventDefault();
//		e.stopPropagation();	  
//		return false
	}

	var mdiMouseButtons = {}
	var mousedown = function(e) {
		var id = 'mouse' + (e.button || '0'), mp = getMousePos(e)
		if(mdiMouseButtons[id]) {
			statusChange(id, offset({x:mp.x, y:mp.y}), false)  // mouseup was lost, this happens in chrome (rightdown -> leftdown -> rightrelease)
		}
		mdiMouseButtons[id] = 1
		statusChange(id, offset({x:mp.x, y:mp.y}), true)
		if(!mdiMouseMove) {
			prevMPos = [mp.x, mp.y]
			document.addEventListener('mousemove', mousemove, false)	// we want "mousecapture" as default, this is why we need this global stuff
			document.addEventListener('mouseup', mouseup, false)
			mdiMouseMove = 1
		}	
		preventDefault(e)
//		e.preventDefault();
//		e.stopPropagation();	  
//		return false
	}
	element.addEventListener('mousedown', mousedown, false);
	
	window.oncontextmenu = function () { return false; }  
	
	var activeFingers = {}
	var touchUpdate = function(e) {
		processed = {}
		for(var i = 0; i < e.targetTouches.length; i++) { var v = e.targetTouches[i]
			var id = v.identifier
			if(!activeFingers[id]) {
				activeFingers[id] = {x: v.pageX, y: v.pageY}
				statusChange(id, offset(activeFingers[id]), true)			
			} else {
				if(!(activeFingers[id].x == v.pageX && activeFingers[id].y == v.pageY)) {
					var p = {x: v.pageX, y: v.pageY}
					posChange(id, offset(p), {x: p.x - activeFingers[id].x, y: p.y - activeFingers[id].y})
					activeFingers[id] = p
				}
			}
			processed[id] = 1
		}
		for(var id in activeFingers) { var v = activeFingers[id]
			if(v && !processed[id]) {
				statusChange(id, offset(activeFingers[id]), false) // end
				activeFingers[id] = undefined
			}
		}
		preventDefault(e)
	}
	element.addEventListener('touchstart', touchUpdate, { passive: false });
	element.addEventListener('touchmove', touchUpdate, { passive: false });
	element.addEventListener('touchend', touchUpdate, { passive: false });
	
}

// globals
mdiMouseButtons = {}
mdiMouseMove = 0
