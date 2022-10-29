var TPromise = require("../TPromise").TPromise;

function run() {
    var generate = function () {
        return new TPromise(function (resolve, reject) {
            setTimeout(function () {
                console.log("inside generate");
                resolve("Something wrong");
            }, 1000);
        });
    }

    var tpromise2 = new TPromise(function (resolve, reject) {
        setTimeout(function () {
            console.log("inside tpromise2")
            reject(generate);
        }, 2000);
    });

    tpromise2.then(function (result) {
        console.log("First", result);

        return 5;
    });

    tpromise2.catch(function (err) {
        console.log(err);

        return -1;
    });

    (new TPromise(function (resolve, reject) {
        setTimeout(function () {
            resolve(1);
        }, 1000);
    })).then(function (r) {
        console.log("Other First: ", r);

        tpromise2.then(function (result) {
            console.log("Second", result);

            throw new Error("Exception 1");
        }).catch(function (err) {
            console.log("Third", err.message);

            return 5;
        }).then(function (res) {
            console.log("Fourth", res);

            return 4;
        }).then(function (res) {
            console.log("Fifth", res);

            return 12;
        }).then(function (res2) {
            console.log("Sixth", res2);

            throw new Error("Exception 2");
        }).catch(function (err) {
            console.log(err.message);
        });
    });
}

run();