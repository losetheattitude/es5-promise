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
    ON_CYCLE: 3,
    IDLE: 4
}

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
    (this.callable = callable)(
        resolve.bind(this),
        reject.bind(this)
    );
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

    if (this.state === STATES.IDLE) {
        this.state = STATES.ON_CYCLE;
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

    if (this.state === STATES.IDLE) {
        this.state = STATES.ON_CYCLE;
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
            //Apply function only accepts parameters as array so we transform
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
        //Loop until you find a matching callback type and return its index
        //To be utilized by next tick
        if (this.callbacks[i][0] === callbackType) {
            return i;
        }
    }

    return null;
}

/**
 * Do cleanup and perform proper actions before wrapping up Promise
 * 
 * @param {any} result 
 * @param {Boolean} isError 
 */
function finalize(result, isError) {
    this.result = result;
    this.state = STATES.IDLE;

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

    //Prepare a recursive callback which will keep chain executing
    //and assign return values of callbacks to pass them on next callback.
    var callable = this.pipeContext(
        function (callable, parameters) {
            try {
                this.result = callable(parameters);
            } catch (err) {
                this.result = err;
            }

            setImmediate(this.pipeContext(tick, this.result))
        },
        [this.callbacks.splice(0, index + 1).pop()[1], result]
    );

    setImmediate(callable);
}


/**
 * 
 * @param {any} value 
 * @returns {Promise}
 */
Promise.resolve = function (value) {
    return new Promise(function (resolve, reject) {
        resolve(value);
    });
};

/**
 * 
 * @param {any} value 
 * @returns {Promise}
 */
Promise.reject = function (value) {
    return new Promise(function (resolve, reject) {
        reject(value);
    });
}

/**
 * Returns an Promise which will be resolved with values once all of `promises` resolve
 * 
 * @param {Array.<Promise>} promises
 * @returns {Promise}
 */
Promise.all = function (promises) {
    return new Promise(function (resolve, reject) {
        var onComplete = function (completed) {
            resolve(completed);
        };

        var arr = new PromiseArray(promises, null, onComplete);
        arr.attach();
    });
}

/**
 * Returns a Promise which is going to resolve with index and value of Promise whenever one of provided Promises resolves.
 * 
 * @param {Array.<Promise>} promises
 */
Promise.any = function (promises) {
    return new Promise(function (resolve, reject) {
        var onFirst = function (result, index) {
            resolve([result, index]);
        }

        var arr = new PromiseArray(promises, onFirst, null);
        arr.attach();
    });
}

module.exports = Promise;