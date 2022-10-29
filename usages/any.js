var TPromise = require("../TPromise").TPromise;

function run() {
    var b = TPromise.any([
        new TPromise(function (resolve, reject) {
            setTimeout(function () {
                resolve(123);
            }, 500);
        }),
        new TPromise(function (resolve, reject) {
            setTimeout(function () {
                resolve("Other");
            }, 4000);
        }),
        new TPromise(function (resolve, reject) {
            resolve(12321312);
        })
    ]);

    b.then(function (res) {
        console.log("Promise.any.then: ", res);
    }).catch(function (err) {
        console.log("Promise.any.catch: ", err);
    });
}

run();