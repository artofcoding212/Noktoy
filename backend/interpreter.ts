import { ArrayNode, Ast, AstType, BinaryNode, BoolNode, CallNode, CatchNode, DoNode, ErrNode, ExtNode, ForOfNode, FunDeclNode, IdNode, IfNode, MatchNode, MemberNode, MemberType, NumberNode, RecordNode, ReturnNode, StringNode, StructDeclNode, TagDeclNode, UnaryNode, UseBasicNode, UseExpandNode, UseNameNode, UseNode, VarDeclNode, WhileNode } from "../frontend/ast.ts";
import { Lexer } from "../frontend/lexer.ts";
import { Parser } from "../frontend/parser.ts";
import { AnyType, FunType, LooseRecordType, satisfiesType, tostringType, Type, TypeType, ArrayType, TupleType, EntityType, NumberType } from "../shared/types.ts";
import { BoolValue, NoneValue, NumberValue, NativeMacroValue, StringValue, tostring, Value, ValueType, FunValue, NamespaceValue, NativeFunValue, ArrayValue, ObjectValue, PointerValue, StaticStructValue, StructValue, falsey, TagValue, StaticTagValue } from "../shared/values.ts";
import { lib } from '../std/stdlib.ts';

export interface Variable {
    mutable: boolean,
    value: Value,
    type: Type,
}

export interface Scope {
    parent: Scope|undefined,
    members: Map<string, Variable>,
}

function scopeGet(scope: Scope, name: string): [Variable|undefined, Scope] {
    const v = scope.members.get(name);
    if (v==undefined) {
        return scope.parent == undefined ? [undefined, scope] : scopeGet(scope.parent, name);
    } 
    return [v, scope];
}

export class Interpreter {
    public globalScope: Scope = { parent: undefined, members: new Map() };
    public stack: Value[] = [];
    private last: Value = { type: ValueType.None } as NoneValue;
    private exit: boolean = false;
    private cnt: boolean = false;
    private canCnt: boolean[] = [false];
    private pointerCache: Map<string, number> = new Map();
    
    constructor(
        public ast: Ast[],
        public currentFile: string
    ) {
        this.globalScope.members.set("Std", {
            mutable: false,
            type: { type: TypeType.Any } as AnyType,
            value: {
                type: ValueType.Namespace,
                scope: { parent: undefined, members: lib },
            } as NamespaceValue,
        });
    }

    public async eval(): Promise<Value> {
        const len = this.ast.length;
        let ptr = 0;
        this.last = { type: ValueType.None } as NoneValue;
        
        while (ptr<len) {
            this.last = await this.run(this.ast[ptr++], this.globalScope);
        }

        return this.last;
    }

    private async runBlock(body: Ast[], oldScope: Scope, raw?: boolean): Promise<[Value, number]> {
        let lastLine = 0;
        this.last = { type: ValueType.None } as NoneValue;
        const scope = raw ? oldScope : { parent: oldScope, members: new Map() } as Scope;

        for (const node of body) {
            lastLine = node.line;
            try {
                if (node.type == AstType.Return) {
                    this.last = await this.run((node as ReturnNode).value, scope);
                    this.exit = true;
                    break;
                }
                this.last = await this.run(node, scope);
            } catch (e) {
                if (e != null && typeof e == 'object' && 'type' in e) {
                    throw e;
                } else {
                    throw `${e} (line ${lastLine})`;
                }
            }

            if (this.exit==true || this.cnt == true) {
                break;
            }
        }

        if (!raw) {
            scope.members.clear();
            scope.parent = undefined;
        }

        return [this.last, lastLine];
    }

    public async runFunRaw(fun: FunValue, args: Value[], scope: Scope): Promise<Value> {
        if (fun.t.params.length != args.length) {
            throw `expected function signature ${tostringType(fun.t)} when calling`;
        }

        for (let i=0; i<args.length; i++) {
            if (!satisfiesType(args[i], fun.t.params[i][1], this, scope)) {
                throw `expected function signature ${tostringType(fun.t)} when calling`;
            }
            scope.members.set(fun.t.params[i][0], {
                type: fun.t.params[i][1],
                value: args[i],
                mutable: fun.t.params[i][2],
            });
        }

        const [ret, lastLine] = await this.runBlock(fun.body, scope, true);

        if (!satisfiesType(ret, fun.t.ret, this, scope)) {
            throw `function return ${tostring(ret, this)} does not satisfy expected return type ${tostringType(fun.t.ret)} (line ${lastLine})`;
        }

        if (this.exit == true) {
            this.exit = false;
        }

        return ret;
    }

    public async runFun(fun: FunValue, args: Value[], oldScope: Scope): Promise<Value> {
        if (fun.t.params.length != args.length) {
            throw `expected function signature ${tostringType(fun.t)} when calling`;
        }
        const tmp = this.currentFile;
        this.currentFile = fun.file;
        const scope = { parent: oldScope, members: new Map() } as Scope;
        for (let i=0; i<args.length; i++) {
            if (!satisfiesType(args[i], fun.t.params[i][1], this, scope)) {
                throw `expected function signature ${tostringType(fun.t)} when calling`;
            }
            scope.members.set(fun.t.params[i][0], {
                type: fun.t.params[i][1],
                value: args[i],
                mutable: fun.t.params[i][2],
            });
        }

        const [ret, lastLine] = await this.runBlock(fun.body, scope);

        if (!satisfiesType(ret, fun.t.ret, this, scope)) {
            throw `function return ${tostring(ret, this)} does not satisfy expected return type ${tostringType(fun.t.ret)} (line ${lastLine})`;
        }

        if (this.exit == true) {
            this.exit = false;
        }

        scope.parent = undefined;
        scope.members.clear();
        this.currentFile = tmp;
        return ret;
    }

    private useName(n: UseNameNode, scope: Scope): [Variable, string] {
        const [val, _] = scopeGet(scope, n.name);
        if (val==undefined) {
            throw `couldn't find ${n.name} on namespace (line ${n.line})`;
        }

        return [val, n.as || n.name];
    }

    private useBasic(n: UseBasicNode, scope: Scope): [Variable, string] {
        if (n.left.type == AstType.UseName) {
            const [val, _] = scopeGet(scope, (n.left as UseNameNode).name);
            if (val==undefined || val.value.type != ValueType.Namespace) {
                throw `couldn't find namespace ${(n.left as UseNameNode).name} (line ${n.line})`;
            }
            const [access] = scopeGet((val.value as NamespaceValue).scope, n.right.name);
            if (access==undefined) {
                throw `field ${n.right.name} doesn't exist on the specified use namespace (line ${n.line})`;
            }

            return [access, n.right.as || n.right.name];
        }

        const [ns, _] = this.useBasic(n.left as UseBasicNode, scope);
        if (ns.value.type != ValueType.Namespace) {
            throw `can only use access on namespaces (line ${n.line})`;
        }
        const [access] = scopeGet((ns.value as NamespaceValue).scope, n.right.name);
        if (access==undefined) {
            throw `field ${n.right.name} doesn't exist on the specified use namespace (line ${n.line})`;
        }
        return [access, n.right.as || n.right.name];
    }

    private useExpand(use: UseExpandNode, scope: Scope, mainScope: Scope) {
        let l: Variable;
        if (use.left.type == AstType.UseBasic) {
            l = this.useBasic(use.left as UseBasicNode, scope)[0];
        } else {
            l = this.useName(use.left as UseNameNode, scope)[0];
        }
        if (l.value.type != ValueType.Namespace) {
            throw `can only use accesses on namespaces (line ${use.line})`;
        }

        for (const u of use.body) {
            this.use(u, (l.value as NamespaceValue).scope, mainScope);
        }
    }

    private use(use: UseNode, targetScope: Scope, mainScope: Scope) {
        switch (use.type) {
            case AstType.UseBasic: {
                const [val, name] = this.useBasic(use as UseBasicNode, targetScope);
                mainScope.members.set(name, val);
                break;
            }
            case AstType.UseName: {
                const [val, name] = this.useName(use as UseNameNode, targetScope);
                mainScope.members.set(name, val);
                break;
            }
            case AstType.UseExpand:
                this.useExpand(use as UseExpandNode, targetScope, mainScope);
                break;
        }
    }

    public async run(node: Ast, scope: Scope): Promise<Value> {
        switch (node.type) {
            case AstType.Ext: {
                const f = await this.run((node as ExtNode).file, scope);
                if (f.type != ValueType.String) {
                    throw `expected string to externally include from (line ${node.line})`;
                }
                let a = { type: ValueType.None } as NoneValue;
                try {
                    const i = new Interpreter(
                        new Parser(
                            new Lexer(Deno.readTextFileSync((f as StringValue).value))
                        ).parse(), (f as StringValue).value
                    );
                    await i.eval();
                    a = { type: ValueType.Namespace, scope: i.globalScope } as NamespaceValue;
                } catch (e) {
                    if (e != null && typeof e == 'object' && 'type' in e) {
                        throw e;
                    } else {
                        throw `${e} (in file ${(f as StringValue).value}, externally included at line ${node.line})`;
                    }
                }
                return a;
            }
            case AstType.TagDecl: {
                scope.members.set((node as TagDeclNode).name, {
                    mutable: false,
                    value: {
                        type: ValueType.StaticTag,
                        nontagged: (node as TagDeclNode).nontagged,
                        tagged: (node as TagDeclNode).tagged,
                    } as StaticTagValue,
                    type: { type: TypeType.Entity, name: (node as TagDeclNode).name } as EntityType,
                });
                return { type: ValueType.None } as NoneValue;
            }
            case AstType.StructDecl: {
                const funs = new Map<string, FunValue>();
                for (const [k,fn] of (node as StructDeclNode).funs) {
                    funs.set(k, {
                        type: ValueType.Fun,
                        t: {
                            type: TypeType.Fun,
                            ret: fn.ret,
                            params: fn.params
                        } as FunType,
                        name: fn.name,
                        body: fn.body,
                        file: this.currentFile,
                        scope: { parent: scope, members: new Map() } as Scope,
                    } as FunValue);
                }
                const staticFields = new Map<string, [Type, Value]>();
                const fieldSubscope = { parent: scope, members: new Map() } as Scope;
                for (const [k,[t,n]] of (node as StructDeclNode).staticFields) {
                    const v = await this.run(n, fieldSubscope);
                    if (!satisfiesType(v, t, this, scope)) {
                        throw `static field ${k} on struct ${(node as StructDeclNode).name}'s type of ${tostringType(t)} does not satisfy ${tostring(v, this)}`;
                    }
                    staticFields.set(k,[t,v]);
                }
                const staticFuns = new Map<string, FunValue>();
                for (const [k,fn] of (node as StructDeclNode).staticFuns) {
                    staticFuns.set(k, {
                        type: ValueType.Fun,
                        t: {
                            type: TypeType.Fun,
                            ret: fn.ret,
                            params: fn.params
                        } as FunType,
                        name: fn.name,
                        body: fn.body,
                        file: this.currentFile,
                        scope: { parent: scope, members: new Map() } as Scope,
                    } as FunValue);
                }

                scope.members.set((node as StructDeclNode).name, {
                    mutable: false,
                    value: { type: ValueType.StaticStruct, funs, staticFields, staticFuns, fields: (node as StructDeclNode).fields } as StaticStructValue,
                    type: { type: TypeType.Entity, name: (node as StructDeclNode).name } as EntityType,
                });

                return { type: ValueType.None } as NoneValue;
            }
            case AstType.If: {
                const newScope = { parent: scope, members: new Map() } as Scope;
                if (!falsey(await this.run((node as IfNode).cond, newScope))) {
                    return (await this.runBlock((node as IfNode).body, newScope))[0];
                }
                switch ((node as IfNode).elseT) {
                    case 1:
                        return await this.run((node as IfNode).else as IfNode, scope);
                    case 2:
                        return (await this.runBlock((node as IfNode).else as Ast[], { parent: scope, members: new Map() } as Scope))[0];
                    default:
                        return { type: ValueType.None } as NoneValue;
                }
            }
            case AstType.ForOf: {
                const iterator = await this.run((node as ForOfNode).iterator, scope);
                this.canCnt.push(true);
                switch (iterator.type) {
                    case ValueType.Array: {
                        let i = 0;
                        while (i<(iterator as ArrayValue).val.length) {
                            const newScope = { parent: scope, members: new Map() } as Scope;
                            const prevI = i;
                            newScope.members.set((node as ForOfNode).a, {
                                type: { type: TypeType.Number } as NumberType,
                                value: { type: ValueType.Number, value: i } as NumberValue,
                                mutable: true,
                            });
                            newScope.members.set((node as ForOfNode).b, {
                                type: (iterator as ArrayValue).t ?? { type: TypeType.Any } as AnyType,
                                value: (iterator as ArrayValue).val[i],
                                mutable: true,
                            });
                            
                            await this.runBlock((node as ForOfNode).body, newScope);
                            if (this.exit == true) {
                                this.exit = false;
                                break;
                            }

                            if (prevI != ((newScope.members.get((node as ForOfNode).a) as Variable).value as NumberValue).value) { //? allow for i, _ of array to change index
                                i = ((newScope.members.get((node as ForOfNode).a) as Variable).value as NumberValue).value;
                            } else {
                                i++;
                            }

                            if (this.cnt == true) {
                                this.cnt = false;
                                continue;
                            }
                        }
                        this.canCnt.pop();
                        return this.last;
                    }
                    case ValueType.Object: {
                        for (const [k,v] of (iterator as ObjectValue).val) {
                            const newScope = { parent: scope, members: new Map() } as Scope;
                            newScope.members.set((node as ForOfNode).a, {
                                type: (iterator as ObjectValue).t == undefined ? { type: TypeType.Any } as AnyType : ((iterator as ObjectValue).t?.key ?? { type: TypeType.Any } as AnyType),
                                value: JSON.parse(k) as Value,
                                mutable: true,
                            });
                            newScope.members.set((node as ForOfNode).b, {
                                type: (iterator as ObjectValue).t == undefined ? { type: TypeType.Any } as AnyType : ((iterator as ObjectValue).t?.value ?? { type: TypeType.Any } as AnyType),
                                value: v,
                                mutable: true,
                            });

                            await this.runBlock((node as ForOfNode).body, newScope);
                            if (this.exit == true) {
                                this.exit = false;
                                break;
                            }
                            if (this.cnt == true) {
                                this.cnt = false;
                                continue;
                            }
                        }
                        this.canCnt.pop();
                        return this.last;
                    }
                    default:
                        throw `can only iterate through arrays and records`;
                }
            }
            case AstType.Break: {
                if (!this.canCnt) {
                    throw `can only break out of while loops & for loops (line ${node.line})`;
                }

                this.cnt = true;
                return { type: ValueType.None } as NoneValue;
            }
            case AstType.Err: {
                throw await this.run((node as ErrNode).val, scope);
            }
            case AstType.Do: {
                const x = (await this.runBlock((node as DoNode).body, scope))[0];
                if (this.exit==true) {
                    this.exit = false;
                }
                return x;
            }
            case AstType.Catch: {
                let l = { type: ValueType.None } as NoneValue;
                try {
                    l = await this.run((node as CatchNode).exp, scope);
                } catch (e) {
                    if (e != null && typeof e == 'object' && 'type' in e) {
                        const newScope = { parent: scope, members: new Map() } as Scope;
                        newScope.members.set((node as CatchNode).name, {
                            mutable: false,
                            type: { type: TypeType.Any } as AnyType,
                            value: e as Value,
                        });
                        l = (await this.runBlock((node as CatchNode).body, newScope))[0];
                    } else {
                        throw e;
                    }
                }
                return l;
            }
            case AstType.Continue: {
                if (!this.canCnt) {
                    throw `can only continue out of while loops & for loops (line ${node.line})`;
                }
                
                this.cnt = true;
                return { type: ValueType.None } as NoneValue;
            }
            case AstType.While: {
                while (!falsey(await this.run((node as WhileNode).cond, scope))) {
                    this.canCnt.push(true);
                    (await this.runBlock((node as WhileNode).body, { parent: scope, members: new Map() } as Scope));
                    if (this.exit==true) {
                        this.exit = false;
                        break;
                    }
                    if (this.cnt == true) {
                        this.cnt = false;
                        continue;
                    }
                }
                this.canCnt.pop();
                return { type: ValueType.None } as NoneValue;
            }
            case AstType.VarDecl: {
                const decl = node as VarDeclNode;
                const val = await this.run(decl.value, scope);
                if (!satisfiesType(val, decl.t, this, scope)) {
                    throw `type ${tostringType(decl.t)} on variable '${decl.name}' does not satisfy ${tostring(val, this)} (line ${node.line})`;
                }
                if (scope.members.has(decl.name)) { // We allow variable shadowing, but not in the current scope
                    throw `variable '${decl.name}' already exists in scope, reassign with "${decl.name} = ${tostring(val, this)} (line ${node.line})"`;
                }
                scope.members.set(decl.name, {
                    mutable: decl.mutable,
                    value: val,
                    type: decl.t,
                });
                return val;
            }
            case AstType.Id: {
                const [a,_] = scopeGet(scope, (node as IdNode).i);
                if (a==undefined) {
                    throw `variable ${(node as IdNode).i} is either out-of-scope or hasn't been declared (line ${node.line})`;
                }
                return a.value;
            }
            case AstType.UseBasic:
            case AstType.UseName:
            case AstType.UseExpand:
                this.use(node as UseNode, scope, scope);
                return { type: ValueType.None } as NoneValue;
            case AstType.FunDecl: {
                const fn = node as FunDeclNode;
                const t: FunType = {
                    type: TypeType.Fun,
                    ret: fn.ret,
                    params: fn.params
                };
                if (fn.name == undefined) {
                    return {
                        type: ValueType.Fun,
                        t,
                        name: undefined,
                        body: fn.body,
                        file: this.currentFile,
                        scope: { parent: scope, members: new Map() } as Scope,
                    } as FunValue;
                }
                scope.members.set(fn.name, {
                    mutable: false,
                    value: {
                        type: ValueType.Fun,
                        t,
                        name: fn.name,
                        body: fn.body,
                        file: this.currentFile,
                        scope: { parent: scope, members: new Map() } as Scope,
                    } as FunValue,
                    type: t,
                });

                return { type: ValueType.None } as NoneValue;
            }
            case AstType.Record: {
                if ((node as RecordNode).name != undefined) {
                    const [parentContainer] = scopeGet(scope, (node as RecordNode).name as string);
                    if (parentContainer==undefined || parentContainer.value.type != ValueType.StaticStruct) {
                        throw `${(node as RecordNode).name}{} syntax can only accept a static structure (line ${node.line})`;
                    }
                    const parent = parentContainer.value as StaticStructValue;

                    const fields = new Map<string, [Value, Type]>();
                    for (const [k,v] of (node as RecordNode).body) {
                        if (k.type != AstType.Id) {
                            throw `${(node as RecordNode).name}{} syntax only supports id keys (line ${node.line})`;
                        }
                        
                        if (!parent.fields.has((k as IdNode).i)) {
                            throw `static struct ${(node as RecordNode).name} does not have the field ${(k as IdNode).i} (line ${node.line})`;
                        }

                        const newV = await this.run(v, scope);
                        const t = parent.fields.get((k as IdNode).i) as Type;

                        if (!satisfiesType(newV, t, this, scope)) {
                            throw `field ${(k as IdNode).i} on static struct ${(node as RecordNode).name}'s type of ${tostringType(t)} does not satisfy ${tostring(newV, this)} (line ${node.line})`;
                        }

                        fields.set(
                            (k as IdNode).i,
                            [newV, t]
                        );
                    }
                    if (fields.keys().toArray().length != parent.fields.keys().toArray().length) {
                        throw `static struct ${(node as RecordNode).name} expects ${parent.fields.keys().toArray().length} field(s), got ${fields.keys().toArray().length} field(s) (line ${node.line})`;
                    }

                    return { type: ValueType.Struct, parent, fields } as StructValue;
                }

                const val = new Map<string, Value>();
                for (const [k,v] of (node as RecordNode).body) {
                    val.set(JSON.stringify(
                        k.type == AstType.Id ? {
                            type: ValueType.String,
                            value: (k as IdNode).i,
                        } as StringValue : await this.run(k, scope)
                    ), await this.run(v, scope));
                }
                return { type: ValueType.Object, val, t: undefined } as ObjectValue;
            }
            case AstType.Call: {
                if ((node as CallNode).caller.type == AstType.Member) {
                    const k = ((node as CallNode).caller as MemberNode).kind;
                    if (k == MemberType.CallSelf) {
                        const str: Value = await this.run(((node as CallNode).caller as MemberNode).left, scope);
                        if (str.type != ValueType.StaticStruct && str.type != ValueType.Struct) {
                            throw `the <name>:<name>() syntax only works on structures (line ${node.line})`;
                        }
                        const args: Value[] = [str];
                        for (const arg of (node as CallNode).args) {
                            args.push(await this.run(arg, scope));
                        }
                        const fn = str.type == ValueType.StaticStruct
                            ? (str as StaticStructValue).staticFuns.get((((node as CallNode).caller as MemberNode).right as IdNode).i)
                            : (str as StructValue).parent.funs.get((((node as CallNode).caller as MemberNode).right as IdNode).i);
                        if (fn==undefined) {
                            throw `field ${(((node as CallNode).caller as MemberNode).right as IdNode).i} doesn't exist on struct (line ${node.line})`;
                        }
                        try {
                            if (fn.type == ValueType.Fun) {
                                return await this.runFun(fn as FunValue, args, (fn as FunValue).scope);
                            } else {
                                return await (fn as NativeFunValue).body(args, scope, this);
                            }
                        } catch (e) {
                            if (e != null && typeof e == 'object' && 'type' in e) {
                                throw e;
                            } else {
                                throw `${e} (line ${node.line})`;
                            }
                        }
                    } else if (k == MemberType.NamespaceAccess && (node as CallNode).args.length == 1) { // Potentional Tag::Tagged(val) syntax!
                        const tag = await this.run(((node as CallNode).caller as MemberNode).left, scope);
                        // Note: Checking like this will probably degrade performance on things like Std calls (i.e. "Std::Io::println("Test")"), though I'm too lazy to directly call a scope access
                        // Maybe there's faster methods?
                        if (tag.type == ValueType.StaticTag) { // Now we know for sure that this assumption is correct.
                            const name = (((node as CallNode).caller as MemberNode).right as IdNode).i;
                            const x = (tag as StaticTagValue).tagged.get(name);
                            if (x==undefined) {
                                throw `tag has no tagged member ${name} (line ${node.line})`;
                            }
                            const v = await this.run((node as CallNode).args[0], scope);
                            if (!satisfiesType(v, x, this, scope)) {
                                throw `value ${tostring(v, this)} does not satisfy enum tag ${name}'s expected tag type of ${tostringType(x)} (line ${node.line})`;
                            }
                            return { type: ValueType.Tag, parent: tag as StaticTagValue, name: name, tagged: v } as TagValue;
                        }
                    }
                }

                const callee: Value = await this.run((node as CallNode).caller, scope);
                if (callee.type == ValueType.NativeMacro) {
                    return await (callee as NativeMacroValue).body((node as CallNode).args, scope, this);
                }

                const args: Value[] = [];
                for (const arg of (node as CallNode).args) {
                    args.push(await this.run(arg, scope));
                }

                try {
                    switch (callee.type) {
                        case ValueType.Fun:
                            return await this.runFun(callee as FunValue, args, (callee as FunValue).scope);
                        case ValueType.Native:
                            return await (callee as NativeFunValue).body(args, scope, this);
                        default:
                            throw `can only call on functions and native functions`;
                    }
                } catch (e) {
                    if (e != null && typeof e == 'object' && 'type' in e) {
                        throw e;
                    } else {
                        throw `${e} (line ${node.line})`;
                    }
                }
            }
            case AstType.Member: {
                const m = node as MemberNode;
                const l = await this.run(m.left, scope);
                const r = m.right;
                switch (m.kind) {
                    case MemberType.Default: {
                        const validTs = {[ValueType.Object]: true, [ValueType.Struct]: true, [ValueType.StaticStruct]: true};
                        if (!(l.type in validTs) || r.type != AstType.Id) {
                            throw `the "." member expression operator is only used on records/structs with an identifier for assignments (i.e. "foo.bar") (line ${node.line})`;
                        }
                        switch (l.type) {
                            case ValueType.Struct:
                                return (
                                    ((l as StructValue).fields.get((r as IdNode).i) ?? 
                                    [(l as StructValue).parent.funs.get((r as IdNode).i)] ?? 
                                    [{ type: ValueType.None } as NoneValue as Value])
                                )[0] as Value;
                            case ValueType.StaticStruct:
                                return (
                                    ((l as StaticStructValue).staticFields.get((r as IdNode).i) ?? 
                                    [0, (l as StaticStructValue).staticFuns.get((r as IdNode).i)] ?? 
                                    [0, { type: ValueType.None } as NoneValue as Value])
                                )[1] as Value;
                            default: // ValueType.Object
                                return (l as ObjectValue).val.get(JSON.stringify({
                                    type: ValueType.String,
                                    value: (r as IdNode).i,
                                } as StringValue)) || { type: ValueType.None } as NoneValue;
                        }
                    }
                    case MemberType.Computed: {
                        switch (l.type) {
                            case ValueType.Object:
                                return (l as ObjectValue).val.get(JSON.stringify(
                                    await this.run(r, scope)
                                )) || { type: ValueType.None } as NoneValue;
                            case ValueType.Array: {
                                const index = await this.run(r, scope);
                                if (index.type != ValueType.Number) {
                                    throw `can only index arrays with numbers (line ${node.line})`;
                                }
                                return (l as ArrayValue).val[(index as NumberValue).value];
                            }
                            default:
                                throw `computed member accesses can only be done on arrays and objects (line ${node.line})`;
                        }
                    }
                    case MemberType.CallSelf:
                        throw `the <exp>:name signature can only be present in the left side of calls (i.e. "foo:bar()") (line ${node.line})`;
                    case MemberType.NamespaceAccess: {
                        if ((l.type != ValueType.Namespace && l.type != ValueType.StaticTag) || r.type != AstType.Id) {
                            throw `can only use the <exp>::name signature on namespaces & static tags (line ${node.line})`;
                        }
                        if (l.type == ValueType.Namespace) {
                            const result = (l as NamespaceValue).scope.members.get((r as IdNode).i);
                            return result == undefined ? { type: ValueType.None } as NoneValue : result.value;
                        }

                        if (!(l as StaticTagValue).nontagged.has((r as IdNode).i)) {
                            throw `enum does not have nontagged member ${(r as IdNode).i} (line ${node.line})`;
                        }
                        
                        return { type: ValueType.Tag, parent: l as StaticTagValue, name: (r as IdNode).i, tagged: undefined } as TagValue;
                    }
                    default:
                        throw '';
                }
            }
            case AstType.Match: {
                const callee = await this.run((node as MatchNode).cond, scope);
                
                const cases = new Map<string, Ast[]>();
                for (const [k, v] of (node as MatchNode).body) {
                    for (const x of k) {
                        if (callee.type == ValueType.Tag) {
                            if (
                                x.type == AstType.Member &&
                                (x as MemberNode).kind == MemberType.NamespaceAccess &&
                                (x as MemberNode).right.type == AstType.Id
                            ) { // Enum::Tag {} syntax
                                const l = await this.run((x as MemberNode).left, scope);
                                if ((callee as TagValue).tagged == undefined && l.type == ValueType.StaticTag && ((x as MemberNode).right as IdNode).i == (callee as TagValue).name) {
                                    return (await this.runBlock(v, scope))[0];
                                }
                            } else if (
                                x.type == AstType.Call &&
                                (x as CallNode).caller.type == AstType.Member &&
                                ((x as CallNode).caller as MemberNode).kind == MemberType.NamespaceAccess &&
                                ((x as CallNode).caller as MemberNode).right.type == AstType.Id &&
                                (x as CallNode).args.length == 1 &&
                                (x as CallNode).args[0].type == AstType.Id
                            ) { // Enum::Tagged(v) {} syntax
                                const l = await this.run(((x as CallNode).caller as MemberNode).left, scope);
                                if (l.type == ValueType.StaticTag && (callee as TagValue).tagged != undefined && (((x as CallNode).caller as MemberNode).right as IdNode).i == (callee as TagValue).name) {
                                    const dst = ((x as CallNode).args[0] as IdNode).i;
                                    const newScope = { parent: scope, members: new Map() } as Scope;
                                    newScope.members.set(dst, {
                                        mutable: true,
                                        value: (callee as TagValue).tagged as Value,
                                        type: (callee as TagValue).parent.tagged.get((callee as TagValue).name) as Type,
                                    });
                                    return (await this.runBlock(v, newScope))[0];
                                }
                            } else {
                                cases.set(JSON.stringify(await this.run(x, scope)), v);
                            }
                        } else {
                            cases.set(JSON.stringify(await this.run(x, scope)), v);
                        }
                    }
                }
                const cas = cases.get(JSON.stringify(callee));
                if (cas==undefined) {
                    return (node as MatchNode).default == undefined ? { type: ValueType.None } as NoneValue : (await this.runBlock((node as MatchNode).default as Ast[], scope))[0];
                }
                return (await this.runBlock(cas, scope))[0];
            }
            case AstType.Unary: {
                if ((node as UnaryNode).op == '&')  {
                    //? Hybrid Pointer Caching
                    // When pointing to a literal (i.e. &3), we ideally want them to point to the *same* location
                    // However, when pointing to something else (i.e. a variable), we want it to make a new pointer every time
                    // This enables something like "&3 == &3" to be true but then something like "mut a = 3 &a == &a" to be false
                    switch ((node as UnaryNode).right.type) {
                        case AstType.Number:
                        case AstType.String:
                        case AstType.Record:
                        case AstType.Array:
                        case AstType.Bool:
                        case AstType.None: { // Literal, attempt to cache
                            const r = await this.run((node as UnaryNode).right, scope);
                            const str = JSON.stringify(r);
                            const v = this.pointerCache.get(str);
                            if (v != undefined) {
                                return { type: ValueType.Pointer, points: v, t: undefined } as PointerValue;
                            }
                            const ptr = this.stack.length;
                            this.pointerCache.set(str, ptr);
                            this.stack.push(r);
                            return { type: ValueType.Pointer, points: ptr, t: undefined } as PointerValue;
                        }
                        default: { // Non-literal, make a new entry
                            const ptr = this.stack.length;
                            this.stack.push(await this.run((node as UnaryNode).right, scope));
                            return { type: ValueType.Pointer, points: ptr, t: undefined } as PointerValue;
                        }
                    }
                }
                const r = await this.run((node as UnaryNode).right, scope);
                switch ((node as UnaryNode).op) {
                    case '*':
                        switch (r.type) {
                            case ValueType.Number:
                            case ValueType.Pointer:
                                return this.stack[
                                r.type == ValueType.Number ? (r as NumberValue).value : (r as PointerValue).points
                            ] || { type: ValueType.None } as NoneValue;
                            case ValueType.Tag: {
                                if ((r as TagValue).tagged == undefined) {
                                    throw `can only dereference numbers, pointers, & tagged tags (line ${node.line})`;
                                }
                                return (r as TagValue).tagged as Value;
                            }
                            default:
                                throw `can only dereference numbers, pointers, & tagged tags (line ${node.line})`;
                        }
                        // Unreachable, is there to make the VSCode extension shut the fuck up about fallthrough
                        return {} as NoneValue;
                    case '-':
                        if (r.type != ValueType.Number) {
                            throw `can only negate numbers (line ${node.line})`;
                        }
                        return { type: ValueType.Number, value: -(r as NumberValue).value } as NumberValue;
                    case '!':
                        return { 
                            type: ValueType.Bool, 
                            value: falsey(r) 
                        } as BoolValue;
                    default:
                        throw `unary operator ${(node as UnaryNode).op} is unsupported (line ${node.line})`;
                }
            }
            case AstType.Binary: {
                const bin = node as BinaryNode;
                if (bin.op=='=') {
                    const b = await this.run(bin.b, scope);
                    switch (bin.a.type) {
                        case AstType.Unary: {
                            if ((bin.a as UnaryNode).op != '*') {
                                throw `the only supported lvalue for an assignment which is a unary operation is the deref operator '*' (line ${node.line})`;
                            }
                            const r = await this.run((bin.a as UnaryNode).right, scope);
                            if (r.type != ValueType.Number && r.type != ValueType.Pointer) {
                                throw `can only dereference numbers & pointers (line ${node.line})`;
                            }

                            const ptr = r.type == ValueType.Number ? (r as NumberValue).value : (r as PointerValue).points;
                            const str = JSON.stringify(b);
                            if (
                                r.type == ValueType.Pointer && 
                                (r as PointerValue).t != undefined &&
                                !satisfiesType(b, (r as PointerValue).t as Type, this, scope)
                            ) {
                                throw `pointer type &${tostringType((r as PointerValue).t as Type)} is not satisfied by deref assignment (*x = y) ${tostring(b, this)}`;
                            }
                            if (this.stack[ptr] != undefined && this.pointerCache.has(str)) {
                                this.pointerCache.set(str, ptr);
                            }

                            this.stack[ptr] = b;
                            return b;
                        }
                        case AstType.Id: {
                            const [a,s] = scopeGet(scope, (bin.a as IdNode).i);
                            if (a==undefined) {
                                throw `cannot assign to variable ${(bin.a as IdNode).i} as it is either out-of-scope or hasn't been declared (line ${node.line})`;
                            }
                            if (!a.mutable) {
                                throw `cannot assign to variable ${(bin.a as IdNode).i} as it is immutable/constant (line ${node.line})`;
                            }
                            if (!satisfiesType(b, a.type, this, scope)) {
                                throw `cannot assign to variable ${(bin.a as IdNode).i} as ${tostring(b, this)} does not satisfy its type of ${tostringType(a.type)} (line ${node.line})`;
                            }
                            s.members.set((bin.a as IdNode).i, {
                                mutable: true,
                                value: b,
                                type: a.type,
                            });
                            return b;
                        }
                        case AstType.Member: {
                            const l = await this.run((bin.a as MemberNode).left, scope);
                            const r = (bin.a as MemberNode).right;
                            const m = bin.a as MemberNode;
                            switch (m.kind) {
                                case MemberType.Default: {
                                    const validTs = { [ValueType.Object]: true, [ValueType.StaticStruct]: true, [ValueType.Struct]: true };
                                    if (!(l.type in validTs) || r.type != AstType.Id) {
                                        throw `the "." member expression operator is only used on records/structs with an identifier for assignments (i.e. "foo.bar = foo") (line ${node.line})`;
                                    }
                                    switch (l.type) {
                                        case ValueType.Struct: {
                                            const x = (l as StructValue).fields.get((r as IdNode).i);
                                            if (x==undefined) {
                                                throw `field ${(r as IdNode).i} does not exist on struct (line ${node.line})`;
                                            }
                                            if (!satisfiesType(b, x[1], this, scope)) {
                                                throw `invalid type signature (expected ${tostringType(x[1])}, got ${tostring(b, this)}) (line ${node.line})`;
                                            }
                                            (l as StructValue).fields.set((r as IdNode).i, [b, x[1]]);
                                            return b;
                                        }
                                        case ValueType.StaticStruct: {
                                            const x = (l as StaticStructValue).staticFields.get((r as IdNode).i);
                                            if (x==undefined) {
                                                throw `static field ${(r as IdNode).i} does not exist on static struct (line ${node.line})`;
                                            }
                                            if (!satisfiesType(b, x[0], this, scope)) {
                                                throw `invalid type signature (expected ${tostringType(x[0])}) (line ${node.line})`;
                                            }
                                            (l as StaticStructValue).staticFields.set((r as IdNode).i, [x[0], b]);
                                            return b;
                                        }
                                        default: // ValueType.Record
                                            (l as ObjectValue).val.set(JSON.stringify({
                                            type: ValueType.String,
                                            value: (r as IdNode).i,
                                        } as StringValue), b);
                                    }
                                    break;
                                }
                                case MemberType.Computed:
                                    switch (l.type) {
                                        case ValueType.Object: {
                                            const key = await this.run(r, scope);
                                            if (
                                                (l as ObjectValue).t != undefined
                                                && !satisfiesType(key, ((l as ObjectValue).t as LooseRecordType).key, this, scope)
                                                && !satisfiesType(b, ((l as ObjectValue).t as LooseRecordType).value, this, scope)
                                            ) {
                                                throw `invalid type signature (expected ${tostringType(((l as ObjectValue).t as LooseRecordType).key)}) for loose record assignment (line ${node.line})`;
                                            }
                                            (l as ObjectValue).val.set(JSON.stringify(key), b);
                                            return b;
                                        }
                                        case ValueType.Array: {
                                            const key = await this.run(r, scope);
                                            if (key.type != ValueType.Number) {
                                                throw `can only index arrays by number (line ${node.line})`;
                                            }
                                            if (
                                                (l as ArrayValue).t != undefined
                                                && (
                                                    (
                                                        (l as ArrayValue).t?.type == TypeType.Array
                                                        && !satisfiesType(b, ((l as ArrayValue).t as ArrayType).t, this, scope)
                                                    )
                                                    ||
                                                    (
                                                        (l as ArrayValue).t?.type == TypeType.Tuple
                                                        && !satisfiesType(b, ((l as ArrayValue).t as TupleType).a[(key as NumberValue).value], this, scope)
                                                    )
                                                )
                                            ) {
                                                throw `invalid type signature (expected ${tostringType((l as ArrayValue).t as Type)}) for array (line ${node.line})`;
                                            }

                                            (l as ArrayValue).val[(key as NumberValue).value] = b;
                                            return b;
                                        }
                                        case ValueType.Struct: {
                                            const key = await this.run(r, scope);
                                            if (key.type != ValueType.String) {
                                                throw `can only index structures by strings/ids (line ${node.line})`;
                                            }
                                            const x = (l as StructValue).fields.get((key as StringValue).value);
                                            if (x==undefined) {
                                                throw `field ${(key as StringValue).value} does not exist on struct (line ${node.line})`;
                                            }
                                            if (!satisfiesType(b, x[1], this, scope)) {
                                                throw `invalid type signature (expected ${tostringType(x[1])}) (line ${node.line})`;
                                            }
                                            (l as StructValue).fields.set((key as StringValue).value, [b, x[1]]);
                                            return b;
                                        }
                                        case ValueType.StaticStruct: {
                                            const key = await this.run(r, scope);
                                            if (key.type != ValueType.String) {
                                                throw `can only index static structures by strings/ids (line ${node.line})`;
                                            }
                                            const x = (l as StaticStructValue).staticFields.get((key as StringValue).value);
                                            if (x==undefined) {
                                                throw `static field ${(key as StringValue).value} does not exist on static struct (line ${node.line})`;
                                            }
                                            if (!satisfiesType(b, x[0], this, scope)) {
                                                throw `invalid type signature (expected ${tostringType(x[0])}) (line ${node.line})`;
                                            }
                                            (l as StaticStructValue).staticFields.set((key as StringValue).value, [x[0], b]);
                                            return b;
                                        }
                                        default:
                                            throw `the "[<exp>]" member expression operator is only used on records/arrays/structs (i.e. "foo[bar] = foo", "arr[index] = bar")`;
                                    }
                                case MemberType.CallSelf:
                                    throw `the <exp>:name signature can only be present in the left side of calls (i.e. "foo:bar()") (line ${node.line})`;
                                case MemberType.NamespaceAccess: {
                                    throw `cannot assign to namespaces (line ${node.line})`;
                                }
                            }
                            break;
                        }
                        default:
                            throw `can only assign to identifiers member expressions, & derefs (i.e. "foo = bar", "foo.bar = bar", "*foo = bar") (line ${node.line})`;
                    }

                    return b;
                }
                const a = await this.run(bin.a, scope);
                switch (bin.op) { //? These operators don't require b to be evaluated immediately
                    case '&&': {
                        if (falsey(a)) {
                            return { type: ValueType.Bool, value: false } as BoolValue;
                        }
                        return { type: ValueType.Bool, value: !falsey(await this.run(bin.b, scope)) } as BoolValue;
                    }
                    case '||': {
                        if (!falsey(a)) {
                            return { type: ValueType.Bool, value: true } as BoolValue;
                        }
                        return { type: ValueType.Bool, value: !falsey(await this.run(bin.b, scope)) } as BoolValue;
                    }
                    case '??': {
                        if (a.type == ValueType.None) {
                            return await this.run(bin.b, scope);
                        }
                        return a;
                    }
                }
                const b = await this.run(bin.b, scope);
                switch (bin.op) { //? These operators *do* require b to be evaluated
                    case '==':
                        return { type: ValueType.Bool, value: JSON.stringify(a)==JSON.stringify(b) } as BoolValue;
                    case '!=':
                        return { type: ValueType.Bool, value: JSON.stringify(a)!=JSON.stringify(b) } as BoolValue;
                    case '..':
                        return { type: ValueType.String, value: tostring(a, this)+tostring(b, this) } as StringValue;
                    default:
                        break;
                }

                if (a.type == ValueType.Pointer || b.type == ValueType.Pointer) {
                    const a1 = a.type == ValueType.Number ? (a as NumberValue).value : (a as PointerValue).points;
                    const b1 = b.type == ValueType.Number ? (b as NumberValue).value : (b as PointerValue).points;
                    switch (bin.op) {
                        case '+':
                            return { type: ValueType.Pointer, points: a1+b1 } as PointerValue;
                        case '-':
                            return { type: ValueType.Pointer, points: a1-b1 } as PointerValue;
                        case '*':
                            return { type: ValueType.Pointer, points: a1*b1 } as PointerValue;
                        case '/':
                            throw `cannot divide pointers (line ${bin.line})`;
                        case '%':
                            return { type: ValueType.Pointer, points: a1%b1 } as PointerValue;
                        case '^':
                            return { type: ValueType.Pointer, points: a1%b1 } as PointerValue;
                        case '>':
                            return { type: ValueType.Bool, value: a1>b1 } as BoolValue;
                        case '>=':
                            return { type: ValueType.Bool, value: a1>=b1 } as BoolValue;
                        case '<':
                            return { type: ValueType.Bool, value: a1<b1 } as BoolValue;
                        case '<=':
                            return { type: ValueType.Bool, value: a1<=b1 } as BoolValue;
                        default:
                            throw `binary operator ${bin.op} is unsupported (line ${bin.line})`;
                    }
                }

                if (a.type != ValueType.Number || b.type != ValueType.Number) {
                    throw `the ${bin.op} operation requires two numbers/pointers (line ${node.line})`;
                }

                switch (bin.op) {
                    case '+':
                        return { type: ValueType.Number, value: (a as NumberValue).value+(b as NumberValue).value } as NumberValue;
                    case '-':
                        return { type: ValueType.Number, value: (a as NumberValue).value-(b as NumberValue).value } as NumberValue;
                    case '*':
                        return { type: ValueType.Number, value: (a as NumberValue).value*(b as NumberValue).value } as NumberValue;
                    case '/':
                        return { type: ValueType.Number, value: (a as NumberValue).value/(b as NumberValue).value } as NumberValue;
                    case '%':
                        return { type: ValueType.Number, value: (a as NumberValue).value%(b as NumberValue).value } as NumberValue;
                    case '^':
                        return { type: ValueType.Number, value: (a as NumberValue).value**(b as NumberValue).value } as NumberValue;
                    case '>>':
                        return { type: ValueType.Number, value: (a as NumberValue).value>>(b as NumberValue).value } as NumberValue;
                    case '<<':
                        return { type: ValueType.Number, value: (a as NumberValue).value<<(b as NumberValue).value } as NumberValue;
                    case '|':
                        return { type: ValueType.Number, value: (a as NumberValue).value|(b as NumberValue).value } as NumberValue;
                    case '&':
                        return { type: ValueType.Number, value: (a as NumberValue).value&(b as NumberValue).value } as NumberValue;
                    case '>':
                        return { type: ValueType.Bool, value: (a as NumberValue).value>(b as NumberValue).value } as BoolValue;
                    case '>=':
                        return { type: ValueType.Bool, value: (a as NumberValue).value>=(b as NumberValue).value } as BoolValue;
                    case '<':
                        return { type: ValueType.Bool, value: (a as NumberValue).value<(b as NumberValue).value } as BoolValue;
                    case '<=':
                        return { type: ValueType.Bool, value: (a as NumberValue).value<=(b as NumberValue).value } as BoolValue;
                    default:
                        throw `binary operator ${bin.op} is unsupported (line ${bin.line})`;
                }
            }
            case AstType.Number:
                return { type: ValueType.Number, value: (node as NumberNode).n } as NumberValue;
            case AstType.String:
                return { type: ValueType.String, value: (node as StringNode).s } as StringValue;
            case AstType.Bool:
                return { type: ValueType.Bool, value: (node as BoolNode).b } as BoolValue;
            case AstType.None:
                return { type: ValueType.None } as NoneValue;
            case AstType.Array: {
                const arr = new Array<Value>();
                for (const n of (node as ArrayNode).body) {
                    arr.push(await this.run(n, scope));
                }
                return { type: ValueType.Array, val: arr } as ArrayValue;
            }
            default:
                throw `node ${node.type} wasn't recognized (line ${node.line})`;
        }
    }
}