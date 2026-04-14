"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/ban-ts-comment */

import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

export default function StarMapVisualization({ initialData }: { initialData?: any }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [nodes] = useState(initialData?.nodes || []);
  const [links] = useState(initialData?.links || []);
  const [tooltipData, setTooltipData] = useState<{
    title: string;
    path: string;
    x: number;
    y: number;
    color: string;
    rep?: number;
    level?: number;
  } | null>(null);
  const [showLabels, setShowLabels] = useState(true);

  useEffect(() => {
    if (!containerRef.current || !nodes.length) return;

    // Cleanup any existing SVG to prevent duplicates on strict mode
    d3.select(containerRef.current).selectAll("svg").remove();

    const width = window.innerWidth;
    const height = window.innerHeight;

    const svg = d3
      .select(containerRef.current)
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .style("background-color", "#0f172a")
      .style("cursor", "grab");

    const defs = svg.append("defs");

    // Create glow filters for different levels
    [
      { id: "gold", color: "#f59e0b" }, // High trust / Verified
      { id: "blue", color: "#38bdf8" }, // Standard
      { id: "green", color: "#10b981" }, // Active
    ].forEach((filterDef) => {
      const filter = defs
        .append("filter")
        .attr("id", `glow-${filterDef.id}`)
        .attr("x", "-50%")
        .attr("y", "-50%")
        .attr("width", "200%")
        .attr("height", "200%");
      filter
        .append("feGaussianBlur")
        .attr("stdDeviation", "4")
        .attr("result", "coloredBlur");
      const feMerge = filter.append("feMerge");
      feMerge.append("feMergeNode").attr("in", "coloredBlur");
      feMerge.append("feMergeNode").attr("in", "SourceGraphic");
    });

    const g = svg.append("g");

    const zoom = d3
      .zoom()
      .scaleExtent([0.1, 8])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
        const scale = event.transform.k;
        d3.selectAll(".node-label").style(
          "opacity",
          showLabels ? (scale > 0.8 ? 0.8 : scale * 0.5) : 0,
        );
      });

    svg
      .call(zoom as any)
      .on("dblclick.zoom", null)
      .on("mousedown", () => svg.style("cursor", "grabbing"))
      .on("mouseup", () => svg.style("cursor", "grab"));

    svg.call(
      zoom.transform as any,
      d3.zoomIdentity
        .translate(width / 2, height / 2)
        .scale(0.8)
        .translate(-width / 2, -height / 2),
    );

    const simulation = d3
      .forceSimulation(nodes as any)
      .force(
        "link",
        d3
          .forceLink(links)
          .id((d: any) => d.id)
          .distance((d: any) => 120 - (d.value * 2)),
      )
      .force("charge", d3.forceManyBody().strength(-300))
      .force(
        "collide",
        d3
          .forceCollide()
          .radius((d: any) => Math.sqrt(d.reputation || 10) + 15)
          .iterations(2),
      )
      .force("x", d3.forceX(width / 2).strength(0.04))
      .force("y", d3.forceY(height / 2).strength(0.04));

    const link = g
      .append("g")
      .selectAll("line")
      .data(links)
      .enter()
      .append("line")
      .attr("stroke", (d: any) => (d.type === 'SALE' ? '#10b981' : '#334155'))
      .attr("stroke-opacity", 0.4)
      .attr("stroke-width", (d: any) => Math.max(1, d.value / 2));

    const node = g
      .append("g")
      .selectAll("circle")
      .data(nodes)
      .enter()
      .append("circle")
      .attr("r", (d: any) => Math.max(8, Math.sqrt(d.reputation || 10) + 2))
      .attr("fill", "#0f172a")
      .attr("stroke", (d: any) => (d.isVerified ? "#f59e0b" : "#38bdf8"))
      .attr("stroke-width", 2)
      .attr("filter", (d: any) => d.isVerified ? "url(#glow-gold)" : "url(#glow-blue)")
      .call(
        (d3 as any)
          .drag()
          .on("start", (event: any, d: any) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event: any, d: any) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event: any, d: any) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          }),
      )
      .on("mouseover", (event, d: any) => {
        link
          .attr("stroke-opacity", (l: any) =>
            l.source.id === d.id || l.target.id === d.id ? 1 : 0.05,
          )
          .attr("stroke", (l: any) =>
            l.source.id === d.id || l.target.id === d.id ? (d.isVerified ? "#f59e0b" : "#38bdf8") : "#1e293b",
          );

        node.attr("opacity", (n: any) => {
          if (n.id === d.id) return 1;
          const isConnected = links.some(
            (l: any) =>
              (l.source.id === d.id && l.target.id === n.id) ||
              (l.target.id === d.id && l.source.id === n.id),
          );
          return isConnected ? 1 : 0.2;
        });

        d3.select(event.currentTarget)
          .transition()
          .duration(150)
          .attr("r", (Math.max(8, Math.sqrt(d.reputation || 10) + 2)) * 1.5)
          .attr("stroke-width", 4);

        setTooltipData({
          title: d.label,
          path: d.id,
          rep: d.reputation,
          level: d.level,
          x: event.pageX + 15,
          y: event.pageY + 15,
          color: d.isVerified ? "#f59e0b" : "#38bdf8",
        });
      })
      .on("mousemove", (event) => {
        setTooltipData((prev) =>
          prev ? { ...prev, x: event.pageX + 15, y: event.pageY + 15 } : null,
        );
      })
      .on("mouseout", (event, d: any) => {
        link.attr("stroke-opacity", 0.4).attr("stroke", (l: any) => (l.type === 'SALE' ? '#10b981' : '#334155'));
        node.attr("opacity", 1);
        d3.select(event.currentTarget)
          .transition()
          .duration(200)
          .attr("r", Math.max(8, Math.sqrt(d.reputation || 10) + 2))
          .attr("stroke-width", 2);
        setTooltipData(null);
      });

    const labels = g
      .append("g")
      .selectAll("text")
      .data(nodes)
      .enter()
      .append("text")
      .attr("class", "node-label")
      .attr("dy", (d: any) => Math.max(8, Math.sqrt(d.reputation || 10) + 2) + 12)
      .style("font-size", "10px")
      .style("fill", "#cbd5e1")
      .style("pointer-events", "none")
      .style("text-anchor", "middle")
      .style("font-weight", "600")
      .style("opacity", showLabels ? 0.8 : 0)
      .text((d: any) => d.label);

    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);
      node.attr("cx", (d: any) => d.x).attr("cy", (d: any) => d.y);
      labels.attr("x", (d: any) => d.x).attr("y", (d: any) => d.y);
    });

    return () => { simulation.stop(); };
  }, [nodes, links, showLabels]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-900 text-slate-50">
      {/* Header Overlay */}
      <div className="absolute top-6 left-6 z-10 bg-slate-900/70 p-5 rounded-3xl backdrop-blur-md border border-slate-700/50 shadow-2xl">
        <h1 className="m-0 text-2xl font-bold tracking-tight bg-gradient-to-r from-amber-400 to-primary-400 bg-clip-text text-transparent">
          Bidding Trust Network
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Visualizing the Social Fabric of Nilamit
        </p>
        <div className="mt-3 flex gap-2">
           <div className="px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-[10px] font-bold text-amber-500 uppercase tracking-wider">Verified Nodes: {nodes.filter((n: any) => n.isVerified).length}</div>
           <div className="px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Live Links: {links.length}</div>
        </div>
      </div>

      {/* Controls */}
      <div className="absolute top-6 right-6 z-10 flex gap-3">
        <button
          onClick={() => setShowLabels(!showLabels)}
          className="bg-slate-800/80 border border-slate-700 text-slate-300 px-5 py-2.5 rounded-2xl hover:bg-slate-700/90 hover:text-white transition-all text-sm font-semibold backdrop-blur-md shadow-lg"
        >
          {showLabels ? "Hide Labels" : "Show Labels"}
        </button>
      </div>

      {/* Legend */}
      <div className="absolute bottom-6 left-6 z-10 bg-slate-900/80 p-5 rounded-2xl backdrop-blur-md border border-slate-700 text-xs shadow-xl">
        <p className="font-bold text-slate-500 mb-3 uppercase tracking-widest text-[10px]">Relationship Map</p>
        <div className="space-y-3">
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full mr-3 shadow-[0_0_10px_#f59e0b]" style={{ background: "#f59e0b" }} />
            <span className="font-medium">Verified Merchant</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full mr-3 shadow-[0_0_10px_#38bdf8]" style={{ background: "#38bdf8" }} />
            <span className="font-medium">Standard Member</span>
          </div>
          <div className="flex items-center">
            <div className="w-6 h-0.5 bg-emerald-500 mr-3 opacity-60" />
            <span className="font-medium text-emerald-400/80">Successful Trade</span>
          </div>
          <div className="flex items-center">
            <div className="w-6 h-0.5 bg-slate-600 mr-3 opacity-40" />
            <span className="font-medium text-slate-500">Shared Interest</span>
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {tooltipData && (
        <div
          className="absolute bg-slate-900/95 border border-slate-700 p-4 rounded-2xl text-white pointer-events-none z-20 shadow-2xl backdrop-blur-md max-w-[280px] animate-in fade-in zoom-in-95 duration-200"
          style={{ left: tooltipData.x, top: tooltipData.y }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center font-bold text-xl" style={{ color: tooltipData.color }}>
              {tooltipData.title.charAt(0)}
            </div>
            <div>
              <div className="font-bold text-lg" style={{ color: tooltipData.color }}>{tooltipData.title}</div>
              <div className="text-[10px] text-slate-500 font-mono uppercase tracking-tighter opacity-60">Node ID: {tooltipData.path.substring(0, 12)}...</div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div className="bg-slate-800/50 p-2 rounded-xl border border-slate-700/50">
              <div className="text-[9px] text-slate-400 uppercase font-bold mb-0.5 tracking-wider">Reputation</div>
              <div className="text-sm font-bold text-emerald-400">{tooltipData.rep || 0} pts</div>
            </div>
            <div className="bg-slate-800/50 p-2 rounded-xl border border-slate-700/50">
              <div className="text-[9px] text-slate-400 uppercase font-bold mb-0.5 tracking-wider">User Level</div>
              <div className="text-sm font-bold text-amber-400">LVL {tooltipData.level || 1}</div>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!nodes.length && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-500">
           Mapping the constellation...
        </div>
      )}

      {/* D3 Canvas */}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
