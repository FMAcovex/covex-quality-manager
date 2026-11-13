// Recorridos por módulo (D-138): un mismo guion es prueba de punta a punta y, si se pide, vídeo.
//
// - Modo prueba (por defecto): sin pausas ni rótulos. Se ejecuta contra la base aislada de pruebas
//   (CI, APP_ENV=test) con la identidad sintética, comprueba cada paso y borra lo que ha creado.
// - Modo vídeo (TOUR_VIDEO_DIR=<carpeta>): mismo guion, con cursor, rótulos y ritmo de lectura.
//   Pensado para la demo local (APP_ENV=demo); los expedientes creados se quedan en la demo.
//
// Solo con datos ficticios. No es evidencia de validación GMP.
import { chromium, type Browser, type BrowserContext, type Locator, type Page } from "playwright";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { authConfiguration, isolatedTestEnvironment, localDemoEnvironment } from "../../src/lib/auth/config";
import { authenticateContext } from "../auth-fixtures/browser";
import { getZipEntryText, readZip } from "../../src/lib/ooxml/zip";

export type Tour = {
  page: Page;
  base: string;
  /** true en la demo local; false en la base aislada de pruebas. */
  demo: boolean;
  record: boolean;
  /** Paso numerado: rótulo en el vídeo y nombre del paso en el error si falla. */
  step<T>(caption: string, run: () => Promise<T>): Promise<T>;
  caption(html: string): Promise<void>;
  pause(ms: number): Promise<void>;
  go(pathname: string): Promise<void>;
  click(target: Locator): Promise<void>;
  fill(target: Locator, text: string): Promise<void>;
  select(target: Locator, value: string | { label: string } | { index: number }): Promise<void>;
  check(target: Locator): Promise<void>;
  /** Descarga lo que produce el clic en el enlace y devuelve el archivo. */
  download(trigger: Locator): Promise<{ name: string; bytes: Buffer }>;
  /**
   * Pulsa un enlace de documento oficial y devuelve el archivo o, si la aplicación muestra «Plantilla oficial no
   * disponible», null. Sigue lo que hace la ruta en lugar de adivinar qué plantilla usará. En la demo, donde las
   * plantillas están instaladas, un null es un fallo. Si la aplicación muestra otro error, falla con su texto.
   */
  downloadOrUnavailable(trigger: Locator): Promise<{ name: string; bytes: Buffer } | null>;
  /**
   * TPL1: la ficha solo ofrece generar un anexo si su plantilla está instalada; si no, muestra «<anexo>: plantilla
   * oficial no instalada». Descarga con el enlace o, si la ficha muestra esa nota, comprueba que no ofrece el enlace
   * y devuelve null. En la demo, donde las plantillas están instaladas, la nota es un fallo.
   */
  downloadOrMissing(trigger: Locator, annex: string): Promise<{ name: string; bytes: Buffer } | null>;
  /** Solo en vídeo: muestra la primera página del documento (necesita LibreOffice). */
  showDocument(name: string, bytes: Buffer, caption: string): Promise<void>;
  close(): Promise<void>;
};

// Script del navegador como texto: tsx añadiría ayudas (__name) que no existen en la página.
const OVERLAY = `(() => {
  const ready = () => {
    if (document.getElementById("__tour_cursor")) return;
    const style = document.createElement("style");
    style.textContent = \`#__tour_cursor{position:fixed;z-index:2147483647;left:0;top:0;width:26px;height:26px;pointer-events:none}
      #__tour_ripple{position:fixed;z-index:2147483646;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;border:3px solid #22d3ee;pointer-events:none;opacity:0}
      #__tour_caption{position:fixed;z-index:2147483645;left:50%;bottom:26px;transform:translateX(-50%);max-width:1150px;padding:16px 28px;border-radius:14px;background:rgba(10,18,36,.9);color:#fff;font:600 22px/1.35 Inter,system-ui,sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.35);text-align:center;pointer-events:none}
      #__tour_caption b{color:#7dd3fc}\`;
    document.head.appendChild(style);
    const cursor = document.createElement("div"); cursor.id = "__tour_cursor";
    cursor.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M3 2l15.5 10.2-6.6 1.3 3.9 7.3-2.9 1.5-3.9-7.4L3 19.6z" fill="#fff" stroke="#0b1220" stroke-width="1.4" stroke-linejoin="round"/></svg>';
    const ripple = document.createElement("div"); ripple.id = "__tour_ripple";
    const caption = document.createElement("div"); caption.id = "__tour_caption"; caption.style.display = "none";
    document.body.append(cursor, ripple, caption);
    const position = JSON.parse(sessionStorage.getItem("__tour_pos") || "[720,450]");
    cursor.style.transform = \`translate(\${position[0]}px,\${position[1]}px)\`;
    const saved = sessionStorage.getItem("__tour_caption"); if (saved) { caption.innerHTML = saved; caption.style.display = "block"; }
    addEventListener("mousemove", (e) => { cursor.style.transform = \`translate(\${e.clientX}px,\${e.clientY}px)\`; sessionStorage.setItem("__tour_pos", JSON.stringify([e.clientX, e.clientY])); }, true);
    addEventListener("mousedown", (e) => { ripple.style.left = e.clientX + "px"; ripple.style.top = e.clientY + "px"; ripple.animate([{ opacity: 1, transform: "scale(.4)" }, { opacity: 0, transform: "scale(1.6)" }], { duration: 550 }); }, true);
    (window).__tourCaption = (text) => {
      if (text) { caption.innerHTML = text; caption.style.display = "block"; sessionStorage.setItem("__tour_caption", text); }
      else { caption.style.display = "none"; sessionStorage.removeItem("__tour_caption"); }
    };
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ready); else ready();
})();`;

/** Texto plano de las partes indicadas de un DOCX/XLSX (sin etiquetas). */
export function ooxmlText(bytes: Buffer, parts: RegExp) {
  const entries = readZip(bytes);
  return entries.filter((entry) => parts.test(entry.name)).map((entry) => getZipEntryText(entries, entry.name))
    .join(" ").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/\s+/g, " ");
}

/** Dónde puede ejecutarse un recorrido: la base aislada de pruebas o la demo local; en cualquier otro sitio, error. */
export function tourEnvironment(env: Record<string, string | undefined> = process.env): "test" | "demo" {
  if (localDemoEnvironment(env)) return "demo";
  if (isolatedTestEnvironment(env)) return "test";
  throw new Error("Los recorridos solo se ejecutan en la base aislada de pruebas o en la demo local.");
}

/**
 * Cierra el recorrido: ejecuta todos los pasos de cierre (navegador, limpieza, desconexión) aunque
 * alguno falle. Si un paso del recorrido ya había fallado, se relanza ese error, con los del cierre
 * añadidos, para no perder el paso, la página y los mensajes en pantalla.
 */
export async function finishTour(stepError: unknown, closers: (() => Promise<unknown>)[]) {
  const closing: Error[] = [];
  for (const close of closers) {
    try { await close(); } catch (error) { closing.push(error instanceof Error ? error : new Error(String(error))); }
  }
  if (stepError) {
    const primary = stepError instanceof Error ? stepError : new Error(String(stepError));
    if (closing.length) primary.message += "\nAdemás, al cerrar el recorrido:\n- " + closing.map((e) => e.message).join("\n- ");
    throw primary;
  }
  if (closing.length) throw closing[0];
}

/**
 * Espera a que la base de datos refleje lo guardado. Si la pantalla muestra un error del servidor, falla en
 * ese momento con su texto en lugar de agotar el tiempo.
 */
export async function waitForSaved<T>(read: () => Promise<T | null | undefined | false>, what: string,
  options: { timeoutMs?: number; intervalMs?: number; screenError?: () => Promise<string | null> } = {}): Promise<T> {
  const deadline = Date.now() + (options.timeoutMs ?? 15000);
  for (;;) {
    const value = await read();
    if (value) return value;
    const shown = await options.screenError?.();
    if (shown) throw new Error(`No se ha guardado ${what}: ${shown}`);
    if (Date.now() > deadline) throw new Error(`No se ha guardado ${what}.`);
    await new Promise((resolve) => setTimeout(resolve, options.intervalMs ?? 250));
  }
}

export async function startTour(name: string): Promise<Tour> {
  const demo = tourEnvironment() === "demo";
  const videoDir = process.env.TOUR_VIDEO_DIR ? path.resolve(process.env.TOUR_VIDEO_DIR) : null;
  const record = Boolean(videoDir);
  const base = authConfiguration().origin.replace(/\/$/, "");
  if (videoDir) fs.mkdirSync(videoDir, { recursive: true });
  const spanish = { ...process.env, LANG: "es_ES.UTF-8", LANGUAGE: "es_ES:es", LC_ALL: "es_ES.UTF-8" };
  const browser: Browser = await chromium.launch({ args: ["--lang=es-ES"], env: spanish });
  const context: BrowserContext = await browser.newContext({
    viewport: { width: 1440, height: 900 }, locale: "es-ES", timezoneId: "Europe/Madrid", acceptDownloads: true,
    ...(videoDir ? { recordVideo: { dir: videoDir, size: { width: 1440, height: 900 } } } : {}),
  });
  if (record) await context.addInitScript({ content: OVERLAY });
  const errors: string[] = [];
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  let stepNumber = 0;

  const pause = (ms: number) => record ? page.waitForTimeout(ms) : Promise.resolve();
  const settle = async () => { await page.waitForLoadState("networkidle"); await pause(400); };
  const caption = async (html: string) => { if (record) await page.evaluate((text) => (window as unknown as { __tourCaption?: (t: string) => void }).__tourCaption?.(text), html); };
  const moveTo = async (target: Locator) => {
    await target.scrollIntoViewIfNeeded();
    if (!record) return;
    await pause(200);
    const box = await target.boundingBox();
    if (box) await page.mouse.move(box.x + Math.min(box.width / 2, 120), box.y + box.height / 2, { steps: 20 });
    await pause(150);
  };

  const tour: Tour = {
    page, base, demo, record, caption, pause,
    async step(text, run) {
      stepNumber += 1;
      await caption(text);
      try { return await run(); }
      catch (error) {
        // Lo que el usuario vería en pantalla: mensajes de error del formulario y la dirección.
        const shown = await page.locator('.field-error, [role="alert"], .form-errors:not(.draft-notice), .error-summary, .form-feedback.error').allInnerTexts().catch(() => []);
        const visible = [...new Set(shown.map((t) => t.trim()).filter(Boolean))].slice(0, 12);
        const shot = process.env.TOUR_FAILURE_DIR ? path.join(process.env.TOUR_FAILURE_DIR, `${name.replace(/\W+/g, "-")}-paso-${stepNumber}.png`) : null;
        if (shot) { fs.mkdirSync(path.dirname(shot), { recursive: true }); await page.screenshot({ path: shot, fullPage: true }).catch(() => undefined); }
        throw new Error(`Recorrido «${name}», paso ${stepNumber} (${text.replace(/<[^>]+>/g, "")}): ${(error as Error).message}\nPágina: ${page.url()}${visible.length ? "\nMensajes en pantalla:\n- " + visible.join("\n- ") : ""}${shot ? "\nCaptura: " + shot : ""}`, { cause: error });
      }
    },
    async go(pathname) { await page.goto(base + pathname); await settle(); },
    async click(target) { await moveTo(target); await target.click(); await settle(); },
    async fill(target, text) {
      await moveTo(target);
      const kind = await target.getAttribute("type");
      if (kind && ["date", "datetime-local", "time", "month"].includes(kind)) { await target.fill(text); await pause(300); return; }
      if (record) { await target.click(); await target.fill(""); await target.pressSequentially(text, { delay: 22 }); await pause(200); }
      else await target.fill(text);
    },
    async select(target, value) { await moveTo(target); await target.selectOption(value as never); await pause(350); },
    async check(target) { await moveTo(target); await target.check(); await pause(250); },
    async download(trigger) {
      const pending = page.waitForEvent("download");
      await moveTo(trigger); await trigger.click();
      const file = await pending;
      const filePath = await file.path();
      if (!filePath) throw new Error(`La descarga «${file.suggestedFilename()}» no ha terminado: ${await file.failure()}`);
      await pause(600);
      return { name: file.suggestedFilename(), bytes: fs.readFileSync(filePath) };
    },
    async downloadOrUnavailable(trigger) {
      let downloadError: unknown = null;
      // Cada espera captura sus propios rechazos: la que no gane la carrera no puede tumbar el proceso después.
      const downloaded = page.waitForEvent("download", { timeout: 30000 }).then(async (file) => {
        const filePath = await file.path();
        if (!filePath) throw new Error(`La descarga «${file.suggestedFilename()}» no ha terminado: ${await file.failure()}`);
        return { name: file.suggestedFilename(), bytes: fs.readFileSync(filePath) };
      }).catch((error) => { downloadError = error; return null; });
      await moveTo(trigger); await trigger.click();
      const shown = page.locator("h1").filter({ hasText: /^(Plantilla oficial no disponible|Documento no disponible)$/ }).first();
      const page503 = shown.waitFor({ timeout: 30000 }).then(() => "page" as const, () => null);
      const first = await Promise.race([downloaded, page503]);
      if (first && first !== "page") { await pause(600); return first; }
      if (first === "page") {
        const heading = (await shown.innerText()).trim();
        if (heading === "Plantilla oficial no disponible") {
          if (demo) throw new Error("En la demo las plantillas están instaladas, pero la aplicación indica «Plantilla oficial no disponible».");
          return null;
        }
        const detail = await page.locator(".note, main p").allInnerTexts().catch(() => []);
        throw new Error(`La aplicación no generó el documento: ${heading}. ${detail.join(" ").trim()}`);
      }
      const late = await downloaded;
      if (late) return late;
      throw new Error(`Ni se descargó el documento ni la aplicación indicó por qué.${downloadError ? ` ${(downloadError as Error).message}` : ""}`);
    },
    async downloadOrMissing(trigger, annex) {
      const note = page.getByTestId("template-missing").filter({ hasText: `${annex}: plantilla oficial no instalada` }).first();
      const shown = await Promise.race([
        trigger.waitFor({ timeout: 30000 }).then(() => "link" as const, () => null),
        note.waitFor({ timeout: 30000 }).then(() => "note" as const, () => null),
      ]);
      if (shown === "link") return this.download(trigger);
      if (shown === "note") {
        if (demo) throw new Error(`En la demo las plantillas están instaladas, pero la ficha indica que falta la de «${annex}».`);
        if (await trigger.count()) throw new Error(`La ficha ofrece «${annex}» y a la vez indica que falta su plantilla.`);
        await moveTo(note); await pause(600);
        return null;
      }
      throw new Error(`La ficha no ofrece «${annex}» ni explica que falte su plantilla.`);
    },
    async showDocument(fileName, bytes, text) {
      if (!videoDir) return;
      const work = fs.mkdtempSync(path.join(videoDir, "doc-"));
      const source = path.join(work, fileName.replace(/[^\w.-]+/g, "_"));
      fs.writeFileSync(source, bytes);
      try {
        execFileSync("soffice", ["--headless", "--convert-to", "pdf", "--outdir", work, source], { stdio: "ignore", timeout: 180000, env: spanish });
        const pdf = fs.readdirSync(work).find((f) => f.endsWith(".pdf"));
        if (!pdf) return;
        execFileSync("pdftoppm", ["-r", "110", "-png", "-f", "1", "-l", "1", path.join(work, pdf), path.join(work, "page")]);
      } catch { return; /* Sin LibreOffice o poppler el vídeo sigue sin la imagen del documento. */ }
      const png = fs.readdirSync(work).find((f) => f.startsWith("page") && f.endsWith(".png"));
      if (!png) return;
      fs.writeFileSync(path.join(work, "page.html"), `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#0b1220;display:flex;justify-content:center}img{display:block;max-width:1440px;height:auto;box-shadow:0 10px 40px #0008}</style><img src="${png}">`);
      const back = page.url();
      await page.goto("file://" + path.join(work, "page.html")); await page.waitForTimeout(400);
      await caption(text);
      await page.waitForTimeout(4500);
      await page.evaluate(() => scrollTo({ top: 700, behavior: "smooth" }));
      await page.waitForTimeout(2500);
      await page.goto(back); await settle();
    },
    async close() {
      const video = page.video();
      await context.close(); await browser.close();
      if (videoDir && video) {
        const target = path.join(videoDir, `${name}.webm`);
        fs.renameSync(await video.path(), target);
        try { execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", target, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", target.replace(/\.webm$/, ".mp4")]); }
        catch { /* Sin ffmpeg queda el .webm. */ }
      }
      if (errors.length) throw new Error(`Errores de JavaScript en la página durante el recorrido «${name}»:\n${errors.join("\n")}`);
    },
  };

  if (demo) {
    await tour.go("/login");
    await tour.click(page.locator("button", { hasText: "Garantía de Calidad" }));
    await page.waitForURL(base + "/");
  } else {
    await authenticateContext(context);
  }
  return tour;
}
