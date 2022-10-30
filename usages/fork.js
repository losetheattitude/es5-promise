var TPromise = require("../TPromise").TPromise;

function run() {
    console.log("----------First Loop-----------");
    var tpromise1 = new TPromise(function (resolve, reject) {
        setImmediate(function () {
            console.log("----------Second Loop----------");
            resolve(432);
        });
    });
    var tpromise2 = tpromise1.then(function (res) {
        console.log("----------Third Loop-----------");
        return 32;
    });

    var tpromise3 = tpromise1.then(function (res) {
        console.log("INSIDE THIRD");
        return 65;
    }).fork();

    tpromise3.then(function (res) {
        console.log("----------Fourth Loop-----------");
        return 234;
    });

    tpromise1.then(function (res) {
        console.log("INSIDE THIRD");
        return res * 432;
    });

    setImmediate(function () {
        console.log("tpromise1:", tpromise1.getResult());
        console.log("tpromise2:", tpromise2.getResult());
        console.log("tpromise1 === tpromise2", tpromise1 === tpromise2);
        setImmediate(function () {
            console.log("tpromise1:", tpromise1.getResult());
            console.log("tpromise2:", tpromise2.getResult());
            setImmediate(function () {
                console.log("tpromise3:", tpromise3.getResult());
                console.log("tpromise1 === tpromise3", tpromise1 === tpromise3);
                console.log("-------------------------------");
            });
        });
    });

    console.log("ALL SCHEDULED!");
}

run();