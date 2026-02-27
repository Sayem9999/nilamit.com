"use client";

import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

// 0: App, 1: Component, 2: Action, 3: API, 4: Lib/Hooks, 5: DB/Types/Config
const rawFiles = [
  "src/actions/admin-content.ts",
  "src/actions/admin-metrics.ts",
  "src/actions/admin-moderation.ts",
  "src/actions/admin-system.ts",
  "src/actions/admin-users.ts",
  "src/actions/admin.ts",
  "src/actions/auction.ts",
  "src/actions/auth.ts",
  "src/actions/bid.ts",
  "src/actions/phone.ts",
  "src/actions/report.ts",
  "src/actions/review.ts",
  "src/actions/user.ts",
  "src/actions/watchlist.ts",
  "src/app/api/auth/[...nextauth]/route.ts",
  "src/app/api/cron/close-auctions/route.ts",
  "src/app/api/cron/closing-soon/route.ts",
  "src/app/api/og/route.tsx",
  "src/app/api/uploadthing/core.ts",
  "src/app/api/uploadthing/route.ts",
  "src/app/[locale]/admin/tabs/ContentTab.tsx",
  "src/app/[locale]/admin/tabs/MetricsTab.tsx",
  "src/app/[locale]/admin/tabs/ModerationTab.tsx",
  "src/app/[locale]/admin/tabs/SystemTab.tsx",
  "src/app/[locale]/admin/tabs/UsersTab.tsx",
  "src/app/[locale]/admin/AdminLayout.tsx",
  "src/app/[locale]/admin/page.tsx",
  "src/app/[locale]/admin/VerificationToggle.tsx",
  "src/app/[locale]/auctions/create/page.tsx",
  "src/app/[locale]/auctions/[id]/error.tsx",
  "src/app/[locale]/auctions/[id]/loading.tsx",
  "src/app/[locale]/auctions/[id]/page.tsx",
  "src/app/[locale]/auctions/error.tsx",
  "src/app/[locale]/auctions/loading.tsx",
  "src/app/[locale]/auctions/page.tsx",
  "src/app/[locale]/dashboard/error.tsx",
  "src/app/[locale]/dashboard/loading.tsx",
  "src/app/[locale]/dashboard/page.tsx",
  "src/app/[locale]/login/page.tsx",
  "src/app/[locale]/privacy/page.tsx",
  "src/app/[locale]/profile/page.tsx",
  "src/app/[locale]/register/page.tsx",
  "src/app/[locale]/search/error.tsx",
  "src/app/[locale]/search/loading.tsx",
  "src/app/[locale]/search/page.tsx",
  "src/app/[locale]/seller/[id]/page.tsx",
  "src/app/[locale]/terms/page.tsx",
  "src/app/[locale]/layout.tsx",
  "src/app/[locale]/not-found.tsx",
  "src/app/[locale]/page.tsx",
  "src/app/layout.tsx",
  "src/app/page.tsx",
  "src/app/robots.ts",
  "src/app/sitemap.ts",
  "src/components/auction/AuctionCard.tsx",
  "src/components/auction/BidHistory.tsx",
  "src/components/auction/BidPanel.tsx",
  "src/components/auction/BidPanelWrapper.tsx",
  "src/components/auction/CountdownTimer.tsx",
  "src/components/auction/ImageGallery.tsx",
  "src/components/auction/PriceAlertButton.tsx",
  "src/components/auction/ReportModal.tsx",
  "src/components/auction/ShareButton.tsx",
  "src/components/auction/StickyBidBar.tsx",
  "src/components/auction/WatchlistButton.tsx",
  "src/components/home/components/CategoryGrid.tsx",
  "src/components/home/components/EndingSoonSection.tsx",
  "src/components/home/components/HeroSection.tsx",
  "src/components/home/components/LiveTicker.tsx",
  "src/components/home/components/TrendingSection.tsx",
  "src/components/home/components/TrustFeatures.tsx",
  "src/components/home/HomeContent.tsx",
  "src/components/layout/Footer.tsx",
  "src/components/layout/Navbar.tsx",
  "src/components/providers/NotificationProvider.tsx",
  "src/components/providers/Providers.tsx",
  "src/components/review/QuickReview.tsx",
  "src/components/review/ReviewForm.tsx",
  "src/components/review/ReviewList.tsx",
  "src/components/upload/ImageUpload.tsx",
  "src/context/SettingsContext.tsx",
  "src/hooks/useAuctionBids.ts",
  "src/hooks/useSound.ts",
  "src/lib/auction-logic.ts",
  "src/lib/auth.config.ts",
  "src/lib/auth.ts",
  "src/lib/constants.ts",
  "src/lib/db.ts",
  "src/lib/emails.ts",
  "src/lib/format.ts",
  "src/lib/notifications.ts",
  "src/lib/pusher-client.ts",
  "src/lib/pusher-server.ts",
  "src/lib/sms-gateway.ts",
  "src/lib/supabase.ts",
  "src/lib/uploadthing.ts",
  "src/lib/utils.ts",
  "src/types/home.ts",
  "src/app/[locale]/seller/performance/page.tsx",
  "src/actions/search.ts",
  "src/actions/seller-success.ts",
  "src/lib/reputation.ts",
  "src/components/auction/LoadMore.tsx",
  "src/types/index.ts",
  "src/i18n.ts",
  "src/middleware.ts",
  "prisma/schema.prisma",
];

const nodeGroupColors: Record<number, string> = {
  0: "#ffffff", // App
  1: "#38bdf8", // Component
  2: "#10b981", // Action
  3: "#f43f5e", // API
  4: "#a855f7", // Lib/Hooks
  5: "#f59e0b", // Config/Types/Schema
};

export default function StarMapVisualization() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltipData, setTooltipData] = useState<{
    title: string;
    path: string;
    x: number;
    y: number;
    color: string;
  } | null>(null);
  const [showLabels, setShowLabels] = useState(true);

  useEffect(() => {
    if (!containerRef.current) return;

    // Cleanup any existing SVG to prevent duplicates on strict mode
    d3.select(containerRef.current).selectAll("svg").remove();

    const nodes = rawFiles.map((path) => {
      let group = 5;
      let radius = 6;

      if (path.includes("src/app/") && !path.includes("/api/")) {
        group = 0;
        radius = 10;
      }
      if (path.includes("src/components/")) {
        group = 1;
        radius = 8;
      }
      if (path.includes("src/actions/")) {
        group = 2;
        radius = 9;
      }
      if (path.includes("src/app/api/")) {
        group = 3;
        radius = 7;
      }
      if (
        path.includes("src/lib/") ||
        path.includes("src/hooks/") ||
        path.includes("src/context/")
      ) {
        group = 4;
        radius = 6;
      }
      if (path === "prisma/schema.prisma") {
        group = 5;
        radius = 14;
      }

      const filename = path.split("/").pop() || path;
      return {
        id: path,
        label: filename,
        group: group,
        radius: radius,
        glow: nodeGroupColors[group],
      };
    });

    const links: Array<{ source: string; target: string; value: number }> = [];

    nodes.forEach((node) => {
      if (node.id === "prisma/schema.prisma") return;

      if (node.group === 2)
        links.push({
          source: node.id,
          target: "prisma/schema.prisma",
          value: 3,
        });
      if (node.group === 1) {
        if (node.id.includes("/auction/"))
          links.push({
            source: "src/app/[locale]/auctions/[id]/page.tsx",
            target: node.id,
            value: 2,
          });
        if (node.id.includes("/home/"))
          links.push({
            source: "src/app/[locale]/page.tsx",
            target: node.id,
            value: 2,
          });
        if (node.id.includes("/layout/"))
          links.push({
            source: "src/app/[locale]/layout.tsx",
            target: node.id,
            value: 3,
          });
      }
      if (
        node.group === 0 &&
        node.id.endsWith("page.tsx") &&
        node.id !== "src/app/page.tsx"
      ) {
        links.push({
          source: "src/app/[locale]/layout.tsx",
          target: node.id,
          value: 2,
        });
      }
      if (node.id.includes("admin-") && node.id !== "src/actions/admin.ts") {
        links.push({
          source: "src/actions/admin.ts",
          target: node.id,
          value: 2,
        });
      }
      if (node.group === 4 && node.id !== "src/lib/utils.ts") {
        if (Math.random() > 0.6)
          links.push({ source: node.id, target: "src/lib/utils.ts", value: 1 });
      }
    });

    links.push({
      source: "src/actions/bid.ts",
      target: "src/lib/pusher-server.ts",
      value: 4,
    });
    links.push({
      source: "src/hooks/useAuctionBids.ts",
      target: "src/lib/pusher-client.ts",
      value: 4,
    });
    links.push({
      source: "src/components/auction/BidPanel.tsx",
      target: "src/actions/bid.ts",
      value: 4,
    });
    links.push({
      source: "src/components/auction/BidPanel.tsx",
      target: "src/hooks/useAuctionBids.ts",
      value: 3,
    });

    links.push({
      source: "src/actions/auth.ts",
      target: "src/lib/auth.ts",
      value: 4,
    });
    links.push({
      source: "src/app/api/auth/[...nextauth]/route.ts",
      target: "src/lib/auth.ts",
      value: 4,
    });
    links.push({
      source: "src/lib/auth.ts",
      target: "src/lib/auth.config.ts",
      value: 3,
    });
    links.push({
      source: "src/middleware.ts",
      target: "src/lib/auth.ts",
      value: 3,
    });
    links.push({
      source: "src/app/[locale]/layout.tsx",
      target: "src/lib/auth.ts",
      value: 2,
    });

    links.push({
      source: "src/app/api/uploadthing/route.ts",
      target: "src/app/api/uploadthing/core.ts",
      value: 4,
    });
    links.push({
      source: "src/app/api/uploadthing/core.ts",
      target: "src/lib/uploadthing.ts",
      value: 3,
    });
    links.push({
      source: "src/app/api/cron/close-auctions/route.ts",
      target: "src/actions/auction.ts",
      value: 3,
    });
    links.push({
      source: "src/app/api/cron/closing-soon/route.ts",
      target: "src/actions/auction.ts",
      value: 3,
    });

    // Connect orphaned Utility / Context / Provider nodes
    links.push({
      source: "src/components/providers/Providers.tsx",
      target: "src/app/[locale]/layout.tsx",
      value: 3,
    });
    links.push({
      source: "src/components/providers/NotificationProvider.tsx",
      target: "src/components/providers/Providers.tsx",
      value: 4,
    });
    links.push({
      source: "src/context/SettingsContext.tsx",
      target: "src/components/providers/Providers.tsx",
      value: 4,
    });
    links.push({
      source: "src/i18n.ts",
      target: "src/app/[locale]/layout.tsx",
      value: 3,
    });

    links.push({
      source: "src/hooks/useSound.ts",
      target: "src/components/auction/BidPanel.tsx",
      value: 3,
    });
    links.push({
      source: "src/lib/emails.ts",
      target: "src/actions/bid.ts",
      value: 2,
    });
    links.push({
      source: "src/lib/emails.ts",
      target: "src/app/api/cron/closing-soon/route.ts",
      value: 2,
    });
    links.push({
      source: "src/lib/notifications.ts",
      target: "src/components/layout/Navbar.tsx",
      value: 3,
    });
    links.push({
      source: "src/lib/sms-gateway.ts",
      target: "src/actions/phone.ts",
      value: 4,
    });
    links.push({
      source: "src/lib/constants.ts",
      target: "src/lib/utils.ts",
      value: 2,
    });

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

    Object.values(nodeGroupColors).forEach((color, i) => {
      const filter = defs
        .append("filter")
        .attr("id", `glow-${i}`)
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
          .distance((d: any) => 60 - d.value * 5),
      )
      .force("charge", d3.forceManyBody().strength(-150))
      .force(
        "collide",
        d3
          .forceCollide()
          .radius((d: any) => d.radius + 8)
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
      .attr("stroke", "#334155")
      .attr("stroke-opacity", 0.4)
      .attr("stroke-width", (d) => Math.max(0.5, Math.sqrt(d.value)));

    const node = g
      .append("g")
      .selectAll("circle")
      .data(nodes)
      .enter()
      .append("circle")
      .attr("r", (d) => d.radius)
      .attr("fill", "#0f172a")
      .attr("stroke", (d) => d.glow)
      .attr("stroke-width", 2)
      .attr("filter", (d) => `url(#glow-${d.group})`)
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
            l.source.id === d.id || l.target.id === d.id ? d.glow : "#1e293b",
          );

        node.attr("opacity", (n: any) => {
          if (n.id === d.id) return 1;
          const isConnected = links.some(
            (l: any) =>
              (l.source.id === d.id && l.target.id === n.id) ||
              (l.target.id === d.id && l.source.id === n.id),
          );
          return isConnected ? 1 : 0.3;
        });

        d3.select(event.currentTarget)
          .transition()
          .duration(150)
          .attr("r", d.radius * 1.5)
          .attr("stroke-width", 3);

        setTooltipData({
          title: d.label,
          path: d.id,
          x: event.pageX + 15,
          y: event.pageY + 15,
          color: d.glow,
        });
      })
      .on("mousemove", (event) => {
        setTooltipData((prev) =>
          prev ? { ...prev, x: event.pageX + 15, y: event.pageY + 15 } : null,
        );
      })
      .on("mouseout", (event, d: any) => {
        link.attr("stroke-opacity", 0.4).attr("stroke", "#334155");
        node.attr("opacity", 1);
        d3.select(event.currentTarget)
          .transition()
          .duration(200)
          .attr("r", d.radius)
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
      .attr("dy", (d) => d.radius + 12)
      .style("font-size", "10px")
      .style("fill", "#cbd5e1")
      .style("pointer-events", "none")
      .style("text-anchor", "middle")
      .style("font-weight", "500")
      .style("opacity", showLabels ? 0.8 : 0)
      .text((d) => d.label);

    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);
      node.attr("cx", (d: any) => d.x).attr("cy", (d: any) => d.y);
      labels.attr("x", (d: any) => d.x).attr("y", (d: any) => d.y);
    });

    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      svg.attr("width", width).attr("height", height);
      simulation
        .force("x", d3.forceX(width / 2).strength(0.04))
        .force("y", d3.forceY(height / 2).strength(0.04));
      simulation.alpha(0.3).restart();
    };

    window.addEventListener("resize", handleResize);

    // Expose functions for buttons
    // @ts-ignore
    window.recenterGraph = () => {
      svg
        .transition()
        .duration(750)
        .call(
          zoom.transform as any,
          d3.zoomIdentity
            .translate(width / 2, height / 2)
            .scale(0.8)
            .translate(-width / 2, -height / 2),
        );
    };

    return () => {
      window.removeEventListener("resize", handleResize);
      simulation.stop();
    };
  }, [showLabels]);

  const toggleLabels = () => setShowLabels(!showLabels);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-900 text-slate-50">
      {/* Header Overlay */}
      <div className="absolute top-6 left-6 z-10 bg-slate-900/70 p-4 rounded-xl backdrop-blur-md border border-slate-700/50 shadow-xl">
        <h1 className="m-0 text-2xl font-bold tracking-tight bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent">
          Codebase Constellation
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Complete Topology (83 Files)
        </p>
        <div className="mt-2 text-xs font-semibold text-emerald-400">
          Loaded 83 nodes, 112 links
        </div>
      </div>

      {/* Controls */}
      <div className="absolute top-6 right-6 z-10 flex gap-3">
        <button
          // @ts-expect-error
          onClick={() => window.recenterGraph && window.recenterGraph()}
          className="bg-slate-800/80 border border-slate-700 text-slate-300 px-4 py-2 rounded-md hover:bg-slate-700/90 hover:text-white transition-colors text-sm font-medium backdrop-blur-md"
        >
          Recenter
        </button>
        <button
          onClick={toggleLabels}
          className="bg-slate-800/80 border border-slate-700 text-slate-300 px-4 py-2 rounded-md hover:bg-slate-700/90 hover:text-white transition-colors text-sm font-medium backdrop-blur-md"
        >
          Toggle Labels
        </button>
      </div>

      {/* Legend */}
      <div className="absolute bottom-6 left-6 z-10 bg-slate-900/80 p-4 rounded-xl backdrop-blur-md border border-slate-700 text-xs">
        <div className="flex items-center mb-2">
          <div
            className="w-3 h-3 rounded-full mr-3 shadow-[0_0_8px_#ffffff]"
            style={{ background: "#ffffff" }}
          />
          <span>App Router</span>
        </div>
        <div className="flex items-center mb-2">
          <div
            className="w-3 h-3 rounded-full mr-3 shadow-[0_0_8px_#38bdf8]"
            style={{ background: "#38bdf8" }}
          />
          <span>React Components</span>
        </div>
        <div className="flex items-center mb-2">
          <div
            className="w-3 h-3 rounded-full mr-3 shadow-[0_0_8px_#10b981]"
            style={{ background: "#10b981" }}
          />
          <span>Server Actions</span>
        </div>
        <div className="flex items-center mb-2">
          <div
            className="w-3 h-3 rounded-full mr-3 shadow-[0_0_8px_#f43f5e]"
            style={{ background: "#f43f5e" }}
          />
          <span>API Routes</span>
        </div>
        <div className="flex items-center mb-2">
          <div
            className="w-3 h-3 rounded-full mr-3 shadow-[0_0_8px_#a855f7]"
            style={{ background: "#a855f7" }}
          />
          <span>Lib & Utils</span>
        </div>
        <div className="flex items-center">
          <div
            className="w-3 h-3 rounded-full mr-3 shadow-[0_0_8px_#f59e0b]"
            style={{ background: "#f59e0b" }}
          />
          <span>Schema/Types</span>
        </div>
      </div>

      {/* Tooltip */}
      {tooltipData && (
        <div
          className="absolute bg-slate-900/95 border border-slate-700 p-3 rounded-lg text-white pointer-events-none z-20 shadow-2xl backdrop-blur-sm max-w-[320px] transition-opacity duration-200"
          style={{ left: tooltipData.x, top: tooltipData.y }}
        >
          <div
            className="font-bold mb-1 text-[15px] break-all"
            style={{ color: tooltipData.color }}
          >
            {tooltipData.title}
          </div>
          <div className="text-[11px] text-slate-400 font-mono bg-slate-800 p-1.5 rounded break-all mt-2">
            {tooltipData.path}
          </div>
        </div>
      )}

      {/* D3 Canvas */}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
