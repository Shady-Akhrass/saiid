// ✅ Polyfill لـ stream module للمتصفح
// هذا يحل مشكلة xlsx-js-style التي تحاول استخدام stream.Readable

// ✅ إنشاء Readable class فارغ
class Readable {
  constructor() {
    // Empty implementation
  }
  pipe() {
    return this;
  }
  on() {
    return this;
  }
  once() {
    return this;
  }
  emit() {
    return this;
  }
  read() {
    return null;
  }
  push() {
    return true;
  }
  end() {
    return this;
  }
  destroy() {
    return this;
  }
}

// ✅ Export للاستخدام في xlsx-js-style
export { Readable };
export default { Readable };
