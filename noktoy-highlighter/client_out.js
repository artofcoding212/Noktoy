var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// client.ts
var client_exports = {};
__export(client_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(client_exports);
var vscode = __toESM(require("vscode"));
var import_node = require("vscode-languageclient/node");
var path = __toESM(require("path"));
var import_child_process = require("child_process");
var import_node_process = __toESM(require("node:process"));
var client;
var outputChannel;
function activate(ctx) {
  const serverModule = ctx.asAbsolutePath(path.join("server_out.js"));
  const serverOpts = {
    run: { module: serverModule, transport: import_node.TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: import_node.TransportKind.ipc,
      options: { execArgv: ["--nolazy", "--inspect=6009"] }
    }
  };
  const clientOpts = {
    documentSelector: [{ scheme: "file", language: "noktoy" }],
    synchronize: {
      fileEvents: vscode.workspace.createFileSystemWatcher("**/.clientrc")
    }
  };
  outputChannel = vscode.window.createOutputChannel("Noktoy Result");
  ctx.subscriptions.push(outputChannel);
  ctx.subscriptions.push(vscode.commands.registerCommand("noktoy.execute", () => {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const doc = editor.document;
      outputChannel.clear();
      outputChannel.appendLine(`---- Executing file ---`);
      outputChannel.show(true);
      let cmd;
      let args;
      if (import_node_process.default.platform == "win32") {
        cmd = "cmd.exe";
        args = ["/c", "noktoy", doc.fileName];
      } else {
        cmd = "noktoy";
        args = [doc.fileName];
      }
      const child = (0, import_child_process.spawn)(cmd, args, { cwd: vscode.Uri.file(doc.fileName).fsPath.substring(0, doc.fileName.lastIndexOf("/")) });
      child.stdout.on("data", (data) => {
        outputChannel.append(data.toString());
      });
      child.on("close", (code) => {
        if (code != 0) {
          outputChannel.appendLine(`---- File exited with ${code} ---`);
        } else {
          outputChannel.appendLine(`---- File exited successfully ---`);
        }
        outputChannel.show();
      });
      child.on("error", (err) => {
        outputChannel.appendLine(`Failed to start command: ${err.message}
Please ensure that you have Noktoy installed in your PATH and is called by 'noktoy'.`);
        vscode.window.showErrorMessage(`Error executing command: ${err.message}`);
        outputChannel.show();
      });
    } else {
      vscode.window.showWarningMessage("No file to execute");
    }
  }));
  client = new import_node.LanguageClient("noktoy", "Noktoy Server", serverOpts, clientOpts);
  client.start();
}
function deactivate() {
  return client ? client.stop() : void 0;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
