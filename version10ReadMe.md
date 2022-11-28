> 响应系统前一个版本 version.js 实现了什么？
>
> - 谁读取我(target.key)，我就要记录这个谁。
> - 修改我(target.key)，我就要调用所有的谁(上面记录的"这个谁")更新我。

---

上面的程序是有问题的：有时候有些属性的修改是不需要周知所有的副作用函数的，比如分支程序`obj.ok ? obj.text : 'not hello';`，当`obj.ok = false`的时候，`obj.text`怎么改变对程序来讲是没有意义的。

**为了解决修改某些属性导致不必要地 call 副作用函数的问题**，我们需要改写程序。将 version1.js 改写为 version2.js。

我们要怎么做呢？

来吧：首先确定哪些属性是不必要 call 副作用函数的呢？代码中不会被执行的属性。比如分支程序`obj.ok ? obj.text : 'not hello';`，当`obj.ok = false`的时候，`obj.text`就是不必要的属性。目前我们建立的依赖关系如图所示：

![image-20220509234544251](.\assets\img\image-20220509234544251.png)

为了确定重新运行的时候哪些属性是必要的，哪些是不必要的，我们可以在 set 属性(set 属性的话需要 call 所有的副作用函数)的时候重新建立依赖。因为 set 属性的时候是在当前副作用函数中 set 的(也就是说 set 带来的影响只会在当前副作用函数中)，所以只需要重新建立当前副作用函数和 target&key 之间的依赖关系。

因为 set 只会影响当前函数(当前的副作用函数)，所以现在我们需要建立的是这样一种依赖关系：
![image-20220509235545699](.\assets\img\image-20220509235545699.png)

怎样建立上面的依赖呢？

思路如下所示：

![image-20220509235856175](.\assets\img\image-20220509235856175.png)

Q：里面关于无限循环的问题我测试了一下，作者的思路并没有解决问题。maybe my fault.

---

上面的程序是有问题的：副作用函数的嵌套问题。

```js
effect(function effectFn1() {
  console.log("fn1 run!");

  effect(function effectFn2() {
    console.log("fn2 run!");
    // 读取bar，建立obj-->bar-->activeEffect(effetcFn2)的依赖关系
    tmp2 = obj.bar;
  });
  // 当读取obj.foo的时候会尝试建立obj-->foo-->effectfn1之间的依赖关系，但是由于是靠activeEffect记录的effectFn1并建立依赖关系
  // 运行到effectFn2的时候activeEffect被改为了effectFn2，所以在建立foo的依赖关系的时候会实obj-->foo-->activeEffect(effectFn2)
  tmp1 = obj.foo;
  // 尝试修改foo的值
  obj.foo = false;
});
```

打印结果：

![image-20220510003459228](.\assets\img\image-20220510003459228.png)

这样就不对啦~

原因是在执行内部的`effect`函数的时候`affectEffect`的值为内部的`effectFn`。再次调用`obj.foo`去执行的时候通过`deps.add(activeEffect)`这句代码会建立`obj-->foo-->内部effectFn`的关系。所以`set obj.foo`的时候也一定是调用的内部的`effectFn`。就会出现上面的结果。

我们的解决方案是使用一个栈记录当前 `activeEffectFn`。对应 `version3.js` 中对 `effect` 函数的修改部分。

但是发现如果读取 foo 之后修改 foo 的话会触发死循环。

解决方案是在 `trigger` 函数中将判断当前执行的 `effectFn` 是否和我要去调用的 `effectFn` (之前建立依赖的时候已经将这个 `effectFn` 对应的关系建立好了)是不是一个函数对象。如果是就别执行了。对应 `version3.js` 中的代码。

**But** 这种逻辑会出现一个问题，就是在 `effectFn` 里面先 `get` 然后 `set` 的话是没法在 `set` 的时候再去调用副作用函数的，因为判断出来 `effectFn` 和 `activeEffect` 是同一个函数。

```js
// 这段代码会产生bug
// 如果说是bug，也不算是。
// 因为函数在执行过程中是从上往下执行的。
effect(function effectFn1() {
  console.log(obj.foo); // 1
  obj.foo++; // 2
});
```

---

来吧，继续改进响应系统。

下面我们来自己尝试控制副作用函数的执行时机。

思路是为 effect 函数设计一个选项参数，允许用户指定调度时机：

```js
effect(effectFn, options); // effectFn是副作用函数，options里面有一个函数属性提供给用户自定义函数。
```

打印结果：

![image-20220512171638663](.\assets\img\image-20220512171638663.png)

---

过滤响应系统的中间状态。

思路：使用 set(利用 set 自带的去重特性)来记录用户自定义的 fn 函数。然后将该 set 的执行过程作为一个 microtask。

![image-20220512175354515](.\assets\img\image-20220512175354515.png)

---

上面解决问题的总结：允许指定 options 选项，例如使用调度器来控制副作用函数的执行时机和方式；也介绍了用来追踪和收集依赖的 track 函数，以及触发副作用函数重新执行的 trigger 函数。

下面我们来尝试模仿 Vue 中的 compute 属性。

为了将来能够将代码拆分为不同的模块，这里增加了 compute.js 文件，使用 effect 来构建 compute 函数。

lazy 属性使调用者在调用 effectFn 的时候再去执行用户自定义副作用函数 fn()。所以我们将 fn() 计算结果保存在 res 变量中，将 effectFn 函数作为返回值保存在常量值 effectFn 中。

为了减少性能损耗，我们可以考虑将 compute 的结果缓存起来。使用 dirty 来判断是否返回缓存值 value。

但是仍然存在问题：如 compute.js 中的代码所示，我们此时 obj.foo 和 obj.bar 收集的是内层的副作用函数(即 compute 那一层的函数)，不会收集外层的副作用函数(即 effect 函数)。

修改思路：在计算属性依赖的响应式数据变化的时候，手动调用 trigger 函数触发响应。当计算属性依赖的响应式数据被读取的时候，手动建立计算属性的副作用函数依赖关系。如 version6.js 所示。

---

接下来我们模拟实现 Vue 中的 watch 函数：

```js
// 使用方式，这里假设obj是一个响应式数据，使用watch观察他
watch(obj, () => {
  console.log("数据发生变化");
});

obj.foo++;
```

version7.js 实现了最简单的 watch 函数。只能对代理的对象进行监听。

---

现在硬编码了 obj.foo，意味着我们只能建立 foo 的依赖关系。为了让 watch 函数具有通用性，我们实现一个函数 traverse 遍历读取 obj。同时适配了函数和对象，source 不仅能够使函数也能是对象。

---

接下来使用 watch 记录响应式数据变化前后的值。

Q：这里的实现仍然有问题，在 watch.js 中监听的 obj 只有一个，newvalue 和 oldValue 最终都指向 obj，这里传入的 oldValue 和 newValue 应该是相同的。

---

之所以能够监听到新值和旧值，因为在调用`oldValue = effectFn()`的时候只做了建立依赖关系的工作。此时通过`effectFn() -> fn -> getter -> traverse`获取到了旧的 obj 的值，修改监听的数据之后，会调用 scheduler 函数，通过 `scheduler -> effectFn -> fn -> getter -> traverse` 获取修改后的新值。
