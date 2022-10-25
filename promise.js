var PromiseArray = require("./promiseArray");

/**
 * Consists of error messages this object can produce
 * 
 * @type {Object}
 */
var ERRORS = {
    INVALID_FUNC: "Provided parameter is not a function. Please provide a function with two default parameters",
    INVALID_STATE: "TPromise has already been concluded!",
    TIMEOUT: "TPromise hasnt been resolved within predefined timeout"
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
 * Represents the available states of TPromise object
 * @type {Object}
 */
var STATES = {
    RESOLVED: 0,
    REJECTED: 1,
    RUNNING: 2,
}

/**
 * Represents the cycle state of TPromise object
 * 
 * @type {Object}
 */
var CYCLES = {
    IDLE: 0,
    ENGAGED: 1,
};

/**
 * Creates an TPromise object
 * 
 * @param {Function} callable Function to be called
 * @param {number} timeout Timeout value in milliseconds, default: 5000 milliseconds
 * @throws On timeout 
 */
function TPromise(callable, timeout) {
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
 * Returns a string representation of TPromise
 */
TPromise.prototype.toString = function () {
    var base = "TPromise { $val }";
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
 * Returns a boolean indicating whether TPromise is still running or not
 */
TPromise.prototype.isFulfilled = function () {
    return [STATES.RESOLVED, STATES.REJECTED].some(function (state) {
        return this.state === state;
    }, this);
}

/**
 * Returns a number indicating current state of caller
 * @return {number} 
 */
TPromise.prototype.getState = function () {
    return this.state;
}

/**
 * Registers a then callback and returns the called instance
 * 
 * @param {Function} callable Callback to be registered
 * @return {TPromise} Returns the object that this function has been invoked on
 */
TPromise.prototype.then = function (callable, thisArg) {
    if (thisArg !== undefined) {
        callable = callable.bind(thisArg);
    }
    this.callbacks.push([CALLBACKS.THEN, callable]);

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
 * @return {TPromise} Returns the object this function has been invoked on
 */
TPromise.prototype.error = function (callable, thisArg) {
    if (thisArg !== undefined) {
        callable = callable.bind(thisArg);
    }
    this.callbacks.push([CALLBACKS.ERROR, callable]);

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
TPromise.prototype.pipeContext = function (callable, params) {
    return (function () {
        var parameters = params;
        if (!Array.isArray(parameters)) {
            parameters = [parameters];
        }

        return callable.apply(this, parameters);
    }).bind(this);
}

/**
 * Resolves the TPromise with given `value` and sets object's states as "resolved"
 * 
 * @param {any|Function} value Value to resolve with
 * @throws {Error} On non-running states of TPromise
 */
function resolve(value) {
    if (this.isFulfilled()) {
        throw new Error(ERRORS.INVALID_STATE);
    }

    this.state = STATES.RESOLVED;
    this.cycleState = CYCLES.ENGAGED;

    clearTimeout(this.timeoutId);
    this.pipeContext(tick, [value, false])();
}

/**
 * Rejects the TPromise with given `value` and sets object's states as "rejected"
 * 
 * @param {any} value
 * @throws {Error} On non-running states of TPromise
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
 * Returns next `type` callback from TPromise
 * 
 * @param {boolean} isError 
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
 * Do cleanup and perform proper actions before wrapping up TPromise
 * 
 * @param {any} result Value that will be passed to next callback
 * @param {boolean} isError Indicates that the result is an error
 */
function finalize(result, isError) {
    this.result = result;
    this.cycleState = CYCLES.IDLE;

    if (isError) {
        throw new Error("Unhandled tpromise rejection, Result: " + result);
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
     * Second one could be that its a TPromise that hasnt been registered any callbacks
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
 * Returns a TPromise resolved with `value`
 * 
 * @param {any} value Value to resolve with
 * @returns {TPromise}
 */
TPromise.resolve = function (value) {
    return new TPromise(function (resolve, reject) {
        resolve(value);
    });
};

/**
 * Returns a TPromise rejected with `value
 * `
 * @param {any} value Value to reject with
 * @returns {TPromise}
 */
TPromise.reject = function (value) {
    return new TPromise(function (resolve, reject) {
        reject(value);
    });
}

/**
 * Returns an TPromise which will be resolved with values once all of `tpromises` resolve
 * 
 * @param {Array.<TPromise>} tpromises
 * @returns {TPromise}
 */
TPromise.all = function (tpromises) {
    return new TPromise(function (resolve, reject) {
        if (tpromises.length === 0) {
            return resolve([]);
        }

        if (tpromises.every(function (tpromise) {
            return !(tpromise instanceof TPromise);
        })) {
            return resolve(tpromises);
        }

        var arr = new TPromiseArray(tpromises);
        arr.subscribe("onReject", function (err) {
            reject(err);
        });
        arr.subscribe("onSuccess", function (result) {
            resolve(result);
        });

        arr.attach();
    });
}

/**
 * Returns a TPromise which is going to resolve with index and value of TPromise
 * whenever one of provided TPromises resolves.
 * 
 * @param {Array.<TPromise>} tpromises 
 */
TPromise.any = function (tpromises) {
    return new TPromise(function (resolve, reject) {
        if (tpromises.length === 0) {
            return reject("Empty array");
        }

        if (tpromises.every(function (tpromise) {
            return !(tpromise instanceof TPromise);
        })) {
            return resolve(tpromises);
        }

        var arr = new TPromiseArray(tpromises);
        arr.subscribe("onResolve", function (result, index) {
            //Subsequent calls after first one will generate an interesting edge case
            //where resolving any TPromise that provided to .any will trigger any's TPromise to throw
            //due to trying to resolve an already resolved TPromise 
            //but because we are appending .error callback in .attach method, error will be surpressed there

            //Expected behavior: Subsequent calls after first one should terminate
            //execution with an exception, originating from resolve of .any's TPromise
            resolve([result, index]);
        });
        arr.subscribe("onFailure", function (results) {
            reject(results);
        });

        arr.attach();
    });
}

module.exports = TPromise;