import "./style.css";
import QRCode from "qrcode";

type ExportFormat = "png" | "jpeg" | "webp" | "svg";
type ErrorLevel = "L" | "M" | "Q" | "H";

interface QrOptions {
  text: string;
  size: number;
  margin: number;
  foreground: string;
  background: string;
  transparent: boolean;
  errorCorrection: ErrorLevel;
}

const DEFAULTS: QrOptions = {
  text: "https://example.com",
  size: 512,
  margin: 2,
  foreground: "#0c1a16",
  background: "#ffffff",
  transparent: false,
  errorCorrection: "M",
};

const app = document.querySelector<HTMLDivElement>("#app")!;

app.innerHTML = `
  <header class="brand">
    <img class="brand-mark" src="/favicon.svg" alt="" width="44" height="44" />
    <h1 class="brand-text">QR<span>gen</span></h1>
  </header>
  <p class="tagline">
    Make a QR code in the browser, style it, then save as PNG, JPEG, WebP, or SVG.
    Nothing leaves your device.
  </p>

  <div class="workspace">
    <section class="panel" aria-labelledby="compose-title">
      <h2 id="compose-title">Compose</h2>

      <div class="field">
        <label for="content">Content</label>
        <textarea id="content" spellcheck="false" placeholder="URL, text, Wi‑Fi string, contact…">${DEFAULTS.text}</textarea>
        <p class="hint">Anything a QR can hold — links, plain text, or structured payloads.</p>
      </div>

      <div class="controls">
        <div class="field">
          <label for="fg">Foreground</label>
          <div class="color-row">
            <input type="color" id="fg" value="${DEFAULTS.foreground}" />
            <input type="text" id="fg-hex" value="${DEFAULTS.foreground}" maxlength="7" aria-label="Foreground hex" />
          </div>
        </div>

        <div class="field">
          <label for="bg">Background</label>
          <div class="color-row">
            <input type="color" id="bg" value="${DEFAULTS.background}" />
            <input type="text" id="bg-hex" value="${DEFAULTS.background}" maxlength="7" aria-label="Background hex" />
          </div>
        </div>

        <div class="field span-2">
          <label class="toggle" for="transparent">
            <input type="checkbox" id="transparent" />
            Transparent background
          </label>
          <p class="hint">Best with PNG, WebP, or SVG. JPEG fills white instead.</p>
        </div>

        <div class="field">
          <label for="size">Size <span id="size-label">${DEFAULTS.size}px</span></label>
          <input type="range" id="size" min="128" max="2048" step="16" value="${DEFAULTS.size}" />
        </div>

        <div class="field">
          <label for="margin">Quiet zone <span id="margin-label">${DEFAULTS.margin}</span></label>
          <input type="range" id="margin" min="0" max="8" step="1" value="${DEFAULTS.margin}" />
        </div>

        <div class="field span-2">
          <label for="ecc">Error correction</label>
          <select id="ecc">
            <option value="L">L — ~7% recovery</option>
            <option value="M" selected>M — ~15% recovery</option>
            <option value="Q">Q — ~25% recovery</option>
            <option value="H">H — ~30% recovery</option>
          </select>
        </div>
      </div>
    </section>

    <section class="panel preview-panel" aria-labelledby="preview-title">
      <h2 id="preview-title">Preview &amp; export</h2>

      <div class="preview-stage" aria-live="polite">
        <canvas id="preview" width="280" height="280" aria-label="QR code preview"></canvas>
      </div>

      <div class="export-row">
        <div class="field">
          <label for="format">Format</label>
          <select id="format">
            <option value="png" selected>PNG</option>
            <option value="jpeg">JPEG</option>
            <option value="webp">WebP</option>
            <option value="svg">SVG</option>
          </select>
        </div>
        <div class="field">
          <label for="filename">Filename</label>
          <input type="text" id="filename" value="qrcode" maxlength="64" />
        </div>
        <button class="btn btn-primary" id="download" type="button">Download</button>
      </div>

      <div class="actions">
        <button class="btn btn-ghost" id="copy" type="button">Copy image</button>
        <button class="btn btn-ghost" id="swap" type="button">Swap colors</button>
        <button class="btn btn-ghost" id="reset" type="button">Reset</button>
      </div>

      <p class="status" id="status" role="status"></p>
    </section>
  </div>

  <p class="footer-note">Runs entirely in your browser. No uploads, no accounts, no tracking.</p>
`;

const els = {
  content: app.querySelector<HTMLTextAreaElement>("#content")!,
  fg: app.querySelector<HTMLInputElement>("#fg")!,
  fgHex: app.querySelector<HTMLInputElement>("#fg-hex")!,
  bg: app.querySelector<HTMLInputElement>("#bg")!,
  bgHex: app.querySelector<HTMLInputElement>("#bg-hex")!,
  transparent: app.querySelector<HTMLInputElement>("#transparent")!,
  size: app.querySelector<HTMLInputElement>("#size")!,
  sizeLabel: app.querySelector<HTMLSpanElement>("#size-label")!,
  margin: app.querySelector<HTMLInputElement>("#margin")!,
  marginLabel: app.querySelector<HTMLSpanElement>("#margin-label")!,
  ecc: app.querySelector<HTMLSelectElement>("#ecc")!,
  format: app.querySelector<HTMLSelectElement>("#format")!,
  filename: app.querySelector<HTMLInputElement>("#filename")!,
  preview: app.querySelector<HTMLCanvasElement>("#preview")!,
  download: app.querySelector<HTMLButtonElement>("#download")!,
  copy: app.querySelector<HTMLButtonElement>("#copy")!,
  swap: app.querySelector<HTMLButtonElement>("#swap")!,
  reset: app.querySelector<HTMLButtonElement>("#reset")!,
  status: app.querySelector<HTMLParagraphElement>("#status")!,
};

let renderToken = 0;
let debounceTimer = 0;

function isHex(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

function readOptions(): QrOptions {
  return {
    text: els.content.value.trim() || " ",
    size: Number(els.size.value),
    margin: Number(els.margin.value),
    foreground: isHex(els.fgHex.value) ? els.fgHex.value : els.fg.value,
    background: isHex(els.bgHex.value) ? els.bgHex.value : els.bg.value,
    transparent: els.transparent.checked,
    errorCorrection: els.ecc.value as ErrorLevel,
  };
}

function setStatus(message: string, kind: "" | "ok" | "err" = "") {
  els.status.textContent = message;
  els.status.className = `status${kind ? ` ${kind}` : ""}`;
}

function syncColorInputs(source: "picker" | "hex", which: "fg" | "bg") {
  if (which === "fg") {
    if (source === "picker") els.fgHex.value = els.fg.value;
    else if (isHex(els.fgHex.value)) els.fg.value = els.fgHex.value;
  } else {
    if (source === "picker") els.bgHex.value = els.bg.value;
    else if (isHex(els.bgHex.value)) els.bg.value = els.bgHex.value;
  }
}

function qrSettings(options: QrOptions) {
  return {
    errorCorrectionLevel: options.errorCorrection,
    margin: options.margin,
    width: options.size,
    color: {
      dark: options.foreground,
      light: options.transparent ? "#00000000" : options.background,
    },
  };
}

async function renderPreview() {
  const token = ++renderToken;
  const options = readOptions();
  els.preview.classList.add("is-updating");
  els.sizeLabel.textContent = `${options.size}px`;
  els.marginLabel.textContent = String(options.margin);

  try {
    await QRCode.toCanvas(els.preview, options.text, {
      ...qrSettings({ ...options, size: 280 }),
      width: 280,
    });
    if (token !== renderToken) return;
    els.preview.classList.remove("is-updating");
    setStatus("");
  } catch (error) {
    if (token !== renderToken) return;
    els.preview.classList.remove("is-updating");
    const message = error instanceof Error ? error.message : "Could not generate QR code.";
    setStatus(message, "err");
  }
}

function scheduleRender() {
  window.clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(() => {
    void renderPreview();
  }, 80);
}

function safeFilename(raw: string, ext: string): string {
  const base = raw.trim().replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "") || "qrcode";
  return `${base}.${ext}`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Could not encode image."));
      },
      type,
      quality,
    );
  });
}

async function buildRaster(format: Exclude<ExportFormat, "svg">): Promise<{ blob: Blob; ext: string }> {
  const options = readOptions();
  const canvas = document.createElement("canvas");

  if (format === "jpeg" && options.transparent) {
    // JPEG has no alpha — composite onto white
    await QRCode.toCanvas(canvas, options.text, {
      ...qrSettings({ ...options, transparent: false, background: "#ffffff" }),
    });
    const blob = await canvasToBlob(canvas, "image/jpeg", 0.92);
    return { blob, ext: "jpg" };
  }

  await QRCode.toCanvas(canvas, options.text, qrSettings(options));

  if (format === "png") {
    return { blob: await canvasToBlob(canvas, "image/png"), ext: "png" };
  }
  if (format === "webp") {
    return { blob: await canvasToBlob(canvas, "image/webp", 0.92), ext: "webp" };
  }
  return { blob: await canvasToBlob(canvas, "image/jpeg", 0.92), ext: "jpg" };
}

async function buildSvg(): Promise<Blob> {
  const options = readOptions();
  const svg = await QRCode.toString(options.text, {
    type: "svg",
    errorCorrectionLevel: options.errorCorrection,
    margin: options.margin,
    width: options.size,
    color: {
      dark: options.foreground,
      light: options.transparent ? "#00000000" : options.background,
    },
  });
  return new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
}

async function download() {
  const format = els.format.value as ExportFormat;
  const name = els.filename.value;

  try {
    if (format === "svg") {
      const blob = await buildSvg();
      downloadBlob(blob, safeFilename(name, "svg"));
    } else {
      const { blob, ext } = await buildRaster(format);
      downloadBlob(blob, safeFilename(name, ext));
    }
    setStatus(`Saved as ${format.toUpperCase()}.`, "ok");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Download failed.";
    setStatus(message, "err");
  }
}

async function copyImage() {
  try {
    if (!("clipboard" in navigator) || !window.ClipboardItem) {
      throw new Error("Clipboard image copy is not supported in this browser.");
    }
    const { blob } = await buildRaster("png");
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    setStatus("Copied PNG to clipboard.", "ok");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Copy failed.";
    setStatus(message, "err");
  }
}

function swapColors() {
  const fg = els.fg.value;
  const bg = els.bg.value;
  els.fg.value = bg;
  els.bg.value = fg;
  els.fgHex.value = bg;
  els.bgHex.value = fg;
  scheduleRender();
}

function resetAll() {
  els.content.value = DEFAULTS.text;
  els.fg.value = DEFAULTS.foreground;
  els.fgHex.value = DEFAULTS.foreground;
  els.bg.value = DEFAULTS.background;
  els.bgHex.value = DEFAULTS.background;
  els.transparent.checked = DEFAULTS.transparent;
  els.size.value = String(DEFAULTS.size);
  els.margin.value = String(DEFAULTS.margin);
  els.ecc.value = DEFAULTS.errorCorrection;
  els.format.value = "png";
  els.filename.value = "qrcode";
  syncTransparentUi();
  scheduleRender();
  setStatus("Reset to defaults.", "ok");
}

els.content.addEventListener("input", scheduleRender);
els.size.addEventListener("input", scheduleRender);
els.margin.addEventListener("input", scheduleRender);
els.ecc.addEventListener("change", scheduleRender);
function syncTransparentUi() {
  const on = els.transparent.checked;
  els.bg.disabled = on;
  els.bgHex.disabled = on;
  els.bg.closest(".field")?.classList.toggle("is-disabled", on);
}

els.transparent.addEventListener("change", () => {
  syncTransparentUi();
  scheduleRender();
});

els.fg.addEventListener("input", () => {
  syncColorInputs("picker", "fg");
  scheduleRender();
});
els.bg.addEventListener("input", () => {
  syncColorInputs("picker", "bg");
  scheduleRender();
});
els.fgHex.addEventListener("input", () => {
  syncColorInputs("hex", "fg");
  scheduleRender();
});
els.bgHex.addEventListener("input", () => {
  syncColorInputs("hex", "bg");
  scheduleRender();
});

els.download.addEventListener("click", () => {
  void download();
});
els.copy.addEventListener("click", () => {
  void copyImage();
});
els.swap.addEventListener("click", swapColors);
els.reset.addEventListener("click", resetAll);

syncTransparentUi();
void renderPreview();
