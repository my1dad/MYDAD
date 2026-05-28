export const LINE_STROKE_WIDTH = 2;
export const LINE_ENDPOINT_PADDING = 8;
export const LINE_TEXT_MASK_PADDING = 4;
export const MIN_LINEAR_LENGTH = 32;
export const LINE_MIN_WIDTH = 48;
export const LINE_MIN_HEIGHT = 12;

export const LINEAR_SHAPE_IDS = new Set(["line", "arrow"]);

export const WIREFRAME_ANCHORS = ["top", "right", "bottom", "left"];
export const BOARD_GRID_SIZE = 24;
export const WIRE_STUB_LENGTH = BOARD_GRID_SIZE;
export const CONNECTION_SNAP_RADIUS = 48;
export const WIRE_CORNER_RADIUS = 12;

export function isWireConnector(item) {
  return (
    item?.type === "shape" &&
    item.shape === "arrow" &&
    Boolean(item.connectFrom || item.connectTo)
  );
}

export function isLinearShape(shape) {
  return LINEAR_SHAPE_IDS.has(shape);
}

export function isWireframeShape(item) {
  return item?.type === "shape" && item.shape === "wireframe";
}

export function snapToGrid(value, gridSize = BOARD_GRID_SIZE) {
  return Math.round(value / gridSize) * gridSize;
}

export function snapPointToGrid(point, gridSize = BOARD_GRID_SIZE) {
  return {
    x: snapToGrid(point.x, gridSize),
    y: snapToGrid(point.y, gridSize),
  };
}

export function snapWireframeBounds(
  bounds,
  minWidth = 48,
  minHeight = 48,
  gridSize = BOARD_GRID_SIZE
) {
  return {
    x: Math.max(0, snapToGrid(bounds.x, gridSize)),
    y: Math.max(0, snapToGrid(bounds.y, gridSize)),
    width: Math.max(minWidth, snapToGrid(bounds.width, gridSize)),
    height: Math.max(minHeight, snapToGrid(bounds.height, gridSize)),
  };
}

function snapOrthogonalRoute(points, gridSize = BOARD_GRID_SIZE) {
  if (!points?.length) return points;
  return simplifyCollinearPoints(points.map((point) => snapPointToGrid(point, gridSize)));
}

export function normalizeConnectionRef(ref, wireframeIds) {
  if (!ref?.itemId || !WIREFRAME_ANCHORS.includes(ref.anchor)) return null;
  if (!wireframeIds.has(ref.itemId)) return null;
  return { itemId: ref.itemId, anchor: ref.anchor };
}

export function getWireframeAxisBounds(item) {
  const extraBottom = 0;

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

function isPointNearWireframe(item, point, padding) {
  const bounds = getWireframeAxisBounds(item);
  return (
    point.x >= bounds.left - padding &&
    point.x <= bounds.left + bounds.width + padding &&
    point.y >= bounds.top - padding &&
    point.y <= bounds.top + bounds.height + padding
  );
}

export function getWireframeCenterPoint(item) {
  return {
    x: item.x + item.width / 2,
    y: item.y + item.height / 2,
  };
}

export function getWireframeAnchorForTarget(item, targetPoint) {
  const center = getWireframeCenterPoint(item);
  const radians = ((item.rotation || 0) * Math.PI) / 180;
  const cos = Math.cos(-radians);
  const sin = Math.sin(-radians);
  const dx = targetPoint.x - center.x;
  const dy = targetPoint.y - center.y;
  const localX = dx * cos - dy * sin;
  const localY = dx * sin + dy * cos;
  const halfW = Math.max(item.width / 2, 1);
  const halfH = Math.max(item.height / 2, 1);

  let anchor;
  if (Math.abs(localX) * halfH >= Math.abs(localY) * halfW) {
    anchor = localX >= 0 ? "right" : "left";
  } else {
    anchor = localY >= 0 ? "bottom" : "top";
  }

  return {
    anchor,
    point: getWireframeAnchorPoint(item, anchor),
  };
}

export function resolveWireframeConnectionAnchor(item, targetPoint) {
  return {
    itemId: item.id,
    anchor: getWireframeAnchorForTarget(item, targetPoint).anchor,
  };
}

export function getWireframeAnchorPoint(item, anchor) {
  const cx = item.x + item.width / 2;
  const cy = item.y + item.height / 2;
  let localX = 0;
  let localY = 0;

  if (anchor === "top") localY = -item.height / 2;
  else if (anchor === "right") localX = item.width / 2;
  else if (anchor === "bottom") localY = item.height / 2;
  else if (anchor === "left") localX = -item.width / 2;

  const radians = ((item.rotation || 0) * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  return {
    x: cx + localX * cos - localY * sin,
    y: cy + localX * sin + localY * cos,
  };
}

export function getWireframeAnchorPosition(item, anchor) {
  const cx = item.width / 2;
  const cy = item.height / 2;
  let localX = 0;
  let localY = 0;

  if (anchor === "top") localY = -item.height / 2;
  else if (anchor === "right") localX = item.width / 2;
  else if (anchor === "bottom") localY = item.height / 2;
  else if (anchor === "left") localX = -item.width / 2;

  const radians = ((item.rotation || 0) * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  return {
    left: cx + localX * cos - localY * sin,
    top: cy + localX * sin + localY * cos,
  };
}

export function findNearestWireframeAnchor(point, items, options = {}) {
  const { excludeId = null, snapRadius = CONNECTION_SNAP_RADIUS } = options;
  const edgeSnapRadius = snapRadius * 1.75;
  let best = null;
  let bestDistance = edgeSnapRadius;

  for (const item of items) {
    if (!isWireframeShape(item)) continue;
    if (item.id === excludeId) continue;

    if (!isPointNearWireframe(item, point, edgeSnapRadius)) continue;

    const { anchor, point: anchorPoint } = getWireframeAnchorForTarget(item, point);
    const distance = Math.hypot(point.x - anchorPoint.x, point.y - anchorPoint.y);
    if (distance <= bestDistance) {
      bestDistance = distance;
      best = {
        itemId: item.id,
        anchor,
        x: anchorPoint.x,
        y: anchorPoint.y,
      };
    }
  }

  return best;
}

function anchorNormal(anchor) {
  if (anchor === "top") return { x: 0, y: -1 };
  if (anchor === "bottom") return { x: 0, y: 1 };
  if (anchor === "left") return { x: -1, y: 0 };
  return { x: 1, y: 0 };
}

function isHorizontalAnchor(anchor) {
  return anchor === "left" || anchor === "right";
}

function dist(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function addPoint(a, b) {
  return { x: a.x + b.x, y: a.y + b.y };
}

function scalePoint(point, scale) {
  return { x: point.x * scale, y: point.y * scale };
}

function simplifyCollinearPoints(points) {
  if (points.length <= 2) return points;

  const simplified = [points[0]];
  for (let i = 1; i < points.length - 1; i += 1) {
    const prev = simplified[simplified.length - 1];
    const curr = points[i];
    const next = points[i + 1];
    const collinearX = Math.abs(prev.x - curr.x) < 0.5 && Math.abs(curr.x - next.x) < 0.5;
    const collinearY = Math.abs(prev.y - curr.y) < 0.5 && Math.abs(curr.y - next.y) < 0.5;
    if (!collinearX && !collinearY) {
      simplified.push(curr);
    }
  }
  simplified.push(points[points.length - 1]);
  return simplified;
}

function routeBetweenStubs(a, b, startAnchor, endAnchor, stub = WIRE_STUB_LENGTH) {
  if (dist(a, b) < 1) return [];

  if (startAnchor === endAnchor) {
    const n = anchorNormal(startAnchor);
    if (startAnchor === "top") {
      const y = Math.min(a.y, b.y) - stub;
      return [
        { x: a.x, y },
        { x: b.x, y },
      ];
    }
    if (startAnchor === "bottom") {
      const y = Math.max(a.y, b.y) + stub;
      return [
        { x: a.x, y },
        { x: b.x, y },
      ];
    }
    if (startAnchor === "left") {
      const x = Math.min(a.x, b.x) - stub;
      return [
        { x, y: a.y },
        { x, y: b.y },
      ];
    }
    const x = Math.max(a.x, b.x) + stub;
    return [
      { x, y: a.y },
      { x, y: b.y },
    ];
  }

  const fromHorizontal = isHorizontalAnchor(startAnchor);
  const toHorizontal = isHorizontalAnchor(endAnchor);

  if (fromHorizontal && toHorizontal) {
    if (Math.abs(a.y - b.y) < 0.5) return [];
    const midX = a.x + (b.x - a.x) / 2;
    return [
      { x: midX, y: a.y },
      { x: midX, y: b.y },
    ];
  }

  if (!fromHorizontal && !toHorizontal) {
    if (Math.abs(a.x - b.x) < 0.5) return [];
    const midY = a.y + (b.y - a.y) / 2;
    return [
      { x: a.x, y: midY },
      { x: b.x, y: midY },
    ];
  }

  if (fromHorizontal) {
    return [{ x: b.x, y: a.y }];
  }

  return [{ x: a.x, y: b.y }];
}

export function routeOrthogonalWire(start, startAnchor, end, endAnchor, stub = WIRE_STUB_LENGTH) {
  const startNormal = anchorNormal(startAnchor);
  const endNormal = anchorNormal(endAnchor);
  const startStub = addPoint(start, scalePoint(startNormal, stub));
  const endStub = addPoint(end, scalePoint(endNormal, -stub));
  const middle = routeBetweenStubs(startStub, endStub, startAnchor, endAnchor, stub);
  return snapOrthogonalRoute(simplifyCollinearPoints([start, startStub, ...middle, endStub, end]));
}

export function routeWireFromAnchorToPoint(start, startAnchor, end, stub = WIRE_STUB_LENGTH) {
  const startNormal = anchorNormal(startAnchor);
  const startStub = addPoint(start, scalePoint(startNormal, stub));

  if (isHorizontalAnchor(startAnchor)) {
    return snapOrthogonalRoute(
      simplifyCollinearPoints([
        start,
        startStub,
        { x: end.x, y: startStub.y },
        end,
      ])
    );
  }

  return snapOrthogonalRoute(
    simplifyCollinearPoints([
      start,
      startStub,
      { x: startStub.x, y: end.y },
      end,
    ])
  );
}

export function routeWireFromPointToAnchor(start, end, endAnchor, stub = WIRE_STUB_LENGTH) {
  const endNormal = anchorNormal(endAnchor);
  const endStub = addPoint(end, scalePoint(endNormal, -stub));

  if (isHorizontalAnchor(endAnchor)) {
    return snapOrthogonalRoute(
      simplifyCollinearPoints([
        start,
        { x: endStub.x, y: start.y },
        endStub,
        end,
      ])
    );
  }

  return snapOrthogonalRoute(
    simplifyCollinearPoints([
      start,
      { x: start.x, y: endStub.y },
      endStub,
      end,
    ])
  );
}

export function resolveWireRouteForItem(item, itemsById) {
  const points = resolveLinearPoints(item);
  let start = { x: points.x1, y: points.y1 };
  let end = { x: points.x2, y: points.y2 };

  if (item.connectTo) {
    const target = itemsById[item.connectTo.itemId];
    if (isWireframeShape(target)) {
      end = getWireframeAnchorPoint(target, item.connectTo.anchor);
    }
  } else {
    end = snapPointToGrid(end);
  }

  if (item.connectFrom) {
    const source = itemsById[item.connectFrom.itemId];
    if (isWireframeShape(source)) {
      start = getWireframeAnchorPoint(source, item.connectFrom.anchor);
    }
  } else {
    start = snapPointToGrid(start);
  }

  if (item.connectFrom && item.connectTo) {
    return routeOrthogonalWire(
      start,
      item.connectFrom.anchor,
      end,
      item.connectTo.anchor
    );
  }

  if (item.connectFrom) {
    return routeWireFromAnchorToPoint(start, item.connectFrom.anchor, end);
  }

  if (item.connectTo) {
    return routeWireFromPointToAnchor(start, end, item.connectTo.anchor);
  }

  return [start, end];
}

export function patchConnectorFromRoute(routePoints) {
  if (!routePoints?.length) {
    return patchLinearItemFromPoints(0, 0, 0, 0);
  }

  const xs = routePoints.map((point) => point.x);
  const ys = routePoints.map((point) => point.y);
  const pad = LINE_ENDPOINT_PADDING + WIRE_CORNER_RADIUS;
  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad;
  const maxX = Math.max(...xs) + pad;
  const maxY = Math.max(...ys) + pad;
  const first = routePoints[0];
  const last = routePoints[routePoints.length - 1];

  return {
    x: Math.max(0, minX),
    y: Math.max(0, minY),
    width: Math.max(LINE_MIN_WIDTH, maxX - minX),
    height: Math.max(LINE_MIN_HEIGHT, maxY - minY),
    lineStartX: first.x,
    lineStartY: first.y,
    lineEndX: last.x,
    lineEndY: last.y,
    wireRoutePoints: routePoints.map((point) => ({
      x: point.x - minX,
      y: point.y - minY,
    })),
    rotation: 0,
  };
}

export function toLocalWireRoute(item, routePoints = item.wireRoutePoints) {
  if (!routePoints?.length) return [];
  return routePoints.map((point) => ({
    x: point.x,
    y: point.y,
  }));
}

export function buildSmoothWirePathD(points, radius = WIRE_CORNER_RADIUS) {
  if (!points?.length) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  let d = `M ${points[0].x} ${points[0].y}`;

  for (let i = 1; i < points.length - 1; i += 1) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];
    const inLen = dist(prev, curr);
    const outLen = dist(curr, next);
    if (inLen < 0.5 || outLen < 0.5) continue;

    const cornerRadius = Math.min(radius, inLen / 2, outLen / 2);
    const inUx = (curr.x - prev.x) / inLen;
    const inUy = (curr.y - prev.y) / inLen;
    const outUx = (next.x - curr.x) / outLen;
    const outUy = (next.y - curr.y) / outLen;
    const beforeX = curr.x - inUx * cornerRadius;
    const beforeY = curr.y - inUy * cornerRadius;
    const afterX = curr.x + outUx * cornerRadius;
    const afterY = curr.y + outUy * cornerRadius;

    d += ` L ${beforeX} ${beforeY} Q ${curr.x} ${curr.y} ${afterX} ${afterY}`;
  }

  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

export function getWireArrowHead(points, headSize = 10) {
  if (!points || points.length < 2) return null;

  let tip = points[points.length - 1];
  let prev = points[points.length - 2];

  for (let i = points.length - 2; i >= 0; i -= 1) {
    if (dist(points[i], tip) > 0.5) {
      prev = points[i];
      break;
    }
  }

  const length = dist(prev, tip);
  if (length < 0.5) return null;

  const head = Math.max(6, Math.min(headSize, length * 0.42));
  const angle = Math.atan2(tip.y - prev.y, tip.x - prev.x);
  const headAngle = Math.PI / 7;

  return {
    tip,
    baseX: tip.x - (head * (tip.x - prev.x)) / length,
    baseY: tip.y - (head * (tip.y - prev.y)) / length,
    head,
    angle,
    headAngle,
    points: `${tip.x},${tip.y} ${tip.x - head * Math.cos(angle - headAngle)},${tip.y - head * Math.sin(angle - headAngle)} ${tip.x - head * Math.cos(angle + headAngle)},${tip.y - head * Math.sin(angle + headAngle)}`,
  };
}

export function traceSmoothWirePath(ctx, points, radius = WIRE_CORNER_RADIUS) {
  if (!points?.length) return;
  if (points.length === 1) {
    ctx.moveTo(points[0].x, points[0].y);
    return;
  }
  if (points.length === 2) {
    ctx.moveTo(points[0].x, points[0].y);
    ctx.lineTo(points[1].x, points[1].y);
    return;
  }

  ctx.moveTo(points[0].x, points[0].y);

  for (let i = 1; i < points.length - 1; i += 1) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];
    const inLen = dist(prev, curr);
    const outLen = dist(curr, next);
    if (inLen < 0.5 || outLen < 0.5) continue;

    const cornerRadius = Math.min(radius, inLen / 2, outLen / 2);
    const inUx = (curr.x - prev.x) / inLen;
    const inUy = (curr.y - prev.y) / inLen;
    const outUx = (next.x - curr.x) / outLen;
    const outUy = (next.y - curr.y) / outLen;

    ctx.lineTo(curr.x - inUx * cornerRadius, curr.y - inUy * cornerRadius);
    ctx.quadraticCurveTo(
      curr.x,
      curr.y,
      curr.x + outUx * cornerRadius,
      curr.y + outUy * cornerRadius
    );
  }

  const last = points[points.length - 1];
  ctx.lineTo(last.x, last.y);
}

export function drawWireRoute(ctx, routePoints, stroke, withArrow = true) {
  if (!routePoints?.length) return;

  const arrow = withArrow ? getWireArrowHead(routePoints) : null;
  const strokePoints =
    arrow && routePoints.length >= 2
      ? [...routePoints.slice(0, -1), { x: arrow.baseX, y: arrow.baseY }]
      : routePoints;

  ctx.strokeStyle = stroke;
  ctx.lineWidth = LINE_STROKE_WIDTH;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  traceSmoothWirePath(ctx, strokePoints);
  ctx.stroke();

  if (arrow) {
    ctx.fillStyle = stroke;
    ctx.beginPath();
    ctx.moveTo(arrow.tip.x, arrow.tip.y);
    ctx.lineTo(
      arrow.tip.x - arrow.head * Math.cos(arrow.angle - arrow.headAngle),
      arrow.tip.y - arrow.head * Math.sin(arrow.angle - arrow.headAngle)
    );
    ctx.lineTo(
      arrow.tip.x - arrow.head * Math.cos(arrow.angle + arrow.headAngle),
      arrow.tip.y - arrow.head * Math.sin(arrow.angle + arrow.headAngle)
    );
    ctx.closePath();
    ctx.fill();
  }
}

export function buildWireConnectorPreview({
  connectFrom = null,
  connectTo = null,
  startPoint,
  endPoint,
  items = [],
}) {
  const itemsById = Object.fromEntries(items.map((item) => [item.id, item]));
  let start = startPoint;
  let end = endPoint;

  if (connectFrom) {
    const source = itemsById[connectFrom.itemId];
    if (isWireframeShape(source)) {
      start = getWireframeAnchorPoint(source, connectFrom.anchor);
    }
  }

  if (connectTo) {
    const target = itemsById[connectTo.itemId];
    if (isWireframeShape(target)) {
      end = getWireframeAnchorPoint(target, connectTo.anchor);
    }
  }

  let route = [start, end];
  if (connectFrom && connectTo) {
    route = routeOrthogonalWire(start, connectFrom.anchor, end, connectTo.anchor);
  } else if (connectFrom) {
    route = routeWireFromAnchorToPoint(start, connectFrom.anchor, end);
  } else if (connectTo) {
    route = routeWireFromPointToAnchor(start, end, connectTo.anchor);
  }

  return patchConnectorFromRoute(route);
}

export function syncArrowConnections(items) {
  const wireframeIds = new Set(items.filter(isWireframeShape).map((item) => item.id));
  const itemsById = Object.fromEntries(items.map((item) => [item.id, item]));

  return items.map((item) => {
    if (item.type !== "shape" || item.shape !== "arrow") {
      return item;
    }

    let connectFrom = normalizeConnectionRef(item.connectFrom, wireframeIds);
    let connectTo = normalizeConnectionRef(item.connectTo, wireframeIds);

    if (!connectFrom && !connectTo) {
      if (item.connectFrom || item.connectTo || item.wireRoutePoints) {
        const { wireRoutePoints, ...rest } = item;
        return { ...rest, connectFrom: null, connectTo: null };
      }
      return item;
    }

    const linearPoints = resolveLinearPoints(item);

    if (connectFrom && connectTo) {
      const source = itemsById[connectFrom.itemId];
      const target = itemsById[connectTo.itemId];
      if (isWireframeShape(source) && isWireframeShape(target)) {
        connectFrom = resolveWireframeConnectionAnchor(source, getWireframeCenterPoint(target));
        connectTo = resolveWireframeConnectionAnchor(target, getWireframeCenterPoint(source));
      } else if (isWireframeShape(source)) {
        connectFrom = resolveWireframeConnectionAnchor(source, {
          x: linearPoints.x2,
          y: linearPoints.y2,
        });
      } else if (isWireframeShape(target)) {
        connectTo = resolveWireframeConnectionAnchor(target, {
          x: linearPoints.x1,
          y: linearPoints.y1,
        });
      }
    } else if (connectFrom) {
      const source = itemsById[connectFrom.itemId];
      if (isWireframeShape(source)) {
        connectFrom = resolveWireframeConnectionAnchor(source, {
          x: linearPoints.x2,
          y: linearPoints.y2,
        });
      }
    } else if (connectTo) {
      const target = itemsById[connectTo.itemId];
      if (isWireframeShape(target)) {
        connectTo = resolveWireframeConnectionAnchor(target, {
          x: linearPoints.x1,
          y: linearPoints.y1,
        });
      }
    }

    const route = resolveWireRouteForItem(
      { ...item, connectFrom, connectTo },
      itemsById
    );

    return {
      ...item,
      connectFrom,
      connectTo,
      ...patchConnectorFromRoute(route),
    };
  });
}

export function resolveLinearPoints(item) {
  if (
    Number.isFinite(item.lineStartX) &&
    Number.isFinite(item.lineStartY) &&
    Number.isFinite(item.lineEndX) &&
    Number.isFinite(item.lineEndY)
  ) {
    return {
      x1: item.lineStartX,
      y1: item.lineStartY,
      x2: item.lineEndX,
      y2: item.lineEndY,
    };
  }

  const cx = item.x + item.width / 2;
  const cy = item.y + item.height / 2;
  const halfLen = Math.max(
    MIN_LINEAR_LENGTH / 2,
    (item.width - LINE_ENDPOINT_PADDING * 2) / 2
  );
  const radians = ((item.rotation || 0) * Math.PI) / 180;
  return {
    x1: cx - halfLen * Math.cos(radians),
    y1: cy - halfLen * Math.sin(radians),
    x2: cx + halfLen * Math.cos(radians),
    y2: cy + halfLen * Math.sin(radians),
  };
}

export function normalizeLinearDragPoints(x1, y1, x2, y2) {
  const length = Math.hypot(x2 - x1, y2 - y1);
  if (length >= MIN_LINEAR_LENGTH) {
    return { x1, y1, x2, y2 };
  }

  if (length < 1) {
    return {
      x1,
      y1,
      x2: x1 + MIN_LINEAR_LENGTH,
      y2: y1,
    };
  }

  const scale = MIN_LINEAR_LENGTH / length;
  return {
    x1,
    y1,
    x2: x1 + (x2 - x1) * scale,
    y2: y1 + (y2 - y1) * scale,
  };
}

export function patchLinearItemFromPoints(x1, y1, x2, y2) {
  const points = normalizeLinearDragPoints(x1, y1, x2, y2);
  const minX = Math.min(points.x1, points.x2) - LINE_ENDPOINT_PADDING;
  const minY = Math.min(points.y1, points.y2) - LINE_ENDPOINT_PADDING;
  const maxX = Math.max(points.x1, points.x2) + LINE_ENDPOINT_PADDING;
  const maxY = Math.max(points.y1, points.y2) + LINE_ENDPOINT_PADDING;

  return {
    x: Math.max(0, minX),
    y: Math.max(0, minY),
    width: Math.max(LINE_MIN_WIDTH, maxX - minX),
    height: Math.max(LINE_MIN_HEIGHT, maxY - minY),
    lineStartX: points.x1,
    lineStartY: points.y1,
    lineEndX: points.x2,
    lineEndY: points.y2,
    rotation: 0,
  };
}

export function toLocalLinearPoints(item, points = resolveLinearPoints(item)) {
  return {
    x1: points.x1 - item.x,
    y1: points.y1 - item.y,
    x2: points.x2 - item.x,
    y2: points.y2 - item.y,
  };
}

export function shiftLinearItem(item, dx, dy) {
  const points = resolveLinearPoints(item);
  return patchLinearItemFromPoints(
    points.x1 + dx,
    points.y1 + dy,
    points.x2 + dx,
    points.y2 + dy
  );
}

export function getLinearAxisBounds(item) {
  if (item.wireRoutePoints?.length) {
    const xs = item.wireRoutePoints.map((point) => point.x + item.x);
    const ys = item.wireRoutePoints.map((point) => point.y + item.y);
    const pad = LINE_ENDPOINT_PADDING + WIRE_CORNER_RADIUS;
    const minX = Math.min(...xs) - pad;
    const minY = Math.min(...ys) - pad;
    const maxX = Math.max(...xs) + pad;
    const maxY = Math.max(...ys) + pad;

    return {
      left: minX,
      top: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  const points = resolveLinearPoints(item);
  const minX = Math.min(points.x1, points.x2) - LINE_ENDPOINT_PADDING;
  const minY = Math.min(points.y1, points.y2) - LINE_ENDPOINT_PADDING;
  const maxX = Math.max(points.x1, points.x2) + LINE_ENDPOINT_PADDING;
  const maxY = Math.max(points.y1, points.y2) + LINE_ENDPOINT_PADDING;

  return {
    left: minX,
    top: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function getDiamondPoints(width, height, strokeWidth = 2) {
  const pad = strokeWidth;
  return [
    [width / 2, pad],
    [width - pad, height / 2],
    [width / 2, height - pad],
    [pad, height / 2],
  ];
}

export function getStarPoints(width, height, strokeWidth = 2) {
  const cx = width / 2;
  const cy = height / 2;
  const outerR = Math.min(width, height) / 2 - strokeWidth;
  const innerR = outerR * 0.42;
  const points = [];

  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? outerR : innerR;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    points.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]);
  }

  return points;
}

export function pointsToSvgAttribute(points) {
  return points.map(([x, y]) => `${x},${y}`).join(" ");
}

export function drawPolygonPath(ctx, points) {
  if (!points.length) return;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i][0], points[i][1]);
  }
  ctx.closePath();
}

export function getLinearTextMaskHalfGap(maskWidth, maskHeight, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy);
  if (length < 1 || maskWidth <= 0 || maskHeight <= 0) return 0;

  const angle = Math.atan2(dy, dx);
  const halfW = maskWidth / 2 + LINE_TEXT_MASK_PADDING;
  const halfH = maskHeight / 2 + LINE_TEXT_MASK_PADDING;
  return Math.abs(Math.cos(angle)) * halfW + Math.abs(Math.sin(angle)) * halfH;
}

export function getLinearMaskedSegments(x1, y1, x2, y2, halfGap, withArrow = false) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy);
  if (length < 1) return [];

  if (!halfGap || halfGap <= 0) {
    return [{ x1, y1, x2, y2, arrow: withArrow }];
  }

  const gap = Math.min(halfGap, length / 2 - 2);
  if (gap <= 0) {
    return [{ x1, y1, x2, y2, arrow: withArrow }];
  }

  const ux = dx / length;
  const uy = dy / length;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;

  return [
    { x1, y1, x2: mx - ux * gap, y2: my - uy * gap, arrow: false },
    { x1: mx + ux * gap, y1: my + uy * gap, x2, y2, arrow: withArrow },
  ];
}

export function drawLinearShapeBetweenPoints(ctx, x1, y1, x2, y2, stroke, withArrow = false) {
  const length = Math.hypot(x2 - x1, y2 - y1);
  if (length < 1) return;

  const head = withArrow ? Math.max(6, Math.min(14, length * 0.18)) : 0;
  const lineEndX = withArrow ? x2 - (head * (x2 - x1)) / length : x2;
  const lineEndY = withArrow ? y2 - (head * (y2 - y1)) / length : y2;

  ctx.strokeStyle = stroke;
  ctx.lineWidth = LINE_STROKE_WIDTH;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(lineEndX, lineEndY);
  ctx.stroke();

  if (withArrow) {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const headAngle = Math.PI / 7;
    ctx.fillStyle = stroke;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(
      x2 - head * Math.cos(angle - headAngle),
      y2 - head * Math.sin(angle - headAngle)
    );
    ctx.lineTo(
      x2 - head * Math.cos(angle + headAngle),
      y2 - head * Math.sin(angle + headAngle)
    );
    ctx.closePath();
    ctx.fill();
  }
}

export function drawLinearShapeWithTextMask(
  ctx,
  x1,
  y1,
  x2,
  y2,
  stroke,
  withArrow = false,
  maskHalfGap = 0
) {
  const segments = getLinearMaskedSegments(x1, y1, x2, y2, maskHalfGap, withArrow);
  for (const segment of segments) {
    drawLinearShapeBetweenPoints(
      ctx,
      segment.x1,
      segment.y1,
      segment.x2,
      segment.y2,
      stroke,
      segment.arrow
    );
  }
}
