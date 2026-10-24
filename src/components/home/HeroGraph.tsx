"use client";
import { useEffect, useRef } from "react";
import cytoscape from "cytoscape";
// @ts-expect-error no bundled types
import fcose from "cytoscape-fcose";
import { STYLE } from "@/lib/graph-style";
import type { Elements } from "@/lib/graph";

let registered = false;

export function HeroGraph({ elements }: { elements: Elements }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!box.current) return;
    if (!registered) { cytoscape.use(fcose); registered = true; }
    const cy = cytoscape({
      container: box.current,
      elements: [...elements.nodes, ...elements.edges] as any,
      style: [...STYLE, { selector: "node", style: { label: "" } }] as any,
      userZoomingEnabled: false, userPanningEnabled: false, boxSelectionEnabled: false, autoungrabify: true,
    });
    cy.nodes().forEach((n) => n.data("deg", n.degree(false)));
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    cy.layout({ name: "fcose", animate: !calm, animationDuration: 2200, randomize: true, padding: 24,
      nodeRepulsion: () => 7000, idealEdgeLength: () => 70 } as any).run();
    return () => cy.destroy();
  }, [elements]);
  return <div ref={box} className="pointer-events-none h-full w-full" aria-hidden />;
}
