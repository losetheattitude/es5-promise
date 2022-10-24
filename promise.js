var PromiseArray = require("./promiseArray");

/**
 * Consists of error messages this object can produce
 * 
 * @type {Object}
 */
var ERRORS = {
    INVALID_FUNC: "Provided parameter is not a function. Please provide a function with two default parameters",
    INVALID_STATE: "Rhomise has already been concluded!",
    TIMEOUT: "Rhomise hasnt been resolved within predefined timeout"
};

/**
 * Represents available callback types
 * 
 * @type {Object}
 */
var CALLBACKS = {
    THEN: 0,
    ERROR: 1
}

/**
 * Represents the available states of Rhomise object
 * @type {Object}
 */
var STATES = {
    RESOLVED: 0,
    REJECTED: 1,
    RUNNING: 2,
}

/**
 * Represents the cycle state of Rhomise object
 * 
 * @type {Object}
 */
var CYCLES = {
    IDLE: 0,
    ENGAGED: 1,
};

/**
 * Creates an Rhomise object
 * 
 * @param {Function} callable Function to be called
 * @param {number} timeout Timeout value in milliseconds, default: 5000 milliseconds
 * @throws On timeout 
 */
function Rhomise(callable, timeout) {
    this.result = null;
    this.callbacks = [];
    this.timeoutId = setTimeout(function () {
        throw new Error(ERRORS.TIMEOUT);
    }, timeout ? timeout : 5000);

    if (typeof callable !== "function") {
        throw new Error(ERRORS.INVALID_FUNC);
    }

    this.state = STATES.RUNNING;
    this.cycleState = CYCLES.IDLE;

    (this.callable = callable)(
        resolve.bind(this),
        reject.bind(this)
    );
}

/**
 * Returns a string representation of Rhomise
 */
Rhomise.prototype.toString = function () {
    var base = "Rhomise { $val }";
    if (this.state === STATES.RUNNING) {
        base = base.replace("$val", "Running");
    }
    if (this.state === STATES.RESOLVED) {
        base = base.replace("$val", this.result);
    }
    if (this.state === STATES.REJECTED) {
        base = "Rejected with: " + this.result.message;
    }

    return base;
}

/**
 * Returns a boolean indicating whether Rhomise is still running or not
 */
Rhomise.prototype.isFulfilled = function () {
    return [STATES.RESOLVED, STATES.REJECTED].some(function (state) {
        return this.state === state;
    });
}

/**
 * Returns a number indicating current state of caller
 * @return {number} 
 */
Rhomise.prototype.getState = function () {
    return this.state;
}

/**
 * Registers a then callback and returns the called instance
 * 
 * @param {Function} callable Callback to be registered
 * @return {Rhomise} Returns the object that this function has been invoked on
 */
Rhomise.prototype.then = function (callable, thisArg) {
    this.callbacks.push([CALLBACKS.THEN, callable.bind(thisArg ? thisArg : null)]);

    if (this.state !== STATES.RUNNING &&
        this.cycleState === CYCLES.IDLE) {
        this.cycleState = CYCLES.ENGAGED;

        this.pipeContext(tick, [this.result, false])();
    }

    return this;
}

/**
 * Registers an error callback and returns the called instance
 * 
 * @param {Function} callable
 * @return {Rhomise} Returns the object this function has been invoked on
 */
Rhomise.prototype.error = function (callable, thisArg) {
    this.callbacks.push([CALLBACKS.ERROR, callable.bind(thisArg ? thisArg : null)]);

    if (this.state !== STATES.RUNNING &&
        this.cycleState === CYCLES.IDLE) {
        this.cycleState = CYCLES.ENGAGED;

        this.pipeContext(tick, [this.result, false])();
    }

    return this;
}

/**
 * Returns a function whose context is binded to caller object's context.
 * On execution provided callable will be invoked with given `params`
 * 
 * @param {Function} callable Function to be called in caller object's context
 * @param {any} params Parameters to pass
 * @return {function} 
 */
Rhomise.prototype.pipeContext = function (callable, params) {
    return (function () {
        var parameters = params;
        if (!Array.isArray(parameters)) {
            parameters = [parameters];
        }

        return callable.apply(this, parameters);
    }).bind(this);
}

/**
 * Resolves the Rhomise with given `value` and sets object's states as "resolved"
 * 
 * @param {any|Function} value Value to resolve with
 * @throws {Error} On non-running states of Rhomise
 */
function resolve(value) {
    if (this.isFulfilled()) {
        throw new Error(ERRORS.INVALID_STATE);
    }

    var result = value;
    //This means, developer is trying to resolve with multiple values
    //In order to make this work we have to wrap it with another array
    //So pipeContext wont perceive as parameters to `tick` function
    if (Array.isArray(result)) {
        result = [result];
    }

    this.state = STATES.RESOLVED;
    this.cycleState = CYCLES.ENGAGED;

    clearTimeout(this.timeoutId);
    this.pipeContext(tick, [result, false])();
}

/**
 * Rejects the Rhomise with given `value` and sets object's states as "rejected"
 * 
 * @param {any} value
 * @throws {Error} On non-running states of Rhomise
 */
function reject(value) {
    if (this.isFulfilled()) {
        throw new Error(ERRORS.INVALID_STATE);
    }

    this.state = STATES.REJECTED;
    this.cycleState = CYCLES.ENGAGED;

    clearTimeout(this.timeoutId);
    this.pipeContext(tick, [value, true])();
}

/**
 * Returns next `type` callback from Rhomise
 * 
 * @param {Boolean} isError 
 * @return {number | null}
 */
function getNextIndex(isError) {
    var callbackType = isError
        ? CALLBACKS.ERROR
        : CALLBACKS.THEN;

    for (var i = 0; i < this.callbacks.length; i++) {
        //Loop until you find a matching callback type 
        //and return its index for next tick to utilize
        if (this.callbacks[i][0] === callbackType) {
            return i;
        }
    }

    return null;
}

/**
 * Do cleanup and perform proper actions before wrapping up Rhomise
 * 
 * @param {any} result Value that will be passed to next callback
 * @param {Boolean} isError Indicates that the result is an error
 */
function finalize(result, isError) {
    this.result = result;
    this.cycleState = CYCLES.IDLE;

    if (isError) {
        throw new Error("Unhandled rhomise rejection" + result);
    }
}

/**
 * Executes a registered callback each time it is invoked and performs appropriate decisions
 * 
 * @param {any} result
 * @throws {Error} On no error callbacks are present and previous callback has thrown an exception
 */
function tick(result, isError) {
    /**
     * No callbacks present signals that its either none has been registered
     * Or existing ones are exhausted and no further actions are required so we terminate
     * 
     * If its an error, it could be caused by two distinct scenarios
     * One could be that callbacks are already exhausted by former exceptions and
     * there are no error callbacks present for this tick
     * 
     * Second one could be that its a Rhomise that hasnt been registered any callbacks
     */
    if (this.callbacks.length === 0 && !isError) {
        return finalize.apply(this, [result, isError]);
    }

    var index = getNextIndex.call(this, isError);
    if (index === null) {
        return finalize.apply(this, [result, isError]);
    }

    var nextItem = this.callbacks.splice(0, index + 1).pop();
    //Prepare a recursive callback which will keep chain executing
    //and assign return values of callbacks to pass them on next callback.
    var callable = this.pipeContext(
        function (callable, parameter) {
            var error = false;
            try {
                this.result = callable(parameter);
            } catch (err) {
                error = true;
                this.result = err;
            }

            setImmediate(this.pipeContext(tick, [this.result, error]));
        },
        [nextItem[1], result]
    );

    setImmediate(callable);
}


/**
 * Returns a Rhomise resolved with `value`
 * 
 * @param {any} value Value to resolve with
 * @returns {Rhomise}
 */
Rhomise.resolve = function (value) {
    return new Rhomise(function (resolve, reject) {
        resolve(value);
    });
};

/**
 * Returns a Rhomise rejected with `value
 * `
 * @param {any} value Value to reject with
 * @returns {Rhomise}
 */
Rhomise.reject = function (value) {
    return new Rhomise(function (resolve, reject) {
        reject(value);
    });
}

/**
 * Returns an Rhomise which will be resolved with values once all of `rhomises` resolve
 * 
 * @param {Array.<Rhomise>} rhomises
 * @returns {Rhomise}
 */
Rhomise.all = function (rhomises) {
    return new Rhomise(function (resolve, reject) {
        var onComplete = function (result) {
            resolve(result);
        };

        var onReject = function (err) {
            arr.unsubscribe();

            reject(err);
        }

        var arr = new RhomiseArray(
            rhomises,
            null,
            onReject,
            onComplete
        );
        arr.attach();
    });
}

/**
 * Returns a Rhomise which is going to resolve with index and value of Rhomise whenever one of provided Rhomises resolves.
 * 
 * @param {Array.<Rhomise>} rhomises 
 */
Rhomise.any = function (rhomises) {
    return new Rhomise(function (resolve, reject) {
        var onFirst = function (result, index) {
            resolve([result, index]);
        }

        var arr = new RhomiseArray(rhomises, onFirst);
        arr.attach();
    });
}

/**
 * Provides functionality while working with group of Rhomises
 * 
 * @param {Array.<Rhomise>} items 
 * @param {Function} onFirst Callback to be called after first Rhomise resolves
 * @param {Function} onReject Callback to be called after first Rhomise rejects
 * @param {Function} onComplete Callback to be called after all Rhomises resolve
 */
function RhomiseArray(items, onFirst, onReject, onComplete) {
    this.items = items;
    this.completed = [];

    this.onFirst = onFirst;
    this.onReject = onReject;
    this.onComplete = onComplete;

    this.attach = attach;
    this.resulted = resulted;
    this.unsubscribe = unsubscribe;
}

/**
 * Unsubscribes from all available or given `event`
 * Use this only when you are sure that you wont need this object again
 * 
 * @param {string | undefined} event Event name 
 */
function unsubscribe(event) {
    if (typeof event !== "string") {
        this.onFirst = null;
        this.onReject = null;
        this.onComplete = null;

        return;
    }

    if (typeof this[event] !== 'function') {
        throw new Error("Invalid event name");
    }
    this[event] = null;
}

/**
 * Performs callback attachments to Rhomises so we can be notified about the overall state
 */
function attach() {
    this.items.forEach(function (item, index) {
        var rhomise = new Rhomise(function (resolve, reject) {
            item.then(function (result) {
                resolve([result, index]);
            }).error(function (err) {
                reject(err);
            });
        });

        var callback = function (result) {
            this.resulted(result[0], result[1]);
        };

        rhomise.then(callback, this).error(function (err) {
            if (this.onReject) this.onReject(err);
        }, this);
    }, this);
}

/**
 * Responsible of calling appropriate event callbacks
 * 
 * @param {Array} result 
 * @param {number} index Indicates index of the resulted item
 */
function resulted(result, index) {
    if (this.completed.length === 0) {
        if (this.onFirst) {
            this.onFirst(result, index);
        }
    }

    this.completed.splice(index, 0, result);
    if (this.completed.length === this.items.length) {
        if (this.onComplete) {
            this.onComplete(this.completed);
        }
    }
}


module.exports = Promise;