const ChainOfExecution = require("./chainOfExecution");

/**
 * Provides functionality while working with group of TPromiseArrays
 * 
 * Available Events (Callbacks will be called with below order):
 * - onFirst: Raised when first TPromiseArray concludes
 * - onResolve: Raised when a TPromiseArray resolves 
 * - onReject: Raised with each TPromiseArray reject
 * - onComplete: Raised when all TPromiseArrays conclude
 * - onSuccess: Raised when all TPromiseArrays resolve
 * - onFailure: Raised when all TPromiseArrays reject
 * 
 * @param {Array.<TPromiseArray|any>} items 
 */
function TPromiseArray(items) {
    this.chain = new ChainOfExecution(handleFirst.bind(this));
    this.chain.setNext(new ChainOfExecution(handleResult.bind(this)))
        .setNext(new ChainOfExecution(handleResolve.bind(this)))
        .setNext(new ChainOfExecution(handleReject.bind(this)))
        .setNext(new ChainOfExecution(handleComplete.bind(this)))
        .setNext(new ChainOfExecution(handleSuccess.bind(this)))
        .setNext(new ChainOfExecution(handleFailure.bind(this)));

    this.on = {};
    this.items = items;
    this.completed = [];

    /**
     * Responsible of calling appropriate event callbacks
     * 
     * @param {Array} result 
     * @param {number} index Indicates index of the resulted item
     */
    this.resulted = function (result, index, isResolved) {
        this.chain.handle([result, index, isResolved]);
    };
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
 * Performs callback attachments to TPromiseArrays so we can be notified about the overall state
 */
TPromiseArray.prototype.attach = function () {
    this.items.forEach(function (item, index) {
        if (!(item instanceof TPromiseArray)) {
            return this.resulted(item, index, true);
        }

        //Wrapping below code block with TPromiseArray will grant us the ability to
        //exit from item's .then context when an error occurs, motive of this action
        //is to avoid allowing successive .error to handle 
        //thus surpress the error which originated from one of event handlers
        new TPromiseArray((function (resolve, reject) {
            //Return result immediately if TPromiseArray is already concluded 
            if (item.isConcluded()) {
                return this.resulted(
                    item.result,
                    index,
                    item.state === STATES.RESOLVED
                );
            }

            item.then(function (result) {
                try {
                    this.resulted(item.result, index, true);
                } catch (err) {
                    reject(err);
                }

                //return to keep TPromiseArray's result unchanged
                return result;
            }, this).error(function (err) {
                this.resulted(item.result, index, false);

                return err;
            }, this);
        }).bind(this));
    }, this);
}

/**
 * This handler is only going to be called once with first resolved TPromiseArray
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
 * This handler will be called for every TPromiseArray
 * since its responsibility is adding results
 */
function handleResult(result, index, isResolved) {
    this.completed.splice(index, 0, [result, isResolved]);
}

/**
 * This handler will be called for every resolved TPromiseArray
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

    //We could run each handler with TPromiseArray to avoid over occupying this tick
    for (var i = 0; i < this.on["onReject"].length; i++) {
        this.on["onReject"][i](result, index);
    }
}

/**
 * This handler will be called only once at the end regardless of TPromiseArrays' states
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
 * This handler will be called only if all TPromiseArrays resolve
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
 * This handler will be called only if all TPromiseArrays reject
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

module.exports = TPromiseArray;