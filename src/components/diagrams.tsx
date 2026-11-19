import Link from "next/link";

const font = "Open Sauce Sans, sans-serif";

export function DiagramGallery() {
  return (
    <div className="diagram-grid">
      <Link className="diagram-card" href="/topics/apache-iceberg">
        <IcebergDiagram />
        <h3>Inside an Iceberg table</h3>
        <p>A snapshot points at manifests, and manifests point at the data files. Puffin sits beside them with statistics.</p>
      </Link>
      <Link className="diagram-card" href="/topics/open-lakehouse">
        <LakehouseDiagram />
        <h3>One lakehouse, many engines</h3>
        <p>Spark, Flink, Trino, and DuckDB read the same open tables stored as Parquet.</p>
      </Link>
      <Link className="diagram-card" href="/collections/streaming-lakehouse">
        <StreamingDiagram />
        <h3>Streaming into the table</h3>
        <p>Change data capture lands in Kafka, Flink processes it, and Iceberg stores the result.</p>
      </Link>
      <Link className="diagram-card" href="/topics/ai-agents">
        <AgentDiagram />
        <h3>An agent with tools</h3>
        <p>The agent calls the catalog, a SQL engine, and files through MCP instead of answering from memory.</p>
      </Link>
    </div>
  );
}

function IcebergDiagram() {
  return (
    <svg className="diagram" viewBox="0 0 520 228" aria-hidden="true">
      <Arrow id="ice" color="#c6f25a" />
      <Box x={168} y={16} w={132} h={40} title="Snapshot" accent="#c6f25a" />
      <Box x={360} y={16} w={132} h={40} title="Puffin" sub="statistics" accent="#c6f25a" />
      <line x1={300} y1={36} x2={356} y2={36} stroke="#c6f25a" strokeWidth="1.4" markerEnd="url(#ice)" />
      <line x1={234} y1={56} x2={234} y2={74} stroke="#c6f25a" strokeWidth="1.4" markerEnd="url(#ice)" />
      <Box x={150} y={78} w={168} h={36} title="Manifest list" accent="#c6f25a" />
      <line x1={190} y1={114} x2={92} y2={138} stroke="#c6f25a" strokeWidth="1.4" markerEnd="url(#ice)" />
      <line x1={234} y1={114} x2={234} y2={138} stroke="#c6f25a" strokeWidth="1.4" markerEnd="url(#ice)" />
      <line x1={278} y1={114} x2={376} y2={138} stroke="#c6f25a" strokeWidth="1.4" markerEnd="url(#ice)" />
      <Box x={28} y={142} w={128} h={32} title="Manifest" accent="#8ec8ff" />
      <Box x={170} y={142} w={128} h={32} title="Manifest" accent="#8ec8ff" />
      <Box x={312} y={142} w={128} h={32} title="Manifest" accent="#8ec8ff" />
      <Files x={36} y={186} />
      <Files x={178} y={186} />
      <Files x={320} y={186} />
    </svg>
  );
}

function LakehouseDiagram() {
  const engines = [
    ["Spark", 24],
    ["Flink", 142],
    ["Trino", 260],
    ["DuckDB", 378],
  ] as const;
  return (
    <svg className="diagram" viewBox="0 0 520 228" aria-hidden="true">
      <Arrow id="lake" color="#3ee0b0" />
      {engines.map(([label, x]) => (
        <g key={label}>
          <Box x={x} y={18} w={112} h={40} title={label} accent="#3ee0b0" />
          <line x1={x + 56} y1={58} x2={260} y2={92} stroke="#3ee0b0" strokeWidth="1.4" markerEnd="url(#lake)" />
        </g>
      ))}
      <Box x={70} y={96} w={380} h={44} title="Open table format" sub="Iceberg · Hudi · Delta Lake" accent="#3ee0b0" />
      <line x1={260} y1={140} x2={260} y2={164} stroke="#3ee0b0" strokeWidth="1.4" markerEnd="url(#lake)" />
      <Box x={70} y={168} w={380} h={40} title="Object storage · Parquet" accent="#8ec8ff" />
    </svg>
  );
}

function StreamingDiagram() {
  const steps = [
    ["Source", 16],
    ["CDC", 118],
    ["Kafka", 220],
    ["Flink", 322],
    ["Iceberg", 418],
  ] as const;
  return (
    <svg className="diagram" viewBox="0 0 520 228" aria-hidden="true">
      <Arrow id="stream" color="#d18bff" />
      {steps.map(([label, x], index) => (
        <g key={label}>
          <Box x={x} y={78} w={92} h={48} title={label} accent={index === steps.length - 1 ? "#c6f25a" : "#d18bff"} />
          {index < steps.length - 1 ? (
            <line x1={x + 92} y1={102} x2={steps[index + 1][1] - 8} y2={102} stroke="#d18bff" strokeWidth="1.4" markerEnd="url(#stream)" />
          ) : null}
        </g>
      ))}
      <text x={368} y={150} textAnchor="middle" fill="#9aa6b4" fontFamily={font} fontSize="12">checkpoints</text>
    </svg>
  );
}

function AgentDiagram() {
  return (
    <svg className="diagram" viewBox="0 0 520 228" aria-hidden="true">
      <Arrow id="agent" color="#ff7eb6" />
      <Box x={16} y={86} w={110} h={48} title="Question" accent="#ff7eb6" />
      <Box x={168} y={86} w={110} h={48} title="Agent" accent="#ff7eb6" />
      <Box x={320} y={86} w={84} h={48} title="MCP" accent="#ffc857" />
      <line x1={126} y1={110} x2={160} y2={110} stroke="#ff7eb6" strokeWidth="1.4" markerEnd="url(#agent)" />
      <line x1={278} y1={110} x2={312} y2={110} stroke="#ff7eb6" strokeWidth="1.4" markerEnd="url(#agent)" />
      <line x1={404} y1={98} x2={430} y2={46} stroke="#ffc857" strokeWidth="1.4" markerEnd="url(#agent)" />
      <line x1={404} y1={110} x2={436} y2={110} stroke="#ffc857" strokeWidth="1.4" markerEnd="url(#agent)" />
      <line x1={404} y1={122} x2={430} y2={176} stroke="#ffc857" strokeWidth="1.4" markerEnd="url(#agent)" />
      <Box x={436} y={18} w={76} h={36} title="Catalog" accent="#8ec8ff" />
      <Box x={436} y={92} w={76} h={36} title="SQL" accent="#8ec8ff" />
      <Box x={436} y={166} w={76} h={36} title="Files" accent="#8ec8ff" />
    </svg>
  );
}

function Arrow({ id, color }: { id: string; color: string }) {
  return (
    <defs>
      <marker id={id} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
        <path d="M0 0 L8 4 L0 8 Z" fill={color} />
      </marker>
    </defs>
  );
}

function Box({ x, y, w, h, title, sub, accent }: { x: number; y: number; w: number; h: number; title: string; sub?: string; accent: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="8" fill="#182230" stroke={accent} strokeWidth="1.4" />
      <text x={x + w / 2} y={y + (sub ? h / 2 - 4 : h / 2 + 5)} textAnchor="middle" fill="#eef3f8" fontFamily={font} fontSize="13" fontWeight="600">
        {title}
      </text>
      {sub ? (
        <text x={x + w / 2} y={y + h / 2 + 12} textAnchor="middle" fill="#9aa6b4" fontFamily={font} fontSize="11">
          {sub}
        </text>
      ) : null}
    </g>
  );
}

function Files({ x, y }: { x: number; y: number }) {
  return (
    <g>
      {[0, 28, 56, 84].map((offset) => (
        <rect key={offset} x={x + offset} y={y} width={22} height={18} rx="3" fill="#1d4e73" stroke="#8ec8ff" strokeWidth="1" />
      ))}
    </g>
  );
}
