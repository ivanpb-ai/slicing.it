/**
 * L4S Data Flow Visualization Web Component
 * 
 * Extends the NorthStar network-slice-viz pattern with L4S data flows.
 * Shows dedicated QoS flow/bearer and default QoS flow/bearer,
 * ECN marking at gNodeB, rate adaptation, and dual-queue AQM.
 *
 * Usage:
 *   <script src="l4s-flow-viz-webcomponent.js"></script>
 *   <l4s-flow-viz></l4s-flow-viz>
 *
 * No dependencies required - works in any modern browser.
 */

(function () {
  // ==========================================================================
  // CONSTANTS — matching NorthStar data model
  // ==========================================================================

  const SLICES = [
    { id: 'hp', snssai: '1-2018', name: 'High Priority', color: '#c4b5fd', rrp: 'Private', dnn: 'astazero.iot', desc: 'Vehicle Control & Video (AstaZero)', allowedQfi: null },
    { id: 'prem', snssai: '1-2015', name: 'Premium', color: '#86efac', rrp: 'Premium', dnn: 'v2x.northstar', desc: 'V2X / Industrial', allowedQfi: null },
    { id: 'be', snssai: '1-2014', name: 'Best Effort', color: '#cbd5e1', rrp: 'Basic', dnn: 'internet', desc: 'Standard connectivity', allowedQfi: [9] },
  ];

  const FIVE_QI_GROUPS = {
    dcGbr: {
      label: 'Delay-Critical GBR',
      rateType: 'GFBR',
      rateDesc: 'Guaranteed Flow Bit Rate — the network reserves this capacity',
      items: [
        { id: 83, prio: 22, delay: 10, loss: '1e-4', color: '#f43f5e', svc: 'Discrete Automation; V2X Platooning/Cooperative Lane Change', typSvc: 'Industrial Automation', typRate: '1 – 10 Mbps', comment: 'Extremely low latency (10 ms) for robotic control' },
        { id: 84, prio: 24, delay: 30, loss: '1e-5', color: '#a78bfa', svc: 'Intelligent Transport Systems', typSvc: 'Intelligent Transport', typRate: '0.5 – 5 Mbps', comment: 'Critical V2X communication (safety)' },
        { id: 86, prio: 18, delay: 5, loss: '1e-4', color: '#38bdf8', svc: 'V2X Collision Avoidance, Platooning (high LoA)', typSvc: 'V2X (Advanced)', typRate: '5 – 25 Mbps', comment: 'Cooperative driving and sensor sharing between vehicles' },
      ],
    },
    nonGbr: {
      label: 'Non-GBR',
      rateType: 'AMBR',
      rateDesc: 'Aggregate Maximum Bit Rate — determined by operator speed cap, not tied to 5QI',
      items: [
        { id: 7, prio: 70, delay: 100, loss: '1e-3', color: '#ec4899', svc: 'Voice, Video (Live Streaming), Interactive Gaming', typSvc: 'Music / Video (Live)', typRate: '1 – 20 Mbps', comment: 'Optimized for streaming media with low latency' },
        { id: 8, prio: 80, delay: 300, loss: '1e-6', color: '#b8c2c9', svc: 'Video (Buffered Streaming), TCP-based (www, email, ftp)', typSvc: 'Browsing / Email', typRate: '10 Mbps – 2 Gbps', comment: 'Standard best effort for most subscriptions' },
        { id: 9, prio: 90, delay: 300, loss: '1e-6', color: '#06b6d4', svc: 'Video (Buffered Streaming), TCP-based (www, email, ftp)', typSvc: 'Background Data', typRate: '10 Mbps – 2 Gbps', comment: 'Lowest priority, often used for free/unmetered browsing' },
        { id: 79, prio: 65, delay: 50, loss: '1e-2', color: '#34d399', svc: 'V2X messages', typSvc: 'V2X (Vehicle)', typRate: '5 – 50 Mbps', comment: 'Non-critical vehicle data (entertainment/info)' },
        { id: 80, prio: 68, delay: 10, loss: '1e-6', color: '#e879f9', svc: 'Low Latency eMBB, Augmented Reality', typSvc: 'AR / VR / Gaming', typRate: '50 – 250 Mbps', comment: 'Prioritized data for demanding real-time graphics' },
      ],
    },
  };

  const ALL_QFI = Object.values(FIVE_QI_GROUPS).flatMap(g => g.items);
  const getQfi = (id) => ALL_QFI.find(q => q.id === id) || ALL_QFI[0];
  const getQfiColor = (id) => (ALL_QFI.find(q => q.id === id) || {}).color || '#e879f9';

  // Phase labels for display (event-driven, not step-based)
  const PHASE_LABELS = {
    normal: { label: '▶ Normal Traffic', desc: 'No congestion. Normal traffic flow.', color: '#22c55e' },
    simStarted: { label: '🔍 L4S Flow Activated', desc: 'Normal traffic flow. Dedicated L4S QoS flow activated. UPF detecting ECT(1) codepoints.', color: '#22c55e' },
    congestionMarker: { label: '⚠ Congestion Detected', desc: 'Congestion detected at early stage by gNodeB. ECN marker inserted to tag dedicated L4S traffic.', color: '#ef4444' },
    rateAdapt: { label: '↓ Rate Adaptation', desc: 'Congestion information forwarded to endpoint. Rate adaptation applied to reduce bitrate smoothly.', color: '#f59e0b' },
    recovery: { label: '↑ Traffic Restored', desc: 'Congestion no longer present. Traffic restored to normal flow.', color: '#22c55e' },
  };

  // SVG layout
  const L = {
    svgW: 920, svgH: 600,
    nodeY: 128,
    dedPipeY: 90, dedPipeH: 44,
    defPipeY: 168, defPipeH: 38,
    pipeX1: 148, pipeX2: 758,
    ueX: 78, gnbX: 290, txX: 460, upfX: 630, srvX: 848,
    packetStartX: 760, packetEndX: 148,
    ecnY: 42,
  };

  // Speed per 5QI — matches unified-5g-viz-webcomponent.js getQoiSpeed
  const getQfiSpeed = (qoi) => ({ 86: 6, 83: 5.5, 84: 5, 79: 5, 80: 4.5, 7: 4, 6: 3, 8: 2.5, 9: 2.2 }[qoi] ?? 2.5);

  // =========================================================================
  // WEB COMPONENT
  // =========================================================================

  class L4SFlowViz extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this.state = {
        slice: SLICES[0],
        dedQfi: 7,
        defQfi: 9,
        direction: 'downlink',
        simRunning: false,
        simStep: 0,
        phase: 'normal',
        upfDetecting: false,
        rateAdapting: false,
        congested: false,
        defCongested: false,
        defHalted: false,
        defRecovering: false,
        ecnActive: false,
        dedReachedGnb: false,
        dedArrived: false,
        rateAdaptStep: 0,
        bitrate: 50,
        maxBitrate: 50,
        packets: [],
        tab: 'diagram',
        // Perplexity chat
        chatMessages: [],
        chatQuery: '',
        chatLoading: false,
      };
      this._simInterval = null;
      this._packetInterval = null;
    }

    connectedCallback() {
      this.render();
      this._startPackets();
    }

    disconnectedCallback() {
      this._stopSim();
      this._stopPackets();
    }

    // -- State ---------------------------------------------------------------
    setState(u) {
      Object.assign(this.state, u);
      this.render();
    }

    // -- Packet animation with positional coloring ---------------------------
    _startPackets() {
      this._stopPackets();
      this._packetInterval = setInterval(() => {
        const s = this.state;
        const { packets, simRunning, congested, direction, simStep, rateAdapting, defCongested, defHalted, defRecovering } = s;
        const isUL = direction === 'uplink';
        const isDownlink = !isUL;
        const dedActive = simRunning && simStep >= 13;
        const sign = isUL ? 1 : -1;

        // gNodeB positional threshold
        const gnbX = L.gnbX;
        const pastGnb = (x) => isDownlink ? x <= gnbX : x >= gnbX;
        const exitX = isUL ? L.packetStartX + 20 : L.packetEndX - 20;
        const pastEnd = (x) => isUL ? x >= exitX - 15 : x <= exitX + 15;

        // Phase tracking: detect when first dedicated packet reaches gNodeB
        if (!s.dedReachedGnb && packets.some(p => p.isDed && pastGnb(p.x))) {
          this.state.dedReachedGnb = true;
        }
        // Phase tracking: detect when first red (ECN-marked) dedicated packet reaches endpoint
        if (!s.dedArrived && s.dedReachedGnb && packets.some(p => p.isDed && p.ecnMarked && pastEnd(p.x))) {
          this.state.dedArrived = true;
        }

        // Phase flags
        const inCongestionPhase = congested;
        const inRateAdaptPhase = rateAdapting && s.dedArrived;
        const inDefSlowdown = defCongested;

        // Move existing packets
        let updated = packets.map(p => {
          let moved;
          // Packet-loss: while congestion is active but rate adaptation is not,
          // 5QI 9 packets are shown light-red and roughly 25-50% of them drop
          // out of the flow. The drops are spread continuously over time via a
          // small per-tick probability (each eligible packet has ~1% chance per
          // animation tick), so circles fall at different moments rather than
          // all at once. Applies to the default flow, and to the dedicated
          // flow only when it also uses 5QI 9 (after ECN-marking).
          const lossEligible = !p.falling && defHalted && !rateAdapting
            && p.qfi === 9 && (!p.isDed || p.ecnMarked);
          if (lossEligible && Math.random() < 0.01) {
            p = { ...p, falling: true, vy: 0 };
          }
          if (p.falling) {
            const vy = (p.vy || 0) + 0.6; // gravity
            moved = { ...p, vy, y: p.y + vy, x: p.x + sign * (p.speed * 0.15) };
          } else if (!p.isDed && inDefSlowdown) {
            moved = { ...p, x: p.x + sign * (p.speed * 0.3) };
          } else if (!p.isDed && defRecovering) {
            moved = { ...p, x: p.x + sign * (p.speed * 0.4) };
          } else {
            moved = { ...p, x: p.x + sign * p.speed };
          }

          // Positional coloring — use 5QI-specific color from FIVE_QI_GROUPS
          const qfiColor = getQfiColor(moved.qfi);
          // 5QI 9 packets use light red (packet-loss look) while congestion is
          // active but rate adaptation has not kicked in yet. All other 5QIs
          // keep the regular ECN-marked red.
          const congestionRed = (moved.qfi === 9 && !inRateAdaptPhase) ? '#fca5a5' : '#ef4444';
          if (moved.isDed) {
            if (inCongestionPhase || inRateAdaptPhase) {
              if (moved.spawnedOrange) {
                if (pastGnb(moved.x)) moved.ecnMarked = true;
                moved.qoiColor = '#f59e0b';
              } else if (pastGnb(moved.x)) {
                moved.qoiColor = congestionRed; // red / light red after gNodeB
                moved.ecnMarked = true;
              } else {
                // Before gNodeB: keep original 5QI color
                moved.qoiColor = qfiColor;
              }
            } else {
              // Normal/recovery: preserve orange/red for packets marked during congestion
              if (moved.spawnedOrange) {
                moved.qoiColor = '#f59e0b';
              } else if (moved.ecnMarked) {
                moved.qoiColor = '#ef4444';
              } else {
                moved.qoiColor = qfiColor;
              }
            }
          } else {
            // Default flow coloring
            if (defHalted) {
              moved.qoiColor = congestionRed;
            } else if (inDefSlowdown) {
              moved.qoiColor = '#fca5a5'; // light red during rate adaptation
            } else {
              moved.qoiColor = qfiColor;
            }
          }
          return moved;
        }).filter(p => {
          if (p.y > L.svgH + 20) return false; // dropped off the bottom (packet loss)
          return isUL ? p.x < L.packetStartX + 20 : p.x > L.packetEndX - 20;
        });

        // Spawn packets
        const spawnRoll = Math.random();

        if (spawnRoll > 0.55) {
          const isDed = dedActive ? (Math.random() > 0.35) : false;
          if (!isDed && defRecovering && Math.random() > 0.3) {
            // Skip some default spawns during recovery to show thinning
          } else {
            const baseY = isDed ? L.dedPipeY + L.dedPipeH / 2 : L.defPipeY + L.defPipeH / 2;
            const qfi = isDed ? s.dedQfi : s.defQfi;
            const col = isDed ? s.slice.color : '#94a3b8';
            const speed = getQfiSpeed(qfi);

            // Determine spawn color — use 5QI-specific color from FIVE_QI_GROUPS
            const qfiBaseColor = getQfiColor(qfi);
            let qoiColor, spawnedOrange = false;
            if (isDed) {
              if (inRateAdaptPhase) {
                qoiColor = '#f59e0b'; // orange spawn during rate adaptation
                spawnedOrange = true;
              } else {
                qoiColor = qfiBaseColor;
              }
            } else {
              // 5QI 9 packets use light red while congestion is active without rate adapt
              const spawnCongRed = (qfi === 9 && !inRateAdaptPhase) ? '#fca5a5' : '#ef4444';
              qoiColor = defHalted ? spawnCongRed : inDefSlowdown ? '#fca5a5' : qfiBaseColor;
            }

            updated.push({
              id: Date.now() + Math.random(),
              x: isUL ? L.packetEndX : L.packetStartX,
              y: baseY + (Math.random() - 0.5) * (isDed ? L.dedPipeH * 0.55 : L.defPipeH * 0.55),
              speed, dir: direction, color: col, qoiColor, qfi,
              size: isDed ? 9 : 8, isDed, spawnedOrange, ecnMarked: false,
            });
          }
        }

        this.state.packets = updated;
        this._updatePacketsOnly();
      }, 100);
    }

    _stopPackets() {
      if (this._packetInterval) { clearInterval(this._packetInterval); this._packetInterval = null; }
    }

    _updatePacketsOnly() {
      const g = this.shadowRoot.getElementById('packets-group');
      if (g) g.innerHTML = this._renderPackets();
    }

    // -- Simulation (event-driven 5-phase state machine) ---------------------
    _toggleSim() {
      if (this.state.simRunning) {
        this._stopSim();
        this.setState({
          simRunning: false, simStep: 0, phase: 'normal',
          upfDetecting: false, rateAdapting: false, congested: false,
          defCongested: false, defHalted: false, defRecovering: false, ecnActive: false,
          dedReachedGnb: false, dedArrived: false, rateAdaptStep: 0,
          bitrate: 50,
        });
        return;
      }
      this.setState({
        simRunning: true, simStep: 0, phase: 'simStarted', bitrate: 50,
        upfDetecting: false, rateAdapting: false, congested: false,
        defCongested: false, defHalted: false, defRecovering: false, ecnActive: false,
        dedReachedGnb: false, dedArrived: false, rateAdaptStep: 0,
      });
      let step = 0;
      this._simInterval = setInterval(() => {
        step++;
        const s = { simStep: step };
        const dedReachedGnb = this.state.dedReachedGnb;
        const dedArrived = this.state.dedArrived;
        const rateAdaptStep = this.state.rateAdaptStep || 0;

        // Phase 2 (simStarted): ECT(1) detection, ded flow activated
        // Stays until dedicated traffic reaches gNodeB
        if (!dedReachedGnb) {
          Object.assign(s, {
            phase: 'simStarted', upfDetecting: step <= 12,
            rateAdapting: false, congested: false,
            defCongested: false, defHalted: false, defRecovering: false, ecnActive: false,
          });
        }
        // Phase 3 (congestionMarker): ded reached gNodeB, ECN marking
        // Default flow halts (red, fully stopped) until rate adaptation kicks in
        else if (!dedArrived) {
          Object.assign(s, {
            phase: 'congestionMarker', upfDetecting: false,
            rateAdapting: false, congested: true,
            defCongested: false, defHalted: true, defRecovering: false, ecnActive: true,
          });
        }
        // Phase 4 (rateAdapt): red ded reached endpoint
        // Default flow starts moving again but slow (light red)
        else if (rateAdaptStep < 20) {
          Object.assign(s, {
            phase: 'rateAdapt', upfDetecting: false,
            rateAdapting: true, congested: true,
            defCongested: true, defHalted: false, defRecovering: false, ecnActive: true,
          });
          s.rateAdaptStep = rateAdaptStep + 1;
        }
        // Phase 5 (recovery): back to normal
        else {
          Object.assign(s, {
            phase: 'recovery', upfDetecting: false,
            rateAdapting: false, congested: false,
            defCongested: false, defHalted: false, defRecovering: false, ecnActive: false,
          });
          s.rateAdaptStep = rateAdaptStep + 1;
        }

        // Bitrate drain during rate adaptation, recovery after
        if (dedArrived && rateAdaptStep < 20) {
          s.bitrate = Math.max(10, this.state.bitrate - 3);
        }
        if (dedArrived && rateAdaptStep >= 23) {
          s.bitrate = Math.min(50, this.state.bitrate + 3);
        }

        // Loop reset after recovery
        if (dedArrived && rateAdaptStep >= 35) {
          step = 0;
          this.state.packets = [];
          Object.assign(s, {
            simStep: 0, bitrate: 50, phase: 'simStarted',
            upfDetecting: false, rateAdapting: false, congested: false,
            defCongested: false, defHalted: false, defRecovering: false, ecnActive: false,
            dedReachedGnb: false, dedArrived: false, rateAdaptStep: 0,
          });
        }
        this.setState(s);
      }, 700);
    }

    _stopSim() {
      if (this._simInterval) { clearInterval(this._simInterval); this._simInterval = null; }
    }

    // -- Perplexity Chat -----------------------------------------------------
    async _askPerplexity() {
      const q = this.state.chatQuery.trim();
      if (!q || this.state.chatLoading) return;
      const msgs = [...this.state.chatMessages, { role: 'user', text: q }];
      this.setState({ chatMessages: msgs, chatQuery: '', chatLoading: true });

      try {
        const history = msgs.map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text }));
        const res = await fetch('/.netlify/functions/perplexity-api', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: q, history }),
        });
        if (!res.ok) throw new Error(`API ${res.status}`);
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '', buffer = '';
        const assistantIdx = msgs.length;
        msgs.push({ role: 'assistant', text: '' });
        this.setState({ chatMessages: msgs });

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;
            try {
              const p = JSON.parse(data);
              const d = p.choices?.[0]?.delta?.content;
              if (d) {
                fullText += d;
                msgs[assistantIdx] = { role: 'assistant', text: fullText };
                this.setState({ chatMessages: [...msgs] });
              }
            } catch {}
          }
        }
      } catch (err) {
        msgs.push({ role: 'assistant', text: `Note: Perplexity API available on northstar.fyi (${err.message})` });
        this.setState({ chatMessages: msgs });
      } finally {
        this.setState({ chatLoading: false });
      }
    }

    // ========================================================================
    // RENDERING
    // ========================================================================

    render() {
      const s = this.state;
      const dedQfi = getQfi(s.dedQfi);
      const defQfi = getQfi(s.defQfi);
      const phase = PHASE_LABELS[s.phase] || PHASE_LABELS.normal;
      const isUL = s.direction === 'uplink';

      this.shadowRoot.innerHTML = `
        <style>${this._getStyles()}</style>
        <div class="container">
          <div class="header">
            <h1 class="title">Telia NorthStar: L4S Data Flows</h1>
            <p class="subtitle">Dedicated & default QoS bearers · ECN marking · rate adaptation · dual-queue AQM</p>
          </div>

          <!-- Controls row -->
          <div class="control-bar">
            <div class="button-group">
              ${SLICES.map(sl => `
                <button class="btn-filter" style="background-color:${s.slice.id === sl.id ? sl.color : '#475569'}; color:${s.slice.id === sl.id ? '#000' : '#fff'}"
                  data-action="set-slice" data-slice-id="${sl.id}">${sl.snssai} ${sl.name}</button>
              `).join('')}
            </div>
            <div class="button-group site-type-group">
              <button class="btn-site ${s.direction === 'downlink' ? 'btn-site-dl-active' : ''}" data-action="set-direction" data-dir="downlink">⬇ Downlink</button>
              <button class="btn-site ${s.direction === 'uplink' ? 'btn-site-ul-active' : ''}" data-action="set-direction" data-dir="uplink">⬆ Uplink</button>
            </div>
            <div class="button-group site-type-group">
              ${['diagram', 'mechanism', 'qfi-ref'].map(t => `
                <button class="btn-site ${s.tab === t ? 'btn-site-dedicated-active' : ''}" data-action="set-tab" data-tab="${t}">
                  ${t === 'diagram' ? 'L4S Diagram' : t === 'mechanism' ? 'L4S Mechanism' : '5QI Reference'}
                </button>
              `).join('')}
            </div>
          </div>

          <!-- 5QI selectors -->
          <div class="qfi-row">
            <div class="qfi-sel">
              <label>Dedicated Bearer (L4S):</label>
              <select data-action="set-ded-qfi">${this._qfiOptions(s.dedQfi, s.slice.allowedQfi)}</select>
              <span class="qfi-detail">${dedQfi.delay}ms · P${dedQfi.prio} · ${dedQfi.svc}</span>
            </div>
            <div class="qfi-sel">
              <label>Default Bearer:</label>
              <select data-action="set-def-qfi">${this._qfiOptions(s.defQfi, s.slice.allowedQfi)}</select>
              <span class="qfi-detail">${defQfi.delay}ms · P${defQfi.prio} · ${defQfi.svc}</span>
            </div>
            <div class="slice-info">
              S-NSSAI: ${s.slice.snssai} · RRP: ${s.slice.rrp} · DNN: ${s.slice.dnn}
            </div>
            <button class="btn-sim ${s.simRunning ? 'btn-sim-stop' : ''}" data-action="toggle-sim">
              ${s.simRunning ? '■ Stop Simulation' : '▶ Simulate L4S Congestion Response'}
            </button>
          </div>

          <!-- Tab content -->
          ${s.tab === 'diagram' ? this._renderDiagramTab(s, dedQfi, defQfi, phase) : ''}
          ${s.tab === 'mechanism' ? this._renderMechanismTab(s) : ''}
          ${s.tab === 'qfi-ref' ? this._renderQfiRefTab(s) : ''}

          <!-- Perplexity chat -->
          ${this._renderChat(s)}
        </div>
      `;
      this._attachEvents();
      // Scroll chat
      const chatScroll = this.shadowRoot.getElementById('chat-scroll');
      if (chatScroll) chatScroll.scrollTop = chatScroll.scrollHeight;
    }

    // -- QFI option builder
    _qfiOptions(selected, allowedQfi) {
      return Object.entries(FIVE_QI_GROUPS).map(([, g]) => {
        const filtered = allowedQfi ? g.items.filter(q => allowedQfi.includes(q.id)) : g.items;
        if (filtered.length === 0) return '';
        return `<optgroup label="${g.label}">${filtered.map(q =>
          `<option value="${q.id}" ${q.id === selected ? 'selected' : ''}>5QI ${q.id} — ${q.svc} (${q.delay}ms)</option>`
        ).join('')}</optgroup>`;
      }).join('');
    }

    // -- Diagram tab
    _renderDiagramTab(s, dedQfi, defQfi, phase) {
      const isUL = s.direction === 'uplink';
      const dedActive = s.simRunning && s.simStep >= 13;
      return `
        <svg viewBox="0 0 ${L.svgW} ${L.svgH}" class="svg-canvas">
          <defs>
            <pattern id="bgGrid" width="24" height="24" patternUnits="userSpaceOnUse">
              <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#1a2744" stroke-width="0.4"/>
            </pattern>
            <linearGradient id="dedGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stop-color="${s.slice.color}" stop-opacity="0.45"/>
              <stop offset="50%" stop-color="${s.slice.color}" stop-opacity="0.85"/>
              <stop offset="100%" stop-color="${s.slice.color}" stop-opacity="0.45"/>
            </linearGradient>
            <linearGradient id="defGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stop-color="#475569" stop-opacity="0.7"/>
              <stop offset="50%" stop-color="#64748b" stop-opacity="1"/>
              <stop offset="100%" stop-color="#475569" stop-opacity="0.7"/>
            </linearGradient>
            <marker id="arR" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0 0L10 5L0 10z" fill="#ef4444"/></marker>
            <marker id="arA" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0 0L10 5L0 10z" fill="#22c55e"/></marker>
            <filter id="glow"><feGaussianBlur stdDeviation="3" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          </defs>
          <rect width="${L.svgW}" height="${L.svgH}" fill="url(#bgGrid)"/>

          <!-- L4S marking domain -->
          <text x="460" y="18" text-anchor="middle" fill="${s.slice.color}" font-size="12.5" font-weight="bold" font-family="monospace" opacity="0.7">L4S Marking Domain</text>
          <line x1="200" y1="24" x2="730" y2="24" stroke="${s.slice.color}" stroke-width="1" stroke-dasharray="6 4" opacity="0.35"/>

          <!-- Direction labels — main data label rendered later (after ECN marker) so it stays on top -->
          <text x="460" y="${L.defPipeY + L.defPipeH + 20}" text-anchor="middle" fill="${isUL ? '#475569' : '#22c55e'}" font-size="10.5" font-family="monospace">${isUL ? '◄── Downlink: L4S Feedback / ACK from App Server to UE ──◄' : '──► Uplink: L4S Feedback / ACK from UE to App Server ──►'}</text>

          <!-- DEDICATED PIPE -->
          <text x="460" y="${L.dedPipeY - 8}" text-anchor="middle" fill="${dedActive ? '#fff' : '#64748b'}" font-size="14" font-weight="bold" font-family="monospace">QoS Flow (5QI ${s.dedQfi}) — Dedicated Bearer / L4S${!dedActive ? ' [inactive]' : ''}</text>
          <g opacity="${dedActive ? 1 : 0.3}">
            <rect x="${L.pipeX1}" y="${L.dedPipeY}" width="${L.pipeX2 - L.pipeX1}" height="${L.dedPipeH}" rx="22" fill="url(#dedGrad)"/>
            <rect x="${L.pipeX1 + 3}" y="${L.dedPipeY + 3}" width="${L.pipeX2 - L.pipeX1 - 6}" height="${L.dedPipeH - 6}" rx="19" fill="#ffffff08"/>
          </g>

          <!-- DEFAULT PIPE -->
          <text x="460" y="${L.defPipeY - 8}" text-anchor="middle" fill="#e2e8f0" font-size="13" font-weight="bold" font-family="monospace">QoS Flow (5QI ${s.defQfi}) — Default Bearer / Best-Effort</text>
          <rect x="${L.pipeX1}" y="${L.defPipeY}" width="${L.pipeX2 - L.pipeX1}" height="${L.defPipeH}" rx="19" fill="url(#defGrad)" stroke="#64748b" stroke-width="0.8" stroke-dasharray="8 4"/>

          <!-- NETWORK NODES -->
          ${this._svgNode(L.ueX, L.nodeY, 78, 130, '#ea580c', 'UE', '📱 App Client')}
          ${this._svgNode(L.gnbX, L.dedPipeY + L.dedPipeH / 2, 112, L.dedPipeH + 4, '#0369a1', 'gNodeB', 'RAN 📡', dedActive ? null : 0.35)}
          ${this._svgNode(L.gnbX, L.defPipeY + L.defPipeH / 2, 112, L.defPipeH, '#0369a1', '', 'RAN')}
          ${this._svgNode(L.txX, L.dedPipeY + L.dedPipeH / 2, 92, L.dedPipeH + 4, '#1d4ed8', 'Transport', '⇌ Network', dedActive ? null : 0.35)}
          ${this._svgNode(L.txX, L.defPipeY + L.defPipeH / 2, 92, L.defPipeH, '#1d4ed8', '', 'Transport')}
          ${this._svgNode(L.upfX, L.dedPipeY + L.dedPipeH / 2, 82, L.dedPipeH + 4, '#7c3aed', 'UPF', '5GC 🔀', dedActive ? null : 0.35)}
          ${this._svgNode(L.upfX, L.defPipeY + L.defPipeH / 2, 82, L.defPipeH, '#7c3aed', '', 'UPF')}
          ${this._svgNode(L.srvX, L.nodeY, 98, 130, '#ea580c', 'App Server', '🖥️ Edge')}

          <!-- gNodeB RADIO SCHEDULER PRIORITY INDICATOR (only during normal operation, before congestion) -->
          ${dedActive && !s.congested && !s.ecnActive && !s.rateAdapting ? `
            <g transform="translate(${L.gnbX}, ${L.defPipeY + L.defPipeH + 34})">
              <rect x="-68" y="0" width="136" height="${dedQfi.prio !== defQfi.prio ? 78 : 58}" rx="6" fill="#0c1527" stroke="#0369a1" stroke-width="1"/>
              <text text-anchor="middle" y="13" fill="#38bdf8" font-size="9.5" font-weight="bold" font-family="monospace">Radio Scheduler</text>
              <!-- Dedicated bearer priority -->
              <g transform="translate(-58, 20)">
                <rect x="0" y="0" width="116" height="14" rx="3" fill="${s.slice.color}30" stroke="${s.slice.color}" stroke-width="0.8"/>
                <text x="5" y="10.5" fill="${s.slice.color}" font-size="8.5" font-weight="bold" font-family="monospace">5QI ${dedQfi.id}: P${dedQfi.prio} ${dedQfi.delay}ms</text>
              </g>
              <!-- Default bearer priority -->
              <g transform="translate(-58, 38)">
                <rect x="0" y="0" width="116" height="14" rx="3" fill="#47556930" stroke="#64748b" stroke-width="0.8"/>
                <text x="5" y="10.5" fill="#94a3b8" font-size="8.5" font-family="monospace">5QI ${defQfi.id}: P${defQfi.prio} ${defQfi.delay}ms</text>
              </g>
              ${dedQfi.prio < defQfi.prio ? `
                <!-- Priority arrow showing dedicated is served first -->
                <text text-anchor="middle" y="68" fill="#22c55e" font-size="8.5" font-weight="bold" font-family="monospace">▲ 5QI ${dedQfi.id} served first (P${dedQfi.prio} < P${defQfi.prio})</text>
              ` : dedQfi.prio > defQfi.prio ? `
                <text text-anchor="middle" y="68" fill="#f59e0b" font-size="8.5" font-weight="bold" font-family="monospace">⚠ Default has higher priority</text>
              ` : `
                <text text-anchor="middle" y="68" fill="#94a3b8" font-size="8.5" font-family="monospace">Same priority — no isolation</text>
              `}
            </g>
          ` : ''}

          <!-- UPF DETECTION INDICATOR (during detection phase) -->
          ${s.upfDetecting ? `
            <g>
              <!-- Scanning pulse on UPF -->
              <circle cx="${L.upfX}" cy="${L.dedPipeY + L.dedPipeH / 2}" r="44" fill="none" stroke="#a78bfa" stroke-width="2" opacity="0.6">
                <animate attributeName="r" from="40" to="58" dur="1.2s" repeatCount="indefinite"/>
                <animate attributeName="opacity" from="0.7" to="0" dur="1.2s" repeatCount="indefinite"/>
              </circle>
              <circle cx="${L.upfX}" cy="${L.dedPipeY + L.dedPipeH / 2}" r="44" fill="none" stroke="#a78bfa" stroke-width="1.5" opacity="0.4">
                <animate attributeName="r" from="40" to="58" dur="1.2s" begin="0.4s" repeatCount="indefinite"/>
                <animate attributeName="opacity" from="0.5" to="0" dur="1.2s" begin="0.4s" repeatCount="indefinite"/>
              </circle>
              <!-- ECT(1) detection label -->
              <g transform="translate(${L.upfX}, ${L.ecnY})">
                <rect x="-48" y="-11" width="96" height="22" rx="6" fill="#7c3aed" stroke="#a78bfa" stroke-width="1.5" filter="url(#glow)"/>
                <text text-anchor="middle" y="4" fill="#fff" font-size="10.5" font-weight="bold" font-family="monospace">ECT(1) Detect</text>
                <circle r="16" fill="none" stroke="#a78bfa" stroke-width="0.8">
                  <animate attributeName="r" from="14" to="28" dur="1s" repeatCount="indefinite"/>
                  <animate attributeName="opacity" from="0.5" to="0" dur="1s" repeatCount="indefinite"/>
                </circle>
              </g>
              <!-- Arrow from UPF to dedicated pipe indicating flow establishment -->
              <line x1="${L.upfX}" y1="${L.ecnY + 11}" x2="${L.upfX}" y2="${L.dedPipeY - 2}" stroke="#a78bfa" stroke-width="1.5" stroke-dasharray="3 2">
                <animate attributeName="stroke-opacity" values="1;0.3;1" dur="0.8s" repeatCount="indefinite"/>
              </line>
              <!-- Incoming packet with ECT(1) mark — direction-aware -->
              <g>
                <circle r="6" fill="#a78bfa" opacity="0.9">
                  <animateMotion dur="2s" repeatCount="indefinite" path="${isUL
                    ? `M${L.ueX + 50},${L.dedPipeY + L.dedPipeH / 2} L${L.upfX - 40},${L.dedPipeY + L.dedPipeH / 2}`
                    : `M${L.srvX - 50},${L.dedPipeY + L.dedPipeH / 2} L${L.upfX + 40},${L.dedPipeY + L.dedPipeH / 2}`}"/>
                </circle>
                <text fill="#fff" font-size="9.5" font-weight="bold" text-anchor="middle">
                  <animateMotion dur="2s" repeatCount="indefinite" path="${isUL
                    ? `M${L.ueX + 50},${L.dedPipeY + L.dedPipeH / 2 + 3} L${L.upfX - 40},${L.dedPipeY + L.dedPipeH / 2 + 3}`
                    : `M${L.srvX - 50},${L.dedPipeY + L.dedPipeH / 2 + 3} L${L.upfX + 40},${L.dedPipeY + L.dedPipeH / 2 + 3}`}"/>
                  ECT
                </text>
              </g>
              <!-- Flow establishment info box -->
              <g transform="translate(${L.upfX}, ${L.defPipeY + L.defPipeH + 34})">
                <rect x="-85" y="0" width="170" height="65" rx="6" fill="#0c1527" stroke="#a78bfa" stroke-width="1.5">
                  <animate attributeName="stroke-opacity" values="1;0.4;1" dur="1.5s" repeatCount="indefinite"/>
                </rect>
                <text text-anchor="middle" y="14" fill="#a78bfa" font-size="10.5" font-weight="bold" font-family="monospace">UPF Packet Filter</text>
                <text text-anchor="middle" y="28" fill="#c4b5fd" font-size="9.5" font-family="monospace">IP header: ECT(1) detected</text>
                <text text-anchor="middle" y="40" fill="#c4b5fd" font-size="9.5" font-family="monospace">→ Map to dedicated QoS flow</text>
                <text text-anchor="middle" y="52" fill="${s.slice.color}" font-size="9.5" font-weight="bold" font-family="monospace">5QI ${s.dedQfi} bearer established</text>
              </g>
            </g>
          ` : ''}

          <!-- ECN MARKER at gNodeB -->
          <g transform="translate(${L.gnbX}, ${L.ecnY})">
            <circle r="13" fill="${s.ecnActive ? '#dc2626' : '#1e293b'}" stroke="${s.ecnActive ? '#fca5a5' : '#475569'}" stroke-width="1.5" ${s.ecnActive ? 'filter="url(#glow)"' : ''}/>
            <text text-anchor="middle" y="4" fill="#fff" font-size="10.5" font-weight="bold">ECN</text>
            ${s.ecnActive ? `<circle r="18" fill="none" stroke="#ef4444" stroke-width="0.8"><animate attributeName="r" from="13" to="26" dur="1s" repeatCount="indefinite"/><animate attributeName="opacity" from="0.6" to="0" dur="1s" repeatCount="indefinite"/></circle>` : ''}
          </g>
          <line x1="${L.gnbX}" y1="${L.ecnY + 13}" x2="${L.gnbX}" y2="${L.dedPipeY - 2}" stroke="${s.ecnActive ? '#ef4444' : '#475569'}" stroke-width="1" stroke-dasharray="3 2"/>
          ${s.ecnActive ? `<text x="${L.gnbX + 18}" y="${L.ecnY + 20}" fill="#ef4444" font-size="9.5" font-family="monospace">CE mark</text>` : ''}

          <!-- MAIN DATA DIRECTION LABEL — above the dedicated pipe, rendered after ECN/ECT(1) so it sits on top -->
          <text x="460" y="47" text-anchor="middle" fill="${isUL ? '#f59e0b' : '#c4b5fd'}" font-size="12" font-weight="bold" font-family="monospace">${isUL ? '──► Uplink: Data from UE to App Server ──►' : '◄── Downlink: Data from App Server to UE ──◄'}</text>

          <!-- L4S FEEDBACK PATH (during rate adaptation) — orange arrow, direction-aware -->
          ${s.simRunning && s.rateAdapting && s.dedArrived ? `
            ${isUL ? `
              <!-- Uplink: ECN feedback from App Server back to UE (full span) -->
              <path d="M ${L.srvX - 50},${L.defPipeY + L.defPipeH + 50} C ${L.srvX - 60},370 ${L.upfX + 20},380 ${L.upfX},375 C ${L.txX},365 ${L.gnbX},360 ${L.ueX + 40},355" fill="none" stroke="#f59e0b" stroke-width="3" stroke-dasharray="7 4" marker-end="url(#arA)" opacity="0.8"/>
              <text x="${(L.ueX + L.srvX) / 2}" y="395" text-anchor="middle" fill="#f59e0b" font-size="13" font-weight="bold" font-family="monospace">App Server → ECN Feedback → UE (rate adapt)</text>
            ` : `
              <!-- Downlink: ECN feedback from UE back to App Server (full span) -->
              <path d="M ${L.ueX + 40},${L.defPipeY + L.defPipeH + 50} C ${L.ueX + 60},370 ${L.gnbX - 20},380 ${L.gnbX},375 C ${L.txX},365 ${L.upfX},360 ${L.srvX - 50},355" fill="none" stroke="#f59e0b" stroke-width="3" stroke-dasharray="7 4" marker-end="url(#arA)" opacity="0.8"/>
              <text x="${(L.ueX + L.srvX) / 2}" y="395" text-anchor="middle" fill="#f59e0b" font-size="13" font-weight="bold" font-family="monospace">UE → ECN Feedback → App Server (rate adapt)</text>
            `}
          ` : ''}

          <!-- PACKETS -->
          <g id="packets-group">${this._renderPackets()}</g>

          <!-- CONGESTION INFO BOX (during congestion phase) -->
          ${s.congested ? `
            <g transform="translate(460, ${L.defPipeY + L.defPipeH + 34})">
              <rect x="-155" y="0" width="310" height="108" rx="6" fill="#0c1527" stroke="#ef4444" stroke-width="1.5">
                <animate attributeName="stroke-opacity" values="1;0.4;1" dur="1s" repeatCount="indefinite"/>
              </rect>
              <text text-anchor="middle" y="15" fill="#ef4444" font-size="11" font-weight="bold" font-family="monospace">Network Congestion Detected</text>
              <!-- Dedicated bearer -->
              <text x="-140" y="32" fill="#a78bfa" font-size="9" font-weight="bold" font-family="monospace">Dedicated (L4S):</text>
              <circle cx="-88" cy="46" r="6" fill="#ef4444"><animate attributeName="opacity" values="1;0.65;1" dur="0.3s" repeatCount="indefinite"/></circle>
              <text x="-88" y="49" text-anchor="middle" fill="#fff" font-size="6" font-weight="bold">${s.dedQfi}</text>
              <text x="-74" y="49" fill="#fca5a5" font-size="8.5" font-family="monospace">CE-marked → graceful rate adapt</text>
              <!-- Default bearer -->
              <text x="-140" y="68" fill="#64748b" font-size="9" font-weight="bold" font-family="monospace">Default (TCP CUBIC):</text>
              <circle cx="-88" cy="82" r="6" fill="#ef4444"><animate attributeName="opacity" values="1;0.65;1" dur="0.3s" repeatCount="indefinite"/></circle>
              <text x="-88" y="85" text-anchor="middle" fill="#fff" font-size="6" font-weight="bold">${s.defQfi}</text>
              <text x="-74" y="85" fill="#fca5a5" font-size="8.5" font-family="monospace">Queue full → packets stall & drop</text>
              <text text-anchor="middle" y="102" fill="#94a3b8" font-size="8" font-family="monospace">TCP CUBIC halves window on loss → slow sawtooth recovery</text>
            </g>
          ` : ''}

          <!-- RATE ADAPTATION INFO BOX (during rate adaptation phase) -->
          ${s.rateAdapting ? `
            <g transform="translate(460, ${L.defPipeY + L.defPipeH + 34})">
              <rect x="-155" y="0" width="310" height="108" rx="6" fill="#0c1527" stroke="#f59e0b" stroke-width="1.5">
                <animate attributeName="stroke-opacity" values="1;0.4;1" dur="1.5s" repeatCount="indefinite"/>
              </rect>
              <text text-anchor="middle" y="15" fill="#f59e0b" font-size="11" font-weight="bold" font-family="monospace">Rate Adaptation Active</text>
              <!-- Dedicated bearer -->
              <text x="-140" y="32" fill="#a78bfa" font-size="9" font-weight="bold" font-family="monospace">Dedicated (L4S):</text>
              <circle cx="-88" cy="46" r="6" fill="#f59e0b"><animate attributeName="opacity" values="1;0.65;1" dur="0.3s" repeatCount="indefinite"/></circle>
              <text x="-88" y="49" text-anchor="middle" fill="#fff" font-size="6" font-weight="bold">${s.dedQfi}</text>
              <text x="-74" y="49" fill="#fbbf24" font-size="8.5" font-family="monospace">Smooth rate reduction: ${s.bitrate}/${s.maxBitrate} Mbps</text>
              <!-- Default bearer -->
              <text x="-140" y="68" fill="#64748b" font-size="9" font-weight="bold" font-family="monospace">Default (TCP CUBIC):</text>
              <circle cx="-88" cy="82" r="6" fill="#fca5a5"><animate attributeName="opacity" values="1;0.65;1" dur="0.3s" repeatCount="indefinite"/></circle>
              <text x="-88" y="85" text-anchor="middle" fill="#fff" font-size="6" font-weight="bold">${s.defQfi}</text>
              <text x="-74" y="85" fill="#fca5a5" font-size="8.5" font-family="monospace">Slow restart after timeout</text>
              <text text-anchor="middle" y="102" fill="#94a3b8" font-size="8" font-family="monospace">TCP CUBIC: timeout → window=1 → slow ramp vs L4S: proportional adapt</text>
            </g>
          ` : ''}

          <!-- RECOVERY INFO BOX (congestion cleared) — placed right of Radio Scheduler -->
          ${s.phase === 'recovery' ? `
            <g transform="translate(620, ${L.defPipeY + L.defPipeH + 34})">
              <rect x="-140" y="0" width="280" height="92" rx="6" fill="#0c1527" stroke="#22c55e" stroke-width="1.5">
                <animate attributeName="stroke-opacity" values="1;0.5;1" dur="2s" repeatCount="indefinite"/>
              </rect>
              <text text-anchor="middle" y="16" fill="#22c55e" font-size="11" font-weight="bold" font-family="monospace">✓ Connection Back to Normal</text>
              <text x="-128" y="34" fill="#86efac" font-size="9" font-family="monospace">Congestion cleared at gNodeB — no more CE marks.</text>
              <text x="-128" y="48" fill="#86efac" font-size="9" font-family="monospace">Dedicated (L4S): bitrate ramping back to ${s.maxBitrate} Mbps.</text>
              <text x="-128" y="62" fill="#86efac" font-size="9" font-family="monospace">Default bearer: queues drained, normal throughput.</text>
              <text text-anchor="middle" y="82" fill="#94a3b8" font-size="8" font-family="monospace">End-to-end latency restored · ECT(1) flow continues steady-state</text>
            </g>
          ` : ''}

          <!-- PROTOCOL & REQUIREMENTS ANNOTATIONS — hidden during simulation to avoid obscuring other elements -->
          ${!s.simRunning ? `
          <g transform="translate(${L.pipeX1}, ${L.defPipeY + L.defPipeH + 34})">
            <!-- Transport Protocols -->
            <rect x="120" y="0" width="370" height="42" rx="6" fill="#0f172a" stroke="#334155" stroke-width="0.8"/>
            <text x="305" y="14" text-anchor="middle" fill="#0ea5e9" font-size="10.5" font-weight="bold" font-family="monospace">L4S Transport Protocols</text>
            <text x="305" y="27" text-anchor="middle" fill="#94a3b8" font-size="9.5" font-family="monospace">QUIC · TCP with Accurate ECN · WebRTC with L4S support</text>
            <text x="305" y="38" text-anchor="middle" fill="#64748b" font-size="8.5" font-family="monospace">Congestion control must use scalable algorithms (e.g. Prague, SCReAM)</text>
          </g>
          <!-- Server-side requirement (near App Server) — direction-aware -->
          <g transform="translate(${L.srvX}, ${L.defPipeY + L.defPipeH + 34})">
            <rect x="-65" y="0" width="130" height="52" rx="5" fill="#0f172a" stroke="#ea580c44" stroke-width="0.8"/>
            <text text-anchor="middle" y="13" fill="#fb923c" font-size="9.5" font-weight="bold" font-family="monospace">Server (${isUL ? 'Receiver' : 'Sender'})</text>
            ${isUL ? `
              <text text-anchor="middle" y="26" fill="#94a3b8" font-size="8.5" font-family="monospace">Preserve ECN bits</text>
              <text text-anchor="middle" y="37" fill="#94a3b8" font-size="8.5" font-family="monospace">Relay CE feedback to UE</text>
              <text text-anchor="middle" y="48" fill="#94a3b8" font-size="8.5" font-family="monospace">Support L4S feedback</text>
            ` : `
              <text text-anchor="middle" y="26" fill="#94a3b8" font-size="8.5" font-family="monospace">Congestion-aware algo</text>
              <text text-anchor="middle" y="37" fill="#94a3b8" font-size="8.5" font-family="monospace">(SCReAM for video)</text>
              <text text-anchor="middle" y="48" fill="#94a3b8" font-size="8.5" font-family="monospace">Mark packets ECT(1)</text>
            `}
          </g>
          <!-- Client-side requirement (near UE) — direction-aware -->
          <g transform="translate(${L.ueX}, ${L.defPipeY + L.defPipeH + 34})">
            <rect x="-55" y="0" width="110" height="52" rx="5" fill="#0f172a" stroke="#ea580c44" stroke-width="0.8"/>
            <text text-anchor="middle" y="13" fill="#fb923c" font-size="9.5" font-weight="bold" font-family="monospace">UE (${isUL ? 'Sender' : 'Receiver'})</text>
            ${isUL ? `
              <text text-anchor="middle" y="26" fill="#94a3b8" font-size="8.5" font-family="monospace">Congestion-aware algo</text>
              <text text-anchor="middle" y="37" fill="#94a3b8" font-size="8.5" font-family="monospace">Mark packets ECT(1)</text>
              <text text-anchor="middle" y="48" fill="#94a3b8" font-size="8.5" font-family="monospace">VPN/tunnel: copy ECN</text>
            ` : `
              <text text-anchor="middle" y="26" fill="#94a3b8" font-size="8.5" font-family="monospace">Preserve ECN bits</text>
              <text text-anchor="middle" y="37" fill="#94a3b8" font-size="8.5" font-family="monospace">Feed back CE to server</text>
              <text text-anchor="middle" y="48" fill="#94a3b8" font-size="8.5" font-family="monospace">VPN/tunnel: copy ECN</text>
            `}
          </g>
          ` : ''}

          <!-- BITRATE GAUGE -->
          <g transform="translate(80, 425)">
            <text x="0" y="-6" fill="#94a3b8" font-size="11.5" font-weight="bold" font-family="monospace">App Server Bitrate (L4S Rate-Adaptive)</text>
            <rect x="0" y="0" width="250" height="13" rx="6" fill="#0f172a" stroke="#334155" stroke-width="0.5"/>
            <rect x="0" y="0" width="${250 * (s.bitrate / s.maxBitrate)}" height="13" rx="6" fill="${s.congested ? '#ef4444' : s.bitrate / s.maxBitrate > 0.7 ? '#22c55e' : '#f59e0b'}"/>
            <text x="${250 * (s.bitrate / s.maxBitrate) + 8}" y="10" fill="#e2e8f0" font-size="11.5" font-weight="bold" font-family="monospace">${s.bitrate} Mbps</text>
          </g>

          <!-- CONGESTION ALERT -->
          ${s.congested ? `
            <g transform="translate(80, 455)">
              <rect x="0" y="0" width="160" height="26" rx="6" fill="#ef444420" stroke="#ef4444" stroke-width="1"/>
              <text x="80" y="17" text-anchor="middle" fill="#ef4444" font-size="12.5" font-weight="bold" font-family="monospace">⚠ RAN CONGESTION</text>
            </g>
          ` : ''}

          <!-- SIMULATION PHASE -->
          ${s.simRunning ? `
            <g transform="translate(420, 418)">
              <rect x="0" y="0" width="500" height="72" rx="8" fill="#0f172a" stroke="#1e293b" stroke-width="1"/>
              <text x="14" y="20" fill="${phase.color}" font-size="13" font-weight="bold" font-family="monospace">${phase.label}</text>
              ${phase.desc.length <= 65 ? `
                <text x="14" y="40" fill="#94a3b8" font-size="10" font-family="monospace">${phase.desc}</text>
              ` : `
                <text x="14" y="38" fill="#94a3b8" font-size="10" font-family="monospace">${phase.desc.slice(0, phase.desc.lastIndexOf(' ', 65))}</text>
                <text x="14" y="55" fill="#94a3b8" font-size="10" font-family="monospace">${phase.desc.slice(phase.desc.lastIndexOf(' ', 65) + 1)}</text>
              `}
            </g>
          ` : ''}

          <!-- EXPLANATORY TEXT -->
          <text x="460" y="${L.svgH - 52}" text-anchor="middle" fill="#94a3b8" font-size="11.5" font-style="italic">${isUL ? 'Uplink: UE streams data to App Server.' : 'Downlink: App Server streams data to UE.'} Same 5QI = same speed. Higher priority 5QI (e.g 5QI 79) = lower priority level (e.g. P65) = faster moving circles.</text>

          <!-- LEGEND -->
          <g transform="translate(80, ${L.svgH - 38})">
            <rect x="0" y="-10" width="760" height="18" rx="4" fill="#0f172a80"/>
            <text x="380" y="3" text-anchor="middle" fill="#a78bfa" font-size="10" font-family="monospace">ECN = Explicit Congestion Notification  ·  ECT(1) = this flow uses L4S-compatible scalable congestion control  ·  CE = Congestion Experienced</text>
          </g>

          <!-- SLICE BAR -->
          <g transform="translate(80, ${L.svgH - 25})">
            <rect x="0" y="0" width="760" height="22" rx="5" fill="${s.slice.color}10" stroke="${s.slice.color}40" stroke-width="0.5"/>
            <text x="12" y="15" fill="${s.slice.color}" font-size="11.5" font-weight="bold" font-family="monospace">S-NSSAI: ${s.slice.snssai} · DNN: ${s.slice.dnn} · RRP: ${s.slice.rrp} · ${s.slice.name} — ${s.slice.desc}</text>
          </g>
        </svg>
      `;
    }

    _svgNode(cx, cy, w, h, fill, label, sub, opacity) {
      return `
        <g transform="translate(${cx},${cy})" ${opacity != null ? `opacity="${opacity}"` : ''}>
          <rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="7" fill="${fill}" opacity="0.9" stroke="${fill}88" stroke-width="0.8"/>
          ${label ? `<text text-anchor="middle" y="${sub ? -4 : 4}" fill="#fff" font-size="${h > 30 ? 13 : 10}" font-weight="bold" font-family="monospace">${label}</text>` : ''}
          ${sub ? `<text text-anchor="middle" y="${label ? 12 : 4}" fill="#ffffffcc" font-size="10" font-family="monospace">${sub}</text>` : ''}
        </g>`;
    }

    _renderPackets() {
      return this.state.packets.map(p => `
        <g transform="translate(${p.x},${p.y})">
          <circle r="${p.size + 3}" fill="${p.color}" opacity="0.7"/>
          <circle r="${p.size}" fill="${p.qoiColor}"><animate attributeName="opacity" values="1;0.65;1" dur="0.3s" repeatCount="indefinite"/></circle>
          <text y="4" text-anchor="middle" fill="#fff" font-size="10.5" font-weight="bold">${p.qfi}</text>
        </g>
      `).join('');
    }

    // -- Mechanism tab
    _renderMechanismTab(s) {
      const steps = [
        ['0', '#a78bfa', 'App server sends time-critical traffic with <b>ECT(1)</b> codepoint in IP header, signaling L4S capability'],
        ['1', '#7c3aed', '<b>UPF packet filter</b> inspects IP headers, detects ECT(1) → establishes <b>dedicated QoS flow</b> mapped to low-latency 5QI'],
        ['2', '#0ea5e9', 'L4S-capable flows mapped to latency-optimized dedicated bearer, isolated from best-effort traffic'],
        ['3', '#f43f5e', 'gNodeB <b>Dual-Queue AQM</b> separates L4S traffic into short L queue (vs classic C queue)'],
        ['4', '#ef4444', 'On congestion: gNodeB marks packets <b>CE</b> (Congestion Experienced) at very low queue depth'],
        ['5', '#f59e0b', 'CE marks propagate to UE → UE feeds back via ACK/RTCP → App server detects congestion'],
        ['6', '#22c55e', '<b>Scalable congestion control</b> (Prague/SCReAM) reduces rate proportionally to CE fraction'],
        ['7', '#64748b', 'Separate bearer ensures <b>time-critical traffic</b> is never queued behind best-effort flows'],
      ];
      return `
        <div class="mechanism-panel">
          <div class="mech-col">
            <h3 style="color:${s.slice.color}">L4S in the NorthStar 5G Network</h3>
            ${steps.map(([n, c, t]) => `<div class="mech-step"><span style="color:${c};font-weight:bold">${n}.</span> ${t}</div>`).join('')}
          </div>
          <div class="mech-col">
            <h3 style="color:#f59e0b">AstaZero Remote Vehicle Control</h3>
            <p>The AstaZero research vehicle connects to NorthStar's high-priority slice with differentiated data flows.
            Vehicle control signaling uses a high-priority dedicated bearer (e.g. 5QI-86, 5ms delay).
            The video and heartbeat stream uses the dedicated L4S bearer for rate-adaptive streaming.
            A best-effort slice (5QI-9) serves the stationary parked vehicle.</p>
            <div class="mech-box" style="border-color:${s.slice.color}">
              <h4 style="color:${s.slice.color}">Why Dedicated L4S Bearer?</h4>
              <p>The dedicated bearer isolates time-critical traffic from best-effort flows, preventing queue buildup.
              With L4S, the app gracefully degrades video bitrate rather than suffering packet loss —
              keeping the remote operator's view smooth during congestion.</p>
            </div>
            <div class="mech-box" style="border-color:#a78bfa">
              <h4 style="color:#a78bfa">3GPP Standards</h4>
              <p>L4S support introduced in 3GPP Rel-17 (TS 23.501), aligned with IETF RFC 9330–9332.
              ECN marking at NG-RAN, UPF, or both. No dedicated 5QI for L4S — low-latency DC-GBR 5QIs used.
              Detection relies on ECT(1) codepoint in IP header.</p>
            </div>
          </div>
          <div class="mech-col">
            <h3 style="color:#0ea5e9">L4S End-to-End Requirements</h3>
            <div class="mech-box" style="border-color:#22c55e">
              <h4 style="color:#22c55e">Transport Protocols</h4>
              <p>L4S requires transport protocols with scalable congestion control:
              <b>QUIC</b> (with Prague CC), <b>TCP with Accurate ECN</b> (RFC 9332),
              and <b>WebRTC with L4S support</b> (using SCReAM or similar).
              The protocol must respond to ECN CE marks proportionally rather than multiplicatively.</p>
            </div>
            <div class="mech-box" style="border-color:#fb923c">
              <h4 style="color:#fb923c">Sender Requirements (Server in downlink, UE in uplink)</h4>
              <p>The sender must run a <b>congestion-aware rate adaptation algorithm</b> and mark outgoing packets with <b>ECT(1)</b>.
              For video streaming (e.g. remote vehicle control), <b>SCReAM</b> adjusts bitrate proportionally to the fraction of CE-marked packets.
              In downlink, the App Server is the sender. In uplink, the UE is the sender.</p>
            </div>
            <div class="mech-box" style="border-color:#f59e0b">
              <h4 style="color:#f59e0b">Receiver Requirements (UE in downlink, Server in uplink)</h4>
              <p>The receiver must <b>preserve ECN bits</b> in IP headers and <b>relay CE feedback</b> back to the sender
              (via TCP ACK or RTCP). <b>VPNs and tunneling solutions</b> (IPsec, GTP-U, WireGuard) must copy ECN
              from inner to outer headers and propagate CE marks — otherwise L4S signals are lost.</p>
            </div>
          </div>
        </div>`;
    }

    // -- 5QI Reference tab
    _renderQfiRefTab(s) {
      return Object.entries(FIVE_QI_GROUPS).map(([key, g]) => `
        <div class="qfi-table-section">
          <h3 style="color:${key === 'dcGbr' ? '#f43f5e' : '#0ea5e9'}">${g.label}</h3>
          <p style="color:#94a3b8;font-size:12px;font-family:monospace;margin-bottom:8px">
            <span style="color:${key === 'dcGbr' ? '#f43f5e' : '#0ea5e9'};font-weight:bold">${g.rateType}</span> — ${g.rateDesc}
          </p>
          <table class="config-table">
            <thead><tr>
              <th class="table-header">5QI</th><th class="table-header">Priority</th>
              <th class="table-header">Delay</th><th class="table-header">Loss</th>
              <th class="table-header">Service (3GPP)</th>
              <th class="table-header">Typical Use</th>
              <th class="table-header">${g.rateType} (DL)</th>
              <th class="table-header">Note</th>
            </tr></thead>
            <tbody>${g.items.map(q => `
              <tr class="table-row" style="background:${q.id === s.dedQfi ? s.slice.color + '15' : q.id === s.defQfi ? '#47556915' : 'transparent'}">
                <td class="table-cell" style="color:${q.id === s.dedQfi ? s.slice.color : q.id === s.defQfi ? '#94a3b8' : '#e2e8f0'};font-weight:bold">${q.id}${q.id === s.dedQfi ? ' ◄DED' : ''}${q.id === s.defQfi ? ' ◄DEF' : ''}</td>
                <td class="table-cell" style="color:#f59e0b">${q.prio}</td>
                <td class="table-cell" style="color:#22c55e">${q.delay}ms</td>
                <td class="table-cell" style="color:#94a3b8">${q.loss}</td>
                <td class="table-cell">${q.svc}</td>
                <td class="table-cell" style="color:#a78bfa">${q.typSvc}</td>
                <td class="table-cell" style="color:#0ea5e9;font-weight:bold">${q.typRate}</td>
                <td class="table-cell" style="color:#64748b;font-size:11px">${q.comment}</td>
              </tr>
            `).join('')}</tbody>
          </table>
        </div>
      `).join('');
    }

    // -- Perplexity chat panel
    _renderChat(s) {
      const msgs = s.chatMessages.map((m, i) => `
        <div class="chat-msg" style="border-left-color:${m.role === 'user' ? '#0ea5e9' : '#a78bfa'}; background:${m.role === 'user' ? '#1e293b' : '#0f172a'}">
          <div style="font-size:10px;color:${m.role === 'user' ? '#0ea5e9' : '#a78bfa'};font-family:monospace;margin-bottom:2px">${m.role === 'user' ? 'YOU' : 'PERPLEXITY'}</div>
          <div style="white-space:pre-wrap">${m.text}</div>
        </div>
      `).join('');
      return `
        <div class="chat-panel">
          <div class="chat-header">
            <span class="chat-dot"></span>
            <span style="color:#a78bfa;font-family:monospace;font-weight:bold;font-size:13px">Perplexity AI — NorthStar Context</span>
          </div>
          <div class="chat-body" id="chat-scroll">
            ${s.chatMessages.length === 0 ? '<div style="color:#475569;font-size:12px;font-family:monospace;line-height:1.6">Ask about the NorthStar 5G SA network, L4S, network slicing, AstaZero use cases. Powered by Perplexity sonar-pro.</div>' : msgs}
            ${s.chatLoading ? '<div style="color:#a78bfa;font-size:12px;font-family:monospace">Searching… ●</div>' : ''}
          </div>
          <div class="chat-input-row">
            <input id="chat-input" type="text" placeholder="Ask about NorthStar 5G, L4S, slicing…" value="${s.chatQuery}" />
            <button data-action="chat-send" ${s.chatLoading ? 'disabled' : ''}>Ask</button>
          </div>
        </div>`;
    }

    // ========================================================================
    // EVENT LISTENERS
    // ========================================================================

    _attachEvents() {
      this.shadowRoot.querySelectorAll('[data-action]').forEach(el => {
        const action = el.dataset.action;
        if (action === 'set-ded-qfi') {
          el.addEventListener('change', () => this.setState({ dedQfi: Number(el.value) }));
        } else if (action === 'set-def-qfi') {
          el.addEventListener('change', () => this.setState({ defQfi: Number(el.value) }));
        } else if (action === 'chat-send') {
          el.addEventListener('click', () => this._askPerplexity());
        } else {
          el.addEventListener('click', (e) => {
            switch (action) {
              case 'set-slice':
                const newSlice = SLICES.find(sl => sl.id === e.currentTarget.dataset.sliceId) || SLICES[0];
                const updates = { slice: newSlice };
                if (newSlice.allowedQfi) {
                  if (!newSlice.allowedQfi.includes(this.state.dedQfi)) updates.dedQfi = newSlice.allowedQfi[0];
                  if (!newSlice.allowedQfi.includes(this.state.defQfi)) updates.defQfi = newSlice.allowedQfi[0];
                }
                this.setState(updates);
                break;
              case 'set-tab':
                this.setState({ tab: e.currentTarget.dataset.tab });
                break;
              case 'set-direction':
                const newDir = e.currentTarget.dataset.dir;
                if (newDir !== this.state.direction) {
                  this.state.packets = [];
                  this._stopSim();
                  this.setState({ direction: newDir, simRunning: false, simStep: 0, phase: 'normal', upfDetecting: false, rateAdapting: false, congested: false, defCongested: false, defHalted: false, defRecovering: false, ecnActive: false, dedReachedGnb: false, dedArrived: false, rateAdaptStep: 0, bitrate: 50 });
                }
                break;
              case 'toggle-sim':
                this._toggleSim();
                break;
            }
          });
        }
      });
      // Chat input enter key
      const input = this.shadowRoot.getElementById('chat-input');
      if (input) {
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') this._askPerplexity();
        });
        input.addEventListener('input', (e) => { this.state.chatQuery = e.target.value; });
      }
    }

    // ========================================================================
    // STYLES — matching 5g-slice-viz-webcomponent.js palette exactly
    // ========================================================================

    _getStyles() {
      return `
        :host { display: block; font-family: system-ui, -apple-system, sans-serif; }
        .container { background-color: #0f172a; padding: 8px; border-radius: 12px; }
        .header { text-align: center; margin-bottom: 8px; }
        .title { font-size: 22px; font-weight: bold; color: white; margin: 0; }
        .subtitle { color: #94a3b8; font-size: 14px; margin: 4px 0 0 0; }

        .control-bar { display: flex; justify-content: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; align-items: center; }
        .button-group { display: flex; gap: 4px; background-color: #1e293b; border-radius: 4px; padding: 4px; }
        .site-type-group { background-color: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 4px 6px; gap: 8px; }
        .btn-filter { padding: 4px 10px; border-radius: 4px; font-size: 13px; border: none; cursor: pointer; transition: all 0.2s; }
        .btn-site {
          padding: 6px 14px; border-radius: 6px; font-size: 13px; font-weight: bold;
          border: 2px solid transparent; cursor: pointer; transition: all 0.3s ease;
          background: transparent; color: #94a3b8;
        }
        .btn-site:hover { color: #fff; background: rgba(255,255,255,0.1); }
        .btn-site-dedicated-active {
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          color: white; border-color: #60a5fa;
          box-shadow: 0 0 12px rgba(37,99,235,0.6), 0 0 24px rgba(37,99,235,0.3), inset 0 1px 0 rgba(255,255,255,0.2);
        }

        .btn-site-dl-active {
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          color: white; border-color: #60a5fa;
          box-shadow: 0 0 12px rgba(37,99,235,0.6), 0 0 24px rgba(37,99,235,0.3), inset 0 1px 0 rgba(255,255,255,0.2);
          animation: pulse-dl 2s ease-in-out infinite;
        }

        .btn-site-ul-active {
          background: linear-gradient(135deg, #ea580c 0%, #c2410c 100%);
          color: white; border-color: #fb923c;
          box-shadow: 0 0 12px rgba(234,88,12,0.6), 0 0 24px rgba(234,88,12,0.3), inset 0 1px 0 rgba(255,255,255,0.2);
          animation: pulse-ul 2s ease-in-out infinite;
        }

        @keyframes pulse-dl {
          0%, 100% { box-shadow: 0 0 12px rgba(37,99,235,0.6); }
          50% { box-shadow: 0 0 20px rgba(37,99,235,0.8); }
        }
        @keyframes pulse-ul {
          0%, 100% { box-shadow: 0 0 12px rgba(234,88,12,0.6); }
          50% { box-shadow: 0 0 20px rgba(234,88,12,0.8); }
        }

        .qfi-row { display: flex; gap: 10px; margin-bottom: 8px; flex-wrap: wrap; align-items: center; justify-content: center; }
        .qfi-sel { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #94a3b8; font-family: monospace; }
        .qfi-sel label { font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
        .qfi-sel select {
          background: #0c1527; color: #e2e8f0; border: 1px solid #334155; border-radius: 5px;
          padding: 5px 8px; font-size: 12px; font-family: monospace; cursor: pointer;
        }
        .qfi-detail { font-size: 12px; color: #475569; }
        .slice-info { font-size: 12px; color: #475569; font-family: monospace; }

        .svg-canvas { width: 100%; height: auto; background-color: #020617; border-radius: 8px; }

        .sim-btn-row { text-align: center; margin: 10px 0 8px; }
        .btn-sim {
          background: linear-gradient(135deg, #2563eb, #7c3aed);
          color: #fff; border: none; border-radius: 8px; padding: 10px 28px;
          font-size: 14px; font-weight: bold; font-family: monospace; cursor: pointer;
          transition: all 0.2s;
        }
        .btn-sim:hover { filter: brightness(1.15); transform: translateY(-1px); }
        .btn-sim-stop { background: linear-gradient(135deg, #dc2626, #b91c1c); }

        /* Mechanism tab */
        .mechanism-panel { display: flex; gap: 16px; padding: 12px; flex-wrap: wrap; }
        .mech-col { flex: 1; min-width: 280px; }
        .mech-col h3 { font-size: 15px; font-family: monospace; margin-bottom: 10px; }
        .mech-col p { font-size: 13px; color: #94a3b8; font-family: monospace; line-height: 1.7; margin-bottom: 10px; }
        .mech-step { font-size: 13px; color: #94a3b8; font-family: monospace; line-height: 1.7; margin-bottom: 6px; }
        .mech-box { background: #0f172a; border-radius: 8px; padding: 10px; border-left: 3px solid; margin-bottom: 10px; }
        .mech-box h4 { font-size: 12px; font-family: monospace; margin-bottom: 4px; }
        .mech-box p { font-size: 12px; color: #64748b; line-height: 1.6; margin: 0; }

        /* 5QI table */
        .qfi-table-section { margin-bottom: 14px; padding: 0 8px; }
        .qfi-table-section h3 { font-size: 14px; font-family: monospace; margin-bottom: 6px; }
        .config-table { width: 100%; font-size: 13px; border-collapse: collapse; font-family: monospace; }
        .table-header { text-align: left; padding: 5px 8px; color: #64748b; font-weight: 600; }
        .table-row { border-top: 1px solid #1e293b; }
        .table-cell { padding: 5px 8px; color: #cbd5e1; }

        /* Chat panel */
        .chat-panel { background: #0c1527; border: 1px solid #1e293b; border-radius: 10px; overflow: hidden; margin-top: 10px; }
        .chat-header { padding: 8px 12px; border-bottom: 1px solid #1e293b; display: flex; align-items: center; gap: 8px; background: linear-gradient(90deg, #7c3aed15, transparent); }
        .chat-dot { width: 8px; height: 8px; border-radius: 50%; background: #7c3aed; }
        .chat-body { padding: 10px; max-height: 200px; overflow-y: auto; font-size: 13px; color: #cbd5e1; font-family: monospace; line-height: 1.5; }
        .chat-msg { margin-bottom: 6px; padding: 5px 8px; border-radius: 5px; border-left: 2px solid; }
        .chat-input-row { padding: 8px; border-top: 1px solid #1e293b; display: flex; gap: 6px; }
        .chat-input-row input {
          flex: 1; background: #1e293b; color: #e2e8f0; border: 1px solid #334155;
          border-radius: 5px; padding: 7px 10px; font-size: 13px; font-family: monospace; outline: none;
        }
        .chat-input-row button {
          background: #7c3aed; color: #fff; border: none; border-radius: 5px;
          padding: 7px 16px; font-size: 13px; font-family: monospace; font-weight: bold; cursor: pointer;
        }
        .chat-input-row button:disabled { background: #334155; cursor: wait; }
        .chat-body::-webkit-scrollbar { width: 5px; }
        .chat-body::-webkit-scrollbar-track { background: #0a0f1e; }
        .chat-body::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 3px; }
      `;
    }
  }

  // Register
  customElements.define('l4s-flow-viz', L4SFlowViz);
})();