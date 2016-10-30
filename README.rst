touchify
========

(todo)

.. code-block:: javascript

    touchify.bind(element, {
        'start': function (action, event) {}, // like touchstart
        'cancel': function (action, event) {}, // like touchcancel
        'click': function (action, event) {}, // called before 'end' if totalXY-movement was <10
        'end': function (action, event) {}, // like touchend
        'finally': function (action, event) {}, // called after 'end' or 'cancel'
        'trigger': function (event) {}, // called for each event


        'leave': function (action) {},
        'hover': function (action, event) {},

        'scale': function (action, event) {
            // action.scale = scale factor since touchstart
            // action.sd = scale factor delta
            // action.distance = distance between the touches
        },
        'rotate': function (action, event) {
            // action.angle = angle since touchstart
            // action.ad = angle delta
            // action.distance = distance between the touches
        },
        'wheel': function (action, event) { // mouse wheel event
            // action.wheel = wheelDelta
        },

        'move2': function (action, event) {}, //  calls preventDefault if !return-value
        'try_move': function (action, event) {}, //  calls preventDefault if return-value
        'move': function (action, event) {}, // cancel action if return-value

        /* canvas helper
        'select': function (layerX, layerY, event) {}, // pick a object, should return an unique identifier or null
        'outer': function (layerX, layerY, event) {}, // if no element was selected
        'leave': function (selected) {},
        'hover': function (selected) {},
        */
    });
    touchify.unbind(element);
