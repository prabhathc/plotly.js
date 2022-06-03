'use strict';

var Registry = require('../../registry');
var Lib = require('../../lib');
var Axes = require('../../plots/cartesian/axes');

var readPaths = require('../shapes/draw_newshape/helpers').readPaths;
var displayOutlines = require('../shapes/draw_newshape/display_outlines');

var clearOutlineControllers = require('./handle_outline').clearOutlineControllers;

var Color = require('../color');
var Drawing = require('../drawing');
var arrayEditor = require('../../plot_api/plot_template').arrayEditor;

var constants = require('../shapes/constants');
var helpers = require('../shapes/helpers');


// Selections are stored in gd.layout.selections, an array of objects
// index can point to one item in this array,
//  or non-numeric to simply add a new one
//  or -1 to modify all existing
// opt can be the full options object, or one key (to be set to value)
//  or undefined to simply redraw
// if opt is blank, val can be 'add' or a full options object to add a new
//  annotation at that point in the array, or 'remove' to delete this one

module.exports = {
    draw: draw,
    drawOne: drawOne,
    eraseActiveSelection: eraseActiveSelection
};

function draw(gd) {
    var fullLayout = gd._fullLayout;

    // Remove previous selections before drawing new selections in fullLayout.selections
    fullLayout._selectionLayer.selectAll('path').remove();

    for(var k in fullLayout._plots) {
        var selectionLayer = fullLayout._plots[k].selectionLayer;
        if(selectionLayer) selectionLayer.selectAll('path').remove();
    }

    for(var i = 0; i < fullLayout.selections.length; i++) {
        drawOne(gd, i);
    }
}

function drawOne(gd, index) {
    // remove the existing selection if there is one.
    // because indices can change, we need to look in all selection layers
    gd._fullLayout._paperdiv
        .selectAll('.selectionlayer [data-index="' + index + '"]')
        .remove();

    var o = helpers.makeSelectionsOptionsAndPlotinfo(gd, index);
    var options = o.options;
    var plotinfo = o.plotinfo;

    // this selection is gone - quit now after deleting it
    // TODO: use d3 idioms instead of deleting and redrawing every time
    if(!options._input) return;

    drawSelection(gd._fullLayout._selectionLayer);

    function drawSelection(selectionLayer) {
        var d = getPathString(gd, options);
        var attrs = {
            'data-index': index,
            'fill-rule': options.fillrule,
            d: d
        };

        var opacity = options.opacity;
        var fillColor = 'rgba(0,0,0,0)';
        var lineColor = options.line.width ? options.line.color : 'rgba(0,0,0,0)';
        var lineWidth = options.line.width;
        var lineDash = options.line.dash;
        if(!lineWidth && options.editable === true) {
            // ensure invisible border to activate the selection
            lineWidth = 5;
            lineDash = 'solid';
        }

        var isOpen = d[d.length - 1] !== 'Z';

        var isActiveSelection =
            options.editable && gd._fullLayout._activeSelectionIndex === index;

        if(isActiveSelection) {
            fillColor = isOpen ? 'rgba(0,0,0,0)' :
                gd._fullLayout.activeselection.fillcolor;

            opacity = gd._fullLayout.activeselection.opacity;
        }

        var path = selectionLayer.append('path')
            .attr(attrs)
            .style('opacity', opacity)
            .call(Color.stroke, lineColor)
            .call(Color.fill, fillColor)
            .call(Drawing.dashLine, lineDash, lineWidth);

        setClipPath(path, gd, options);

        var editHelpers;
        if(isActiveSelection || gd._context.edits.selectionPosition) editHelpers = arrayEditor(gd.layout, 'selections', options);

        if(isActiveSelection) {
            path.style({
                'cursor': 'move',
            });

            var dragOptions = {
                element: path.node(),
                plotinfo: plotinfo,
                gd: gd,
                editHelpers: editHelpers,
                isActiveSelection: true // i.e. to enable controllers
            };

            var polygons = readPaths(d, gd);
            // display polygons on the screen
            displayOutlines(polygons, path, dragOptions);
        } else {
            if(options.editable === true) {
                path.style('pointer-events', 'stroke');
            }
        }

        path.node().addEventListener('click', function() { return activateSelection(gd, path); });
    }
}

function setClipPath(selectionPath, gd, selectionOptions) {
    // note that for layer="below" the clipAxes can be different from the
    // subplot we're drawing this in. This could cause problems if the selection
    // spans two subplots. See https://github.com/plotly/plotly.js/issues/1452
    //
    // if axis is 'paper' or an axis with " domain" appended, then there is no
    // clip axis
    var clipAxes = (selectionOptions.xref + selectionOptions.yref).replace(/paper/g, '').replace(/[xyz][1-9]* *domain/g, '');

    Drawing.setClipUrl(
        selectionPath,
        clipAxes ? 'clip' + gd._fullLayout._uid + clipAxes : null,
        gd
    );
}

function getPathString(gd, options) {
    var type = options.type;
    var xRefType = Axes.getRefType(options.xref);
    var yRefType = Axes.getRefType(options.yref);
    var xa = Axes.getFromId(gd, options.xref);
    var ya = Axes.getFromId(gd, options.yref);
    var gs = gd._fullLayout._size;
    var x2r, x2p, y2r, y2p;
    var x0, x1, y0, y1;

    if(xa) {
        if(xRefType === 'domain') {
            x2p = function(v) { return xa._offset + xa._length * v; };
        } else {
            x2r = helpers.shapePositionToRange(xa);
            x2p = function(v) { return xa._offset + xa.r2p(x2r(v, true)); };
        }
    } else {
        x2p = function(v) { return gs.l + gs.w * v; };
    }

    if(ya) {
        if(yRefType === 'domain') {
            y2p = function(v) { return ya._offset + ya._length * (1 - v); };
        } else {
            y2r = helpers.shapePositionToRange(ya);
            y2p = function(v) { return ya._offset + ya.r2p(y2r(v, true)); };
        }
    } else {
        y2p = function(v) { return gs.t + gs.h * (1 - v); };
    }

    if(type === 'path') {
        if(xa && xa.type === 'date') x2p = helpers.decodeDate(x2p);
        if(ya && ya.type === 'date') y2p = helpers.decodeDate(y2p);
        return convertPath(options, x2p, y2p);
    }

    if(options.xsizemode === 'pixel') {
        var xAnchorPos = x2p(options.xanchor);
        x0 = xAnchorPos + options.x0;
        x1 = xAnchorPos + options.x1;
    } else {
        x0 = x2p(options.x0);
        x1 = x2p(options.x1);
    }

    if(options.ysizemode === 'pixel') {
        var yAnchorPos = y2p(options.yanchor);
        y0 = yAnchorPos - options.y0;
        y1 = yAnchorPos - options.y1;
    } else {
        y0 = y2p(options.y0);
        y1 = y2p(options.y1);
    }

    if(type === 'line') return 'M' + x0 + ',' + y0 + 'L' + x1 + ',' + y1;
    if(type === 'rect') return 'M' + x0 + ',' + y0 + 'H' + x1 + 'V' + y1 + 'H' + x0 + 'Z';

    // circle
    var cx = (x0 + x1) / 2;
    var cy = (y0 + y1) / 2;
    var rx = Math.abs(cx - x0);
    var ry = Math.abs(cy - y0);
    var rArc = 'A' + rx + ',' + ry;
    var rightPt = (cx + rx) + ',' + cy;
    var topPt = cx + ',' + (cy - ry);
    return 'M' + rightPt + rArc + ' 0 1,1 ' + topPt +
        rArc + ' 0 0,1 ' + rightPt + 'Z';
}


function convertPath(options, x2p, y2p) {
    var pathIn = options.path;
    var xSizemode = options.xsizemode;
    var ySizemode = options.ysizemode;
    var xAnchor = options.xanchor;
    var yAnchor = options.yanchor;

    return pathIn.replace(constants.segmentRE, function(segment) {
        var paramNumber = 0;
        var segmentType = segment.charAt(0);
        var xParams = constants.paramIsX[segmentType];
        var yParams = constants.paramIsY[segmentType];
        var nParams = constants.numParams[segmentType];

        var paramString = segment.substr(1).replace(constants.paramRE, function(param) {
            if(xParams[paramNumber]) {
                if(xSizemode === 'pixel') param = x2p(xAnchor) + Number(param);
                else param = x2p(param);
            } else if(yParams[paramNumber]) {
                if(ySizemode === 'pixel') param = y2p(yAnchor) - Number(param);
                else param = y2p(param);
            }
            paramNumber++;

            if(paramNumber > nParams) param = 'X';
            return param;
        });

        if(paramNumber > nParams) {
            paramString = paramString.replace(/[\s,]*X.*/, '');
            Lib.log('Ignoring extra params in segment ' + segment);
        }

        return segmentType + paramString;
    });
}

function activateSelection(gd, path) {
    var element = path.node();
    var id = +element.getAttribute('data-index');
    if(id >= 0) {
        // deactivate if already active
        if(id === gd._fullLayout._activeSelectionIndex) {
            deactivateSelection(gd);
            return;
        }

        gd._fullLayout._activeSelectionIndex = id;
        gd._fullLayout._deactivateSelection = deactivateSelection;
        draw(gd);
    }
}

function deactivateSelection(gd) {
    var id = gd._fullLayout._activeSelectionIndex;
    if(id >= 0) {
        clearOutlineControllers(gd);
        delete gd._fullLayout._activeSelectionIndex;
        draw(gd);
    }
}

function eraseActiveSelection(gd) {
    clearOutlineControllers(gd);

    var id = gd._fullLayout._activeSelectionIndex;
    var selections = (gd.layout || {}).selections || [];
    if(id < selections.length) {
        var newSelections = [];
        for(var q = 0; q < selections.length; q++) {
            if(q !== id) {
                newSelections.push(selections[q]);
            }
        }

        delete gd._fullLayout._activeSelectionIndex;

        Registry.call('_guiRelayout', gd, {
            selections: newSelections
        });
    }
}
