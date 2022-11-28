// 实现watch函数

// const { effect, obj, track, trigger } = require("./version10")
import { effect, obj, track, trigger } from './version10.js'

// source 是响应式数据，cb是回调函数
function watch(source, cb) {
  let getter
  if (typeof source === 'function') {
    getter = source
  } else {
    getter = () => traverse(source)
  }
  let oldValue, newValue
  // 使用effect注册副作用函数时，开启lazy选项，并把返回值储存到effectFn中以便后续手动调用
  const effectFn = effect(
    () => getter(),
    {
      lazy: true,
      scheduler() {
        // 在scheduler中重新执行副作用函数，得到的是新的值
        // 因为在触发scheduler的时候已经修改了target.key的值，去执行effectFn能够获取到修改后的值，修改后的值是通过traverse来获取到的。
        newValue = effectFn();
        // 这里仍然存在问题，因为obj只有一个，newvalue和oldValue最终都指向obj，这里传入的oldValue和newValue应该是相同的。
        // 将旧的值和新的值作为回调函数的参数
        cb(newValue, oldValue);
        // 更新旧值，不然下一次会得到错误的旧值。
        // 下次响应式数据变化的时候不会再运行watch函数。
        oldValue = newValue
      }
    }
  )
  // 手动调用副作用函数，拿到的值就是旧值
  oldValue = effectFn();
}

// 使用traverse遍历函数

function traverse (value, seen = new Set()) {
  // 如果读取的数据不是对象，或者已经被读取过了，或者值为空，那就什么都不做
  if (typeof value !== 'object' || value === null || seen.has(value)) {
    return ;
  }
  // 将读取到的数据添加到seen中，代表读取过了。
  seen.add(value);
  // 假设value能够通过forin语句遍历
  for (const k in value) {
    traverse(value[k], seen)
  }
  return value
}

/////////////////////////////////////////////

// 使用watch函数
watch(obj, ()=>{
  console.log('数据变化了!');
})

obj.foo ++
