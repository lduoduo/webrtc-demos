/**
 * 事件机制类
 * 后期扩展
 */

export default class Event {
  constructor() {
    this.listeners = {};
  }
  // 注册监听回调事件
  on(name, fn) {
    this.listeners[name] = fn;
  }
  // 执行回调
  emit(name, data) {
    this.listeners[name] && this.listeners[name](data);
  }
}
