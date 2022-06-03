'use strict';

var annAttrs = require('../annotations/attributes');
var scatterLineAttrs = require('../../traces/scatter/attributes').line;
var dash = require('../drawing/attributes').dash;
var extendFlat = require('../../lib/extend').extendFlat;
var overrideAll = require('../../plot_api/edit_types').overrideAll;
var templatedArray = require('../../plot_api/plot_template').templatedArray;
var axisPlaceableObjs = require('../../constants/axis_placeable_objects');

module.exports = overrideAll(templatedArray('selection', {
    operation: {
        valType: 'enumerated',
        values: ['+', '-'],
        dflt: '+',
        description: [
            'Specifies the operation for the selection',
            'If *+*, the selection would be added to previous selections.',
            'If *-*, the selection would be removed from previous selections.'
        ].join(' ')
    },

    type: {
        valType: 'enumerated',
        values: ['rect', 'path'],
        description: [
            'Specifies the selection shape type to be drawn.',

            'If *rect*, a rectangle is drawn linking',
            '(`x0`,`y0`), (`x1`,`y0`), (`x1`,`y1`) and (`x0`,`y1`).',

            'If *path*, draw a custom SVG path using `path`.'
        ].join(' ')
    },

    xref: extendFlat({}, annAttrs.xref, {
        description: [
            'Sets the shape\'s x coordinate axis.',
            axisPlaceableObjs.axisRefDescription('x', 'left', 'right'),
            'If the axis `type` is *log*, then you must take the',
            'log of your desired range.',
            'If the axis `type` is *date*, then you must convert',
            'the date to unix time in milliseconds.'
        ].join(' ')
    }),

    yref: extendFlat({}, annAttrs.yref, {
        description: [
            'Sets the annotation\'s y coordinate axis.',
            axisPlaceableObjs.axisRefDescription('y', 'bottom', 'top'),
            'If the axis `type` is *log*, then you must take the',
            'log of your desired range.',
            'If the axis `type` is *date*, then you must convert',
            'the date to unix time in milliseconds.'
        ].join(' ')
    }),

    x0: {
        valType: 'any',
        description: 'Sets the selection shape\'s starting x position.'
    },
    x1: {
        valType: 'any',
        description: 'Sets the shape\'s end x position.'
    },

    y0: {
        valType: 'any',
        description: 'Sets the shape\'s starting y position.'
    },
    y1: {
        valType: 'any',
        description: 'Sets the shape\'s end y position.'
    },

    path: {
        valType: 'string',
        editType: 'arraydraw',
        description: [
            'For `type` *path* - a valid SVG path with the pixel values similar to `shapes.path`.'
        ].join(' ')
    },

    line: {
        color: scatterLineAttrs.color,
        width: extendFlat({}, scatterLineAttrs.width, {
            dflt: 1
        }),
        dash: extendFlat({}, dash, {
            dflt: 'dash'
        })
    },

    editable: {
        valType: 'boolean',
        dflt: true,
        description: [
            'Determines whether the shape could be activated for edit or not.'
        ].join(' ')
    },
}), 'arraydraw', 'from-root');
