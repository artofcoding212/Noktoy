import {
    createConnection,
    TextDocuments,
    Diagnostic,
    DiagnosticSeverity,
    ProposedFeatures,
    TextDocumentSyncKind,
    InitializeParams,
    Position,
    CompletionParams, CompletionItem, CompletionItemKind
} from "vscode-languageserver/node"

import { TextDocument } from "vscode-languageserver-textdocument";

import { Lexer } from "./frontend/lexer.ts";
import { Parser } from "./frontend/parser.ts";
import { Type, AnyType, TypeType, tostringType, NoneType, EntityType } from "./frontend/types.ts";
import { Ast, AstType, CallNode, TagDeclNode, BinaryNode, MatchNode, ErrNode, ArrayNode, RecordNode, ReturnNode, ExtNode, FunDeclNode, VarDeclNode, DoNode, MemberNode, CatchNode, IfNode, WhileNode, UnaryNode, ForOfNode, StructDeclNode, UseNameNode, UseBasicNode, UseExpandNode } from "./frontend/ast.ts";

const conn = createConnection(ProposedFeatures.all);
const docs = new TextDocuments(TextDocument);

conn.onInitialize((_params: InitializeParams) => {
    console.log("Initialized");
    return {
        capabilities: {
            textDocumentSync: TextDocumentSyncKind.Incremental,
            hoverProvider: true,
            completionProvider: {
                resolveProvider: false,
                triggerCharacters: [".", "::", ":", "("]
            }
        }
    }
});

docs.onDidChangeContent(change => {
    serveDocument(change.document)
});

enum ScopeVarT {
    Var,
    Fun,
    Raw,
    Struct,
    Tag,
    Namespace,
}

interface ScopeVar {
    varName: string;
    type: ScopeVarT;
}

interface Var extends ScopeVar {
    t: Type;
} 

interface Fun extends ScopeVar {
    params: [string, Type, boolean][],
    ret: Type,
}

interface Struct extends ScopeVar {
    fields: Map<string, Type>;
    staticFields: Map<string, Type>;
    funs: Map<string, Fun>;
    staticFuns: Map<string, Fun>;
}

interface Tag extends ScopeVar {
    tagged: Map<string, Type>;
    nontagged: Map<string, undefined>;
}

interface Raw extends ScopeVar {
    raw: string;
}

interface Namespace extends ScopeVar {
    scope: Scope;
}

interface Scope {
    members: Map<string, ScopeVar>;
    parent: Scope|undefined;
}

function tostringVar(t: ScopeVar): string {
    switch (t.type) {
        case ScopeVarT.Var:
            return `let ${t.varName}: ${tostringType((t as Var).t)}`;
        case ScopeVarT.Fun: {
            let buf = '';
            for (const [name, paramT] of (t as Fun).params) {
                buf += `${name}: ${tostringType(paramT)}, `;
            }
            return `fun ${t.varName}(${buf}) ${tostringType((t as Fun).ret)}`;
        }
        case ScopeVarT.Raw:
            return (t as Raw).raw;
        case ScopeVarT.Struct: {
            let buf = '';
            for (const [k, v] of (t as Struct).fields) {
                buf += `\t${k} ${tostringType(v)}\n`;
            }
            for (const [k, v] of (t as Struct).staticFields) {
                buf += `\t!${k} ${tostringType(v)}\n`;
            }
            for (const [_, v] of (t as Struct).funs) {
                buf += `\t${tostringVar(v)}`;
            }
            for (const [_, v] of (t as Struct).staticFuns) {
                buf += `\t!${tostringVar(v)}`;
            }
            return `str ${t.varName} {\n${buf}\n}`
        }
        case ScopeVarT.Tag: {
            let buf = '';
            for (const [k,_] of (t as Tag).nontagged) {
                buf += `${k},\n`;
            }
            for (const [k,v] of (t as Tag).tagged) {
                buf += `${k}(${tostringType(v)}),\n`;
            }
            return `tag ${t.varName} {\n${buf}\n}`
        }
        case ScopeVarT.Namespace:
            return `namespace`;
    }
}

const globalScope = { parent: undefined, members: new Map() } as Scope;
globalScope.members.set("Number", { type: ScopeVarT.Raw, raw: "# Number\nA numeric value." } as Raw);
globalScope.members.set("String", { type: ScopeVarT.Raw, raw: "# String\nA string value." } as Raw);
globalScope.members.set("None", { type: ScopeVarT.Raw, raw: "# None\n`none`" } as Raw);
globalScope.members.set("Any", { type: ScopeVarT.Raw, raw: "# Any\nAny value." } as Raw);
{
    const std_ns = { parent: undefined, members: new Map() } as Scope;
    {
        const io_ns = { parent: undefined, members: new Map() } as Scope;
        io_ns.members.set("println", {
            type: ScopeVarT.Fun,
            varName: "println",
            params: [],
            ret: { type: TypeType.None } as NoneType,
        } as Fun);
        std_ns.members.set("Io", {
            type: ScopeVarT.Namespace,
            varName: "Io",
            scope: io_ns,
        } as Namespace);
    }
    globalScope.members.set("Std", {
        type: ScopeVarT.Namespace,
        varName: "Std",
        scope: std_ns,
    } as Namespace);
}

// [Scope, beginLine, endLine]
let scopes: [Scope, number, number][] = [];

function runBody(body: Ast[], scope: Scope) {
    const newScope = { parent: scope, members: new Map() } as Scope;
    let startLine: number = -1;
    let endLine: number = 0;
    const i = scopes.length;
    scopes.push([newScope, 0, 0]);
    for (const n of body) {
        if (startLine==-1) {
            startLine = n.line;
        }
        endLine = n.line;
        runNode(n, newScope);
    }
    scopes[i] = [newScope, startLine, endLine];
}

function runNode(node: Ast, scope: Scope) {
    switch (node.type) {
        case AstType.Ext: {
            runNode((node as ExtNode).file, scope);
            break;
        }
        case AstType.Do: {
            runBody((node as DoNode).body, scope);
            break;
        }
        case AstType.Catch: {
            runNode((node as CatchNode).exp, scope);
            runBody((node as CatchNode).body, scope);
            break;
        }
        case AstType.If: {
            runNode((node as IfNode).cond, scope);
            runBody((node as IfNode).body, scope);
            switch ((node as IfNode).elseT) {
                case 1: {
                    runNode((node as IfNode).else as IfNode, scope);
                    break;
                }
                case 2: {
                    runBody((node as IfNode).else as Ast[], scope);
                    break;
                }
            }
            break;
        }
        case AstType.While: {
            runNode((node as WhileNode).cond, scope);
            runBody((node as WhileNode).body, scope);
            break;
        }
        case AstType.ForOf: {
            const newScope = { parent: scope, members: new Map() } as Scope;
            newScope.members.set((node as ForOfNode).a, { type: ScopeVarT.Var, varName: (node as ForOfNode).a, t: { type: TypeType.Any } as AnyType } as Var);
            newScope.members.set((node as ForOfNode).b, { type: ScopeVarT.Var, varName: (node as ForOfNode).b, t: { type: TypeType.Any } as AnyType } as Var);
            runBody((node as ForOfNode).body, newScope);
            break;
        }
        case AstType.TagDecl: {
            scope.members.set((node as TagDeclNode).name, {
                type: ScopeVarT.Tag,
                nontagged: (node as TagDeclNode).nontagged,
                tagged: (node as TagDeclNode).tagged,
            } as Tag);
            break;
        }
        case AstType.Err:
            runNode((node as ErrNode).val, scope);
            break;
        case AstType.Match: {
            runNode((node as MatchNode).cond, scope);
            for (const [k,v] of (node as MatchNode).body) {
                for (const x of k) {
                    runNode(x, scope);
                }
                runBody(v, scope);
            }
            break;
        }
        case AstType.StructDecl: { 
            const staticFields = new Map();
            for (const [k,v] of (node as StructDeclNode).staticFields) {
                staticFields.set(k, v[0]);
            }
            const funs = new Map();
            for (const [k,v] of (node as StructDeclNode).funs) {
                const newScope = { parent: scope, members: new Map() } as Scope;
                for (const [name, t] of v.params) {
                    newScope.members.set(name, { type: ScopeVarT.Var, varName: name, t } as Var);
                }
                runBody(v.body, newScope);
                staticFields.set(k, {
                    params: v.params,
                    ret: v.ret,
                } as Fun);
            }
            const staticFuns = new Map();
            for (const [k,v] of (node as StructDeclNode).staticFuns) {
                const newScope = { parent: scope, members: new Map() } as Scope;
                for (const [name, t] of (node as FunDeclNode).params) {
                    newScope.members.set(name, { type: ScopeVarT.Var, varName: name, t } as Var);
                }
                const i = scopes.length;
                runBody((node as FunDeclNode).body, newScope);
                scopes[i][1] = (node as FunDeclNode).line;
                staticFields.set(k, {
                    params: v.params,
                    ret: v.ret,
                } as Fun);
            }
            scope.members.set((node as StructDeclNode).name, {
                type: ScopeVarT.Struct,
                fields: (node as StructDeclNode).fields,
                staticFields,
                funs,
                staticFuns,
            } as Struct);
            break;
        }
        case AstType.Unary: {
            runNode((node as UnaryNode).right, scope);
            break;
        }
        case AstType.Member: {
            runNode((node as MemberNode).left, scope);
            runNode((node as MemberNode).right, scope);
            break;
        }
        case AstType.VarDecl: {
            scope.members.set((node as VarDeclNode).name, {
                type: ScopeVarT.Var,
                varName: (node as VarDeclNode).name,
                t: (node as VarDeclNode).t,
            } as Var);
            break;
        }
        case AstType.FunDecl: {
            const newScope = { parent: scope, members: new Map() } as Scope;
            for (const [name, t] of (node as FunDeclNode).params) {
                newScope.members.set(name, { type: ScopeVarT.Var, varName: name, t } as Var);
            }
            const i = scopes.length;
            runBody((node as FunDeclNode).body, newScope);
            scopes[i][1] = (node as FunDeclNode).line;
            scope.members.set((node as FunDeclNode).name as string, {
                varName: (node as FunDeclNode).name,
                type: ScopeVarT.Fun,
                params: (node as FunDeclNode).params,
                ret: (node as FunDeclNode).ret,
            } as Fun);
            break;
        }
        case AstType.Binary: {
            runNode((node as BinaryNode).a, scope);
            runNode((node as BinaryNode).b, scope);
            break;
        }
        case AstType.Return: {
            runNode((node as ReturnNode).value, scope);
            break;
        }
        case AstType.Record: {
            for (const [k,v] of (node as RecordNode).body) {
                runNode(k, scope);
                runNode(v, scope);
            }
            break;
        }
        case AstType.Call: {
            runNode((node as CallNode).caller, scope);
            for (const n of (node as CallNode).args) {
                runNode(n, scope);
            }
            break;
        }
        case AstType.Array: {
            for (const n of (node as ArrayNode).body) {
                runNode(n, scope);
            }
            break;
        }
        case AstType.UseBasic: {
            const basicNode = node as UseBasicNode;
            const leftVar = scopeGet(scope, (basicNode.left as UseNameNode).name);
            if (leftVar?.type === ScopeVarT.Namespace) {
                const namespace = leftVar as Namespace;
                const rightMember = namespace.scope.members.get((basicNode.right as UseNameNode).name);
                if (rightMember) {
                    scope.members.set(basicNode.as || (basicNode.right as UseNameNode).name, rightMember);
                }
            }
            break;
        }
        case AstType.UseExpand: {
            const expandNode = node as UseExpandNode;
            const leftVar = scopeGet(scope, (expandNode.left as UseNameNode).name);
            if (leftVar?.type === ScopeVarT.Namespace) {
                const namespace = leftVar as Namespace;
                for (const item of expandNode.body) {
                    const nameNode = item as UseNameNode;
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

function serveDocument(doc: TextDocument) {
    const txt = doc.getText();
    const diags: Diagnostic[] = [];

    const parse = new Parser(new Lexer(txt));
    try {
        const ast = parse.parse();
        const newGlobal = {parent: globalScope, members: new Map()} as Scope;
        scopes = [[newGlobal, 0, txt.split('\n').length]];
        for (const node of ast) {
            runNode(node, newGlobal);
        }
    } catch (e) {
        if (e != null && typeof e == 'object' && 'msg' in e && typeof e.msg=='string' && 'ln' in e && typeof e.ln == 'number') {
            diags.push({
                severity: DiagnosticSeverity.Error,
                range: {
                    start: Position.create(e.ln, 0),
                    end: Position.create(e.ln, txt.split('\n')[e.ln-1].length-1),
                },
                message: e.msg,
                source: 'noktoy',
            });
        }
    }

    conn.sendDiagnostics({ uri: doc.uri, diagnostics: diags });
}

interface HoverRet {
    contents: {kind: "markdown", value: string},
}

function isWordChar(char: string): boolean {
    return /[a-zA-Z0-9_]/.test(char);
}

function findWordStart(text: string, offset: number): number {
    while (offset > 0 && isWordChar(text[offset - 1])) {
        offset--;
    }
    return offset;
}

function findWordEnd(text: string, offset: number): number {
    while (offset < text.length && isWordChar(text[offset])) {
        offset++;
    }
    return offset;
}

function scopeGet(scope: Scope, name: string): ScopeVar|undefined {
    const v = scope.members.get(name);
    return (v==undefined ? (scope.parent == undefined ? undefined : scopeGet(scope.parent, name)) : v);
} 

function serveDocumentHover(uri: string, pos: Position): HoverRet|undefined {
    console.log("Hover");
    const doc = docs.get(uri) as TextDocument;
    const offset = doc.offsetAt(pos);
    const docTxt = doc.getText();
    const end = findWordEnd(docTxt, offset);
    const txt = docTxt.slice(findWordStart(docTxt, offset), end);

    let scope: number = -1;

    for (let i=scopes.length-1; i>=0; i--){
        if (pos.line <= scopes[i][2]-1 && pos.line >= scopes[i][1]-1) {
            scope = i;
            break;
        }
    }

    if (scope==-1) {
        console.warn("Unknown hover scope");
        return {contents: {kind: "markdown", value: txt}};
    }

    const v = scopeGet(scopes[scope][0], txt);
    if (v==undefined) {
        return undefined;
    }
    return {contents: {kind: "markdown", value: tostringVar(v)}};
}

function getCompletionKind(type: ScopeVarT): CompletionItemKind {
    switch (type) {
        case ScopeVarT.Fun:
            return CompletionItemKind.Function;
        case ScopeVarT.Struct:
            return CompletionItemKind.Class;
        case ScopeVarT.Tag:
            return CompletionItemKind.Enum;
        case ScopeVarT.Var:
            return CompletionItemKind.Variable;
        case ScopeVarT.Raw:
            return CompletionItemKind.Value;
        default:
            return CompletionItemKind.Text;
    }
}

function getMemberCompletions(variable: ScopeVar): CompletionItem[] {
    const items: CompletionItem[] = [];
    
    switch (variable.type) {
        case ScopeVarT.Struct: {
            const struct = variable as Struct;
            for (const [name, type] of struct.fields) {
                items.push({
                    label: name,
                    kind: CompletionItemKind.Field,
                    detail: `field: ${tostringType(type)}`
                });
            }
            for (const [name, type] of struct.staticFields) {
                items.push({
                    label: name,
                    kind: CompletionItemKind.Field, 
                    detail: `static field: ${tostringType(type)}`
                });
            }
            for (const [name, fun] of struct.funs) {
                items.push({
                    label: name,
                    kind: CompletionItemKind.Method,
                    detail: `method: ${tostringVar(fun)}`
                }); 
            }
            for (const [name, fun] of struct.staticFuns) {
                items.push({
                    label: name,
                    kind: CompletionItemKind.Method,
                    detail: `static method: ${tostringVar(fun)}`
                });
            }
            break;
        }
        case ScopeVarT.Namespace: {
            const namespace = variable as Namespace;
            for (const [name, member] of namespace.scope.members) {
                items.push({
                    label: name,
                    kind: getCompletionKind(member.type),
                    detail: tostringVar(member)
                });
            }
            break;
        }
        case ScopeVarT.Tag: {
            const tag = variable as Tag;
            for (const [name] of tag.nontagged) {
                items.push({
                    label: name,
                    kind: CompletionItemKind.EnumMember,
                    detail: `variant`
                });
            }
            for (const [name, type] of tag.tagged) {
                items.push({
                    label: name,
                    kind: CompletionItemKind.EnumMember,
                    detail: `variant(${tostringType(type)})`
                });
            }
            break;
        }
    }
    return items;
}

function resolveVariableType(scope: Scope, varName: string): Type | undefined {
    const variable = scopeGet(scope, varName);
    if (!variable) return undefined;

    if (variable.type === ScopeVarT.Var) {
        return (variable as Var).t;
    }
    return undefined;
}

function getStructFields(scope: Scope, structName: string): Map<string, Type> | undefined {
    const struct = scopeGet(scope, structName);
    if (struct?.type === ScopeVarT.Struct) {
        return (struct as Struct).fields;
    }
    return undefined;
}

function resolveMemberChain(scope: Scope, chain: string[]): ScopeVar | undefined {
    if (chain.length === 0) return undefined;

    let current = scopeGet(scope, chain[0]);
    if (!current) {
        // Try resolving as variable type
        const varType = resolveVariableType(scope, chain[0]);
        if (varType?.type === TypeType.Entity) {
            current = scopeGet(scope, (varType as EntityType).name);
        }
        if (!current) return undefined;
    }

    for (let i = 1; i < chain.length; i++) {
        const part = chain[i];
        if (!current) return undefined;

        switch (current.type) {
            case ScopeVarT.Namespace:
                current = (current as Namespace).scope.members.get(part);
                break;
            case ScopeVarT.Tag:
                const tag = current as Tag;
                current = tag.tagged.has(part) || tag.nontagged.has(part) ? current : undefined;
                break;
            case ScopeVarT.Struct: {
                const struct = current as Struct;
                const member = struct.fields.get(part) || 
                             struct.staticFields.get(part) ||
                             struct.funs.get(part) ||
                             struct.staticFuns.get(part);
                if (member && typeof member === 'object' && 'type' in member) {
                    current = member as ScopeVar;
                } else {
                    current = undefined;
                }
                break;
            }
            default:
                current = undefined;
        }
    }
    
    return current;
}

conn.onCompletion((params: CompletionParams): CompletionItem[] => {
    const doc = docs.get(params.textDocument.uri);
    if (!doc) {
        console.warn("Received no completion doc");
        return [];
    }

    const pos = params.position;
    let scope: number = -1;
    for (let i = scopes.length-1; i >= 0; i--) {
        if (pos.line <= scopes[i][2]-1 && pos.line >= scopes[i][1]-1) {
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
    const currentLine = text.substring(text.lastIndexOf('\n', offset - 1) + 1, offset);
    const currentScope = scopes[scope][0];

    // Check for struct instantiation 
    const structMatch = currentLine.match(/([a-zA-Z0-9_]+)\s*{\s*$/);
    if (structMatch) {
        const structName = structMatch[1];
        const fields = getStructFields(currentScope, structName);
        if (fields) {
            return Array.from(fields.entries()).map(([name, type]) => ({
                label: name,
                kind: CompletionItemKind.Field,
                detail: `field: ${tostringType(type)}`,
                insertText: `${name} -> `
            }));
        }
    }

    // Check for member access with more precise regex
    const lastPart = currentLine.substring(0, offset);
    const memberMatch = lastPart.match(/([a-zA-Z0-9_]+(?:(?::{2}|\.)[a-zA-Z0-9_]*)*(?::{2}|\.)?)$/);

    if (memberMatch) {
        const fullPath = memberMatch[1];
        // More precise splitting to handle :: and . correctly
        const parts = fullPath.split(/(?::{2}|\.)/).filter(Boolean);
        
        // Check if ends with an operator
        const endsWithOperator = fullPath.endsWith('::') || fullPath.endsWith('.');
        if (endsWithOperator) {
            const variable = resolveMemberChain(currentScope, parts.slice(0, -1));
            if (variable) {
                const completions = getMemberCompletions(variable);
                // Add proper commit characters based on type
                return completions.map(item => {
                    if (variable.type === ScopeVarT.Tag) {
                        item.commitCharacters = ['('];
                    } else if (variable.type === ScopeVarT.Namespace) {
                        item.commitCharacters = [':'];
                    }
                    return item;
                });
            }
            return [];
        }
    }

    // Default scope completion
    const items: CompletionItem[] = [];
    let checkScope: Scope | undefined = currentScope;
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

conn.onHover(params => {
    return serveDocumentHover(params.textDocument.uri, params.position);
});

docs.listen(conn);
conn.listen();