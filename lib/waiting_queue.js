/**
 * @file 文件介绍
 * @author imcooder@gmail.com
 */
/* eslint-disable fecs-camelcase */
/* jshint node:true */
/* jshint esversion:8 */
/* jshint laxbreak:true */
'use strict';

const _ = require('lodash');
const crypto = require('crypto');
const util = require('util');
const EventEmitter = require('events').EventEmitter;

const DefaultAcquireTimeout = 5000;
module.exports = class WaitingQueue extends EventEmitter {

    /**
   * Initializes a new Queue instance with provided opt.
   *
   * @param   {Object}  opt
   * @param   {number}  opt.concurrent  并发度
   * @return  {}
   */
    constructor(opt = {}) {
        super();
        this.concurrent = 1;
        if (opt.concurrent && util.isNumber(opt.concurrent)) {
            this.concurrent = parseInt(opt.concurrent, 10);
        }
        if (this.concurrent < 1) {
            this.concurrent = 1;
        }
        this.opt = opt;
        this._taskList = [];
        this._runningNum = 0;
        this._msgid = 1000;
    }
    length() {
        return this._taskList.length;
    }
    getMsgId() {
        return this._msgid++;
    }
    add(request, opt) {
        let self = this;
        this._debug('add request');
        opt = opt || {};
        opt.acquireTimeout = opt.acquireTimeout || DefaultAcquireTimeout;
        return self._pushTask(request, opt);
    }
    _debug(...arg) {
        console.log(...arg);
    }
    _warn(...arg) {
        console.warn(...arg);
    }
    _error(...arg) {
        console.error(...arg);
    }
    _pushTask(request, opt) {
        let self = this;
        this._debug('pushTask:%j', request);
        let taskInfo = {
            request: request,
            status: 'create',
            timer: null,
            writeTime: 0,
            opt: opt,
            msgid: this.getMsgId()
        };
        self._taskList.push(taskInfo);
        let promise = new Promise((resolve, reject) => {
            taskInfo.resolve = resolve;
            taskInfo.reject = reject;
            taskInfo.acquireTimer = setTimeout(() => {
                if (['finish', 'cancel', 'timeout', 'doing', 'early_return'].indexOf(taskInfo.status) !== -1) {
                    return;
                }
                taskInfo.status = 'timeout';
                self._warn('request timeout');
                reject(new Error('timeout'));
                self._removeTask(taskInfo.msgid);
            }, opt.acquireTimeout);
            self._checkQueue();
        });
        return promise;
    }
    _checkQueue() {
        let self = this;
        if (self._taskList.length === 0) {
            return;
        }
        if (this._runningNum >= this.concurrent) {
            this._debug('busy');
            return;
        }
        while (this._taskList.length > 0 && this._runningNum < this.concurrent) {
            let taskInfo = this._taskList.shift();
            if (!taskInfo || ['cancel', 'timeout'].indexOf(taskInfo.status) !== -1) {
                continue;
            }
            this._process(taskInfo);
        }
    }

    _process(taskInfo) {
        if (!taskInfo) {
            return;
        }
        let process = taskInfo.request.process || this.opt.process;
        if (!process) {
            this._error('invalid_process');
            if (taskInfo.reject) {
                taskInfo.reject(new Error('invalid_process'));
            }
            return;
        }
        this._killTimer(taskInfo);
        taskInfo.status = 'doing';
        this._runningNum ++;
        this._debug('running %d', this._runningNum);
        process(taskInfo.request).then(data => {
            this._runningNum --;
            taskInfo.status = 'finish';
            if (taskInfo.resolve) {
                taskInfo.resolve(data);
            }
            if (taskInfo.request.requestId) {
                let i = this._taskList.length;
                while (i--) {
                    let curTaskInfo = this._taskList[i];
                    if (curTaskInfo.request.requestId === taskInfo.request.requestId) {
                        curTaskInfo.status = 'early_return';
                        if (curTaskInfo.resolve) {
                            curTaskInfo.resolve(data);
                        }
                        this._killTimer(curTaskInfo);
                        this._taskList.splice(i, 1);
                    }
                }
            }
            this._checkQueue();
        }).catch(error => {
            this._runningNum --;
            taskInfo.status = 'finish';
            if (taskInfo.reject) {
                taskInfo.reject(error);
            }
            if (taskInfo.request.requestId) {
                let i = this._taskList.length;
                while (i--) {
                    let curTaskInfo = this._taskList[i];
                    if (curTaskInfo.request.requestId === taskInfo.request.requestId) {
                        curTaskInfo.status = 'early_return';
                        if (curTaskInfo.reject) {
                            curTaskInfo.reject(error);
                        }
                        this._killTimer(curTaskInfo);
                        this._taskList.splice(i, 1);
                    }
                }
            }
            this._checkQueue();
        });
    }
    _indexOfTask(msgId) {
        for (let i = 0; i < this._taskList.length; i++) {
            let item = this._taskList[i];
            if (msgId === item.msgid) {
                return i;
            }
        }
        return -1;
    }
    _removeTask (msgId) {
        let i = this._indexOfTask(msgId);
        if (i < 0 || i >= this._taskList.length) {
            return;
        }
        this._taskList.splice(i, 1);
    }
    _killTimer(taskInfo) {
        if (taskInfo.acquireTimer) {
            clearTimeout(taskInfo.acquireTimer);
            taskInfo.acquireTimer = null;
        }
    }
};
