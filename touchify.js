/* todo:
 * gestures if a binding have two active actions
 * velocity, px per ms
 * db-tap
 * move with 2 or 3 fingers
 * cleanup multi-touch on-end
 * drag&drop
 * swipe
 * unbind events
 * zoomed site support
 */
var touchify = (function () {
    /**
     * helper - bind a function to a list of event-names
     * @param {HTMLBaseElement|Document} element
     * @param {[String]} events
     * @param {function} callback
     */
    function bind_events(element, events, callback) {
        events.forEach(function (event) {
            element.addEventListener(event, callback);
        });
    }

    var bindings = []; // list of elements + associated handlers
    var actions = []; // list of active touch/click actions

    /**
     * find binding by element
     * @param {HTMLBaseElement|{}} element
     * @returns {null|{}}
     */
    function findBinding(element) {
        for (var i = 0; i < bindings.length; i++) {
            if (bindings[i].element === element) return bindings[i];
        }
        return null;
    }

    /**
     * @param {{}} action
     */
    function removeAction(action) {
        actions.splice(actions.indexOf(action), 1);
    }

    /**
     * @param {MouseEvent|{identifier}} event
     * @param action_creatable
     * @param action_stoppable
     * @param [identifier]
     * @returns {{}|null}
     */
    function getAction(event, action_creatable, action_stoppable, identifier) {
        if (!identifier) identifier = (event.identifier ? event.identifier : null);
        var element = event.target || event.srcElement || event.toElement;
        var binding = findBinding(element);
        var layerX = 0, layerY = 0;
        var selected = null;

        if (binding && binding.handlers['trigger']) binding.handlers['trigger'](event);

        if (event.offsetX && event.offsetY) {
            layerX = event.offsetX;
            layerY = event.offsetY;
        } else {
            var rect = element.getBoundingClientRect(); //TODO
            layerX = event.clientX - rect.left;
            layerY = event.clientY - rect.top;
        }

        // handle hover/leave
        if (binding && binding.handlers['select'] && binding.handlers['hover'] && binding.handlers['leave']) {
            selected = binding.handlers['select'](layerX, layerY, event);
            if (selected != binding._last_hover) {
                if (binding._last_hover) binding.handlers['leave'](binding._last_hover);
                binding._last_hover = selected;
                if (binding._last_hover) binding.handlers['hover'](binding._last_hover);
            }
        }

        // find action by identifier
        var action = null;
        for (var i = 0; i < actions.length; i++) {
            if (actions[i].identifier === identifier) {
                action = actions[i];
                break;
            }
        }

        if (action && action.binding != binding && action_stoppable) {
            if (action.selected && action.binding.handlers['leave']) action.binding.handlers['leave'](action);
            removeAction(action);
            return null;
        }

        if (action) {
            action.layerX = layerX;
            action.layerY = layerY;
            return action;
        }

        if (!binding) return null;
        if (!action_creatable) return null;
        var multi = null;

        if (binding.handlers['select']) {
            selected = binding.handlers['select'](layerX, layerY, event);
            if (!selected) {
                if (binding.handlers['outer']) binding.handlers['outer'](layerX, layerY, event);
                return null;
            }
        }

        for (i = 0; i < actions.length; i++) {
            if (actions[i].binding.element === element && actions[i].selected === selected) {
                multi = actions[i];
                break;
            }
        }

        if (multi && multi.multi) return null; // TODO: max 2 events per object

        action = {
            multi: null,
            second: false,
            selected: selected,
            identifier: identifier,
            binding: binding,
            active: true,
            layerX: layerX,
            layerY: layerY,
            startX: event.clientX,
            startY: event.clientY,
            totalX: 0,
            totalY: 0,
            lastX: event.clientX,
            lastY: event.clientY,
            diffX: 0,
            diffY: 0,
            userData: null
        };

        if (multi) {
            multi.multi = action;
            action.multi = multi;
            action.second = true;
        }

        actions.push(action);
        return action;
    }

    /**
     * @param {MouseEvent|{changedTouches}} event
     * @param {function} callback
     * @returns {boolean}
     */
    function eventHelper(event, callback) {
        var result = false;
        if (event.changedTouches && event.changedTouches.length) {
            for (var i = 0; i < event.changedTouches.length; i++) {
                if (callback(event.changedTouches[i])) result = true;
            }
        } else {
            // pointer/mouse
            if (callback(event)) result = true;
        }
        return result;
    }

    function distance(x1, y1, x2, y2) {
        var xd = x2 - x1, yd = y2 - y1;
        return Math.sqrt(xd * xd + yd * yd);
    }

    var onStart = function (event) {
        if (eventHelper(event, function (e) {
                var action = getAction(e, true, false);
                if (!action) return;
                if (action.binding.handlers['start']) action.userData = action.binding.handlers['start'](action, event);
                if (action.multi && action.second) action.multi.userData = action.userData; // TODO
                return true;
            })) event.preventDefault();
    };
    var onMove = function (event) {
        if (eventHelper(event, function (e) {
                var action = getAction(e, false, false);
                if (!action) return;
                if (!action.active) return;
                action.dx = e.clientX - action.lastX;
                action.dy = e.clientY - action.lastY;
                action.totalX += Math.abs(action.dx);
                action.totalY += Math.abs(action.dy);
                action.lastX = e.clientX;
                action.lastY = e.clientY;
                action.diffX = action.lastX - action.startX;
                action.diffY = action.lastY - action.startY;


                if (action.multi) {
                    var a, b;
                    if (action.second) {
                        a = action.multi;
                        b = action;
                    } else {
                        a = action;
                        b = action.multi;
                    }
                    if (action.binding.handlers['scale']) {
                        var dist = distance(a.lastX, a.lastY, b.lastX, b.lastY);
                        if (!dist) return;
                        if (!b.distance) { // todo type check
                            b.distance = dist;
                            a.ld = dist;
                            return;
                        }
                        a.scale = dist / b.distance;
                        a.ds = a.ld ? dist / a.ld : 1;
                        a.ld = dist;
                        action.binding.handlers['scale'](a, event);
                    }

                    // todo: rotateX/rotateY
                    if (action.binding.handlers['rotate']) {
                        var angle = Math.atan2(b.lastY - a.lastY, b.lastX - a.lastX);
                        if (angle < 0) angle += 2 * Math.PI;
                        angle = (angle * (180 / Math.PI));
                        if (!b.angle) { // todo type check
                            b.angle = angle;
                            a.la = angle;
                        }
                        a.angle = (b.angle - angle);
                        a.ad = (a.la ? angle - a.la : angle) / 180 * Math.PI;
                        a.la = angle;
                        action.binding.handlers['rotate'](a, event);
                    }
                    return true;
                }

                if (action.binding.handlers['move2']) {
                    if (!action.binding.handlers['move2'](action, event)) {
                        return true; // trigger preventDefault
                    } else {
                        action.active = false;
                    }
                } else if (action.totalY > action.totalX) {
                    if (action.binding.handlers['try_move']) {
                        if (action.binding.handlers['try_move'](action, event)) {
                            return true; // trigger preventDefault
                        } else {
                            action.active = false;
                        }
                    }
                } else {
                    if (action.binding.handlers['move']) {
                        if (action.binding.handlers['move'](action, event)) action.active = false;
                    }
                    return true; // trigger preventDefault
                }

            })) event.preventDefault();
    };
    var onWheel = function (event) {
        eventHelper(event, function (e) {
            var action = getAction(e, false, false);
            if (!action) return;
            if (!action.active) return;
            action.wheel = Math.max(-1, Math.min(1, (e.wheelDelta || -e.detail)));
            if (action.binding.handlers['wheel']) {
                if (!action.binding.handlers['wheel'](action, event)) {
                    event.preventDefault();
                }
            }
        });
    };

    var onOver = function (event) {
        eventHelper(event, function (e) {
            var action = getAction(e, false, true, 'mouseover');
            if (!action) return;
            if (action.binding.handlers['hover']) {
                if (!action.binding.handlers['hover'](action, event)) {
                    event.preventDefault();
                }
            } else {
                removeAction(action);
            }
        });
    };
    var onCancel = function (event) {
        eventHelper(event, function (e) {
            var action = getAction(e, false, true);
            if (!action) return;
            action.active = false;
            if (action.binding.handlers['cancel']) action.binding.handlers['cancel'](action, event);
            if (action.binding.handlers['finally']) action.binding.handlers['finally'](action, event);
            removeAction(action);
        });
    };
    var onEnd = function (event) {
        eventHelper(event, function (e) {
            var action = getAction(e, false, true);
            if (!action) return;
            if (action.active) {
                if (action.totalX < 10 && action.totalY < 10) {
                    if (action.binding.handlers['click']) action.binding.handlers['click'](action, event);
                }
                if (action.binding.handlers['end']) action.binding.handlers['end'](action, event);
                if (action.binding.handlers['finally']) action.binding.handlers['finally'](action, event);
            }
            removeAction(action);
        });
    };

    bind_events(document, ['mousedown', 'touchstart', 'pointerdown'], onStart);
    bind_events(document, ['touchmove', 'mousemove', 'pointermove'], onMove);
    bind_events(document, ['touchend', 'mouseup', 'pointerup'], onEnd);
    bind_events(document, ['touchcancel', 'pointercancel'], onCancel);
    bind_events(document, ['mousewheel'], onWheel);
    bind_events(document, ['mouseover', 'mousemove'], onOver);

    return {
        /**
         * @param {HTMLElement} element
         * @param {Object.<key, function>} handlers
         * @returns {function} bind destructor
         */
        bind: function (element, handlers) {
            var binding = {
                element: element,
                handlers: handlers
            };
            bindings.push(binding);
            return function () {
                if (binding) {
                    bindings.splice(bindings.indexOf(binding), 1);
                    binding = null;
                }
            }
        },
        /**
         * @param {HTMLElement} element
         * @return {boolean}
         */
        unbind: function (element) {
            // cleanup active actions?
            for (var i = 0; i < bindings.length; i++) {
                if (bindings[i].element === element) {
                    bindings.splice(i, 1);
                    return true;
                }
            }
            return false;
        }
    }
})();
