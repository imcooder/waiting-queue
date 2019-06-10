/**
 * @file 文件介绍
 * @author imcooder@gmail.com
 */
/* eslint-disable fecs-camelcase */
/* jshint node:true */
/* jshint esversion:8 */
/* jshint laxbreak:true */
/* jshint loopfunc:true */
'use strict';

const WaitingQueue = require('../index').WaitingQueue;


let queue = new WaitingQueue({
    concurrent: 2
});

function process(i) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve(i);
        }, 3000);
    });
}
const max = 5;
for(let i = 0; i < max; i++) {
    queue.add({
        id: i,
        process: process
    }, {
        waitTimeout: 1000
    }).then(id => {
        console.log('%s finish', i, id);
    }).catch(error => {
        console.error('%s error:%s', i, error.message);
    });
}
