// server.ts
var import_node = require("vscode-languageserver/node");
var import_vscode_languageserver_textdocument = require("vscode-languageserver-textdocument");

// frontend/token.ts
var TokenLookup = {
  "+": "Plus" /* Plus */,
  "++": "PlusPlus" /* PlusPlus */,
  "+=": "PlusEquals" /* PlusEquals */,
  "-": "Minus" /* Minus */,
  "--": "MinusMinus" /* MinusMinus */,
  "-=": "MinusEquals" /* MinusEquals */,
  "*": "Star" /* Star */,
  "*=": "StarEquals" /* StarEquals */,
  "/": "Slash" /* Slash */,
  "/=": "SlashEquals" /* SlashEquals */,
  "^": "Caret" /* Caret */,
  "^=": "CaretEquals" /* CaretEquals */,
  "%": "Percent" /* Percent */,
  "%=": "PercentEquals" /* PercentEquals */,
  "(": "LeftParen" /* LeftParen */,
  ")": "RightParen" /* RightParen */,
  "[": "LeftBrack" /* LeftBrack */,
  "]": "RightBrack" /* RightBrack */,
  "{": "LeftBrace" /* LeftBrace */,
  "}": "RightBrace" /* RightBrace */,
  ",": "Comma" /* Comma */,
  ":": "Colon" /* Colon */,
  "::": "ColonColon" /* ColonColon */,
  ".": "Dot" /* Dot */,
  "|": "Pipe" /* Pipe */,
  "=": "Equals" /* Equals */,
  ">": "Greater" /* Greater */,
  ">=": "GreaterEquals" /* GreaterEquals */,
  "<": "Less" /* Less */,
  "<=": "LessEquals" /* LessEquals */,
  "==": "EqualsEquals" /* EqualsEquals */,
  "!=": "NotEquals" /* NotEquals */,
  "!": "Not" /* Not */,
  "->": "Arrow" /* Arrow */,
  "||": "Or" /* Or */,
  ">>": "RightShift" /* RightShift */,
  "<<": "LeftShift" /* LeftShift */,
  "&&": "And" /* And */,
  "&": "Ampersand" /* Ampersand */,
  "..": "DotDot" /* DotDot */,
  "?": "Question" /* Question */,
  "??": "QuestionQuestion" /* QuestionQuestion */,
  ";": "Semicolon" /* Semicolon */
};

// frontend/lexer.ts
function numeric(char) {
  return char != void 0 && /^[0-9]$/.test(char);
}
function alpha(char) {
  return char != void 0 && /[a-zA-Z_]$/.test(char);
}
function alphaNumeric(char) {
  return char != void 0 && /[a-zA-Z0-9_]$/.test(char);
}
var Lexer = class {
  src;
  ptr;
  current;
  line = 1;
  constructor(src) {
    this.src = src.split("");
    this.ptr = 0;
    this.current = this.src[0];
  }
  string(end) {
    let buf = "";
    const ln = this.line;
    while (this.current != end) {
      if (this.current == "\\" && this.src[this.ptr + 1] == end) {
        this.ptr += 2;
        this.current = this.src[this.ptr];
        continue;
      }
      if (this.current == "\n")
        this.line++;
      buf = buf + this.src[this.ptr++];
      this.current = this.src[this.ptr];
    }
    buf = buf.replace("\\n", "\n");
    buf = buf.replace("\\t", "	");
    buf = buf.replace("\\0", "\0");
    this.current = this.src[++this.ptr];
    return { type: "String" /* String */, value: buf, ln };
  }
  next() {
    while (this.current?.match(/[\s\r\n\t#]/)) {
      if (this.current == "#")
        while (this.current != "\n" && this.current != void 0)
          this.current = this.src[++this.ptr];
      if (this.current === "\n") this.line++;
      this.current = this.src[++this.ptr];
    }
    const ch = this.src[this.ptr++];
    const ln = this.line;
    this.current = this.src[this.ptr];
    if (ch === void 0) {
      return { type: "EOF" /* EOF */, value: "", ln };
    }
    switch (ch) {
      case '"':
        return this.string('"');
      case "'":
        return this.string("'");
    }
    const doubleChar = ch + this.current;
    if (TokenLookup[doubleChar]) {
      this.current = this.src[++this.ptr];
      return { type: TokenLookup[doubleChar], value: doubleChar, ln };
    }
    if (TokenLookup[ch]) {
      return { type: TokenLookup[ch], value: ch, ln };
    }
    if (numeric(ch)) {
      let buf = ch;
      while (numeric(this.current)) {
        buf += this.current;
        this.current = this.src[++this.ptr];
      }
      if (this.current == ".") {
        buf += this.current;
        this.current = this.src[++this.ptr];
        while (numeric(this.current)) {
          buf += this.current;
          this.current = this.src[++this.ptr];
        }
      }
      return { type: "Number" /* Number */, value: buf, ln };
    }
    if (alpha(ch)) {
      let buf = ch;
      while (alphaNumeric(this.current)) {
        buf += this.current;
        this.current = this.src[++this.ptr];
      }
      return { type: "Id" /* Id */, value: buf, ln };
    }
    throw `character ${ch} is not known (line ${ln})`;
  }
};

// frontend/types.ts
function tostringType(t) {
  switch (t.type) {
    case 0 /* Number */:
      return String(t.num || "Number");
    case 1 /* String */:
      return t.str == void 0 ? "String" : '"' + t.str + '"';
    case 2 /* Bool */:
      return t.bool == void 0 ? "Bool" : t.bool ? "true" : "false";
    case 3 /* None */:
      return "None";
    case 5 /* Or */:
      return tostringType(t.a) + " | " + tostringType(t.b);
    case 6 /* Array */:
      return `${tostringType(t.t)}[]`;
    case 7 /* Tuple */: {
      let buf = "[";
      for (const x of t.a) {
        buf = `${buf}${tostringType(x)}, `;
      }
      return buf + "]";
    }
    case 9 /* LooseRecord */:
      return `<${tostringType(t.key)}: ${tostringType(t.value)}>`;
    case 10 /* Entity */:
      return t.name;
    case 12 /* Fun */: {
      const f = t;
      let str = "fun(";
      for (const param of f.params) {
        str = `${str}${param[0]}: ${tostringType(param[1])}, `;
      }
      return `${str}) ${tostringType(f.ret)}`;
    }
    case 8 /* Pointer */:
      return "&" + tostringType(t.t);
    case 11 /* EntityRaw */:
    case 4 /* Any */:
    default:
      return "Any";
  }
}

// frontend/parser.ts
function constantFold(n) {
  switch (n.type) {
    case 18 /* Binary */: {
      const a = constantFold(n.a);
      const b = constantFold(n.b);
      const reconstruct = {
        type: 18 /* Binary */,
        line: n.line,
        a,
        b,
        op: n.op
      };
      if (a.type == 20 /* Number */ && b.type == 20 /* Number */) {
        switch (n.op) {
          case "+":
            return { type: 20 /* Number */, line: n.line, n: a.n + b.n };
          case "-":
            return { type: 20 /* Number */, line: n.line, n: a.n - b.n };
          case "*":
            return { type: 20 /* Number */, line: n.line, n: a.n * b.n };
          case "/":
            return { type: 20 /* Number */, line: n.line, n: a.n / b.n };
          case "%":
            return { type: 20 /* Number */, line: n.line, n: a.n % b.n };
          case "^":
            return { type: 20 /* Number */, line: n.line, n: a.n ^ b.n };
          case "|":
            return { type: 20 /* Number */, line: n.line, n: a.n | b.n };
          case "&":
            return { type: 20 /* Number */, line: n.line, n: a.n & b.n };
          case ">>":
            return { type: 20 /* Number */, line: n.line, n: a.n >> b.n };
          case "<<":
            return { type: 20 /* Number */, line: n.line, n: a.n << b.n };
        }
      }
      return reconstruct;
    }
    default:
      return n;
  }
}
var Parser = class {
  constructor(lexer) {
    this.lexer = lexer;
    this.current = lexer.next();
  }
  previous = { type: "EOF" /* EOF */, value: "", ln: 0 };
  current;
  allowFolding = true;
  adv() {
    this.previous = this.current;
    this.current = this.lexer.next();
    return this.previous;
  }
  expect(t) {
    this.adv();
    if (this.previous.type != t) {
      this.throw(`expected ${t}, got ${this.previous.type}`);
    }
    return this.previous;
  }
  throw(msg) {
    throw { msg, ln: this.current.ln };
  }
  parse() {
    const tree = new Array();
    while (this.current.type != "EOF" /* EOF */) {
      tree.push(this.stmt());
    }
    return tree;
  }
  type() {
    return this.orType();
  }
  orType() {
    const a = this.refType();
    if (this.current.type == "Pipe" /* Pipe */) {
      const line = this.adv().ln;
      return { type: 5 /* Or */, line, a, b: this.refType() };
    }
    return a;
  }
  refType() {
    if (this.current.type == "Ampersand" /* Ampersand */) {
      this.adv();
      return { type: 8 /* Pointer */, t: this.arrType() };
    }
    return this.arrType();
  }
  arrType() {
    let t = this.litType();
    while (this.current.type == "LeftBrack" /* LeftBrack */) {
      this.adv();
      this.expect("RightBrack" /* RightBrack */);
      t = { type: 6 /* Array */, t };
    }
    return t;
  }
  litType() {
    switch (this.adv().type) {
      // deno-lint-ignore no-fallthrough
      case "Id" /* Id */:
        switch (this.previous.value) {
          case "fun": {
            this.expect("LeftParen" /* LeftParen */);
            const params = [];
            while (this.current.type != "RightParen" /* RightParen */) {
              const x = this.expect("Id" /* Id */).value;
              if (x == "mut") {
                const name = this.expect("Id" /* Id */).value;
                this.expect("Colon" /* Colon */);
                params.push([name, this.type(), true]);
                continue;
              }
              this.expect("Colon" /* Colon */);
              params.push([x, this.type(), false]);
            }
            this.expect("RightParen" /* RightParen */);
            return { type: 12 /* Fun */, params, ret: this.type() };
          }
          case "true":
            return { type: 2 /* Bool */, b: true };
          case "false":
            return { type: 2 /* Bool */, b: false };
          case "none":
          case "None":
            return { type: 3 /* None */ };
          case "any":
          case "Any":
            return { type: 4 /* Any */ };
          case "Bool":
          case "Boolean":
            return { type: 2 /* Bool */, b: void 0 };
          case "Number":
            return { type: 0 /* Number */, num: void 0 };
          case "String":
            return { type: 1 /* String */, str: void 0 };
          default:
            return { type: 10 /* Entity */, name: this.previous.value };
        }
      case "Number" /* Number */:
        return { type: 0 /* Number */, num: Number(this.previous.value) };
      case "String" /* String */:
        return { type: 1 /* String */, str: this.previous.value };
      case "LeftParen" /* LeftParen */: {
        const t = this.type();
        this.expect("RightParen" /* RightParen */);
        return t;
      }
      case "Less" /* Less */: {
        const key = this.type();
        this.expect("Colon" /* Colon */);
        const value = this.type();
        this.expect("Greater" /* Greater */);
        return { type: 9 /* LooseRecord */, key, value };
      }
      case "LeftBrack" /* LeftBrack */: {
        const members = new Array();
        while (this.current.type != "RightBrack" /* RightBrack */) {
          members.push(this.type());
          if (this.current.type == "Comma" /* Comma */) {
            this.adv();
          }
        }
        this.expect("RightBrack" /* RightBrack */);
        return { type: 7 /* Tuple */, a: members };
      }
      default:
        this.throw(`unparsed token in type ${this.previous.type}`);
    }
  }
  varDecl(mutable) {
    this.adv();
    const name = this.expect("Id" /* Id */).value;
    let t = { type: 4 /* Any */ };
    if (this.current.type == "Colon" /* Colon */) {
      this.adv();
      t = this.type();
    }
    this.expect("Equals" /* Equals */);
    return { type: 0 /* VarDecl */, name, t, value: this.expr(), mutable };
  }
  funDecl(name) {
    const line = this.current.ln;
    this.expect("LeftParen" /* LeftParen */);
    const params = [];
    while (this.current.type != "RightParen" /* RightParen */) {
      let mut = false;
      if (this.current.type == "Id" /* Id */ && this.current.value == "mut") {
        this.adv();
        mut = true;
      }
      const paramName = this.expect("Id" /* Id */).value;
      let paramType = { type: 4 /* Any */ };
      if (this.current.type == "Colon" /* Colon */) {
        this.adv();
        paramType = this.type();
      }
      params.push([paramName, paramType, mut]);
      if (this.current.type == "Comma" /* Comma */) {
        this.adv();
      }
    }
    this.expect("RightParen" /* RightParen */);
    let ret = { type: 4 /* Any */ };
    if (this.current.type != "LeftBrace" /* LeftBrace */) {
      ret = this.type();
    }
    this.expect("LeftBrace" /* LeftBrace */);
    const body = [];
    while (this.current.type != "RightBrace" /* RightBrace */) {
      body.push(this.stmt());
    }
    this.expect("RightBrace" /* RightBrace */);
    return { type: 1 /* FunDecl */, line, name, params, body, ret };
  }
  use() {
    let left = this.nameUse();
    while (this.current.type == "ColonColon" /* ColonColon */) {
      const line = this.adv().ln;
      if (this.current.type == "LeftBrace" /* LeftBrace */) {
        const body = new Array();
        this.adv();
        while (this.current.type != "RightBrace" /* RightBrace */) {
          body.push(this.use());
          if (this.current.type == "Comma" /* Comma */) {
            this.adv();
          }
        }
        this.adv();
        return {
          line,
          type: 6 /* UseExpand */,
          left,
          body
        };
      }
      left = {
        type: 5 /* UseBasic */,
        line,
        left,
        right: this.nameUse()
      };
    }
    return left;
  }
  nameUse() {
    const name = this.expect("Id" /* Id */).value;
    if (this.current.type == "Id" /* Id */ && this.current.value == "as") {
      return {
        type: 4 /* UseName */,
        line: this.adv().ln,
        name,
        as: this.expect("Id" /* Id */).value
      };
    }
    return {
      type: 4 /* UseName */,
      name,
      as: void 0
    };
  }
  structDecl() {
    this.adv();
    const name = this.expect("Id" /* Id */).value;
    this.expect("LeftBrace" /* LeftBrace */);
    const fields = /* @__PURE__ */ new Map();
    const staticFields = /* @__PURE__ */ new Map();
    const funs = /* @__PURE__ */ new Map();
    const staticFuns = /* @__PURE__ */ new Map();
    const cycle = (tag) => {
      const prev = this.previous;
      const curr = this.current;
      const lx_ptr = this.lexer.ptr;
      const lx_curr = this.lexer.current;
      const name2 = this.expect("Id" /* Id */);
      if (this.current.type == "LeftParen" /* LeftParen */) {
        this.previous = prev;
        this.current = curr;
        this.lexer.ptr = lx_ptr;
        this.lexer.current = lx_curr;
        const f = this.funDecl(this.expect("Id" /* Id */).value);
        switch (tag) {
          case 0:
            funs.set(f.name, f);
            break;
          case 1:
            staticFuns.set(f.name, f);
            break;
          default:
            break;
        }
        return;
      }
      const t = this.type();
      switch (tag) {
        case 0:
          fields.set(name2.value, t);
          break;
        case 1: {
          let val = { type: 24 /* None */ };
          if (this.current.type == "Equals" /* Equals */) {
            this.adv();
            val = this.expr();
          }
          staticFields.set(name2.value, [t, val]);
          break;
        }
        default:
          this.throw("struct fields can only be static or default");
      }
    };
    while (this.current.type != "RightBrace" /* RightBrace */) {
      switch (this.current.type) {
        case "Not" /* Not */:
          this.adv();
          cycle(1);
          break;
        default:
          cycle(0);
          break;
      }
    }
    this.expect("RightBrace" /* RightBrace */);
    return { type: 7 /* StructDecl */, name, fields, staticFields, funs, staticFuns };
  }
  if() {
    const cond = this.expr();
    const body = [];
    this.expect("LeftBrace" /* LeftBrace */);
    while (this.current.type != "RightBrace" /* RightBrace */) {
      body.push(this.stmt());
    }
    this.expect("RightBrace" /* RightBrace */);
    if (this.current.type == "Id" /* Id */ && this.current.value == "els") {
      this.adv();
      if (this.current.type == "Id" /* Id */ && this.current.value == "if") {
        this.adv();
        return { type: 16 /* If */, cond, body, elseT: 1, else: this.if() };
      }
      const els = [];
      this.expect("LeftBrace" /* LeftBrace */);
      while (this.current.type != "RightBrace" /* RightBrace */) {
        els.push(this.stmt());
      }
      this.expect("RightBrace" /* RightBrace */);
      return { type: 16 /* If */, cond, body, elseT: 2, else: els };
    }
    return { type: 16 /* If */, cond, body, elseT: 0, else: void 0 };
  }
  while() {
    this.adv();
    const cond = this.expr();
    const body = [];
    this.expect("LeftBrace" /* LeftBrace */);
    while (this.current.type != "RightBrace" /* RightBrace */) {
      body.push(this.stmt());
    }
    this.expect("RightBrace" /* RightBrace */);
    return { type: 8 /* While */, cond, body };
  }
  stmt() {
    if (this.current.type == "Id" /* Id */) {
      switch (this.current.value) {
        case "let":
          return this.varDecl(false);
        case "mut":
          return this.varDecl(true);
        case "fun":
          this.adv();
          return this.funDecl(this.expect("Id" /* Id */).value);
        case "use":
          this.adv();
          return this.use();
        case "str":
          return this.structDecl();
        case "whl":
          return this.while();
        case "for": {
          this.adv();
          const started = this.current.type == "LeftParen" /* LeftParen */;
          if (started) {
            this.adv();
          }
          const a = this.expect("Id" /* Id */);
          if (this.current.type == "Comma" /* Comma */) {
            this.adv();
          }
          const b = this.expect("Id" /* Id */).value;
          if (this.expect("Id" /* Id */).value != "of") {
            this.throw("expected of keyword following (proper syntax is for <name>, <name> of <exp> { <...stmt> })");
          }
          const iterator = this.expr();
          if (started) {
            this.expect("RightParen" /* RightParen */);
          }
          const body = [];
          this.expect("LeftBrace" /* LeftBrace */);
          while (this.current.type != "RightBrace" /* RightBrace */) {
            body.push(this.stmt());
          }
          this.expect("RightBrace" /* RightBrace */);
          return { type: 9 /* ForOf */, line: a.ln, a: a.value, b, body, iterator };
        }
        case "err": {
          this.adv();
          return { type: 12 /* Err */, val: this.expr() };
        }
        case "cnt": {
          this.adv();
          return { type: 11 /* Continue */ };
        }
        case "brk": {
          this.adv();
          return { type: 10 /* Break */ };
        }
        case "tag": {
          this.adv();
          const name = this.expect("Id" /* Id */).value;
          const tagged = /* @__PURE__ */ new Map();
          const nontagged = /* @__PURE__ */ new Map();
          this.expect("LeftBrace" /* LeftBrace */);
          while (this.current.type != "RightBrace" /* RightBrace */) {
            const n = this.expect("Id" /* Id */).value;
            if (this.current.type == "LeftParen" /* LeftParen */) {
              this.adv();
              const t = this.type();
              this.expect("RightParen" /* RightParen */);
              tagged.set(n, t);
            } else {
              nontagged.set(n, void 0);
            }
            if (this.current.type == "Comma" /* Comma */) {
              this.adv();
            }
          }
          this.expect("RightBrace" /* RightBrace */);
          return { type: 2 /* TagDecl */, name, tagged, nontagged };
        }
        case "ret":
          return { type: 3 /* Return */, line: this.adv().ln, value: this.expr() };
      }
    }
    const e = this.expr();
    if (this.current.type == "Semicolon" /* Semicolon */) {
      this.adv();
    }
    return e;
  }
  expr() {
    let e = this.cat();
    if (this.current.type == "Semicolon" /* Semicolon */) {
      this.adv();
    }
    if (this.allowFolding) {
      e = constantFold(e);
    }
    return e;
  }
  cat() {
    const exp = this.assign();
    if (this.current.type == "Id" /* Id */ && this.current.value == "cat") {
      this.adv();
      const name = this.expect("Id" /* Id */).value;
      const body = [];
      this.expect("LeftBrace" /* LeftBrace */);
      while (this.current.type != "RightBrace" /* RightBrace */) {
        body.push(this.stmt());
      }
      this.expect("RightBrace" /* RightBrace */);
      return { type: 15 /* Catch */, exp, name, body };
    }
    return exp;
  }
  assign() {
    const left = this.or();
    if (this.current.type == "Equals" /* Equals */) {
      return {
        type: 18 /* Binary */,
        a: left,
        line: this.current.ln,
        op: this.adv().value,
        b: this.assign()
      };
    }
    return left;
  }
  or() {
    let left = this.nullish();
    while (this.current.type == "Or" /* Or */) {
      left = {
        type: 18 /* Binary */,
        a: left,
        line: this.current.ln,
        op: this.adv().value,
        b: this.nullish()
      };
    }
    return left;
  }
  nullish() {
    let left = this.and();
    while (this.current.type == "QuestionQuestion" /* QuestionQuestion */) {
      left = {
        type: 18 /* Binary */,
        a: left,
        line: this.current.ln,
        op: this.adv().value,
        b: this.and()
      };
    }
    return left;
  }
  and() {
    let left = this.equal();
    while (this.current.type == "And" /* And */) {
      left = {
        type: 18 /* Binary */,
        a: left,
        line: this.current.ln,
        op: this.adv().value,
        b: this.equal()
      };
    }
    return left;
  }
  equal() {
    let left = this.cmp();
    while (this.current.type == "EqualsEquals" /* EqualsEquals */ || this.current.type == "NotEquals" /* NotEquals */) {
      left = {
        type: 18 /* Binary */,
        a: left,
        line: this.current.ln,
        op: this.adv().value,
        b: this.cmp()
      };
    }
    return left;
  }
  cmp() {
    let left = this.shift();
    const ops = {
      ["GreaterEquals" /* GreaterEquals */]: true,
      ["Greater" /* Greater */]: true,
      ["LessEquals" /* LessEquals */]: true,
      ["Less" /* Less */]: true
    };
    while (this.current.type in ops) {
      left = {
        type: 18 /* Binary */,
        a: left,
        line: this.current.ln,
        op: this.adv().value,
        b: this.shift()
      };
    }
    return left;
  }
  shift() {
    let left = this.bitwise();
    const ops = {
      ["LeftShift" /* LeftShift */]: true,
      ["RightShift" /* RightShift */]: true
    };
    while (this.current.type in ops) {
      left = {
        type: 18 /* Binary */,
        a: left,
        line: this.current.ln,
        op: this.adv().value,
        b: this.bitwise()
      };
    }
    return left;
  }
  bitwise() {
    let left = this.con();
    const ops = {
      ["Pipe" /* Pipe */]: true,
      ["Ampersand" /* Ampersand */]: true
    };
    while (this.current.type in ops) {
      left = {
        type: 18 /* Binary */,
        a: left,
        line: this.current.ln,
        op: this.adv().value,
        b: this.con()
      };
    }
    return left;
  }
  con() {
    let left = this.term();
    while (this.current.type == "DotDot" /* DotDot */) {
      left = { type: 18 /* Binary */, line: this.adv().ln, a: left, b: this.term(), op: ".." };
    }
    return left;
  }
  term() {
    let left = this.factor();
    while (this.current.type == "Plus" /* Plus */ || this.current.type == "Minus" /* Minus */) {
      left = {
        type: 18 /* Binary */,
        a: left,
        line: this.current.ln,
        op: this.adv().value,
        b: this.factor()
      };
    }
    return left;
  }
  factor() {
    let left = this.pow();
    if (this.current.type == "Star" /* Star */ && left.type == 19 /* Unary */ && left.op == "&") {
      return left;
    }
    while (this.current.type == "Star" /* Star */ || this.current.type == "Slash" /* Slash */ || this.current.type == "Percent" /* Percent */) {
      left = {
        type: 18 /* Binary */,
        a: left,
        line: this.current.ln,
        op: this.adv().value,
        b: this.pow()
      };
    }
    return left;
  }
  pow() {
    let left = this.unary();
    while (this.current.type == "Caret" /* Caret */) {
      left = {
        type: 18 /* Binary */,
        a: left,
        line: this.current.ln,
        op: this.adv().value,
        b: this.unary()
      };
    }
    return left;
  }
  unary() {
    const ops = {
      ["Not" /* Not */]: true,
      ["Minus" /* Minus */]: true,
      ["Star" /* Star */]: true,
      ["Ampersand" /* Ampersand */]: true
    };
    if (this.current.type in ops) {
      const token = this.adv();
      return {
        type: 19 /* Unary */,
        line: token.ln,
        op: token.value,
        right: this.unary()
      };
    }
    return this.callMember();
  }
  callMember() {
    let left = this.lit();
    while (true) {
      if (this.current.type == "LeftParen" /* LeftParen */) {
        left = this.call(left);
      } else if (this.current.type in {
        ["LeftBrack" /* LeftBrack */]: true,
        ["Dot" /* Dot */]: true,
        ["ColonColon" /* ColonColon */]: true,
        ["Colon" /* Colon */]: true
      }) {
        const op = this.adv();
        let right;
        if (op.type == "LeftBrack" /* LeftBrack */) {
          right = this.expr();
          this.expect("RightBrack" /* RightBrack */);
        } else {
          right = { type: 22 /* Id */, i: this.expect("Id" /* Id */).value };
        }
        left = {
          type: 28 /* Member */,
          kind: {
            ["LeftBrack" /* LeftBrack */]: 1 /* Computed */,
            ["Dot" /* Dot */]: 0 /* Default */,
            ["ColonColon" /* ColonColon */]: 3 /* NamespaceAccess */,
            ["Colon" /* Colon */]: 2 /* CallSelf */
            // deno-lint-ignore no-explicit-any
          }[op.type],
          right,
          left,
          line: op.ln
        };
      } else {
        break;
      }
    }
    return left;
  }
  call(caller) {
    const line = this.adv().ln;
    const args = [];
    this.allowFolding = false;
    while (this.current.type != "RightParen" /* RightParen */) {
      args.push(this.expr());
      if (this.current.type == "Comma" /* Comma */) {
        this.adv();
      }
    }
    this.allowFolding = true;
    this.adv();
    const call = { type: 25 /* Call */, args, caller, line };
    if (this.current.type == "LeftParen" /* LeftParen */) {
      return this.call(call);
    }
    return call;
  }
  lit() {
    const a = this.adv();
    switch (a.type) {
      case "LeftParen" /* LeftParen */: {
        const e = this.expr();
        this.expect("RightParen" /* RightParen */);
        return e;
      }
      case "Number" /* Number */:
        return { line: a.ln, type: 20 /* Number */, n: Number(a.value) };
      case "String" /* String */:
        return { line: a.ln, type: 21 /* String */, s: a.value };
      case "LeftBrack" /* LeftBrack */: {
        const arr = new Array();
        while (this.current.type != "RightBrack" /* RightBrack */) {
          arr.push(this.expr());
          if (this.current.type == "Comma" /* Comma */) {
            this.adv();
          }
        }
        this.expect("RightBrack" /* RightBrack */);
        return { type: 26 /* Array */, body: arr };
      }
      case "LeftBrace" /* LeftBrace */:
        return this.record(void 0);
      case "Id" /* Id */:
        switch (a.value) {
          case "ext":
            return { type: 13 /* Ext */, file: this.expr() };
          case "none":
            return { line: a.ln, type: 24 /* None */ };
          case "true":
            return { line: a.ln, type: 23 /* Bool */, b: true };
          case "false":
            return { line: a.ln, type: 23 /* Bool */, b: false };
          case "if":
            return this.if();
          case "do": {
            const body = [];
            this.expect("LeftBrace" /* LeftBrace */);
            while (this.current.type != "RightBrace" /* RightBrace */) {
              body.push(this.stmt());
            }
            this.expect("RightBrace" /* RightBrace */);
            return { type: 14 /* Do */, body };
          }
          case "fun":
            return this.funDecl(void 0);
          case "mat": {
            const cond = this.expr();
            this.expect("LeftBrace" /* LeftBrace */);
            const body = /* @__PURE__ */ new Map();
            let def = void 0;
            while (this.current.type != "RightBrace" /* RightBrace */) {
              if (this.current.type == "Id" /* Id */ && this.current.value == "_") {
                this.adv();
                const matchBody2 = [];
                this.expect("LeftBrace" /* LeftBrace */);
                while (this.current.type != "RightBrace" /* RightBrace */) {
                  matchBody2.push(this.stmt());
                }
                this.expect("RightBrace" /* RightBrace */);
                def = matchBody2;
                continue;
              }
              const matches = [];
              while (this.current.type != "LeftBrace" /* LeftBrace */) {
                matches.push(this.expr());
                if (this.current.type == "Comma" /* Comma */) {
                  this.adv();
                }
              }
              const matchBody = [];
              this.expect("LeftBrace" /* LeftBrace */);
              while (this.current.type != "RightBrace" /* RightBrace */) {
                matchBody.push(this.stmt());
              }
              this.expect("RightBrace" /* RightBrace */);
              body.set(matches, matchBody);
            }
            this.expect("RightBrace" /* RightBrace */);
            return { type: 17 /* Match */, cond, body, default: def };
          }
          default:
            if (this.current.type == "LeftBrace" /* LeftBrace */) {
              this.adv();
              return this.record(a.value);
            }
            return { line: a.ln, type: 22 /* Id */, i: a.value };
        }
      default:
        this.throw(`token ${a.type} unparsed`);
    }
  }
  record(name) {
    const line = this.previous.ln;
    const body = /* @__PURE__ */ new Map();
    while (this.current.type != "RightBrace" /* RightBrace */) {
      const k = this.expr();
      if (this.current.type == "Arrow" /* Arrow */) {
        this.adv();
      }
      body.set(k, this.expr());
      if (this.current.type == "Comma" /* Comma */) {
        this.adv();
      }
    }
    this.expect("RightBrace" /* RightBrace */);
    return { type: 27 /* Record */, line, body, name };
  }
};

// server.ts
var conn = (0, import_node.createConnection)(import_node.ProposedFeatures.all);
var docs = new import_node.TextDocuments(import_vscode_languageserver_textdocument.TextDocument);
conn.onInitialize((_params) => {
  console.log("Initialized");
  return {
    capabilities: {
      textDocumentSync: import_node.TextDocumentSyncKind.Incremental,
      hoverProvider: true,
      completionProvider: {
        resolveProvider: false,
        triggerCharacters: [".", "::", ":", "("]
      }
    }
  };
});
docs.onDidChangeContent((change) => {
  serveDocument(change.document);
});
function tostringVar(t) {
  switch (t.type) {
    case 0 /* Var */:
      return `let ${t.varName}: ${tostringType(t.t)}`;
    case 1 /* Fun */: {
      let buf = "";
      for (const [name, paramT] of t.params) {
        buf += `${name}: ${tostringType(paramT)}, `;
      }
      return `fun ${t.varName}(${buf}) ${tostringType(t.ret)}`;
    }
    case 2 /* Raw */:
      return t.raw;
    case 3 /* Struct */: {
      let buf = "";
      for (const [k, v] of t.fields) {
        buf += `	${k} ${tostringType(v)}
`;
      }
      for (const [k, v] of t.staticFields) {
        buf += `	!${k} ${tostringType(v)}
`;
      }
      for (const [_, v] of t.funs) {
        buf += `	${tostringVar(v)}`;
      }
      for (const [_, v] of t.staticFuns) {
        buf += `	!${tostringVar(v)}`;
      }
      return `str ${t.varName} {
${buf}
}`;
    }
    case 4 /* Tag */: {
      let buf = "";
      for (const [k, _] of t.nontagged) {
        buf += `${k},
`;
      }
      for (const [k, v] of t.tagged) {
        buf += `${k}(${tostringType(v)}),
`;
      }
      return `tag ${t.varName} {
${buf}
}`;
    }
    case 5 /* Namespace */:
      return `namespace`;
  }
}
var globalScope = { parent: void 0, members: /* @__PURE__ */ new Map() };
globalScope.members.set("Number", { type: 2 /* Raw */, raw: "# Number\nA numeric value." });
globalScope.members.set("String", { type: 2 /* Raw */, raw: "# String\nA string value." });
globalScope.members.set("None", { type: 2 /* Raw */, raw: "# None\n`none`" });
globalScope.members.set("Any", { type: 2 /* Raw */, raw: "# Any\nAny value." });
{
  const std_ns = { parent: void 0, members: /* @__PURE__ */ new Map() };
  {
    const io_ns = { parent: void 0, members: /* @__PURE__ */ new Map() };
    io_ns.members.set("println", {
      type: 1 /* Fun */,
      varName: "println",
      params: [],
      ret: { type: 3 /* None */ }
    });
    std_ns.members.set("Io", {
      type: 5 /* Namespace */,
      varName: "Io",
      scope: io_ns
    });
  }
  globalScope.members.set("Std", {
    type: 5 /* Namespace */,
    varName: "Std",
    scope: std_ns
  });
}
var scopes = [];
function runBody(body, scope) {
  const newScope = { parent: scope, members: /* @__PURE__ */ new Map() };
  let startLine = -1;
  let endLine = 0;
  const i = scopes.length;
  scopes.push([newScope, 0, 0]);
  for (const n of body) {
    if (startLine == -1) {
      startLine = n.line;
    }
    endLine = n.line;
    runNode(n, newScope);
  }
  scopes[i] = [newScope, startLine, endLine];
}
function runNode(node, scope) {
  switch (node.type) {
    case 13 /* Ext */: {
      runNode(node.file, scope);
      break;
    }
    case 14 /* Do */: {
      runBody(node.body, scope);
      break;
    }
    case 15 /* Catch */: {
      runNode(node.exp, scope);
      runBody(node.body, scope);
      break;
    }
    case 16 /* If */: {
      runNode(node.cond, scope);
      runBody(node.body, scope);
      switch (node.elseT) {
        case 1: {
          runNode(node.else, scope);
          break;
        }
        case 2: {
          runBody(node.else, scope);
          break;
        }
      }
      break;
    }
    case 8 /* While */: {
      runNode(node.cond, scope);
      runBody(node.body, scope);
      break;
    }
    case 9 /* ForOf */: {
      const newScope = { parent: scope, members: /* @__PURE__ */ new Map() };
      newScope.members.set(node.a, { type: 0 /* Var */, varName: node.a, t: { type: 4 /* Any */ } });
      newScope.members.set(node.b, { type: 0 /* Var */, varName: node.b, t: { type: 4 /* Any */ } });
      runBody(node.body, newScope);
      break;
    }
    case 2 /* TagDecl */: {
      scope.members.set(node.name, {
        type: 4 /* Tag */,
        nontagged: node.nontagged,
        tagged: node.tagged
      });
      break;
    }
    case 12 /* Err */:
      runNode(node.val, scope);
      break;
    case 17 /* Match */: {
      runNode(node.cond, scope);
      for (const [k, v] of node.body) {
        for (const x of k) {
          runNode(x, scope);
        }
        runBody(v, scope);
      }
      break;
    }
    case 7 /* StructDecl */: {
      const staticFields = /* @__PURE__ */ new Map();
      for (const [k, v] of node.staticFields) {
        staticFields.set(k, v[0]);
      }
      const funs = /* @__PURE__ */ new Map();
      for (const [k, v] of node.funs) {
        const newScope = { parent: scope, members: /* @__PURE__ */ new Map() };
        for (const [name, t] of v.params) {
          newScope.members.set(name, { type: 0 /* Var */, varName: name, t });
        }
        runBody(v.body, newScope);
        staticFields.set(k, {
          params: v.params,
          ret: v.ret
        });
      }
      const staticFuns = /* @__PURE__ */ new Map();
      for (const [k, v] of node.staticFuns) {
        const newScope = { parent: scope, members: /* @__PURE__ */ new Map() };
        for (const [name, t] of node.params) {
          newScope.members.set(name, { type: 0 /* Var */, varName: name, t });
        }
        const i = scopes.length;
        runBody(node.body, newScope);
        scopes[i][1] = node.line;
        staticFields.set(k, {
          params: v.params,
          ret: v.ret
        });
      }
      scope.members.set(node.name, {
        type: 3 /* Struct */,
        fields: node.fields,
        staticFields,
        funs,
        staticFuns
      });
      break;
    }
    case 19 /* Unary */: {
      runNode(node.right, scope);
      break;
    }
    case 28 /* Member */: {
      runNode(node.left, scope);
      runNode(node.right, scope);
      break;
    }
    case 0 /* VarDecl */: {
      scope.members.set(node.name, {
        type: 0 /* Var */,
        varName: node.name,
        t: node.t
      });
      break;
    }
    case 1 /* FunDecl */: {
      const newScope = { parent: scope, members: /* @__PURE__ */ new Map() };
      for (const [name, t] of node.params) {
        newScope.members.set(name, { type: 0 /* Var */, varName: name, t });
      }
      const i = scopes.length;
      runBody(node.body, newScope);
      scopes[i][1] = node.line;
      scope.members.set(node.name, {
        varName: node.name,
        type: 1 /* Fun */,
        params: node.params,
        ret: node.ret
      });
      break;
    }
    case 18 /* Binary */: {
      runNode(node.a, scope);
      runNode(node.b, scope);
      break;
    }
    case 3 /* Return */: {
      runNode(node.value, scope);
      break;
    }
    case 27 /* Record */: {
      for (const [k, v] of node.body) {
        runNode(k, scope);
        runNode(v, scope);
      }
      break;
    }
    case 25 /* Call */: {
      runNode(node.caller, scope);
      for (const n of node.args) {
        runNode(n, scope);
      }
      break;
    }
    case 26 /* Array */: {
      for (const n of node.body) {
        runNode(n, scope);
      }
      break;
    }
    case 5 /* UseBasic */: {
      const basicNode = node;
      const leftVar = scopeGet(scope, basicNode.left.name);
      if (leftVar?.type === 5 /* Namespace */) {
        const namespace = leftVar;
        const rightMember = namespace.scope.members.get(basicNode.right.name);
        if (rightMember) {
          scope.members.set(basicNode.as || basicNode.right.name, rightMember);
        }
      }
      break;
    }
    case 6 /* UseExpand */: {
      const expandNode = node;
      const leftVar = scopeGet(scope, expandNode.left.name);
      if (leftVar?.type === 5 /* Namespace */) {
        const namespace = leftVar;
        for (const item of expandNode.body) {
          const nameNode = item;
          const member = namespace.scope.members.get(nameNode.name);
          if (member) {
            scope.members.set(nameNode.as || nameNode.name, member);
          }
        }
      }
      break;
    }
    default:
      break;
  }
}
function serveDocument(doc) {
  const txt = doc.getText();
  const diags = [];
  const parse = new Parser(new Lexer(txt));
  try {
    const ast = parse.parse();
    const newGlobal = { parent: globalScope, members: /* @__PURE__ */ new Map() };
    scopes = [[newGlobal, 0, txt.split("\n").length]];
    for (const node of ast) {
      runNode(node, newGlobal);
    }
  } catch (e) {
    if (e != null && typeof e == "object" && "msg" in e && typeof e.msg == "string" && "ln" in e && typeof e.ln == "number") {
      diags.push({
        severity: import_node.DiagnosticSeverity.Error,
        range: {
          start: import_node.Position.create(e.ln, 0),
          end: import_node.Position.create(e.ln, txt.split("\n")[e.ln - 1].length - 1)
        },
        message: e.msg,
        source: "noktoy"
      });
    }
  }
  conn.sendDiagnostics({ uri: doc.uri, diagnostics: diags });
}
function isWordChar(char) {
  return /[a-zA-Z0-9_]/.test(char);
}
function findWordStart(text, offset) {
  while (offset > 0 && isWordChar(text[offset - 1])) {
    offset--;
  }
  return offset;
}
function findWordEnd(text, offset) {
  while (offset < text.length && isWordChar(text[offset])) {
    offset++;
  }
  return offset;
}
function scopeGet(scope, name) {
  const v = scope.members.get(name);
  return v == void 0 ? scope.parent == void 0 ? void 0 : scopeGet(scope.parent, name) : v;
}
function serveDocumentHover(uri, pos) {
  console.log("Hover");
  const doc = docs.get(uri);
  const offset = doc.offsetAt(pos);
  const docTxt = doc.getText();
  const end = findWordEnd(docTxt, offset);
  const txt = docTxt.slice(findWordStart(docTxt, offset), end);
  let scope = -1;
  for (let i = scopes.length - 1; i >= 0; i--) {
    if (pos.line <= scopes[i][2] - 1 && pos.line >= scopes[i][1] - 1) {
      scope = i;
      break;
    }
  }
  if (scope == -1) {
    console.warn("Unknown hover scope");
    return { contents: { kind: "markdown", value: txt } };
  }
  const v = scopeGet(scopes[scope][0], txt);
  if (v == void 0) {
    return void 0;
  }
  return { contents: { kind: "markdown", value: tostringVar(v) } };
}
function getCompletionKind(type) {
  switch (type) {
    case 1 /* Fun */:
      return import_node.CompletionItemKind.Function;
    case 3 /* Struct */:
      return import_node.CompletionItemKind.Class;
    case 4 /* Tag */:
      return import_node.CompletionItemKind.Enum;
    case 0 /* Var */:
      return import_node.CompletionItemKind.Variable;
    case 2 /* Raw */:
      return import_node.CompletionItemKind.Value;
    default:
      return import_node.CompletionItemKind.Text;
  }
}
function getMemberCompletions(variable) {
  const items = [];
  switch (variable.type) {
    case 3 /* Struct */: {
      const struct = variable;
      for (const [name, type] of struct.fields) {
        items.push({
          label: name,
          kind: import_node.CompletionItemKind.Field,
          detail: `field: ${tostringType(type)}`
        });
      }
      for (const [name, type] of struct.staticFields) {
        items.push({
          label: name,
          kind: import_node.CompletionItemKind.Field,
          detail: `static field: ${tostringType(type)}`
        });
      }
      for (const [name, fun] of struct.funs) {
        items.push({
          label: name,
          kind: import_node.CompletionItemKind.Method,
          detail: `method: ${tostringVar(fun)}`
        });
      }
      for (const [name, fun] of struct.staticFuns) {
        items.push({
          label: name,
          kind: import_node.CompletionItemKind.Method,
          detail: `static method: ${tostringVar(fun)}`
        });
      }
      break;
    }
    case 5 /* Namespace */: {
      const namespace = variable;
      for (const [name, member] of namespace.scope.members) {
        items.push({
          label: name,
          kind: getCompletionKind(member.type),
          detail: tostringVar(member)
        });
      }
      break;
    }
    case 4 /* Tag */: {
      const tag = variable;
      for (const [name] of tag.nontagged) {
        items.push({
          label: name,
          kind: import_node.CompletionItemKind.EnumMember,
          detail: `variant`
        });
      }
      for (const [name, type] of tag.tagged) {
        items.push({
          label: name,
          kind: import_node.CompletionItemKind.EnumMember,
          detail: `variant(${tostringType(type)})`
        });
      }
      break;
    }
  }
  return items;
}
function resolveVariableType(scope, varName) {
  const variable = scopeGet(scope, varName);
  if (!variable) return void 0;
  if (variable.type === 0 /* Var */) {
    return variable.t;
  }
  return void 0;
}
function getStructFields(scope, structName) {
  const struct = scopeGet(scope, structName);
  if (struct?.type === 3 /* Struct */) {
    return struct.fields;
  }
  return void 0;
}
function resolveMemberChain(scope, chain) {
  if (chain.length === 0) return void 0;
  let current = scopeGet(scope, chain[0]);
  if (!current) {
    const varType = resolveVariableType(scope, chain[0]);
    if (varType?.type === 10 /* Entity */) {
      current = scopeGet(scope, varType.name);
    }
    if (!current) return void 0;
  }
  for (let i = 1; i < chain.length; i++) {
    const part = chain[i];
    if (!current) return void 0;
    switch (current.type) {
      case 5 /* Namespace */:
        current = current.scope.members.get(part);
        break;
      case 4 /* Tag */:
        const tag = current;
        current = tag.tagged.has(part) || tag.nontagged.has(part) ? current : void 0;
        break;
      case 3 /* Struct */: {
        const struct = current;
        const member = struct.fields.get(part) || struct.staticFields.get(part) || struct.funs.get(part) || struct.staticFuns.get(part);
        if (member && typeof member === "object" && "type" in member) {
          current = member;
        } else {
          current = void 0;
        }
        break;
      }
      default:
        current = void 0;
    }
  }
  return current;
}
conn.onCompletion((params) => {
  const doc = docs.get(params.textDocument.uri);
  if (!doc) {
    console.warn("Received no completion doc");
    return [];
  }
  const pos = params.position;
  let scope = -1;
  for (let i = scopes.length - 1; i >= 0; i--) {
    if (pos.line <= scopes[i][2] - 1 && pos.line >= scopes[i][1] - 1) {
      scope = i;
      break;
    }
  }
  if (scope === -1) {
    console.warn("Received no completion scope");
    return [];
  }
  const text = doc.getText();
  const offset = doc.offsetAt(pos);
  const currentLine = text.substring(text.lastIndexOf("\n", offset - 1) + 1, offset);
  const currentScope = scopes[scope][0];
  const structMatch = currentLine.match(/([a-zA-Z0-9_]+)\s*{\s*$/);
  if (structMatch) {
    const structName = structMatch[1];
    const fields = getStructFields(currentScope, structName);
    if (fields) {
      return Array.from(fields.entries()).map(([name, type]) => ({
        label: name,
        kind: import_node.CompletionItemKind.Field,
        detail: `field: ${tostringType(type)}`,
        insertText: `${name} -> `
      }));
    }
  }
  const lastPart = currentLine.substring(0, offset);
  const memberMatch = lastPart.match(/([a-zA-Z0-9_]+(?:(?::{2}|\.)[a-zA-Z0-9_]*)*(?::{2}|\.)?)$/);
  if (memberMatch) {
    const fullPath = memberMatch[1];
    const parts = fullPath.split(/(?::{2}|\.)/).filter(Boolean);
    const endsWithOperator = fullPath.endsWith("::") || fullPath.endsWith(".");
    if (endsWithOperator) {
      const variable = resolveMemberChain(currentScope, parts.slice(0, -1));
      if (variable) {
        const completions = getMemberCompletions(variable);
        return completions.map((item) => {
          if (variable.type === 4 /* Tag */) {
            item.commitCharacters = ["("];
          } else if (variable.type === 5 /* Namespace */) {
            item.commitCharacters = [":"];
          }
          return item;
        });
      }
      return [];
    }
  }
  const items = [];
  let checkScope = currentScope;
  while (checkScope) {
    for (const [name, member] of checkScope.members) {
      items.push({
        label: name,
        kind: getCompletionKind(member.type),
        detail: tostringVar(member)
      });
    }
    checkScope = checkScope.parent;
  }
  return items;
});
conn.onHover((params) => {
  return serveDocumentHover(params.textDocument.uri, params.position);
});
docs.listen(conn);
conn.listen();
//! Make sure to implement new AST nodes into the astToNotkoyValue() function in std/noktoy.ts
//! HACK ALERT
