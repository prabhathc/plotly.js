'use strict';

var Color = require('../../color');


module.exports = function supplyDrawNewSelectionDefaults(layoutIn, layoutOut, coerce) {
    var newselectionLineWidth = coerce('newselection.line.width');
    if(newselectionLineWidth) {
        var bgcolor = (layoutIn || {}).plot_bgcolor || '#FFF';
        coerce('newselection.line.color', Color.contrast(bgcolor));
        coerce('newselection.line.dash');
    }

    coerce('activeselection.fillcolor');
    coerce('activeselection.opacity');
};
