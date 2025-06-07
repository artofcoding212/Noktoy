// deno-lint-ignore-file require-await
/// <reference lib="webworker" />

import { encode } from "@msgpack/msgpack";
import { Interpreter, Scope } from "../backend/interpreter.ts";
import { FunValue, NativeFunValue, NoneValue, StructValue, Value, ValueType } from "../shared/values.ts";
import { thread_str } from "../std/thread.ts";
import { MessageType, PostMessage, RequestMessage, SpawnMessage, ThreadMessage } from "./shared.ts";
import { decode } from "@msgpack/msgpack";
import { AnyType, TypeType } from "../shared/types.ts";

const i = new Interpreter([], "");

const requests: Map<number, Value|undefined> = new Map();

interface Context {
    fun: FunValue;
    postHandler?: FunValue;
    reqHandler?: FunValue;
}

const spawned_thread = { ...thread_str };
spawned_thread.funs.set('post', { type: ValueType.Native, body: 
    async (args: Value[], _scope: Scope, _i: Interpreter): Promise<Value> => {
        if (args.length != 1) {
            throw `invalid function signature to Std::Thread::post() on thread-side`;
        }
        const encoded = new Uint8Array(encode({ type: MessageType.Post, data: args[0] } as PostMessage));
        self.postMessage(encoded.buffer, [encoded.buffer]);
        return { type: ValueType.None } as NoneValue;
    }
} as NativeFunValue);
spawned_thread.funs.set('close', { type: ValueType.Native, body: 
    async (_args: Value[], _scope: Scope, _i: Interpreter): Promise<Value> => {
        const encoded = new Uint8Array(encode({ type: MessageType.Finish } as ThreadMessage));
        self.postMessage(encoded.buffer, [encoded.buffer]);
        return { type: ValueType.None } as NoneValue;
    }
} as NativeFunValue);
spawned_thread.funs.set('req', { type: ValueType.Native, body: 
    async (args: Value[], _scope: Scope, _i: Interpreter): Promise<Value> => {
        if (args.length != 1) {
            throw `invalid function signature to Std::Thread::req() on thread-side`;
        }
        const requestId = requests.keys().toArray().length+1;
        requests.set(requestId, undefined);
        const encoded = new Uint8Array(encode({ type: MessageType.Request, data: args[0], requestId } as RequestMessage));
        self.postMessage(encoded.buffer, [encoded.buffer]);
        
        while (requests.get(requestId) != undefined) {
            await sleep(10);
        }

        const result = {...requests.get(requestId)};
        requests.delete(requestId);

        return result as Value;
    }
} as NativeFunValue);

let done = false;
spawned_thread.funs.set('close', { type: ValueType.Native, body: 
    async (args: Value[], _scope: Scope, _i: Interpreter): Promise<Value> => {
        if (args.length != 0) {
            throw `invalid function signature to Std::Thread::close() on thread-side`;
        }
        
        done = true;
        const encoded = new Uint8Array(encode({ type: MessageType.Finish } as ThreadMessage));
        self.postMessage(encoded.buffer, [encoded.buffer]);
        throw new Error('Closed thread');
    }
} as NativeFunValue);

const thisThread = {
    type: ValueType.Struct,
    fields: new Map(),
    parent: spawned_thread,
} as StructValue;

let context: Context|undefined = undefined;

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const globalScope = { parent: i.globalScope, members: new Map() } as Scope;
globalScope.members.set('Thread', { mutable: false, type: { type: TypeType.Any } as AnyType, value: thread_str });

self.onmessage = async (event: MessageEvent) => {
    const msg = decode(new Uint8Array(event.data)) as ThreadMessage;

    switch (msg.type as MessageType) {
        case MessageType.Spawn: {
            i.currentFile = (msg as SpawnMessage).fun.file;
            context = { 
                fun: (msg as SpawnMessage).fun,
                postHandler: (msg as SpawnMessage).postHandler,
                reqHandler: (msg as SpawnMessage).reqHandler,
            };
            break;
        }
        case MessageType.RequestResponse: {
            while (context == undefined) {
                await sleep(5);
            }
            
            requests.set((msg as RequestMessage).requestId, (msg as RequestMessage).data);
            break;
        }
        case MessageType.Request: {
            while (context == undefined) {
                await sleep(5);
            }

            if ((context as Context).reqHandler == undefined) {
                const encoded = new Uint8Array(encode({ type: MessageType.RequestResponse, data: { type: ValueType.None } as NoneValue, requestId: (msg as RequestMessage).requestId } as RequestMessage));
                self.postMessage(encoded.buffer, [encoded.buffer]);
            } else {
                const data = await i.runFunRaw((context as Context).reqHandler as FunValue, [thisThread, (msg as RequestMessage).data], globalScope);
                const encoded = new Uint8Array(encode({ type: MessageType.RequestResponse, data, requestId: (msg as RequestMessage).requestId } as RequestMessage));
                self.postMessage(encoded.buffer, [encoded.buffer]);
            }
            break;
        }
        case MessageType.Post: {
            while (context == undefined) {
                await sleep(5);
            }
            if ((context as Context).postHandler != undefined) {
                await i.runFunRaw((context as Context).postHandler as FunValue, [thisThread, (msg as PostMessage).data], globalScope);
            }
            break;
        }
    }
}

while (context == undefined) {
    await sleep(5);
}

try {
    await i.runFunRaw((context as Context).fun, [thisThread], globalScope);
} catch (e) {
    if (!done) {
        throw e;
    }
}

{
    const encoded = new Uint8Array(encode({ type: MessageType.Finish } as ThreadMessage));
    self.postMessage(encoded.buffer, [encoded.buffer]);
}