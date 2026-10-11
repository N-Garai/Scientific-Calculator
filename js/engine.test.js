const assert = require("assert");
const E = require("./engine.js");

function T() {
  return Array.prototype.slice.call(arguments);
}
function n(v) {
  return E.tok("num", String(v));
}
function op(v) {
  return E.tok("op", v);
}
function pre(v) {
  return E.tok("pre", v);
}
function post(v) {
  return E.tok("post", v);
}
function c(v) {
  return E.tok("const", v);
}
function lp() {
  return E.tok("lparen");
}
function rp() {
  return E.tok("rparen");
}
function comma() {
  return E.tok("comma");
}
function fn(v) {
  return E.tok("fn", v);
}

function ev(tokens, ctx) {
  return E.evaluate(tokens, ctx || { angle: "deg", ans: 0, vars: { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, M: 0, X: 0, Y: 0 } }).value;
}

function approx(a, b, eps) {
  eps = eps == null ? 1e-9 : eps;
  assert.ok(Math.abs(a - b) < eps, a + " !~= " + b);
}

function throwsMath(fn) {
  assert.throws(fn, (err) => err.name === "MathError");
}
function throwsSyn(fn) {
  assert.throws(fn, (err) => err.name === "SyntaxError");
}

approx(ev(T(n(2), op("+"), n(3), op("*"), n(4))), 14);
approx(ev(T(n(2), op("^"), n(3), op("^"), n(2))), 512);
approx(ev(T(n(7), op("-"), n(3), op("-"), n(2))), 2);
approx(ev(T(n(8), op("/"), n(2), op("/"), n(2))), 2);
approx(ev(T(pre("sin"), n(30))), 0.5);
approx(ev(T(pre("cos"), n(60))), 0.5);
approx(ev(T(pre("tan"), n(45))), 1);
approx(ev(T(n(2), pre("sin"), n(30))), 1);
approx(ev(T(pre("sin"), n(2), c("pi")), { angle: "rad", ans: 0, vars: {} }), 0);
approx(ev(T(n(2), c("pi"))) / (2 * E.PI), 1);
approx(ev(T(n(5), post("fact"))), 120);
approx(ev(T(n(0), post("fact"))), 1);
approx(ev(T(n(5), op("nPr"), n(2))), 20);
approx(ev(T(n(5), op("nCr"), n(2))), 10);
approx(ev(T(pre("sqrt"), n(16))), 4);
approx(ev(T(n(3), op("nroot"), n(8))), 2);
approx(ev(T(n(9), post("sq"))), 81);
approx(ev(T(n(2), post("cube"))), 8);
approx(ev(T(n(4), post("inv"))), 0.25);
approx(ev(T(pre("log"), n(100))), 2);
approx(ev(T(pre("ln"), c("e"))), 1);
approx(ev(T(pre("10^"), n(3))), 1000);
approx(ev(T(pre("neg"), n(2), post("sq"))), -4);
approx(ev(T(lp(), pre("neg"), n(2), rp(), post("sq"))), 4);
approx(ev(T(n(200), op("+"), n(20), op("%"))), 240);
approx(ev(T(n(200), op("*"), n(20), op("%"))), 40);
approx(ev(T(n(2), op("frac"), n(4))), 0.5);
approx(ev(T(n(1), op("frac"), n(2), op("frac"), n(4))), 1.5);
approx(ev(T(pre("asin"), n(0.5))), 30);
approx(ev(T(n(2), op("*"), lp(), n(3), op("+"), n(4), rp())), 14);
approx(ev(T(lp(), n(2), op("+"), n(3), rp(), lp(), n(4), op("+"), n(1), rp())), 25);

const ctx = { angle: "deg", ans: 0, vars: { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, M: 0, X: 0, Y: 0 } };
const pol = E.evaluate(T(fn("pol"), lp(), n(3), comma(), n(4), rp()), ctx);
approx(pol.value, 5);
approx(ctx.vars.Y, (Math.atan2(4, 3) * 180) / Math.PI, 1e-8);

throwsMath(() => ev(T(n(1), op("/"), n(0))));
throwsMath(() => ev(T(pre("sqrt"), pre("neg"), n(4))));
throwsMath(() => ev(T(pre("log"), n(0))));
throwsMath(() => ev(T(n(70), post("fact"))));
throwsSyn(() => ev(T(n(2), op("+"))));
throwsSyn(() => ev(T()));

const st = E.statsClear();
E.statsAdd(st, 2);
E.statsAdd(st, 4);
E.statsAdd(st, 6);
approx(E.statsMean(st), 4);
approx(E.statsPopSd(st), Math.sqrt(8 / 3));
approx(E.statsSampleSd(st), 2);

assert.strictEqual(E.applyDisplayFormat(0.005, { norm: 1 }), "5×10^-3");
assert.ok(E.applyDisplayFormat(0.005, { norm: 2 }).indexOf("0.005") !== -1);
assert.strictEqual(E.applyDisplayFormat(100 / 7, { fix: 3 }), "14.286");

const fr = E.decimalToFraction(0.5, false);
assert.strictEqual(E.formatFraction(fr), "1⌟2");

console.log("All engine tests passed.");
