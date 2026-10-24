"use client";
import { useEffect, useRef } from "react";
import cytoscape from "cytoscape";
import { PALETTES, buildStyle, type Mode } from "@/lib/graph-style";

export type MiniNode = { data: { id: string; label: string; type: string; deg: number } };
export type MiniEdge = { data: { id: string; source: string; target: string } };

// A small radial "neighbourhood" of the selected node: the node in the middle,
// its direct connections on the first ring, everything else further out.
export default function MiniGraph({
  nodes,
  edges,
  centerId,
  mode,
  onPick,
}: {
  nodes: MiniNode[];
  edges: MiniEdge[];
  centerId: string;
  mode: Mode;
  onPick: (id: string) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const pick = useRef(onPick);
  pick.current = onPick;
  const P = PALETTES[mode];

  useEffect(() => {
    if (!box.current) return;
    const many = nodes.length > 14; // too many labels overlap, so show them on hover instead
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const cy = cytoscape({
      container: box.current,
      elements: [...nodes, ...edges] as any,
      style: [
        ...buildStyle(P, 12),
        {
          selector: "node",
          style: {
            width: 14,
            height: 14,
            "font-size": 10,
            "min-zoomed-font-size": 0,
            "text-max-width": 90,
            "text-opacity": many ? 0 : 1,
            "underlay-opacity": 0.2,
            "underlay-padding": 4,
          },
        },
        {
          selector: "node.center",
          style: {
            width: 30,
            height: 30,
            "font-size": 12,
            "font-weight": 700,
            "text-opacity": 1,
            "border-width": 2,
            "border-color": P.ink,
            "z-index-compare": "manual",
            "z-index": 10,
          },
        },
        {
          selector: "node.hov",
          style: {
            "text-opacity": 1,
            "underlay-opacity": 0.45,
            "underlay-padding": 8,
            "z-index-compare": "manual",
            "z-index": 20,
          },
        },
        { selector: "edge", style: { opacity: 0.45, "line-color": P.muted, width: 1.2 } },
        { selector: "edge.hl", style: { opacity: 0.95, "line-color": P.accent, width: 1.8 } },
      ] as any,
      userZoomingEnabled: false,
      userPanningEnabled: false,
      boxSelectionEnabled: false,
      autoungrabify: true,
    });

    const center = cy.getElementById(centerId);
    center.addClass("center");
    const ring1 = new Set(center.neighborhood("node").map((n) => n.id()));

    cy.layout({
      name: "concentric",
      concentric: (n: any) => (n.id() === centerId ? 3 : ring1.has(n.id()) ? 2 : 1),
      levelWidth: () => 1,
      minNodeSpacing: many ? 22 : 34,
      avoidOverlap: true,
      padding: 22,
      animate: !calm,
      animationDuration: 600,
    } as any).run();

    cy.on("mouseover", "node", (e) => {
      e.target.addClass("hov");
      e.target.connectedEdges().addClass("hl");
      if (box.current) box.current.style.cursor = "pointer";
    });
    cy.on("mouseout", "node", (e) => {
      e.target.removeClass("hov");
      cy.edges().removeClass("hl");
      if (box.current) box.current.style.cursor = "";
    });
    cy.on("tap", "node", (e) => {
      const id = e.target.id();
      if (id !== centerId) pick.current(id);
    });

    return () => cy.destroy();
  }, [nodes, edges, centerId, P]);

  return (
    <div className="mt-3">
      <div
        ref={box}
        className="h-56 w-full rounded-lg border border-edge sm:h-64"
        style={{ backgroundColor: P.bg, backgroundImage: P.grid, backgroundSize: "100% 100%, 22px 22px" }}
        role="img"
        aria-label="Neighbourhood of the selected node. The same connections are listed below."
      />
      <p className="mt-1.5 text-xs text-muted">
        {nodes.length} nodes and {edges.length} links around this one. Click a node to jump to it.
      </p>
    </div>
  );
}