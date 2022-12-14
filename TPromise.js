var EventHandlerChain = require("./core/handlerChain/EventHandlerChain");
var CallbackChain = require("./core/callbackChain/CallbackChain");
var ThenCallback = require("./core/callbackChain/callbacks/ThenCallback");
var ErrorCallback = require("./core/callbackChain/callbacks/CatchCallback");
var FinallyCallback = require("./core/callbackChain/callbacks/FinallyCallback");


/**
 * Consists of error messages this object can produce
 * 
 * @type {Object}
 */
var ERRORS = {
    INVALID_FUNC: "Provided parameter is not a function.",
};

/**
 * Represents the available states of TPromise object
 * 
 * @type {Object}
 */
var STATE = {
    RESOLVED: 0,
    REJECTED: 1,
    RUNNING: 2,
}

/**
 * Creates an object which is capable of executing given callable on next event loop.
 * 
 * * Major difference between this implementation and Promise is that this implementation always keeps 
 * its instance with method calls and does not return a new TPromise by calling methods such as then or catch. 
 * 
 * Refer to following examples:
 * 
 * * var promise = new Promise(callable).then(callable2); 
 * * var promise2 = promise.then(callable3);
 * * `promise !== promise2` TRUE
 * 
 * * 
 * 
 * * var tpromise = new TPromise(callable).then(callable2); 
 * * var tpromise2 = tpromise.then(callable3);
 * * `tpromise === tpromise2` TRUE --> This creates an effect where if you want to have 2 functions you want to
 * handle seperately you are going to have to call .fork after calling any of the available callback methods and receive a new TPromise that will resolve 
 * or reject with result of callback that the .fork method has called on. This forces newly created TPromise's callbacks 
 * to execute only after former TPromise's callbacks exhaust.
 * 
 * 
 * * Calling .fork on instance is a valid option although you may not receive the value that you are expecting to receive.
 * Result of such an action will be the result of latest callback that has been attached to former TPromise before .fork called.
 * 
 * 
 * 
 *  Using callback chain introduces its own problems like deferring the whole chain to next loop as opposed to 
 * deferring each registered callback seperately. Because of this, execution wont follow 
 * the code order instead it will complete executing first scheduled TPromise's callbacks then it switchs to next.
 * Using this approach only thing that could pose a threat is setting global variables in TPromises and
 * accessing them inside other TPromises. Next release it will be modified to follow intuitive way.
 * 
 * Refer to following examples:
 * 
 * var tpromise1 = new TPromise(callable); var tpromise2 = new TPromise(callable2);
 * * tpromise1.then(callable3);  -->  1) 
 * * tpromise2.then(callable4);  -->  3)
 * * tpromise1.then(callable5);  -->  2)
 * 
 * The very same thing can occur with Promise implementation as well where second promise takes two loops to complete
 * therefore first Promise exhausts its callbacks before second one even starts. Its better to not depend Promises
 * to eachother and outside as much as possible. Only reading purposes must be employed.
 * 
 * 
 * In addition to what is above, finally callbacks also receive a parameter that represents previous callback result
 * 
 * @param {Function} callable Function to be called
 */
function TPromise(callable) {
    this.result = null;
    this.callbackChain = new CallbackChain();
    this.state = STATE.RUNNING;
    this.callable = callable;

    if (typeof callable !== "function") {
        throw new Error(ERRORS.INVALID_FUNC);
    }
    this.callable(resolve.bind(this), reject.bind(this));
}

/**
 * Returns a string representation of TPromise
 */
TPromise.prototype.toString = function () {
    var base = "TPromise { $val }";
    if (this.state === STATE.RUNNING) {
        return base.replace("$val", "Running");
    }
    if (this.state === STATE.RESOLVED) {
        return base.replace("$val", this.result);
    }
    if (this.state === STATE.REJECTED) {
        return "Rejected with: " + this.result;
    }
}

/**
 * Returns a boolean indicating whether TPromise is still running or not
 */
TPromise.prototype.isCompleted = function () {
    return this.state !== STATE.RUNNING;
}

/**
 * Solely intended for internal usage 
 * Chances of you accessing the value that you have in mind is pretty low.
 */
TPromise.prototype.getResult = function () {
    var result = this.callbackChain.getResult();
    if (result !== null) {
        return result;
    }

    return this.result;
}

/**
 * Registers a then callback and returns the called instance
 * 
 * @param {Function} callback callback to execute
 * @param {Object|undefined} thisArg Context to pass to function
 * @return {TPromise} Returns the object that this function has been invoked on
 */
TPromise.prototype.then = function (callback, thisArg) {
    if (thisArg !== undefined) {
        callback = callback.bind(thisArg);
    }

    this.callbackChain.register(new ThenCallback(callback));
    if (this.isCompleted()) {
        this.callbackChain.engage();
    }

    return this;
}

/**
 * Registers an error callback and returns the called instance
 * 
 * @param {Function} callback callback to execute
 * @param {Object|undefined} thisArg Context to pass to function 
 * @return {TPromise} Returns the object this function has been invoked on
 */
TPromise.prototype.catch = function (callback, thisArg) {
    if (thisArg !== undefined) {
        callback = callback.bind(thisArg);
    }
    this.callbackChain.register(new ErrorCallback(callback));

    return this;
}

/**
 * Registers a finally callback
 * 
 * @param {Function} callback callback to execute
 * @param {Object|undefined} thisArg Context to pass to function
 * @returns {TPromise}
 */
TPromise.prototype.finally = function (callback, thisArg) {
    if (thisArg !== undefined) {
        callback = callback.bind(thisArg);
    }

    this.callbackChain.register(new FinallyCallback(callback))
    if (this.isCompleted()) {
        this.callbackChain.engage();
    }

    return this;
}

/**
 * Completes the TPromise and initiates execution
 * 
 * @param {Number} type Completion type
 * @param {any} value Value to complete with
 */
TPromise.prototype.complete = function (type, value) {
    if (this.isCompleted()) {
        return this.result;
    }

    this.result = value;
    this.state = type;

    var rejected = type === STATE.REJECTED;
    this.callbackChain.setPayload(value, rejected).engage();
}

/**
 * Creates a new TPromise with latest return value of called instance's chain
 * 
 * Returned TPromise will be completed on next event loop and its callbacks will be
 * called in following event loop of the one in which it has been completed 
 * 
 * @returns {TPromise}
 */
TPromise.prototype.fork = function () {
    return new TPromise((function (resolve, reject) {
        this.then(function (res) {
            resolve(res);

            return res;
        }).catch(function (err) {
            reject(err);

            //An edge case where we attach to first callback of rejected TPromise
            //This will lead to developer receiving rejected value as error
            //Expected behavior is to receive as whatever is passed to .reject method
            if (!(err instanceof Error)) {
                err = new Error(err);
            }
            throw err;
        });
    }).bind(this));
}

/**
 * Resolves the TPromise with given `value` and sets object's states as "resolved"
 * 
 * @param {any|Function} value Value to resolve with
 * @throws {Error} On non-running states of TPromise
 */
function resolve(value) {
    this.complete(STATE.RESOLVED, value);
}

/**
 * Rejects the TPromise with given `value` and sets object's states as "rejected"
 * 
 * @param {any} value
 * @throws {Error} On non-running states of TPromise
 */
function reject(value) {
    this.complete(STATE.REJECTED, value);
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
 * Returns a TPromise rejected with `value`
 * 
 * @param {any} value Value to reject with
 * @returns {TPromise}
 */
TPromise.reject = function (value) {
    return new TPromise(function (resolve, reject) {
        reject(value);
    });
}

/**
 * Returns a TPromise which will be resolved with values once all of `tpromises` resolve
 * 
 * @param {Array.<TPromise>} tpromises
 * @returns {TPromise}
 */
TPromise.all = function (tpromises) {
    return new TPromise(function (resolve, reject) {
        if (tpromises.length === 0) {
            return void resolve([]);
        }

        var arr = new TPromiseArray(tpromises);
        arr.subscribe("onReject", function (err, index) {
            reject([err, index]);
        });
        arr.subscribe("onSuccess", function (result) {
            resolve(result);
        });

        arr.attach();
    });
}

/**
 * Returns a TPromise which is going to resolve whenever 
 * one of provided TPromises resolves or all of them rejects.
 * 
 * @param {Array.<TPromise>} tpromises 
 */
TPromise.any = function (tpromises) {
    return new TPromise(function (resolve, reject) {
        if (tpromises.length === 0) {
            return void reject("Empty array");
        }

        var arr = new TPromiseArray(tpromises);
        arr.subscribe("onResolve", function (result, index) {
            resolve([result, index]);
        });
        arr.subscribe("onFailure", function (results) {
            reject(results);
        });

        arr.attach();
    });
}

/**
 * Resolves on first completed TPromise or a non-TPromise value
 * 
 * @param {Array.<TPromise|any>} tpromises 
 * @returns {any} Result and index of non/TPromise that completed
 */
TPromise.race = function (tpromises) {
    return new TPromise(function (resolve, reject) {
        if (!tpromises.length) {
            return;
        }

        var arr = new TPromiseArray(tpromises);
        arr.subscribe("onFirst", function (result, index, isResolved) {
            //Below approach is called "Guard Clause" 
            //where you dont chain multiple if/else 
            //statements because it makes code harder
            //to internalize and even navigate 
            //for someone else reading your code
            //Instead you instantly return when a
            //condition is met or processing complete
            if (isResolved) {
                return void resolve([result, index]);
            }

            reject([result, index])
        });

        arr.attach();
    });
}


/**
 * TPromise Array
 */


/**
 * Provides functionality while working with group of TPromises
 * 
 * Available Events (Callbacks will be called with below order):
 * - onFirst: Raised when first TPromise completes
 * - onResolve: Raised when a TPromise resolves 
 * - onReject: Raised with each TPromise reject
 * - onComplete: Raised when all TPromises complete
 * - onSuccess: Raised when all TPromises resolve
 * - onFailure: Raised when all TPromises reject
 * 
 * @param {Array.<TPromise|any>} items 
 */
function TPromiseArray(items) {
    this.handlerChain = new EventHandlerChain(handleFirst.bind(this));
    this.handlerChain.setNext(new EventHandlerChain(handleResult.bind(this)))
        .setNext(new EventHandlerChain(handleResolve.bind(this)))
        .setNext(new EventHandlerChain(handleReject.bind(this)))
        .setNext(new EventHandlerChain(handleComplete.bind(this)))
        .setNext(new EventHandlerChain(handleSuccess.bind(this)))
        .setNext(new EventHandlerChain(handleFailure.bind(this)));

    this.on = {};
    this.items = items;
    this.completed = [];
}

/**
 * Responsible of calling appropriate event callbacks
 * 
 * @param {Array} result 
 * @param {number} index Indicates index of the resulted item
 */
TPromiseArray.prototype.resulted = function (result, index, isResolved) {
    this.handlerChain.handle([result, index, isResolved]);
}

/**
 * Subscribes to an event with given callback
 * 
 * @param {String} event 
 * @param {Function | Array.<Function>} callback 
 */
TPromiseArray.prototype.subscribe = function (event, callback) {
    if (!this.on.hasOwnProperty(event)) {
        this.on[event] = [];
    }

    if (!Array.isArray(callback)) {
        callback = [callback];
    }

    this.on[event] = this.on[event].concat(callback);
}

/**
 * Unsubscribes from all available or given `event`
 * Use this only when you are sure that you wont need this object again
 * 
 * @param {string | undefined} event Event name 
 * @param {Function | undefined} handler Handler to remove
 */
TPromiseArray.prototype.unsubscribe = function (event, handler) {
    if (event === undefined) {
        return void (this.on = {});
    }

    //On undefined handler remove all for event
    if (handler === undefined) {
        return void (this.on[event] = null);
    }

    //Exit on undefined event
    if (!this.on[event]) {
        return;
    }

    var index = this.on[event].indexOf(handler);
    if (index === -1) {
        //Item not found, exit
        return;
    }

    this.on[event].splice(index, 1);
}

/**
 * Performs callback attachments to TPromises
 */
TPromiseArray.prototype.attach = function () {
    this.items.forEach(function (item, index) {
        if (!(item instanceof TPromise)) {
            return void this.resulted(item, index, true);
        }

        //Return result immediately if TPromise already completed
        if (item.isCompleted() && !item.callbackChain.isEngaged()) {
            return void this.resulted(
                item.getResult(),
                index,
                true
            );
        }

        //Wrapping below code block with TPromise will grant us the ability to
        //exit from item's .then context when an error occurs, motive of this action
        //is to avoid allowing successive .error to handle 
        //thus surpress the error which originated from one of event handlers
        new TPromise((function (resolve, reject) {
            item.then(function (result) {
                try {
                    this.resulted(item.result, index, true);
                } catch (err) {
                    reject(err);
                }

                //return to keep TPromise's result unchanged
                return result;
            }, this).catch(function (err) {
                try {
                    this.resulted(item.result, index, false);
                } catch (err) {
                    reject(err);
                }

                //An edge case where we attach to first callback of rejected TPromise
                //This will lead to developer receiving rejected value as error
                //Expected behavior is to receive as whatever is passed to .reject method
                if (!(err instanceof Error)) {
                    err = new Error(err);
                }
                throw err;
            }, this);
        }).bind(this));
    }, this);
}

/**
 * This handler is only going to be called once with first resolved TPromise
 * 
 * @param {any} result 
 * @param {number} index 
 * @param {boolean} isResolved 
 */
function handleFirst(result, index, isResolved) {
    if (!this.on["onFirst"] ||
        this.completed.length !== 0) {
        return;
    }

    for (var i = 0; i < this.on["onFirst"].length; i++) {
        this.on["onFirst"][i](result, index, isResolved);
    }
}

/**
 * This handler will be called for every TPromise
 * since its responsibility is adding results
 */
function handleResult(result, index, isResolved) {
    this.completed.splice(index, 0, [result, isResolved]);
}

/**
 * This handler will be called for every resolved TPromise
 */
function handleResolve(result, index, isResolved) {
    if (!isResolved || !this.on["onResolve"]) {
        return;
    }

    for (var i = 0; i < this.on["onResolve"].length; i++) {
        this.on["onResolve"][i](result, index);
    }
}

/**
 * This handler will be called for every reject
 */
function handleReject(result, index, isResolved) {
    if (!this.on["onReject"] || isResolved) {
        return;
    }

    //We could run each handler with TPromise to avoid over occupying this cycle
    for (var i = 0; i < this.on["onReject"].length; i++) {
        this.on["onReject"][i](result, index);
    }
}

/**
 * This handler will be called only once at the end regardless of TPromises' states
 */
function handleComplete(result, index, isResolved) {
    if (!this.on['onComplete'] ||
        this.completed.length !== this.items.length) {
        return;
    }

    var tpromiseResults = this.completed.map(function (res) {
        return res[0];
    });
    for (var i = 0; i < this.on['onComplete'].length; i++) {
        this.on["onComplete"][i](tpromiseResults);
    }
}

/**
 * This handler will be called only if all TPromises resolve
 */
function handleSuccess(result, index, isResolved) {
    if (!this.on["onSuccess"] ||
        this.completed.length !== this.items.length) {
        return;
    }

    if (this.completed.some(function (res) { return !res[1]; })) {
        return;
    }

    var tpromiseResults = this.completed.map(function (res) {
        return res[0];
    });
    for (var i = 0; i < this.on['onSuccess'].length; i++) {
        this.on['onSuccess'][i](tpromiseResults);
    }
}

/**
 * This handler will be called only if all TPromises reject
 */
function handleFailure(result, index, isResolved) {
    if (!this.on["onFailure"] ||
        this.completed.length !== this.items.length) {
        return;
    }

    if (this.completed.some(function (res) { return res[1]; })) {
        return;
    }

    var tpromiseResults = this.completed.map(function (res) {
        return res[0];
    });
    for (var i = 0; i < this.on['onFailure'].length; i++) {
        this.on['onFailure'][i](tpromiseResults);
    }
}

module.exports = {
    TPromise,
    TPromiseArray
};