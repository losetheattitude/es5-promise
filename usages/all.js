var TPromise = require("../TPromise").TPromise;

function run() {
    var all = TPromise.all([
        new TPromise(function (resolve, reject) {
            setTimeout(function () {
                reject(1234);
            }, 500);
        }),
        new TPromise(function (resolve, reject) {
            setTimeout(function () {
                resolve(1235);
            }, 2000);
        }),
        new TPromise(function (resolve, reject) {
            setTimeout(function () {
                resolve(1236);
            }, 2000);
        })
    ]);

    all.then(function (result) {
        console.log("ALL THEN", result);
    }).catch(function (err) {
        console.log("ALL ERROR", err);
    });
}

run();