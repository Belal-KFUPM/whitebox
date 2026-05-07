import React, { useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Bell,
  Brain,
  Building2,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Cloud,
  Database,
  FileText,
  Gauge,
  HeartHandshake,
  Info,
  LineChart,
  LockKeyhole,
  Network,
  Play,
  Radar,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  ThermometerSun,
  Timer,
  UploadCloud,
  Wrench
} from "lucide-react";
import "./styles.css";

const cptSealFailure = {
  "false-false": 0.03,
  "false-true": 0.12,
  "true-false": 0.25,
  "true-true": 0.55
};

const cptHumanError = {
  false: 0.05,
  true: 0.2
};

const cptOilSpill = {
  "false-false": 0.005,
  "false-true": 0.15,
  "true-false": 0.4,
  "true-true": 0.8
};

const assets = [
  {
    id: "pump-a",
    name: "Pump A",
    area: "Crude transfer line",
    sensor: "SCADA + IoT",
    maintenance: 68,
    weather: 38,
    valueAtRisk: 3.8,
    premiumBase: 2.4,
    status: "Watch"
  },
  {
    id: "seal-17",
    name: "Seal / Valve 17",
    area: "Manifold station",
    sensor: "Inspection logs",
    maintenance: 82,
    weather: 61,
    valueAtRisk: 5.1,
    premiumBase: 3.2,
    status: "Elevated"
  },
  {
    id: "compressor-4",
    name: "Compressor 4",
    area: "Gas processing unit",
    sensor: "Historian feed",
    maintenance: 46,
    weather: 28,
    valueAtRisk: 2.1,
    premiumBase: 1.6,
    status: "Stable"
  }
];

const pipelineSteps = [
  { label: "SCADA", icon: Database, detail: "Live operating signals" },
  { label: "IoT", icon: Radar, detail: "Pressure and temperature" },
  { label: "Logs", icon: ClipboardCheck, detail: "Maintenance records" },
  { label: "Bayesian model", icon: Network, detail: "Causal dependency map" },
  { label: "Explain", icon: Brain, detail: "Root-cause probabilities" }
];

const scenarios = [
  {
    label: "Current shift",
    maintenance: 72,
    weather: 44,
    note: "Moderate maintenance drift with normal external conditions."
  },
  {
    label: "Storm alert",
    maintenance: 72,
    weather: 86,
    note: "Severe weather pushes both direct spill risk and human-error likelihood."
  },
  {
    label: "Deferred repair",
    maintenance: 91,
    weather: 44,
    note: "Maintenance issue becomes the dominant upstream risk driver."
  },
  {
    label: "Compound event",
    maintenance: 91,
    weather: 86,
    note: "Both root priors are active, producing the highest spill probability."
  }
];

const initialGraphNodes = {
  maintenance: { x: 80, y: 52, label: "Maintenance issue" },
  weather: { x: 520, y: 52, label: "Severe weather" },
  seal: { x: 300, y: 230, label: "Seal / valve failure" },
  human: { x: 520, y: 330, label: "Human error" },
  spill: { x: 300, y: 440, label: "Oil spill" }
};

const graphConnections = [
  ["maintenance", "seal"],
  ["weather", "seal"],
  ["weather", "human"],
  ["seal", "spill"],
  ["human", "spill"]
];

const graphValues = {
  maintenance: "pMaintenance",
  weather: "pWeather",
  seal: "pSeal",
  human: "pHuman",
  spill: "pSpill"
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function pct(value) {
  return `${Math.round(value * 100)}%`;
}

function money(value) {
  return `$${value.toFixed(1)}M`;
}

function probabilityFromSlider(value) {
  return clamp(value / 100, 0.01, 0.99);
}

function computeRisk(maintenanceSlider, weatherSlider) {
  const pMaintenance = probabilityFromSlider(maintenanceSlider);
  const pWeather = probabilityFromSlider(weatherSlider);

  const pSeal =
    cptSealFailure["true-true"] * pMaintenance * pWeather +
    cptSealFailure["true-false"] * pMaintenance * (1 - pWeather) +
    cptSealFailure["false-true"] * (1 - pMaintenance) * pWeather +
    cptSealFailure["false-false"] * (1 - pMaintenance) * (1 - pWeather);

  const pHuman =
    cptHumanError.true * pWeather + cptHumanError.false * (1 - pWeather);

  const pSpill =
    cptOilSpill["true-true"] * pSeal * pHuman +
    cptOilSpill["true-false"] * pSeal * (1 - pHuman) +
    cptOilSpill["false-true"] * (1 - pSeal) * pHuman +
    cptOilSpill["false-false"] * (1 - pSeal) * (1 - pHuman);

  const sealContribution = pSeal * 0.58;
  const weatherContribution = pWeather * 0.24;
  const maintenanceContribution = pMaintenance * 0.18;
  const total = sealContribution + weatherContribution + maintenanceContribution;

  return {
    pMaintenance,
    pWeather,
    pSeal,
    pHuman,
    pSpill,
    rootCauses: [
      {
        label: "Seal / valve failure",
        value: sealContribution / total,
        driver: "Depends on maintenance and weather"
      },
      {
        label: "Severe weather",
        value: weatherContribution / total,
        driver: "Raises human error and stresses equipment"
      },
      {
        label: "Maintenance issue",
        value: maintenanceContribution / total,
        driver: "Increases seal and valve failure likelihood"
      }
    ].sort((a, b) => b.value - a.value)
  };
}

function App() {
  const [selectedAssetId, setSelectedAssetId] = useState("seal-17");
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [maintenance, setMaintenance] = useState(scenarios[0].maintenance);
  const [weather, setWeather] = useState(scenarios[0].weather);
  const [reportReady, setReportReady] = useState(false);
  const [graphNodes, setGraphNodes] = useState(initialGraphNodes);
  const [graphView, setGraphView] = useState({ x: 0, y: 0, scale: 1 });
  const graphDrag = useRef(null);

  const selectedAsset = assets.find((asset) => asset.id === selectedAssetId);
  const risk = useMemo(() => computeRisk(maintenance, weather), [maintenance, weather]);
  const annualizedDowntime = selectedAsset.valueAtRisk * risk.pSpill * 12;
  const avoidedDowntime = selectedAsset.valueAtRisk * clamp(0.42 - risk.pSpill, 0.08, 0.34) * 12;
  const premiumReduction = selectedAsset.premiumBase * clamp(0.08 + risk.pSpill * 0.34, 0.08, 0.32);
  const confidence = clamp(0.93 - risk.pSpill * 0.2, 0.78, 0.94);

  function applyScenario(index) {
    const scenario = scenarios[index];
    setScenarioIndex(index);
    setMaintenance(scenario.maintenance);
    setWeather(scenario.weather);
    setReportReady(false);
  }

  function selectedAssetRisk(asset) {
    return computeRisk(asset.maintenance, asset.weather).pSpill;
  }

  function graphEdges() {
    return graphConnections.map(([from, to]) => {
      const start = graphNodes[from];
      const end = graphNodes[to];
      const startX = start.x + 80;
      const startY = start.y + 38;
      const endX = end.x + 80;
      const endY = end.y + 38;
      const midY = (startY + endY) / 2;
      return {
        id: `${from}-${to}`,
        d: `M ${startX} ${startY} C ${startX} ${midY}, ${endX} ${midY}, ${endX} ${endY}`
      };
    });
  }

  function startNodeDrag(event, nodeId) {
    if (event.pointerType === "mouse") return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    graphDrag.current = {
      type: "node",
      nodeId,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: graphNodes[nodeId]
    };
  }

  function startNodeMouseDrag(event, nodeId) {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startY = event.clientY;
    const origin = graphNodes[nodeId];
    const scale = graphView.scale;

    function handleMove(moveEvent) {
      setGraphNodes((current) => ({
        ...current,
        [nodeId]: {
          ...current[nodeId],
          x: clamp(origin.x + (moveEvent.clientX - startX) / scale, 16, 624),
          y: clamp(origin.y + (moveEvent.clientY - startY) / scale, 16, 506)
        }
      }));
    }

    function handleUp() {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    }

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  }

  function startCanvasDrag(event) {
    if (event.pointerType === "mouse") return;
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    graphDrag.current = {
      type: "canvas",
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: graphView
    };
  }

  function startCanvasMouseDrag(event) {
    if (event.button !== 0) return;
    const startX = event.clientX;
    const startY = event.clientY;
    const origin = graphView;

    function handleMove(moveEvent) {
      setGraphView((current) => ({
        ...current,
        x: clamp(origin.x + moveEvent.clientX - startX, -420, 220),
        y: clamp(origin.y + moveEvent.clientY - startY, -320, 180)
      }));
    }

    function handleUp() {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    }

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  }

  function moveGraph(event) {
    const drag = graphDrag.current;
    if (!drag) return;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;

    if (drag.type === "node") {
      setGraphNodes((current) => ({
        ...current,
        [drag.nodeId]: {
          ...current[drag.nodeId],
          x: clamp(drag.origin.x + deltaX / graphView.scale, 16, 624),
          y: clamp(drag.origin.y + deltaY / graphView.scale, 16, 506)
        }
      }));
    } else {
      setGraphView((current) => ({
        ...current,
        x: clamp(drag.origin.x + deltaX, -420, 220),
        y: clamp(drag.origin.y + deltaY, -320, 180)
      }));
    }
  }

  function stopGraphDrag(event) {
    if (graphDrag.current?.pointerId === event.pointerId) {
      graphDrag.current = null;
    }
  }

  function zoomGraph(direction) {
    setGraphView((current) => ({
      ...current,
      scale: clamp(current.scale + direction, 0.72, 1.55)
    }));
  }

  function handleGraphWheel(event) {
    event.preventDefault();
    zoomGraph(event.deltaY > 0 ? -0.08 : 0.08);
  }

  function resetGraph() {
    setGraphNodes(initialGraphNodes);
    setGraphView({ x: 0, y: 0, scale: 1 });
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <img className="brand-logo" src="/whitebox_logo.png" alt="Whitebox Analytics" />
        </div>

        <nav className="nav-list" aria-label="Demo navigation">
          <a className="nav-item active" href="#risk">
            <Gauge size={18} />
            Risk command
          </a>
          <a className="nav-item" href="#model">
            <Network size={18} />
            Bayesian model
          </a>
          <a className="nav-item" href="#report">
            <FileText size={18} />
            Explainability report
          </a>
          <a className="nav-item" href="#insurer">
            <HeartHandshake size={18} />
            Insurance view
          </a>
        </nav>

        <section className="sidebar-panel">
          <div className="panel-label">Target customer</div>
          <h2>Oil and gas operators</h2>
          <p>Built for high downtime cost, high insurance exposure, and safety-critical operations.</p>
          <div className="tags">
            <span>GCC industrial risk</span>
            <span>SCADA ready</span>
            <span>Audit-ready</span>
          </div>
        </section>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Bayesian risk SaaS demo</p>
            <h1>Explainable industrial failure risk</h1>
          </div>
          <div className="topbar-actions">
            <button className="icon-button" aria-label="Refresh risk model" title="Refresh risk model">
              <RefreshCw size={18} />
            </button>
            <button className="icon-button" aria-label="Notifications" title="Notifications">
              <Bell size={18} />
            </button>
            <button className="primary-button" onClick={() => setReportReady(true)}>
              <FileText size={18} />
              Generate report
            </button>
          </div>
        </header>

        <section className="hero-band" id="risk">
          <div className="hero-copy">
            <p className="eyebrow">MVP: Industrial oil-spill risk</p>
            <h2>Ask a risk question, then see why the answer changed.</h2>
            <p>
              Whitebox turns fragmented sensor, inspection, and maintenance data into decision-grade
              probabilities with causal root-cause explanations.
            </p>
          </div>
          <div className="hero-query">
            <Search size={18} />
            <span>P(OilSpill | SevereWeather, MaintenanceIssue)</span>
            <button className="run-button" aria-label="Run risk query">
              <Play size={16} />
            </button>
          </div>
        </section>

        <section className="pipeline" aria-label="Data pipeline">
          {pipelineSteps.map((step, index) => {
            const Icon = step.icon;
            return (
              <React.Fragment key={step.label}>
                <div className="pipeline-step">
                  <Icon size={20} />
                  <strong>{step.label}</strong>
                  <span>{step.detail}</span>
                </div>
                {index < pipelineSteps.length - 1 && <ArrowRight className="pipeline-arrow" size={18} />}
              </React.Fragment>
            );
          })}
        </section>

        <section className="content-grid">
          <div className="asset-column">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Connected assets</p>
                <h2>Plant risk inventory</h2>
              </div>
              <Building2 size={22} />
            </div>
            <div className="asset-list">
              {assets.map((asset) => {
                const riskValue = selectedAssetRisk(asset);
                const isActive = asset.id === selectedAssetId;
                return (
                  <button
                    key={asset.id}
                    className={`asset-card ${isActive ? "selected" : ""}`}
                    onClick={() => {
                      setSelectedAssetId(asset.id);
                      setMaintenance(asset.maintenance);
                      setWeather(asset.weather);
                      setReportReady(false);
                    }}
                  >
                    <span className={`asset-status ${asset.status.toLowerCase()}`}>{asset.status}</span>
                    <strong>{asset.name}</strong>
                    <span>{asset.area}</span>
                    <div className="asset-meta">
                      <span>{asset.sensor}</span>
                      <b>{pct(riskValue)} spill risk</b>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="main-column">
            <section className="risk-panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Live probability</p>
                  <h2>{selectedAsset.name}</h2>
                </div>
                <div className="risk-score">
                  <span>{pct(risk.pSpill)}</span>
                  <small>oil-spill risk</small>
                </div>
              </div>

              <div className="kpi-grid">
                <Kpi icon={AlertTriangle} label="Expected downtime exposure" value={money(annualizedDowntime)} />
                <Kpi icon={LineChart} label="Avoided downtime" value={money(avoidedDowntime)} />
                <Kpi icon={BarChart3} label="Premium reduction" value={money(premiumReduction)} />
                <Kpi icon={ShieldCheck} label="Model confidence" value={pct(confidence)} />
                <Kpi icon={Timer} label="Sales-cycle demo" value="3-6 mo" />
              </div>

              <div className="scenario-row">
                {scenarios.map((scenario, index) => (
                  <button
                    key={scenario.label}
                    className={`scenario-chip ${scenarioIndex === index ? "active" : ""}`}
                    onClick={() => applyScenario(index)}
                  >
                    {scenario.label}
                  </button>
                ))}
              </div>
              <p className="scenario-note">{scenarios[scenarioIndex].note}</p>

              <div className="slider-grid">
                <RiskSlider
                  icon={Wrench}
                  label="Maintenance issue"
                  value={maintenance}
                  onChange={setMaintenance}
                />
                <RiskSlider
                  icon={ThermometerSun}
                  label="Severe weather"
                  value={weather}
                  onChange={setWeather}
                />
              </div>
            </section>

            <section className="model-panel" id="model">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Causal graph</p>
                  <h2>Bayesian network explanation</h2>
                </div>
                <Brain size={22} />
              </div>
              <div className="model-layout">
                <div
                  className="network-diagram"
                  aria-label="Interactive Bayesian network"
                  onPointerDown={startCanvasDrag}
                  onPointerMove={moveGraph}
                  onPointerUp={stopGraphDrag}
                  onPointerCancel={stopGraphDrag}
                  onMouseDown={startCanvasMouseDrag}
                  onWheel={handleGraphWheel}
                >
                  <div className="graph-toolbar">
                    <span>Drag nodes or pan the model</span>
                    <div>
                      <button type="button" onClick={() => zoomGraph(-0.1)} aria-label="Zoom out">-</button>
                      <button type="button" onClick={resetGraph}>Reset</button>
                      <button type="button" onClick={() => zoomGraph(0.1)} aria-label="Zoom in">+</button>
                    </div>
                  </div>
                  <div
                    className="graph-stage"
                    style={{
                      transform: `translate(${graphView.x}px, ${graphView.y}px) scale(${graphView.scale})`
                    }}
                  >
                    <svg className="edges" viewBox="0 0 800 620" aria-hidden="true">
                      {graphEdges().map((edge) => (
                        <path key={edge.id} d={edge.d} />
                      ))}
                    </svg>
                    {Object.entries(graphNodes).map(([id, node]) => (
                      <Node
                        key={id}
                        label={node.label}
                        value={pct(risk[graphValues[id]])}
                        className={`node ${id === "spill" ? "spill-node" : ""}`}
                        style={{ left: node.x, top: node.y }}
                        onPointerDown={(event) => startNodeDrag(event, id)}
                        onPointerMove={moveGraph}
                        onPointerUp={stopGraphDrag}
                        onPointerCancel={stopGraphDrag}
                        onMouseDown={(event) => startNodeMouseDrag(event, id)}
                      />
                    ))}
                  </div>
                </div>

                <div className="root-causes">
                  <h3>Most likely root causes</h3>
                  {risk.rootCauses.map((cause, index) => (
                    <div className="cause-row" key={cause.label}>
                      <div className="cause-rank">{index + 1}</div>
                      <div>
                        <strong>{cause.label}</strong>
                        <span>{cause.driver}</span>
                      </div>
                      <div className="cause-meter">
                        <i style={{ width: `${Math.round(cause.value * 100)}%` }} />
                      </div>
                      <b>{pct(cause.value)}</b>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>

          <aside className="insight-column">
            <section className="report-panel" id="report">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Audit-ready output</p>
                  <h2>Explainability report</h2>
                </div>
                <FileText size={22} />
              </div>
              {reportReady ? (
                <div className="report-card ready">
                  <CheckCircle2 size={22} />
                  <strong>Report generated</strong>
                  <p>
                    The current risk is {pct(risk.pSpill)}. Primary driver is {risk.rootCauses[0].label.toLowerCase()}.
                  </p>
                  <ul>
                    <li>Query: P(OilSpill | evidence)</li>
                    <li>Evidence: maintenance {maintenance}%, weather {weather}%</li>
                    <li>Recommended action: inspect seal / valve assembly</li>
                  </ul>
                </div>
              ) : (
                <div className="report-card">
                  <UploadCloud size={22} />
                  <strong>Ready to generate</strong>
                  <p>Create a regulator and insurer friendly explanation with evidence, causal factors, and actions.</p>
                </div>
              )}
            </section>

            <section className="insurance-panel" id="insurer">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Insurance impact</p>
                  <h2>Premium clarity</h2>
                </div>
                <BadgeCheck size={22} />
              </div>
              <div className="premium-card">
                <div>
                  <span>Estimated premium leverage</span>
                  <strong>{money(premiumReduction)}</strong>
                </div>
                <div className="premium-bars">
                  <i style={{ height: "78%" }} />
                  <i style={{ height: `${clamp(78 - premiumReduction * 14, 32, 72)}%` }} />
                </div>
                <p>Transparent root-cause evidence gives operators a stronger negotiation package with insurers.</p>
              </div>
            </section>

            <section className="actions-panel">
              <div className="section-heading compact">
                <h2>Recommended actions</h2>
                <SlidersHorizontal size={20} />
              </div>
              <Action icon={Wrench} label="Schedule seal inspection" detail="Highest expected risk reduction" />
              <Action icon={Cloud} label="Storm operating mode" detail="Increase staffing and pressure checks" />
              <Action icon={LockKeyhole} label="Compliance package" detail="Attach causal report to audit log" />
            </section>
          </aside>
        </section>
      </section>
    </main>
  );
}

function Kpi({ icon: Icon, label, value }) {
  return (
    <div className="kpi-card">
      <Icon size={20} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function RiskSlider({ icon: Icon, label, value, onChange }) {
  return (
    <label className="slider-card">
      <div className="slider-header">
        <span>
          <Icon size={18} />
          {label}
        </span>
        <b>{value}%</b>
      </div>
      <input
        type="range"
        min="1"
        max="99"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function Node({
  label,
  value,
  className,
  style,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onMouseDown
}) {
  return (
    <div
      className={className}
      style={style}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onMouseDown={onMouseDown}
    >
      <strong>{label}</strong>
      <span>P(True) = {value}</span>
    </div>
  );
}

function Action({ icon: Icon, label, detail }) {
  return (
    <div className="action-row">
      <Icon size={18} />
      <div>
        <strong>{label}</strong>
        <span>{detail}</span>
      </div>
      <ChevronDown size={16} />
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
