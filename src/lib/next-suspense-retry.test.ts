import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

// Exercise the renderer actually bundled by Next, not the separately installed
// react-dom. A Flight chunk can resolve synchronously during a suspended render.
const nextRoot = dirname(createRequire(import.meta.url).resolve("next/package.json"));
function rendererFunction(source: string, name: string) {
  const start = source.indexOf(`function ${name}(`);
  if (start < 0) throw Error(`Missing bundled renderer function: ${name}`);
  const end = source.indexOf("\nfunction ", start + 1);
  const indentedEnd = source.indexOf("\n    function ", start + 1);
  return source.slice(start, Math.min(...[end, indentedEnd].filter(n => n >= 0)));
}

describe("Next bundled React synchronous Suspense retry", () => {
  for (const mode of ["production", "development"]) {
    it(`${mode}: preserves a ping delivered during render before marking lanes suspended`, () => {
      const source = readFileSync(join(nextRoot, `dist/compiled/react-dom/cjs/react-dom-client.${mode}.js`), "utf8");
      const lane = 4096;
      const root = { pingCache: new WeakMap(), suspendedLanes: lane, pingedLanes: 0, warmLanes: 0, expirationTimes: Array(32).fill(-1) };
      const context = {
        root, lane, wakeable: {}, workInProgressRoot: root,
        workInProgressRootRenderLanes: lane, workInProgressRootExitStatus: 4,
        executionContext: 2, workInProgressRootPingedLanes: 0,
        workInProgressRootInterleavedUpdatedLanes: 0, workInProgressSuspendedRetryLanes: 0,
        RootSuspendedWithDelay: 4, RootSuspended: 3, RenderContext: 2, NoContext: 0,
        globalMostRecentFallbackTime: 0, FALLBACK_THROTTLE_MS: 300,
        now: () => 0, now$1: () => 0, clz32: Math.clz32,
        ensureRootIsScheduled: () => {}, isConcurrentActEnvironment: () => false,
        prepareFreshStack: () => { throw Error("Cannot reset an active render"); },
      };
      runInNewContext(`${rendererFunction(source, "pingSuspendedRoot")}\n${rendererFunction(source, "markRootSuspended")}\npingSuspendedRoot(root, wakeable, lane);\nmarkRootSuspended(root, lane, 0, true);`, context);
      expect(context.workInProgressRootPingedLanes).toBe(lane);
      expect(root.suspendedLanes).toBe(lane);
      expect(root.pingedLanes).toBe(lane);
    });
  }
});
