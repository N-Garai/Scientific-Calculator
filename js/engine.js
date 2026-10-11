/**
 * Casio fx-82MS–style expression engine.
 * Tokens in, value (and extras) out. Safe to use in the browser and Node.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.CalcEngine = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var PI = 3.1415926535898;
  var E = 2.71828182845904;
  var MAX_FACT = 69;

  function MathError(message) {
    this.name = "MathError";
    this.message = message || "Math ERROR";
  }
  MathError.prototype = Object.create(Error.prototype);

  function SyntaxErrorCalc(message) {
    this.name = "SyntaxError";
    this.message = message || "Syntax ERROR";
  }
  SyntaxErrorCalc.prototype = Object.create(Error.prototype);

  var TOKEN_TEXT = {
    "+": "+",
    "-": "−",
    "*": "×",
    "/": "÷",
    "^": "^",
    frac: "⌟",
    nPr: "P",
    nCr: "C",
    nroot: "ˣ√",
    "%": "%",
    sq: "²",
    cube: "³",
    inv: "⁻¹",
    fact: "!",
    dms: "°",
    sin: "sin ",
    cos: "cos ",
    tan: "tan ",
    asin: "sin⁻¹ ",
    acos: "cos⁻¹ ",
    atan: "tan⁻¹ ",
    sinh: "sinh ",
    cosh: "cosh ",
    tanh: "tanh ",
    asinh: "sinh⁻¹ ",
    acosh: "cosh⁻¹ ",
    atanh: "tanh⁻¹ ",
    log: "log ",
    ln: "ln ",
    sqrt: "√",
    cbrt: "³√",
    "10^": "10^",
    "e^": "e^",
    neg: "(−)",
    rnd: "Rnd(",
    pol: "Pol(",
    rec: "Rec(",
    abs: "Abs(",
    pi: "π",
    e: "e",
    ans: "Ans",
    lparen: "(",
    rparen: ")",
    comma: ",",
  };

  function tok(type, value) {
    return { type: type, value: value };
  }

  function tokenToText(t) {
    if (!t) return "";
    if (t.type === "num") return t.value;
    if (t.type === "var") return t.value;
    if (t.type === "const") return TOKEN_TEXT[t.value] || t.value;
    if (t.type === "pre") return TOKEN_TEXT[t.value] || t.value;
    if (t.type === "post") return TOKEN_TEXT[t.value] || t.value;
    if (t.type === "op") return TOKEN_TEXT[t.value] || t.value;
    if (t.type === "fn") return TOKEN_TEXT[t.value] || t.value;
    if (t.type === "lparen") return "(";
    if (t.type === "rparen") return ")";
    if (t.type === "comma") return ",";
    return "";
  }

  function tokensToString(tokens) {
    return tokens.map(tokenToText).join("");
  }

  function cloneTokens(tokens) {
    return tokens.map(function (t) {
      return { type: t.type, value: t.value };
    });
  }

  function toRad(x, angle) {
    if (angle === "rad") return x;
    if (angle === "gra") return (x * PI) / 200;
    return (x * PI) / 180;
  }

  function fromRad(x, angle) {
    if (angle === "rad") return x;
    if (angle === "gra") return (x * 200) / PI;
    return (x * 180) / PI;
  }

  function almostInt(x) {
    return Math.abs(x - Math.round(x)) < 1e-10;
  }

  function requireFinite(x) {
    if (typeof x !== "number" || !isFinite(x)) throw new MathError();
    return x;
  }

  function factorial(n) {
    if (!almostInt(n) || n < 0 || n > MAX_FACT) throw new MathError();
    n = Math.round(n);
    var f = 1;
    for (var i = 2; i <= n; i++) f *= i;
    return f;
  }

  function permutation(n, r) {
    if (!almostInt(n) || !almostInt(r) || n < 0 || r < 0 || r > n) throw new MathError();
    n = Math.round(n);
    r = Math.round(r);
    var p = 1;
    for (var i = 0; i < r; i++) p *= n - i;
    return p;
  }

  function combination(n, r) {
    if (!almostInt(n) || !almostInt(r) || n < 0 || r < 0 || r > n) throw new MathError();
    n = Math.round(n);
    r = Math.round(r);
    r = Math.min(r, n - r);
    var c = 1;
    for (var i = 1; i <= r; i++) c = (c * (n - r + i)) / i;
    return Math.round(c);
  }

  function gcd(a, b) {
    a = Math.abs(a);
    b = Math.abs(b);
    while (b) {
      var t = b;
      b = a % b;
      a = t;
    }
    return a || 1;
  }

  function decimalToFraction(x, mixed) {
    if (!isFinite(x)) throw new MathError();
    var sign = x < 0 ? -1 : 1;
    x = Math.abs(x);
    var whole = Math.floor(x + 1e-14);
    var frac = x - whole;
    if (frac < 1e-12) {
      return { sign: sign, whole: whole, num: 0, den: 1, mixed: mixed };
    }
    var eps = 1e-10;
    var a = 0,
      b = 1,
      c = 1,
      d = 0;
    var bestN = 1,
      bestD = 1,
      bestErr = Infinity;
    while (b <= 10000 && d <= 10000) {
      var medN = a + c;
      var medD = b + d;
      var med = medN / medD;
      var err = Math.abs(frac - med);
      if (err < bestErr) {
        bestErr = err;
        bestN = medN;
        bestD = medD;
      }
      if (err < eps) {
        bestN = medN;
        bestD = medD;
        break;
      }
      if (frac > med) {
        a = medN;
        b = medD;
      } else {
        c = medN;
        d = medD;
      }
    }
    var g = gcd(bestN, bestD);
    bestN /= g;
    bestD /= g;
    if (mixed && whole > 0) {
      return { sign: sign, whole: whole, num: bestN, den: bestD, mixed: true };
    }
    return {
      sign: sign,
      whole: 0,
      num: whole * bestD + bestN,
      den: bestD,
      mixed: false,
    };
  }

  function formatFraction(fr) {
    var s = fr.sign < 0 ? "-" : "";
    if (fr.num === 0) return s + String(fr.whole);
    if (fr.mixed && fr.whole > 0) return s + fr.whole + "⌟" + fr.num + "⌟" + fr.den;
    return s + fr.num + "⌟" + fr.den;
  }

  function dmsToDecimal(parts) {
    var d = parts[0] || 0;
    var m = parts[1] || 0;
    var s = parts[2] || 0;
    var sign = d < 0 ? -1 : 1;
    return sign * (Math.abs(d) + Math.abs(m) / 60 + Math.abs(s) / 3600);
  }

  function decimalToDms(x) {
    var sign = x < 0 ? -1 : 1;
    x = Math.abs(x);
    var d = Math.floor(x);
    var minF = (x - d) * 60;
    var m = Math.floor(minF + 1e-10);
    var s = (minF - m) * 60;
    if (s < 0) s = 0;
    if (Math.abs(s - 60) < 1e-8) {
      s = 0;
      m += 1;
    }
    if (m >= 60) {
      m = 0;
      d += 1;
    }
    s = Math.round(s * 100) / 100;
    return (sign < 0 ? "-" : "") + d + "°" + m + "'" + s.toFixed(2).replace(/\.?0+$/, "") + '"';
  }

  function applyDisplayFormat(x, setup) {
    if (!isFinite(x)) throw new MathError();
    if (x === 0) {
      if (setup.fix != null) return (0).toFixed(setup.fix);
      return "0";
    }
    var ax = Math.abs(x);
    var sign = x < 0 ? "-" : "";

    if (setup.fix != null) {
      return x.toFixed(setup.fix);
    }
    if (setup.sci != null) {
      var n = setup.sci;
      var exp = Math.floor(Math.log(ax) / Math.LN10);
      var mant = x / Math.pow(10, exp);
      var mStr = mant.toFixed(Math.max(0, n - 1));
      var mNum = Number(mStr);
      if (Math.abs(mNum) >= 10) {
        mNum /= 10;
        exp += 1;
        mStr = mNum.toFixed(Math.max(0, n - 1));
      }
      return mStr + "×10^" + exp;
    }

    var useSci;
    if (setup.norm === 2) {
      useSci = ax >= 1e10 || ax < 1e-9;
    } else {
      useSci = ax >= 1e10 || ax < 1e-2;
    }
    if (useSci) {
      var e2 = Math.floor(Math.log(ax) / Math.LN10);
      var man2 = x / Math.pow(10, e2);
      var manStr = man2.toPrecision(10).replace(/\.?0+$/, "");
      if (manStr.indexOf("e") !== -1) {
        return Number(x).toExponential(9).replace("e+", "×10^").replace("e-", "×10^-");
      }
      return manStr + "×10^" + e2;
    }
    var prec = parseFloat(x.toPrecision(10));
    var str = String(prec);
    if (str.indexOf("e") !== -1) {
      return prec.toFixed(10).replace(/\.?0+$/, "");
    }
    return str;
  }

  function round10(x) {
    if (x === 0) return 0;
    return parseFloat(Number(x).toPrecision(10));
  }

  function wrap(value, extra) {
    extra = extra || {};
    extra.value = requireFinite(value);
    return extra;
  }

  function Parser(tokens, ctx) {
    this.tokens = tokens;
    this.i = 0;
    this.ctx = ctx;
  }

  Parser.prototype.peek = function () {
    return this.tokens[this.i] || null;
  };

  Parser.prototype.next = function () {
    return this.tokens[this.i++] || null;
  };

  Parser.prototype.expect = function (type, value) {
    var t = this.next();
    if (!t || t.type !== type || (value != null && t.value !== value)) {
      throw new SyntaxErrorCalc();
    }
    return t;
  };

  Parser.prototype.parse = function () {
    if (!this.tokens.length) throw new SyntaxErrorCalc();
    var v = this.parseAdd();
    if (this.peek()) throw new SyntaxErrorCalc();
    return v;
  };

  Parser.prototype.parseAdd = function () {
    var left = this.parseMul();
    var t = this.peek();
    while (t && t.type === "op" && (t.value === "+" || t.value === "-")) {
      this.next();
      var right = this.parseMul();
      var lv = left.value;
      var rv = right.value;
      if (right.percent && !left.percent) {
        rv = lv * (right.rawPercent / 100);
      }
      left = wrap(t.value === "+" ? lv + rv : lv - rv);
      t = this.peek();
    }
    return left;
  };

  Parser.prototype.parseMul = function () {
    var left = this.parseComb();
    var t = this.peek();
    while (t && t.type === "op" && (t.value === "*" || t.value === "/")) {
      this.next();
      var right = this.parseComb();
      var lv = left.value;
      var rv = right.percent ? right.rawPercent / 100 : right.value;
      if (t.value === "*") left = wrap(lv * rv);
      else {
        if (rv === 0) throw new MathError();
        left = wrap(lv / rv);
      }
      t = this.peek();
    }
    return left;
  };

  Parser.prototype.parseComb = function () {
    var left = this.parseImplB();
    var t = this.peek();
    while (t && t.type === "op" && (t.value === "nPr" || t.value === "nCr")) {
      this.next();
      var right = this.parseImplB();
      var n = left.value;
      var r = right.value;
      left = wrap(t.value === "nPr" ? permutation(n, r) : combination(n, r));
      t = this.peek();
    }
    return left;
  };

  Parser.prototype.startsTypeB = function (t) {
    if (!t) return false;
    return t.type === "pre" || t.type === "fn";
  };

  Parser.prototype.parseImplB = function () {
    var left = this.parseTypeB();
    while (this.startsTypeB(this.peek())) {
      var right = this.parseTypeB();
      left = wrap(left.value * right.value);
    }
    return left;
  };

  Parser.prototype.parseTypeB = function () {
    var prefixes = [];
    while (this.peek() && this.peek().type === "pre") {
      prefixes.push(this.next().value);
    }
    var val = this.parseImplConst();
    for (var i = prefixes.length - 1; i >= 0; i--) {
      val = wrap(this.applyPrefix(prefixes[i], val.value));
    }
    return val;
  };

  Parser.prototype.startsHighImplied = function (t) {
    if (!t) return false;
    if (t.type === "lparen" || t.type === "const" || t.type === "var" || t.type === "fn") return true;
    return false;
  };

  Parser.prototype.parseImplConst = function () {
    var left = this.parseFrac();
    while (this.startsHighImplied(this.peek())) {
      var right = this.parseFrac();
      left = wrap(left.value * right.value);
    }
    return left;
  };

  Parser.prototype.parseDms = function () {
    var base = this.parsePower();
    if (!this.peek() || this.peek().type !== "post" || this.peek().value !== "dms") {
      return base;
    }
    var parts = [base.value];
    while (this.peek() && this.peek().type === "post" && this.peek().value === "dms") {
      this.next();
      var t = this.peek();
      if (t && t.type === "num") {
        this.next();
        var v = Number(t.value);
        if (!isFinite(v)) throw new SyntaxErrorCalc();
        parts.push(v);
      } else {
        break;
      }
    }
    if (parts.length === 1) return wrap(parts[0]);
    return wrap(dmsToDecimal(parts.slice(0, 3)));
  };

  Parser.prototype.parseFrac = function () {
    var left = this.parseDms();
    while (this.peek() && this.peek().type === "op" && this.peek().value === "frac") {
      this.next();
      var mid = this.parseDms();
      if (this.peek() && this.peek().type === "op" && this.peek().value === "frac") {
        this.next();
        var den = this.parseDms();
        if (den.value === 0) throw new MathError();
        left = wrap(left.value + mid.value / den.value);
      } else {
        if (mid.value === 0) throw new MathError();
        left = wrap(left.value / mid.value);
      }
    }
    return left;
  };

  Parser.prototype.parsePower = function () {
    var left = this.parsePostfix();
    var t = this.peek();
    if (t && t.type === "op" && t.value === "^") {
      this.next();
      var right = this.parsePower();
      if (left.value < 0 && !almostInt(right.value)) throw new MathError();
      var p = Math.pow(left.value, right.value);
      if (!isFinite(p)) throw new MathError();
      return wrap(p);
    }
    if (t && t.type === "op" && t.value === "nroot") {
      this.next();
      var radicand = this.parsePower();
      var n = left.value;
      if (n === 0) throw new MathError();
      if (radicand.value < 0 && almostInt(n) && Math.round(n) % 2 === 0) throw new MathError();
      if (radicand.value < 0 && !almostInt(n)) throw new MathError();
      var root;
      if (radicand.value < 0) {
        root = -Math.pow(-radicand.value, 1 / n);
      } else {
        root = Math.pow(radicand.value, 1 / n);
      }
      if (!isFinite(root)) throw new MathError();
      return wrap(root);
    }
    return left;
  };

  Parser.prototype.parsePostfix = function () {
    var val = this.parsePrimary();
    while (this.peek() && ((this.peek().type === "post" && this.peek().value !== "dms") || (this.peek().type === "op" && this.peek().value === "%"))) {
      var t = this.next();
      if (t.type === "op" && t.value === "%") {
        val = {
          value: val.value / 100,
          percent: true,
          rawPercent: val.value,
        };
      } else {
        val = wrap(this.applyPostfix(t.value, val.value));
      }
    }
    return val;
  };

  Parser.prototype.parsePrimary = function () {
    var t = this.peek();
    if (!t) throw new SyntaxErrorCalc();

    if (t.type === "num") {
      this.next();
      var n = Number(t.value);
      if (!isFinite(n)) throw new SyntaxErrorCalc();
      return wrap(n);
    }
    if (t.type === "const") {
      this.next();
      if (t.value === "pi") return wrap(PI);
      if (t.value === "e") return wrap(E);
      if (t.value === "ans") return wrap(this.ctx.ans);
      throw new SyntaxErrorCalc();
    }
    if (t.type === "var") {
      this.next();
      var name = t.value;
      if (this.ctx.vars[name] == null) return wrap(0);
      return wrap(this.ctx.vars[name]);
    }
    if (t.type === "fn") {
      this.next();
      this.expect("lparen");
      var a = this.parseAdd();
      this.expect("comma");
      var b = this.parseAdd();
      this.expect("rparen");
      if (t.value === "pol") {
        var x = a.value;
        var y = b.value;
        var r = Math.sqrt(x * x + y * y);
        var th = fromRad(Math.atan2(y, x), this.ctx.angle);
        this.ctx.vars.X = r;
        this.ctx.vars.Y = th;
        return wrap(r, { polar: { r: r, theta: th } });
      }
      if (t.value === "rec") {
        var rr = a.value;
        var theta = toRad(b.value, this.ctx.angle);
        var xx = rr * Math.cos(theta);
        var yy = rr * Math.sin(theta);
        this.ctx.vars.X = xx;
        this.ctx.vars.Y = yy;
        return wrap(xx, { rect: { x: xx, y: yy } });
      }
      throw new SyntaxErrorCalc();
    }
    if (t.type === "lparen") {
      this.next();
      var inner = this.parseAdd();
      this.expect("rparen");
      return inner;
    }
    throw new SyntaxErrorCalc();
  };

  Parser.prototype.applyPrefix = function (name, x) {
    var a = this.ctx.angle;
    switch (name) {
      case "neg":
        return -x;
      case "sin":
        return trigSin(x, a);
      case "cos":
        return trigCos(x, a);
      case "tan":
        return trigTan(x, a);
      case "asin":
        if (x < -1 || x > 1) throw new MathError();
        return fromRad(Math.asin(x), a);
      case "acos":
        if (x < -1 || x > 1) throw new MathError();
        return fromRad(Math.acos(x), a);
      case "atan":
        return fromRad(Math.atan(x), a);
      case "sinh":
        return Math.sinh(x);
      case "cosh":
        return Math.cosh(x);
      case "tanh":
        return Math.tanh(x);
      case "asinh":
        return Math.asinh(x);
      case "acosh":
        if (x < 1) throw new MathError();
        return Math.acosh(x);
      case "atanh":
        if (x <= -1 || x >= 1) throw new MathError();
        return Math.atanh(x);
      case "log":
        if (x <= 0) throw new MathError();
        return Math.log(x) / Math.LN10;
      case "ln":
        if (x <= 0) throw new MathError();
        return Math.log(x);
      case "sqrt":
        if (x < 0) throw new MathError();
        return Math.sqrt(x);
      case "cbrt":
        return Math.cbrt(x);
      case "10^":
        return Math.pow(10, x);
      case "e^":
        return Math.exp(x);
      case "abs":
        return Math.abs(x);
      case "rnd":
        return round10(x);
      default:
        throw new SyntaxErrorCalc();
    }
  };

  Parser.prototype.applyPostfix = function (name, x) {
    switch (name) {
      case "sq":
        return x * x;
      case "cube":
        return x * x * x;
      case "inv":
        if (x === 0) throw new MathError();
        return 1 / x;
      case "fact":
        return factorial(x);
      case "dms":
        return x;
      default:
        throw new SyntaxErrorCalc();
    }
  };

  function nearMultiple(x, m) {
    var q = x / m;
    return Math.abs(q - Math.round(q)) < 1e-10;
  }

  function trigSin(x, angle) {
    var r = toRad(x, angle);
    if (nearMultiple(r, PI)) return 0;
    return Math.sin(r);
  }

  function trigCos(x, angle) {
    var r = toRad(x, angle);
    if (nearMultiple(r - PI / 2, PI)) return 0;
    return Math.cos(r);
  }

  function trigTan(x, angle) {
    var r = toRad(x, angle);
    if (nearMultiple(r - PI / 2, PI)) throw new MathError();
    if (nearMultiple(r, PI)) return 0;
    return Math.tan(r);
  }

  function evaluate(tokens, ctx) {
    ctx = ctx || {};
    ctx.ans = ctx.ans == null ? 0 : ctx.ans;
    ctx.angle = ctx.angle || "deg";
    ctx.vars = ctx.vars || { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, M: 0, X: 0, Y: 0 };
    var parser = new Parser(tokens, ctx);
    var result = parser.parse();
    result.value = requireFinite(result.value);
    return result;
  }

  function ranHash() {
    return Math.floor(Math.random() * 1000) / 1000;
  }

  function statsClear() {
    return { n: 0, sum: 0, sumsq: 0 };
  }

  function statsAdd(st, x) {
    st.n += 1;
    st.sum += x;
    st.sumsq += x * x;
    return st;
  }

  function statsMean(st) {
    if (st.n === 0) throw new MathError();
    return st.sum / st.n;
  }

  function statsPopSd(st) {
    if (st.n === 0) throw new MathError();
    var mean = st.sum / st.n;
    var v = st.sumsq / st.n - mean * mean;
    if (v < 0 && v > -1e-12) v = 0;
    if (v < 0) throw new MathError();
    return Math.sqrt(v);
  }

  function statsSampleSd(st) {
    if (st.n < 2) throw new MathError();
    var mean = st.sum / st.n;
    var v = (st.sumsq - (st.sum * st.sum) / st.n) / (st.n - 1);
    if (v < 0 && v > -1e-12) v = 0;
    if (v < 0) throw new MathError();
    return Math.sqrt(v);
  }

  function shiftEng(x, dir) {
    if (x === 0) return { value: 0, exp: 0, mant: 0 };
    var sign = x < 0 ? -1 : 1;
    var ax = Math.abs(x);
    var exp = Math.floor(Math.log(ax) / Math.LN10);
    var offset = ((exp % 3) + 3) % 3;
    var engExp = exp - offset;
    engExp += dir * 3;
    var mant = sign * ax / Math.pow(10, engExp);
    return { value: x, exp: engExp, mant: mant, display: formatEng(mant, engExp) };
  }

  function formatEng(mant, exp) {
    var m = parseFloat(mant.toPrecision(10));
    return m + "×10^" + exp;
  }

  return {
    PI: PI,
    E: E,
    MathError: MathError,
    SyntaxError: SyntaxErrorCalc,
    tok: tok,
    tokenToText: tokenToText,
    tokensToString: tokensToString,
    cloneTokens: cloneTokens,
    evaluate: evaluate,
    applyDisplayFormat: applyDisplayFormat,
    decimalToFraction: decimalToFraction,
    formatFraction: formatFraction,
    dmsToDecimal: dmsToDecimal,
    decimalToDms: decimalToDms,
    ranHash: ranHash,
    round10: round10,
    statsClear: statsClear,
    statsAdd: statsAdd,
    statsMean: statsMean,
    statsPopSd: statsPopSd,
    statsSampleSd: statsSampleSd,
    shiftEng: shiftEng,
    factorial: factorial,
    permutation: permutation,
    combination: combination,
  };
});
