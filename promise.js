var PromiseArray = require("./promiseArray");

/**
 * Consists of error messages this object can produce
 * 
 * @type {Object}
 */
var ERRORS = {
    INVALID_FUNC: "Provided parameter is not a function. Please provide a function with two default parameters",
    INVALID_STATE: "Promise has already been concluded!",
    TIMEOUT: "Promise hasnt been resolved within predefined timeout"
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
 * Represents the available states of Promise object
 * @type {Object}
 */
var STATES = {
    RESOLVED: 0,
    REJECTED: 1,
    RUNNING: 2,
}

/**
 * Represents the cycle state of Promise object
 * 
 * @type {Object}
 */
var CYCLES = {
    IDLE: 0,
    ENGAGED: 1,
};

/**
 * Creates an Promise object
 * 
 * @param {Function} callable Function to be called
 * @param {number} timeout Timeout value in milliseconds, default: 5000 milliseconds
 * @throws On timeout 
 */
function Promise(callable, timeout) {
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
 * Returns a string representation of Promise
 */
Promise.prototype.toString = function () {
    var base = "Promise { $val }";
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
 * Returns a boolean indicating whether Promise is still running or not
 */
Promise.prototype.isFulfilled = function () {
    return [STATES.RESOLVED, STATES.REJECTED].some(function (state) {
        return this.state === state;
    });
}

/**
 * Returns a number indicating current state of caller
 * @return {number} 
 */
Promise.prototype.getState = function () {
    return this.state;
}

/**
 * Registers a then callback and returns the called instance
 * 
 * @param {Function} callable Callback to be registered
 * @return {Promise} Returns the object that this function has been invoked on
 */
Promise.prototype.then = function (callable) {
    this.callbacks.push([CALLBACKS.THEN, callable]);

    if (this.state !== STATES.RUNNING &&
        this.cycleState === CYCLES.IDLE) {
        this.cycleState = CYCLES.ENGAGED;

        setImmediate(this.pipeContext(tick, this.result));
    }

    return this;
}

/**
 * Registers an error callback and returns the called instance
 * 
 * @param {Function} callable
 * @return {Promise} Returns the object this function has been invoked on
 */
Promise.prototype.error = function (callable) {
    this.callbacks.push([CALLBACKS.ERROR, callable]);

    if (this.state !== STATES.RUNNING &&
        this.cycleState === CYCLES.IDLE) {
        this.cycleState = CYCLES.ENGAGED;

        setImmediate(this.pipeContext(tick, this.result));
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
Promise.prototype.pipeContext = function (callable, params) {
    return (function () {
        var parameters = params;
        if (!Array.isArray(parameters)) {
            parameters = [parameters];
        }

        return callable.apply(this, parameters);
    }).bind(this);
}

/**
 * Resolves the Promise with given `value` and sets object's states as "resolved"
 * 
 * @param {any|Function} value Value to resolve with
 * @throws {Error} On non-running states of Promise
 */
function resolve(value) {
    if (this.isFulfilled()) {
        throw new Error(ERRORS.INVALID_STATE);
    }

    var result = value;
    if (typeof result === "function") {
        //Call value if its a function to resolve with intended value
        result = result();
    }

    //This means, developer is trying to resolve with multiple values
    //In order to make this work we have to wrap it with another array
    //So pipeContext wont perceive as parameters to `tick` function
    if (Array.isArray(result)) {
        result = [result];
    }

    this.state = STATES.RESOLVED;
    this.cycleState = CYCLES.ENGAGED;

    clearTimeout(this.timeoutId);
    setImmediate(this.pipeContext(tick, result));
}

/**
 * Rejects the Promise with given `value` and sets object's states as "rejected"
 * 
 * @param {any} value
 * @throws {Error} On non-running states of Promise
 */
function reject(value) {
    if (this.isFulfilled()) {
        throw new Error(ERRORS.INVALID_STATE);
    }

    var result = value;
    if (typeof result === "function") {
        result = result();
    }

    if (!(result instanceof Error)) {
        result = new Error(result);
    }

    this.state = STATES.REJECTED;
    this.cycleState = CYCLES.ENGAGED;

    clearTimeout(this.timeoutId);
    setImmediate(this.pipeContext(tick, result));
}

/**
 * Returns next `type` callback from Promise
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
 * Do cleanup and perform proper actions before wrapping up Promise
 * 
 * @param {any} result Value that will be passed to next callback
 * @param {Boolean} isError Indicates that the result is an error
 */
function finalize(result, isError) {
    this.result = result;
    this.cycleState = CYCLES.IDLE;

    if (isError) {
        throw result;
    }
}

/**
 * Executes a registered callback each time it is invoked and performs appropriate decisions
 * 
 * @param {any} result
 * @throws {Error} On no error callbacks are present and previous callback has thrown an exception
 */
function tick(result) {
    /**
     * No callbacks present signals that its either none has been registered
     * Or existing ones are exhausted and no further actions are required so we terminate
     * 
     * If its an error, it could be caused by two distinct scenarios
     * One could be that callbacks are already exhausted by former exceptions and
     * there are no error callbacks present for this tick
     * 
     * Second one could be that its a Promise that hasnt been registered any callbacks
     */
    var isError = result instanceof Error;
    if (this.callbacks.length === 0 && !isError) {
        return finalize.apply(this, [result, isError]);
    }

    var index = getNextIndex.call(this, isError);
    if (index === null) {
        return finalize.apply(this, [result, isError]);
    }

    //Remove all callbacks up until index + 1 and receive last one
    var nextItem = this.callbacks.splice(0, index + 1).pop();
    //Prepare a recursive callback which will keep chain executing
    //and assign return values of callbacks to pass them on next callback.
    var callable = this.pipeContext(
        function (callable, parameters) {
            try {
                this.result = callable(parameters);
            } catch (err) {
                this.result = err;
            }

            setImmediate(this.pipeContext(tick, this.result));
        },
        [nextItem[1], result]
    );

    setImmediate(callable);
}


/**
 * Returns a Promise resolved with `value`
 * 
 * @param {any} value Value to resolve with
 * @returns {Promise}
 */
Promise.resolve = function (value) {
    return new Promise(function (resolve, reject) {
        resolve(value);
    });
};

/**
 * Returns a Promise rejected with `value
 * `
 * @param {any} value Value to reject with
 * @returns {Promise}
 */
Promise.reject = function (value) {
    return new Promise(function (resolve, reject) {
        reject(value);
    });
}

/**
 * Returns an Promise which will be resolved with values once all of `promisess` resolve
 * 
 * @param {Array.<Promise>} promisess
 * @returns {Promise}
 */
Promise.all = function (promisess) {
    return new Promise(function (resolve, reject) {
        var onComplete = function (completed) {
            resolve(completed);
        };

        var arr = new PromiseArray(promisess, null, onComplete);
        arr.attach();
    });
}

/**
 * Returns a Promise which is going to resolve with index and value of Promise whenever one of provided Promises resolves.
 * 
 * @param {Array.<Promise>} promisess 
 */
Promise.any = function (promisess) {
    return new Promise(function (resolve, reject) {
        var onFirst = function (result, index) {
            resolve([result, index]);
        }

        var arr = new PromiseArray(promisess, onFirst, null);
        arr.attach();
    });
}


module.exports = Promise;