// deno-lint-ignore-file require-await
import { Interpreter, Scope } from "../backend/interpreter.ts";
import { encode } from "@msgpack/msgpack";
import { FunValue, NativeFunValue, NoneValue, ObjectValue, StaticStructValue, StructValue, Value, ValueType } from "../shared/values.ts";
import { MessageType, PostMessage, RequestMessage, SpawnMessage, ThreadMessage } from "../thread/shared.ts";
import { decode } from "@msgpack/msgpack";
import { Type } from "../shared/types.ts";

export const thread_str: StaticStructValue = {
    type: ValueType.StaticStruct,
    fields: new Map(),
    staticFields: new Map(),
    staticFuns: new Map(),
    funs: new Map(),
} as StaticStructValue;

/*

Std::Thread (Struct)
|> A structure for multitheading your code which prevents race conditions.

Contributors
* artofcoding212 (Github & Discord)

Documentation
Static functions
new(main: fun (this: Thread) Any, optional data: { 
   optional onPost: fun(this: Thread, msg: Any) Any, 
   optional onRequest: fun(this: Thread, msg: Any) Any 
}) Thread
   | Creates a new Thread instance with the given main function and optional post and request handlers.
   | This does not immediately execute the Thread. Note that you must :spawn() it to actually execute it.

[FATAL WARNING] To prevent race conditions, threads spawned with .new() start with a completely
fresh scope other than the Thread data type. The handlers and the main function share the same scope.

Non-static functions
[NOTE] When you want to call one of these functions on the Thread parameter given into the handlers/main function
on Thread.new(), you do NOT need to pass in a self parameter. (see difference at ln 22 of playground/threads.noktoy and ln 59 for examples)

spawn(self: Thread, optional data: {
   optional onPost: fun(msg: Any) Any,
   optional onRequest: fun(msg: Any) Any,
})
   | Actually executes the Thread object in a new thread, achieving true multithreaded parallelism.
   | You can define optional post and request handlers.

post(self: Thread, message: Any)
   | Sends a message to the opposing side (main thread to spawned thread / spawned thread to main thread).
   | This calls the opposing side's onPost handler.

[YIELDS] req(self: Thread, message: Any) Any
   | Sends a request message to the opposing side (main thread to spawned thread / spawned thread to main thread).
   | This calls the opposing side's onRequest handler, which in turn will eventually make its way to the result of this function.

[WARNING] Transmitting messages is completely asynchronous, howwever the message handler itself is put on
the opposing thread that you are sending it to. This means that if you are doing heavy computation on one thread
and it receives a message, it will block the message handler until that computation is over.
To fix this, use Std::Time::sleep during heavy computation

close(self: Thread)
   | Closes the thread, ending its execution until restarted (though its point in execution is NOT saved if you respawn it)

*/

thread_str.staticFuns.set('new', { type: ValueType.Native, body:
    async (args: Value[], _scope: Scope, _i: Interpreter): Promise<Value> => {
        if (
            args.length != 1 && args.length != 2 && args[0].type != ValueType.Fun
            || (args.length == 2 ?
                (args[1].type != ValueType.Object || 
                    ((args[1] as ObjectValue).val.has('{"type":2,"value":"onPost"}') ? (args[1] as ObjectValue).val.get('{"type":2,"value":"onPost"}')?.type != ValueType.Fun : false) ||
                    ((args[1] as ObjectValue).val.has('{"type":2,"value":"onRequest"}') ? (args[1] as ObjectValue).val.get('{"type":2,"value":"onRequest"}')?.type != ValueType.Fun : false)
                )
            : false)
        ) {
            throw `invalid function signature to Std::Thread::new() static function`;
        }

        const fields = new Map();
        fields.set('thread_main', args[0]);
        if (args.length == 2 && (args[1] as ObjectValue).val.has('{"type":2,"value":"onPost"}')) {
            fields.set('thread_onpost', (args[1] as ObjectValue).val.get('{"type":2,"value":"onPost"}'));
        }
        if (args.length == 2 && (args[1] as ObjectValue).val.has('{"type":2,"value":"onRequest"}')) {
            fields.set('thread_onreq', (args[1] as ObjectValue).val.get('{"type":2,"value":"onRequest"}'));
        }
        return { type: ValueType.Struct, parent: thread_str, fields } as StructValue;
    }
} as NativeFunValue)

thread_str.funs.set('post', { type: ValueType.Native, body: 
    async (args: Value[], _scope: Scope, _i: Interpreter): Promise<Value> => {
        if (
            args.length != 2 
            || args[0].type != ValueType.Struct 
            || JSON.stringify((args[0] as StructValue).parent) != JSON.stringify(thread_str)
            || !(args[0] as StructValue).fields.has('thread_worker')
        ) {
            throw `invalid function signature to Std::Thread::post()`;
        }
        const encoded = new Uint8Array(encode({ type: MessageType.Post, data: args[1] } as PostMessage));
        ((args[0] as StructValue).fields.get('thread_worker') as unknown as Worker).postMessage(encoded.buffer, [encoded.buffer]);
        return { type: ValueType.None } as NoneValue;
    }
} as NativeFunValue);

thread_str.funs.set('close', { type: ValueType.Native, body: 
    async (args: Value[], _scope: Scope, _i: Interpreter): Promise<Value> => {
        if (
            args.length != 1 
            || args[0].type != ValueType.Struct 
            || JSON.stringify((args[0] as StructValue).parent) != JSON.stringify(thread_str)
            || !(args[0] as StructValue).fields.has('thread_worker')
        ) {
            throw `invalid function signature to Std::Thread::close()`;
        }
        ((args[0] as StructValue).fields.get('thread_worker') as unknown as Worker).terminate();
        return { type: ValueType.None } as NoneValue;
    }
} as NativeFunValue);

const requests: Map<number, Value|undefined> = new Map();
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

thread_str.funs.set('req', { type: ValueType.Native, body: 
    async (args: Value[], _scope: Scope, _i: Interpreter): Promise<Value> => {
        if (
            args.length != 2 
            || args[0].type != ValueType.Struct 
            || JSON.stringify((args[0] as StructValue).parent) != JSON.stringify(thread_str)
            || !(args[0] as StructValue).fields.has('thread_worker')
        ) {
            throw `invalid function signature to Std::Thread::req()`;
        }
        const requestId = requests.keys().toArray().length+1;
        requests.set(requestId, undefined);
        const encoded = new Uint8Array(encode({ type: MessageType.Request, data: args[1], requestId } as RequestMessage));
        ((args[0] as StructValue).fields.get('thread_worker') as unknown as Worker).postMessage(encoded.buffer, [encoded.buffer]);

        while (requests.get(requestId) == undefined) {
            await sleep(5);
        }

        const result = {...requests.get(requestId)};
        requests.delete(requestId);

        return result as Value;
    }
} as NativeFunValue);

thread_str.funs.set('spawn', { type: ValueType.Native, body:
    async (args: Value[], scope: Scope, i: Interpreter): Promise<Value> => {
        if (
            (!(args.length == 1 || args.length==2) || args[0].type != ValueType.Struct || JSON.stringify((args[0] as StructValue).parent) != JSON.stringify(thread_str))
            || (args.length == 2 ?
                (args[1].type == ValueType.Object && 
                    (((args[1] as ObjectValue).val.has('{"type":2,"value":"onPost"}') ? (args[1] as ObjectValue).val.get('{"type":2,"value":"onPost"}')?.type != ValueType.Fun : false) ||
                    ((args[1] as ObjectValue).val.has('{"type":2,"value":"onRequest"}') ? (args[1] as ObjectValue).val.get('{"type":2,"value":"onRequest"}')?.type != ValueType.Fun : false))
                )
            : false)
        ) {
            throw `invalid function signature to Std::Thread::spawn() function`;
        }

        const postHandler = args.length == 2 ? (args[1] as ObjectValue).val.get('{"type":2,"value":"onPost"}') : undefined;
        const reqHandler = args.length == 2 ? (args[1] as ObjectValue).val.get('{"type":2,"value":"onRequest"}') : undefined;

        const worker = new Worker(new URL('../thread/worker.ts', import.meta.url).href, { type: "module" });
        worker.onmessage = async (event: MessageEvent) => {
            const msg = decode(new Uint8Array(event.data)) as ThreadMessage;
            switch (msg.type as MessageType) {
                case MessageType.RequestResponse: {
                    requests.set((msg as RequestMessage).requestId, (msg as RequestMessage).data);
                    break;
                }
                case MessageType.Request: {
                    if (reqHandler == undefined) {
                        const encoded = new Uint8Array(encode({ type: MessageType.RequestResponse, data: { type: ValueType.None } as NoneValue, requestId: (msg as RequestMessage).requestId } as RequestMessage));
                        worker.postMessage(encoded.buffer, [encoded.buffer]);
                    } else {
                        const data = await i.runFun(reqHandler as FunValue, [(msg as RequestMessage).data], scope);
                        const encoded = new Uint8Array(encode({ type: MessageType.RequestResponse, data, requestId: (msg as RequestMessage).requestId } as RequestMessage));
                        worker.postMessage(encoded.buffer, [encoded.buffer]);
                    }
                    break;
                }
                case MessageType.Post: {
                    if (postHandler != undefined) {
                        await i.runFun(postHandler as FunValue, [(msg as PostMessage).data], i.globalScope);
                    }
                    break;
                }
                case MessageType.Finish: {
                    worker.terminate();
                    break;
                }
            }
        }
        (args[0] as StructValue).fields.set('thread_worker', worker as unknown as [Value,Type]);

        const encoded = new Uint8Array(encode({
            type: MessageType.Spawn,
            postHandler: (args[0] as StructValue).fields.get('thread_onpost') as unknown as FunValue|undefined,
            reqHandler: (args[0] as StructValue).fields.get('thread_onreq') as unknown as FunValue|undefined,
            fun: (args[0] as StructValue).fields.get('thread_main') as unknown as FunValue,
        } as SpawnMessage));
        worker.postMessage(encoded.buffer, [encoded.buffer]);
        
        return { type: ValueType.None } as NoneValue;
    }
} as NativeFunValue);