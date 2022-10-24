/**
 * Provides functionality while working with group of Promises
 * 
 * @param {Array.<Promise>} items 
 * @param {Function} onFirst Callback to be called after first Promise resolves
 * @param {Function} onReject Callback to be called after first Promise rejects
 * @param {Function} onComplete Callback to be called after all Promises resolve
 */
function PromiseArray(items, onFirst, onReject, onComplete) {
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
 * Performs callback attachments to Promises so we can be notified about the overall state
 */
function attach() {
    this.items.forEach(function (item, index) {
        var promise = new Promise(function (resolve, reject) {
            item.then(function (result) {
                resolve([result, index]);
            }).error(function (err) {
                reject(err);
            });
        });

        var callback = function (result) {
            this.resulted(result[0], result[1]);
        };

        promise.then(callback, this).error(function (err) {
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

module.exports = PromiseArray;