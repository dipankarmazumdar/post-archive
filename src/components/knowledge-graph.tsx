"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { KnowledgeGraph } from "@/lib/graph";

type View = { x: number; y: number; k: number };

export function KnowledgeGraphView({ graph }: { graph: KnowledgeGraph }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewRef = useRef<View>({ x: 0, y: 0, k: 1 });
  const positions = useRef(graph.nodes.map((node) => ({ x: node.x, y: node.y })));
  const hoverRef = useRef<number | null>(null);
  const selectedRef = useRef<number | null>(null);
  const queryRef = useRef("");
  const [selected, setSelected] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const tooltipRef = useRef<HTMLDivElement>(null);

  selectedRef.current = selected;
  queryRef.current = query;

  const neighbors = useMemo(() => {
    const lists = graph.nodes.map(() => [] as number[]);
    for (const link of graph.links) {
      lists[link.source]?.push(link.target);
      lists[link.target]?.push(link.source);
    }
    return lists;
  }, [graph]);

  const byId = useMemo(() => new Map(graph.nodes.map((node, index) => [node.id, index])), [graph]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const view = viewRef.current;
    const points = positions.current;
    let fitted = false;
    let frame = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      if (!fitted && rect.width > 0 && rect.height > 0) {
        fit(rect.width, rect.height);
        fitted = true;
      }
    };

    const fit = (width: number, height: number) => {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (let index = 0; index < graph.nodes.length; index += 1) {
        const node = graph.nodes[index];
        const point = points[index];
        if (!node || !point) continue;
        minX = Math.min(minX, point.x - node.radius);
        minY = Math.min(minY, point.y - node.radius);
        maxX = Math.max(maxX, point.x + node.radius);
        maxY = Math.max(maxY, point.y + node.radius);
      }
      const narrow = width < 760;
      const padLeft = narrow ? 28 : 390;
      const padRight = narrow ? 28 : 36;
      const padTop = narrow ? 168 : 36;
      const padBottom = narrow ? 72 : 64;
      const graphWidth = Math.max(1, maxX - minX);
      const graphHeight = Math.max(1, maxY - minY);
      const scale = Math.min((width - padLeft - padRight) / graphWidth, (height - padTop - padBottom) / graphHeight, 1.6);
      view.k = Number.isFinite(scale) && scale > 0 ? scale : 1;
      view.x = padLeft + (width - padLeft - padRight - graphWidth * view.k) / 2 - minX * view.k;
      view.y = padTop + (height - padTop - padBottom - graphHeight * view.k) / 2 - minY * view.k;
    };

    const focusOf = (): Set<number> | null => {
      const term = queryRef.current.trim().toLowerCase();
      if (term) {
        const matches = new Set<number>();
        graph.nodes.forEach((node, index) => {
          if (node.label.toLowerCase().includes(term)) matches.add(index);
        });
        return matches;
      }
      const active = hoverRef.current ?? selectedRef.current;
      if (active === null) return null;
      return new Set([active, ...(neighbors[active] ?? [])]);
    };

    const orderedLinks = [...graph.links].sort((left, right) => {
      const colorA = graph.nodes[left.target]?.color ?? "";
      const colorB = graph.nodes[right.target]?.color ?? "";
      return colorA.localeCompare(colorB);
    });

    const draw = () => {
      const context = canvas.getContext("2d");
      if (!context) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = canvas.width / Math.max(1, rect.width);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, rect.width, rect.height);
      context.fillStyle = "#0c1117";
      context.fillRect(0, 0, rect.width, rect.height);
      const focus = focusOf();
      context.save();
      context.translate(view.x, view.y);
      context.scale(view.k, view.k);

      const drawEdges = (active: boolean) => {
        context.lineWidth = active ? 1.15 : 0.7;
        context.globalAlpha = active ? 0.55 : focus ? 0.04 : 0.22;
        let color = "";
        let open = false;
        for (const link of orderedLinks) {
          const inFocus = !focus || (focus.has(link.source) && focus.has(link.target));
          if (inFocus !== active) continue;
          const source = points[link.source];
          const target = points[link.target];
          const node = graph.nodes[link.target];
          if (!source || !target || !node) continue;
          if (node.color !== color) {
            if (open) context.stroke();
            color = node.color;
            context.strokeStyle = color;
            context.beginPath();
            open = true;
          }
          context.moveTo(source.x, source.y);
          context.lineTo(target.x, target.y);
        }
        if (open) context.stroke();
      };
      drawEdges(false);
      if (focus) drawEdges(true);

      const order = graph.nodes.map((node, index) => index).sort((a, b) => graph.nodes[a].radius - graph.nodes[b].radius);
      for (const index of order) {
        const node = graph.nodes[index];
        const point = points[index];
        if (!node || !point) continue;
        const emphasized = !focus || focus.has(index);
        context.globalAlpha = emphasized ? 1 : 0.08;
        if (node.kind !== "post") {
          context.beginPath();
          context.fillStyle = node.color;
          context.arc(point.x, point.y, node.radius + (node.kind === "topic" ? 7 : 3), 0, Math.PI * 2);
          context.globalAlpha = emphasized ? 0.16 : 0.04;
          context.fill();
          context.globalAlpha = emphasized ? 1 : 0.08;
        }
        context.beginPath();
        context.fillStyle = node.color;
        context.arc(point.x, point.y, node.radius, 0, Math.PI * 2);
        context.fill();
        if (index === selectedRef.current || index === hoverRef.current) {
          context.strokeStyle = "#f4f7fb";
          context.lineWidth = 1.6 / view.k;
          context.stroke();
        }
      }

      context.globalAlpha = 1;
      context.textAlign = "center";
      context.textBaseline = "top";
      context.lineJoin = "round";
      for (let index = 0; index < graph.nodes.length; index += 1) {
        const node = graph.nodes[index];
        const point = points[index];
        if (!node || !point || node.kind === "post") continue;
        const show = node.kind === "topic" || node.radius >= 8 || (focus?.has(index) ?? false) || view.k > 1.15;
        if (!show) continue;
        if (focus && !focus.has(index)) continue;
        context.font = `${node.kind === "topic" ? 600 : 500} ${node.kind === "topic" ? 15 : 12}px "Open Sauce Sans", sans-serif`;
        context.lineWidth = 4 / view.k;
        context.strokeStyle = "rgba(12, 17, 23, 0.92)";
        context.fillStyle = "#f4f7fb";
        const text = node.label.length > 32 ? `${node.label.slice(0, 31)}…` : node.label;
        const y = point.y + node.radius + 5;
        context.strokeText(text, point.x, y);
        context.fillText(text, point.x, y);
      }
      context.restore();
    };

    const hitTest = (clientX: number, clientY: number): number | null => {
      const rect = canvas.getBoundingClientRect();
      const x = (clientX - rect.left - view.x) / view.k;
      const y = (clientY - rect.top - view.y) / view.k;
      let found: number | null = null;
      let best = Infinity;
      for (let index = 0; index < graph.nodes.length; index += 1) {
        const node = graph.nodes[index];
        const point = points[index];
        if (!node || !point) continue;
        const dx = point.x - x;
        const dy = point.y - y;
        const reach = node.radius + (node.kind === "post" ? 4 : 8) / view.k;
        const distance = dx * dx + dy * dy;
        if (distance <= reach * reach && distance < best) {
          best = distance;
          found = index;
        }
      }
      return found;
    };

    let drag: { mode: "pan" | "node"; index: number; x: number; y: number; ox: number; oy: number; moved: boolean } | null = null;

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      canvas.setPointerCapture(event.pointerId);
      const hit = hitTest(event.clientX, event.clientY);
      const point = hit === null ? null : points[hit];
      drag = {
        mode: hit === null || !point ? "pan" : "node",
        index: hit ?? -1,
        x: event.clientX,
        y: event.clientY,
        ox: point?.x ?? view.x,
        oy: point?.y ?? view.y,
        moved: false,
      };
    };
    const onPointerMove = (event: PointerEvent) => {
      const hit = hitTest(event.clientX, event.clientY);
      hoverRef.current = hit;
      const tip = tooltipRef.current;
      const node = hit === null ? null : graph.nodes[hit];
      if (tip && node && hit !== selectedRef.current) {
        tip.hidden = false;
        tip.style.left = `${event.clientX + 14}px`;
        tip.style.top = `${event.clientY + 14}px`;
        const title = tip.querySelector("strong");
        const meta = tip.querySelector("span");
        if (title) title.textContent = node.label;
        if (meta) meta.textContent = node.kind === "post" ? "Post" : `${node.count} ${node.count === 1 ? "post" : "posts"}`;
      } else if (tip) {
        tip.hidden = true;
      }
      if (!drag) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (dx * dx + dy * dy > 9) drag.moved = true;
      if (drag.mode === "pan") {
        view.x += event.movementX;
        view.y += event.movementY;
      } else if (points[drag.index]) {
        points[drag.index].x = drag.ox + dx / view.k;
        points[drag.index].y = drag.oy + dy / view.k;
      }
    };
    const onPointerUp = (event: PointerEvent) => {
      const hit = hitTest(event.clientX, event.clientY);
      if (drag && !drag.moved) setSelected(hit);
      drag = null;
      if (tooltipRef.current) tooltipRef.current.hidden = true;
    };
    const onPointerLeave = () => {
      if (!drag) {
        hoverRef.current = null;
        if (tooltipRef.current) tooltipRef.current.hidden = true;
      }
    };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mx = event.clientX - rect.left;
      const my = event.clientY - rect.top;
      const worldX = (mx - view.x) / view.k;
      const worldY = (my - view.y) / view.k;
      const next = Math.min(4, Math.max(0.12, view.k * (event.deltaY > 0 ? 0.9 : 1.1)));
      view.k = next;
      view.x = mx - worldX * next;
      view.y = my - worldY * next;
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(parent);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointerleave", onPointerLeave);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    const loop = () => {
      draw();
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    void document.fonts?.ready.then(() => draw());

    const api = {
      fit: () => {
        points.forEach((point, index) => {
          point.x = graph.nodes[index]?.x ?? point.x;
          point.y = graph.nodes[index]?.y ?? point.y;
        });
        const rect = canvas.getBoundingClientRect();
        fit(rect.width, rect.height);
      },
      zoom: (factor: number) => {
        const rect = canvas.getBoundingClientRect();
        const mx = rect.width / 2;
        const my = rect.height / 2;
        const worldX = (mx - view.x) / view.k;
        const worldY = (my - view.y) / view.k;
        const next = Math.min(4, Math.max(0.12, view.k * factor));
        view.k = next;
        view.x = mx - worldX * next;
        view.y = my - worldY * next;
      },
      center: (index: number) => {
        const point = points[index];
        if (!point) return;
        const rect = canvas.getBoundingClientRect();
        const narrow = rect.width < 760;
        const leftInset = narrow ? 16 : 80;
        const rightInset = narrow ? 16 : 300;
        view.k = Math.min(2.2, Math.max(view.k, narrow ? 0.7 : 0.95));
        view.x = leftInset + (rect.width - leftInset - rightInset) / 2 - point.x * view.k;
        view.y = (narrow ? rect.height * 0.42 : rect.height / 2) - point.y * view.k;
      },
    };
    canvas.dataset.ready = "true";
    (canvas as CanvasWithGraph).graphApi = api;

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [graph, neighbors]);

  const active = selected === null ? null : graph.nodes[selected];
  const groupName = active ? graph.legend.find((item) => item.id === `topic:${active.group}`)?.label : null;
  const relatedTags = selected === null ? [] : (neighbors[selected] ?? []).filter((index) => graph.nodes[index]?.kind === "tag").slice(0, 10);
  const relatedPosts = relatedPostIndexes(graph, neighbors, selected);
  const term = query.trim().toLowerCase();
  const matchCount = term ? graph.nodes.filter((node) => node.label.toLowerCase().includes(term)).length : 0;

  const focusNode = (index: number | null) => {
    setSelected(index);
    const api = (canvasRef.current as CanvasWithGraph | null)?.graphApi;
    if (index !== null) api?.center(index);
  };

  return (
    <>
      <canvas
        ref={canvasRef}
        className="graph-canvas"
        aria-label="Knowledge graph. Topics and tags are the larger labeled nodes. Posts are the small dots around them. Use the subject list to open one."
      />
      <div className="graph-hud">
        <h1>Knowledge graph</h1>
        <p>Drag a node, scroll to zoom, or pick a subject.</p>
        <label className="sr-only" htmlFor="graph-q">Find a subject</label>
        <input
          id="graph-q"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Find Puffin, Flink, MCP…"
          type="search"
        />
        {term ? <p className="meta">{matchCount} {matchCount === 1 ? "match" : "matches"}</p> : null}
        <div className="graph-legend" aria-label="Topics">
          {graph.legend.map((item) => {
            const index = byId.get(item.id) ?? null;
            const pressed = index !== null && selected === index;
            return (
              <button
                key={item.id}
                type="button"
                className="graph-chip"
                aria-pressed={pressed}
                onClick={() => focusNode(pressed ? null : index)}
              >
                <span className="graph-swatch" style={{ background: item.color }} />
                {item.label}
                <span className="graph-count">{item.count}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="graph-tools">
        <button type="button" className="graph-chip" onClick={() => (canvasRef.current as CanvasWithGraph | null)?.graphApi?.zoom(1.15)}>Zoom in</button>
        <button type="button" className="graph-chip" onClick={() => (canvasRef.current as CanvasWithGraph | null)?.graphApi?.zoom(0.87)}>Zoom out</button>
        <button type="button" className="graph-chip" onClick={() => (canvasRef.current as CanvasWithGraph | null)?.graphApi?.fit()}>Reset</button>
      </div>
      {active ? (
        <aside className="graph-detail">
          <p className="meta">{active.kind === "topic" ? "Topic" : active.kind === "tag" ? "Tag" : "Post"}{groupName && active.kind !== "topic" ? ` · ${groupName}` : ""}</p>
          <h2>{active.label}</h2>
          {active.kind === "post" ? null : <p>{active.count} {active.count === 1 ? "post" : "posts"}</p>}
          <p><Link href={active.href}>{active.kind === "post" ? "Open post" : active.kind === "tag" ? "Search this tag" : "Open topic"}</Link></p>
          {relatedTags.length ? (
            <div className="graph-legend">
              {relatedTags.map((index) => (
                <button key={graph.nodes[index]?.id} type="button" className="graph-chip" onClick={() => focusNode(index)}>
                  {graph.nodes[index]?.label}
                </button>
              ))}
            </div>
          ) : null}
          {relatedPosts.length ? (
            <ul className="graph-posts">
              {relatedPosts.map((index) => {
                const node = graph.nodes[index];
                if (!node) return null;
                return (
                  <li key={node.id}>
                    <Link href={node.href}>{node.label}</Link>
                  </li>
                );
              })}
            </ul>
          ) : null}
          <button type="button" className="graph-chip" onClick={() => setSelected(null)}>Close</button>
        </aside>
      ) : null}
      <div ref={tooltipRef} className="graph-tooltip" hidden>
        <strong />
        <span />
      </div>
    </>
  );
}

type GraphApi = { fit: () => void; zoom: (factor: number) => void; center: (index: number) => void };
type CanvasWithGraph = HTMLCanvasElement & { graphApi?: GraphApi };

function relatedPostIndexes(graph: KnowledgeGraph, neighbors: number[][], selected: number | null): number[] {
  if (selected === null) return [];
  const found: number[] = [];
  const seen = new Set<number>();
  const take = (index: number) => {
    for (const next of neighbors[index] ?? []) {
      if (seen.has(next) || graph.nodes[next]?.kind !== "post") continue;
      seen.add(next);
      found.push(next);
      if (found.length >= 6) return;
    }
  };
  take(selected);
  if (found.length < 6 && graph.nodes[selected]?.kind === "topic") {
    for (const next of neighbors[selected] ?? []) {
      if (graph.nodes[next]?.kind !== "tag") continue;
      take(next);
      if (found.length >= 6) break;
    }
  }
  return found;
}
