import { AnyType, ArrayType, BoolType, EntityType, FunType, LooseRecordType, NoneType, NumberType, OrType, PointerType, StringType, TupleType, Type, TypeType } from "./types.ts";
import { ArrayNode, Ast, AstType, BinaryNode, MatchNode, BoolNode, CallNode, FunDeclNode, IdNode, MemberNode, MemberType, NoneNode, NumberNode, ReturnNode, StringNode, RecordNode, UseBasicNode, UseExpandNode, UseNameNode, UseNode, VarDeclNode, UnaryNode, StructDeclNode, IfNode, WhileNode, ForOfNode, TagDeclNode, ContinueNode, BreakNode, CatchNode, ErrNode, DoNode, ExtNode } from "./ast.ts";
import { Lexer } from "./lexer.ts";
import { Token, TokenType } from "./token.ts";

function constantFold(n: Ast): Ast {
    switch (n.type) {
        case AstType.Binary: {
            const a = constantFold((n as BinaryNode).a);
            const b = constantFold((n as BinaryNode).b);
            const reconstruct = {
                type: AstType.Binary,
                line: (n as BinaryNode).line,
                a,
                b,
                op: (n as BinaryNode).op,
            } as BinaryNode;

            if (a.type == AstType.Number && b.type == AstType.Number) {
                switch ((n as BinaryNode).op) {
                    case '+':
                        return { type: AstType.Number, line: (n as BinaryNode).line, n: (a as NumberNode).n+(b as NumberNode).n } as NumberNode;
                    case '-':
                        return { type: AstType.Number, line: (n as BinaryNode).line, n: (a as NumberNode).n-(b as NumberNode).n } as NumberNode;
                    case '*':
                        return { type: AstType.Number, line: (n as BinaryNode).line, n: (a as NumberNode).n*(b as NumberNode).n } as NumberNode;
                    case '/':
                        return { type: AstType.Number, line: (n as BinaryNode).line, n: (a as NumberNode).n/(b as NumberNode).n } as NumberNode;
                    case '%':
                        return { type: AstType.Number, line: (n as BinaryNode).line, n: (a as NumberNode).n%(b as NumberNode).n } as NumberNode;
                    case '^':
                        return { type: AstType.Number, line: (n as BinaryNode).line, n: (a as NumberNode).n^(b as NumberNode).n } as NumberNode;
                    case '|':
                        return { type: AstType.Number, line: (n as BinaryNode).line, n: (a as NumberNode).n|(b as NumberNode).n } as NumberNode;
                    case '&':
                        return { type: AstType.Number, line: (n as BinaryNode).line, n: (a as NumberNode).n&(b as NumberNode).n } as NumberNode;
                    case '>>':
                        return { type: AstType.Number, line: (n as BinaryNode).line, n: (a as NumberNode).n>>(b as NumberNode).n } as NumberNode;
                    case '<<':
                        return { type: AstType.Number, line: (n as BinaryNode).line, n: (a as NumberNode).n<<(b as NumberNode).n } as NumberNode;
                }
            }

            return reconstruct;
        }
        default:
            return n;
    }
}

export class Parser {
    private previous: Token = { type: TokenType.EOF, value: "", ln: 0 };
    private current: Token;
    private allowFolding: boolean = true;

    constructor(private lexer: Lexer){
        this.current = lexer.next();
    }

    private adv(): Token {
        this.previous = this.current;
        this.current = this.lexer.next();
        return this.previous;
    }

    private expect(t: TokenType): Token {
        this.adv();
        if (this.previous.type != t) {
            this.throw(`expected ${t}, got ${this.previous.type}`);
        }
        return this.previous;
    }

    private throw(msg: string): never {
        throw {msg, ln: this.current.ln}
    }

    public parse(): Ast[] {
        const tree = new Array<Ast>();

        while (this.current.type != TokenType.EOF) {
            tree.push(this.stmt());
        }

        return tree;
    }

    private type(): Type {
        return this.orType();
    }
    
    private orType(): Type {
        const a = this.refType();
        if (this.current.type == TokenType.Pipe) {
            const line = this.adv().ln;
            return { type: TypeType.Or, line, a, b: this.refType() } as OrType;
        }
        return a;
    }

    private refType(): Type {
        if (this.current.type == TokenType.Ampersand) {
            this.adv();
            return { type: TypeType.Pointer, t: this.arrType() } as PointerType;
        }

        return this.arrType();
    }

    private arrType(): Type {
        let t = this.litType();

        while (this.current.type == TokenType.LeftBrack) {
            this.adv();
            this.expect(TokenType.RightBrack);
            t = { type: TypeType.Array, t } as ArrayType;
        }

        return t;
    }

    private litType(): Type {
        switch (this.adv().type) {
            // deno-lint-ignore no-fallthrough
            case TokenType.Id:
                switch (this.previous.value) {
                    case 'fun': {
                        this.expect(TokenType.LeftParen);
                        const params: [string, Type, boolean][] = [];
                        while (this.current.type != TokenType.RightParen) {
                            const x = this.expect(TokenType.Id).value;
                            if (x=='mut') {
                                const name = this.expect(TokenType.Id).value;
                                this.expect(TokenType.Colon);
                                params.push([name, this.type(), true]);
                                continue;
                            }
                            this.expect(TokenType.Colon);
                            params.push([x, this.type(), false]);
                        }

                        this.expect(TokenType.RightParen);
                        return { type: TypeType.Fun, params, ret: this.type() } as FunType;
                    }
                    case 'true':
                        return { type: TypeType.Bool, b: true } as BoolType;
                    case 'false':
                        return { type: TypeType.Bool, b: false } as BoolType;
                    case 'none':
                    case 'None':
                        return { type: TypeType.None } as NoneType;
                    case 'any':
                    case 'Any':
                        return { type: TypeType.Any } as AnyType;
                    case 'Bool':
                    case 'Boolean':
                        return { type: TypeType.Bool, b: undefined } as BoolType;
                    case 'Number':
                        return { type: TypeType.Number, num: undefined } as NumberType;
                    case 'String':
                        return { type: TypeType.String, str: undefined } as StringType;
                    default:
                        return { type: TypeType.Entity, name: this.previous.value } as EntityType;
                }
            case TokenType.Number:
                return { type: TypeType.Number, num: Number(this.previous.value) } as NumberType;
            case TokenType.String:
                return { type: TypeType.String, str: this.previous.value } as StringType;
            case TokenType.LeftParen: {
                const t = this.type();
                this.expect(TokenType.RightParen);
                return t;
            }
            case TokenType.Less: {
                const key = this.type();
                this.expect(TokenType.Colon);
                const value = this.type();
                this.expect(TokenType.Greater);
                return { type: TypeType.LooseRecord, key, value } as LooseRecordType;
            }
            case TokenType.LeftBrack: {
                const members = new Array<Type>();
                while (this.current.type != TokenType.RightBrack) {
                    members.push(this.type());
                    if (this.current.type == TokenType.Comma) {
                        this.adv();
                    }
                }
                this.expect(TokenType.RightBrack);
                return { type: TypeType.Tuple, a: members } as TupleType;
            }
            default:
                this.throw(`unparsed token in type ${this.previous.type}`);
        }
    }

    private varDecl(mutable: boolean): Ast {
        this.adv();
        const name = this.expect(TokenType.Id).value;
        let t: Type = { type: TypeType.Any } as AnyType;
        if (this.current.type == TokenType.Colon) {
            this.adv();
            t = this.type();
        }
        this.expect(TokenType.Equals);
        return { type: AstType.VarDecl, name, t, value: this.expr(), mutable } as VarDeclNode;
    }

    private funDecl(name: string|undefined): Ast {
        const line = this.current.ln;
        this.expect(TokenType.LeftParen);
        
        const params: [string, Type, boolean][] = [];
        while (this.current.type != TokenType.RightParen) {
            let mut = false;
            if (this.current.type == TokenType.Id && this.current.value == 'mut') { //? function parameters are constant by default
                this.adv();
                mut = true;
            }

            const paramName = this.expect(TokenType.Id).value;
            let paramType = { type: TypeType.Any } as AnyType;
            if (this.current.type == TokenType.Colon) {
                this.adv();
                paramType = this.type();
            }
            
            params.push([paramName, paramType, mut]);

            if (this.current.type == TokenType.Comma) {
                this.adv();
            }
        }
        this.expect(TokenType.RightParen);

        let ret = { type: TypeType.Any } as AnyType; //? return type after function (i.e. fun hi(a: Type) ReturnType {})
        if ((this.current as Token).type != TokenType.LeftBrace) {
            ret = this.type();
        }

        this.expect(TokenType.LeftBrace);

        const body: Ast[] = [];

        while ((this.current as Token).type != TokenType.RightBrace) {
            body.push(this.stmt());   
        }

        this.expect(TokenType.RightBrace);
        return { type: AstType.FunDecl, line, name, params, body, ret } as FunDeclNode;
    }

    private use(): Ast {
        let left = this.nameUse();

        while (this.current.type == TokenType.ColonColon) {
            const line = this.adv().ln;
            if ((this.current as Token).type == TokenType.LeftBrace) {
                const body = new Array<UseNode>();
                this.adv();

                while ((this.current as Token).type != TokenType.RightBrace) {
                    body.push(this.use());
                    if ((this.current as Token).type == TokenType.Comma) {
                        this.adv();
                    }
                }

                this.adv();

                return {
                    line,
                    type: AstType.UseExpand,
                    left,
                    body,
                } as UseExpandNode;
            }
            left = {
                type: AstType.UseBasic,
                line,
                left,
                right: this.nameUse(),
            } as UseBasicNode;
        }

        return left;
    }

    private nameUse(): Ast {
        const name = this.expect(TokenType.Id).value;
        if (this.current.type == TokenType.Id && this.current.value == 'as') {
            return {
                type: AstType.UseName,
                line: this.adv().ln,
                name,
                as: this.expect(TokenType.Id).value,
            } as UseNameNode;
        }
        return {
            type: AstType.UseName,
            name,
            as: undefined,
        } as UseNameNode;
    }

    private structDecl(): Ast {
        this.adv();
        const name = this.expect(TokenType.Id).value;
        this.expect(TokenType.LeftBrace);

        const fields = new Map<string, Type>();
        const staticFields = new Map<string, [Type, Ast]>();
        const funs = new Map<string, FunDeclNode>();
        const staticFuns = new Map<string, FunDeclNode>();

        const cycle = (tag: number) => {
            const prev = this.previous;
            const curr = this.current;
            const lx_ptr = this.lexer.ptr;
            const lx_curr = this.lexer.current;
            const name = this.expect(TokenType.Id);
            if (this.current.type == TokenType.LeftParen) {
                // Go back as we've encountered a function
                // (i.e. "Foo() Type {}")
                this.previous = prev;
                this.current = curr;
                this.lexer.ptr = lx_ptr;
                this.lexer.current = lx_curr;
                const f = this.funDecl(this.expect(TokenType.Id).value) as FunDeclNode;
                switch (tag) {
                    case 0:
                        funs.set(f.name as string, f);
                        break;
                    case 1:
                        staticFuns.set(f.name as string, f);
                        break;
                    default:
                        break;
                }
                return;
            }
            // Field
            // (i.e. "Foo Type")
            const t = this.type();
            switch (tag) {
                case 0:
                    fields.set(name.value, t);
                    break;
                case 1: {
                    let val = { type: AstType.None } as NoneNode;
                    if (this.current.type == TokenType.Equals) {
                        this.adv();
                        val = this.expr();
                    }
                    staticFields.set(name.value, [t, val]);
                    break;
                }
                default:
                    this.throw('struct fields can only be static or default');
            }
        }

        while (this.current.type != TokenType.RightBrace) {
            switch (this.current.type) {
                case TokenType.Not:
                    this.adv();
                    cycle(1);
                    break;
                default:
                    cycle(0);
                    break;
            }
        }

        this.expect(TokenType.RightBrace);
        return { type: AstType.StructDecl, name, fields, staticFields, funs, staticFuns } as StructDeclNode;
    }

    private if(): IfNode {
        const cond = this.expr();
        const body = [];
        this.expect(TokenType.LeftBrace);
        while ((this.current as Token).type != TokenType.RightBrace) {
            body.push(this.stmt());
        }
        this.expect(TokenType.RightBrace);
        if (this.current.type == TokenType.Id && this.current.value == 'els') {
            this.adv();
            if ((this.current as Token).type == TokenType.Id && (this.current as Token).value == 'if') {
                this.adv();
                return { type: AstType.If, cond, body, elseT: 1, else: this.if() } as IfNode;
            }
            const els = [];
            this.expect(TokenType.LeftBrace);
            while ((this.current as Token).type != TokenType.RightBrace) {
                els.push(this.stmt());
            }
            this.expect(TokenType.RightBrace);
            return { type: AstType.If, cond, body, elseT: 2, else: els } as IfNode;
        }
        return { type: AstType.If, cond, body, elseT: 0, else: undefined } as IfNode;
    }

    private while(): Ast {
        this.adv();
        const cond = this.expr();
        const body = [];
        this.expect(TokenType.LeftBrace);
        while (this.current.type != TokenType.RightBrace) {
            body.push(this.stmt());
        }
        this.expect(TokenType.RightBrace);
        return { type: AstType.While, cond, body } as WhileNode;
    }

    private stmt(): Ast {
        if (this.current.type == TokenType.Id) {
            switch (this.current.value) {
                case 'let':
                    return this.varDecl(false);
                case 'mut':
                    return this.varDecl(true);
                case 'fun':
                    this.adv();
                    return this.funDecl(this.expect(TokenType.Id).value);
                case 'use':
                    this.adv();
                    return this.use();
                case 'str':
                    return this.structDecl();
                case 'whl':
                    return this.while();
                case 'for': {
                    this.adv();
                    const started = (this.current as Token).type == TokenType.LeftParen;
                    if (started) {
                        this.adv();
                    }
                    const a = this.expect(TokenType.Id);
                    if ((this.current as Token).type == TokenType.Comma) {
                        this.adv();
                    }
                    const b = this.expect(TokenType.Id).value;
                    if (this.expect(TokenType.Id).value != 'of') {
                        this.throw('expected of keyword following (proper syntax is for <name>, <name> of <exp> { <...stmt> })');
                    }
                    const iterator = this.expr();
                    if (started) {
                        this.expect(TokenType.RightParen);
                    }
                    const body = [];
                    this.expect(TokenType.LeftBrace);
                    while ((this.current as Token).type != TokenType.RightBrace) {
                        body.push(this.stmt());
                    }
                    this.expect(TokenType.RightBrace);
                    return { type: AstType.ForOf, line: a.ln, a: a.value, b, body, iterator } as ForOfNode;
                }
                case 'err': {
                    this.adv();
                    return { type: AstType.Err, val: this.expr() } as ErrNode;
                }
                case 'cnt': {
                    this.adv();
                    return { type: AstType.Continue } as ContinueNode;
                }
                case 'brk': {
                    this.adv();
                    return { type: AstType.Break } as BreakNode;
                }
                case 'tag': {
                    this.adv();
                    const name = this.expect(TokenType.Id).value;
                    const tagged = new Map<string, Type>();
                    const nontagged = new Map<string, undefined>();
                    this.expect(TokenType.LeftBrace);
                    while ((this.current as Token).type != TokenType.RightBrace) {
                        const n = this.expect(TokenType.Id).value;
                        if ((this.current as Token).type == TokenType.LeftParen) {
                            this.adv();
                            const t = this.type();
                            this.expect(TokenType.RightParen);
                            tagged.set(n, t);
                        } else {
                            nontagged.set(n, undefined);
                        }

                        if ((this.current as Token).type == TokenType.Comma) {
                            this.adv();
                        }
                    }

                    this.expect(TokenType.RightBrace);
                    return { type: AstType.TagDecl, name, tagged, nontagged } as TagDeclNode;
                }
                case 'ret':
                    return { type: AstType.Return, line: this.adv().ln, value: this.expr() } as ReturnNode;
            }
        }
        const e = this.expr();
        if (this.current.type == TokenType.Semicolon) {
            this.adv();
        }
        return e;
    }

    private expr(): Ast {
        let e = this.cat();
        if (this.current.type == TokenType.Semicolon) {
            this.adv();
        }
        if (this.allowFolding) {
            e = constantFold(e);
        }
        return e;
    }

    private cat(): Ast {
        const exp = this.assign();
        if (this.current.type == TokenType.Id && this.current.value == 'cat') {
            this.adv();
            const name = this.expect(TokenType.Id).value;
            const body = [];
            this.expect(TokenType.LeftBrace);
            while ((this.current as Token).type != TokenType.RightBrace) {
                body.push(this.stmt());
            }
            this.expect(TokenType.RightBrace);
            return { type: AstType.Catch, exp, name, body } as CatchNode;
        }
        return exp;
    }

    private assign(): Ast {
        const left = this.or();

        if (this.current.type == TokenType.Equals) {
            return {
                type: AstType.Binary,
                a: left,
                line: this.current.ln,
                op: this.adv().value,
                b: this.assign(),
            } as BinaryNode;
        }

        return left;
    }

    private or(): Ast {
        let left = this.nullish();

        while (this.current.type == TokenType.Or) {
            left = {
                type: AstType.Binary,
                a: left,
                line: this.current.ln,
                op: this.adv().value,
                b: this.nullish(),
            } as BinaryNode; 
        }

        return left;
    }

    private nullish(): Ast {
        let left = this.and();

        while (this.current.type == TokenType.QuestionQuestion) {
            left = {
                type: AstType.Binary,
                a: left,
                line: this.current.ln,
                op: this.adv().value,
                b: this.and(),
            } as BinaryNode; 
        }

        return left;
    }

    private and(): Ast {
        let left = this.equal();

        while (this.current.type == TokenType.And) {
            left = {
                type: AstType.Binary,
                a: left,
                line: this.current.ln,
                op: this.adv().value,
                b: this.equal(),
            } as BinaryNode; 
        }

        return left;
    }

    private equal(): Ast {
        let left = this.cmp();

        while (this.current.type == TokenType.EqualsEquals || this.current.type == TokenType.NotEquals) {
            left = {
                type: AstType.Binary,
                a: left,
                line: this.current.ln,
                op: this.adv().value,
                b: this.cmp(),
            } as BinaryNode; 
        }

        return left;
    }

    private cmp(): Ast {
        let left = this.shift();
        const ops = {
            [TokenType.GreaterEquals]: true,
            [TokenType.Greater]: true,
            [TokenType.LessEquals]: true,
            [TokenType.Less]: true,
        };

        while (this.current.type in ops) {
            left = {
                type: AstType.Binary,
                a: left,
                line: this.current.ln,
                op: this.adv().value,
                b: this.shift(),
            } as BinaryNode; 
        }

        return left;
    }

    private shift(): Ast {
        let left = this.bitwise();
        const ops = {
            [TokenType.LeftShift]: true,
            [TokenType.RightShift]: true,
        };

        while (this.current.type in ops) {
            left = {
                type: AstType.Binary,
                a: left,
                line: this.current.ln,
                op: this.adv().value,
                b: this.bitwise(),
            } as BinaryNode; 
        }

        return left;
    }

    private bitwise(): Ast {
        let left = this.con();
        const ops = {
            [TokenType.Pipe]: true,
            [TokenType.Ampersand]: true,
        };

        while (this.current.type in ops) {
            left = {
                type: AstType.Binary,
                a: left,
                line: this.current.ln,
                op: this.adv().value,
                b: this.con(),
            } as BinaryNode; 
        }

        return left;
    }

    private con(): Ast {
        let left = this.term();
        while (this.current.type == TokenType.DotDot) {
            left = { type: AstType.Binary, line: this.adv().ln, a: left, b: this.term(), op: '..' } as BinaryNode;
        }

        return left;
    }

    private term(): Ast {
        let left = this.factor();

        while (this.current.type == TokenType.Plus || this.current.type == TokenType.Minus) {
            left = {
                type: AstType.Binary,
                a: left,
                line: this.current.ln,
                op: this.adv().value,
                b: this.factor(),
            } as BinaryNode; 
        }

        return left;
    }

    private factor(): Ast {
        let left = this.pow();
        if (this.current.type == TokenType.Star && left.type == AstType.Unary && (left as UnaryNode).op == '&') {
            //! HACK ALERT
            // When you get something like this:
            // 1. mut x: &Number = &3
            // 2. *x = 4
            // The parser would think you're multiplying the reference to 3 by x ('&3 * x').
            // This fixes that.
            return left;
        }

        while (this.current.type == TokenType.Star || this.current.type == TokenType.Slash || this.current.type == TokenType.Percent) {
            left = {
                type: AstType.Binary,
                a: left,
                line: this.current.ln,
                op: this.adv().value,
                b: this.pow(),
            } as BinaryNode; 
        }

        return left;
    }

    private pow(): Ast {
        let left = this.unary();

        while (this.current.type == TokenType.Caret) {
            left = {
                type: AstType.Binary,
                a: left,
                line: this.current.ln,
                op: this.adv().value,
                b: this.unary(),
            } as BinaryNode; 
        }

        return left;
    }

    private unary(): Ast {
        const ops = {
            [TokenType.Not]: true,
            [TokenType.Minus]: true,
            [TokenType.Star]: true,
            [TokenType.Ampersand]: true,
        };
        if (this.current.type in ops) {
            const token = this.adv();
            return {
                type: AstType.Unary,
                line: token.ln,
                op: token.value,
                right: this.unary(),
            } as UnaryNode;
        }

        return this.callMember();
    }

    private callMember(): Ast {
        let left = this.lit();

        while (true) {
            if (this.current.type == TokenType.LeftParen) {
                left = this.call(left);
            } else if (this.current.type in {
                [TokenType.LeftBrack]: true,
                [TokenType.Dot]: true,
                [TokenType.ColonColon]: true,
                [TokenType.Colon]: true,
            }) {
                const op = this.adv();
                let right;
                if (op.type == TokenType.LeftBrack) {
                    right = this.expr()
                    this.expect(TokenType.RightBrack);
                } else {
                    right = { type: AstType.Id, i: this.expect(TokenType.Id).value } as IdNode;
                }
                left = {
                    type: AstType.Member,
                    kind: ({
                        [TokenType.LeftBrack]: MemberType.Computed,
                        [TokenType.Dot]: MemberType.Default,
                        [TokenType.ColonColon]: MemberType.NamespaceAccess,
                        [TokenType.Colon]: MemberType.CallSelf,
                    // deno-lint-ignore no-explicit-any
                    } as any)[op.type],
                    right,
                    left,
                    line: op.ln,
                } as MemberNode;
            } else {
                break;
            }
        }

        return left;
    }

    private call(caller: Ast): Ast {
        const line = this.adv().ln;
        const args: Ast[] = [];
        this.allowFolding = false; //? We disallow constant folding here to give raw access to AST in native
                                   //? macro calls (i.e. playground/macros.noktoy) wouldn't work without this
        while (this.current.type != TokenType.RightParen) {
            args.push(this.expr());
            if (this.current.type == TokenType.Comma) {
                this.adv();
            }
        }
        this.allowFolding = true;
        this.adv();

        const call = { type: AstType.Call, args, caller, line } as CallNode;
        if ((this.current as Token).type == TokenType.LeftParen) {
            return this.call(call);
        }

        return call;
    }

    private lit(): Ast {
        const a = this.adv();
        switch (a.type) {
            case TokenType.LeftParen: {
                const e = this.expr();
                this.expect(TokenType.RightParen);
                return e;
            }
            case TokenType.Number:
                return { line: a.ln, type: AstType.Number, n: Number(a.value) } as NumberNode;
            case TokenType.String:
                return { line: a.ln, type: AstType.String, s: a.value } as StringNode;
            case TokenType.LeftBrack: {
                const arr = new Array<Ast>();
                
                while (this.current.type != TokenType.RightBrack) {
                    arr.push(this.expr());
                    if (this.current.type == TokenType.Comma) {
                        this.adv();
                    }
                }

                this.expect(TokenType.RightBrack);
                return { type: AstType.Array, body: arr } as ArrayNode;
            }
            case TokenType.LeftBrace:
                return this.record(undefined);
            case TokenType.Id:
                switch (a.value) {
                    case 'ext':
                        return { type: AstType.Ext, file: this.expr() } as ExtNode;
                    case 'none':
                        return { line: a.ln, type: AstType.None } as NoneNode;
                    case 'true':
                        return { line: a.ln, type: AstType.Bool, b: true } as BoolNode;
                    case 'false':
                        return { line: a.ln, type: AstType.Bool, b: false } as BoolNode;
                    case 'if':
                        return this.if();
                    case 'do': {
                        const body = [];
                        this.expect(TokenType.LeftBrace);
                        while ((this.current as Token).type != TokenType.RightBrace) {
                            body.push(this.stmt());
                        }
                        this.expect(TokenType.RightBrace);
                        return { type: AstType.Do, body } as DoNode;
                    }
                    case 'fun':
                        return this.funDecl(undefined);
                    case 'mat': {
                        const cond = this.expr();
                        this.expect(TokenType.LeftBrace);
                        const body = new Map();
                        let def: Ast[] | undefined = undefined;
                        while (this.current.type != TokenType.RightBrace) {
                            if (this.current.type == TokenType.Id && this.current.value == '_') {
                                this.adv();
                                const matchBody = [];
                                this.expect(TokenType.LeftBrace);
                                while ((this.current as Token).type != TokenType.RightBrace) {
                                    matchBody.push(this.stmt());
                                }
                                this.expect(TokenType.RightBrace);
                                def = matchBody;
                                continue;
                            }
                            const matches = [];
                            while (this.current.type != TokenType.LeftBrace) {
                                matches.push(this.expr());

                                if (this.current.type == TokenType.Comma) {
                                    this.adv();
                                }
                            }
                            const matchBody = [];
                            this.expect(TokenType.LeftBrace);
                            while ((this.current as Token).type != TokenType.RightBrace) {
                                matchBody.push(this.stmt());
                            }
                            this.expect(TokenType.RightBrace);
                            body.set(matches, matchBody);
                        }

                        this.expect(TokenType.RightBrace);
                        return { type: AstType.Match, cond, body, default: def } as MatchNode;
                    }
                    default:
                        if (this.current.type == TokenType.LeftBrace) { //? Name{} syntax
                            this.adv();
                            return this.record(a.value);
                        }
                        return { line: a.ln, type: AstType.Id, i: a.value } as IdNode;
                }
            default:
                this.throw(`token ${a.type} unparsed`);
        }
    }

    private record(name: string | undefined): RecordNode {
        const line = this.previous.ln;
        const body = new Map<Ast, Ast>();

        while (this.current.type != TokenType.RightBrace) {
            const k = this.expr();
            if (this.current.type == TokenType.Arrow) {
                this.adv();
            }
            body.set(k, this.expr());
            if (this.current.type == TokenType.Comma) {
                this.adv();
            }
        }

        this.expect(TokenType.RightBrace);
        return { type: AstType.Record, line, body, name } as RecordNode;
    }
}