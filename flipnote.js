"use strict";
var flipNote = {
    mc: "",    //main canvas element (currently being drawn on)
    bc: document.getElementById("bottomCanvas"),   //bottom canvas element (displays previous frame)
    mctx: "", //main canvas context
    bctx: document.getElementById("bottomCanvas").getContext("2d"),  //bottom canvas context
    x: 0,                         //x and y coordiantes when drawing
    y: 0,
    cm: new Array(),              //"canvasMatrix": 2D array of layers for each frame(cm[frame][layer])
    lmi: new Array(),             //"layer menu items": 2D array of selectable elements corresponding to layers in cm
    frames: new Array(),          //completed frames (all layers flattened to one canvas)
    undoStack: new Array(),       //stacks to hold image data for undoing and redoing
    redoStack: new Array(),
    cLayer: 0,                    //indices into cm (current layer/current frame)
    cFrame: 0,
    isDrawing: false,
    ctrlPressed: false,
    currentTool: "",              //either pencil, pen, eraser, or dropper
    tempCanvas: "",               //temporary canvas used for copying and pasting layers

    init: function () {    //called when canvas is created
        flipNote.currentTool = flipNote.pencil;
        flipNote.bc.hidden = false;
        var wInput = document.getElementById("width").value;
        var hInput = document.getElementById("height").value;
        if (parseInt(wInput) < 350) wInput = 350;
        if (parseInt(wInput) > 1000) wInput = 1000;
        if (parseInt(hInput) < 350) hInput = 350;
        if (parseInt(hInput) > 1000) hInput = 1000;

        flipNote.bc.width = wInput;
        flipNote.bc.height = hInput;

        document.getElementById("frameButtons").hidden = false;
        document.getElementById("optionsDiv").hidden = false;
        document.getElementById("layersDiv").hidden = false;
        document.getElementById("makeGIF").hidden = false;
        document.getElementById("layersContainer").style.maxHeight = flipNote.bc.height + "px";

        //create initial frame and layer
        flipNote.lmi.push(new Array());
        flipNote.cm.push(new Array());

        //set the main canvas
        flipNote.mc = flipNote.addLayer();
        flipNote.mctx = flipNote.mc.getContext("2d");
        flipNote.frames.push(flipNote.mc);

        document.getElementById("createCanvas").hidden = true;
        flipNote.adjustPositions();
    },

    adjustPositions: function () {  //adjust position of absolutely positioned elements upon page resize
        var rect = flipNote.bc.getBoundingClientRect();
        document.getElementById("undoButton").style.left = rect.left + "px";
        document.getElementById("deleteButton").style.right = rect.left + "px";
        document.getElementById("addButton").style.right = (rect.left + 50) + "px";
        document.getElementById("redoButton").style.left = (rect.left + 50) + "px";

        var options = document.getElementById("optionsDiv");
        options.style.left = (rect.right + 30) + "px";
        options.style.top = (rect.top + window.scrollY) + "px";
        var layers = document.getElementById("layersDiv");
        layers.style.right = (rect.right + 30) + "px";
        layers.style.top = (rect.top + window.scrollY) + "px";

        var i;
        var layerArray = flipNote.cm[flipNote.cFrame];
        var rect = flipNote.bc.getBoundingClientRect();
        for (i = 0; i < layerArray.length; i++) {
            layerArray[i].style.left = (rect.left + window.scrollX) + "px";
            layerArray[i].style.top = (rect.top + window.scrollY) + "px";
        }
    },

    addLayer: function () {   //add new layer at top
        var newLayer = flipNote.createLayer();
        var rect = flipNote.bc.getBoundingClientRect();
        var layerArray = flipNote.cm[flipNote.cFrame];   //array of layers for current frame
        document.getElementById("canvasContainer").appendChild(newLayer);
        newLayer.style.left = rect.left + "px";
        layerArray.push(newLayer);

        var highestZIndex;          //calculate z-index of new layer (1 higher than highest existing z-index)
        if (layerArray.length != 1) highestZIndex = layerArray[layerArray.length - 2].style.zIndex;
        else highestZIndex = "-1";  //if this is the first layer, z-index is zero
        newLayer.style.zIndex = (parseInt(highestZIndex) + 1).toString();

        var menuItem = flipNote.createLayerMenuItem(layerArray.length - 1);
        flipNote.lmi[flipNote.cFrame].push(menuItem);
        flipNote.updateLayerMenu();
        return newLayer;
    },

    createLayer: function () {  //creates layer element
        var newLayer = document.createElement("canvas");
        newLayer.className = "layer";
        newLayer.addEventListener("pointerdown", this.cPointerDown);
        newLayer.addEventListener("pointermove", this.cPointerMove);
        newLayer.addEventListener("pointerup", this.cPointerEnd);
        newLayer.addEventListener("pointerout", this.cPointerEnd);
        newLayer.width = this.bc.width * window.devicePixelRatio;
        newLayer.height = this.bc.height * window.devicePixelRatio;
        newLayer.style.width = this.bc.width + "px";
        newLayer.style.height = this.bc.height + "px";
        newLayer.getContext("2d").scale(window.devicePixelRatio, window.devicePixelRatio);
        return newLayer;
    },

    createLayerMenuItem: function (layerNum) {  //create selectable menu element for a layer
        var newItem = document.createElement("div");
        newItem.className = "layerMenuItem";
        var hideButton = document.createElement("img");
        newItem.appendChild(hideButton);
        hideButton.src = "icons/hide_icon.jpg";
        hideButton.style.width = hideButton.style.height = "30px";
        hideButton.style.cssFloat = "left";
        hideButton.title = "Hide this layer";
        hideButton.addEventListener("click", flipNote.hideLayer);
        var layerName = document.createElement("span");
        newItem.appendChild(layerName);
        layerName.style.lineHeight = "30px";
        layerName.innerHTML = "Layer" + layerNum.toString();
        layerName.addEventListener("dblclick", flipNote.renameLayer);
        newItem.addEventListener("click", flipNote.selectLayer);
        newItem.setAttribute("index", layerNum.toString());
        return newItem;
    },

    updateLayerMenu: function () {
        var layerMenu = document.getElementById("layersContainer");
        layerMenu.textContent = "";
        var i;
        var curFrameItems = flipNote.lmi[flipNote.cFrame]; //array of layer menu items for current frame
        for (i = curFrameItems.length - 1; i >= 0; i--) {
            layerMenu.appendChild(curFrameItems[i]);
            curFrameItems[i].setAttribute("index", i);
            if (i == flipNote.cLayer) {                    //special attributes to display selected layer
                curFrameItems[i].style.backgroundColor = "#ECECEC";
                curFrameItems[i].style.border = "solid lightskyblue 2px";
            }
            else {
                curFrameItems[i].style.backgroundColor = "white";
                curFrameItems[i].style.border = "solid grey 1px";
            }
        }
    },

    selectLayer: function () {
        var layerIndex = parseInt(this.getAttribute("index")); //'this' refers to the clicked element (layer menu item)
        flipNote.changeActiveLayer(layerIndex);
        flipNote.updateLayerMenu();

        document.getElementById("opacityRange").value = 100;
        document.getElementById("opacityValue").innerHTML = "100%";
    },

    renameLayer: function () {
        var newName = prompt("Rename layer:", this.innerHTML);
        if (!(newName == "" || newName == null)) this.innerHTML = newName;
    },

    changeActiveLayer: function (layerIndex) { //called when user clicks on a layer menu item
        var layerArray = flipNote.cm[flipNote.cFrame];
        flipNote.cLayer = layerIndex;
        var tempStrokeStyle = flipNote.mctx.strokeStyle;
        var tempLineWidth = flipNote.mctx.lineWidth;
        flipNote.mc = layerArray[layerIndex];
        flipNote.mctx = flipNote.mc.getContext("2d");
        flipNote.mctx.strokeStyle = tempStrokeStyle;
        flipNote.mctx.lineWidth = tempLineWidth;
        var i;
        for (i = 0; i < layerArray.length; i++) {
            layerArray[i].style.zIndex = (i - layerIndex); //adjust z indexes so that z index of layerArray[layerIndex] is 0
        }
        flipNote.clearUndoRedoStacks();
    },

    hideLayer: function (event) {
        event.stopPropagation();
        var layerIndex = parseInt(this.parentElement.getAttribute("index"));
        flipNote.cm[flipNote.cFrame][layerIndex].hidden = true;
        this.src = "icons/unhide_icon.jpg";
        this.title = "Unhide this layer";
        this.removeEventListener("click", flipNote.hideLayer);
        this.addEventListener("click", flipNote.unhideLayer);
    },

    unhideLayer: function () {
        event.stopPropagation();
        var layerIndex = parseInt(this.parentElement.getAttribute("index"));
        flipNote.cm[flipNote.cFrame][layerIndex].hidden = false;
        this.src = "icons/hide_icon.jpg";
        this.title = "Hide this layer";
        this.removeEventListener("click", flipNote.unhideLayer);
        this.addEventListener("click", flipNote.hideLayer);
    },

    deleteLayer: function () {
        var layerArray = flipNote.cm[flipNote.cFrame];
        if (layerArray.length != 1) {
            document.getElementById("canvasContainer").removeChild(layerArray[flipNote.cLayer]);
            layerArray.splice(flipNote.cLayer, 1);
            flipNote.lmi[flipNote.cFrame].splice(flipNote.cLayer, 1);
            if (flipNote.cLayer == layerArray.length) flipNote.cLayer--;
            flipNote.mc = layerArray[flipNote.cLayer];
            flipNote.mctx = flipNote.mc.getContext("2d");
            flipNote.changeActiveLayer(flipNote.cLayer);
            flipNote.updateLayerMenu();
            flipNote.clearUndoRedoStacks();
        }
    },

    moveLayerUp: function () {
        var layerArray = flipNote.cm[flipNote.cFrame];    //array of layers (canvases) for current frame
        var curFrameItems = flipNote.lmi[flipNote.cFrame];//array of layer menu items for current frame
        if (flipNote.cLayer == (layerArray.length) - 1) return;

        var tempLayer = layerArray[flipNote.cLayer];  //swap canvas elements in layerArray
        layerArray[flipNote.cLayer] = layerArray[flipNote.cLayer + 1];
        layerArray[flipNote.cLayer + 1] = tempLayer;

        var tempMenuItem = curFrameItems[flipNote.cLayer]; //swap menu items
        curFrameItems[flipNote.cLayer] = curFrameItems[flipNote.cLayer + 1];
        curFrameItems[flipNote.cLayer + 1] = tempMenuItem;

        flipNote.cLayer++;
        flipNote.updateLayerMenu();
        flipNote.changeActiveLayer(flipNote.cLayer);
    },

    moveLayerDown: function () {
        var layerArray = flipNote.cm[flipNote.cFrame];
        var curFrameItems = flipNote.lmi[flipNote.cFrame];
        if (flipNote.cLayer == 0) return;

        var tempLayer = layerArray[flipNote.cLayer];  //swap canvas elements in layerArray
        layerArray[flipNote.cLayer] = layerArray[flipNote.cLayer - 1];
        layerArray[flipNote.cLayer - 1] = tempLayer;

        var tempMenuItem = curFrameItems[flipNote.cLayer]; //swap menu items
        curFrameItems[flipNote.cLayer] = curFrameItems[flipNote.cLayer - 1];
        curFrameItems[flipNote.cLayer - 1] = tempMenuItem;

        flipNote.cLayer--;
        flipNote.updateLayerMenu();
        flipNote.changeActiveLayer(flipNote.cLayer);
    },

    copyLayer: function (copied) {
        flipNote.tempCanvas = copied;
    },

    pasteLayer: function () {
        if (flipNote.tempCanvas == "") return;
        var pasted = flipNote.addLayer();
        var pctx = pasted.getContext("2d");
        pctx.drawImage(flipNote.tempCanvas, 0, 0, pasted.width / window.devicePixelRatio, pasted.height / window.devicePixelRatio);
    },

    changeOpacity: function () {
        var val = document.getElementById("opacityRange").value;
        flipNote.mc.style.opacity = val / 100;
        document.getElementById("opacityValue").innerHTML = val.toString() + "%";
    },

    changeLastFrameOpacity: function () {
        var val = document.getElementById("LFopacityRange").value;
        flipNote.bc.style.opacity = val / 100;
        document.getElementById("LFopacityValue").innerHTML = val.toString() + "%";
    },

    drawFrame: function (frameIndex) {  //combine layers into one canvas and place it in flipNote.frames
        var newCanvas = document.createElement("canvas");
        newCanvas.width = flipNote.bc.width * window.devicePixelRatio;
        newCanvas.height = flipNote.bc.height * window.devicePixelRatio;
        newCanvas.style.width = this.bc.width + "px";
        newCanvas.style.height = this.bc.height + "px";
        newCanvas.getContext("2d").scale(window.devicePixelRatio, window.devicePixelRatio);
        var newCtx = newCanvas.getContext("2d");
        newCtx.fillStyle = "white";
        newCtx.fillRect(0, 0, newCanvas.width, newCanvas.height);
        var layerArray = flipNote.cm[frameIndex];
        var i, tempOpacity;
        for (i = 0; i < layerArray.length; i++) {
            if (layerArray[i].hidden != true) {
                var tempOpacity = layerArray[i].style.opacity;
                if (tempOpacity != "") newCtx.globalAlpha = parseFloat(tempOpacity);
                else newCtx.globalAlpha = 1;
                newCtx.drawImage(layerArray[i], 0, 0, newCanvas.width / window.devicePixelRatio, newCanvas.height / window.devicePixelRatio);
            }
        }
        flipNote.frames[flipNote.cFrame] = newCanvas;
    },

    addFrame: function () { //place a new empty frame after the current frame
        var tempStrokeStyle = flipNote.mctx.strokeStyle;
        var tempLineWidth = flipNote.mctx.lineWidth;

        flipNote.drawFrame(flipNote.cFrame);
        flipNote.cm.splice(flipNote.cFrame + 1, 0, new Array());
        flipNote.lmi.splice(flipNote.cFrame + 1, 0, new Array());
        flipNote.removeCanvases();
        flipNote.cFrame++;
        flipNote.cLayer = 0;
        document.getElementById("frameCount").innerHTML = "frame " + (flipNote.cFrame + 1) + "/" + flipNote.cm.length;
        flipNote.mc = flipNote.addLayer(); //create initial layer
        flipNote.mctx = this.mc.getContext("2d");
        flipNote.frames.splice(flipNote.cFrame, 0, flipNote.mc);
        flipNote.drawLastFrame();

        flipNote.mctx.strokeStyle = tempStrokeStyle;
        flipNote.mctx.lineWidth = tempLineWidth;

        flipNote.clearUndoRedoStacks();
    },

    nextFrame: function () { //move to the next frame
        var tempStrokeStyle = flipNote.mctx.strokeStyle;
        var tempLineWidth = flipNote.mctx.lineWidth;

        if (flipNote.cFrame == flipNote.cm.length - 1) return;
        flipNote.drawFrame(flipNote.cFrame);
        flipNote.removeCanvases();
        flipNote.cFrame++;
        flipNote.changeActiveLayer(0);
        flipNote.addCanvases();
        flipNote.updateLayerMenu();
        flipNote.drawLastFrame();
        document.getElementById("frameCount").innerHTML = "frame " + (flipNote.cFrame + 1) + "/" + flipNote.cm.length;

        flipNote.mctx.strokeStyle = tempStrokeStyle;
        flipNote.mctx.lineWidth = tempLineWidth;

        flipNote.clearUndoRedoStacks();
    },

    prevFrame: function () {  //move to the previous frame
        var tempStrokeStyle = flipNote.mctx.strokeStyle;
        var tempLineWidth = flipNote.mctx.lineWidth;

        if (flipNote.cFrame == 0) return;
        flipNote.drawFrame(flipNote.cFrame);
        flipNote.removeCanvases();
        flipNote.cFrame--;
        flipNote.changeActiveLayer(0);
        flipNote.addCanvases();
        flipNote.updateLayerMenu();
        flipNote.drawLastFrame();
        document.getElementById("frameCount").innerHTML = "frame " + (flipNote.cFrame + 1) + "/" + flipNote.cm.length;

        flipNote.clearUndoRedoStacks();
    },

    deleteFrame(deleteIndex) { //remove the frame at cm[deleteIndex]
        if (flipNote.cm.length == 1) return;
        if (flipNote.cFrame == 0) {
            flipNote.nextFrame();
            flipNote.cFrame--;
            flipNote.drawLastFrame();
        }
        else flipNote.prevFrame();
        flipNote.cm.splice(deleteIndex, 1);
        flipNote.lmi.splice(deleteIndex, 1);
        flipNote.frames.splice(deleteIndex, 1);
        document.getElementById("frameCount").innerHTML = "frame " + (flipNote.cFrame + 1) + "/" + flipNote.cm.length;
        flipNote.clearUndoRedoStacks();
    },

    drawLastFrame: function () { //show previous frame on the bottom canvas (bc)
        var width = flipNote.bc.width;
        var height = flipNote.bc.height;
        flipNote.bctx.clearRect(0, 0, width, height);
        if (flipNote.cFrame != 0)
        {
            flipNote.bctx.drawImage(flipNote.frames[flipNote.cFrame - 1], 0, 0, width, height);
        }
    },

    removeCanvases: function () { //remove all layers from the DOM
        var layerArray = flipNote.cm[flipNote.cFrame];
        var i;
        var container = document.getElementById("canvasContainer");
        for (i = 0; i < layerArray.length; i++) {
            container.removeChild(layerArray[i]);
        }
    },

    addCanvases: function () { //add all layers for the current frame to the DOM
        var layerArray = flipNote.cm[flipNote.cFrame];
        var i;
        var container = document.getElementById("canvasContainer");
        for (i = 0; i < layerArray.length; i++) {
            container.appendChild(layerArray[i]);
        }
    },

    keyPress: function (event) {  //detect key presses (ctrl+z = undo)
        if (event.ctrlKey == true) flipNote.ctrlPressed = true;
        if (event.key == 'z' && flipNote.ctrlPressed == true && flipNote.isDrawing == false) {
            event.preventDefault();
            flipNote.undo();
        }
    },

    keyUp: function (event) {
        if (event.ctrlKey == true) flipNote.ctrlPressed = false;
    },

    undo: function () {  //undo last drawing action
        if (flipNote.undoStack.length != 0) {
            flipNote.redoStack.push(flipNote.mctx.getImageData(0, 0, flipNote.mc.width, flipNote.mc.height));
            var newState = flipNote.undoStack.pop();
            flipNote.mctx.putImageData(newState, 0, 0);
        }
    },

    redo: function () {  //redo drawing action
        if (flipNote.redoStack.length != 0) {
            flipNote.undoStack.push(flipNote.mctx.getImageData(0, 0, flipNote.mc.width, flipNote.mc.height));
            var newState = flipNote.redoStack.pop();
            flipNote.mctx.putImageData(newState, 0, 0);
        }
    },

    clearUndoRedoStacks: function () {
        flipNote.undoStack.length = 0;
        flipNote.redoStack.length = 0;
    },

    cPointerDown: function (event) {
        flipNote.currentTool.startPath(event);
    },

    cPointerMove: function (event) {
        flipNote.currentTool.draw(event);
    },

    cPointerEnd: function () {
        flipNote.currentTool.endPath();
    },

    pencil: {
        startPath: function (event) {
            flipNote.isDrawing = true;
            flipNote.undoStack.push(flipNote.mctx.getImageData(0, 0, flipNote.mc.width, flipNote.mc.height));
            var rect = flipNote.mc.getBoundingClientRect();
            flipNote.x = event.clientX - rect.left;
            flipNote.y = event.clientY - rect.top;
        },

        draw: function (event) {
            event.preventDefault();
            var rect;
            var xpos;
            var ypos;
            flipNote.mctx.lineCap = "round";
            flipNote.mctx.lineJoin = "round";
            if (flipNote.isDrawing === true) {
                rect = flipNote.mc.getBoundingClientRect();
                xpos = event.clientX - rect.left;
                ypos = event.clientY - rect.top;
                flipNote.mctx.beginPath();
                flipNote.mctx.moveTo(flipNote.x, flipNote.y);
                flipNote.mctx.lineTo(xpos, ypos);
                flipNote.mctx.stroke();
                flipNote.mctx.closePath();
                flipNote.x = xpos;
                flipNote.y = ypos;
            }
        },

        endPath: function () {
            flipNote.x = 0;
            flipNote.y = 0;
            flipNote.isDrawing = false;
        }
    },

    pen: {
        startPath: function (event) {
            flipNote.isDrawing = true;
            flipNote.undoStack.push(flipNote.mctx.getImageData(0, 0, flipNote.mc.width, flipNote.mc.height));
            var rect = flipNote.mc.getBoundingClientRect();
            flipNote.x = event.clientX - rect.left;
            flipNote.y = event.clientY - rect.top;
        },

        draw: function (event) {
            event.preventDefault();
            var rect;
            var xpos;
            var ypos;
            var ctx = flipNote.mctx;
            ctx.lineCap = "square";
            ctx.lineJoin = "square";
            if (flipNote.isDrawing === true) {
                rect = flipNote.mc.getBoundingClientRect();
                xpos = event.clientX - rect.left;
                ypos = event.clientY - rect.top;
                ctx.beginPath();
                ctx.lineWidth += 1;

                ctx.moveTo(flipNote.x, flipNote.y);
                ctx.lineTo(xpos, ypos);
                ctx.stroke();

                ctx.moveTo(flipNote.x - 2, flipNote.y - 2);
                ctx.lineTo(xpos - 2, ypos - 2);
                ctx.stroke();

                ctx.moveTo(flipNote.x - 1, flipNote.y - 1);
                ctx.lineTo(xpos - 2, ypos - 2);
                ctx.stroke();

                ctx.moveTo(flipNote.x + 1, flipNote.y + 1);
                ctx.lineTo(xpos + 2, ypos + 2);
                ctx.stroke();

                ctx.moveTo(flipNote.x + 2, flipNote.y + 2);
                ctx.lineTo(xpos + 2, ypos + 2);
                ctx.stroke();

                ctx.lineWidth -= 1;
                flipNote.x = xpos;
                flipNote.y = ypos;
                ctx.closePath();
            }
        },

        endPath: function () {
            flipNote.x = 0;
            flipNote.y = 0;
            flipNote.isDrawing = false;
        }
    },

    eraser: {
        startPath: function (event) {
            flipNote.mctx.globalCompositeOperation = "destination-out";
            flipNote.isDrawing = true;
            flipNote.undoStack.push(flipNote.mctx.getImageData(0, 0, flipNote.mc.width, flipNote.mc.height));
            var rect = flipNote.mc.getBoundingClientRect();
            flipNote.x = event.clientX - rect.left;
            flipNote.y = event.clientY - rect.top;
        },

        draw: function (event) {
            event.preventDefault();
            var rect;
            var xpos;
            var ypos;
            var tempStrokeStyle;
            flipNote.mctx.lineCap = "round";
            flipNote.mctx.lineJoin = "round";
            if (flipNote.isDrawing === true) {
                tempStrokeStyle = flipNote.mctx.strokeStyle;
                flipNote.mctx.strokeStyle = "rgba(255,255,255,1)";
                rect = flipNote.mc.getBoundingClientRect();
                xpos = event.clientX - rect.left;
                ypos = event.clientY - rect.top;
                flipNote.mctx.beginPath();
                flipNote.mctx.moveTo(flipNote.x, flipNote.y);
                flipNote.mctx.lineTo(xpos, ypos);
                flipNote.mctx.stroke();
                flipNote.mctx.closePath();
                flipNote.x = xpos;
                flipNote.y = ypos;
                flipNote.mctx.strokeStyle = tempStrokeStyle;
            }
        },

        endPath: function () {
            flipNote.mctx.globalCompositeOperation = "source-over";
            flipNote.x = 0;
            flipNote.y = 0;
            flipNote.isDrawing = false;
        }
    },

    dropper: {
        startPath: function (event) { //get color at x,y coordinate on main canvas
            var rect = flipNote.mc.getBoundingClientRect();
            flipNote.x = event.clientX - rect.left;
            flipNote.y = event.clientY - rect.top;
            var imgData = flipNote.mctx.getImageData(flipNote.x * window.devicePixelRatio, flipNote.y * window.devicePixelRatio, 1, 1).data;
            var rgb = {};
            for (var i = 0; i < 3; i++) {
                rgb[i] = imgData[i].toString(16);
                if (rgb[i].length == 1) rgb[i] = '0' + rgb[i];
            }
            var newColor = '#' + rgb[0] + rgb[1] + rgb[2];
            document.getElementById("colorPicker").value = newColor;
            flipNote.mctx.strokeStyle = newColor;
        },

        draw: function (event) {

        },

        endPath: function () {

        }
    },

    switchToPencil: function () {
        document.getElementById("pencil").src = "icons/pencil_icon_selected.jpg";
        document.getElementById("pen").src = "icons/pen_icon.jpg";
        document.getElementById("eraser").src = "icons/eraser_icon.jpg";
        document.getElementById("dropper").src = "icons/dropper_icon.jpg";

        flipNote.currentTool = flipNote.pencil;
    },

    switchToPen: function () {
        document.getElementById("pencil").src = "icons/pencil_icon.jpg";
        document.getElementById("pen").src = "icons/pen_icon_selected.jpg";
        document.getElementById("eraser").src = "icons/eraser_icon.jpg";
        document.getElementById("dropper").src = "icons/dropper_icon.jpg";

        flipNote.currentTool = flipNote.pen;
    },

    switchToEraser: function () {
        document.getElementById("pencil").src = "icons/pencil_icon.jpg";
        document.getElementById("pen").src = "icons/pen_icon.jpg";
        document.getElementById("eraser").src = "icons/eraser_icon_selected.jpg";
        document.getElementById("dropper").src = "icons/dropper_icon.jpg";

        flipNote.currentTool = flipNote.eraser;
    },

    switchToDropper: function () {
        document.getElementById("pencil").src = "icons/pencil_icon.jpg";
        document.getElementById("pen").src = "icons/pen_icon.jpg";
        document.getElementById("eraser").src = "icons/eraser_icon.jpg";
        document.getElementById("dropper").src = "icons/dropper_icon_selected.jpg";

        flipNote.currentTool = flipNote.dropper;
    },

    brushSizeText: function () { //set brush size from text input
        var bsize = document.getElementById("brushSizeText").value;
        if (bsize < 1) {
            bsize = document.getElementById("brushSizeText").value = 1;
        }
        if (bsize > 100) {
            bsize = document.getElementById("brushSizeText").value = 100;
        }
        this.mctx.lineWidth = parseInt(bsize);
        document.getElementById("brushSizeRange").value = bsize;
    },

    brushSizeRange: function () {  //set brush size from range input
        var bsize = document.getElementById("brushSizeRange").value;
        flipNote.mctx.lineWidth = parseInt(bsize);
        document.getElementById("brushSizeText").value = bsize;
    },

    colorSimple: function () {  //set color from dropdown menu
        var sel = document.getElementById("colorSimple");
        var picker = document.getElementById("colorPicker");
        flipNote.mctx.strokeStyle = picker.value = sel.options[sel.selectedIndex].id;
    },

    colorPicker: function () {  //set color from color picker
        flipNote.mctx.strokeStyle = document.getElementById("colorPicker").value;
    },

    makeGIF: function () { //combine the frames into a GIF and display the output
        var encoder = new GIFEncoder();
        var fps = document.getElementById("fps").value;
        var delay = (1 / fps) * 1000;
        encoder.setRepeat(0);
        encoder.setDelay(delay);
        encoder.start();
        var i;
        for (i = 0; i < flipNote.frames.length; i++) {
            flipNote.drawFrame(i);
            encoder.addFrame(flipNote.frames[i].getContext("2d"));
        }
        encoder.finish();
        var binary_gif = encoder.stream().getData()
        var data_url = 'data:image/gif;base64,' + btoa(binary_gif);
        document.getElementById("gifdiv").hidden = false;
        var output = document.getElementById("output");
        output.width = flipNote.bc.width;
        output.height = flipNote.bc.height;
        output.src = data_url;

        flipNote.adjustPositions();
    }
};