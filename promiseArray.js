/**
 * Provides functionality while working with group of Promises
 * 
 * @param {Array.<Promise>} items 
 * @param {Callback} onFirst Callback to be called after first Promise resolves
 * @param {Callback} onComplete Callback to be called after all Promises resolve
 */
function PromiseArray(items, onFirst, onComplete) {
    this.items = items;
    this.completed = [];

    this.onFirst = onFirst;
    this.onComplete = onComplete;

    this.attach = attach;
    this.resolved = resolved;
}

/**
 * Performs callback attachments to Promises so we can be notified about the overall state
 */
function attach() {
    this.items.forEach(function (item, index) {
        var Promise = new Promise(function (resolve) {
            item.then(function (result) {
                resolve([index, result]);
            });
        });

        var callback = (function (result) {
            this.resolved(result[0], result[1]);
        });

        Promise.then(callback.bind(this));
    }, this);
}

/**
 * Responsible of calling appropriate event callbacks
 * 
 * @param {number} index 
 * @param {any} result 
 */
function resolved(index, result) {
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