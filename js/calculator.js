(function () {
  "use strict";

  var Engine = window.CalcEngine;

  var KEY_MAP = {
    Digit0: "0",
    Digit1: "1",
    Digit2: "2",
    Digit3: "3",
    Digit4: "4",
    Digit5: "5",
    Digit6: "6",
    Digit7: "7",
    Digit8: "8",
    Digit9: "9",
    Numpad0: "0",
    Numpad1: "1",
    Numpad2: "2",
    Numpad3: "3",
    Numpad4: "4",
    Numpad5: "5",
    Numpad6: "6",
    Numpad7: "7",
    Numpad8: "8",
    Numpad9: "9",
    Period: ".",
    NumpadDecimal: ".",
    Enter: "=",
    NumpadEnter: "=",
    Equal: "=",
    Backspace: "DEL",
    Delete: "DEL",
    Escape: "AC",
    KeyP: "pi",
  };

  function Calc() {
    this.tokens = [];
    this.cursor = 0;
    this.shift = false;
    this.alpha = false;
    this.hyp = false;
    this.sto = false;
    this.rcl = false;
    this.error = null;
    this.overwrite = false;
    this.resultText = "0";
    this.ans = 0;
    this.angle = "deg";
    this.norm = 1;
    this.fix = null;
    this.sci = null;
    this.mixedFrac = true;
    this.fractionView = false;
    this.dmsView = false;
    this.eng = null;
    this.mode = "comp";
    this.modeMenu = 0;
    this.modeCycle = 0;
    this.vars = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, M: 0, X: 0, Y: 0 };
    this.stats = Engine.statsClear();
    this.history = [];
    this.histIndex = -1;
    this.justEvaluated = false;
    this.inputNum = "";
    this.buildingExp = false;
    this.dmsParts = null;

    this.el = {
      expr: document.getElementById("lcd-expr"),
      result: document.getElementById("lcd-result"),
      indicators: document.getElementById("lcd-indicators"),
      keys: document.getElementById("keypad"),
      modePanel: document.getElementById("mode-panel"),
      help: document.getElementById("help-panel"),
    };

    this.bind();
    this.restoreTheme();
    this.render();
  }

  Calc.prototype.ctx = function () {
    return {
      ans: this.ans,
      angle: this.angle,
      vars: this.vars,
    };
  };

  Calc.prototype.setup = function () {
    return { norm: this.norm, fix: this.fix, sci: this.sci };
  };

  Calc.prototype.bind = function () {
    var self = this;
    this.el.keys.addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-key]");
      if (!btn) return;
      self.onKey(btn.getAttribute("data-key"));
    });

    document.getElementById("theme-toggle").addEventListener("click", function () {
      self.toggleTheme();
    });
    document.getElementById("help-toggle").addEventListener("click", function () {
      self.el.help.classList.toggle("open");
    });
    document.getElementById("help-close").addEventListener("click", function () {
      self.el.help.classList.remove("open");
    });

    this.el.modePanel.addEventListener("click", function (e) {
      var opt = e.target.closest("[data-mode]");
      if (!opt) return;
      self.applyMode(opt.getAttribute("data-mode"), opt.getAttribute("data-value"));
    });

    document.addEventListener("keydown", function (e) {
      if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        self.el.help.classList.toggle("open");
        e.preventDefault();
        return;
      }
      if (e.key === "ArrowLeft") {
        self.moveCursor(-1);
        e.preventDefault();
        return;
      }
      if (e.key === "ArrowRight") {
        self.moveCursor(1);
        e.preventDefault();
        return;
      }
      if (e.key === "ArrowUp") {
        self.replay(-1);
        e.preventDefault();
        return;
      }
      if (e.key === "ArrowDown") {
        self.replay(1);
        e.preventDefault();
        return;
      }

      var opKeys = {
        "+": "+",
        "-": "-",
        "*": "*",
        "/": "/",
        "^": "^",
        "(": "(",
        ")": ")",
        ",": ",",
        "%": "%",
        "!": "fact",
      };
      if (opKeys[e.key] && !e.ctrlKey && !e.metaKey) {
        self.onKey(opKeys[e.key]);
        e.preventDefault();
        return;
      }
      var mapped = KEY_MAP[e.code];
      if (mapped) {
        self.onKey(mapped);
        e.preventDefault();
      }
    });
  };

  Calc.prototype.toggleTheme = function () {
    var next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("fx82-theme", next);
    } catch (e) {}
    document.getElementById("theme-toggle").setAttribute("aria-label", next === "dark" ? "Switch to light theme" : "Switch to dark theme");
  };

  Calc.prototype.restoreTheme = function () {
    var saved = null;
    try {
      saved = localStorage.getItem("fx82-theme");
    } catch (e) {}
    if (!saved) {
      saved = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    document.documentElement.setAttribute("data-theme", saved);
  };

  Calc.prototype.clearInputBuffer = function () {
    this.inputNum = "";
    this.buildingExp = false;
    this.dmsParts = null;
  };

  Calc.prototype.isBinaryOp = function (token) {
    if (!token || token.type !== "op") return false;
    return ["+", "-", "*", "/", "^", "nPr", "nCr", "nroot", "frac"].indexOf(token.value) !== -1;
  };

  Calc.prototype.beginEntryIfNeeded = function (token) {
    if (!this.justEvaluated) return;
    this.justEvaluated = false;
    this.fractionView = false;
    this.dmsView = false;
    this.eng = null;
    this.error = null;
    if (token && this.isBinaryOp(token)) {
      this.tokens = [Engine.tok("const", "ans")];
      this.cursor = 1;
      return;
    }
    this.tokens = [];
    this.cursor = 0;
  };

  Calc.prototype.insertToken = function (token) {
    this.beginEntryIfNeeded(token);
    this.flushNumber();
    this.tokens.splice(this.cursor, 0, token);
    this.cursor += 1;
    this.justEvaluated = false;
    this.error = null;
  };

  Calc.prototype.flushNumber = function () {
    if (!this.inputNum) return;
    var raw = this.inputNum;
    if (raw.charAt(raw.length - 1) === "e" || raw.slice(-2) === "e+" || raw.slice(-2) === "e-") {
      raw += "0";
    }
    this.tokens.splice(this.cursor, 0, Engine.tok("num", raw));
    this.cursor += 1;
    this.inputNum = "";
    this.buildingExp = false;
  };

  Calc.prototype.appendDigit = function (d) {
    this.beginEntryIfNeeded();
    this.error = null;
    this.fractionView = false;
    this.dmsView = false;
    this.eng = null;
    if (this.inputNum === "0" && d !== ".") this.inputNum = "";
    if (d === "." && this.inputNum.indexOf(".") !== -1 && !this.buildingExp) return;
    this.inputNum += d;
  };

  Calc.prototype.onKey = function (key) {
    if (this.error && key !== "AC" && key !== "DEL" && key !== "ON") {
      if (key !== "left" && key !== "right") return;
    }

    if (this.modeMenu && key !== "MODE" && key !== "AC" && key !== "ON") {
      this.handleModeMenuKey(key);
      this.render();
      return;
    }

    if (this.sto) {
      this.handleStore(key);
      this.render();
      return;
    }
    if (this.rcl && key !== "RCL") {
      this.handleRecall(key);
      this.render();
      return;
    }

    var shift = this.shift;
    var alpha = this.alpha;
    var hyp = this.hyp;
    this.shift = false;
    this.alpha = false;

    if (key === "SHIFT") {
      this.shift = !shift;
      this.alpha = false;
      this.render();
      return;
    }
    if (key === "ALPHA") {
      this.alpha = !alpha;
      this.shift = false;
      this.render();
      return;
    }
    if (key === "HYP") {
      this.hyp = !hyp;
      this.render();
      return;
    }

    if (alpha) {
      this.handleAlpha(key);
      this.render();
      return;
    }
    if (shift) {
      this.handleShift(key);
      this.render();
      return;
    }

    this.handleNormal(key, hyp);
    this.render();
  };

  Calc.prototype.handleNormal = function (key, hyp) {
    switch (key) {
      case "ON":
      case "AC":
        this.allClear();
        return;
      case "DEL":
        this.del();
        return;
      case "MODE":
        this.cycleModeMenu();
        return;
      case "left":
        this.moveCursor(-1);
        return;
      case "right":
        this.moveCursor(1);
        return;
      case "up":
        this.replay(-1);
        return;
      case "down":
        this.replay(1);
        return;
      case "=":
        this.equals();
        return;
      case "0":
      case "1":
      case "2":
      case "3":
      case "4":
      case "5":
      case "6":
      case "7":
      case "8":
      case "9":
        this.appendDigit(key);
        return;
      case ".":
        if (!this.inputNum) this.inputNum = "0";
        this.appendDigit(".");
        return;
      case "EXP":
        this.beginEntryIfNeeded();
        this.error = null;
        if (!this.inputNum) this.inputNum = "1";
        if (this.inputNum.toLowerCase().indexOf("e") !== -1) return;
        this.inputNum += "e";
        this.buildingExp = true;
        return;
      case "+":
      case "-":
      case "*":
      case "/":
      case "^":
        this.insertToken(Engine.tok("op", key));
        return;
      case "(":
        this.insertToken(Engine.tok("lparen"));
        return;
      case ")":
        this.flushNumber();
        this.insertToken(Engine.tok("rparen"));
        return;
      case ",":
        this.insertToken(Engine.tok("comma"));
        return;
      case "frac":
        this.insertToken(Engine.tok("op", "frac"));
        return;
      case "nCr":
        this.insertToken(Engine.tok("op", "nCr"));
        return;
      case "inv":
        this.flushNumber();
        this.insertToken(Engine.tok("post", "inv"));
        return;
      case "cube":
        this.flushNumber();
        this.insertToken(Engine.tok("post", "cube"));
        return;
      case "sq":
        this.flushNumber();
        this.insertToken(Engine.tok("post", "sq"));
        return;
      case "sqrt":
        this.insertToken(Engine.tok("pre", "sqrt"));
        return;
      case "log":
        this.insertToken(Engine.tok("pre", "log"));
        return;
      case "ln":
        this.insertToken(Engine.tok("pre", "ln"));
        return;
      case "neg":
        this.insertToken(Engine.tok("pre", "neg"));
        return;
      case "sin":
      case "cos":
      case "tan":
        this.insertToken(Engine.tok("pre", hyp ? key + "h" : key));
        this.hyp = false;
        return;
      case "pol":
        this.insertToken(Engine.tok("fn", "pol"));
        this.insertToken(Engine.tok("lparen"));
        return;
      case "dms":
        this.handleDms();
        return;
      case "RCL":
        this.flushNumber();
        this.rcl = true;
        return;
      case "ENG":
        this.applyEng(1);
        return;
      case "M+":
        this.memoryAdd(1);
        return;
      case "Ans":
        this.insertToken(Engine.tok("const", "ans"));
        return;
      case "DT":
        this.statData();
        return;
    }
  };

  Calc.prototype.handleShift = function (key) {
    switch (key) {
      case "AC":
      case "ON":
        this.allClear();
        this.resultText = "";
        this.el.result.textContent = "";
        return;
      case "DEL":
        this.overwrite = !this.overwrite;
        return;
      case "inv":
        this.flushNumber();
        this.insertToken(Engine.tok("post", "fact"));
        return;
      case "nCr":
        this.insertToken(Engine.tok("op", "nPr"));
        return;
      case "pol":
        this.insertToken(Engine.tok("fn", "rec"));
        this.insertToken(Engine.tok("lparen"));
        return;
      case "cube":
        this.insertToken(Engine.tok("pre", "cbrt"));
        return;
      case "frac":
        this.toggleFraction();
        return;
      case "sqrt":
        this.insertToken(Engine.tok("op", "nroot"));
        return;
      case "log":
        this.insertToken(Engine.tok("pre", "10^"));
        return;
      case "ln":
        this.insertToken(Engine.tok("pre", "e^"));
        return;
      case "sin":
        this.insertToken(Engine.tok("pre", this.hyp ? "asinh" : "asin"));
        this.hyp = false;
        return;
      case "cos":
        this.insertToken(Engine.tok("pre", this.hyp ? "acosh" : "acos"));
        this.hyp = false;
        return;
      case "tan":
        this.insertToken(Engine.tok("pre", this.hyp ? "atanh" : "atan"));
        this.hyp = false;
        return;
      case "(":
        this.insertToken(Engine.tok("op", "%"));
        return;
      case "RCL":
        this.flushNumber();
        this.sto = true;
        return;
      case "ENG":
        this.applyEng(-1);
        return;
      case ",":
        this.memoryAdd(-1);
        return;
      case "+":
        this.memoryAdd(1);
        return;
      case "0":
        this.insertToken(Engine.tok("pre", "rnd"));
        return;
      case ".":
        this.beginEntryIfNeeded();
        this.flushNumber();
        this.tokens.splice(this.cursor, 0, Engine.tok("num", String(Engine.ranHash())));
        this.cursor += 1;
        return;
      case "EXP":
        this.insertToken(Engine.tok("const", "pi"));
        return;
      case "Ans":
        this.insertToken(Engine.tok("pre", "abs"));
        this.insertToken(Engine.tok("lparen"));
        return;
      case "1":
        if (this.mode === "sd") this.showStat("sumsq");
        return;
      case "2":
        if (this.mode === "sd") this.showStat("sum");
        return;
      case "3":
        if (this.mode === "sd") this.showStat("n");
        return;
      case "4":
        if (this.mode === "sd") this.showStat("mean");
        return;
      case "5":
        if (this.mode === "sd") this.showStat("pop");
        return;
      case "6":
        if (this.mode === "sd") this.showStat("sample");
        return;
      case "MODE":
        this.stats = Engine.statsClear();
        this.resultText = "Scl";
        this.justEvaluated = true;
        return;
    }
  };

  Calc.prototype.handleAlpha = function (key) {
    var map = {
      neg: "A",
      dms: "B",
      HYP: "C",
      sq: "D",
      "^": "E",
      log: "F",
      ",": "M",
      pol: "X",
      cube: "Y",
      ln: "e",
    };
    if (key === "ln") {
      this.insertToken(Engine.tok("const", "e"));
      return;
    }
    if (map[key] && map[key] !== "e") {
      this.insertToken(Engine.tok("var", map[key]));
    }
  };

  Calc.prototype.handleStore = function (key) {
    this.sto = false;
    this.flushNumber();
    var names = { neg: "A", dms: "B", HYP: "C", sq: "D", "^": "E", log: "F", ",": "M", M: "M", "M+": "M", pol: "X", cube: "Y" };
    var name = names[key];
    if (!name) return;
    var value = this.ans;
    try {
      if (this.tokens.length || this.inputNum) {
        this.flushNumber();
        value = Engine.evaluate(this.tokens, this.ctx()).value;
      }
    } catch (e) {
      value = this.ans;
    }
    this.vars[name] = value;
    this.resultText = name + "=" + this.format(value);
    this.justEvaluated = true;
  };

  Calc.prototype.handleRecall = function (key) {
    this.rcl = false;
    var names = { neg: "A", dms: "B", HYP: "C", sq: "D", "^": "E", log: "F", ",": "M", M: "M", "M+": "M", pol: "X", cube: "Y", Ans: "ans" };
    if (key === "Ans") {
      this.insertToken(Engine.tok("const", "ans"));
      return;
    }
    var name = names[key];
    if (!name) return;
    this.insertToken(Engine.tok("var", name));
  };

  Calc.prototype.handleModeMenuKey = function (key) {
    if (key === "1" || key === "2" || key === "3") {
      if (this.modeMenu === 1) {
        if (key === "1") this.mode = "comp";
        if (key === "2") this.mode = "sd";
        if (key === "3") this.mode = "sd";
        this.modeMenu = 0;
        this.modeCycle = 0;
        this.resultText = this.mode === "sd" ? "SD" : "COMP";
        this.justEvaluated = true;
        return;
      }
      if (this.modeMenu === 2) {
        this.angle = key === "1" ? "deg" : key === "2" ? "rad" : "gra";
        this.modeMenu = 0;
        this.modeCycle = 0;
        return;
      }
      if (this.modeMenu === 3) {
        this.fix = null;
        this.sci = null;
        if (key === "1") this.pendingFix = true;
        else if (key === "2") this.pendingSci = true;
        else this.modeMenu = 4;
        if (key !== "3") this.modeMenu = key === "1" ? 31 : 32;
        return;
      }
    }
    if (this.modeMenu === 31 && /[0-9]/.test(key)) {
      this.fix = Number(key);
      this.sci = null;
      this.modeMenu = 0;
      this.modeCycle = 0;
      this.pendingFix = false;
      return;
    }
    if (this.modeMenu === 32 && /[0-9]/.test(key)) {
      this.sci = key === "0" ? 10 : Number(key);
      this.fix = null;
      this.modeMenu = 0;
      this.modeCycle = 0;
      return;
    }
    if (this.modeMenu === 4 && (key === "1" || key === "2")) {
      this.norm = Number(key);
      this.fix = null;
      this.sci = null;
      this.modeMenu = 0;
      this.modeCycle = 0;
    }
  };

  Calc.prototype.cycleModeMenu = function () {
    this.modeCycle = this.modeCycle % 3 + 1;
    this.modeMenu = this.modeCycle;
  };

  Calc.prototype.applyMode = function (kind, value) {
    if (kind === "calc") {
      this.mode = value;
      this.resultText = value === "sd" ? "SD" : "COMP";
      this.justEvaluated = true;
    } else if (kind === "angle") {
      this.angle = value;
    } else if (kind === "fix") {
      this.fix = Number(value);
      this.sci = null;
    } else if (kind === "sci") {
      this.sci = Number(value);
      this.fix = null;
    } else if (kind === "norm") {
      this.norm = Number(value);
      this.fix = null;
      this.sci = null;
    } else if (kind === "frac") {
      this.mixedFrac = value === "mixed";
    }
    this.modeMenu = 0;
    this.modeCycle = 0;
    this.render();
  };

  Calc.prototype.allClear = function () {
    this.tokens = [];
    this.cursor = 0;
    this.clearInputBuffer();
    this.error = null;
    this.resultText = "0";
    this.justEvaluated = false;
    this.fractionView = false;
    this.dmsView = false;
    this.eng = null;
    this.modeMenu = 0;
    this.modeCycle = 0;
    this.shift = false;
    this.alpha = false;
    this.hyp = false;
    this.sto = false;
    this.rcl = false;
  };

  Calc.prototype.del = function () {
    this.error = null;
    if (this.inputNum) {
      this.inputNum = this.inputNum.slice(0, -1);
      this.buildingExp = this.inputNum.indexOf("e") !== -1;
      return;
    }
    if (this.cursor > 0) {
      this.tokens.splice(this.cursor - 1, 1);
      this.cursor -= 1;
    }
    this.justEvaluated = false;
  };

  Calc.prototype.moveCursor = function (dir) {
    this.flushNumber();
    this.cursor = Math.max(0, Math.min(this.tokens.length, this.cursor + dir));
    this.justEvaluated = false;
    this.render();
  };

  Calc.prototype.replay = function (dir) {
    if (!this.history.length) return;
    if (this.histIndex < 0) this.histIndex = this.history.length;
    this.histIndex += dir;
    if (this.histIndex < 0) this.histIndex = 0;
    if (this.histIndex >= this.history.length) {
      this.histIndex = this.history.length;
      this.tokens = [];
      this.cursor = 0;
      this.resultText = "0";
      this.render();
      return;
    }
    var item = this.history[this.histIndex];
    this.tokens = Engine.cloneTokens(item.tokens);
    this.cursor = this.tokens.length;
    this.resultText = item.display;
    this.justEvaluated = true;
    this.render();
  };

  Calc.prototype.currentTokens = function () {
    this.flushNumber();
    return this.tokens;
  };

  Calc.prototype.equals = function () {
    this.flushNumber();
    if (this.modeMenu) {
      this.modeMenu = 0;
      this.render();
      return;
    }
    try {
      if (!this.tokens.length) {
        this.resultText = this.format(this.ans);
        return;
      }
      var result = Engine.evaluate(this.tokens, this.ctx());
      this.ans = result.value;
      this.fractionView = false;
      this.dmsView = false;
      this.eng = null;
      if (result.polar) {
        this.resultText = "r=" + this.format(result.polar.r) + "  θ=" + this.format(result.polar.theta);
      } else if (result.rect) {
        this.resultText = "x=" + this.format(result.rect.x) + "  y=" + this.format(result.rect.y);
      } else {
        this.resultText = this.format(result.value);
      }
      this.history.push({
        tokens: Engine.cloneTokens(this.tokens),
        value: result.value,
        display: this.resultText,
      });
      if (this.history.length > 32) this.history.shift();
      this.histIndex = this.history.length;
      this.justEvaluated = true;
      this.error = null;
    } catch (err) {
      this.error = err.name === "SyntaxError" ? "Syntax ERROR" : "Math ERROR";
      this.resultText = this.error;
    }
  };

  Calc.prototype.format = function (value) {
    return Engine.applyDisplayFormat(value, this.setup());
  };

  Calc.prototype.toggleFraction = function () {
    try {
      var value = this.ans;
      if (!this.justEvaluated && (this.tokens.length || this.inputNum)) {
        this.flushNumber();
        value = Engine.evaluate(this.tokens, this.ctx()).value;
      }
      this.fractionView = !this.fractionView;
      this.dmsView = false;
      this.eng = null;
      if (this.fractionView) {
        this.resultText = Engine.formatFraction(Engine.decimalToFraction(value, this.mixedFrac));
      } else {
        this.resultText = this.format(value);
      }
    } catch (e) {
      this.error = "Math ERROR";
      this.resultText = this.error;
    }
  };

  Calc.prototype.handleDms = function () {
    if (this.justEvaluated) {
      this.dmsView = !this.dmsView;
      this.fractionView = false;
      this.eng = null;
      this.resultText = this.dmsView ? Engine.decimalToDms(this.ans) : this.format(this.ans);
      return;
    }
    this.flushNumber();
    this.insertToken(Engine.tok("post", "dms"));
  };

  Calc.prototype.applyEng = function (dir) {
    var value = this.ans;
    try {
      if (!this.justEvaluated && (this.tokens.length || this.inputNum)) {
        this.flushNumber();
        value = Engine.evaluate(this.tokens, this.ctx()).value;
        this.ans = value;
      }
    } catch (e) {
      this.error = "Math ERROR";
      this.resultText = this.error;
      return;
    }
    var step = this.eng ? this.eng.step + dir : 0;
    var shifted = Engine.shiftEng(value, step);
    this.eng = { step: step };
    this.resultText = shifted.display;
    this.justEvaluated = true;
  };

  Calc.prototype.memoryAdd = function (sign) {
    try {
      var value = this.ans;
      if (this.tokens.length || this.inputNum) {
        this.flushNumber();
        value = Engine.evaluate(this.tokens, this.ctx()).value;
      }
      this.vars.M += sign * value;
      this.ans = value;
      this.resultText = this.format(value);
      this.justEvaluated = true;
    } catch (e) {
      this.error = e.name === "SyntaxError" ? "Syntax ERROR" : "Math ERROR";
      this.resultText = this.error;
    }
  };

  Calc.prototype.statData = function () {
    try {
      this.flushNumber();
      var value = this.tokens.length ? Engine.evaluate(this.tokens, this.ctx()).value : this.ans;
      Engine.statsAdd(this.stats, value);
      this.resultText = "n=" + this.stats.n;
      this.tokens = [];
      this.cursor = 0;
      this.justEvaluated = true;
    } catch (e) {
      this.error = "Math ERROR";
      this.resultText = this.error;
    }
  };

  Calc.prototype.showStat = function (which) {
    try {
      var v;
      if (which === "sumsq") v = this.stats.sumsq;
      else if (which === "sum") v = this.stats.sum;
      else if (which === "n") v = this.stats.n;
      else if (which === "mean") v = Engine.statsMean(this.stats);
      else if (which === "pop") v = Engine.statsPopSd(this.stats);
      else v = Engine.statsSampleSd(this.stats);
      this.ans = v;
      this.resultText = this.format(v);
      this.justEvaluated = true;
    } catch (e) {
      this.error = "Math ERROR";
      this.resultText = this.error;
    }
  };

  Calc.prototype.expressionText = function () {
    var parts = [];
    for (var i = 0; i < this.tokens.length; i++) {
      if (i === this.cursor && !this.inputNum) parts.push("▌");
      parts.push(Engine.tokenToText(this.tokens[i]));
    }
    if (this.inputNum) {
      if (this.cursor === this.tokens.length) parts.push(this.inputNum + "▌");
      else parts.push(this.inputNum);
    } else if (this.cursor === this.tokens.length) {
      parts.push("▌");
    }
    var s = parts.join("");
    return s === "▌" ? "" : s;
  };

  Calc.prototype.render = function () {
    var expr = this.expressionText();
    this.el.expr.textContent = expr || (this.justEvaluated ? Engine.tokensToString(this.tokens) : "");
    this.el.result.textContent = this.error || this.resultText;

    var inds = [];
    if (this.shift) inds.push('<span class="ind on">S</span>');
    else inds.push('<span class="ind">S</span>');
    if (this.alpha) inds.push('<span class="ind on">A</span>');
    else inds.push('<span class="ind">A</span>');
    if (this.hyp) inds.push('<span class="ind on">HYP</span>');
    if (this.sto) inds.push('<span class="ind on">STO</span>');
    if (this.rcl) inds.push('<span class="ind on">RCL</span>');
    inds.push('<span class="ind on">' + (this.angle === "rad" ? "R" : this.angle === "gra" ? "G" : "D") + "</span>");
    if (this.fix != null) inds.push('<span class="ind on">FIX</span>');
    if (this.sci != null) inds.push('<span class="ind on">SCI</span>');
    if (this.vars.M) inds.push('<span class="ind on">M</span>');
    if (this.mode === "sd") inds.push('<span class="ind on">SD</span>');
    if (this.overwrite) inds.push('<span class="ind on">INS</span>');
    this.el.indicators.innerHTML = inds.join("");

    document.getElementById("mplus-label").textContent = this.mode === "sd" ? "DT" : "M+";
    document.querySelector('[data-key="M+"]').setAttribute("data-key-active", this.mode === "sd" ? "DT" : "M+");

    this.el.modePanel.classList.toggle("open", this.modeMenu > 0);
    this.renderModePanel();
  };

  Calc.prototype.renderModePanel = function () {
    var html = "";
    if (this.modeMenu === 1) {
      html = "<h3>Mode</h3><p>1: COMP &nbsp; 2: SD</p>";
    } else if (this.modeMenu === 2) {
      html = "<h3>Angle</h3><p>1: Deg &nbsp; 2: Rad &nbsp; 3: Gra</p>";
    } else if (this.modeMenu === 3) {
      html = "<h3>Display</h3><p>1: Fix &nbsp; 2: Sci &nbsp; 3: Norm</p>";
    } else if (this.modeMenu === 31) {
      html = "<h3>Fix</h3><p>Decimal places 0–9</p>";
    } else if (this.modeMenu === 32) {
      html = "<h3>Sci</h3><p>Significant digits 0–9 (0=10)</p>";
    } else if (this.modeMenu === 4) {
      html = "<h3>Norm</h3><p>1: Norm1 &nbsp; 2: Norm2</p>";
    }
    html +=
      '<div class="mode-grid">' +
      '<button type="button" data-mode="calc" data-value="comp">COMP</button>' +
      '<button type="button" data-mode="calc" data-value="sd">SD</button>' +
      '<button type="button" data-mode="angle" data-value="deg">Deg</button>' +
      '<button type="button" data-mode="angle" data-value="rad">Rad</button>' +
      '<button type="button" data-mode="angle" data-value="gra">Gra</button>' +
      '<button type="button" data-mode="norm" data-value="1">Norm1</button>' +
      '<button type="button" data-mode="norm" data-value="2">Norm2</button>' +
      '<button type="button" data-mode="fix" data-value="2">Fix 2</button>' +
      '<button type="button" data-mode="sci" data-value="5">Sci 5</button>' +
      '<button type="button" data-mode="frac" data-value="mixed">ab/c</button>' +
      '<button type="button" data-mode="frac" data-value="improper">d/c</button>' +
      "</div><p class='hint'>Press MODE again for Deg / Fix menus, or tap a button.</p>";
    this.el.modePanel.innerHTML = html;
  };

  var origOnKey = Calc.prototype.onKey;
  Calc.prototype.onKey = function (key) {
    if (key === "M+" && this.mode === "sd" && !this.shift && !this.alpha && !this.sto && !this.rcl) {
      this.statData();
      this.render();
      return;
    }
    origOnKey.call(this, key);
  };

  document.addEventListener("DOMContentLoaded", function () {
    window.fx82 = new Calc();
  });
})();
