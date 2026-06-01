import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { createPortal } from "react-dom";
import {
  Bold,
  Copy,
  ChevronDown,
  FileDown,
  Italic,
  MousePointer2,
  MoveRight,
  RotateCcw,
  RotateCw,
  ImagePlus,
  Share2,
  Shapes,
  Sparkles,
  Square,
  Box,
  Circle,
  Triangle,
  Minus,
  ArrowRight,
  Diamond,
  Star,
  StickyNote,
  Trash2,
  Type,
  Underline,
} from "lucide-react";
import { LOGO_URL } from "../../lib/assetUrl";
import {
  createDreamboardPdfBlob,
  downloadDreamboardPdf,
  getDreamboardExportFilename,
  mergeLiveItemContent,
  requestDreamboardPdfSaveHandle,
  writeDreamboardPdfToHandle,
} from "../../lib/dreamboardExport";
import { loadDreamboard, saveDreamboard } from "../../lib/dreamboardStorage";
import {
  DEFAULT_SHAPE_FILL,
  getShapeColor,
  SHAPE_COLOR_IDS,
} from "../../lib/dreamboardShapeColors";
import {
  getDiamondPoints,
  getLinearAxisBounds,
  getLinearMaskedSegments,
  getLinearTextMaskHalfGap,
  getStarPoints,
  getWireframeAnchorPoint,
  getWireframeAnchorPosition,
  getWireArrowHead,
  buildSmoothWirePathD,
  buildWireConnectorPreview,
  findNearestWireframeAnchor,
  isWireConnector,
  isWireframeShape,
  isLinearShape,
  LINE_STROKE_WIDTH,
  MIN_LINEAR_LENGTH,
  patchLinearItemFromPoints,
  pointsToSvgAttribute,
  resolveLinearPoints,
  shiftLinearItem,
  snapPointToGrid,
  snapWireframeBounds,
  syncArrowConnections,
  toLocalLinearPoints,
  toLocalWireRoute,
  WIREFRAME_ANCHORS,
} from "../../lib/dreamboardShapes";
import { useTasks } from "../../context/TasksContext";
import { useLoadingOptional } from "../../context/LoadingContext";

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function clearDocumentSelection() {
  const selection = window.getSelection?.();
  if (selection?.rangeCount) {
    selection.removeAllRanges();
  }
}

const ACTIVE_TOOL_CLASS = "bg-slate-800 text-white shadow-sm";
const SELECTION_RING_CLASS = "ring-2 ring-violet-400/75 ring-offset-1";
const MARQUEE_BOX_CLASS = "border border-violet-400/70 bg-violet-400/10";
const WIREFRAME_CORNER_HANDLES = new Set(["nw", "ne", "sw", "se"]);

const STICKY_COLORS = [
  { id: "yellow", label: "Yellow", bg: "#fef9c3", border: "#fde047", curl: "#f5e6a8", curlDark: "#d9cc7a", shadow: "rgba(253, 224, 71, 0.35)" },
  { id: "pink", label: "Pink", bg: "#fce7f3", border: "#f9a8d4", curl: "#f5cfe3", curlDark: "#e8a8c8", shadow: "rgba(249, 168, 212, 0.35)" },
  { id: "blue", label: "Blue", bg: "#dbeafe", border: "#93c5fd", curl: "#c7ddfc", curlDark: "#93c5fd", shadow: "rgba(147, 197, 253, 0.35)" },
  { id: "green", label: "Green", bg: "#dcfce7", border: "#86efac", curl: "#c8f0d8", curlDark: "#86efac", shadow: "rgba(134, 239, 172, 0.35)" },
  { id: "purple", label: "Purple", bg: "#ede9fe", border: "#c4b5fd", curl: "#ddd6fe", curlDark: "#c4b5fd", shadow: "rgba(196, 181, 253, 0.35)" },
  { id: "peach", label: "Peach", bg: "#ffedd5", border: "#fdba74", curl: "#fed7aa", curlDark: "#fdba74", shadow: "rgba(253, 186, 116, 0.35)" },
];

const NOTE_WIDTH = 168;
const NOTE_HEIGHT = 128;
const TEXT_BOX_MIN_HEIGHT = 28;
const TEXT_MIN_WIDTH = 32;
const TEXT_BOX_PADDING_X = 8;
const TEXT_BOX_PADDING_Y = 4;
const TEXT_FONT_SIZES = [14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72, 80];
const TEXT_FONTS = [
  {
    id: "system",
    label: "System",
    stack: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  { id: "arial", label: "Arial", stack: "Arial, Helvetica, sans-serif" },
  { id: "georgia", label: "Georgia", stack: 'Georgia, "Times New Roman", serif' },
  { id: "times", label: "Times", stack: '"Times New Roman", Times, serif' },
  { id: "courier", label: "Courier", stack: '"Courier New", Courier, monospace' },
  { id: "verdana", label: "Verdana", stack: "Verdana, Geneva, sans-serif" },
  { id: "trebuchet", label: "Trebuchet", stack: '"Trebuchet MS", Helvetica, sans-serif' },
  { id: "comic", label: "Comic Sans", stack: '"Comic Sans MS", cursive, sans-serif' },
];
const TEXT_COLORS = [
  { id: "slate", label: "Slate", value: "#1e293b" },
  { id: "black", label: "Black", value: "#0f172a" },
  { id: "gray", label: "Gray", value: "#64748b" },
  { id: "silver", label: "Silver", value: "#94a3b8" },
  { id: "white", label: "White", value: "#ffffff" },
  { id: "red", label: "Red", value: "#dc2626" },
  { id: "crimson", label: "Crimson", value: "#be123c" },
  { id: "orange", label: "Orange", value: "#ea580c" },
  { id: "amber", label: "Amber", value: "#d97706" },
  { id: "yellow", label: "Yellow", value: "#ca8a04" },
  { id: "lime", label: "Lime", value: "#65a30d" },
  { id: "green", label: "Green", value: "#16a34a" },
  { id: "emerald", label: "Emerald", value: "#059669" },
  { id: "teal", label: "Teal", value: "#0d9488" },
  { id: "cyan", label: "Cyan", value: "#0891b2" },
  { id: "sky", label: "Sky", value: "#0284c7" },
  { id: "blue", label: "Blue", value: "#2563eb" },
  { id: "indigo", label: "Indigo", value: "#4f46e5" },
  { id: "violet", label: "Violet", value: "#7c3aed" },
  { id: "purple", label: "Purple", value: "#9333ea" },
  { id: "fuchsia", label: "Fuchsia", value: "#c026d3" },
  { id: "pink", label: "Pink", value: "#db2777" },
  { id: "rose", label: "Rose", value: "#e11d48" },
  { id: "coral", label: "Coral", value: "#f97316" },
  { id: "brown", label: "Brown", value: "#92400e" },
  { id: "maroon", label: "Maroon", value: "#881337" },
  { id: "navy", label: "Navy", value: "#1e3a8a" },
  { id: "forest", label: "Forest", value: "#166534" },
];
const BOARD_CANVAS_SIZE = 6000;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;
const ZOOM_WHEEL_SENSITIVITY = 0.0012;
const DEFAULT_TEXT_STYLE = {
  fontFamily: "system",
  fontSize: 20,
  textColor: "slate",
  bold: false,
  italic: false,
  underline: false,
};
const DEFAULT_SHAPE_TEXT_STYLE = {
  fontFamily: "system",
  fontSize: 18,
  textColor: "slate",
  bold: false,
  italic: false,
};
const SHAPE_TEXT_PADDING = 10;
const DEFAULT_NOTE_FONT = "comic";
const IMAGE_MAX_DIMENSION = 480;
const DUPLICATE_OFFSET = 24;
const MAX_UNDO_HISTORY = 50;
const SHAPE_TYPES = [
  { id: "rectangle", label: "Rectangle", Icon: Square },
  { id: "wireframe", label: "Wire box", Icon: Box },
  { id: "ellipse", label: "Ellipse", Icon: Circle },
  { id: "triangle", label: "Triangle", Icon: Triangle },
  { id: "diamond", label: "Diamond", Icon: Diamond },
  { id: "star", label: "Star", Icon: Star },
  { id: "line", label: "Line", Icon: Minus },
  { id: "arrow", label: "Arrow", Icon: ArrowRight },
];
const SHAPE_WIDTH = 120;
const SHAPE_HEIGHT = 120;
const LINE_SHAPE_WIDTH = 168;
const LINE_SHAPE_HEIGHT = 28;
const SHAPE_MIN_WIDTH = 40;
const SHAPE_MIN_HEIGHT = 40;
const LINE_MIN_WIDTH = 48;
const LINE_MIN_HEIGHT = 12;
const DEFAULT_SHAPE_KIND = "rectangle";

function getTextFont(fontId) {
  return TEXT_FONTS.find((font) => font.id === fontId) ?? TEXT_FONTS[0];
}

function getTextColor(colorId) {
  return TEXT_COLORS.find((color) => color.id === colorId) ?? TEXT_COLORS[0];
}

function getTextStyleProps(item) {
  const font = getTextFont(item.fontFamily);
  const color = getTextColor(item.textColor);

  return {
    fontSize: Number(item.fontSize) || DEFAULT_TEXT_STYLE.fontSize,
    fontWeight: item.bold ? 700 : 400,
    fontStyle: item.italic ? "italic" : "normal",
    textDecoration: item.underline ? "underline" : "none",
    fontFamily: font.stack,
    color: color.value,
  };
}

function measureTextItem(item, fallbackText = " ") {
  const props = getTextStyleProps(item);
  const mirror = document.createElement("div");
  mirror.style.position = "absolute";
  mirror.style.visibility = "hidden";
  mirror.style.pointerEvents = "none";
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.wordBreak = "break-word";
  mirror.style.fontSize = `${props.fontSize}px`;
  mirror.style.fontWeight = String(props.fontWeight);
  mirror.style.fontStyle = props.fontStyle;
  mirror.style.textDecoration = props.textDecoration;
  mirror.style.fontFamily = props.fontFamily;
  mirror.style.color = props.color;
  mirror.style.lineHeight = "1.35";
  mirror.style.padding = "0";
  mirror.style.border = "0";
  mirror.style.maxWidth = "800px";
  mirror.textContent = item.content?.length ? item.content : fallbackText;

  document.body.appendChild(mirror);
  const rect = mirror.getBoundingClientRect();
  document.body.removeChild(mirror);

  return {
    width: Math.max(TEXT_MIN_WIDTH, Math.ceil(rect.width) + TEXT_BOX_PADDING_X),
    height: Math.max(TEXT_BOX_MIN_HEIGHT, Math.ceil(rect.height) + TEXT_BOX_PADDING_Y),
  };
}

function measureTextBounds(element, fallbackText = " ") {
  const style = window.getComputedStyle(element);
  const mirror = document.createElement("div");
  mirror.style.position = "absolute";
  mirror.style.visibility = "hidden";
  mirror.style.pointerEvents = "none";
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.wordBreak = "break-word";
  mirror.style.font = style.font;
  mirror.style.lineHeight = style.lineHeight;
  mirror.style.letterSpacing = style.letterSpacing;
  mirror.style.padding = "0";
  mirror.style.border = "0";
  mirror.style.maxWidth = "800px";

  const value = "value" in element ? element.value : element.textContent;
  mirror.textContent = value?.length ? value : fallbackText;

  document.body.appendChild(mirror);
  const rect = mirror.getBoundingClientRect();
  document.body.removeChild(mirror);

  return {
    width: Math.max(TEXT_MIN_WIDTH, Math.ceil(rect.width) + TEXT_BOX_PADDING_X),
    height: Math.max(TEXT_BOX_MIN_HEIGHT, Math.ceil(rect.height) + TEXT_BOX_PADDING_Y),
  };
}

function measureShapeTextLayout(item, content = item.content) {
  const props = getTextStyleProps(item);
  const text = content ?? "";
  const padding = SHAPE_TEXT_PADDING;
  const isLine = isLinearShape(item.shape);
  const minWidth = isLine ? LINE_MIN_WIDTH : SHAPE_MIN_WIDTH;
  const minHeight = isLine ? LINE_MIN_HEIGHT : SHAPE_MIN_HEIGHT;

  const mirror = document.createElement("textarea");
  mirror.style.position = "absolute";
  mirror.style.visibility = "hidden";
  mirror.style.pointerEvents = "none";
  mirror.style.resize = "none";
  mirror.style.overflow = "hidden";
  mirror.style.border = "0";
  mirror.style.padding = "0";
  mirror.style.fontSize = `${props.fontSize}px`;
  mirror.style.fontWeight = String(props.fontWeight);
  mirror.style.fontStyle = props.fontStyle;
  mirror.style.fontFamily = props.fontFamily;
  mirror.style.lineHeight = "1.35";
  mirror.style.textAlign = "center";
  document.body.appendChild(mirror);

  const measureLines = text.length ? text.split(/\r?\n/) : [" "];
  let maxLineWidth = 0;
  for (const line of measureLines) {
    mirror.value = line.length ? line : " ";
    mirror.style.width = "auto";
    mirror.style.height = "0px";
    maxLineWidth = Math.max(maxLineWidth, mirror.scrollWidth);
  }

  const innerWidth = Math.max(maxLineWidth, 16);

  mirror.style.width = `${innerWidth}px`;
  mirror.value = text.length ? text : " ";
  mirror.style.height = "0px";
  const wrappedHeight = mirror.scrollHeight;

  document.body.removeChild(mirror);

  return {
    width: Math.max(minWidth, innerWidth + padding * 2),
    height: Math.max(minHeight, wrappedHeight + padding * 2),
  };
}

function measureLinearTextMaskLayout(item, content = item.content) {
  const props = getTextStyleProps(item);
  const text = (content ?? "").trim();
  if (!text.length) return null;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.font = `${props.fontStyle} ${props.fontWeight} ${props.fontSize}px ${props.fontFamily}`;

  const lines = text.split(/\r?\n/);
  let maxWidth = 0;
  for (const line of lines) {
    maxWidth = Math.max(maxWidth, ctx.measureText(line).width);
  }

  const lineHeight = props.fontSize * 1.35;
  return {
    width: Math.ceil(maxWidth),
    height: Math.ceil(lines.length * lineHeight),
  };
}

function getShapeExpansionPatch(item, content) {
  if (isLinearShape(item.shape) || !content?.length) return null;

  const needed = measureShapeTextLayout(item, content);
  const width = Math.max(item.width, needed.width);
  const height = Math.max(item.height, needed.height);

  if (width === item.width && height === item.height) return null;

  return {
    width,
    height,
    x: item.x - (width - item.width) / 2,
    y: item.y - (height - item.height) / 2,
  };
}

function autoResizeTextarea(element) {
  if (!element) return;
  element.style.height = "0px";
  element.style.height = `${element.scrollHeight}px`;
}

function syncShapeTextareaView(element) {
  if (!element) return;
  autoResizeTextarea(element);
  const containerHeight = element.parentElement?.clientHeight ?? 0;
  if (containerHeight > 0 && element.scrollHeight > containerHeight) {
    element.style.maxHeight = `${containerHeight}px`;
    element.style.height = `${containerHeight}px`;
  } else {
    element.style.maxHeight = "none";
    autoResizeTextarea(element);
  }

  const selectionEnd = element.selectionEnd ?? element.value.length;
  const textBeforeCaret = element.value.slice(0, selectionEnd);
  const caretLine = textBeforeCaret.split(/\r?\n/).length;
  const lineHeight =
    Number.parseFloat(window.getComputedStyle(element).lineHeight) ||
    (Number.parseFloat(window.getComputedStyle(element).fontSize) || 16) * 1.35;
  const caretOffset = (caretLine - 1) * lineHeight;
  const visibleTop = element.scrollTop;
  const visibleBottom = visibleTop + element.clientHeight;

  if (caretOffset + lineHeight > visibleBottom) {
    element.scrollTop = caretOffset + lineHeight - element.clientHeight;
  } else if (caretOffset < visibleTop) {
    element.scrollTop = caretOffset;
  }
}

function isStickyNoteScrollable(element) {
  return isScrollableElement(element);
}

function isScrollableElement(element) {
  return element.scrollHeight > element.clientHeight + 1;
}

function resetStickyNoteScroll(element) {
  if (element) element.scrollTop = 0;
}

function syncStickyNoteScrollAfterInput(element) {
  if (!element || !isStickyNoteScrollable(element)) return;
  const atBottom = element.scrollTop + element.clientHeight >= element.scrollHeight - 2;
  if (atBottom) {
    element.scrollTop = 0;
  }
}

function getNoteTaskFields(note) {
  const content = note.content?.trim() ?? "";
  const title = content
    ? content.split(/\r?\n/)[0].trim().slice(0, 120) || "Dreamboard sticky note"
    : "Dreamboard sticky note";

  return {
    title,
    description: content || "Created from a Dreamboard sticky note.",
    project: "Dreamboard",
    projectColor: "#7c3aed",
    priority: "medium",
    status: "todo",
    dreamboardNoteId: note.id,
  };
}

function clampZoom(value) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

function getCenteredViewport(viewportEl, scale = 1) {
  const { width, height } = viewportEl.getBoundingClientRect();
  return {
    scale,
    x: width / 2 - (BOARD_CANVAS_SIZE / 2) * scale,
    y: height / 2 - (BOARD_CANVAS_SIZE / 2) * scale,
  };
}

function moveOneItemForward(items, id) {
  const sorted = [...items].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
  const index = sorted.findIndex((item) => item.id === id);
  if (index === -1 || index === sorted.length - 1) return items;

  const current = sorted[index];
  const above = sorted[index + 1];
  return items.map((item) => {
    if (item.id === current.id) return { ...item, zIndex: above.zIndex };
    if (item.id === above.id) return { ...item, zIndex: current.zIndex };
    return item;
  });
}

function moveOneItemBackward(items, id) {
  const sorted = [...items].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
  const index = sorted.findIndex((item) => item.id === id);
  if (index <= 0) return items;

  const current = sorted[index];
  const below = sorted[index - 1];
  return items.map((item) => {
    if (item.id === current.id) return { ...item, zIndex: below.zIndex };
    if (item.id === below.id) return { ...item, zIndex: current.zIndex };
    return item;
  });
}

function moveItemsOneStepForward(items, ids) {
  const order = [...ids].sort((a, b) => {
    const zA = items.find((item) => item.id === a)?.zIndex ?? 0;
    const zB = items.find((item) => item.id === b)?.zIndex ?? 0;
    return zB - zA;
  });

  return order.reduce((next, id) => moveOneItemForward(next, id), items);
}

function moveItemsOneStepBackward(items, ids) {
  const order = [...ids].sort((a, b) => {
    const zA = items.find((item) => item.id === a)?.zIndex ?? 0;
    const zB = items.find((item) => item.id === b)?.zIndex ?? 0;
    return zA - zB;
  });

  return order.reduce((next, id) => moveOneItemBackward(next, id), items);
}

function isBoardSurface(target, viewportEl, canvasEl) {
  if (!viewportEl || !canvasEl) return false;
  if (target === viewportEl || target === canvasEl) return true;
  if (target.closest?.("[data-dreamboard-chrome]")) return false;
  if (target.closest?.("[data-text-format-popup]")) return false;
  if (target.closest?.("[data-shape-format-popup]")) return false;
  if (target.closest?.("[data-item-context-menu]")) return false;
  return canvasEl.contains(target);
}

function isMultiSelectModifier(event) {
  return event.metaKey || event.ctrlKey;
}

function getItemAxisBounds(item) {
  const extraBottom = item.type === "note" ? 10 : 0;

  if (item.type === "shape" && isLinearShape(item.shape)) {
    const bounds = getLinearAxisBounds(item);
    return {
      left: bounds.left,
      top: bounds.top,
      width: bounds.width,
      height: bounds.height + extraBottom,
    };
  }

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

function rectsIntersect(a, b) {
  return (
    a.left < b.left + b.width &&
    a.left + a.width > b.left &&
    a.top < b.top + b.height &&
    a.top + a.height > b.top
  );
}

const SELECTION_HIT_PADDING = 8;

function isPointInItemBounds(x, y, item, padding = 0) {
  const bounds = getItemAxisBounds(item);
  return (
    x >= bounds.left - padding &&
    x <= bounds.left + bounds.width + padding &&
    y >= bounds.top - padding &&
    y <= bounds.top + bounds.height + padding
  );
}

function getSelectedItemAtPoint(x, y, itemsList, selectedIds, padding = SELECTION_HIT_PADDING) {
  return [...itemsList]
    .sort((a, b) => (b.zIndex ?? 0) - (a.zIndex ?? 0))
    .find((item) => selectedIds.includes(item.id) && isPointInItemBounds(x, y, item, padding));
}

function isPointInMultiSelection(x, y, itemsList, selectedIds, padding = SELECTION_HIT_PADDING) {
  if (selectedIds.length <= 1) return false;
  return Boolean(getSelectedItemAtPoint(x, y, itemsList, selectedIds, padding));
}

function getSelectionBoxRect(state) {
  return {
    left: Math.min(state.startX, state.currentX),
    top: Math.min(state.startY, state.currentY),
    width: Math.abs(state.currentX - state.startX),
    height: Math.abs(state.currentY - state.startY),
  };
}

function expandMarqueeSelection(hits, items) {
  const ids = new Set(hits);
  let changed = true;

  while (changed) {
    changed = false;

    for (const item of items) {
      if (item.shape !== "arrow") continue;

      const fromId = item.connectFrom?.itemId;
      const toId = item.connectTo?.itemId;

      if (ids.has(item.id)) {
        for (const linkedId of [fromId, toId]) {
          if (linkedId && !ids.has(linkedId)) {
            ids.add(linkedId);
            changed = true;
          }
        }
        continue;
      }

      if ((fromId && ids.has(fromId)) || (toId && ids.has(toId))) {
        ids.add(item.id);
        changed = true;
      }
    }
  }

  return [...ids];
}

function isCmdMarqueeExcludedTarget(target) {
  if (!(target instanceof Element)) return true;

  return Boolean(
    target.closest("[data-dreamboard-chrome]") ||
      target.closest("[data-text-format-popup]") ||
      target.closest("[data-shape-format-popup]") ||
      target.closest("[data-item-context-menu]") ||
      target.closest("[data-shape-resize-handle]") ||
      target.closest("[data-wireframe-anchor]") ||
      target.closest("[data-linear-endpoint]") ||
      target.closest("[data-editable]")
  );
}

function createId() {
  return `db-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function shouldUseNativeTextShortcut(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return false;
  if (!target.closest("[data-editable]")) return false;
  return (
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLInputElement ||
    target.isContentEditable
  );
}

function isWhiteboardShortcutContext(event, viewportEl) {
  if (!viewportEl) return false;

  const target = event.target;
  if (target instanceof Node && viewportEl.contains(target)) return true;

  const active = document.activeElement;
  if (active instanceof HTMLElement && viewportEl.contains(active)) return true;

  if (target instanceof HTMLElement && target.closest("[data-item-context-menu]")) {
    return true;
  }

  return false;
}

function cloneBoardItems(sourceItems, offset, nextZRef) {
  const clones = [];

  for (const item of sourceItems) {
    const id = createId();
    nextZRef.current += 1;

    if (item.type === "shape" && isLinearShape(item.shape)) {
      const points = resolveLinearPoints(item);
      clones.push({
        ...item,
        id,
        connectFrom: null,
        connectTo: null,
        wireRoutePoints: undefined,
        ...patchLinearItemFromPoints(
          points.x1 + offset,
          points.y1 + offset,
          points.x2 + offset,
          points.y2 + offset
        ),
        zIndex: nextZRef.current,
      });
      continue;
    }

    clones.push({
      ...item,
      id,
      x: item.x + offset,
      y: item.y + offset,
      zIndex: nextZRef.current,
    });
  }

  return clones;
}

function loadImageDimensions(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}

function fitImageDimensions(width, height, max = IMAGE_MAX_DIMENSION) {
  if (width <= max && height <= max) return { width, height };
  const scale = max / Math.max(width, height);
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

function getViewportBoardCenter(viewport, viewportEl) {
  const rect = viewportEl?.getBoundingClientRect();
  if (!rect) return { x: BOARD_CANVAS_SIZE / 2, y: BOARD_CANVAS_SIZE / 2 };
  return {
    x: (rect.width / 2 - viewport.x) / viewport.scale,
    y: (rect.height / 2 - viewport.y) / viewport.scale,
  };
}

function getStickyColor(colorId) {
  return STICKY_COLORS.find((c) => c.id === colorId) ?? STICKY_COLORS[0];
}

function getAngleFromCenter(centerX, centerY, pointX, pointY) {
  return Math.atan2(pointY - centerY, pointX - centerX) * (180 / Math.PI);
}

const NOTE_CORNER_HANDLES = [
  {
    id: "tl",
    position: "left-0 top-0 -translate-x-1/2 -translate-y-1/2",
    label: "top-left",
    Icon: RotateCcw,
    iconRotate: "-135deg",
  },
  {
    id: "tr",
    position: "right-0 top-0 translate-x-1/2 -translate-y-1/2",
    label: "top-right",
    Icon: RotateCw,
    iconRotate: "-45deg",
  },
  {
    id: "bl",
    position: "left-0 bottom-0 -translate-x-1/2 translate-y-1/2",
    label: "bottom-left",
    Icon: RotateCw,
    iconRotate: "135deg",
  },
  {
    id: "br",
    position: "right-0 bottom-0 translate-x-1/2 translate-y-1/2",
    label: "bottom-right",
    Icon: RotateCcw,
    iconRotate: "45deg",
  },
];

const SHAPE_RESIZE_HANDLES = [
  { id: "nw", cursor: "nwse-resize", position: "left-0 top-0 -translate-x-1/2 -translate-y-1/2" },
  { id: "n", cursor: "ns-resize", position: "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2" },
  { id: "ne", cursor: "nesw-resize", position: "right-0 top-0 translate-x-1/2 -translate-y-1/2" },
  { id: "e", cursor: "ew-resize", position: "right-0 top-1/2 translate-x-1/2 -translate-y-1/2" },
  { id: "se", cursor: "nwse-resize", position: "right-0 bottom-0 translate-x-1/2 translate-y-1/2" },
  { id: "s", cursor: "ns-resize", position: "left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2" },
  { id: "sw", cursor: "nesw-resize", position: "left-0 bottom-0 -translate-x-1/2 translate-y-1/2" },
  { id: "w", cursor: "ew-resize", position: "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2" },
];

function getShapeMinSize(shape) {
  if (isLinearShape(shape)) {
    return { width: LINE_MIN_WIDTH, height: LINE_MIN_HEIGHT };
  }
  return { width: SHAPE_MIN_WIDTH, height: SHAPE_MIN_HEIGHT };
}

function applyShapeResize(state, point, item) {
  const { width: minWidth, height: minHeight } = getShapeMinSize(item.shape);
  let x = state.startX;
  let y = state.startY;
  let width = state.startWidth;
  let height = state.startHeight;
  const right = state.startX + state.startWidth;
  const bottom = state.startY + state.startHeight;

  switch (state.handle) {
    case "se":
      width = Math.max(minWidth, point.x - state.startX);
      height = Math.max(minHeight, point.y - state.startY);
      break;
    case "sw":
      x = Math.min(point.x, right - minWidth);
      width = Math.max(minWidth, right - x);
      height = Math.max(minHeight, point.y - state.startY);
      break;
    case "ne":
      y = Math.min(point.y, bottom - minHeight);
      width = Math.max(minWidth, point.x - state.startX);
      height = Math.max(minHeight, bottom - y);
      break;
    case "nw":
      x = Math.min(point.x, right - minWidth);
      y = Math.min(point.y, bottom - minHeight);
      width = Math.max(minWidth, right - x);
      height = Math.max(minHeight, bottom - y);
      break;
    case "e":
      width = Math.max(minWidth, point.x - state.startX);
      break;
    case "w":
      x = Math.min(point.x, right - minWidth);
      width = Math.max(minWidth, right - x);
      break;
    case "s":
      height = Math.max(minHeight, point.y - state.startY);
      break;
    case "n":
      y = Math.min(point.y, bottom - minHeight);
      height = Math.max(minHeight, bottom - y);
      break;
    default:
      break;
  }

  if (isLinearShape(item.shape) && ["e", "w", "se", "sw", "ne", "nw"].includes(state.handle)) {
    height = Math.max(LINE_MIN_HEIGHT, height);
  }

  return {
    x: Math.max(0, x),
    y: Math.max(0, y),
    width,
    height,
  };
}

function ShapeResizeHandles({ onResizeStart, handleIds = null }) {
  const handles = handleIds
    ? SHAPE_RESIZE_HANDLES.filter((handle) => handleIds.includes(handle.id))
    : SHAPE_RESIZE_HANDLES;

  return handles.map((handle) => (
    <div
      key={handle.id}
      data-export-hide
      data-shape-resize-handle
      role="presentation"
      className={cn(
        "absolute z-10 h-2.5 w-2.5 rounded-sm border border-white bg-slate-500 shadow-sm",
        handle.position
      )}
      style={{ cursor: handle.cursor }}
      onPointerDown={(event) => {
        event.stopPropagation();
        onResizeStart(event, handle.id);
      }}
    />
  ));
}

function LinearEndpointHandles({ item, scale, onEndpointStart }) {
  const local = toLocalLinearPoints(item);
  const endpoints = [
    { id: "start", x: local.x1, y: local.y1, label: "Move line start" },
    { id: "end", x: local.x2, y: local.y2, label: "Move line end" },
  ].filter((endpoint) => {
    if (endpoint.id === "start" && item.connectFrom) return false;
    if (endpoint.id === "end" && item.connectTo) return false;
    return true;
  });

  return (
    <>
      {endpoints.map((endpoint) => (
        <div
          key={endpoint.id}
          data-export-hide
          data-linear-endpoint={endpoint.id}
          role="presentation"
          aria-label={endpoint.label}
          className="absolute z-10 h-3 w-3 rounded-full border-2 border-white bg-violet-500 shadow-sm"
          style={{
            left: endpoint.x,
            top: endpoint.y,
            transform: `translate(-50%, -50%) scale(${1 / scale})`,
            cursor: "crosshair",
          }}
          onPointerDown={(event) => {
            event.stopPropagation();
            onEndpointStart(event, endpoint.id);
          }}
        />
      ))}
    </>
  );
}

function WireframeConnectionHandles({ item, scale, onConnectionStart }) {
  const edgeHitSize = {
    top: "h-7 w-[55%]",
    bottom: "h-7 w-[55%]",
    left: "h-[55%] w-7",
    right: "h-[55%] w-7",
  };

  return (
    <>
      {WIREFRAME_ANCHORS.map((anchor) => {
        const position = getWireframeAnchorPosition(item, anchor);
        return (
          <div
            key={anchor}
            className="absolute z-[11]"
            style={{
              left: position.left,
              top: position.top,
              transform: `translate(-50%, -50%) scale(${1 / scale})`,
            }}
          >
            <button
              type="button"
              data-export-hide
              data-wireframe-anchor={anchor}
              aria-label={`Connect from ${anchor}`}
              title={`Drag to connect (${anchor})`}
              className={cn(
                "relative flex items-center justify-center rounded-full border-0 bg-transparent p-0",
                edgeHitSize[anchor]
              )}
              style={{ cursor: "crosshair" }}
              onPointerDown={(event) => {
                event.stopPropagation();
                onConnectionStart(event, anchor);
              }}
            >
              <span className="pointer-events-none h-4 w-4 rounded-full border-2 border-white bg-sky-500 shadow-md ring-2 ring-sky-400/30" />
            </button>
          </div>
        );
      })}
    </>
  );
}

function NoteCornerHandles({ isEditing, onRotateStart }) {
  if (isEditing) return null;

  return NOTE_CORNER_HANDLES.map((corner) => {
    const Icon = corner.Icon;

    return (
      <button
        key={corner.id}
        type="button"
        data-export-hide
        aria-label={`Rotate from ${corner.label} corner`}
        className={cn(
          "absolute z-10 flex h-8 w-8 cursor-grab items-center justify-center border-none bg-transparent p-0 text-violet-600 opacity-0 transition-opacity hover:opacity-100 active:cursor-grabbing",
          corner.position
        )}
        onPointerDown={onRotateStart}
      >
        <Icon
          className="h-4 w-4 drop-shadow-sm"
          strokeWidth={2.25}
          style={{ transform: `rotate(${corner.iconRotate})` }}
        />
      </button>
    );
  });
}

function getNoteCurlProfile(noteId) {
  let hash = 0;
  for (let i = 0; i < noteId.length; i += 1) {
    hash = (hash << 5) - hash + noteId.charCodeAt(i);
    hash |= 0;
  }

  const rightHeavy = Math.abs(hash) % 2 === 1;
  const variance = Math.abs(hash >> 4) % 3;

  const strong = {
    height: 20 + variance,
    width: 34 + variance * 2,
    bottom: -4,
    shadow: "2px 4px 3px rgba(0,0,0,0.17)",
    fade: 78,
  };
  const soft = {
    height: 10 + (variance % 2),
    width: 16 + variance,
    bottom: -1,
    shadow: "1px 2px 1px rgba(0,0,0,0.09)",
    fade: 68,
  };

  const left = rightHeavy
    ? {
        ...soft,
        rotate: -3,
        skew: -4,
        gradX: "14%",
        radius: "70% 100%",
      }
    : {
        ...strong,
        rotate: -10,
        skew: -13,
        gradX: "5%",
        radius: "92% 100%",
      };

  const right = rightHeavy
    ? {
        ...strong,
        rotate: 10,
        skew: 13,
        gradX: "95%",
        radius: "92% 100%",
      }
    : {
        ...soft,
        rotate: 3,
        skew: 4,
        gradX: "86%",
        radius: "65% 100%",
      };

  return {
    left,
    right,
    clipPath: rightHeavy
      ? "polygon(0 0, 100% 0, 100% calc(100% - 11px), calc(100% - 15px) 100%, 4px 100%, 0 calc(100% - 2px))"
      : "polygon(0 0, 100% 0, 100% calc(100% - 2px), calc(100% - 4px) 100%, 15px 100%, 0 calc(100% - 11px))",
    shadowLeft: rightHeavy ? "18%" : "28%",
    shadowRight: rightHeavy ? "14%" : "24%",
  };
}

function DreamboardShareMenu({ onExportPdf, exportBusy = false }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (!menuRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const handleExportPdf = () => {
    setOpen(false);
    onExportPdf();
  };

  return (
    <div ref={menuRef} className="relative pointer-events-auto">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        disabled={exportBusy}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-[11px] font-semibold text-slate-700 shadow-sm backdrop-blur-sm transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-800 disabled:cursor-not-allowed disabled:opacity-70"
      >
        <Share2 className="h-3.5 w-3.5" />
        Share
        <ChevronDown
          className={cn("h-3 w-3 text-slate-400 transition-transform", open && "rotate-180")}
        />
      </button>

      {open ? (
        <div
          role="menu"
          data-dreamboard-share-menu
          className="absolute right-0 top-full z-30 mt-1 min-w-[196px] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-xl ring-1 ring-slate-100"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Export
          </p>
          <button
            type="button"
            role="menuitem"
            disabled={exportBusy}
            onClick={handleExportPdf}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs font-medium text-slate-700 transition hover:bg-violet-50 hover:text-violet-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FileDown className="h-3.5 w-3.5 shrink-0 text-slate-500" />
            Export as PDF
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ItemContextMenu({ menu, onDuplicate, onMoveForward, onMoveBackward, onClose }) {
  if (!menu) return null;

  return createPortal(
    <div
      data-item-context-menu
      role="menu"
      className="fixed z-[10001] min-w-[168px] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-xl ring-1 ring-slate-100"
      style={{ left: menu.x, top: menu.y }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onDuplicate();
          onClose();
        }}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-slate-700 transition hover:bg-violet-50 hover:text-violet-800"
      >
        <Copy className="h-3.5 w-3.5 shrink-0 text-slate-500" />
        <span>Duplicate</span>
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onMoveForward(menu.itemId);
          onClose();
        }}
        className="flex w-full items-center justify-between gap-4 px-3 py-2 text-left text-xs font-medium text-slate-700 transition hover:bg-violet-50 hover:text-violet-800"
      >
        <span>Bring forward</span>
        <span className="text-[10px] font-normal text-slate-400">⌘]</span>
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onMoveBackward(menu.itemId);
          onClose();
        }}
        className="flex w-full items-center justify-between gap-4 px-3 py-2 text-left text-xs font-medium text-slate-700 transition hover:bg-violet-50 hover:text-violet-800"
      >
        <span>Send backward</span>
        <span className="text-[10px] font-normal text-slate-400">⌘[</span>
      </button>
    </div>,
    document.body
  );
}

function NoteMoveToTasksButton({ onClick }) {
  const [tooltip, setTooltip] = useState(null);

  const showTooltip = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setTooltip({
      x: rect.left + rect.width / 2,
      y: rect.top,
    });
  };

  return (
    <>
      <button
        type="button"
        aria-label="Move to tasks"
        onPointerDown={(event) => event.stopPropagation()}
        onMouseEnter={showTooltip}
        onMouseLeave={() => setTooltip(null)}
        onFocus={showTooltip}
        onBlur={() => setTooltip(null)}
        onClick={(event) => {
          event.stopPropagation();
          onClick();
        }}
        className="inline-flex h-4 w-4 items-center justify-center rounded text-slate-500 transition hover:bg-black/[0.06] hover:text-violet-700"
      >
        <MoveRight className="h-3 w-3" strokeWidth={2.25} />
      </button>
      {tooltip
        ? createPortal(
            <div
              role="tooltip"
              className="pointer-events-none fixed z-[10000] -translate-x-1/2 -translate-y-[calc(100%+8px)] whitespace-nowrap rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-700 shadow-lg ring-1 ring-slate-100"
              style={{ left: tooltip.x, top: tooltip.y }}
            >
              Move to tasks
            </div>,
            document.body
          )
        : null}
    </>
  );
}

function StickyNoteBody({
  noteId,
  palette,
  isDragging,
  onDoubleClick,
  header,
  children,
}) {
  const curls = getNoteCurlProfile(noteId);

  return (
    <div
      className={cn("relative h-full w-full", isDragging ? "cursor-grabbing" : "cursor-grab")}
      onDoubleClick={onDoubleClick}
    >
      <div
        className="relative flex h-full w-full flex-col overflow-hidden rounded-t-[5px] border border-black/[0.07]"
        style={{
          background: `linear-gradient(168deg, ${palette.bg} 0%, ${palette.bg} 62%, ${palette.curl} 100%)`,
          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.55), 0 2px 6px ${palette.shadow}, 0 10px 22px rgba(15,23,42,0.1)`,
          clipPath: curls.clipPath,
        }}
      >
        {header}
        {children}
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute left-0 z-[1]"
        style={{
          bottom: curls.left.bottom,
          height: curls.left.height,
          width: curls.left.width,
          background: `radial-gradient(ellipse 120% 105% at ${curls.left.gradX} 100%, ${palette.curl} 0%, ${palette.curlDark} 48%, transparent ${curls.left.fade}%)`,
          borderBottomLeftRadius: curls.left.radius,
          transform: `rotate(${curls.left.rotate}deg) skewX(${curls.left.skew}deg)`,
          filter: `drop-shadow(${curls.left.shadow})`,
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 z-[1]"
        style={{
          bottom: curls.right.bottom,
          height: curls.right.height,
          width: curls.right.width,
          background: `radial-gradient(ellipse 120% 105% at ${curls.right.gradX} 100%, ${palette.curl} 0%, ${palette.curlDark} 48%, transparent ${curls.right.fade}%)`,
          borderBottomRightRadius: curls.right.radius,
          transform: `rotate(${curls.right.rotate}deg) skewX(${curls.right.skew}deg)`,
          filter: `drop-shadow(${curls.right.shadow})`,
        }}
      />

      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 z-0 h-[5px]"
        style={{
          left: curls.shadowLeft,
          right: curls.shadowRight,
          background: "linear-gradient(to bottom, rgba(15,23,42,0.11), transparent)",
          borderRadius: "0 0 50% 50% / 0 0 100% 100%",
          transform: "translateY(4px)",
        }}
      />
    </div>
  );
}

function DreamboardShapeSvg({ item, maskContent }) {
  const shapeColor = getShapeColor(item.fillColor);
  const fill = shapeColor.fill;
  const stroke = shapeColor.stroke;
  const strokeWidth = Number(item.strokeWidth) || 2;
  const { width, height, shape } = item;

  if (shape === "line" || shape === "arrow") {
    if (isWireConnector(item) && item.wireRoutePoints?.length >= 2) {
      const route = toLocalWireRoute(item);
      const arrowHead = getWireArrowHead(route);
      const strokeRoute =
        arrowHead && route.length >= 2
          ? [...route.slice(0, -1), { x: arrowHead.baseX, y: arrowHead.baseY }]
          : route;
      const pathD = buildSmoothWirePathD(strokeRoute);

      return (
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            d={pathD}
            fill="none"
            stroke={stroke}
            strokeWidth={LINE_STROKE_WIDTH}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {arrowHead ? (
            <polygon points={arrowHead.points} fill={stroke} />
          ) : null}
        </svg>
      );
    }

    const { x1, y1, x2, y2 } = toLocalLinearPoints(item);
    const length = Math.hypot(x2 - x1, y2 - y1);
    const content = (maskContent ?? item.content ?? "").trim();
    let segments;

    if (content) {
      const maskSize = measureLinearTextMaskLayout(item, content);
      const halfGap = getLinearTextMaskHalfGap(maskSize.width, maskSize.height, x1, y1, x2, y2);
      segments = getLinearMaskedSegments(x1, y1, x2, y2, halfGap, shape === "arrow");
    } else {
      segments = getLinearMaskedSegments(x1, y1, x2, y2, 0, shape === "arrow");
    }

    return (
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {segments.map((segment, index) => {
          const segLength = Math.hypot(segment.x2 - segment.x1, segment.y2 - segment.y1);
          const head =
            segment.arrow ? Math.max(6, Math.min(14, segLength * 0.18)) : 0;
          const lineEndX =
            head > 0
              ? segment.x2 - (head * (segment.x2 - segment.x1)) / Math.max(segLength, 1)
              : segment.x2;
          const lineEndY =
            head > 0
              ? segment.y2 - (head * (segment.y2 - segment.y1)) / Math.max(segLength, 1)
              : segment.y2;
          const angle = Math.atan2(segment.y2 - segment.y1, segment.x2 - segment.x1);
          const headAngle = Math.PI / 7;

          return (
            <g key={`${item.id}-segment-${index}`}>
              <line
                x1={segment.x1}
                y1={segment.y1}
                x2={lineEndX}
                y2={lineEndY}
                stroke={stroke}
                strokeWidth={LINE_STROKE_WIDTH}
                strokeLinecap="round"
              />
              {segment.arrow ? (
                <polygon
                  points={`${segment.x2},${segment.y2} ${segment.x2 - head * Math.cos(angle - headAngle)},${segment.y2 - head * Math.sin(angle - headAngle)} ${segment.x2 - head * Math.cos(angle + headAngle)},${segment.y2 - head * Math.sin(angle + headAngle)}`}
                  fill={stroke}
                />
              ) : null}
            </g>
          );
        })}
      </svg>
    );
  }

  if (shape === "ellipse") {
    return (
      <svg className="pointer-events-none h-full w-full" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
        <ellipse
          cx={width / 2}
          cy={height / 2}
          rx={Math.max(1, width / 2 - strokeWidth)}
          ry={Math.max(1, height / 2 - strokeWidth)}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      </svg>
    );
  }

  if (shape === "triangle") {
    return (
      <svg className="pointer-events-none h-full w-full" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
        <polygon
          points={`${width / 2},${strokeWidth} ${width - strokeWidth},${height - strokeWidth} ${strokeWidth},${height - strokeWidth}`}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (shape === "diamond") {
    return (
      <svg className="pointer-events-none h-full w-full" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
        <polygon
          points={pointsToSvgAttribute(getDiamondPoints(width, height, strokeWidth))}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (shape === "star") {
    return (
      <svg className="pointer-events-none h-full w-full" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
        <polygon
          points={pointsToSvgAttribute(getStarPoints(width, height, strokeWidth))}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (shape === "wireframe") {
    return (
      <svg className="pointer-events-none h-full w-full" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
        <rect
          x={strokeWidth / 2}
          y={strokeWidth / 2}
          width={Math.max(1, width - strokeWidth)}
          height={Math.max(1, height - strokeWidth)}
          rx={2}
          fill="none"
          stroke={shapeColor.strokeBase}
          strokeWidth={strokeWidth}
        />
      </svg>
    );
  }

  return (
    <svg className="pointer-events-none h-full w-full" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <rect
        x={strokeWidth / 2}
        y={strokeWidth / 2}
        width={Math.max(1, width - strokeWidth)}
        height={Math.max(1, height - strokeWidth)}
        rx={6}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
    </svg>
  );
}

function ShapeToolPopup({ selectedShape, onShapeChange }) {
  return (
    <div
      className="pointer-events-auto rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur-sm"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        Shape
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        {SHAPE_TYPES.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            title={label}
            onClick={() => onShapeChange(id)}
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-lg border-2 transition",
              selectedShape === id
                ? "border-violet-500 bg-violet-50 text-violet-700"
                : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
            )}
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
      </div>
      <p className="mt-2 text-center text-[10px] text-slate-400">
        {isLinearShape(selectedShape)
          ? "Drag on the board to draw in any direction"
          : selectedShape === "wireframe"
            ? "Click to place boxes · select to resize, rotate, or drag edge dots to wire"
            : "Click the board to place a shape"}
      </p>
    </div>
  );
}

function ShapeFormatPopup({ item, scale, onFormatChange }) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const activeShapeColor = getShapeColor(item.fillColor);

  return (
    <div
      data-shape-format-popup
      className="absolute left-1/2 z-10 flex flex-col items-center gap-1.5"
      style={{
        bottom: "calc(100% + 8px)",
        transform: `translateX(-50%) scale(${1 / scale})`,
        transformOrigin: "bottom center",
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      {showColorPicker ? (
        <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
          <p className="mb-1.5 px-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Shape color
          </p>
          <div className="grid grid-cols-6 gap-1.5">
            {SHAPE_COLOR_IDS.map((colorId) => {
              const color = getShapeColor(colorId);
              return (
                <button
                  key={colorId}
                  type="button"
                  title={color.label}
                  onClick={() => {
                    onFormatChange({ fillColor: colorId, strokeColor: colorId });
                    setShowColorPicker(false);
                  }}
                  className={cn(
                    "h-6 w-6 rounded-md border-2 transition",
                    item.fillColor === colorId
                      ? "scale-110 border-slate-700 ring-2 ring-violet-400 ring-offset-1"
                      : "border-slate-200 hover:scale-105"
                  )}
                  style={{ backgroundColor: color.swatch, opacity: 0.85 }}
                />
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 py-1.5 shadow-lg">
        <select
          value={item.fontFamily ?? DEFAULT_SHAPE_TEXT_STYLE.fontFamily}
          onChange={(event) => onFormatChange({ fontFamily: event.target.value })}
          className="max-w-[7rem] rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
          aria-label="Font family"
          style={{ fontFamily: getTextFont(item.fontFamily).stack }}
        >
          {TEXT_FONTS.map((font) => (
            <option key={font.id} value={font.id} style={{ fontFamily: font.stack }}>
              {font.label}
            </option>
          ))}
        </select>
        <select
          value={item.fontSize ?? DEFAULT_SHAPE_TEXT_STYLE.fontSize}
          onChange={(event) => onFormatChange({ fontSize: Number(event.target.value) })}
          className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
          aria-label="Font size"
        >
          {TEXT_FONT_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}px
            </option>
          ))}
        </select>
        <div className="inline-flex rounded-lg border border-slate-200 p-0.5">
          <button
            type="button"
            title="Bold"
            onClick={() => onFormatChange({ bold: !item.bold })}
            className={cn(
              "inline-flex h-7 w-7 items-center justify-center rounded-md transition",
              item.bold ? "bg-violet-600 text-white" : "text-slate-600 hover:bg-slate-50"
            )}
          >
            <Bold className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title="Italic"
            onClick={() => onFormatChange({ italic: !item.italic })}
            className={cn(
              "inline-flex h-7 w-7 items-center justify-center rounded-md transition",
              item.italic ? "bg-violet-600 text-white" : "text-slate-600 hover:bg-slate-50"
            )}
          >
            <Italic className="h-3.5 w-3.5" />
          </button>
        </div>
        <button
          type="button"
          title="Shape color"
          aria-label="Shape color"
          aria-expanded={showColorPicker}
          onClick={() => setShowColorPicker((open) => !open)}
          className={cn(
            "inline-flex h-7 w-7 items-center justify-center rounded-lg border-2 transition",
            showColorPicker
              ? "border-violet-400 ring-2 ring-violet-400/30"
              : "border-slate-200 hover:border-slate-300"
          )}
          style={{ backgroundColor: activeShapeColor.swatch, opacity: 0.85 }}
        />
      </div>
    </div>
  );
}

function StickyColorPopup({ selectedColor, onColorChange }) {
  return (
    <div
      className="pointer-events-auto rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur-sm"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        Sticky note color
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        {STICKY_COLORS.map((color) => (
          <button
            key={color.id}
            type="button"
            title={color.label}
            onClick={() => onColorChange(color.id)}
            className={cn(
              "h-7 w-7 rounded-md border-2 transition",
              selectedColor === color.id
                ? "scale-110 border-slate-700 ring-2 ring-violet-400 ring-offset-1"
                : "border-slate-200 hover:scale-105"
            )}
            style={{ backgroundColor: color.bg }}
          />
        ))}
      </div>
      <p className="mt-2 text-center text-[10px] text-slate-400">Click the board to place a note</p>
    </div>
  );
}

function TextFormatPopup({ item, scale, onFormatChange }) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const activeColor = getTextColor(item.textColor);

  return (
    <div
      data-text-format-popup
      className="absolute left-1/2 z-10 flex flex-col items-center gap-1.5"
      style={{
        bottom: "calc(100% + 8px)",
        transform: `translateX(-50%) scale(${1 / scale})`,
        transformOrigin: "bottom center",
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      {showColorPicker ? (
        <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
          <p className="mb-1.5 px-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Text color
          </p>
          <div className="grid grid-cols-7 gap-1.5">
            {TEXT_COLORS.map((color) => (
              <button
                key={color.id}
                type="button"
                title={color.label}
                onClick={() => {
                  onFormatChange({ textColor: color.id });
                  setShowColorPicker(false);
                }}
                className={cn(
                  "h-6 w-6 rounded-md border-2 transition",
                  item.textColor === color.id
                    ? "scale-110 border-slate-700 ring-2 ring-violet-400 ring-offset-1"
                    : "border-slate-200 hover:scale-105"
                )}
                style={{ backgroundColor: color.value }}
              />
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 py-1.5 shadow-lg">
        <select
          value={item.fontFamily ?? DEFAULT_TEXT_STYLE.fontFamily}
          onChange={(event) => onFormatChange({ fontFamily: event.target.value })}
          className="max-w-[7rem] rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
          aria-label="Font family"
          style={{ fontFamily: getTextFont(item.fontFamily).stack }}
        >
          {TEXT_FONTS.map((font) => (
            <option key={font.id} value={font.id} style={{ fontFamily: font.stack }}>
              {font.label}
            </option>
          ))}
        </select>
        <select
          value={item.fontSize}
          onChange={(event) => onFormatChange({ fontSize: Number(event.target.value) })}
          className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
          aria-label="Font size"
        >
          {TEXT_FONT_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}px
            </option>
          ))}
        </select>
        <div className="inline-flex rounded-lg border border-slate-200 p-0.5">
          <button
            type="button"
            title="Bold"
            onClick={() => onFormatChange({ bold: !item.bold })}
            className={cn(
              "inline-flex h-7 w-7 items-center justify-center rounded-md transition",
              item.bold ? "bg-violet-600 text-white" : "text-slate-600 hover:bg-slate-50"
            )}
          >
            <Bold className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title="Italic"
            onClick={() => onFormatChange({ italic: !item.italic })}
            className={cn(
              "inline-flex h-7 w-7 items-center justify-center rounded-md transition",
              item.italic ? "bg-violet-600 text-white" : "text-slate-600 hover:bg-slate-50"
            )}
          >
            <Italic className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title="Underline"
            onClick={() => onFormatChange({ underline: !item.underline })}
            className={cn(
              "inline-flex h-7 w-7 items-center justify-center rounded-md transition",
              item.underline ? "bg-violet-600 text-white" : "text-slate-600 hover:bg-slate-50"
            )}
          >
            <Underline className="h-3.5 w-3.5" />
          </button>
        </div>
        <button
          type="button"
          title="Text color"
          aria-label="Text color"
          aria-expanded={showColorPicker}
          onClick={() => setShowColorPicker((open) => !open)}
          className={cn(
            "inline-flex h-7 w-7 items-center justify-center rounded-lg border-2 transition",
            showColorPicker
              ? "border-violet-400 ring-2 ring-violet-400/30"
              : "border-slate-200 hover:border-slate-300"
          )}
          style={{ backgroundColor: activeColor.value }}
        />
      </div>
    </div>
  );
}

function normalizeItems(items) {
  const normalized = items.map((item, index) => {
    const type =
      item.type === "text"
        ? "text"
        : item.type === "image"
          ? "image"
          : item.type === "shape"
            ? "shape"
            : "note";
    const zIndex = Number(item.zIndex) || index + 1;
    const base = {
      id: item.id ?? createId(),
      type,
      x: Number(item.x) || 0,
      y: Number(item.y) || 0,
      zIndex,
    };

    if (type === "image") {
      return {
        ...base,
        width: Number(item.width) || 200,
        height: Number(item.height) || 200,
        src: item.src ?? "",
        name: item.name ?? "Image",
        rotation: Number(item.rotation) || 0,
      };
    }

    if (type === "text") {
      return {
        ...base,
        width: Number(item.width) || TEXT_MIN_WIDTH,
        height: Number(item.height) || TEXT_BOX_MIN_HEIGHT,
        content: item.content ?? "",
        color: item.color ?? STICKY_COLORS[0].id,
        fontFamily: TEXT_FONTS.some((font) => font.id === item.fontFamily)
          ? item.fontFamily
          : DEFAULT_TEXT_STYLE.fontFamily,
        fontSize: Number(item.fontSize) || DEFAULT_TEXT_STYLE.fontSize,
        textColor: TEXT_COLORS.some((color) => color.id === item.textColor)
          ? item.textColor
          : DEFAULT_TEXT_STYLE.textColor,
        bold: Boolean(item.bold),
        italic: Boolean(item.italic),
        underline: Boolean(item.underline),
        rotation: 0,
        linkedTaskId: null,
      };
    }

    if (type === "shape") {
      const shape = SHAPE_TYPES.some((entry) => entry.id === item.shape)
        ? item.shape
        : DEFAULT_SHAPE_KIND;
      const shapeBase = {
        ...base,
        shape,
        fillColor: SHAPE_COLOR_IDS.includes(item.fillColor) ? item.fillColor : DEFAULT_SHAPE_FILL,
        strokeColor: SHAPE_COLOR_IDS.includes(item.fillColor) ? item.fillColor : DEFAULT_SHAPE_FILL,
        strokeWidth: isLinearShape(shape) ? LINE_STROKE_WIDTH : Number(item.strokeWidth) || 2,
        content: item.content ?? "",
        fontFamily: TEXT_FONTS.some((font) => font.id === item.fontFamily)
          ? item.fontFamily
          : DEFAULT_SHAPE_TEXT_STYLE.fontFamily,
        fontSize: Number(item.fontSize) || DEFAULT_SHAPE_TEXT_STYLE.fontSize,
        textColor: TEXT_COLORS.some((color) => color.id === item.textColor)
          ? item.textColor
          : DEFAULT_SHAPE_TEXT_STYLE.textColor,
        bold: Boolean(item.bold),
        italic: Boolean(item.italic),
      };

      if (isLinearShape(shape)) {
        const points = resolveLinearPoints({
          ...shapeBase,
          width: Number(item.width) || LINE_SHAPE_WIDTH,
          height: Number(item.height) || LINE_SHAPE_HEIGHT,
          rotation: Number(item.rotation) || 0,
          lineStartX: item.lineStartX,
          lineStartY: item.lineStartY,
          lineEndX: item.lineEndX,
          lineEndY: item.lineEndY,
        });
        return {
          ...shapeBase,
          ...patchLinearItemFromPoints(points.x1, points.y1, points.x2, points.y2),
          connectFrom: item.connectFrom ?? null,
          connectTo: item.connectTo ?? null,
        };
      }

      return {
        ...shapeBase,
        width: Number(item.width) || SHAPE_WIDTH,
        height: Number(item.height) || SHAPE_HEIGHT,
        rotation: Number(item.rotation) || 0,
      };
    }

    return {
      ...base,
      width: Number(item.width) || NOTE_WIDTH,
      height: Number(item.height) || NOTE_HEIGHT,
      content: item.content ?? "New note",
      color: item.color ?? STICKY_COLORS[0].id,
      fontFamily: (() => {
        if (TEXT_FONTS.some((font) => font.id === item.fontFamily)) {
          if (item.fontFamily === "system") return DEFAULT_NOTE_FONT;
          return item.fontFamily;
        }
        return DEFAULT_NOTE_FONT;
      })(),
      fontSize: Number(item.fontSize) || DEFAULT_TEXT_STYLE.fontSize,
      textColor: TEXT_COLORS.some((color) => color.id === item.textColor)
        ? item.textColor
        : DEFAULT_TEXT_STYLE.textColor,
      bold: Boolean(item.bold),
      italic: Boolean(item.italic),
      underline: Boolean(item.underline),
      rotation: Number(item.rotation) || 0,
      linkedTaskId: item.linkedTaskId ?? null,
    };
  });

  return syncArrowConnections(normalized);
}

export default function DreamboardPage() {
  const { addTask, updateTask } = useTasks();
  const loading = useLoadingOptional();
  const viewportRef = useRef(null);
  const canvasRef = useRef(null);
  const pendingFocusRef = useRef(null);
  const pendingTextPlacementRef = useRef(null);
  const suppressNextClickRef = useRef(false);
  const textEditorRefs = useRef(new Map());
  const toolRef = useRef("select");
  const shapeKindRef = useRef(DEFAULT_SHAPE_KIND);
  const editingIdRef = useRef(null);
  const linearPlacementRef = useRef(null);
  const imageInputRef = useRef(null);
  const selectionBoxRef = useRef(null);
  const itemsRef = useRef([]);
  const undoStackRef = useRef([]);
  const isUndoingRef = useRef(false);
  const prevItemsForUndoRef = useRef(null);
  const clipboardRef = useRef(null);
  const pasteCountRef = useRef(0);
  const commitTextEditRef = useRef(() => {});
  const marqueeCleanupRef = useRef(null);
  const [items, setItems] = useState(() => normalizeItems(loadDreamboard().items));
  const [tool, setTool] = useState("select");
  const [stickyColor, setStickyColor] = useState(STICKY_COLORS[0].id);
  const [shapeKind, setShapeKind] = useState(DEFAULT_SHAPE_KIND);
  const [textStyle, setTextStyle] = useState(DEFAULT_TEXT_STYLE);
  const [selectedIds, setSelectedIds] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [dragState, setDragState] = useState(null);
  const [rotateState, setRotateState] = useState(null);
  const [resizeState, setResizeState] = useState(null);
  const [linearEndpointState, setLinearEndpointState] = useState(null);
  const [linearPlacementVisual, setLinearPlacementVisual] = useState(null);
  const [isMarqueeSelecting, setIsMarqueeSelecting] = useState(false);
  const [selectionBoxVisual, setSelectionBoxVisual] = useState(null);
  const [itemContextMenu, setItemContextMenu] = useState(null);
  const [viewport, setViewport] = useState({ scale: 1, x: 0, y: 0 });
  const [panState, setPanState] = useState(null);
  const nextZRef = useRef(
    items.reduce((max, item) => Math.max(max, item.zIndex ?? 0), 0) + 1
  );

  const getBoardPoint = useCallback(
    (clientX, clientY) => {
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: (clientX - rect.left - viewport.x) / viewport.scale,
        y: (clientY - rect.top - viewport.y) / viewport.scale,
      };
    },
    [viewport]
  );

  const isGroupSelection = useCallback(
    (itemId, currentSelectedIds) =>
      currentSelectedIds.includes(itemId) && currentSelectedIds.length > 1,
    []
  );

  const buildDragState = useCallback(
    (event, item, currentSelectedIds) => {
      const point = getBoardPoint(event.clientX, event.clientY);
      const state = {
        id: item.id,
        offsetX: point.x - item.x,
        offsetY: point.y - item.y,
        startX: item.x,
        startY: item.y,
      };

      if (isLinearShape(item.shape)) {
        state.linearPoints = resolveLinearPoints(item);
      }

      if (isGroupSelection(item.id, currentSelectedIds)) {
        state.groupIds = [...currentSelectedIds];
        state.initialPositions = Object.fromEntries(
          itemsRef.current
            .filter((entry) => currentSelectedIds.includes(entry.id))
            .map((entry) => [
              entry.id,
              isLinearShape(entry.shape)
                ? { linearPoints: resolveLinearPoints(entry) }
                : { x: entry.x, y: entry.y },
            ])
        );
      }

      return state;
    },
    [getBoardPoint, isGroupSelection]
  );

  const isItemDragging = useCallback(
    (itemId) =>
      dragState?.groupIds
        ? dragState.groupIds.includes(itemId)
        : dragState?.id === itemId,
    [dragState]
  );

  const isItemResizing = useCallback((itemId) => resizeState?.id === itemId, [resizeState]);

  const startItemDrag = useCallback(
    (event, item, currentSelectedIds) => {
      clearDocumentSelection();
      setPanState(null);
      setDragState(buildDragState(event, item, currentSelectedIds));
    },
    [buildDragState]
  );

  const startPan = useCallback((event) => {
    clearDocumentSelection();
    setPanState({
      mode: "panning",
      startX: event.clientX,
      startY: event.clientY,
      startViewportX: viewport.x,
      startViewportY: viewport.y,
    });
  }, [viewport.x, viewport.y]);

  const resetViewportZoom = useCallback(() => {
    const viewportEl = viewportRef.current;
    if (!viewportEl) return;
    setViewport(getCenteredViewport(viewportEl, 1));
  }, []);

  useEffect(() => {
    saveDreamboard(items);
  }, [items]);

  useEffect(() => {
    if (prevItemsForUndoRef.current === null) {
      prevItemsForUndoRef.current = items;
      return;
    }

    if (isUndoingRef.current) {
      isUndoingRef.current = false;
      prevItemsForUndoRef.current = items;
      return;
    }

    if (prevItemsForUndoRef.current === items) return;

    undoStackRef.current.push(structuredClone(prevItemsForUndoRef.current));
    if (undoStackRef.current.length > MAX_UNDO_HISTORY) {
      undoStackRef.current.shift();
    }
    prevItemsForUndoRef.current = items;
  }, [items]);

  const moveItemForward = useCallback((id) => {
    setItems((prev) => moveItemsOneStepForward(prev, [id]));
  }, []);

  const moveItemBackward = useCallback((id) => {
    setItems((prev) => moveItemsOneStepBackward(prev, [id]));
  }, []);

  const moveSelectedForward = useCallback(() => {
    if (!selectedIds.length) return;
    setItems((prev) => moveItemsOneStepForward(prev, selectedIds));
  }, [selectedIds]);

  const moveSelectedBackward = useCallback(() => {
    if (!selectedIds.length) return;
    setItems((prev) => moveItemsOneStepBackward(prev, selectedIds));
  }, [selectedIds]);

  const updateItem = useCallback((id, patch) => {
    setItems((prev) => {
      const next = prev.map((item) => (item.id === id ? { ...item, ...patch } : item));
      const updated = next.find((item) => item.id === id);
      if (
        updated &&
        (isWireframeShape(updated) ||
          (updated.shape === "arrow" && (updated.connectFrom || updated.connectTo)))
      ) {
        return syncArrowConnections(next);
      }
      return next;
    });
  }, []);

  const handleNoteInput = useCallback(
    (event, itemId) => {
      const element = event.target;
      updateItem(itemId, { content: element.value });
      requestAnimationFrame(() => syncStickyNoteScrollAfterInput(element));
    },
    [updateItem]
  );

  const handleNoteBlur = useCallback((event, itemId) => {
    resetStickyNoteScroll(event.target);
    setEditingId((current) => (current === itemId ? null : current));
  }, []);

  const finishNoteEditing = useCallback((itemId, element) => {
    if (element) resetStickyNoteScroll(element);
    setEditingId((current) => (current === itemId ? null : current));
  }, []);

  const removeItem = useCallback((id) => {
    setItems((prev) => syncArrowConnections(prev.filter((item) => item.id !== id)));
    setSelectedIds((current) => current.filter((entry) => entry !== id));
    setEditingId((current) => (current === id ? null : current));
  }, []);

  const selectSingleItem = useCallback((id) => {
    setSelectedIds(id ? [id] : []);
  }, []);

  const closeItemContextMenu = useCallback(() => {
    setItemContextMenu(null);
  }, []);

  const openItemContextMenu = useCallback(
    (event, item) => {
      event.preventDefault();
      event.stopPropagation();
      selectSingleItem(item.id);
      setItemContextMenu({
        x: event.clientX,
        y: event.clientY,
        itemId: item.id,
      });
    },
    [selectSingleItem]
  );

  const toggleItemSelection = useCallback((id) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]
    );
  }, []);

  itemsRef.current = items;
  toolRef.current = tool;
  shapeKindRef.current = shapeKind;
  editingIdRef.current = editingId;

  const stopMarqueeTracking = useCallback(() => {
    if (marqueeCleanupRef.current) {
      marqueeCleanupRef.current();
      marqueeCleanupRef.current = null;
    }
  }, []);

  const finishMarqueeSelection = useCallback(() => {
    stopMarqueeTracking();

    const current = selectionBoxRef.current;
    selectionBoxRef.current = null;
    setIsMarqueeSelecting(false);
    setSelectionBoxVisual(null);
    suppressNextClickRef.current = true;

    if (!current) return;

    commitTextEditRef.current();

    const box = getSelectionBoxRect(current);
    if (box.width > 3 || box.height > 3) {
      const hits = expandMarqueeSelection(
        itemsRef.current
          .filter((item) => rectsIntersect(getItemAxisBounds(item), box))
          .map((item) => item.id),
        itemsRef.current
      );

      if (current.replaceSelection !== false) {
        setSelectedIds(hits);
      } else {
        setSelectedIds((prev) => [...new Set([...prev, ...hits])]);
      }
      return;
    }

    if (current.replaceSelection !== false) {
      setSelectedIds([]);
    }
  }, [stopMarqueeTracking]);

  const startMarqueeSelection = useCallback(
    (clientX, clientY, options = {}) => {
      stopMarqueeTracking();
      clearDocumentSelection();
      setPanState(null);

      const point = getBoardPoint(clientX, clientY);
      selectionBoxRef.current = {
        startX: point.x,
        startY: point.y,
        currentX: point.x,
        currentY: point.y,
        replaceSelection: options.replaceSelection !== false,
      };
      setSelectionBoxVisual({ ...selectionBoxRef.current });
      setIsMarqueeSelecting(true);

      const onMove = (event) => {
        if (!selectionBoxRef.current) return;
        const nextPoint = getBoardPoint(event.clientX, event.clientY);
        selectionBoxRef.current = {
          ...selectionBoxRef.current,
          currentX: nextPoint.x,
          currentY: nextPoint.y,
        };
        setSelectionBoxVisual({ ...selectionBoxRef.current });
      };

      const onUp = () => {
        finishMarqueeSelection();
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
      marqueeCleanupRef.current = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      };
    },
    [finishMarqueeSelection, getBoardPoint, stopMarqueeTracking]
  );

  const beginCmdItemInteraction = useCallback(
    (event, itemId = null) => {
      const startX = event.clientX;
      const startY = event.clientY;
      const replaceSelection = !event.shiftKey;
      let moved = false;

      const onMove = (moveEvent) => {
        const delta = Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY);
        if (delta < 5) return;

        if (!moved) {
          moved = true;
          window.removeEventListener("pointermove", onMove);
          startMarqueeSelection(startX, startY, { replaceSelection });
          const point = getBoardPoint(moveEvent.clientX, moveEvent.clientY);
          selectionBoxRef.current = {
            ...selectionBoxRef.current,
            currentX: point.x,
            currentY: point.y,
          };
          setSelectionBoxVisual({ ...selectionBoxRef.current });
        }
      };

      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);

        if (!moved) {
          commitTextEditRef.current();
          suppressNextClickRef.current = true;
          if (itemId) {
            toggleItemSelection(itemId);
          } else {
            setSelectedIds([]);
          }
        }
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [getBoardPoint, startMarqueeSelection, toggleItemSelection]
  );

  useEffect(() => () => stopMarqueeTracking(), [stopMarqueeTracking]);

  const focusTextEditor = useCallback((id) => {
    pendingFocusRef.current = id;
  }, []);

  const focusTextEditorNow = useCallback((id) => {
    const el = textEditorRefs.current.get(id);
    if (el) {
      el.focus();
      if (el.dataset.shapeTextScroll !== undefined) {
        syncShapeTextareaView(el);
      } else if (el.dataset.stickyNoteScroll === undefined) {
        autoResizeTextarea(el);
      }
      pendingFocusRef.current = null;
      return true;
    }
    pendingFocusRef.current = id;
    return false;
  }, []);

  const setTextEditorRef = useCallback((id, node) => {
    if (node) {
      textEditorRefs.current.set(id, node);
      return;
    }
    textEditorRefs.current.delete(id);
  }, []);

  const syncTextBounds = useCallback((id, element, fallbackText = " ") => {
    if (!element) return;
    const bounds = measureTextBounds(element, fallbackText);
    setItems((prev) =>
      prev.map((item) =>
        item.id === id && (item.width !== bounds.width || item.height !== bounds.height)
          ? { ...item, ...bounds }
          : item
      )
    );
  }, []);

  const syncTextItemBounds = useCallback((item) => {
    const bounds = measureTextItem(item, item.content || " ");
    setItems((prev) =>
      prev.map((entry) =>
        entry.id === item.id &&
        (entry.width !== bounds.width || entry.height !== bounds.height)
          ? { ...entry, ...bounds }
          : entry
      )
    );
  }, []);

  const addNote = useCallback(
    (x, y) => {
      const id = createId();
      nextZRef.current += 1;
      const item = {
        id,
        type: "note",
        x: Math.max(8, x - NOTE_WIDTH / 2),
        y: Math.max(8, y - NOTE_HEIGHT / 2),
        width: NOTE_WIDTH,
        height: NOTE_HEIGHT,
        content: "",
        color: stickyColor,
        fontFamily: DEFAULT_NOTE_FONT,
        rotation: 0,
        zIndex: nextZRef.current,
      };

      suppressNextClickRef.current = true;

      flushSync(() => {
        setItems((prev) => [...prev, item]);
        setSelectedIds([id]);
        setEditingId(id);
      });

      pendingFocusRef.current = id;
      setTool("select");

      requestAnimationFrame(() => {
        focusTextEditorNow(id);
      });
    },
    [stickyColor, focusTextEditorNow]
  );

  const addText = useCallback(
    (x, y) => {
      const id = createId();
      nextZRef.current += 1;
      const item = {
        id,
        type: "text",
        x: Math.max(8, x),
        y: Math.max(8, y),
        width: TEXT_MIN_WIDTH,
        height: TEXT_BOX_MIN_HEIGHT,
        content: "",
        fontFamily: textStyle.fontFamily,
        fontSize: textStyle.fontSize,
        textColor: textStyle.textColor,
        bold: textStyle.bold,
        italic: textStyle.italic,
        underline: textStyle.underline,
        zIndex: nextZRef.current,
      };

      pendingTextPlacementRef.current = id;
      suppressNextClickRef.current = true;

      flushSync(() => {
        setItems((prev) => [...prev, item]);
        setSelectedIds([id]);
        setEditingId(id);
      });

      requestAnimationFrame(() => {
        focusTextEditorNow(id);
        window.setTimeout(() => {
          if (pendingTextPlacementRef.current === id) {
            pendingTextPlacementRef.current = null;
          }
        }, 500);
      });
    },
    [focusTextEditorNow, textStyle]
  );

  const addLinearShape = useCallback(
    (shape, x1, y1, x2, y2, connections = {}) => {
      const start = connections.connectFrom
        ? { x: x1, y: y1 }
        : snapPointToGrid({ x: x1, y: y1 });
      const end = connections.connectTo ? { x: x2, y: y2 } : snapPointToGrid({ x: x2, y: y2 });
      const id = createId();
      nextZRef.current += 1;
      const item = {
        id,
        type: "shape",
        shape,
        fillColor: DEFAULT_SHAPE_FILL,
        strokeColor: DEFAULT_SHAPE_FILL,
        strokeWidth: LINE_STROKE_WIDTH,
        content: "",
        fontFamily: DEFAULT_SHAPE_TEXT_STYLE.fontFamily,
        fontSize: DEFAULT_SHAPE_TEXT_STYLE.fontSize,
        textColor: DEFAULT_SHAPE_TEXT_STYLE.textColor,
        bold: DEFAULT_SHAPE_TEXT_STYLE.bold,
        italic: DEFAULT_SHAPE_TEXT_STYLE.italic,
        connectFrom: connections.connectFrom ?? null,
        connectTo: connections.connectTo ?? null,
        zIndex: nextZRef.current,
        ...patchLinearItemFromPoints(start.x, start.y, end.x, end.y),
      };
      setItems((prev) => syncArrowConnections([...prev, item]));
      selectSingleItem(id);
      setTool("select");
    },
    [selectSingleItem]
  );

  const addShape = useCallback(
    (x, y) => {
      const kind = shapeKindRef.current;
      if (isLinearShape(kind)) {
        addLinearShape(kind, x, y, x + MIN_LINEAR_LENGTH, y);
        return;
      }

      const width = SHAPE_WIDTH;
      const height = SHAPE_HEIGHT;
      const id = createId();
      nextZRef.current += 1;
      const placement =
        kind === "wireframe"
          ? snapWireframeBounds(
              {
                x: Math.max(0, x - width / 2),
                y: Math.max(0, y - height / 2),
                width,
                height,
              },
              SHAPE_MIN_WIDTH,
              SHAPE_MIN_HEIGHT
            )
          : {
              x: Math.max(8, x - width / 2),
              y: Math.max(8, y - height / 2),
              width,
              height,
            };
      const item = {
        id,
        type: "shape",
        shape: kind,
        x: placement.x,
        y: placement.y,
        width: placement.width,
        height: placement.height,
        fillColor: DEFAULT_SHAPE_FILL,
        strokeColor: DEFAULT_SHAPE_FILL,
        strokeWidth: 2,
        rotation: 0,
        content: "",
        fontFamily: DEFAULT_SHAPE_TEXT_STYLE.fontFamily,
        fontSize: DEFAULT_SHAPE_TEXT_STYLE.fontSize,
        textColor: DEFAULT_SHAPE_TEXT_STYLE.textColor,
        bold: DEFAULT_SHAPE_TEXT_STYLE.bold,
        italic: DEFAULT_SHAPE_TEXT_STYLE.italic,
        zIndex: nextZRef.current,
      };
      setItems((prev) => [...prev, item]);
      selectSingleItem(id);
      setTool("select");
    },
    [addLinearShape, selectSingleItem]
  );

  const addImage = useCallback(
    (src, name, naturalWidth, naturalHeight) => {
      const { width, height } = fitImageDimensions(naturalWidth, naturalHeight);
      const center = getViewportBoardCenter(viewport, viewportRef.current);
      const id = createId();
      nextZRef.current += 1;
      const item = {
        id,
        type: "image",
        x: Math.max(8, center.x - width / 2),
        y: Math.max(8, center.y - height / 2),
        width,
        height,
        src,
        name: name || "Image",
        rotation: 0,
        zIndex: nextZRef.current,
      };
      setItems((prev) => [...prev, item]);
      selectSingleItem(id);
      setTool("select");
    },
    [viewport, selectSingleItem]
  );

  const handleImageUpload = useCallback(
    async (event) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file || !file.type.startsWith("image/")) return;

      const reader = new FileReader();
      reader.onload = async () => {
        const src = typeof reader.result === "string" ? reader.result : "";
        if (!src) return;

        try {
          const { width, height } = await loadImageDimensions(src);
          addImage(src, file.name, width, height);
        } catch {
          window.alert("Could not load that image. Try a different file.");
        }
      };
      reader.onerror = () => window.alert("Could not read that image file.");
      reader.readAsDataURL(file);
    },
    [addImage]
  );

  const openImageUpload = useCallback(() => {
    imageInputRef.current?.click();
  }, []);

  const isPlacementTool = tool === "text" || tool === "note" || tool === "shape";
  const itemPointerEventsPassThrough = (item) =>
    isPlacementTool || (editingId != null && item.id !== editingId);

  const selectedItems = items.filter((item) => selectedIds.includes(item.id));
  const selectedItem = selectedItems.length === 1 ? selectedItems[0] : null;
  const activeTextItem =
    items.find((item) => item.id === editingId && item.type === "text") ??
    (selectedItem?.type === "text" ? selectedItem : null);
  const activeShapeItem =
    items.find((item) => item.id === editingId && item.type === "shape") ??
    (selectedItem?.type === "shape" ? selectedItem : null);

  const syncShapeItemBounds = useCallback((item, contentOverride) => {
    const content = contentOverride ?? item.content ?? "";
    const patch = getShapeExpansionPatch(item, content);
    if (!patch) return;
    setItems((prev) =>
      prev.map((entry) => (entry.id === item.id ? { ...entry, ...patch } : entry))
    );
  }, []);

  const updateTextFormat = useCallback(
    (patch) => {
      if (!activeTextItem) return;

      const merged = { ...activeTextItem, ...patch };
      updateItem(activeTextItem.id, patch);
      setTextStyle((prev) => ({ ...prev, ...patch }));
      requestAnimationFrame(() => {
        const el = textEditorRefs.current.get(activeTextItem.id);
        if (el && editingId === activeTextItem.id) {
          autoResizeTextarea(el);
          return;
        }
        if (el) {
          syncTextBounds(activeTextItem.id, el, merged.content || "Type here");
          return;
        }
        syncTextItemBounds(merged);
      });
    },
    [activeTextItem, editingId, syncTextBounds, syncTextItemBounds, updateItem]
  );

  const updateShapeFormat = useCallback(
    (patch) => {
      if (!activeShapeItem) return;
      setItems((prev) =>
        prev.map((entry) => {
          if (entry.id !== activeShapeItem.id) return entry;
          const merged = { ...entry, ...patch };
          const el = textEditorRefs.current.get(entry.id);
          const content = el?.value ?? merged.content ?? "";
          const expansion = getShapeExpansionPatch(merged, content);
          return expansion ? { ...merged, ...expansion } : merged;
        })
      );
      requestAnimationFrame(() => {
        const el = textEditorRefs.current.get(activeShapeItem.id);
        if (el) syncShapeTextareaView(el);
      });
    },
    [activeShapeItem]
  );

  const handleShapeInput = useCallback((event, itemId) => {
    const element = event.target;
    const content = element.value;
    setItems((prev) =>
      prev.map((entry) => {
        if (entry.id !== itemId) return entry;
        const merged = { ...entry, content };
        const expansion = getShapeExpansionPatch(merged, content);
        return expansion ? { ...merged, ...expansion } : merged;
      })
    );
    requestAnimationFrame(() => syncShapeTextareaView(element));
  }, []);

  const handleBoardPointerDown = (event) => {
    if (!isBoardSurface(event.target, viewportRef.current, canvasRef.current)) return;

    viewportRef.current?.focus({ preventScroll: true });

    if (event.button === 1) {
      event.preventDefault();
      startPan(event);
      return;
    }

    if (event.button !== 0) return;

    const point = getBoardPoint(event.clientX, event.clientY);
    const groupHitItem = isPointInMultiSelection(point.x, point.y, itemsRef.current, selectedIds)
      ? getSelectedItemAtPoint(point.x, point.y, itemsRef.current, selectedIds)
      : null;

    if (tool === "text" || tool === "note" || tool === "shape") {
      return;
    }

    if (editingId && isBoardSurface(event.target, viewportRef.current, canvasRef.current)) {
      commitTextEdit();
    }

    if (tool === "select") {
      if (groupHitItem) {
        startItemDrag(event, groupHitItem, selectedIds);
        return;
      }

      clearDocumentSelection();
      setPanState({
        mode: "pending",
        startX: event.clientX,
        startY: event.clientY,
        startViewportX: viewport.x,
        startViewportY: viewport.y,
      });
    }
  };

  const handleBoardClick = (event) => {
    if (!isBoardSurface(event.target, viewportRef.current, canvasRef.current)) return;
    if (event.target.closest("[data-item-id]")) return;
    if (event.target.closest("[data-dreamboard-chrome]")) return;
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }
    if (toolRef.current === "select") {
      clearSelection();
    }
  };

  const handleTextPointerDown = (event, item) => {
    if (editingId === item.id) {
      event.stopPropagation();
      return;
    }

    event.stopPropagation();

    const groupDrag = isGroupSelection(item.id, selectedIds);
    if (!groupDrag) {
      selectSingleItem(item.id);
    }

    const startX = event.clientX;
    const startY = event.clientY;

    const onMove = (moveEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      if (Math.hypot(dx, dy) < 5) return;

      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);

      startItemDrag(moveEvent, item, selectedIds);
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const handleShapePointerDown = (event, item) => {
    handleTextPointerDown(event, item);
  };

  const beginTextEditing = (item) => {
    selectSingleItem(item.id);
    setEditingId(item.id);
    focusTextEditor(item.id);
  };

  const beginShapeEditing = (item) => {
    selectSingleItem(item.id);
    setEditingId(item.id);
    focusTextEditor(item.id);
  };

  const beginNoteEditing = useCallback(
    (item) => {
      flushSync(() => {
        selectSingleItem(item.id);
        setEditingId(item.id);
      });
      pendingFocusRef.current = item.id;
      requestAnimationFrame(() => focusTextEditorNow(item.id));
    },
    [focusTextEditorNow, selectSingleItem]
  );

  const finishShapeEditing = useCallback(
    (id) => {
      const el = textEditorRefs.current.get(id);
      const content = el?.value ?? "";
      setEditingId((current) => (current === id ? null : current));
      setItems((prev) =>
        prev.map((entry) => {
          if (entry.id !== id) return entry;
          const merged = { ...entry, content };
          const expansion = getShapeExpansionPatch(merged, content);
          return expansion ? { ...merged, ...expansion } : merged;
        })
      );
      selectSingleItem(id);
    },
    [selectSingleItem]
  );

  const finishEditing = useCallback(
    (id) => {
      if (pendingTextPlacementRef.current === id) {
        return;
      }

      const el = textEditorRefs.current.get(id);
      if (!el) return;

      const content = el.value ?? "";

      setEditingId((current) => (current === id ? null : current));

      if (!content.trim()) {
        removeItem(id);
        return;
      }

      selectSingleItem(id);
      setItems((prev) => {
        const item = prev.find((entry) => entry.id === id);
        if (!item) return prev;
        const bounds = measureTextItem({ ...item, content });
        if (
          item.content === content &&
          item.width === bounds.width &&
          item.height === bounds.height
        ) {
          return prev;
        }
        return prev.map((entry) =>
          entry.id === id ? { ...entry, content, ...bounds } : entry
        );
      });
    },
    [removeItem, selectSingleItem]
  );

  const commitTextEdit = useCallback(() => {
    if (!editingId) return;
    if (pendingTextPlacementRef.current === editingId) return;
    const item = itemsRef.current.find((entry) => entry.id === editingId);
    if (item?.type === "note") {
      const active = document.activeElement;
      if (active instanceof HTMLTextAreaElement && active.dataset.stickyNoteScroll !== undefined) {
        active.blur();
        return;
      }
      finishNoteEditing(editingId);
      return;
    }
    if (item?.type === "shape") {
      const el = textEditorRefs.current.get(editingId);
      if (el && document.activeElement === el) {
        el.blur();
        return;
      }
      finishShapeEditing(editingId);
      return;
    }
    const el = textEditorRefs.current.get(editingId);
    if (el && document.activeElement === el) {
      el.blur();
      return;
    }
    finishEditing(editingId);
  }, [editingId, finishEditing, finishNoteEditing, finishShapeEditing]);

  commitTextEditRef.current = commitTextEdit;

  const exitActiveEditMode = useCallback(() => {
    pendingTextPlacementRef.current = null;
    const activeId = editingIdRef.current;

    if (activeId) {
      const item = itemsRef.current.find((entry) => entry.id === activeId);
      if (item?.type === "note") {
        const el = textEditorRefs.current.get(activeId);
        finishNoteEditing(activeId, el);
      } else if (item?.type === "shape") {
        finishShapeEditing(activeId);
      } else if (item?.type === "text") {
        finishEditing(activeId);
      } else {
        setEditingId(null);
      }
    }

    setTool("select");
  }, [finishEditing, finishNoteEditing, finishShapeEditing]);

  const clearSelection = useCallback(() => {
    commitTextEdit();
    setSelectedIds([]);
    setEditingId(null);
    setItemContextMenu(null);
  }, [commitTextEdit]);

  const activateSelectTool = useCallback(() => {
    exitActiveEditMode();
  }, [exitActiveEditMode]);

  const handleViewportPointerDownCapture = useCallback(
    (event) => {
    if (event.button !== 0) return;

    if (isMultiSelectModifier(event)) {
      if (editingIdRef.current) {
        exitActiveEditMode();
      }
      if (!isCmdMarqueeExcludedTarget(event.target)) {
        const itemEl = event.target.closest("[data-item-id]");
        const itemId = itemEl?.getAttribute("data-item-id") ?? null;
        beginCmdItemInteraction(event, itemId);
        event.preventDefault();
        event.stopPropagation();
        return;
      }
    }

    if (event.target.closest("[data-dreamboard-chrome]")) return;
      if (event.target.closest("[data-text-format-popup]")) return;
      if (event.target.closest("[data-shape-format-popup]")) return;
      if (event.target.closest("[data-editable]")) return;

      const activeEditingId = editingIdRef.current;
      if (activeEditingId) {
        if (isMultiSelectModifier(event)) {
          exitActiveEditMode();
          return;
        }
        exitActiveEditMode();
        event.preventDefault();
        event.stopPropagation();
        suppressNextClickRef.current = true;
        return;
      }

      const activeTool = toolRef.current;
      if (activeTool !== "text" && activeTool !== "note" && activeTool !== "shape") return;
      if (isMultiSelectModifier(event)) return;

      const { x, y } = getBoardPoint(event.clientX, event.clientY);
      viewportRef.current?.focus({ preventScroll: true });
      event.preventDefault();
      event.stopPropagation();
      suppressNextClickRef.current = true;

      if (activeTool === "note") {
        addNote(x, y);
        return;
      }

      if (activeTool === "shape") {
        const kind = shapeKindRef.current;
        if (isLinearShape(kind)) {
          linearPlacementRef.current = {
            shape: kind,
            startX: x,
            startY: y,
            currentX: x,
            currentY: y,
          };
          setLinearPlacementVisual({
            shape: kind,
            startX: x,
            startY: y,
            currentX: x,
            currentY: y,
          });
          return;
        }
        addShape(x, y);
        return;
      }

      addText(x, y);
    },
    [exitActiveEditMode, getBoardPoint, addNote, addShape, addText, beginCmdItemInteraction]
  );

  const handleExportPdf = useCallback(async () => {
    if (!viewportRef.current || !canvasRef.current || loading?.isLoading) return;

    const exportPdf = async () => {
      const filename = getDreamboardExportFilename();

      commitTextEdit();
      await new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      });

      try {
        const items = mergeLiveItemContent(itemsRef.current, canvasRef.current);
        const blob = await createDreamboardPdfBlob({
          viewportEl: viewportRef.current,
          items,
          viewport,
          boardCenterX: BOARD_CANVAS_SIZE / 2,
          boardCenterY: BOARD_CANVAS_SIZE / 2,
        });

        let fileHandle = null;
        try {
          fileHandle = await requestDreamboardPdfSaveHandle(filename);
        } catch (err) {
          if (err?.name === "AbortError") return;
        }

        if (fileHandle) {
          await writeDreamboardPdfToHandle(fileHandle, blob);
        } else {
          downloadDreamboardPdf(blob, filename);
        }
      } catch (err) {
        if (err?.code === "NO_VISIBLE_ITEMS") {
          window.alert(
            "Nothing to export. Pan or zoom so your items are visible on the whiteboard, then try again."
          );
          return;
        }
        window.alert("Could not export the whiteboard. Please try again.");
      }
    };

    if (loading?.runWithLoading) {
      await loading.runWithLoading(exportPdf, "Exporting PDF");
      return;
    }

    await exportPdf();
  }, [commitTextEdit, loading, viewport]);

  const activateStickyNoteTool = useCallback(() => {
    commitTextEdit();
    setSelectedIds([]);
    setEditingId(null);
    setTool("note");
  }, [commitTextEdit]);

  const activateTextTool = useCallback(() => {
    pendingTextPlacementRef.current = null;
    commitTextEdit();
    setSelectedIds([]);
    setEditingId(null);
    setTool("text");
  }, [commitTextEdit]);

  const activateShapeTool = useCallback(() => {
    commitTextEdit();
    setSelectedIds([]);
    setEditingId(null);
    setTool("shape");
  }, [commitTextEdit]);

  const sendNoteToTasks = useCallback(
    (note) => {
      const fields = getNoteTaskFields(note);

      if (note.linkedTaskId) {
        updateTask(note.linkedTaskId, fields);
        return;
      }

      const task = addTask(fields);
      updateItem(note.id, { linkedTaskId: task.id });
    },
    [addTask, updateTask, updateItem]
  );

  const removeSelectedItems = useCallback(() => {
    commitTextEdit();
    setItems((prev) => syncArrowConnections(prev.filter((item) => !selectedIds.includes(item.id))));
    setSelectedIds([]);
    setEditingId(null);
  }, [selectedIds, commitTextEdit]);

  const duplicateSelectedItems = useCallback(() => {
    if (!selectedIds.length) return;

    commitTextEdit();
    setEditingId(null);

    const selectedSet = new Set(selectedIds);
    const selectedItems = itemsRef.current.filter((item) => selectedSet.has(item.id));
    if (!selectedItems.length) return;

    const duplicates = cloneBoardItems(selectedItems, DUPLICATE_OFFSET, nextZRef);
    setItems((prev) => [...prev, ...duplicates]);
    setSelectedIds(duplicates.map((item) => item.id));
  }, [selectedIds, commitTextEdit]);

  const copySelectedItems = useCallback(() => {
    if (!selectedIds.length) return;

    commitTextEdit();

    const selectedSet = new Set(selectedIds);
    const selectedItems = itemsRef.current.filter((item) => selectedSet.has(item.id));
    if (!selectedItems.length) return;

    clipboardRef.current = structuredClone(selectedItems);
    pasteCountRef.current = 0;
  }, [selectedIds, commitTextEdit]);

  const pasteClipboardItems = useCallback(() => {
    const clipboard = clipboardRef.current;
    if (!clipboard?.length) return;

    commitTextEdit();
    setEditingId(null);
    pasteCountRef.current += 1;

    const pasted = cloneBoardItems(
      clipboard,
      DUPLICATE_OFFSET * pasteCountRef.current,
      nextZRef
    );
    setItems((prev) => syncArrowConnections([...prev, ...pasted]));
    setSelectedIds(pasted.map((item) => item.id));
  }, [commitTextEdit]);

  const cutSelectedItems = useCallback(() => {
    if (!selectedIds.length) return;

    commitTextEdit();
    setEditingId(null);

    const selectedSet = new Set(selectedIds);
    const selectedItems = itemsRef.current.filter((item) => selectedSet.has(item.id));
    if (!selectedItems.length) return;

    clipboardRef.current = structuredClone(selectedItems);
    pasteCountRef.current = 0;
    setItems((prev) => syncArrowConnections(prev.filter((item) => !selectedSet.has(item.id))));
    setSelectedIds([]);
  }, [selectedIds, commitTextEdit]);

  const selectAllItems = useCallback(() => {
    commitTextEdit();
    setEditingId(null);
    const allIds = itemsRef.current.map((item) => item.id);
    if (!allIds.length) return;
    setSelectedIds(allIds);
  }, [commitTextEdit]);

  const undoItems = useCallback(() => {
    if (!undoStackRef.current.length) return;

    commitTextEdit();
    setEditingId(null);
    setItemContextMenu(null);

    const snapshot = undoStackRef.current.pop();
    isUndoingRef.current = true;
    setItems(syncArrowConnections(snapshot));
    setSelectedIds([]);
  }, [commitTextEdit]);

  const startDrag = (event, item) => {
    event.stopPropagation();
    if (editingId === item.id && event.target.closest("[data-editable]")) return;

    if (!isGroupSelection(item.id, selectedIds)) {
      selectSingleItem(item.id);
    }
    startItemDrag(event, item, selectedIds);
  };

  const startNoteRotate = (event, item) => {
    event.stopPropagation();
    event.preventDefault();
    clearDocumentSelection();
    selectSingleItem(item.id);
    const centerX = item.x + item.width / 2;
    const centerY = item.y + item.height / 2;
    const point = getBoardPoint(event.clientX, event.clientY);
    setRotateState({
      id: item.id,
      centerX,
      centerY,
      startAngle: getAngleFromCenter(centerX, centerY, point.x, point.y),
      startRotation: item.rotation || 0,
    });
  };

  const startShapeResize = (event, item, handle) => {
    if (isLinearShape(item.shape)) return;
    event.stopPropagation();
    event.preventDefault();
    clearDocumentSelection();
    selectSingleItem(item.id);
    setResizeState({
      id: item.id,
      handle,
      startX: item.x,
      startY: item.y,
      startWidth: item.width,
      startHeight: item.height,
    });
  };

  const startLinearEndpointDrag = (event, item, endpoint) => {
    event.stopPropagation();
    event.preventDefault();
    clearDocumentSelection();
    selectSingleItem(item.id);
    const points = resolveLinearPoints(item);
    setLinearEndpointState({
      id: item.id,
      endpoint,
      fixedX: endpoint === "start" ? points.x2 : points.x1,
      fixedY: endpoint === "start" ? points.y2 : points.y1,
    });
  };

  const startWireframeConnection = (event, item, anchor) => {
    event.stopPropagation();
    event.preventDefault();
    clearDocumentSelection();
    selectSingleItem(item.id);
    const anchorPoint = getWireframeAnchorPoint(item, anchor);
    linearPlacementRef.current = {
      shape: "arrow",
      startX: anchorPoint.x,
      startY: anchorPoint.y,
      currentX: anchorPoint.x,
      currentY: anchorPoint.y,
      connectFrom: { itemId: item.id, anchor },
    };
    setLinearPlacementVisual({ ...linearPlacementRef.current });
  };

  useEffect(() => {
    if (!linearPlacementVisual) return undefined;

    const onMove = (event) => {
      const point = getBoardPoint(event.clientX, event.clientY);
      if (!linearPlacementRef.current) return;

      const snap = findNearestWireframeAnchor(point, itemsRef.current, {
        excludeId: linearPlacementRef.current.connectFrom?.itemId ?? null,
      });

      linearPlacementRef.current = {
        ...linearPlacementRef.current,
        currentX: snap?.x ?? snapPointToGrid(point).x,
        currentY: snap?.y ?? snapPointToGrid(point).y,
        snapTarget: snap
          ? { itemId: snap.itemId, anchor: snap.anchor }
          : null,
      };
      setLinearPlacementVisual({ ...linearPlacementRef.current });
    };

    const onUp = () => {
      const current = linearPlacementRef.current;
      linearPlacementRef.current = null;
      setLinearPlacementVisual(null);

      if (!current) return;

      const connectTo = current.snapTarget
        ? { itemId: current.snapTarget.itemId, anchor: current.snapTarget.anchor }
        : findNearestWireframeAnchor(
            { x: current.currentX, y: current.currentY },
            itemsRef.current,
            { excludeId: current.connectFrom?.itemId ?? null }
          );

      addLinearShape(
        current.shape,
        current.startX,
        current.startY,
        connectTo?.x ?? current.currentX,
        connectTo?.y ?? current.currentY,
        {
          connectFrom: current.connectFrom ?? null,
          connectTo: connectTo
            ? { itemId: connectTo.itemId, anchor: connectTo.anchor }
            : null,
        }
      );
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [linearPlacementVisual, getBoardPoint, addLinearShape]);

  useEffect(() => {
    if (!linearEndpointState) return undefined;

    const onMove = (event) => {
      const point = getBoardPoint(event.clientX, event.clientY);
      const { id, endpoint, fixedX, fixedY } = linearEndpointState;
      const item = itemsRef.current.find((entry) => entry.id === id);
      if (!item) return;

      const excludeId =
        endpoint === "start" ? item.connectTo?.itemId ?? null : item.connectFrom?.itemId ?? null;
      const snap = findNearestWireframeAnchor(point, itemsRef.current, { excludeId });
      const snappedPoint = snapPointToGrid(point);
      const movingX = snap?.x ?? snappedPoint.x;
      const movingY = snap?.y ?? snappedPoint.y;

      const patch =
        endpoint === "start"
          ? patchLinearItemFromPoints(movingX, movingY, fixedX, fixedY)
          : patchLinearItemFromPoints(fixedX, fixedY, movingX, movingY);

      const connectionPatch =
        item.shape === "arrow"
          ? endpoint === "start"
            ? {
                connectFrom: snap
                  ? { itemId: snap.itemId, anchor: snap.anchor }
                  : null,
              }
            : {
                connectTo: snap
                  ? { itemId: snap.itemId, anchor: snap.anchor }
                  : null,
              }
          : {};

      updateItem(id, { ...patch, ...connectionPatch });
    };

    const onUp = () => setLinearEndpointState(null);

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [linearEndpointState, getBoardPoint, updateItem]);

  useEffect(() => {
    if (!rotateState) return undefined;

    const onMove = (event) => {
      const point = getBoardPoint(event.clientX, event.clientY);
      const angle = getAngleFromCenter(rotateState.centerX, rotateState.centerY, point.x, point.y);
      updateItem(rotateState.id, {
        rotation: rotateState.startRotation + (angle - rotateState.startAngle),
      });
    };

    const onUp = () => setRotateState(null);

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [rotateState, getBoardPoint, updateItem]);

  useEffect(() => {
    if (!resizeState) return undefined;

    const onMove = (event) => {
      const point = getBoardPoint(event.clientX, event.clientY);
      const item = itemsRef.current.find((entry) => entry.id === resizeState.id);
      if (!item) return;

      const bounds = applyShapeResize(resizeState, point, item);
      updateItem(
        resizeState.id,
        item.shape === "wireframe"
          ? snapWireframeBounds(bounds, SHAPE_MIN_WIDTH, SHAPE_MIN_HEIGHT)
          : bounds
      );
    };

    const onUp = () => setResizeState(null);

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [resizeState, getBoardPoint, updateItem]);

  useEffect(() => {
    if (!dragState) return undefined;

    const onMove = (event) => {
      const point = getBoardPoint(event.clientX, event.clientY);
      const newX = Math.max(0, point.x - dragState.offsetX);
      const newY = Math.max(0, point.y - dragState.offsetY);

      if (dragState.groupIds) {
        const dx = newX - dragState.startX;
        const dy = newY - dragState.startY;
        setItems((prev) =>
          syncArrowConnections(
            prev.map((item) => {
              if (!dragState.groupIds.includes(item.id)) return item;
              const initial = dragState.initialPositions[item.id];
              if (initial.linearPoints) {
                const anchor = snapPointToGrid({
                  x: initial.linearPoints.x1 + dx,
                  y: initial.linearPoints.y1 + dy,
                });
                const snapDx = anchor.x - initial.linearPoints.x1;
                const snapDy = anchor.y - initial.linearPoints.y1;
                return {
                  ...item,
                  connectFrom: null,
                  connectTo: null,
                  ...patchLinearItemFromPoints(
                    initial.linearPoints.x1 + snapDx,
                    initial.linearPoints.y1 + snapDy,
                    initial.linearPoints.x2 + snapDx,
                    initial.linearPoints.y2 + snapDy
                  ),
                };
              }
              return {
                ...item,
                ...(isWireframeShape(item)
                  ? snapWireframeBounds(
                      {
                        x: Math.max(0, initial.x + dx),
                        y: Math.max(0, initial.y + dy),
                        width: item.width,
                        height: item.height,
                      },
                      SHAPE_MIN_WIDTH,
                      SHAPE_MIN_HEIGHT
                    )
                  : {
                      x: Math.max(0, initial.x + dx),
                      y: Math.max(0, initial.y + dy),
                    }),
              };
            })
          )
        );
        return;
      }

      if (dragState.linearPoints) {
        const dx = newX - dragState.startX;
        const dy = newY - dragState.startY;
        const anchor = snapPointToGrid({
          x: dragState.linearPoints.x1 + dx,
          y: dragState.linearPoints.y1 + dy,
        });
        const snapDx = anchor.x - dragState.linearPoints.x1;
        const snapDy = anchor.y - dragState.linearPoints.y1;
        updateItem(dragState.id, {
          ...patchLinearItemFromPoints(
            dragState.linearPoints.x1 + snapDx,
            dragState.linearPoints.y1 + snapDy,
            dragState.linearPoints.x2 + snapDx,
            dragState.linearPoints.y2 + snapDy
          ),
          connectFrom: null,
          connectTo: null,
        });
        return;
      }

      const draggedItem = itemsRef.current.find((entry) => entry.id === dragState.id);
      if (draggedItem?.shape === "wireframe") {
        updateItem(
          dragState.id,
          snapWireframeBounds(
            {
              x: newX,
              y: newY,
              width: draggedItem.width,
              height: draggedItem.height,
            },
            SHAPE_MIN_WIDTH,
            SHAPE_MIN_HEIGHT
          )
        );
        return;
      }

      updateItem(dragState.id, { x: newX, y: newY });
    };

    const onUp = () => setDragState(null);

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragState, getBoardPoint, updateItem]);

  useEffect(() => {
    if (!panState) return undefined;

    const onMove = (event) => {
      if (panState.mode === "pending") {
        const dx = event.clientX - panState.startX;
        const dy = event.clientY - panState.startY;
        if (Math.hypot(dx, dy) < 5) return;

        commitTextEdit();
        setSelectedIds([]);
        suppressNextClickRef.current = true;
        setPanState({
          mode: "panning",
          startX: panState.startX,
          startY: panState.startY,
          startViewportX: panState.startViewportX,
          startViewportY: panState.startViewportY,
        });
        return;
      }

      setViewport((current) => ({
        ...current,
        x: panState.startViewportX + (event.clientX - panState.startX),
        y: panState.startViewportY + (event.clientY - panState.startY),
      }));
    };

    const onUp = () => {
      if (panState.mode === "panning") {
        suppressNextClickRef.current = true;
      } else if (panState.mode === "pending") {
        clearSelection();
      }
      setPanState(null);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [panState, clearSelection]);

  useEffect(() => {
    const viewportEl = viewportRef.current;
    if (!viewportEl) return undefined;

    const onWheel = (event) => {
      const noteScrollEl = event.target.closest("[data-sticky-note-scroll]");
      if (noteScrollEl && isStickyNoteScrollable(noteScrollEl)) {
        return;
      }

      const shapeTextScrollEl = event.target.closest("[data-shape-text-scroll]");
      if (shapeTextScrollEl && isScrollableElement(shapeTextScrollEl)) {
        return;
      }

      event.preventDefault();

      const rect = viewportEl.getBoundingClientRect();
      const pointerX = event.clientX - rect.left;
      const pointerY = event.clientY - rect.top;

      setViewport((current) => {
        const nextScale = clampZoom(current.scale * (1 - event.deltaY * ZOOM_WHEEL_SENSITIVITY));
        if (nextScale === current.scale) return current;

        const scaleRatio = nextScale / current.scale;
        return {
          scale: nextScale,
          x: pointerX - (pointerX - current.x) * scaleRatio,
          y: pointerY - (pointerY - current.y) * scaleRatio,
        };
      });
    };

    viewportEl.addEventListener("wheel", onWheel, { passive: false });
    return () => viewportEl.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (shouldUseNativeTextShortcut(event)) return;

      const isMod = event.metaKey || event.ctrlKey;

      if (isMod && event.key === "Escape") {
        event.preventDefault();
        clearSelection();
        return;
      }

      if (isMod && !event.shiftKey && event.code === "KeyZ") {
        event.preventDefault();
        undoItems();
        return;
      }

      if (isMod && event.code === "KeyC") {
        if (!selectedIds.length) return;
        event.preventDefault();
        copySelectedItems();
        return;
      }

      if (isMod && event.code === "KeyV") {
        if (!clipboardRef.current?.length) return;
        event.preventDefault();
        pasteClipboardItems();
        return;
      }

      if (isMod && event.code === "KeyX") {
        if (!selectedIds.length) return;
        event.preventDefault();
        cutSelectedItems();
        return;
      }

      if (isMod && event.code === "KeyA") {
        if (!isWhiteboardShortcutContext(event, viewportRef.current)) return;
        event.preventDefault();
        clearDocumentSelection();
        selectAllItems();
        return;
      }

      if (event.key === "Escape" && itemContextMenu) {
        event.preventDefault();
        closeItemContextMenu();
        return;
      }

      if (event.key === "Escape" && editingId) {
        event.preventDefault();
        exitActiveEditMode();
        return;
      }

      if (
        event.altKey &&
        event.shiftKey &&
        !event.metaKey &&
        !event.ctrlKey &&
        event.code === "KeyI"
      ) {
        event.preventDefault();
        openImageUpload();
        return;
      }

      if (!selectedIds.length) return;
      if (editingId && event.key !== "Delete") {
        return;
      }

      if (
        !editingId &&
        isMod &&
        !event.shiftKey &&
        (event.code === "BracketRight" || event.code === "BracketLeft")
      ) {
        event.preventDefault();
        if (event.code === "BracketRight") {
          moveSelectedForward();
        } else {
          moveSelectedBackward();
        }
        return;
      }

      if (event.key === "Delete") {
        if (editingId) return;
        event.preventDefault();
        removeSelectedItems();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    selectedIds,
    editingId,
    itemContextMenu,
    removeSelectedItems,
    exitActiveEditMode,
    closeItemContextMenu,
    moveSelectedForward,
    moveSelectedBackward,
    openImageUpload,
    undoItems,
    copySelectedItems,
    pasteClipboardItems,
    cutSelectedItems,
    selectAllItems,
    clearSelection,
  ]);

  useEffect(() => {
    if (!itemContextMenu) return undefined;

    const onPointerDown = (event) => {
      if (event.target.closest("[data-item-context-menu]")) return;
      closeItemContextMenu();
    };

    const onScroll = () => closeItemContextMenu();

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [itemContextMenu, closeItemContextMenu]);

  useLayoutEffect(() => {
    const viewportEl = viewportRef.current;
    if (!viewportEl) return;
    setViewport(getCenteredViewport(viewportEl, 1));
  }, []);

  useLayoutEffect(() => {
    const id = pendingFocusRef.current;
    if (!id) return;
    focusTextEditorNow(id);
  }, [editingId, focusTextEditorNow]);

  useLayoutEffect(() => {
    if (!editingId) return;
    const item = itemsRef.current.find((entry) => entry.id === editingId && entry.type === "shape");
    if (!item) return;
    if (item.content?.length) {
      syncShapeItemBounds(item);
    }
    const el = textEditorRefs.current.get(editingId);
    if (el) {
      requestAnimationFrame(() => syncShapeTextareaView(el));
    }
  }, [editingId, syncShapeItemBounds]);

  useLayoutEffect(() => {
    if (!editingId) return;
    const item = items.find((entry) => entry.id === editingId && entry.type === "shape");
    if (!item) return;
    const el = textEditorRefs.current.get(editingId);
    if (!el) return;
    syncShapeTextareaView(el);
  }, [
    editingId,
    items
      .filter((item) => item.type === "shape" && item.id === editingId)
      .map((item) =>
        [item.width, item.height, item.fontSize, item.fontFamily, item.bold, item.italic, item.content?.length].join(":")
      )
      .join("|"),
  ]);

  useLayoutEffect(() => {
    for (const item of items) {
      if (item.type !== "text" || item.id === editingId) continue;
      syncTextItemBounds(item);
    }
  }, [
    editingId,
    items
      .filter((item) => item.type === "text")
      .map((item) =>
        [item.id, item.content, item.fontFamily, item.fontSize, item.textColor, item.bold, item.italic, item.underline].join(":")
      )
      .join("|"),
    syncTextItemBounds,
  ]);

  useLayoutEffect(() => {
    for (const item of items) {
      if (item.type !== "shape" || item.id === editingId || !item.content?.length) continue;
      syncShapeItemBounds(item);
    }
  }, [
    editingId,
    items
      .filter((item) => item.type === "shape")
      .map((item) =>
        [item.id, item.content, item.fontFamily, item.fontSize, item.textColor, item.bold, item.italic, item.width, item.height].join(":")
      )
      .join("|"),
    syncShapeItemBounds,
  ]);

  const boardCursor = isMarqueeSelecting
    ? "crosshair"
    : rotateState
      ? "grabbing"
      : resizeState
        ? "grabbing"
        : panState?.mode === "panning"
        ? "grabbing"
        : tool === "note"
          ? "crosshair"
          : tool === "text"
            ? "text"
            : tool === "shape"
              ? "crosshair"
              : "grab";

  const selectionBoxRect = selectionBoxVisual ? getSelectionBoxRect(selectionBoxVisual) : null;
  const isBoardManipulating = Boolean(
    dragState ||
      rotateState ||
      resizeState ||
      linearEndpointState ||
      linearPlacementVisual ||
      isMarqueeSelecting ||
      panState
  );

  const zoomPercent = Math.round(viewport.scale * 100);
  const selectedNotes = selectedItems.filter((item) => item.type === "note");
  const selectedShapes = selectedItems.filter((item) => item.type === "shape");
  const activeStickyColor =
    selectedNotes.length === 1 ? selectedNotes[0].color : stickyColor;
  const activeShapeKind =
    selectedShapes.length === 1 ? selectedShapes[0].shape : shapeKind;
  const handleStickyColorChange = useCallback(
    (colorId) => {
      setStickyColor(colorId);
      if (selectedNotes.length) {
        selectedNotes.forEach((note) => updateItem(note.id, { color: colorId }));
        return;
      }
    },
    [selectedNotes, updateItem]
  );

  const handleShapeKindChange = useCallback(
    (shapeId) => {
      setShapeKind(shapeId);
      if (selectedShapes.length) {
        selectedShapes.forEach((shape) => updateItem(shape.id, { shape: shapeId }));
      }
    },
    [selectedShapes, updateItem]
  );

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col">
      <div className="mb-4 overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-base font-bold text-slate-800">
              <Sparkles className="h-5 w-5" />
              Dreamboard
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
              <button
                type="button"
                onClick={activateSelectTool}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition",
                  tool === "select" ? ACTIVE_TOOL_CLASS : "text-slate-600 hover:bg-slate-50"
                )}
              >
                <MousePointer2 className="h-3.5 w-3.5" />
                Select
              </button>
              <button
                type="button"
                onClick={activateStickyNoteTool}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition",
                  tool === "note" ? ACTIVE_TOOL_CLASS : "text-slate-600 hover:bg-slate-50"
                )}
              >
                <StickyNote className="h-3.5 w-3.5" />
                Sticky note
              </button>
              <button
                type="button"
                onClick={activateTextTool}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition",
                  tool === "text" ? ACTIVE_TOOL_CLASS : "text-slate-600 hover:bg-slate-50"
                )}
              >
                <Type className="h-3.5 w-3.5" />
                Type
              </button>
              <button
                type="button"
                onClick={activateShapeTool}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition",
                  tool === "shape" ? ACTIVE_TOOL_CLASS : "text-slate-600 hover:bg-slate-50"
                )}
              >
                <Shapes className="h-3.5 w-3.5" />
                Shapes
              </button>
            </div>

            {selectedIds.length ? (
              <button
                type="button"
                onClick={removeSelectedItems}
                aria-label={
                  selectedIds.length > 1
                    ? `Delete ${selectedIds.length} selected items`
                    : "Delete selected item"
                }
                title={
                  selectedIds.length > 1
                    ? `Delete ${selectedIds.length} selected items`
                    : "Delete selected item"
                }
                className="inline-flex items-center justify-center rounded-xl border border-red-200 bg-red-50 p-2 text-red-700 transition hover:bg-red-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div
        ref={viewportRef}
        tabIndex={-1}
        className="relative min-h-[calc(100vh-14rem)] overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm outline-none"
        style={{ cursor: boardCursor }}
        onPointerDownCapture={handleViewportPointerDownCapture}
        onPointerDown={handleBoardPointerDown}
        onClick={handleBoardClick}
      >
        {tool === "note" ? (
          <div
            data-dreamboard-chrome
            className="pointer-events-none absolute inset-x-0 top-4 z-20 flex justify-center px-4"
          >
            <StickyColorPopup
              selectedColor={activeStickyColor}
              onColorChange={handleStickyColorChange}
            />
          </div>
        ) : null}

        {tool === "shape" ? (
          <div
            data-dreamboard-chrome
            className="pointer-events-none absolute inset-x-0 top-4 z-20 flex justify-center px-4"
          >
            <ShapeToolPopup
              selectedShape={activeShapeKind}
              onShapeChange={handleShapeKindChange}
            />
          </div>
        ) : null}

        <div data-dreamboard-chrome className="pointer-events-none absolute top-3 right-3 z-20">
          <DreamboardShareMenu onExportPdf={handleExportPdf} exportBusy={Boolean(loading?.isLoading)} />
        </div>

        <div
          ref={canvasRef}
          data-dreamboard-canvas
          className="absolute left-0 top-0 origin-top-left bg-white"
          style={{
            width: BOARD_CANVAS_SIZE,
            height: BOARD_CANVAS_SIZE,
            transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
            backgroundImage: "radial-gradient(circle, #e2e8f0 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        >
        <div
          data-dreamboard-watermark
          className="pointer-events-none absolute z-0"
          style={{
            left: BOARD_CANVAS_SIZE / 2,
            top: BOARD_CANVAS_SIZE / 2,
            transform: "translate(-50%, -50%)",
          }}
          aria-hidden="true"
        >
          <img
            src={LOGO_URL}
            alt=""
            draggable={false}
            className="max-w-[720px] select-none opacity-[0.05]"
          />
        </div>
        {selectionBoxRect ? (
          <div
            data-export-hide
            className={cn("pointer-events-none absolute z-[9999]", MARQUEE_BOX_CLASS)}
            style={{
              left: selectionBoxRect.left,
              top: selectionBoxRect.top,
              width: selectionBoxRect.width,
              height: selectionBoxRect.height,
            }}
          />
        ) : null}
        {linearPlacementVisual ? (() => {
          const connectTo = linearPlacementVisual.snapTarget
            ? {
                itemId: linearPlacementVisual.snapTarget.itemId,
                anchor: linearPlacementVisual.snapTarget.anchor,
              }
            : null;
          const previewPatch = linearPlacementVisual.connectFrom
            ? buildWireConnectorPreview({
                connectFrom: linearPlacementVisual.connectFrom,
                connectTo,
                startPoint: {
                  x: linearPlacementVisual.startX,
                  y: linearPlacementVisual.startY,
                },
                endPoint: {
                  x: linearPlacementVisual.currentX,
                  y: linearPlacementVisual.currentY,
                },
                items,
              })
            : patchLinearItemFromPoints(
                linearPlacementVisual.startX,
                linearPlacementVisual.startY,
                linearPlacementVisual.currentX,
                linearPlacementVisual.currentY
              );
          const previewItem = {
            shape: linearPlacementVisual.shape,
            fillColor: DEFAULT_SHAPE_FILL,
            strokeWidth: LINE_STROKE_WIDTH,
            connectFrom: linearPlacementVisual.connectFrom ?? null,
            connectTo,
            ...previewPatch,
          };
          return (
            <div
              data-export-hide
              className="pointer-events-none absolute z-[9998]"
              style={{
                left: previewItem.x,
                top: previewItem.y,
                width: previewItem.width,
                height: previewItem.height,
              }}
            >
              <DreamboardShapeSvg item={previewItem} />
            </div>
          );
        })() : null}
        {[...items]
          .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
          .map((item) => {
          const isSelected = selectedIds.includes(item.id);
          const isEditing = editingId === item.id;

          if (item.type === "text") {
            const textStyleProps = getTextStyleProps(item);

            return (
              <div
                key={item.id}
                data-item-id={item.id}
                className={cn(
                  "absolute overflow-visible rounded-sm px-1 py-0.5",
                  itemPointerEventsPassThrough(item) && "pointer-events-none",
                  !isEditing && "transition-[box-shadow,width,height]",
                  isSelected && !isEditing && !isBoardManipulating && SELECTION_RING_CLASS,
                  isEditing && "pointer-events-auto",
                  isItemDragging(item.id) ? "cursor-grabbing" : isEditing ? "cursor-text" : "cursor-grab"
                )}
                style={{
                  left: item.x,
                  top: item.y,
                  width: isEditing ? "max-content" : item.width,
                  maxWidth: isEditing ? 800 : undefined,
                  minWidth: isEditing ? TEXT_MIN_WIDTH : undefined,
                  height: isEditing ? "auto" : item.height,
                  zIndex: item.zIndex,
                  boxSizing: "border-box",
                }}
                onPointerDown={(event) => handleTextPointerDown(event, item)}
                onContextMenu={(event) => openItemContextMenu(event, item)}
                onDoubleClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  beginTextEditing(item);
                }}
              >
                {(isSelected || isEditing) &&
                !isBoardManipulating &&
                !isItemDragging(item.id) &&
                (isEditing || selectedIds.length === 1) ? (
                  <TextFormatPopup
                    item={item}
                    scale={viewport.scale}
                    onFormatChange={updateTextFormat}
                  />
                ) : null}
                {isEditing ? (
                  <textarea
                    key={`edit-${item.id}`}
                    ref={(node) => setTextEditorRef(item.id, node)}
                    data-editable
                    defaultValue={item.content}
                    placeholder="Type here"
                    onPointerDown={(event) => event.stopPropagation()}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        event.preventDefault();
                        exitActiveEditMode();
                      }
                    }}
                    onInput={(event) => {
                      if (pendingTextPlacementRef.current === item.id) {
                        pendingTextPlacementRef.current = null;
                      }
                      autoResizeTextarea(event.target);
                    }}
                    onBlur={() => {
                      requestAnimationFrame(() => {
                        if (pendingTextPlacementRef.current === item.id) return;
                        if (editingIdRef.current !== item.id) return;
                        if (document.activeElement?.closest("[data-text-format-popup]")) return;
                        exitActiveEditMode();
                      });
                    }}
                    onFocus={() => {
                      selectSingleItem(item.id);
                      setEditingId(item.id);
                    }}
                    className="block min-w-[24px] max-w-[792px] cursor-text resize-none overflow-hidden border-none bg-transparent p-0 leading-[1.35] outline-none placeholder:font-normal placeholder:text-slate-400"
                    style={textStyleProps}
                    rows={1}
                  />
                ) : (
                  <div
                    className="h-full w-full whitespace-pre-wrap leading-[1.35] select-none"
                    style={textStyleProps}
                    onDoubleClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      beginTextEditing(item);
                    }}
                  >
                    {item.content}
                  </div>
                )}
              </div>
            );
          }

          if (item.type === "image") {
            return (
              <div
                key={item.id}
                data-item-id={item.id}
                className={cn(
                  "absolute overflow-hidden rounded-md",
                  itemPointerEventsPassThrough(item) && "pointer-events-none",
                  isSelected && !isBoardManipulating && SELECTION_RING_CLASS,
                  isItemDragging(item.id) ? "cursor-grabbing" : "cursor-grab"
                )}
                style={{
                  left: item.x,
                  top: item.y,
                  width: item.width,
                  height: item.height,
                  zIndex: item.zIndex,
                  transform: item.rotation ? `rotate(${item.rotation}deg)` : undefined,
                  transformOrigin: "center center",
                }}
                onPointerDown={(event) => startDrag(event, item)}
                onContextMenu={(event) => openItemContextMenu(event, item)}
              >
                <img
                  src={item.src}
                  alt={item.name || "Uploaded image"}
                  draggable={false}
                  className="pointer-events-none h-full w-full select-none object-contain"
                />
              </div>
            );
          }

          if (item.type === "shape") {
            const shapeTextStyleProps = getTextStyleProps(item);
            const isLinear = isLinearShape(item.shape);
            const linearTextContent = item.content ?? "";
            const showLinearEndpointHandles =
              isLinear &&
              isSelected &&
              selectedIds.length === 1 &&
              !isEditing &&
              !isBoardManipulating &&
              !isItemDragging(item.id) &&
              tool === "select";
            const isWireframeSelected =
              item.shape === "wireframe" &&
              isSelected &&
              selectedIds.length === 1 &&
              !isEditing &&
              !isBoardManipulating &&
              !isItemDragging(item.id) &&
              !isItemResizing(item.id) &&
              tool === "select";
            const showWireframeConnectionHandles = isWireframeSelected;
            const showWireframeTransformHandles = isWireframeSelected;
            const showResizeHandles =
              !isLinear &&
              isSelected &&
              selectedIds.length === 1 &&
              !isEditing &&
              !isBoardManipulating &&
              !isItemDragging(item.id) &&
              !isItemResizing(item.id) &&
              tool === "select";

            return (
              <div
                key={item.id}
                data-item-id={item.id}
                className={cn(
                  "absolute overflow-visible",
                  itemPointerEventsPassThrough(item) && "pointer-events-none",
                  isSelected &&
                    !isEditing &&
                    !isBoardManipulating &&
                    !isLinear &&
                    SELECTION_RING_CLASS,
                  isEditing && "pointer-events-auto",
                  isItemDragging(item.id) || isItemResizing(item.id) || linearEndpointState?.id === item.id
                    ? "cursor-grabbing"
                    : rotateState?.id === item.id
                      ? "cursor-grabbing"
                    : isEditing
                      ? "cursor-text"
                      : isLinear
                        ? "cursor-grab"
                        : "cursor-grab"
                )}
                style={{
                  left: item.x,
                  top: item.y,
                  width: item.width,
                  height: item.height,
                  zIndex: item.zIndex,
                  transform:
                    !isLinear && item.rotation ? `rotate(${item.rotation}deg)` : undefined,
                  transformOrigin: "center center",
                }}
                onPointerDown={(event) => {
                  if (event.target.closest("[data-shape-resize-handle]")) return;
                  if (event.target.closest("[data-linear-endpoint]")) return;
                  if (event.target.closest("[data-wireframe-anchor]")) return;
                  handleShapePointerDown(event, item);
                }}
                onContextMenu={(event) => openItemContextMenu(event, item)}
                onDoubleClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (item.shape === "wireframe") return;
                  beginShapeEditing(item);
                }}
              >
                {item.shape === "wireframe" && !isEditing ? (
                  <div className="absolute inset-0 z-[1] pointer-events-auto" aria-hidden="true" />
                ) : null}
                {isEditing &&
                !isBoardManipulating &&
                !isItemDragging(item.id) &&
                !isItemResizing(item.id) ? (
                  <ShapeFormatPopup
                    item={item}
                    scale={viewport.scale}
                    onFormatChange={updateShapeFormat}
                  />
                ) : null}
                <DreamboardShapeSvg item={item} maskContent={linearTextContent} />
                <div
                  className={cn(
                    "absolute inset-0 flex min-h-0 items-center justify-center overflow-visible",
                    isEditing ? "pointer-events-auto" : "pointer-events-none"
                  )}
                  style={{ padding: isLinear ? 0 : SHAPE_TEXT_PADDING }}
                >
                  <div className={cn("relative z-[2]", isLinear ? "w-max max-w-full" : "w-full")}>
                  {isEditing ? (
                    <textarea
                      key={`shape-edit-${item.id}`}
                      ref={(node) => setTextEditorRef(item.id, node)}
                      data-editable
                      data-shape-text-scroll
                      defaultValue={item.content}
                      placeholder="Type here"
                      onPointerDown={(event) => event.stopPropagation()}
                      onInput={(event) => handleShapeInput(event, item.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          requestAnimationFrame(() => syncShapeTextareaView(event.currentTarget));
                        }
                        if (event.key === "Escape") {
                          event.preventDefault();
                          exitActiveEditMode();
                        }
                      }}
                      onBlur={() => {
                        requestAnimationFrame(() => {
                          if (editingIdRef.current !== item.id) return;
                          if (document.activeElement?.closest("[data-shape-format-popup]")) return;
                          exitActiveEditMode();
                        });
                      }}
                      onFocus={() => {
                        selectSingleItem(item.id);
                        setEditingId(item.id);
                      }}
                      className={cn(
                        "shape-text-scroll block min-h-[1.35em] cursor-text resize-none border-none bg-transparent p-0 text-center leading-[1.35] outline-none placeholder:font-normal placeholder:text-slate-400",
                        isLinear ? "w-max max-w-full" : "w-full"
                      )}
                      style={shapeTextStyleProps}
                    />
                  ) : item.content ? (
                    <div
                      className={cn(
                        "whitespace-pre-wrap text-center leading-[1.35] select-none",
                        isLinear ? "w-max max-w-full" : "w-full"
                      )}
                      style={shapeTextStyleProps}
                    >
                      {item.content}
                    </div>
                  ) : null}
                  </div>
                </div>
                {showWireframeTransformHandles ? (
                  <NoteCornerHandles
                    isEditing={false}
                    onRotateStart={(event) => startNoteRotate(event, item)}
                  />
                ) : null}
                {showWireframeConnectionHandles ? (
                  <WireframeConnectionHandles
                    item={item}
                    scale={viewport.scale}
                    onConnectionStart={(event, anchor) =>
                      startWireframeConnection(event, item, anchor)
                    }
                  />
                ) : null}
                {showLinearEndpointHandles ? (
                  <LinearEndpointHandles
                    item={item}
                    scale={viewport.scale}
                    onEndpointStart={(event, endpoint) =>
                      startLinearEndpointDrag(event, item, endpoint)
                    }
                  />
                ) : null}
                {showResizeHandles ? (
                  <ShapeResizeHandles
                    handleIds={
                      item.shape === "wireframe" ? [...WIREFRAME_CORNER_HANDLES] : null
                    }
                    onResizeStart={(event, handle) => startShapeResize(event, item, handle)}
                  />
                ) : null}
              </div>
            );
          }

          const palette = getStickyColor(item.color);

          return (
            <div
              key={item.id}
              data-item-id={item.id}
              className={cn(
                "group/note absolute",
                itemPointerEventsPassThrough(item) && "pointer-events-none",
                isSelected && !isEditing && !isBoardManipulating && SELECTION_RING_CLASS,
                isEditing && "pointer-events-auto",
                rotateState?.id === item.id && "cursor-grabbing",
                isItemDragging(item.id) && "cursor-grabbing"
              )}
              style={{
                left: item.x,
                top: item.y,
                width: item.width,
                height: item.height,
                zIndex: item.zIndex,
                transform: `rotate(${item.rotation || 0}deg)`,
                transformOrigin: "center center",
              }}
              onPointerDown={(event) => {
                if (event.target.closest("button")) return;
                if (event.target.closest("[data-editable]")) {
                  if (!isEditing) beginNoteEditing(item);
                  return;
                }
                startDrag(event, item);
              }}
              onContextMenu={(event) => openItemContextMenu(event, item)}
            >
              <StickyNoteBody
                noteId={item.id}
                palette={palette}
                isDragging={isItemDragging(item.id)}
                onDoubleClick={(event) => {
                  event.stopPropagation();
                  beginNoteEditing(item);
                }}
                header={
                  <div
                    className="flex shrink-0 items-center justify-between border-b border-black/[0.06] px-2 py-1"
                    style={{
                      background: `linear-gradient(to bottom, ${palette.border}55, ${palette.border}22)`,
                      boxShadow: "inset 0 -1px 0 rgba(255,255,255,0.35)",
                    }}
                  >
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-slate-600/80">
                        Note
                      </span>
                      <NoteMoveToTasksButton onClick={() => sendNoteToTasks(item)} />
                    </div>
                    <span className="text-[10px] text-slate-500">Drag to move</span>
                  </div>
                }
              >
                <textarea
                  ref={(node) => setTextEditorRef(item.id, node)}
                  data-editable
                  data-sticky-note-scroll
                  data-editing={isEditing ? "true" : undefined}
                  value={item.content}
                  placeholder="Write your idea..."
                  onChange={(event) => handleNoteInput(event, item.id)}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    if (!isEditing) beginNoteEditing(item);
                  }}
                  onFocus={() => {
                    selectSingleItem(item.id);
                    setEditingId(item.id);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.preventDefault();
                      event.stopPropagation();
                      event.currentTarget.blur();
                    }
                  }}
                  onBlur={(event) => handleNoteBlur(event, item.id)}
                  className={cn(
                    "sticky-note-scroll min-h-0 flex-1 resize-none border-none bg-transparent px-2.5 py-2 text-sm leading-relaxed text-slate-800 outline-none",
                    isEditing ? "cursor-text" : "cursor-grab select-none"
                  )}
                  style={{ fontFamily: getTextFont(item.fontFamily).stack }}
                />
              </StickyNoteBody>
              <NoteCornerHandles
                isEditing={isEditing}
                onRotateStart={(event) => startNoteRotate(event, item)}
              />
            </div>
          );
        })}

        {items.length === 0 ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
            <div className="max-w-md rounded-2xl border border-dashed border-slate-200 bg-white/80 px-6 py-8 text-center backdrop-blur-sm">
              <StickyNote className="mx-auto mb-3 h-8 w-8 text-violet-400" />
              <p className="text-sm font-semibold text-slate-700">Your whiteboard is empty</p>
              <p className="mt-1 text-xs text-slate-500">
                Choose <strong>Sticky note</strong> or <strong>Type</strong>, then click anywhere on
                the board to add content, or use <strong>Upload image</strong> below.
              </p>
            </div>
          </div>
        ) : null}
        </div>

        <div data-dreamboard-chrome className="pointer-events-none absolute bottom-3 left-3 z-20">
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageUpload}
          />
          <button
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={openImageUpload}
            title="Upload image (Alt+Shift+I)"
            className="pointer-events-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-[11px] font-semibold text-slate-700 shadow-sm backdrop-blur-sm transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-800"
          >
            <ImagePlus className="h-3.5 w-3.5" />
            Upload image
          </button>
        </div>

        <div data-dreamboard-chrome className="pointer-events-none absolute bottom-3 right-3 z-20">
          <button
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={resetViewportZoom}
            title="Reset zoom to 100%"
            className="pointer-events-auto rounded-lg border border-slate-200 bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-slate-600 shadow-sm backdrop-blur-sm transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-800"
          >
            {zoomPercent}%
          </button>
        </div>
      </div>

      <ItemContextMenu
        menu={itemContextMenu}
        onDuplicate={duplicateSelectedItems}
        onMoveForward={moveItemForward}
        onMoveBackward={moveItemBackward}
        onClose={closeItemContextMenu}
      />
    </div>
  );
}
