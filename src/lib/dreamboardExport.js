import { jsPDF } from "jspdf";
import { getShapeColor } from "./dreamboardShapeColors";
import {
  drawLinearShapeWithTextMask,
  drawPolygonPath,
  drawWireRoute,
  getDiamondPoints,
  getLinearTextMaskHalfGap,
  getStarPoints,
  isLinearShape,
  isWireConnector,
  resolveLinearPoints,
  syncArrowConnections,
  toLocalWireRoute,
} from "./dreamboardShapes";

const EXPORT_PADDING = 20;
const EXPORT_PIXEL_RATIO = 2;
const MAX_EXPORT_DIMENSION = 2800;

const STICKY_COLORS = {
  yellow: { bg: "#fef9c3", border: "#fde047" },
  pink: { bg: "#fce7f3", border: "#f9a8d4" },
  blue: { bg: "#dbeafe", border: "#93c5fd" },
  green: { bg: "#dcfce7", border: "#86efac" },
  purple: { bg: "#ede9fe", border: "#c4b5fd" },
  peach: { bg: "#ffedd5", border: "#fdba74" },
};

const TEXT_FONTS = {
  system: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  arial: "Arial, Helvetica, sans-serif",
  georgia: 'Georgia, "Times New Roman", serif',
  times: '"Times New Roman", Times, serif',
  courier: '"Courier New", Courier, monospace',
  verdana: "Verdana, Geneva, sans-serif",
  trebuchet: '"Trebuchet MS", Helvetica, sans-serif',
  comic: '"Comic Sans MS", cursive, sans-serif',
};

const TEXT_COLORS = {
  slate: "#1e293b",
  black: "#0f172a",
  gray: "#64748b",
  silver: "#94a3b8",
  white: "#ffffff",
  red: "#dc2626",
  crimson: "#be123c",
  orange: "#ea580c",
  amber: "#d97706",
  yellow: "#ca8a04",
  lime: "#65a30d",
  green: "#16a34a",
  emerald: "#059669",
  teal: "#0d9488",
  cyan: "#0891b2",
  sky: "#0284c7",
  blue: "#2563eb",
  indigo: "#4f46e5",
  violet: "#7c3aed",
  purple: "#9333ea",
  fuchsia: "#c026d3",
  pink: "#db2777",
  rose: "#e11d48",
  coral: "#f97316",
  brown: "#92400e",
  maroon: "#881337",
  navy: "#1e3a8a",
  forest: "#166534",
};

function getItemAxisBounds(item) {
  const extraBottom = item.type === "note" ? 10 : 0;

  if (!item.rotation) {
    return {
      left: item.x,
      top: item.y,
      width: item.width,
      height: item.height + extraBottom,
    };
  }

  const centerX = item.x + item.width / 2;
  const centerY = item.y + item.height / 2;
  const radians = (item.rotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));
  const width = item.width * cos + item.height * sin;
  const height = item.width * sin + item.height * cos + extraBottom;

  return {
    left: centerX - width / 2,
    top: centerY - height / 2,
    width,
    height,
  };
}

function getVisibleBoardRect(viewportEl, viewport) {
  const scale = viewport.scale || 1;
  return {
    left: -viewport.x / scale,
    top: -viewport.y / scale,
    width: viewportEl.clientWidth / scale,
    height: viewportEl.clientHeight / scale,
  };
}

function rectsIntersect(a, b) {
  return (
    a.left < b.left + b.width &&
    a.left + a.width > b.left &&
    a.top < b.top + b.height &&
    a.top + a.height > b.top
  );
}

function getItemsBoundsRect(items) {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;

  for (const item of items) {
    const bounds = getItemAxisBounds(item);
    left = Math.min(left, bounds.left);
    top = Math.min(top, bounds.top);
    right = Math.max(right, bounds.left + bounds.width);
    bottom = Math.max(bottom, bounds.top + bounds.height);
  }

  return { left, top, width: right - left, height: bottom - top };
}

function intersectRects(a, b) {
  const left = Math.max(a.left, b.left);
  const top = Math.max(a.top, b.top);
  const right = Math.min(a.left + a.width, b.left + b.width);
  const bottom = Math.min(a.top + a.height, b.top + b.height);

  if (right <= left || bottom <= top) {
    return null;
  }

  return {
    left,
    top,
    width: right - left,
    height: bottom - top,
  };
}

export function getVisibleItemsExportBounds(items, viewportEl, viewport) {
  const visibleBoard = getVisibleBoardRect(viewportEl, viewport);
  const visibleItems = items.filter((item) =>
    rectsIntersect(getItemAxisBounds(item), visibleBoard)
  );

  if (!visibleItems.length) {
    return null;
  }

  const itemsRect = getItemsBoundsRect(visibleItems);
  const paddedItemsRect = {
    left: itemsRect.left - EXPORT_PADDING,
    top: itemsRect.top - EXPORT_PADDING,
    width: itemsRect.width + EXPORT_PADDING * 2,
    height: itemsRect.height + EXPORT_PADDING * 2,
  };

  return intersectRects(paddedItemsRect, visibleBoard);
}

function getVisibleItems(items, viewportEl, viewport) {
  const visibleBoard = getVisibleBoardRect(viewportEl, viewport);
  return items.filter((item) => rectsIntersect(getItemAxisBounds(item), visibleBoard));
}

export function mergeLiveItemContent(items, canvasElement) {
  if (!canvasElement) return items;

  return items.map((item) => {
    if (item.type !== "text" && item.type !== "note" && item.type !== "shape") return item;

    const element = canvasElement.querySelector(`[data-item-id="${item.id}"]`);
    if (!element) return item;

    const textarea = element.querySelector("textarea");
    if (textarea) {
      return { ...item, content: textarea.value ?? item.content ?? "" };
    }

    const textDiv = element.querySelector(".whitespace-pre-wrap");
    if (textDiv) {
      return { ...item, content: textDiv.textContent ?? item.content ?? "" };
    }

    return item;
  });
}

function getTextFontStack(fontId) {
  return TEXT_FONTS[fontId] ?? TEXT_FONTS.system;
}

function getTextColorValue(colorId) {
  return TEXT_COLORS[colorId] ?? TEXT_COLORS.slate;
}

function getStickyPalette(colorId) {
  return STICKY_COLORS[colorId] ?? STICKY_COLORS.yellow;
}

function wrapTextLines(ctx, text, maxWidth) {
  const lines = [];
  const paragraphs = String(text || "").split(/\r?\n/);

  for (const paragraph of paragraphs) {
    if (!paragraph) {
      lines.push("");
      continue;
    }

    const words = paragraph.split(/\s+/);
    let line = "";

    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }

    if (line) lines.push(line);
  }

  return lines.length ? lines : [""];
}

function drawDotGrid(ctx, width, height) {
  const spacing = 24;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#e2e8f0";

  for (let x = 0; x <= width; x += spacing) {
    for (let y = 0; y <= height; y += spacing) {
      ctx.beginPath();
      ctx.arc(x, y, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawTextBlock(ctx, text, x, y, maxWidth, lineHeight) {
  const lines = wrapTextLines(ctx, text, maxWidth);
  lines.forEach((line, index) => {
    ctx.fillText(line, x, y + index * lineHeight);
  });
  return lines.length * lineHeight;
}

function drawTextItem(ctx, item, exportBounds) {
  const x = item.x - exportBounds.left + 4;
  const y = item.y - exportBounds.top + 4;
  const maxWidth = Math.max(24, item.width - 8);
  const fontSize = Number(item.fontSize) || 20;
  const fontStack = getTextFontStack(item.fontFamily);
  const weight = item.bold ? "bold" : "normal";
  const style = item.italic ? "italic" : "normal";

  ctx.save();
  ctx.font = `${style} ${weight} ${fontSize}px ${fontStack}`;
  ctx.fillStyle = getTextColorValue(item.textColor);
  ctx.textBaseline = "top";

  const lineHeight = fontSize * 1.35;
  drawTextBlock(ctx, item.content || "", x, y, maxWidth, lineHeight);

  if (item.underline) {
    const lines = wrapTextLines(ctx, item.content || "", maxWidth);
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = Math.max(1, fontSize / 14);
    lines.forEach((line, index) => {
      const width = ctx.measureText(line).width;
      const lineY = y + index * lineHeight + fontSize;
      ctx.beginPath();
      ctx.moveTo(x, lineY);
      ctx.lineTo(x + width, lineY);
      ctx.stroke();
    });
  }

  ctx.restore();
}

function drawNoteItem(ctx, item, exportBounds) {
  const palette = getStickyPalette(item.color);
  const x = item.x - exportBounds.left;
  const y = item.y - exportBounds.top;
  const width = item.width;
  const height = item.height;
  const headerHeight = 24;
  const rotation = ((item.rotation || 0) * Math.PI) / 180;
  const centerX = x + width / 2;
  const centerY = y + height / 2;

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(rotation);
  ctx.translate(-width / 2, -height / 2);

  ctx.fillStyle = palette.bg;
  ctx.strokeStyle = "rgba(0,0,0,0.07)";
  ctx.lineWidth = 1;
  roundRect(ctx, 0, 0, width, height, 5);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = `${palette.border}55`;
  ctx.fillRect(0, 0, width, headerHeight);
  ctx.strokeStyle = "rgba(0,0,0,0.06)";
  ctx.beginPath();
  ctx.moveTo(0, headerHeight);
  ctx.lineTo(width, headerHeight);
  ctx.stroke();

  ctx.fillStyle = "rgba(30,41,59,0.75)";
  ctx.font = 'bold 10px system-ui, sans-serif';
  ctx.textBaseline = "middle";
  ctx.fillText("NOTE", 8, headerHeight / 2);

  const fontSize = 14;
  const fontStack = getTextFontStack(item.fontFamily || "comic");
  ctx.font = `${fontSize}px ${fontStack}`;
  ctx.fillStyle = "#1e293b";
  ctx.textBaseline = "top";
  drawTextBlock(ctx, item.content || "", 10, headerHeight + 8, width - 20, fontSize * 1.35);

  ctx.restore();
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load image: ${src?.slice(0, 32)}`));
    image.src = src;
  });
}

async function loadItemImages(items) {
  const cache = new Map();
  const imageItems = items.filter((item) => item.type === "image" && item.src);

  await Promise.all(
    imageItems.map(async (item) => {
      try {
        const image = await loadImage(item.src);
        cache.set(item.id, image);
      } catch {
        // Skip broken images.
      }
    })
  );

  return cache;
}

function drawImageItem(ctx, item, exportBounds, imageCache) {
  const image = imageCache.get(item.id);
  if (!image) return;

  const x = item.x - exportBounds.left;
  const y = item.y - exportBounds.top;
  const width = item.width;
  const height = item.height;
  const rotation = ((item.rotation || 0) * Math.PI) / 180;
  const centerX = x + width / 2;
  const centerY = y + height / 2;

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(rotation);
  ctx.drawImage(image, -width / 2, -height / 2, width, height);
  ctx.restore();
}

function drawCenteredShapeText(ctx, item, width, height) {
  const content = item.content ?? "";
  if (!content.length) return;

  const fontSize = Number(item.fontSize) || 18;
  const fontStack = getTextFontStack(item.fontFamily);
  const fontWeight = item.bold ? "700" : "400";
  const fontStyle = item.italic ? "italic" : "normal";
  ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontStack}`;
  ctx.fillStyle = getTextColorValue(item.textColor);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const padding = 10;
  const maxWidth = Math.max(1, width - padding * 2);
  const lineHeight = fontSize * 1.35;
  const lines = wrapTextLines(ctx, content, maxWidth);
  const totalHeight = lines.length * lineHeight;
  let startY = height / 2 - totalHeight / 2 + lineHeight / 2;

  for (const line of lines) {
    ctx.fillText(line, width / 2, startY);
    startY += lineHeight;
  }
}

function measureLinearTextMaskSize(ctx, item) {
  const content = (item.content ?? "").trim();
  if (!content.length) return null;

  const fontSize = Number(item.fontSize) || 18;
  const fontStack = getTextFontStack(item.fontFamily);
  const fontWeight = item.bold ? "700" : "400";
  const fontStyle = item.italic ? "italic" : "normal";
  ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontStack}`;

  const lines = content.split(/\r?\n/);
  let maxWidth = 0;
  for (const line of lines) {
    maxWidth = Math.max(maxWidth, ctx.measureText(line).width);
  }

  const lineHeight = fontSize * 1.35;
  return {
    width: Math.ceil(maxWidth),
    height: Math.ceil(lines.length * lineHeight),
  };
}

function drawShapeItem(ctx, item, exportBounds) {
  const shapeColor = getShapeColor(item.fillColor);
  const fill = shapeColor.fill;
  const stroke = shapeColor.stroke;
  const strokeWidth = Number(item.strokeWidth) || 2;
  const x = item.x - exportBounds.left;
  const y = item.y - exportBounds.top;
  const width = item.width;
  const height = item.height;
  const rotation = ((item.rotation || 0) * Math.PI) / 180;
  const centerX = x + width / 2;
  const centerY = y + height / 2;

  if (isLinearShape(item.shape)) {
    const content = (item.content ?? "").trim();

    if (isWireConnector(item) && item.wireRoutePoints?.length >= 2) {
      const bx = item.x - exportBounds.left;
      const by = item.y - exportBounds.top;
      const localRoute = toLocalWireRoute(item);
      ctx.save();
      ctx.translate(bx, by);
      drawWireRoute(ctx, localRoute, stroke, item.shape === "arrow");
      ctx.restore();

      if (content) {
        ctx.save();
        ctx.translate(bx, by);
        drawCenteredShapeText(ctx, item, item.width, item.height);
        ctx.restore();
      }
      return;
    }

    const points = resolveLinearPoints(item);
    const ax1 = points.x1 - exportBounds.left;
    const ay1 = points.y1 - exportBounds.top;
    const ax2 = points.x2 - exportBounds.left;
    const ay2 = points.y2 - exportBounds.top;
    const maskSize = content ? measureLinearTextMaskSize(ctx, item) : null;
    const maskHalfGap = maskSize
      ? getLinearTextMaskHalfGap(maskSize.width, maskSize.height, ax1, ay1, ax2, ay2)
      : 0;

    drawLinearShapeWithTextMask(
      ctx,
      ax1,
      ay1,
      ax2,
      ay2,
      stroke,
      item.shape === "arrow",
      maskHalfGap
    );

    if (content) {
      const bx = item.x - exportBounds.left;
      const by = item.y - exportBounds.top;
      ctx.save();
      ctx.translate(bx, by);
      drawCenteredShapeText(ctx, item, item.width, item.height);
      ctx.restore();
    }
    return;
  }

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(rotation);
  ctx.translate(-width / 2, -height / 2);

  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = strokeWidth;

  if (item.shape === "ellipse") {
    ctx.beginPath();
    ctx.ellipse(
      width / 2,
      height / 2,
      Math.max(1, width / 2 - strokeWidth),
      Math.max(1, height / 2 - strokeWidth),
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.stroke();
  } else if (item.shape === "triangle") {
    ctx.beginPath();
    ctx.moveTo(width / 2, strokeWidth);
    ctx.lineTo(width - strokeWidth, height - strokeWidth);
    ctx.lineTo(strokeWidth, height - strokeWidth);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (item.shape === "diamond") {
    drawPolygonPath(ctx, getDiamondPoints(width, height, strokeWidth));
    ctx.fill();
    ctx.stroke();
  } else if (item.shape === "star") {
    drawPolygonPath(ctx, getStarPoints(width, height, strokeWidth));
    ctx.fill();
    ctx.stroke();
  } else if (item.shape === "wireframe") {
    ctx.strokeStyle = shapeColor.strokeBase;
    roundRect(ctx, strokeWidth / 2, strokeWidth / 2, width - strokeWidth, height - strokeWidth, 2);
    ctx.stroke();
  } else {
    roundRect(ctx, strokeWidth / 2, strokeWidth / 2, width - strokeWidth, height - strokeWidth, 6);
    ctx.fill();
    ctx.stroke();
  }

  drawCenteredShapeText(ctx, item, width, height);
  ctx.restore();
}

async function loadWatermark() {
  try {
    return await loadImage(`${window.location.origin}/over-drive-logo.png`);
  } catch {
    try {
      return await loadImage("/over-drive-logo.png");
    } catch {
      return null;
    }
  }
}

function drawWatermark(ctx, exportBounds, watermark, boardCenterX, boardCenterY) {
  if (!watermark) return;

  const wmWidth = 360;
  const wmHeight = (watermark.height / watermark.width) * wmWidth;
  const wmBounds = {
    left: boardCenterX - wmWidth / 2,
    top: boardCenterY - wmHeight / 2,
    width: wmWidth,
    height: wmHeight,
  };

  if (!rectsIntersect(wmBounds, exportBounds)) return;

  const x = boardCenterX - exportBounds.left - wmWidth / 2;
  const y = boardCenterY - exportBounds.top - wmHeight / 2;

  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.drawImage(watermark, x, y, wmWidth, wmHeight);
  ctx.restore();
}

export async function renderVisibleDreamboardToCanvas({
  viewportEl,
  items,
  viewport,
  boardCenterX = 3000,
  boardCenterY = 3000,
}) {
  if (!viewportEl) {
    throw new Error("Missing dreamboard viewport.");
  }

  const exportBounds = getVisibleItemsExportBounds(items, viewportEl, viewport);
  if (!exportBounds) {
    const error = new Error("No visible items to export.");
    error.code = "NO_VISIBLE_ITEMS";
    throw error;
  }

  const visibleItems = getVisibleItems(items, viewportEl, viewport)
    .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
  const syncedItems = syncArrowConnections(items);
  const syncedVisibleItems = visibleItems.map(
    (item) => syncedItems.find((entry) => entry.id === item.id) ?? item
  );

  const maxDim = Math.max(exportBounds.width, exportBounds.height);
  const layoutScale = maxDim > MAX_EXPORT_DIMENSION ? MAX_EXPORT_DIMENSION / maxDim : 1;
  const pixelWidth = Math.max(1, Math.round(exportBounds.width * layoutScale * EXPORT_PIXEL_RATIO));
  const pixelHeight = Math.max(1, Math.round(exportBounds.height * layoutScale * EXPORT_PIXEL_RATIO));

  const canvas = document.createElement("canvas");
  canvas.width = pixelWidth;
  canvas.height = pixelHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not create export canvas.");
  }

  ctx.scale(layoutScale * EXPORT_PIXEL_RATIO, layoutScale * EXPORT_PIXEL_RATIO);
  drawDotGrid(ctx, exportBounds.width, exportBounds.height);

  const [imageCache, watermark] = await Promise.all([
    loadItemImages(visibleItems),
    loadWatermark(),
  ]);

  drawWatermark(ctx, exportBounds, watermark, boardCenterX, boardCenterY);

  for (const item of syncedVisibleItems) {
    if (item.type === "image") {
      drawImageItem(ctx, item, exportBounds, imageCache);
    } else if (item.type === "note") {
      drawNoteItem(ctx, item, exportBounds);
    } else if (item.type === "text") {
      drawTextItem(ctx, item, exportBounds);
    } else if (item.type === "shape") {
      drawShapeItem(ctx, item, exportBounds);
    }
  }

  return canvas;
}

function buildPdfFromCanvas(canvas) {
  const imgData = canvas.toDataURL("image/jpeg", 0.92);
  if (!imgData || imgData.length < 200) {
    throw new Error("Export image data was empty.");
  }

  const orientation = canvas.width >= canvas.height ? "landscape" : "portrait";
  const pdf = new jsPDF({ orientation, unit: "pt", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 36;
  const maxWidth = pageWidth - margin * 2;
  const maxHeight = pageHeight - margin * 2;
  const ratio = Math.min(maxWidth / canvas.width, maxHeight / canvas.height);
  const renderWidth = canvas.width * ratio;
  const renderHeight = canvas.height * ratio;

  pdf.addImage(
    imgData,
    "JPEG",
    (pageWidth - renderWidth) / 2,
    (pageHeight - renderHeight) / 2,
    renderWidth,
    renderHeight,
    undefined,
    "FAST"
  );

  return pdf;
}

function pdfToBlob(pdf) {
  const arrayBuffer = pdf.output("arraybuffer");
  if (!arrayBuffer || arrayBuffer.byteLength < 200) {
    throw new Error("Generated PDF was empty.");
  }
  return new Blob([arrayBuffer], { type: "application/pdf" });
}

const EXPORT_SEQ_STORAGE_KEY = "over-drive-os-dreamboard-export-seq";

function getNextExportSequence() {
  const today = new Date().toISOString().slice(0, 10);
  let sequence = 0;

  try {
    const raw = localStorage.getItem(EXPORT_SEQ_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.date === today && Number.isFinite(parsed.seq)) {
        sequence = parsed.seq;
      }
    }
  } catch {
    // Ignore storage read errors and start from 1.
  }

  const nextSequence = sequence + 1;

  try {
    localStorage.setItem(
      EXPORT_SEQ_STORAGE_KEY,
      JSON.stringify({ date: today, seq: nextSequence })
    );
  } catch {
    // Ignore storage write errors.
  }

  return nextSequence;
}

export function getDreamboardExportFilename() {
  const stamp = new Date().toISOString().slice(0, 10);
  const sequence = String(getNextExportSequence()).padStart(3, "0");
  return `dreamboard-${stamp}-${sequence}.pdf`;
}

export function dreamboardCanvasToPdfBlob(canvas) {
  return pdfToBlob(buildPdfFromCanvas(canvas));
}

export function downloadDreamboardPdf(blob, filename) {
  if (!(blob instanceof Blob) || blob.size < 200) {
    throw new Error("PDF file is empty.");
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    link.remove();
    URL.revokeObjectURL(url);
  }, 2000);
}

export function saveDreamboardCanvasAsPdf(canvas, filename) {
  const pdf = buildPdfFromCanvas(canvas);
  pdf.save(filename);
}

export async function requestDreamboardPdfSaveHandle(filename) {
  if (typeof window.showSaveFilePicker !== "function") {
    return null;
  }

  return window.showSaveFilePicker({
    suggestedName: filename,
    types: [
      {
        description: "PDF document",
        accept: { "application/pdf": [".pdf"] },
      },
    ],
  });
}

export async function writeDreamboardPdfToHandle(fileHandle, blob) {
  if (!(blob instanceof Blob) || blob.size < 200) {
    throw new Error("PDF file is empty.");
  }

  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
}

export async function captureVisibleDreamboardCanvas(options) {
  return renderVisibleDreamboardToCanvas(options);
}

export async function createDreamboardPdfBlob(options) {
  const canvas = await renderVisibleDreamboardToCanvas(options);
  return dreamboardCanvasToPdfBlob(canvas);
}

export async function exportDreamboardToPdf(options) {
  const blob = await createDreamboardPdfBlob(options);
  downloadDreamboardPdf(blob, getDreamboardExportFilename());
  return blob;
}
