import { deepEqual, equal } from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import { createContext, runInContext } from "node:vm";
import { ModuleKind, ScriptTarget, transpileModule } from "typescript";

function setup() {
  const observers = new Map<number, { notify: (...args: any[]) => void }>();
  const unloadCallbacks: Array<() => void> = [];
  const timers: Array<{ callback: () => void; delay: number }> = [];
  const queries: number[][] = [];
  let nextID = 0;
  const paper = {
    id: 1,
    libraryID: 1,
    isRegularItem: () => true,
    isAttachment: () => false,
  };
  const note = { ...paper, id: 2, isRegularItem: () => false };
  const addon = { data: { alive: true }, hooks: {} as any };
  const toolkit = { log() {}, unregisterAll() {} };
  const mainWindow = {
    document: { getElementById: () => null },
    addEventListener(event: string, callback: () => void) {
      if (event === "unload") unloadCallbacks.push(callback);
    },
  };
  const context = createContext({
    addon,
    window: mainWindow,
    ztoolkit: toolkit,
    setTimeout(callback: () => void, delay: number) {
      timers.push({ callback, delay });
    },
    Zotero: {
      Notifier: {
        registerObserver(callback: { notify: (...args: any[]) => void }) {
          const id = ++nextID;
          observers.set(id, callback);
          return id;
        },
        unregisterObserver(id: number) {
          observers.delete(id);
        },
      },
      Items: {
        get: (ids: number[]) => ids.map((id) => (id === 1 ? paper : note)),
      },
      Libraries: { get: () => ({ _libraryType: "user" }) },
    },
  });
  // Execute the actual modules with Zotero and UI dependencies supplied by the host.
  // Each test gets a separate plugin sandbox, like an independent addon instance.
  const dependencies: Record<string, unknown> = {
    "../../package.json": { config: { addonRef: "ccfinfo" } },
    "../package.json": { config: { addonInstance: "CCFInfo" } },
    "../utils/locale": {},
    "./getPaperInfo": {},
    "./utils/locale": {},
    "./utils/ztoolkit": { createZToolkit: () => toolkit },
  };
  function loadModule(path: string) {
    const code = transpileModule(readFileSync(path, "utf8"), {
      compilerOptions: {
        module: ModuleKind.CommonJS,
        target: ScriptTarget.ES2020,
      },
    }).outputText;
    const module = { exports: {} as any };
    const execute = runInContext(
      `(function(require, module, exports) { ${code}\n})`,
      context,
    );
    execute(
      (name: string) => {
        if (!(name in dependencies))
          throw new Error(`Unexpected import: ${name}`);
        return dependencies[name];
      },
      module,
      module.exports,
    );
    return module.exports;
  }
  const { ExampleFactory } = loadModule("src/modules/examples.ts");
  ExampleFactory.handleGetCCFInfo = async (items: Array<{ id: number }>) => {
    queries.push(Array.from(items, (item) => item.id));
  };
  dependencies["./modules/examples"] = { ExampleFactory };
  const hooks = loadModule("src/hooks.ts").default;
  addon.hooks = hooks;
  return {
    factory: ExampleFactory,
    hooks,
    observers,
    unloadCallbacks,
    timers,
    queries,
    mainWindow,
  };
}

it("keeps automatic item queries alive after closing and reopening the main window", async () => {
  const env = setup();
  env.factory.registerNotifier();
  await env.hooks.onMainWindowUnload(env.mainWindow);
  env.unloadCallbacks.forEach((callback) => callback());
  await env.hooks.onMainWindowLoad(env.mainWindow);
  equal(env.observers.size, 1);
  const observer = [...env.observers.values()][0];
  await observer.notify("add", "item", [1, 2], {});
  equal(env.timers.length, 1);
  equal(env.timers[0].delay, 10000);
  env.timers[0].callback();
  await new Promise((resolve) => setImmediate(resolve));
  deepEqual(env.queries, [[1]]);
});

it("does not register duplicate observers", () => {
  const env = setup();
  env.factory.registerNotifier();
  env.factory.registerNotifier();
  equal(env.observers.size, 1);
});

it("unregisters the observer when the plugin shuts down", () => {
  const env = setup();
  env.factory.registerNotifier();
  env.hooks.onShutdown();
  equal(env.observers.size, 0);
});

it("does not start recursive queries for notes or item modifications", async () => {
  const env = setup();
  env.factory.registerNotifier();
  const observer = [...env.observers.values()][0];
  await observer.notify("add", "item", [2], {});
  await observer.notify("modify", "item", [1], {});
  equal(env.timers.length, 0);
});

it("does not run a pending delayed query after plugin shutdown", async () => {
  const env = setup();
  env.factory.registerNotifier();
  await [...env.observers.values()][0].notify("add", "item", [1], {});
  env.hooks.onShutdown();
  env.timers[0].callback();
  await new Promise((resolve) => setImmediate(resolve));
  deepEqual(env.queries, []);
});
