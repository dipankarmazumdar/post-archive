import type { ReactElement } from "react";

const font = "Open Sauce Sans, sans-serif";

const FIGURES: Record<string, () => ReactElement> = {
  "apache-iceberg": IcebergTable,
  "iceberg-internals": IcebergTable,
  "open-lakehouse": OpenLakehouse,
  "lakehouse-fast": OpenLakehouse,
  "data-engineering": EnginesOnParquet,
  streaming: StreamingPath,
  "streaming-lakehouse": StreamingPath,
  "ai-agents": AgentTools,
  "developer-tooling": RestCatalogClient,
};

export function ArchiveArt({ id }: { id: string }) {
  const Figure = FIGURES[id];
  if (!Figure) return null;
  return (
    <span className="card-figure">
      <Figure />
    </span>
  );
}

function IcebergTable() {
  return (
    <svg className="archive-art" viewBox="0 0 520 188" aria-hidden="true">
      <Marker id="ice" color="#c6f25a" />
      <Node x={12} y={14} w={108} h={42} title="Catalog" sub="metadata pointer" accent="#c6f25a" />
      <Node x={140} y={14} w={112} h={42} title="Metadata" sub="schema, snapshots" accent="#c6f25a" />
      <Node x={272} y={14} w={96} h={42} title="Snapshot" accent="#c6f25a" />
      <Node x={384} y={14} w={124} h={42} title="Manifest list" accent="#c6f25a" />
      <ArrowLine x1={120} y1={35} x2={136} y2={35} marker="ice" />
      <ArrowLine x1={252} y1={35} x2={268} y2={35} marker="ice" />
      <ArrowLine x1={368} y1={35} x2={380} y2={35} marker="ice" />
      <ArrowLine x1={430} y1={56} x2={360} y2={78} marker="ice" />
      <ArrowLine x1={470} y1={56} x2={470} y2={78} marker="ice" />
      <Node x={300} y={82} w={110} h={36} title="Manifest" accent="#8ec8ff" />
      <Node x={420} y={82} w={88} h={36} title="Manifest" accent="#8ec8ff" />
      <Node x={12} y={138} w={156} h={36} title="Parquet files" accent="#8ec8ff" />
      <Node x={180} y={138} w={156} h={36} title="Puffin statistics" accent="#c6f25a" />
      <Node x={348} y={138} w={160} h={36} title="Deletion vectors" accent="#8ec8ff" />
    </svg>
  );
}

function OpenLakehouse() {
  const rows = [
    ["Compute", "Spark · Flink · Trino · Dremio"],
    ["Table format", "Iceberg · Hudi · Delta Lake"],
    ["File format", "Parquet"],
    ["Storage", "Object store you own"],
  ];
  return (
    <svg className="archive-art" viewBox="0 0 520 188" aria-hidden="true">
      {rows.map(([layer, value], index) => {
        const y = 12 + index * 44;
        const accent = layer === "Table format" ? "#3ee0b0" : "#8ec8ff";
        return (
          <g key={layer}>
            <rect x="12" y={y} width="496" height="36" rx="8" fill="#182230" stroke={accent} strokeWidth="1.2" />
            <text x="26" y={y + 23} fill="#9aa6b4" fontFamily={font} fontSize="12">{layer}</text>
            <text x="494" y={y + 23} textAnchor="end" fill="#eef3f8" fontFamily={font} fontSize="13" fontWeight="600">{value}</text>
          </g>
        );
      })}
    </svg>
  );
}

function EnginesOnParquet() {
  return (
    <svg className="archive-art" viewBox="0 0 520 188" aria-hidden="true">
      <Marker id="eng" color="#7d8cff" />
      <Node x={24} y={18} w={140} h={44} title="Spark" accent="#7d8cff" />
      <Node x={190} y={18} w={140} h={44} title="Trino" accent="#7d8cff" />
      <Node x={356} y={18} w={140} h={44} title="DuckDB" accent="#7d8cff" />
      <ArrowLine x1={94} y1={62} x2={230} y2={104} marker="eng" />
      <ArrowLine x1={260} y1={62} x2={260} y2={104} marker="eng" />
      <ArrowLine x1={426} y1={62} x2={290} y2={104} marker="eng" />
      <Node x={70} y={108} w={380} h={52} title="Iceberg table" sub="Parquet files on object storage" accent="#8ec8ff" />
    </svg>
  );
}

function StreamingPath() {
  const steps = [
    ["Database", 12],
    ["CDC", 116],
    ["Kafka", 220],
    ["Flink", 324],
    ["Iceberg", 428],
  ] as const;
  return (
    <svg className="archive-art" viewBox="0 0 520 188" aria-hidden="true">
      <Marker id="flow" color="#d18bff" />
      {steps.map(([label, x], index) => (
        <g key={label}>
          <Node x={x} y={58} w={84} h={48} title={label} accent={label === "Iceberg" ? "#c6f25a" : "#d18bff"} />
          {index < steps.length - 1 ? <ArrowLine x1={x + 84} y1={82} x2={steps[index + 1][1] - 6} y2={82} marker="flow" /> : null}
        </g>
      ))}
      <text x={366} y={128} textAnchor="middle" fill="#9aa6b4" fontFamily={font} fontSize="12">checkpoints</text>
    </svg>
  );
}

function AgentTools() {
  return (
    <svg className="archive-art" viewBox="0 0 520 188" aria-hidden="true">
      <Marker id="mcp" color="#ff7eb6" />
      <Node x={16} y={70} w={100} h={44} title="Agent" accent="#ff7eb6" />
      <Node x={156} y={70} w={120} h={44} title="MCP server" accent="#ffc857" />
      <ArrowLine x1={116} y1={92} x2={150} y2={92} marker="mcp" />
      <ArrowLine x1={276} y1={84} x2={310} y2={40} marker="mcp" />
      <ArrowLine x1={276} y1={92} x2={318} y2={92} marker="mcp" />
      <ArrowLine x1={276} y1={100} x2={310} y2={144} marker="mcp" />
      <Node x={318} y={16} w={186} h={36} title="schema · SQL" accent="#8ec8ff" />
      <Node x={318} y={74} w={186} h={36} title="snapshots · time travel" accent="#8ec8ff" />
      <Node x={318} y={132} w={186} h={36} title="table health" accent="#8ec8ff" />
    </svg>
  );
}

function RestCatalogClient() {
  return (
    <svg className="archive-art" viewBox="0 0 520 188" aria-hidden="true">
      <Marker id="api" color="#ffc857" />
      <Node x={16} y={70} w={140} h={48} title="PyIceberg" sub="client SDK" accent="#ffc857" />
      <Node x={196} y={70} w={140} h={48} title="REST Catalog" sub="load and commit" accent="#ffc857" />
      <Node x={376} y={70} w={128} h={48} title="Metadata" sub="current snapshot" accent="#c6f25a" />
      <ArrowLine x1={156} y1={94} x2={190} y2={94} marker="api" />
      <ArrowLine x1={336} y1={94} x2={370} y2={94} marker="api" />
    </svg>
  );
}

function Marker({ id, color }: { id: string; color: string }) {
  return (
    <defs>
      <marker id={id} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
        <path d="M0 0 L8 4 L0 8 Z" fill={color} />
      </marker>
    </defs>
  );
}

function ArrowLine({ x1, y1, x2, y2, marker }: { x1: number; y1: number; x2: number; y2: number; marker: string }) {
  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#8ec8ff" strokeWidth="1.3" markerEnd={`url(#${marker})`} />;
}

function Node({ x, y, w, h, title, sub, accent }: { x: number; y: number; w: number; h: number; title: string; sub?: string; accent: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="8" fill="#182230" stroke={accent} strokeWidth="1.3" />
      <text x={x + w / 2} y={y + (sub ? h / 2 - 3 : h / 2 + 5)} textAnchor="middle" fill="#eef3f8" fontFamily={font} fontSize="13" fontWeight="600">
        {title}
      </text>
      {sub ? (
        <text x={x + w / 2} y={y + h / 2 + 13} textAnchor="middle" fill="#9aa6b4" fontFamily={font} fontSize="11">
          {sub}
        </text>
      ) : null}
    </g>
  );
}
