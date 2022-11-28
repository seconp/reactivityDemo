const map = new Map();
const weakmap = new WeakMap();
let a =1;

function fn() {
  const foo = {foo: 1};
  const bar = {bar: 2};

  map.set(foo, 1);
  map.set(bar, 2)
  weakmap.set(bar, 2)
  return bar;
}

bb = fn();

console.log(map);
console.log(weakmap.get(bar));
