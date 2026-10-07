import { afterEach, describe, expect, it, vi } from "vitest";
import { highlightReviewTarget, navigateToReviewTarget } from "./navigation";

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("navegación de revisión", () => {
  it("carga la URL persistente del campo cuando cambia la pestaña/hilo/anchor", () => {
    const assign = vi.fn();
    vi.stubGlobal("window", { location: { href: "https://qms.test/changes/id?tab=review&review=1", assign } });
    navigateToReviewTarget("/changes/id?tab=dictamen&review=1&thread=t#review-target", "review-target");
    expect(assign).toHaveBeenCalledWith("https://qms.test/changes/id?tab=dictamen&review=1&thread=t#review-target");
  });
  it("no intenta enfocar objetivos inexistentes", () => {
    vi.stubGlobal("document", { getElementById: () => null });
    expect(highlightReviewTarget("missing")).toBeUndefined();
  });

  it("enfoca, desplaza y elimina el highlight; repetir el enlace reinicia sus tres segundos", () => {
    vi.useFakeTimers();
    const classes = new Set(["review-target"]);
    const element = {
      classList: { contains: (value: string) => classes.has(value), add: (value: string) => classes.add(value), remove: (value: string) => classes.delete(value) },
      scrollIntoView: vi.fn(), setAttribute: vi.fn(), focus: vi.fn(),
    };
    vi.stubGlobal("document", { getElementById: () => element });
    vi.stubGlobal("window", { setTimeout, clearTimeout });
    vi.stubGlobal("requestAnimationFrame", (callback: () => void) => { callback(); return 1; });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const firstCleanup = highlightReviewTarget("target");
    expect(element.scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
    expect(element.focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(classes.has("review-target-highlight")).toBe(true);
    vi.advanceTimersByTime(2000);
    highlightReviewTarget("target");
    firstCleanup?.();
    vi.advanceTimersByTime(1000);
    expect(classes.has("review-target-highlight")).toBe(true);
    vi.advanceTimersByTime(2000);
    expect(classes.has("review-target-highlight")).toBe(false);
  });
});
