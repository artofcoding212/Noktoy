import { FunValue, Value } from "../shared/values.ts";

export enum MessageType {
    Spawn, // Initial message sent to the spawned worker to give it what it needs to work on
    Post, // Sends to the opposing worker a Value that invokes the handler
    RequestResponse, // The response of a request
    Request, // Requests something from the opposing worker
    Finish, // Spawned worker sends a finish post to indicate that it's done executing
}

export interface ThreadMessage {
    type: MessageType,
}

export interface SpawnMessage extends ThreadMessage {
    fun: FunValue;
    postHandler?: FunValue;
    reqHandler?: FunValue;
}

export interface PostMessage extends ThreadMessage {
    data: Value;
}

export interface RequestMessage extends ThreadMessage {
    data: Value;
    requestId: number;
}