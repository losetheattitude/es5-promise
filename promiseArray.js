const ChainOfExecution = require("./chainOfExecution");

/**
 * Provides functionality while working with group of TPromises
 * 
 * Available Events (Callbacks will be called with below order):
 * - onFirst: Raised when first TPromise fulfills
 * - onResolve: Raised when a TPromise resolves 
 * - onReject: Raised with each TPromise reject
 * - onComplete: Raised when all TPromises fulfill
 * - onSuccess: Raised when all TPromises resolve
 * - onFailure: Raised when all TPromises reject
 * 
 * @param {Array.<TPromise>} items 
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

    for (var i = 0; i < callback.length; i++) {
        this.on[event].push(callback[i]);
    }
}

/**
 * Unsubscribes from all available or given `event`
 * Use this only when you are sure that you wont need this object again
 * 
 * @param {string | undefined} event Event name 
 */
TPromiseArray.prototype.unsubscribe = function (event) {
    if (event === undefined) {
        this.on = {};

        return;
    }

    //TODO: function based unsubscribe
    this.on[event] = null;
}

/**
 * Performs callback attachments to TPromises so we can be notified about the overall state
 */
TPromiseArray.prototype.attach = function () {
    this.items.forEach(function (item, index) {
        if (!(item instanceof TPromise)) {
            return this.resulted(item, index, true);
        }

        item.then(function (result) {
            this.resulted(result, index, true);

            //return to keep TPromise's result unchanged
            return result;
        }, this).error(function (err) {
            this.resulted(err, index, false);

            return err;
        }, this);
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
        this.on["onFirst"][i](result, index);
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
 * This handler will be called for every resolve
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

    //We could run each handler with TPromise to avoid over occupying this tick
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


module.exports = TPromiseArray;