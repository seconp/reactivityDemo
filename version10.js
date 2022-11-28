/**
 * 目前只是一个简单的处理响应式数据的程序。
 */
let tmp1, tmp2;
let data = {foo: 1, bar: 2};
export const obj = new Proxy(data, {
  get(target, key){
    track(target, key);
    // print(bucket, target);
    // 继续正常返回属性值
    return target[key];
  },
  set(target, key, newVal){
    // 第一步首先是人家设置以后，先让人家设置成功
    target[key] = newVal;
    // 然后将该属性对应的副作用函数都取出来一一执行。
    trigger(target, key);
    return true;
  }
})

// 用一个全局变量储存被注册的副作用函数
let activeEffect;
const effectStack = [];
const bucket = new WeakMap();
// effect函数用来注册副作用函数
export function effect(fn, options = {}){
  // 在函数作用域中设置函数变量effectFn，这里不能使用var声明符
  // 将effectFn作为副作用函数(通过effectFn调用fn)
  const effectFn = () => {
    // console.log('effectFn is runing!');
    cleanUp(effectFn);
    activeEffect = effectFn;
    effectStack.push(effectFn);
    // 这里的fn是真正的副作用函数，外层的effectFn也好，effect也好都是基于fn封装的副作用函数
    // 使用的是外观模式，好处：在调用副作用函数的时候只需要调用effectFn就行，解耦合。缺点：修改副作用函数的时候需要修改effectFn，违反了开闭原则
    const res = fn();
    effectStack.pop();
    activeEffect = effectStack[effectStack.length - 1];
    // 将res作为fn函数的返回值
    return res;
  }
  // 记录用户自定义选项
  effectFn.options = options;
  // 这个数组用来记录和effectFn相关联的target.key对应的集合。
  effectFn.deps = [];
  // 执行effectFn
  if (!options.lazy) {
    effectFn();
  }
  // 返回副作用函数
  return effectFn
}

export function track(target, key) {
  // fn直接执行，没有通过effect执行，直接return。
  if (!activeEffect) return ;
  // 获取target里面被监听的属性
  let depsMap = bucket.get(target);
  // 如果bucket中对应的target不存在说明现在是第一次读取该对象，那就将该对象直接添加进去吧。
  // 添加的操作说明target需要被监听，但是现在还没有确定是target的哪个key需要被监听。
  if (!depsMap) {
    bucket.set(target, (depsMap = new Map()));
  }
  // 获取target.key对应的副作用函数，也就是在哪个函数里面读取了target.key
  let deps = depsMap.get(key);
  // 如果deps不存在说明target.key是第一次被读取。
  // 有可能是上下文之前在操作target的其他key，有可能是上下文第一次操作target.key。
  if (!deps) {
    depsMap.set(key, (deps = new Set()));
  }
  // 将target.key对应的副作用函数记录在set集合中
  deps.add(activeEffect);
  // 这里将记录与副作用函数相关联的target.key对应的集合
  activeEffect.deps.push(deps);
}
export function trigger(target, key) {
  // 获取监听的targe对象对应的属性
  const depsMap = bucket.get(target);
  // 如果这个对象不需要被监听
  if (!depsMap) return ;
  // 根据监听的key获取target.key对应的副作用函数
  const effects = depsMap.get(key);
  // 将effects集合拷贝下来
  const effectsToRun = new Set();
  effects && effects.forEach(effectFn => {
    if (effectFn !== activeEffect) {
      effectsToRun.add(effectFn);
    }
  })
  // 遍历另外一个集合，但是执行本集合下的副作用函数，避免死循环
  effectsToRun.forEach(effectFn => {
    // 如果存在用户自定义函数，调用用户自定义函数。其中用户自定义函数的参数是副作用函数
    if (effectFn.options.scheduler) {
      effectFn.options.scheduler(effectFn);
    } else {
      effectFn();
    }
  });
  // effects && effects.forEach(fn => fn());
}
// 从effectFn相关联的target.key对应的副作用函数集合中将effectFn删除
export function cleanUp(effectFn) {
  for (let i = 0; i < effectFn.deps.length; i++) {
    const deps = effectFn.deps[i];
    deps.delete(effectFn);
  }
  // 上面的操作从每个与之相关的集合中删除了effectFn，但是相关联的集合还在，下面就是重置effectFn数组，将相关的集合置为空
  effectFn.deps.length = 0;
}
// 上面是响应式系统的实现
//-------------------------------------------------//
// 下面是控制用户自定义函数fn执行次数的jobQueue

// 定义一个set记录用户自定义函数fn，利用了set自动去重的特性保证同一个函数只会在set中出现一次。
const jobQueue = new Set();
// 定义一个状态为fullfilled的promise实例。将jibQueue的执行过程当做微任务处理。
const p = Promise.resolve();

// 设置一个标志用来判断是否需要将onFullfilled处理函数压入队列
let isFlushing = false;

let flush = function flushJob(){
  // 如果isFlushing为true，直接返回函数
  if(isFlushing) return;
  // 在这里将isFlushing设置为true，如果obj.foo++执行两次的话(代码参考下面obj.foo++)，不会每一次都去设置一个微任务。
  isFlushing = true;
  // 添加微任务
  p.then(() => {
    jobQueue.forEach(job => job());
  }).finally(() => {
    // 当对应的jobQueue函数(也就是对应的微任务)执行完之后，设置为false
    isFlushing = false;
  })

}

//-------------------------------------------------//
// 下面是响应式系统的测试即用户编辑的代码
// const effectFn = effect(() => obj.foo + obj.bar, { lazy: true });
// console.log(effectFn());

// module.exports = {
//   effect: effect,
//   obj: obj,
//   track: track,
//   trigger: trigger
// }

