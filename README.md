# waiting-queue
waiting queue  
等待队列：等待队列通过控制到处理模块的并发数  缓解压力以防止业务模块雪崩    
目标：以此来缓解瞬时请求压力过大 造成大面积拒绝 比如 处理用户整点的闹钟请求

[![NPM version][npm-image]][npm-url]
[![npm download][download-image]][download-url]
[![David deps][david-image]][david-url]

[npm-image]: https://img.shields.io/npm/v/waiting-queue.svg
[npm-url]: https://npmjs.com/package/waiting-queue
[download-image]: https://img.shields.io/npm/dm/waiting-queue.svg
[download-url]: https://npmjs.com/package/waiting-queue
[david-image]: https://img.shields.io/david/imcooder/waiting-queue.svg
[david-url]: https://david-dm.org/imcooder/waiting-queue

# use
npm install waiting-queue

## create
- new WaitingQueue(opt);
    - opt.concurrent 处理的并发度， 超过该值 则进入排队
    - opt.process(request) 请求处理函数
- waitQueue.add(request);
    - request.acquireTimeout 等待处理的超时时间 从进入队列 到进入处理逻辑  默认5s
    - request.requestId (optional) 优化请求，避免重复请求  为空则每个逻辑都会处理  非空 当请求处理完成后（或者失败）则队列中requestId的也直接使用响应
    - request.process(request) 请求处理， 由于有requestId的逻辑 所以request和callback并不一一对应 
    > request.process优先级大于opt.callback
```
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
```
