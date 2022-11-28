let { effect, obj, track, trigger } = require('./version7')

function computed(getter) {
  let value;
  let dirty = true;
  // getter 就是用户自定义的副作用函数
  const effectFn = effect(getter, {
    lazy: true,
    // 每次修改obj.foo/bar的时候都会调用scheduler，将dirty改为true
    scheduler() {
      dirty = true;
      // 当用户修改compute内的getter的时候，手动调用trigger触发some.value依赖的副作用函数
      trigger(obj, 'value');
    }
  });

  const obj = {
    // 读取 value 的时候才执行 effectFn
    get value() {
      if (dirty) {
        value = effectFn();
        dirty = false;
      }
      // 当some读取value的时候手动创建依赖关系
      track(obj, 'value');
      return value;
    }
  }
  return obj;
}

let some = computed(() => obj.foo + obj.bar)
effect(() => {
  // 副作用函数中读取some.value
  console.log(some.value)
})

// 修改data.foo的值
// 此时obj.foo和obj.bar收集的是内层的副作用函数(即compute那一层的函数)，不会收集外层的副作用函数(即effect函数)。
obj.foo ++
