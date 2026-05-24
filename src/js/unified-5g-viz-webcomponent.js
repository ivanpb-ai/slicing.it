/**
 * Unified 5G Network Visualization Web Component
 *
 * Merges the slice/RRP spectrum management view with L4S congestion
 * control flow detail into a single cohesive visualization.
 *
 * The L4S QoS flows (dedicated + default bearer) are rendered inside the
 * Private RRP box (dedicated site only). Starting the L4S simulation
 * auto-overloads the Private RRP with no borrowing possible.
 *
 * Usage:
 *   <script src="unified-5g-viz-webcomponent.js"></script>
 *   <unified-5g-viz></unified-5g-viz>
 */

(function () {
  // ==========================================================================
  // CONSTANTS
  // ==========================================================================

  const RRP_TYPES = [
    { id: 'private', name: 'Private', color: '#8b5cf6', dedicatedShare: 50, publicShare: 0 },
    { id: 'premium', name: 'Premium', color: '#22c55e', dedicatedShare: 10, publicShare: 10 },
    { id: 'basic', name: 'Basic', color: '#64748b', dedicatedShare: 10, publicShare: 50 },
  ];

  const INITIAL_DNNS = [
    { id: 'industrial', color: '#a78bfa', qois: [7, 79, 80], slices: ['slice-2018'] },
    { id: 'operational', color: '#34d399', qois: [7, 79, 6, 8], slices: ['slice-2015'] },
    { id: 'internet', color: '#818cf8', qois: [9], slices: ['slice-2014'] },
    { id: 'background', color: '#fbbf24', qois: [9], slices: ['slice-2014'] },
  ];

  const INITIAL_SLICES = [
    { id: 'slice-2018', snssai: '1-2018', name: 'Private', color: '#c4b5fd', rrpsDedicated: ['private'], rrpsPublic: ['private'] },
    { id: 'slice-2015', snssai: '1-2015', name: 'Premium', color: '#86efac', rrpsDedicated: ['premium'], rrpsPublic: ['premium'] },
    { id: 'slice-2014', snssai: '1-2014', name: 'Basic', color: '#cbd5e1', rrpsDedicated: ['basic'], rrpsPublic: ['basic'] },
  ];

  const QOI_INFO = [
    { id: 6, priority: 60, delay: '300ms', color: '#fb923c' },
    { id: 7, priority: 70, delay: '100ms', color: '#ec4899' },
    { id: 8, priority: 80, delay: '300ms', color: '#b8c2c9ff' },
    { id: 9, priority: 90, delay: '300ms', color: '#06b6d4' },
    { id: 79, priority: 65, delay: '50ms', color: '#34d399' },
    { id: 80, priority: 68, delay: '10ms', color: '#e879f9' },
  ];

  const FIVE_QI_GROUPS = {
    dcGbr: {
      label: 'Delay-Critical GBR', rateType: 'GFBR',
      rateDesc: 'Guaranteed Flow Bit Rate — the network reserves this capacity',
      items: [
        { id: 83, prio: 22, delay: 10, loss: '1e-4', svc: 'Discrete Automation; V2X Platooning/Cooperative Lane Change', typSvc: 'Industrial Automation', typRate: '1 – 10 Mbps', comment: 'Extremely low latency (10 ms) for robotic control' },
        { id: 84, prio: 24, delay: 30, loss: '1e-5', svc: 'Intelligent Transport Systems', typSvc: 'Intelligent Transport', typRate: '0.5 – 5 Mbps', comment: 'Critical V2X communication (safety)' },
        { id: 86, prio: 18, delay: 5, loss: '1e-4', svc: 'V2X Collision Avoidance, Platooning (high LoA)', typSvc: 'V2X (Advanced)', typRate: '5 – 25 Mbps', comment: 'Cooperative driving and sensor sharing between vehicles' },
      ],
    },
    nonGbr: {
      label: 'Non-GBR', rateType: 'AMBR',
      rateDesc: 'Aggregate Maximum Bit Rate — determined by operator speed cap, not tied to 5QI',
      items: [
        { id: 6, prio: 60, delay: 300, loss: '1e-6', svc: 'Video (Buffered Streaming), TCP-based (www, email, ftp)', typSvc: 'Diagnostic Data', typRate: '10 Mbps – 2 Gbps', comment: 'Non-real-time data with moderate priority' },
        { id: 7, prio: 70, delay: 100, loss: '1e-3', svc: 'Voice, Video (Live Streaming), Interactive Gaming', typSvc: 'Music / Video (Live)', typRate: '1 – 20 Mbps', comment: 'Optimized for streaming media with low latency' },
        { id: 8, prio: 80, delay: 300, loss: '1e-6', svc: 'Video (Buffered Streaming), TCP-based (www, email, ftp)', typSvc: 'Browsing / Email', typRate: '10 Mbps – 2 Gbps', comment: 'Standard best effort for most subscriptions' },
        { id: 9, prio: 90, delay: 300, loss: '1e-6', svc: 'Video (Buffered Streaming), TCP-based (www, email, ftp)', typSvc: 'Background Data', typRate: '10 Mbps – 2 Gbps', comment: 'Lowest priority, often used for free/unmetered browsing' },
        { id: 79, prio: 65, delay: 50, loss: '1e-2', svc: 'V2X messages', typSvc: 'V2X (Vehicle)', typRate: '5 – 50 Mbps', comment: 'Non-critical vehicle data (entertainment/info)' },
        { id: 80, prio: 68, delay: 10, loss: '1e-6', svc: 'Low Latency eMBB, Augmented Reality', typSvc: 'AR / VR / Gaming', typRate: '50 – 250 Mbps', comment: 'Prioritized data for demanding real-time graphics' },
      ],
    },
  };
  const ALL_QFI = Object.values(FIVE_QI_GROUPS).flatMap(g =>
    g.items.map(it => ({ ...it, color: (QOI_INFO.find(q => q.id === it.id) || {}).color }))
  );
  const getQfi = (id) => ALL_QFI.find(q => q.id === id) || ALL_QFI[0];

  const LAYOUT = {
    totalHeight: 800, gap: 10, minHeight: 100, maxHeight: 420,
    packetSpawnThreshold: 0.5, packetExitX: 720, packetStartX: 124,
    animationInterval: 100,
    rrpStartX: 30, rrpWidth: 660, sliceMargin: 12, dnnMargin: 8,
  };

  const L4S_H = 240;

  // ==========================================================================
  // UTILITIES
  // ==========================================================================

  // Direction-aware QoS flow labels per DNN
  // null = hidden in that direction
  const DNN_FLOW_LABELS = {
    operational: {
      7:  { uplink: 'Remote video', downlink: null },
      79: { uplink: null, downlink: 'Critical commands' },
      6:  { uplink: 'Diagnostic data streaming', downlink: null },
      8:  { uplink: 'Telemetry', downlink: null },
    },
    background: {
      9:  { uplink: 'Logs', downlink: 'OTA' },
    },
  };
  const getVisibleQois = (dnn, direction) => {
    const labels = DNN_FLOW_LABELS[dnn.id];
    if (!labels) return dnn.qois;
    return dnn.qois.filter(qoi => {
      const map = labels[qoi];
      if (!map) return true;
      return map[direction] !== null;
    });
  };

  const getQoiSpeed = (qoi) => ({ 86: 6, 83: 5.5, 84: 5, 79: 5, 80: 4.5, 7: 4, 6: 3, 8: 2.5, 9: 2.2 }[qoi] ?? 2.5);
  const getQfiSpeed = getQoiSpeed;
  const randomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const getSliceRrps = (slice, siteType) => siteType === 'dedicated' ? slice.rrpsDedicated : slice.rrpsPublic;
  const getRrpShare = (rrp, siteType) => siteType === 'dedicated' ? rrp.dedicatedShare : rrp.publicShare;
  const getRrpDisplayShare = (rrp, siteType) => siteType === 'public' && rrp.displayPublicShare != null ? rrp.displayPublicShare : getRrpShare(rrp, siteType);
  const getSliceDnns = (sliceId, dnns) => dnns.filter(dnn => dnn.slices.includes(sliceId));
  const deepClone = (obj) => JSON.parse(JSON.stringify(obj));


  // ==========================================================================
  // WEB COMPONENT
  // ==========================================================================

  class Unified5GViz extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });

      this.state = {
        slices: deepClone(INITIAL_SLICES),
        dnns: deepClone(INITIAL_DNNS),
        activeSlice: null,
        activeDnn: null,
        running: true,
        siteType: 'dedicated',
        configMode: 'none',
        packets: [],
        trafficLoad: { private: 60, premium: 60, basic: 60 },
        showSpectrumPanel: false,
        show5qiPanel: false,
        activeScenario: 'normal',

        // L4S (always targets private RRP, dedicated site only)
        flowDedQfi: 7,
        flowDefQfi: 9,
        flowPackets: [],
        l4sDirection: 'uplink',

        // L4S simulation state
        l4sSimRunning: false,
        l4sSimStep: 0,
        l4sUpfDetecting: false,
        l4sRateAdapting: false,
        l4sCongested: false,
        l4sDefCongested: false,
        l4sDefHalted: false,
        l4sDefRecovering: false,
        l4sEcnActive: false,
        l4sDedArrived: false,
        l4sDedReachedGnb: false,
        l4sRateAdaptStep: 0,
        l4sPhase: 'normal',
        l4sBitrate: 50,
        l4sMaxBitrate: 50,
      };

      this._macroInterval = null;
      this._flowInterval = null;
      this._simInterval = null;
      this._savedTrafficLoad = null;
    }

    _isL4SAvailable() {
      return this.state.siteType === 'dedicated';
    }

    connectedCallback() {
      this.render();
      this._startMacroAnimation();
      this._startFlowAnimation();
    }

    disconnectedCallback() {
      this._stopMacroAnimation();
      this._stopFlowAnimation();
      this._stopL4SSim();
    }

    setState(updates) {
      Object.assign(this.state, updates);
      this.render();
    }

    updateSpectrumPanelOnly() {
      const panel = this.shadowRoot.getElementById('spectrum-panel-container');
      if (panel) {
        panel.innerHTML = this.renderSpectrumPanelContent();
        this.attachSpectrumListeners();
      }
      const { dnns, activeSlice, activeDnn } = this.state;
      const spectrumState = this.getSpectrumState();
      const rrpConfig = this.getRrpConfig();

      const rrpGroup = this.shadowRoot.getElementById('rrp-boxes-group');
      if (rrpGroup) {
        rrpGroup.innerHTML = rrpConfig.map(rrp =>
          this.renderRrpBox(rrp, dnns, activeSlice, activeDnn, spectrumState)
        ).join('');
      }
      const svgOverlays = this.shadowRoot.getElementById('spectrum-overlays');
      if (svgOverlays) svgOverlays.innerHTML = this.renderSpectrumSvgOverlays();

      const statusText = this.shadowRoot.getElementById('status-text');
      if (statusText) {
        const suffix = spectrumState.some(r => r.isBorrowing) ? ' — Dynamic spectrum sharing active' : '';
        statusText.textContent = '5QI value circles move at different speeds to indicate different priorities' + suffix;
      }
    }

    // -----------------------------------------------------------------------
    // RRP Configuration & Spectrum Sharing
    // -----------------------------------------------------------------------

    getRrpConfig() {
      const { slices, siteType } = this.state;
      const { totalHeight, gap, minHeight, maxHeight } = LAYOUT;
      const getRrpSlices = (rrpId) => slices.filter(slice => getSliceRrps(slice, siteType).includes(rrpId));

      const specState = this.getSpectrumState();
      const anySharing = specState.some(r => r.isBorrowing || r.isDonating);

      const shares = RRP_TYPES.map((rrp, i) => {
        const guaranteed = getRrpShare(rrp, siteType);
        if (guaranteed === 0) return 0;
        if (anySharing) {
          const spec = specState[i];
          let actualDonated = 0;
          if (spec.isDonating && spec.surplus > 0) {
            specState.forEach(borrower => {
              borrower.donors.forEach(d => { if (d.id === spec.id) actualDonated += d.amount; });
            });
            actualDonated = Math.min(actualDonated, spec.surplus);
          }
          return Math.max(spec.guaranteed - actualDonated + spec.borrowed, 1);
        }
        return Math.max(guaranteed, 5);
      });

      // Filter out zero-share RRPs
      const activeIndices = shares.map((s, i) => ({ s, i })).filter(x => x.s > 0);
      const totalShares = activeIndices.reduce((a, x) => a + x.s, 0);
      if (totalShares === 0) return [];

      let initialHeights = activeIndices.map(x => (x.s / totalShares) * totalHeight);

      let excessHeight = 0, uncappedCount = 0;
      initialHeights = initialHeights.map(height => {
        if (height > maxHeight) { excessHeight += height - maxHeight; return maxHeight; }
        uncappedCount++; return height;
      });
      const redistribution = uncappedCount > 0 ? excessHeight / uncappedCount : 0;
      const finalHeights = initialHeights.map((height, idx) => {
        let h = height < maxHeight ? Math.max(height + redistribution, minHeight) : height;
        // Apply visual scaling AFTER redistribution to avoid capped-excess inflation
        const rrp = RRP_TYPES[activeIndices[idx].i];
        if (siteType === 'dedicated' && (rrp.id === 'premium' || rrp.id === 'basic')) h *= 1.25;
        // In public mode, scale premium proportionally to its share ratio vs basic
        // so spectrum sharing scenarios produce visible size changes
        if (siteType === 'public' && rrp.id === 'premium') {
          const premiumShare = activeIndices[idx].s;
          const basicEntry = activeIndices.find(x => RRP_TYPES[x.i].id === 'basic');
          const basicShare = basicEntry ? basicEntry.s : 50;
          const ratio = premiumShare / (premiumShare + basicShare);
          h = Math.max(totalHeight * ratio * 0.8, minHeight * 0.5);
        }
        return h;
      });

      let currentY = 28;
      return activeIndices.map((x, idx) => {
        const rrp = RRP_TYPES[x.i];
        const isL4sTarget = rrp.id === 'private' && siteType === 'dedicated';
        const height = finalHeights[idx] + (isL4sTarget ? L4S_H : 0);
        const baseY = currentY;
        currentY += height + gap;
        return { ...rrp, slices: getRrpSlices(rrp.id), height, baseY, share: getRrpShare(rrp, siteType), displayShare: getRrpDisplayShare(rrp, siteType), isL4sTarget };
      });
    }

    getSpectrumState() {
      const { trafficLoad, siteType } = this.state;
      const rrpStates = RRP_TYPES.map(rrp => {
        const guaranteed = getRrpShare(rrp, siteType);
        const demand = (guaranteed * trafficLoad[rrp.id]) / 100;
        const deficit = Math.max(0, demand - guaranteed);
        const surplus = Math.max(0, guaranteed - demand);
        return { ...rrp, guaranteed, demand, deficit, surplus };
      });
      const totalSurplus = rrpStates.reduce((sum, r) => sum + r.surplus, 0);
      const totalDeficit = rrpStates.reduce((sum, r) => sum + r.deficit, 0);

      const enriched = rrpStates.map(r => {
        let borrowed = 0;
        const donors = [];
        if (r.deficit > 0 && totalSurplus > 0) {
          const share = totalDeficit > 0 ? r.deficit / totalDeficit : 0;
          borrowed = Math.min(r.deficit, totalSurplus * share);
          rrpStates.forEach(donor => {
            if (donor.surplus > 0 && donor.id !== r.id) {
              const donorContrib = borrowed * (donor.surplus / totalSurplus);
              if (donorContrib > 0) donors.push({ id: donor.id, name: donor.name, color: donor.color, amount: donorContrib });
            }
          });
        }
        return {
          ...r, borrowed, donors,
          effectiveSpectrum: r.guaranteed + borrowed,
          isOverloaded: r.deficit > 0,
          isBorrowing: borrowed > 0,
          isDonating: r.surplus > 0 && totalDeficit > 0,
        };
      });
      // Compute actual donated amount per donor (may be less than total surplus)
      enriched.forEach(r => {
        let actualDonated = 0;
        if (r.isDonating && r.surplus > 0) {
          enriched.forEach(b => { b.donors.forEach(d => { if (d.id === r.id) actualDonated += d.amount; }); });
          actualDonated = Math.min(actualDonated, r.surplus);
        }
        r.actualDonated = actualDonated;
      });
      return enriched;
    }

    // -----------------------------------------------------------------------
    // L4S Layout Helper — computes pipe coordinates within Private RRP box
    // -----------------------------------------------------------------------

    _getL4SLayout() {
      if (!this._isL4SAvailable()) return null;
      const rrpConfig = this.getRrpConfig();
      const targetRrp = rrpConfig.find(r => r.id === 'private');
      if (!targetRrp) return null;
      const { rrpStartX, rrpWidth } = LAYOUT;
      const l4sBaseY = targetRrp.baseY + targetRrp.height - L4S_H;
      const isDownlink = this.state.l4sDirection === 'downlink';
      // Align UE and gNodeB with macro QoS flow positions
      const ueBoxCenterX = rrpStartX + LAYOUT.sliceMargin + 3 + 12; // sliceStartX + 3 + ueBoxW/2
      const adjDnnStartX = rrpStartX + LAYOUT.sliceMargin + LAYOUT.dnnMargin + 30; // dnnStartX + ueBoxOffset
      const gnbW = 22;
      const gnbMargin = 42;
      const gnbCenterX = adjDnnStartX + gnbMargin + gnbW / 2;
      const gnbRightEdge = adjDnnStartX + gnbMargin + gnbW;
      return {
        pipeX1: gnbRightEdge + 2,
        adjDnnStartX,
        pipeX2: rrpStartX + rrpWidth + 70,
        dedPipeY: l4sBaseY + 40,
        dedPipeH: 28,
        defPipeY: l4sBaseY + 92,
        defPipeH: 24,
        nodeY: l4sBaseY + 70,
        ecnY: l4sBaseY + 18,
        ueX: ueBoxCenterX,
        gnbX: gnbCenterX,
        txX: rrpStartX + 265,
        upfX: rrpStartX + rrpWidth + 42,
        srvX: rrpStartX + rrpWidth + 130,
        baseY: l4sBaseY,
        isDownlink,
      };
    }

    // -----------------------------------------------------------------------
    // Macro Animation (packets in slice overview)
    // -----------------------------------------------------------------------

    _startMacroAnimation() {
      this._stopMacroAnimation();
      this._macroInterval = setInterval(() => {
        if (!this.state.running) return;
        this._updateMacroPackets();
      }, LAYOUT.animationInterval);
    }

    _stopMacroAnimation() {
      if (this._macroInterval) { clearInterval(this._macroInterval); this._macroInterval = null; }
    }

    _updateMacroPackets() {
      const { packets, activeSlice, activeDnn, dnns } = this.state;
      const rrpConfig = this.getRrpConfig();

      const isDownlink = this.state.l4sDirection === 'downlink';
      let updated = packets.map(p => ({ ...p, x: isDownlink ? p.x - p.speed : p.x + p.speed }))
        .filter(p => isDownlink ? p.x > 68 : p.x < LAYOUT.packetExitX);

      if (Math.random() > LAYOUT.packetSpawnThreshold) {
        const newPacket = this._createMacroPacket(rrpConfig, activeSlice, activeDnn, dnns);
        if (newPacket) updated.push(newPacket);
      }

      this.state.packets = updated;
      const g = this.shadowRoot.getElementById('macro-packets-group');
      if (g) g.innerHTML = this._renderMacroPackets();
    }

    _createMacroPacket(rrpConfig, activeSlice, activeDnn, dnns) {
      const { trafficLoad } = this.state;
      const spectrumState = this.getSpectrumState();
      const availableRrps = rrpConfig.filter(rrp => rrp.share > 0 && rrp.slices.length > 0);
      if (!availableRrps.length) return null;

      const weights = availableRrps.map(r => trafficLoad[r.id] || 1);
      const totalWeight = weights.reduce((a, b) => a + b, 0);
      let rand = Math.random() * totalWeight;
      let rrpIndex = 0;
      for (let i = 0; i < weights.length; i++) { rand -= weights[i]; if (rand <= 0) { rrpIndex = i; break; } }

      const rrp = availableRrps[rrpIndex];
      const rrpSpec = spectrumState.find(s => s.id === rrp.id);
      const availableSlices = activeSlice ? rrp.slices.filter(s => s.id === activeSlice) : rrp.slices;
      if (!availableSlices.length) return null;

      const slice = randomElement(availableSlices);
      const sliceDnns = getSliceDnns(slice.id, dnns);
      if (!sliceDnns.length) return null;

      const availableDnns = activeDnn ? sliceDnns.filter(d => d.id === activeDnn) : sliceDnns;
      if (!availableDnns.length) return null;

      const dnn = randomElement(availableDnns);
      const dirKey = this.state.l4sDirection || 'uplink';
      const visQois = getVisibleQois(dnn, dirKey);
      if (!visQois.length) return null;
      const qoi = randomElement(visQois);
      const qoiData = QOI_INFO.find(q => q.id === qoi);
      if (!qoiData) return null;

      const contentHeight = rrp.height - (rrp.isL4sTarget ? L4S_H : 0);
      const sliceIndex = rrp.slices.findIndex(s => s.id === slice.id);
      const sliceHeight = (contentHeight - 20) / rrp.slices.length;
      const sliceY = rrp.baseY + 18 + sliceIndex * sliceHeight;
      const dnnIndex = sliceDnns.findIndex(d => d.id === dnn.id);
      const dnnHeight = (sliceHeight - 18) / sliceDnns.length;

      const qoiIndex = visQois.indexOf(qoi);
      const showQosLanes = dnnHeight > 28 && visQois.length > 0;
      let packetY;
      if (showQosLanes && qoiIndex >= 0) {
        const qosHeaderH = 12;
        const qosAreaY = sliceY + 16 + dnnIndex * dnnHeight + qosHeaderH + 2;
        const qosAreaH = dnnHeight - qosHeaderH - 5;
        const qosFlowH = qosAreaH / visQois.length;
        packetY = qosAreaY + qoiIndex * qosFlowH + qosFlowH / 2;
        packetY += (Math.random() - 0.5) * (qosFlowH * 0.5);
      } else {
        const dnnY = sliceY + 16 + dnnIndex * dnnHeight + dnnHeight / 2;
        packetY = dnnY + (Math.random() - 0.5) * (dnnHeight * 0.4);
      }

      return {
        id: Date.now() + Math.random(),
        x: this.state.l4sDirection === 'downlink' ? LAYOUT.packetExitX : 68, y: packetY,
        qoiColor: qoiData.color, sliceColor: slice.color,
        speed: getQoiSpeed(qoi), qoi, size: 7,
        borrowed: rrpSpec && rrpSpec.isBorrowing,
        rrpId: rrp.id, dnnId: dnn.id,
      };
    }

    // -----------------------------------------------------------------------
    // Flow Detail Animation (L4S packets inside Private RRP box)
    // -----------------------------------------------------------------------

    _startFlowAnimation() {
      this._stopFlowAnimation();
      this._flowInterval = setInterval(() => {
        if (!this.state.running) return;
        this._updateFlowPackets();
      }, 100);
    }

    _stopFlowAnimation() {
      if (this._flowInterval) { clearInterval(this._flowInterval); this._flowInterval = null; }
    }

    _updateFlowPackets() {
      const s = this.state;
      if (!this._isL4SAvailable()) {
        if (s.flowPackets.length > 0) this.state.flowPackets = [];
        return;
      }
      const fl = this._getL4SLayout();
      if (!fl) return;

      const dedActive = s.l4sSimRunning && s.l4sSimStep >= 13;

      const specState = this.getSpectrumState();
      const targetSpec = specState.find(r => r.id === 'private');
      const isOverloaded = targetSpec && targetSpec.isOverloaded;

      const isDownlink = fl.isDownlink;
      const flowDir = isDownlink ? -1 : 1;
      const exitX = isDownlink ? fl.ueX - 10 : fl.pipeX2 + 20;
      const spawnX = isDownlink ? fl.pipeX2 - 10 : fl.ueX + 10;
      // gNodeB threshold: where dedicated packets get ECN-marked
      const gnbX = fl.gnbX;
      const pastGnb = (x) => isDownlink ? x <= gnbX : x >= gnbX;
      const pastEnd = (x) => isDownlink ? x <= exitX + 15 : x >= exitX - 15;

      // Phase tracking: detect when first dedicated packet reaches gNodeB
      if (!s.l4sDedReachedGnb && s.flowPackets.some(p => p.isDed && pastGnb(p.x))) {
        this.state.l4sDedReachedGnb = true;
      }
      // Phase tracking: detect when first red (ECN-marked) dedicated packet reaches endpoint
      if (!s.l4sDedArrived && s.l4sDedReachedGnb && s.flowPackets.some(p => p.isDed && p.ecnMarked && pastEnd(p.x))) {
        this.state.l4sDedArrived = true;
      }

      // Phase flags
      const inCongestionPhase = s.l4sCongested && isOverloaded;
      const inRateAdaptPhase = s.l4sRateAdapting && isOverloaded && s.l4sDedArrived;
      const inDefSlowdown = s.l4sDefCongested && isOverloaded;
      const inDefHalt = s.l4sDefHalted && isOverloaded;
      const inDefRecovery = s.l4sDefRecovering && isOverloaded;

      let updated = s.flowPackets.map(p => {
        let moved;
        // Packet-loss: while congestion is active but rate adaptation is not,
        // 5QI 9 packets are shown light-red and roughly 25-50% of them drop
        // out of the flow. The drops are spread continuously over time via a
        // small per-tick probability (each eligible packet has ~1% chance per
        // animation tick), so circles fall at different moments rather than
        // all at once. Applies to the default flow, and to the dedicated
        // flow only when it also uses 5QI 9 (after ECN-marking).
        const lossEligible = !p.falling && inDefHalt && !inRateAdaptPhase
          && p.qfi === 9 && (!p.isDed || p.ecnMarked);
        if (lossEligible && Math.random() < 0.01) {
          p = { ...p, falling: true, vy: 0 };
        }
        if (p.falling) {
          const vy = (p.vy || 0) + 0.6; // gravity
          moved = { ...p, vy, y: p.y + vy, x: p.x + p.speed * 0.15 * flowDir };
        } else if (!p.isDed && inDefSlowdown) {
          moved = { ...p, x: p.x + p.speed * 0.3 * flowDir };
        } else if (!p.isDed && inDefRecovery) {
          moved = { ...p, x: p.x + p.speed * 0.4 * flowDir };
        } else {
          moved = { ...p, x: p.x + p.speed * flowDir };
        }

        // Positional coloring — use 5QI-defined color from QOI_INFO
        const qfiColor = (QOI_INFO.find(q => q.id === moved.qfi) || {}).color || '#e879f9';
        // 5QI 9 packets use light red (packet-loss look) while congestion is
        // active but rate adaptation has not kicked in yet. Other 5QIs keep
        // the regular ECN-marked red.
        const congestionRed = (moved.qfi === 9 && !inRateAdaptPhase) ? '#fca5a5' : '#ef4444';
        if (moved.isDed) {
          if (inCongestionPhase || inRateAdaptPhase) {
            if (moved.spawnedOrange) {
              // Spawned as orange during rate adaptation — stays orange
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
          if (inDefHalt) {
            moved.qoiColor = congestionRed;
          } else if (inDefSlowdown) {
            moved.qoiColor = '#fca5a5'; // light red during rate adaptation
          } else {
            moved.qoiColor = qfiColor;
          }
        }
        return moved;
      }).filter(p => {
        if (p.y > fl.baseY + L4S_H + 10) return false; // dropped off the bottom (packet loss)
        return isDownlink ? p.x > exitX : p.x < exitX;
      });

      const spawnRoll = Math.random();

      if (spawnRoll > 0.55) {
        const isDed = dedActive ? (Math.random() > 0.35) : false;
        if (!isDed && inDefRecovery && Math.random() > 0.3) {
          // skip some defaults during recovery
        } else {
          const baseY = isDed ? fl.dedPipeY + fl.dedPipeH / 2 : fl.defPipeY + fl.defPipeH / 2;
          const pipeH = isDed ? fl.dedPipeH : fl.defPipeH;
          const qfi = isDed ? s.flowDedQfi : s.flowDefQfi;
          const speed = getQfiSpeed(qfi);

          // Determine spawn color from 5QI definition
          const qfiSpawnColor = (QOI_INFO.find(q => q.id === qfi) || {}).color || '#e879f9';
          let qoiColor, spawnedOrange = false;
          if (isDed) {
            if (inRateAdaptPhase) {
              qoiColor = '#f59e0b'; // orange spawn during rate adaptation
              spawnedOrange = true;
            } else {
              qoiColor = qfiSpawnColor;
            }
          } else {
            // 5QI 9 packets use light red while congestion is active without rate adapt
            const spawnCongRed = (qfi === 9 && !inRateAdaptPhase) ? '#fca5a5' : '#ef4444';
            qoiColor = inDefHalt ? spawnCongRed : inDefSlowdown ? '#fca5a5' : qfiSpawnColor;
          }

          const targetSlice = this._getL4STargetSlice();
          const col = isDed ? (targetSlice ? targetSlice.color : '#c4b5fd') : '#94a3b8';

          updated.push({
            id: Date.now() + Math.random(),
            x: spawnX,
            y: baseY + (Math.random() - 0.5) * (pipeH * 0.55),
            speed, color: col, qoiColor, qfi, size: isDed ? 7 : 6, isDed,
            spawnedOrange, ecnMarked: false,
          });
        }
      }

      this.state.flowPackets = updated;
      const g = this.shadowRoot.getElementById('flow-packets-group');
      if (g) g.innerHTML = this._renderFlowPackets();
    }

    _getL4STargetSlice() {
      const { slices, siteType } = this.state;
      const matchingSlices = slices.filter(sl => getSliceRrps(sl, siteType).includes('private'));
      return matchingSlices.length > 0 ? matchingSlices[0] : null;
    }

    // -----------------------------------------------------------------------
    // L4S Simulation State Machine
    // -----------------------------------------------------------------------

    _toggleL4SSim() {
      if (!this._isL4SAvailable()) return;

      if (this.state.l4sSimRunning) {
        this._stopL4SSim();
        const restored = this._savedTrafficLoad || { private: 60, premium: 60, basic: 60 };
        this._savedTrafficLoad = null;
        this.setState({
          l4sSimRunning: false, l4sSimStep: 0, l4sUpfDetecting: false,
          l4sRateAdapting: false, l4sCongested: false, l4sDefCongested: false,
          l4sDefHalted: false, l4sDefRecovering: false, l4sEcnActive: false, l4sDedArrived: false,
          l4sDedReachedGnb: false, l4sRateAdaptStep: 0, l4sPhase: 'normal',
          l4sBitrate: 50, trafficLoad: restored,
          activeScenario: 'normal',
        });
        return;
      }

      this._savedTrafficLoad = { ...this.state.trafficLoad };
      const overloadTraffic = {};
      RRP_TYPES.forEach(rrp => {
        overloadTraffic[rrp.id] = 170;
      });

      this.setState({
        l4sSimRunning: true, l4sSimStep: 0, l4sBitrate: 50,
        l4sUpfDetecting: false, l4sRateAdapting: false, l4sCongested: false,
        l4sDefCongested: false, l4sDefHalted: false, l4sDefRecovering: false, l4sEcnActive: false,
        l4sDedArrived: false, l4sDedReachedGnb: false, l4sRateAdaptStep: 0,
        l4sPhase: 'simStarted',
        trafficLoad: overloadTraffic,
        activeScenario: 'allOverloaded',
      });

      let step = 0;
      this._simInterval = setInterval(() => {
        step++;
        const s = { l4sSimStep: step };

        const specState = this.getSpectrumState();
        const targetSpec = specState.find(r => r.id === 'private');
        const isOverloaded = targetSpec && targetSpec.isOverloaded;

        // ── 5-Phase L4S Simulation ──
        // Phase 1 (simStarted): ECT(1) animation, dedicated flow spawns with default colors.
        //          Green info box. Runs for steps 1-12.
        // Phase 2 (congestionMarker): Starts when step > 12 (ded traffic spawned).
        //          Ded circles turn red AFTER passing gNodeB (positional).
        //          ECN marker active. Red info box.
        //          Waits until l4sDedReachedGnb is set by animation tick.
        // Phase 3 (rateAdapt): Starts when red ded packet reaches endpoint (l4sDedArrived).
        //          Orange arrow + info box. Default flow turns light red + slow.
        //          New ded spawns are orange. In-flight ded past gNodeB stay red.
        //          Runs for 15 sim steps.
        // Phase 4 (recovery): Default colors, green info box.
        //          Runs until loop reset at step 30.

        const dedReachedGnb = this.state.l4sDedReachedGnb;
        const dedArrived = this.state.l4sDedArrived;
        const rateAdaptStep = this.state.l4sRateAdaptStep || 0;

        if (!dedReachedGnb) {
          // Phase 2 (simStarted): ECT(1) detection, ded flow activated, waiting for ded to reach gNodeB
          Object.assign(s, {
            l4sPhase: 'simStarted', l4sUpfDetecting: step <= 12,
            l4sRateAdapting: false, l4sCongested: false,
            l4sDefCongested: false, l4sDefHalted: false, l4sDefRecovering: false, l4sEcnActive: false,
          });
        } else if (!dedArrived) {
          // Phase 3 (congestionMarker): ded reached gNodeB, ECN marking active
          // Default flow halts (red, fully stopped) until rate adaptation kicks in
          if (isOverloaded) {
            Object.assign(s, {
              l4sPhase: 'congestionMarker', l4sUpfDetecting: false,
              l4sRateAdapting: false, l4sCongested: true,
              l4sDefCongested: false, l4sDefHalted: true, l4sDefRecovering: false, l4sEcnActive: true,
            });
          } else {
            Object.assign(s, {
              l4sPhase: 'congestionMarker', l4sUpfDetecting: false,
              l4sRateAdapting: false, l4sCongested: false,
              l4sDefCongested: false, l4sDefHalted: false, l4sDefRecovering: false, l4sEcnActive: false,
            });
          }
        } else if (rateAdaptStep < 20) {
          // Phase 4 (rateAdapt): red ded reached endpoint, rate adaptation active
          // Default flow resumes movement but remains slow (light red)
          if (isOverloaded) {
            Object.assign(s, {
              l4sPhase: 'rateAdapt', l4sUpfDetecting: false,
              l4sRateAdapting: true, l4sCongested: true,
              l4sDefCongested: true, l4sDefHalted: false, l4sDefRecovering: false, l4sEcnActive: true,
            });
            s.l4sRateAdaptStep = rateAdaptStep + 1;
          } else {
            Object.assign(s, {
              l4sPhase: 'rateAdapt', l4sUpfDetecting: false,
              l4sRateAdapting: false, l4sCongested: false,
              l4sDefCongested: false, l4sDefHalted: false, l4sDefRecovering: false, l4sEcnActive: false,
            });
          }
        } else {
          // Phase 5 (recovery): back to normal
          Object.assign(s, {
            l4sPhase: 'recovery', l4sUpfDetecting: false,
            l4sRateAdapting: false, l4sCongested: false,
            l4sDefCongested: false, l4sDefHalted: false, l4sDefRecovering: false,
            l4sEcnActive: false,
          });
          s.l4sRateAdaptStep = rateAdaptStep + 1;
        }

        // Bitrate drain during rate adaptation, recovery after
        if (isOverloaded && dedArrived && rateAdaptStep < 20) {
          s.l4sBitrate = Math.max(10, this.state.l4sBitrate - 3);
        }
        if (dedArrived && rateAdaptStep >= 23) {
          s.l4sBitrate = Math.min(50, this.state.l4sBitrate + 3);
        }

        // Loop reset after recovery has run for a while
        if (dedArrived && rateAdaptStep >= 35) {
          step = 0;
          this.state.flowPackets = [];
          Object.assign(s, {
            l4sSimStep: 0, l4sBitrate: 50, l4sUpfDetecting: false,
            l4sRateAdapting: false, l4sCongested: false, l4sDefCongested: false,
            l4sDefHalted: false, l4sDefRecovering: false, l4sEcnActive: false,
            l4sDedArrived: false, l4sDedReachedGnb: false, l4sRateAdaptStep: 0,
            l4sPhase: 'simStarted',
          });
        }
        this.setState(s);
      }, 700);
    }

    _stopL4SSim() {
      if (this._simInterval) { clearInterval(this._simInterval); this._simInterval = null; }
    }

    // -----------------------------------------------------------------------
    // Event Handlers
    // -----------------------------------------------------------------------

    handleSiteTypeChange(type) {
      if (type === 'public' && this.state.l4sSimRunning) {
        this._stopL4SSim();
        const restored = this._savedTrafficLoad || { private: 60, premium: 60, basic: 60 };
        this._savedTrafficLoad = null;
        this.state.l4sSimRunning = false;
        this.state.l4sSimStep = 0;
        this.state.l4sUpfDetecting = false;
        this.state.l4sRateAdapting = false;
        this.state.l4sCongested = false;
        this.state.l4sDefCongested = false;
        this.state.l4sDefHalted = false;
        this.state.l4sDefRecovering = false;
        this.state.l4sEcnActive = false;
        this.state.l4sDedArrived = false;
        this.state.l4sDedReachedGnb = false;
        this.state.l4sRateAdaptStep = 0;
        this.state.l4sPhase = 'normal';
        this.state.l4sBitrate = 50;
        this.state.trafficLoad = restored;
      }
      this.state.packets = [];
      this.state.flowPackets = [];
      this.setState({ siteType: type });
    }

    handleToggleRunning() { this.setState({ running: !this.state.running }); }

    handleToggleConfig() {
      this.setState({ configMode: this.state.configMode === 'none' ? 'rrp' : 'none' });
    }

    handleSliceChange(sliceId) {
      this.setState({ activeSlice: this.state.activeSlice === sliceId ? null : sliceId, activeDnn: null });
    }

    handleDnnChange(dnnId) {
      this.setState({ activeDnn: this.state.activeDnn === dnnId ? null : dnnId });
    }

    handleToggleSliceRrp(sliceId, rrpId) {
      const { slices, siteType } = this.state;
      const key = siteType === 'dedicated' ? 'rrpsDedicated' : 'rrpsPublic';
      const newSlices = slices.map(slice => {
        if (slice.id !== sliceId) return slice;
        const currentRrps = slice[key];
        const newRrps = currentRrps.includes(rrpId) ? currentRrps.filter(r => r !== rrpId) : [...currentRrps, rrpId];
        return { ...slice, [key]: newRrps };
      });
      this.state.packets = [];
      this.setState({ slices: newSlices });
    }

    handleToggleDnnSlice(dnnId, sliceId) {
      const { dnns } = this.state;
      const newDnns = dnns.map(dnn => {
        if (dnn.id !== dnnId) return dnn;
        const newSlices = dnn.slices.includes(sliceId) ? dnn.slices.filter(s => s !== sliceId) : [...dnn.slices, sliceId];
        return { ...dnn, slices: newSlices };
      });
      this.state.packets = [];
      this.setState({ dnns: newDnns });
    }

    handleTrafficLoadChange(rrpId, value) {
      this.state.trafficLoad = { ...this.state.trafficLoad, [rrpId]: Number(value) };
      this.state.activeScenario = null;
      this.updateSpectrumPanelOnly();
    }

    handleSetScenario(scenario) {
      const scenarios = {
        normal:          { private: 60,  premium: 60,  basic: 60 },
        privateOverload: { private: 170, premium: 40,  basic: 30 },
        premiumSurge:    { private: 30,  premium: 180, basic: 20 },
        basicFlood:      { private: 20,  premium: 20,  basic: 190 },
        allOverloaded:   { private: 160, premium: 150, basic: 170 },
      };
      this.state.trafficLoad = scenarios[scenario] || scenarios.normal;
      this.setState({ trafficLoad: this.state.trafficLoad, activeScenario: scenario });
    }

    handleToggleL4sDirection() {
      this.state.flowPackets = [];
      this.state.packets = [];
      this._dedTickCount = 0;
      this.setState({ l4sDirection: this.state.l4sDirection === 'uplink' ? 'downlink' : 'uplink', l4sDedArrived: false, l4sDedReachedGnb: false, l4sRateAdaptStep: 0 });
    }

    // -----------------------------------------------------------------------
    // Main Render
    // -----------------------------------------------------------------------

    render() {
      const s = this.state;
      const rrpConfig = this.getRrpConfig();
      const spectrumState = this.getSpectrumState();

      const lastRrp = rrpConfig[rrpConfig.length - 1];
      const svgHeight = lastRrp ? lastRrp.baseY + lastRrp.height + 50 : 860;

      this.shadowRoot.innerHTML = `
        <style>${this.getStyles()}</style>
        <div class="container">
          <div class="header">
            <h1 class="title">Telia NorthStar: Unified 5G Network Visualization</h1>
            <p class="subtitle">Spectrum management (RRP borrowing) + L4S congestion control — two layers of defense</p>
          </div>

          ${this._renderControlBar()}
          ${this._renderFilterBar()}
          ${s.configMode !== 'none' ? this._renderConfigPanel() : ''}
          ${s.showSpectrumPanel ? '<div id="spectrum-panel-container">' + this.renderSpectrumPanelContent() + '</div>' : ''}
          ${s.show5qiPanel ? this._render5QIPanel() : ''}

          <svg viewBox="0 0 1030 ${svgHeight}" class="svg-canvas">
            <defs>
              <marker id="arrow-down" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="#fbbf24"/>
              </marker>
              <marker id="arrow-up" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="#fbbf24"/>
              </marker>
              <filter id="glow-amber" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur"/>
                <feFlood flood-color="#fbbf24" flood-opacity="0.4" result="color"/>
                <feComposite in="color" in2="blur" operator="in" result="shadow"/>
                <feMerge><feMergeNode in="shadow"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
              <filter id="glow-red" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="4" result="blur"/>
                <feFlood flood-color="#ef4444" flood-opacity="0.5" result="color"/>
                <feComposite in="color" in2="blur" operator="in" result="shadow"/>
                <feMerge><feMergeNode in="shadow"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
              <filter id="flowGlow"><feGaussianBlur stdDeviation="3" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
              <marker id="arA" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0 0L10 5L0 10z" fill="#f59e0b"/></marker>
              <marker id="arA-rev" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M10 0L0 5L10 10z" fill="#f59e0b"/></marker>
              <marker id="l4sArrowR" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="#94a3b8"/></marker>
              <marker id="l4sArrowL" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M10 0L0 5L10 10z" fill="#94a3b8"/></marker>
            </defs>
            <text id="status-text" x="400" y="18" text-anchor="middle" fill="#94a3b8" font-size="11" font-style="italic">
              5QI value circles move at different speeds to indicate different priorities${spectrumState.some(r => r.isBorrowing) ? ' — Dynamic spectrum sharing active' : ''}
            </text>
            ${this._renderRightPanel()}
            <g id="rrp-boxes-group">${rrpConfig.map(rrp => this.renderRrpBox(rrp, s.dnns, s.activeSlice, s.activeDnn, spectrumState)).join('')}</g>
            <g id="network-elements">${this._renderNetworkElements()}</g>
            <g id="spectrum-overlays">${this.renderSpectrumSvgOverlays()}</g>
            <g id="macro-packets-group">${this._renderMacroPackets()}</g>
            <g id="flow-packets-group">${this._renderFlowPackets()}</g>
          </svg>

        </div>
      `;

      this._attachEventListeners();
      if (s.showSpectrumPanel) this.attachSpectrumListeners();
    }

    // -----------------------------------------------------------------------
    // Control Bar & Filters
    // -----------------------------------------------------------------------

    _renderControlBar() {
      const s = this.state;
      const { siteType, running, configMode, showSpectrumPanel, show5qiPanel } = s;
      return `
        <div class="control-bar">
          <div class="button-group">
            <button class="btn btn-active-purple">Flow</button>
          </div>
          <div class="button-group site-type-group">
            <button class="btn-site ${siteType === 'dedicated' ? 'btn-site-dedicated-active' : ''}" data-action="site-dedicated">Dedicated</button>
            <button class="btn-site ${siteType === 'public' ? 'btn-site-public-active' : ''}" data-action="site-public">Public</button>
          </div>
          <button class="btn ${running ? 'btn-amber' : 'btn-green'}" data-action="toggle-running">${running ? 'Pause' : 'Play'}</button>
          <button class="btn ${configMode !== 'none' ? 'btn-pink' : 'btn-slate'}" data-action="toggle-config">${configMode !== 'none' ? 'Hide Config' : 'Configure'}</button>
          <div style="display:inline-flex;align-items:center;gap:6px;background:#1e293b;border:2px solid #7c3aed;border-radius:8px;padding:4px 8px;">
            <span style="color:#c4b5fd;font-size:11px;font-weight:bold;">Direction:</span>
            <button data-action="toggle-l4s-direction-up" style="padding:5px 12px;border-radius:5px;font-size:12px;font-weight:bold;border:none;cursor:pointer;background:${s.l4sDirection === 'uplink' ? '#9333ea' : '#475569'};color:white;">▲ Uplink</button>
            <button data-action="toggle-l4s-direction-down" style="padding:5px 12px;border-radius:5px;font-size:12px;font-weight:bold;border:none;cursor:pointer;background:${s.l4sDirection === 'downlink' ? '#9333ea' : '#475569'};color:white;">▼ Downlink</button>
          </div>
          <button class="btn ${showSpectrumPanel ? 'btn-spectrum-active' : 'btn-slate'}" data-action="toggle-spectrum">${showSpectrumPanel ? 'Hide Spectrum' : 'Spectrum Sharing'}</button>
          <button class="btn ${show5qiPanel ? 'btn-5qi-active' : 'btn-slate'}" data-action="toggle-5qi">${show5qiPanel ? 'Hide 5QI Ref' : '5QI Reference'}</button>
        </div>
      `;
    }

    _renderFilterBar() {
      const { slices, dnns, activeSlice, activeDnn } = this.state;
      return `
        <div class="filter-bar">
          <span class="filter-label">Slice:</span>
          <button class="btn-filter" style="background-color:${!activeSlice ? '#fff' : '#475569'}; color:${!activeSlice ? '#000' : '#fff'}" data-action="filter-slice-all">All</button>
          ${slices.map(slice => `
            <button class="btn-filter" style="background-color:${activeSlice === slice.id ? slice.color : '#475569'}; color:${activeSlice === slice.id ? '#000' : '#fff'}"
              data-action="filter-slice" data-slice-id="${slice.id}">${slice.snssai}</button>
          `).join('')}
          <span class="separator">|</span>
          <span class="filter-label">DNN:</span>
          <button class="btn-filter" style="background-color:${!activeDnn ? '#fff' : '#475569'}; color:${!activeDnn ? '#000' : '#fff'}" data-action="filter-dnn-all">All</button>
          ${dnns.map(dnn => `
            <button class="btn-filter" style="background-color:${activeDnn === dnn.id ? dnn.color : '#475569'}; color:${activeDnn === dnn.id ? '#000' : '#fff'}"
              data-action="filter-dnn" data-dnn-id="${dnn.id}">${dnn.id}</button>
          `).join('')}
        </div>
      `;
    }

    // -----------------------------------------------------------------------
    // Config Panel
    // -----------------------------------------------------------------------

    _renderConfigPanel() {
      const { slices, dnns, siteType, configMode } = this.state;
      const headerCells = mode => mode === 'rrp'
        ? RRP_TYPES.map(rrp => `<th class="table-header-center" style="color:${rrp.color}">${rrp.name}</th>`).join('')
        : slices.map(slice => `<th class="table-header-center" style="color:${slice.color}">${slice.snssai}</th>`).join('');

      let tableContent = '';
      if (configMode === 'rrp') {
        tableContent = slices.map(slice => {
          const currentRrps = getSliceRrps(slice, siteType);
          const cells = RRP_TYPES.map(rrp => {
            const isAssigned = currentRrps.includes(rrp.id);
            const isDisabled = getRrpShare(rrp, siteType) === 0;
            return `<td class="table-cell-center"><button class="checkbox-btn ${isAssigned && !isDisabled ? 'checkbox-checked' : ''} ${isDisabled ? 'checkbox-disabled' : ''}"
              data-action="toggle-slice-rrp" data-slice-id="${slice.id}" data-rrp-id="${rrp.id}" ${isDisabled ? 'disabled' : ''}>${isAssigned && !isDisabled ? '✓' : ''}</button></td>`;
          }).join('');
          return `<tr class="table-row"><td class="table-cell"><span class="label-with-dot"><span class="color-dot" style="background-color:${slice.color}"></span><span class="label-text">${slice.snssai}</span></span></td>${cells}</tr>`;
        }).join('');
      } else {
        tableContent = dnns.map(dnn => {
          const cells = slices.map(slice => {
            const isAssigned = dnn.slices.includes(slice.id);
            return `<td class="table-cell-center"><button class="checkbox-btn ${isAssigned ? 'checkbox-checked' : ''}"
              data-action="toggle-dnn-slice" data-dnn-id="${dnn.id}" data-slice-id="${slice.id}">${isAssigned ? '✓' : ''}</button></td>`;
          }).join('');
          return `<tr class="table-row"><td class="table-cell"><span class="label-with-dot"><span class="color-dot" style="background-color:${dnn.color}"></span><span class="label-text">${dnn.id}</span></span></td>${cells}</tr>`;
        }).join('');
      }

      return `
        <div class="config-panel">
          <div class="config-header">
            <div class="config-title-row">
              <h3 class="config-title">Configuration</h3>
              <div class="tab-group">
                <button class="btn-tab ${configMode === 'rrp' ? 'btn-tab-active-purple' : ''}" data-action="config-mode-rrp">S-NSSAI → RRP</button>
                <button class="btn-tab ${configMode === 'dnn' ? 'btn-tab-active-cyan' : ''}" data-action="config-mode-dnn">DNN → S-NSSAI</button>
              </div>
            </div>
            <button class="close-btn" data-action="close-config">×</button>
          </div>
          <p class="config-desc">Click cells to add/remove ${configMode === 'rrp' ? 'S-NSSAIs from RRPs' : 'DNNs from S-NSSAIs'}</p>
          <table class="config-table"><thead><tr><th class="table-header">${configMode === 'rrp' ? 'S-NSSAI' : 'DNN'}</th>${headerCells(configMode)}</tr></thead><tbody>${tableContent}</tbody></table>
        </div>
      `;
    }

    // -----------------------------------------------------------------------
    // Spectrum Sharing Panel
    // -----------------------------------------------------------------------

    renderSpectrumPanelContent() {
      const specState = this.getSpectrumState();
      const { trafficLoad, activeScenario } = this.state;
      const anyBorrowing = specState.some(r => r.isBorrowing);

      const sliders = specState.map(rrp => {
        if (rrp.guaranteed === 0) return '';
        const loadPct = trafficLoad[rrp.id];
        const isOver = loadPct > 100;
        return `
          <div class="spectrum-slider-row">
            <div class="spectrum-slider-label"><span class="color-dot-sm" style="background-color:${rrp.color}"></span><span class="label-text">${rrp.name}</span></div>
            <div class="spectrum-slider-track">
              <input type="range" min="0" max="200" value="${loadPct}" class="spectrum-range" data-rrp-id="${rrp.id}"
                style="background:linear-gradient(to right,${rrp.color} 0%,${rrp.color} ${loadPct / 2}%,#334155 ${loadPct / 2}%,#334155 100%);" />
              <div class="spectrum-marker" style="left:50%;"></div>
            </div>
            <div class="spectrum-slider-value ${isOver ? 'spectrum-value-over' : ''}">${loadPct}%</div>
          </div>`;
      }).join('');

      const bars = specState.map(rrp => {
        if (rrp.guaranteed === 0) return '';
        const borrowedW = rrp.borrowed;
        let actualDonated = 0;
        if (rrp.isDonating && rrp.surplus > 0) {
          specState.forEach(b => { b.donors.forEach(d => { if (d.id === rrp.id) actualDonated += d.amount; }); });
          actualDonated = Math.min(actualDonated, rrp.surplus);
        }
        const keptW = rrp.guaranteed - actualDonated;
        const effectiveW = keptW + borrowedW;
        const usedOfKept = keptW > 0 ? Math.min(100, (Math.min(rrp.demand, keptW) / keptW) * 100) : 0;

        let donorInfo = '';
        if (rrp.donors.length > 0) {
          donorInfo = `<div class="donor-info"><span class="donor-arrow">← borrowing from:</span>${rrp.donors.map(d =>
            `<span class="donor-tag" style="background-color:${d.color}30;color:${d.color}">${d.name} (${d.amount.toFixed(1)}%)</span>`
          ).join('')}</div>`;
        }

        return `
          <div class="alloc-row">
            <div class="alloc-row-bar">
              <span class="alloc-label">${rrp.name}</span>
              <div class="alloc-bar-bg">
                <div class="alloc-bar-guaranteed" style="width:${keptW}%;background-color:${rrp.color};opacity:0.8;">
                  <div class="alloc-bar-used" style="width:${usedOfKept}%;background-color:${rrp.color};"></div>
                </div>
                ${borrowedW > 0 ? `<div class="alloc-bar-borrowed" style="width:${borrowedW}%;background-image:repeating-linear-gradient(45deg,${rrp.color}cc,${rrp.color}cc 2px,${rrp.color}44 2px,${rrp.color}44 6px);"></div>` : ''}
                ${actualDonated > 0 ? `<div class="alloc-bar-donated" style="width:${actualDonated}%;"></div>` : ''}
              </div>
              <div class="alloc-values">
                <span class="alloc-val-base">${effectiveW.toFixed(1)}%</span>
                ${borrowedW > 0 ? `<span class="alloc-val-borrowed">(+${borrowedW.toFixed(1)})</span>` : ''}
                ${actualDonated > 0 ? `<span class="alloc-val-donated">(-${actualDonated.toFixed(1)})</span>` : ''}
              </div>
            </div>
            ${donorInfo}
          </div>`;
      }).join('');

      return `
        <div class="spectrum-panel">
          <div class="spectrum-header">
            <div>
              <h3 class="config-title">Spectrum Sharing & Dynamic Allocation</h3>
              <p class="config-desc" style="margin-bottom:0;">Adjust traffic demand per RRP. When demand exceeds the guaranteed quota, surplus spectrum is borrowed — and the L4S flows inside the Private RRP show per-flow congestion response.</p>
            </div>
            <button class="close-btn" data-action="close-spectrum">×</button>
          </div>
          <div class="spectrum-sliders">${sliders}</div>
          <div class="spectrum-scenarios">
            <span class="scenario-label">Scenarios:</span>
            <button class="btn-scenario ${activeScenario === 'normal' ? 'btn-scenario-active' : ''}" data-scenario="normal" style="${activeScenario === 'normal' ? 'background:#334155;border-color:#94a3b8;color:#fff;box-shadow:0 0 8px rgba(148,163,184,0.4);' : ''}">Normal Load</button>
            <button class="btn-scenario ${activeScenario === 'privateOverload' ? 'btn-scenario-active' : ''}" data-scenario="privateOverload" style="background-color:${activeScenario === 'privateOverload' ? '#581c87' : '#581c8730'};border-color:${activeScenario === 'privateOverload' ? '#a78bfa' : '#7c3aed60'};color:${activeScenario === 'privateOverload' ? '#fff' : '#c4b5fd'};${activeScenario === 'privateOverload' ? 'box-shadow:0 0 10px rgba(124,58,237,0.5);' : ''}">Private Overload</button>
            <button class="btn-scenario ${activeScenario === 'premiumSurge' ? 'btn-scenario-active' : ''}" data-scenario="premiumSurge" style="background-color:${activeScenario === 'premiumSurge' ? '#166534' : '#14532d30'};border-color:${activeScenario === 'premiumSurge' ? '#86efac' : '#22c55e60'};color:${activeScenario === 'premiumSurge' ? '#fff' : '#86efac'};${activeScenario === 'premiumSurge' ? 'box-shadow:0 0 10px rgba(34,197,94,0.5);' : ''}">Premium Surge</button>
            <button class="btn-scenario ${activeScenario === 'basicFlood' ? 'btn-scenario-active' : ''}" data-scenario="basicFlood" style="background-color:${activeScenario === 'basicFlood' ? '#334155' : '#1e293b30'};border-color:${activeScenario === 'basicFlood' ? '#cbd5e1' : '#64748b60'};color:${activeScenario === 'basicFlood' ? '#fff' : '#cbd5e1'};${activeScenario === 'basicFlood' ? 'box-shadow:0 0 10px rgba(100,116,139,0.5);' : ''}">Basic Flood</button>
            <button class="btn-scenario ${activeScenario === 'allOverloaded' ? 'btn-scenario-active' : ''}" data-scenario="allOverloaded" style="background-color:${activeScenario === 'allOverloaded' ? '#78350f' : '#78350f30'};border-color:${activeScenario === 'allOverloaded' ? '#fde68a' : '#f59e0b60'};color:${activeScenario === 'allOverloaded' ? '#fff' : '#fde68a'};${activeScenario === 'allOverloaded' ? 'box-shadow:0 0 10px rgba(245,158,11,0.5);' : ''}">All Overloaded</button>
          </div>
          <div class="alloc-section">
            <div class="alloc-header">
              <span class="alloc-title">Live Spectrum Allocation</span>
              ${anyBorrowing ? '<span class="alloc-active-badge">⚡ DYNAMIC SHARING ACTIVE</span>' : ''}
            </div>
            ${bars}
          </div>
          <div class="spectrum-legend">
            <div class="legend-item"><div class="legend-swatch" style="background-color:#64748b;"></div><span>Guaranteed</span></div>
            <div class="legend-item"><div class="legend-swatch" style="background-image:repeating-linear-gradient(45deg,#8b5cf6cc,#8b5cf6cc 1px,#8b5cf644 1px,#8b5cf644 3px);"></div><span>Borrowed</span></div>
            <div class="legend-item"><div class="legend-swatch legend-swatch-donated"></div><span>Surplus (donated)</span></div>
          </div>
        </div>
      `;
    }

    renderSpectrumSvgOverlays() {
      const rrpConfig = this.getRrpConfig();
      const specState = this.getSpectrumState();
      const { rrpStartX, rrpWidth } = LAYOUT;
      let html = '';

      specState.forEach(spec => {
        const rrp = rrpConfig.find(c => c.id === spec.id);
        if (!rrp || rrp.share === 0) return;
        if (spec.isOverloaded) {
          html += `<rect x="${rrpStartX - 3}" y="${rrp.baseY - 3}" width="${rrpWidth + 6}" height="${rrp.height + 6}" rx="10"
            fill="none" stroke="#ef4444" stroke-width="3" filter="url(#glow-red)">
            <animate attributeName="opacity" values="0.3;1;0.3" dur="1.2s" repeatCount="indefinite"/></rect>`;
        } else if (spec.isDonating) {
          html += `<rect x="${rrpStartX - 2}" y="${rrp.baseY - 2}" width="${rrpWidth + 4}" height="${rrp.height + 4}" rx="10"
            fill="none" stroke="#38bdf8" stroke-width="1.5" stroke-dasharray="6,4" opacity="0.5">
            <animate attributeName="stroke-dashoffset" from="0" to="-20" dur="1.5s" repeatCount="indefinite"/></rect>`;
        }
      });

      specState.forEach(borrower => {
        if (!borrower.donors || borrower.donors.length === 0) return;
        const borrowerRrp = rrpConfig.find(c => c.id === borrower.id);
        if (!borrowerRrp) return;
        // Separate donors coming from above vs below so arrows don't overlap
        const donorsAbove = borrower.donors.filter(d => {
          const dr = rrpConfig.find(c => c.id === d.id);
          return dr && (dr.baseY + dr.height / 2) < (borrowerRrp.baseY + borrowerRrp.height / 2);
        });
        const donorsBelow = borrower.donors.filter(d => {
          const dr = rrpConfig.find(c => c.id === d.id);
          return dr && (dr.baseY + dr.height / 2) >= (borrowerRrp.baseY + borrowerRrp.height / 2);
        });
        const hasFromBoth = donorsAbove.length > 0 && donorsBelow.length > 0;
        borrower.donors.forEach(donor => {
          const donorRrp = rrpConfig.find(c => c.id === donor.id);
          if (!donorRrp) return;
          const fromY = donorRrp.baseY + donorRrp.height / 2;
          const toY = borrowerRrp.baseY + borrowerRrp.height / 2;
          const goingDown = toY > fromY;
          // Offset arrows horizontally when donors come from both sides
          const x = hasFromBoth ? (goingDown ? rrpStartX - 5 : rrpStartX - 14) : rrpStartX - 5;
          const textX = hasFromBoth ? (goingDown ? x - 4 : x - 4) : x - 4;
          html += `
            <line x1="${x}" y1="${fromY}" x2="${x}" y2="${toY}" stroke="#fbbf24" stroke-width="2" stroke-dasharray="4,3"
              marker-end="url(#arrow-${goingDown ? 'down' : 'up'})" opacity="0.7">
              <animate attributeName="stroke-dashoffset" from="0" to="-14" dur="1s" repeatCount="indefinite"/>
            </line>
            <text x="${textX}" y="${(fromY + toY) / 2 + 3}" text-anchor="end" fill="#fbbf24" font-size="7" font-weight="bold">${donor.amount.toFixed(0)}%</text>`;
        });
      });

      return html;
    }

    // -----------------------------------------------------------------------
    // Slice Overview SVG Sections
    // -----------------------------------------------------------------------

    _renderNetworkElements() {
      const rrpConfig = this.getRrpConfig();
      if (!rrpConfig.length) return '';
      const firstRrp = rrpConfig[0];
      const lastRrp = rrpConfig[rrpConfig.length - 1];
      const topY = firstRrp.baseY;
      const bottomY = lastRrp.baseY + lastRrp.height;
      const fullH = bottomY - topY;
      const { rrpStartX, rrpWidth } = LAYOUT;

      // UPF / 5G Core — single prominent column outside all RRP boxes, solid outline
      const upfX = rrpStartX + rrpWidth + 20;
      const upfW = 52;
      // Inner filled box uses nearly all vertical space
      const upfInnerPad = 6;
      const upfInnerH = fullH - upfInnerPad * 2;

      return `
        <!-- 5G Core (UPF/SMF) — single prominent column, solid fill, lighter hue -->
        <rect x="${upfX}" y="${topY}" width="${upfW}" height="${fullH}" rx="5" fill="#a78bfa" opacity="0.3" stroke="#a78bfa" stroke-width="2"/>
        <g transform="translate(${upfX + upfW / 2},${topY - 2})">
          <rect x="-30" y="-11" width="60" height="14" rx="3" fill="#0f172a" stroke="#a78bfa" stroke-width="0.5"/>
          <text text-anchor="middle" y="0" fill="#c4b5fd" font-size="9" font-weight="bold" font-family="monospace">► 5GC / Edge</text>
        </g>
        <g transform="translate(${upfX + upfW / 2},${topY + fullH / 2})">
          <rect x="-28" y="-28" width="56" height="76" rx="6" fill="#1e1035" opacity="0.85"/>
          <text text-anchor="middle" y="-14" fill="#e9d5ff" font-size="18" font-weight="bold" font-family="monospace">5G</text>
          <text text-anchor="middle" y="6" fill="#e9d5ff" font-size="18" font-weight="bold" font-family="monospace">Core</text>
          <text text-anchor="middle" y="24" fill="#c4b5fd" font-size="10" font-family="monospace">UPF</text>
          <text text-anchor="middle" y="38" fill="#a78bfa" font-size="8" font-family="monospace">SMF</text>
        </g>
      `;
    }

    renderRrpBox(rrp, dnns, activeSlice, activeDnn, spectrumState) {
      const { rrpStartX, rrpWidth, sliceMargin, dnnMargin } = LAYOUT;
      const sliceStartX = rrpStartX + sliceMargin;
      const sliceWidth = rrpWidth - sliceMargin - 6;
      const dnnStartX = sliceStartX + dnnMargin;
      const dnnWidth = sliceWidth - dnnMargin * 2;
      const isActive = rrp.share > 0;
      const spec = spectrumState.find(s => s.id === rrp.id);
      const isBorrowing = spec && spec.isBorrowing;
      const isDonating = spec && spec.isDonating && !spec.isOverloaded;
      const isL4sTarget = rrp.isL4sTarget;

      const contentHeight = rrp.height - (isL4sTarget ? L4S_H : 0);
      const sliceHeight = rrp.slices.length > 0 ? (contentHeight - 20) / rrp.slices.length : contentHeight - 20;

      let badge = '';
      if (isBorrowing) {
        badge = `<g transform="translate(${rrpStartX + rrpWidth - 125},${rrp.baseY + 2})">
          <rect x="0" y="0" width="115" height="16" rx="8" fill="#fbbf2420" stroke="#fbbf24" stroke-width="0.5"/>
          <text x="57" y="11" text-anchor="middle" fill="#fbbf24" font-size="7" font-weight="bold">⚡ +${spec.borrowed.toFixed(1)}% borrowed</text>
        </g>`;
      } else if (isDonating && spec.actualDonated > 0) {
        badge = `<g transform="translate(${rrpStartX + rrpWidth - 125},${rrp.baseY + 2})">
          <rect x="0" y="0" width="115" height="16" rx="8" fill="#38bdf820" stroke="#38bdf8" stroke-width="0.5"/>
          <text x="57" y="11" text-anchor="middle" fill="#38bdf8" font-size="7" font-weight="bold">↗ sharing ${spec.actualDonated.toFixed(1)}% surplus</text>
        </g>`;
      }

      let content = '';
      if (rrp.slices.length === 0) {
        content = `<text x="${rrpStartX + rrpWidth / 2}" y="${rrp.baseY + contentHeight / 2}" text-anchor="middle" fill="#475569" font-size="10">No S-NSSAIs assigned</text>`;
      } else {
        content = rrp.slices.map((slice, sliceIndex) => {
          const sliceY = rrp.baseY + 18 + sliceIndex * sliceHeight;
          const sliceDnns = getSliceDnns(slice.id, dnns);
          const dnnHeight = sliceDnns.length > 0 ? (sliceHeight - 18) / sliceDnns.length : sliceHeight - 18;
          const isSliceActive = !activeSlice || activeSlice === slice.id;

          // UE client box at far left of each S-NSSAI
          const ueBoxW = 24;
          const ueBoxH = Math.min(sliceHeight - 22, 40);
          const ueBoxX = sliceStartX + 3;
          const ueBoxY = sliceY + 14 + (sliceHeight - 18 - ueBoxH) / 2;
          const ueClientBox = `
            <rect x="${ueBoxX}" y="${ueBoxY}" width="${ueBoxW}" height="${ueBoxH}" rx="3" fill="#1e293b" stroke="#ea580c" stroke-width="1"/>
            <text x="${ueBoxX + ueBoxW / 2}" y="${ueBoxY + ueBoxH / 2 - 2}" text-anchor="middle" fill="#ea580c" font-size="8">📱</text>
            <text x="${ueBoxX + ueBoxW / 2}" y="${ueBoxY + ueBoxH / 2 + 8}" text-anchor="middle" fill="#fff" font-size="5" font-weight="bold">UE</text>
          `;

          // Shift DNN content right to make room for UE box
          const dnnOffsetX = ueBoxW + 6;
          const adjDnnStartX = dnnStartX + dnnOffsetX;
          const adjDnnWidth = dnnWidth - dnnOffsetX;

          const dnnContent = sliceDnns.length === 0
            ? `<text x="${rrpStartX + rrpWidth / 2}" y="${sliceY + sliceHeight / 2}" text-anchor="middle" fill="#475569" font-size="9">No DNNs</text>`
            : sliceDnns.map((dnn, dnnIndex) => {
                const dnnY = sliceY + 16 + dnnIndex * dnnHeight;
                const isDnnActive = !activeDnn || activeDnn === dnn.id;
                const renderDirKey = this.state.l4sDirection || 'uplink';
                const renderVisQois = getVisibleQois(dnn, renderDirKey);
                const showQosLanes = dnnHeight > 28 && renderVisQois.length > 0;
                const qosHeaderH = 12;
                const qosAreaY = dnnY + qosHeaderH + 2;
                const qosAreaH = dnnHeight - qosHeaderH - 5;
                const qosFlowH = renderVisQois.length > 0 ? qosAreaH / renderVisQois.length : qosAreaH;

                let qosContent = '';
                if (showQosLanes) {
                  const gnbW = 22;
                  const gnbMargin = 42;
                  const txStartX = adjDnnStartX + gnbMargin + gnbW;
                  // Transport extends all the way through the 5G Core column
                  const txEndX = rrpStartX + rrpWidth + 72;
                  const txW = txEndX - txStartX;
                  // One transport field per DNN covering all QoS flows
                  const txFieldY = qosAreaY;
                  const txFieldH = qosAreaH;
                  const txLabelHtml = txFieldH >= 16 ? `
                    <text x="${rrpStartX + rrpWidth - 10}" y="${txFieldY + txFieldH / 2 + 3}" text-anchor="middle" fill="#93c5fd" font-size="8" font-weight="bold" stroke="#0f172a" stroke-width="2" paint-order="stroke">Transport Network</text>
                  ` : '';
                  const txFieldBg = `
                    <rect x="${txStartX}" y="${txFieldY}" width="${txW}" height="${txFieldH}" rx="0" fill="#1e3a5f" opacity="0.45"/>
                    <line x1="${txStartX}" y1="${txFieldY}" x2="${txEndX}" y2="${txFieldY}" stroke="#3b82f6" stroke-width="0.5" opacity="0.6"/>
                    <line x1="${txStartX}" y1="${txFieldY + txFieldH}" x2="${txEndX}" y2="${txFieldH + txFieldY}" stroke="#3b82f6" stroke-width="0.5" opacity="0.6"/>
                  `;
                  const visQosFlowH = renderVisQois.length > 0 ? qosAreaH / renderVisQois.length : qosAreaH;

                  const qosFlows = renderVisQois.map((qoi, qi) => {
                    const qd = QOI_INFO.find(q => q.id === qoi);
                    if (!qd) return '';
                    const flowY = qosAreaY + qi * visQosFlowH;
                    const flowH = Math.max(visQosFlowH - 1, 4);
                    const labelMap = DNN_FLOW_LABELS[dnn.id] && DNN_FLOW_LABELS[dnn.id][qoi];
                    const dirLabel = labelMap ? labelMap[renderDirKey] : null;
                    const flowText = dirLabel ? `QoS Flow — ${dirLabel} (5QI ${qoi})` : `QoS Flow`;
                    return `
                      <rect x="${adjDnnStartX + 2}" y="${flowY}" width="${adjDnnWidth - 4}" height="${flowH}" rx="2" fill="${qd.color}12" stroke="${qd.color}" stroke-width="0.5" stroke-dasharray="3,2"/>
                      <rect x="${adjDnnStartX + gnbMargin}" y="${flowY}" width="${gnbW}" height="${flowH}" rx="2" fill="#0369a1" opacity="0.85"/>
                      <text x="${adjDnnStartX + gnbMargin + gnbW / 2}" y="${flowY + flowH / 2 + 3}" text-anchor="middle" fill="#fff" font-size="6" font-weight="bold">gNB</text>
                      <text x="${txStartX + 8}" y="${flowY + 10}" fill="${qd.color}" font-size="7">${flowText}</text>
                      <circle cx="${txStartX + 58}" cy="${flowY + visQosFlowH / 2}" r="6" fill="${qd.color}"/>
                      <text x="${txStartX + 58}" y="${flowY + visQosFlowH / 2 + 3}" text-anchor="middle" fill="white" font-size="6" font-weight="bold">${qoi}</text>`;
                  }).join('');
                  // Render: background first, then QoS flows, then transport label on top
                  qosContent = txFieldBg + qosFlows + txLabelHtml;
                } else {
                  qosContent = renderVisQois.map((qoi, qi) => {
                    const qd = QOI_INFO.find(q => q.id === qoi);
                    return qd ? `<g transform="translate(${adjDnnStartX + 100 + qi * 28},${dnnY + dnnHeight / 2 - 7})"><circle cx="7" cy="7" r="7" fill="${qd.color}"/><text x="7" y="10" text-anchor="middle" fill="white" font-size="7" font-weight="bold">${qoi}</text></g>` : '';
                  }).join('');
                }

                return `
                  <g opacity="${isDnnActive ? 1 : 0.3}">
                    <rect x="${adjDnnStartX}" y="${dnnY + 1}" width="${adjDnnWidth}" height="${dnnHeight - 3}" rx="3"
                      fill="${dnn.color}20" stroke="${dnn.color}" stroke-width="1" stroke-dasharray="4,2"/>
                    <text x="${adjDnnStartX + 10}" y="${dnnY + 11}" fill="${dnn.color}" font-size="9" font-weight="bold">DNN: ${dnn.id}</text>
                    ${qosContent}
                  </g>`;
              }).join('');

          return `
            <g opacity="${isSliceActive ? 1 : 0.3}">
              <rect x="${sliceStartX}" y="${sliceY}" width="${sliceWidth}" height="${sliceHeight - 4}" rx="6" fill="${slice.color}15" stroke="${slice.color}" stroke-width="2" stroke-dasharray="${sliceIndex % 2 === 0 ? '0' : '8,4'}"/>
              <text x="${sliceStartX + 12}" y="${sliceY + 12}" fill="${slice.color}" font-size="10" font-weight="bold">Network slice (S-NSSAI): ${slice.snssai}</text>
              ${ueClientBox}
              ${dnnContent}
            </g>`;
        }).join('');
      }

      let l4sSection = '';
      if (isL4sTarget) {
        l4sSection = this._renderL4SInsideRrp(rrp, spectrumState);
      }

      return `
        <g opacity="${isActive ? 1 : 0.15}">
          <rect x="${rrpStartX}" y="${rrp.baseY}" width="${rrpWidth}" height="${rrp.height}" rx="8" fill="#0f172a" stroke="${rrp.color}" stroke-width="2"/>
          <rect x="${rrpStartX}" y="${rrp.baseY}" width="6" height="${rrp.height}" fill="${rrp.color}"/>
          <text x="${rrpStartX + 12}" y="${rrp.baseY + 14}" fill="${rrp.color}" font-size="12" font-weight="bold">${rrp.name} Radio Resource Partition (RRP) - ${rrp.displayShare}% of radio spectrum</text>
          ${badge}
          ${content}
          ${l4sSection}
        </g>`;
    }

    // -----------------------------------------------------------------------
    // L4S Section Rendered Inside Private RRP Box
    // -----------------------------------------------------------------------

    _renderL4SInsideRrp(rrp, spectrumState) {
      const { rrpStartX, rrpWidth } = LAYOUT;
      const s = this.state;
      const spec = spectrumState.find(r => r.id === rrp.id);
      const isOverloaded = spec && spec.isOverloaded;
      const fl = this._getL4SLayout();
      if (!fl) return '';

      const dedActive = s.l4sSimRunning && s.l4sSimStep >= 13;
      const isDownlink = fl.isDownlink;
      // ECN only activates once default flow traffic is visibly flowing
      // Uplink: check if packets have reached gNodeB area (they spawn nearby)
      // Downlink: check if packets have reached the transport/UPF area (they spawn at App Server side and flow left)
      const defTrafficVisible = s.flowPackets.some(p =>
        !p.isDed && (isDownlink ? p.x <= fl.upfX + 15 : p.x >= fl.gnbX - 15)
      );
      const ecnActive = ((s.l4sEcnActive && isOverloaded) || (isOverloaded && !s.l4sSimRunning)) && defTrafficVisible;
      const rateAdaptActive = s.l4sRateAdapting && isOverloaded && s.l4sDedArrived;
      const targetSlice = this._getL4STargetSlice();
      const sliceColor = targetSlice ? targetSlice.color : '#c4b5fd';

      const dirLabel = isDownlink
        ? '◄── Downlink: Data from App Server to UE ◄──'
        : '──► Uplink: Data from UE to App Server ──►';

      const sepY = fl.baseY;
      let html = `
        <line x1="${rrpStartX + 8}" y1="${sepY}" x2="${rrpStartX + rrpWidth - 8}" y2="${sepY}" stroke="#334155" stroke-width="1" stroke-dasharray="4,3"/>
        <text x="${rrpStartX + rrpWidth / 2}" y="${sepY + 13}" text-anchor="middle" fill="#94a3b8" font-size="10" font-weight="bold" font-family="monospace">L4S Flow Analysis — ${dirLabel}</text>
      `;

      const dedGradId = 'dedG-' + rrp.id;
      const defGradId = 'defG-' + rrp.id;
      html += `
        <linearGradient id="${dedGradId}" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="${sliceColor}" stop-opacity="0.4"/>
          <stop offset="50%" stop-color="${sliceColor}" stop-opacity="0.8"/>
          <stop offset="100%" stop-color="${sliceColor}" stop-opacity="0.4"/>
        </linearGradient>
        <linearGradient id="${defGradId}" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#475569" stop-opacity="0.6"/>
          <stop offset="50%" stop-color="#64748b" stop-opacity="0.9"/>
          <stop offset="100%" stop-color="#475569" stop-opacity="0.6"/>
        </linearGradient>
      `;

      // DNN box wrapping QoS flows (same format as macro DNN boxes)
      const rrpRightEdge = rrpStartX + rrpWidth;
      const dnnBoxX = fl.adjDnnStartX;
      const dnnBoxY = fl.dedPipeY - 18;
      const dnnBoxW = (rrpRightEdge - 12) - dnnBoxX;
      const dnnBoxH = (fl.defPipeY + fl.defPipeH) - fl.dedPipeY + 24;
      html += `
        <rect x="${dnnBoxX}" y="${dnnBoxY}" width="${dnnBoxW}" height="${dnnBoxH}" rx="3" fill="#a78bfa20" stroke="#a78bfa" stroke-width="1" stroke-dasharray="4,2"/>
        <text x="${dnnBoxX + 10}" y="${dnnBoxY + 11}" fill="#a78bfa" font-size="9" font-weight="bold">DNN: L4S</text>
      `;

      // UE box (same format as macro S-NSSAI UE boxes)
      const ueBoxW = 24;
      const ueBoxH = Math.min(dnnBoxH - 4, 40);
      const ueBoxX = rrpStartX + LAYOUT.sliceMargin + 3; // align with macro S-NSSAI UE boxes
      const ueBoxY = dnnBoxY + (dnnBoxH - ueBoxH) / 2;
      html += `
        <rect x="${ueBoxX}" y="${ueBoxY}" width="${ueBoxW}" height="${ueBoxH}" rx="3" fill="#1e293b" stroke="#ea580c" stroke-width="1"/>
        <text x="${ueBoxX + ueBoxW / 2}" y="${ueBoxY + ueBoxH / 2 - 2}" text-anchor="middle" fill="#ea580c" font-size="8">📱</text>
        <text x="${ueBoxX + ueBoxW / 2}" y="${ueBoxY + ueBoxH / 2 + 8}" text-anchor="middle" fill="#fff" font-size="5" font-weight="bold">UE</text>
      `;

      // RRP boundary marker — dashed line showing where radio ends
      const boundaryTextY = fl.baseY + 18;
      html += `
        <line x1="${rrpRightEdge}" y1="${fl.baseY + 16}" x2="${rrpRightEdge}" y2="${fl.baseY + L4S_H - 4}" stroke="#64748b" stroke-width="1.5" stroke-dasharray="6,4" opacity="0.8"/>
        <rect x="${rrpRightEdge - 82}" y="${boundaryTextY}" width="80" height="14" rx="3" fill="#0f172a" stroke="#475569" stroke-width="0.5"/>
        <text x="${rrpRightEdge - 42}" y="${boundaryTextY + 10}" text-anchor="middle" fill="#93c5fd" font-size="9" font-weight="bold" font-family="monospace">Radio / RAN ◄</text>
      `;

      // QoS flow boxes with gNB inside (matching macro QoS flow format)
      const gnbW = 22;
      const gnbMargin = 42;
      const txStartX = dnnBoxX + gnbMargin + gnbW;

      // Dedicated QoS flow box
      const dedFlowX = dnnBoxX + 2;
      const dedFlowW = dnnBoxW - 4;
      html += `
        <g opacity="${dedActive ? 1 : 0.3}">
          <rect x="${dedFlowX}" y="${fl.dedPipeY}" width="${dedFlowW}" height="${fl.dedPipeH}" rx="2" fill="${sliceColor}12" stroke="${sliceColor}" stroke-width="0.5" stroke-dasharray="3,2"/>
          <rect x="${dnnBoxX + gnbMargin}" y="${fl.dedPipeY}" width="${gnbW}" height="${fl.dedPipeH}" rx="2" fill="#0369a1" opacity="0.85"/>
          <text x="${dnnBoxX + gnbMargin + gnbW / 2}" y="${fl.dedPipeY + fl.dedPipeH / 2 + 3}" text-anchor="middle" fill="#fff" font-size="6" font-weight="bold">gNB</text>
          <text x="${txStartX + 8}" y="${fl.dedPipeY + 10}" fill="${sliceColor}" font-size="7">QoS Flow — Dedicated / L4S (5QI ${s.flowDedQfi})</text>
        </g>
      `;

      // Default QoS flow box
      const defFlowX = dnnBoxX + 2;
      const defFlowW = dnnBoxW - 4;
      html += `
        <rect x="${defFlowX}" y="${fl.defPipeY}" width="${defFlowW}" height="${fl.defPipeH}" rx="2" fill="#64748b12" stroke="#64748b" stroke-width="0.5" stroke-dasharray="3,2"/>
        <rect x="${dnnBoxX + gnbMargin}" y="${fl.defPipeY}" width="${gnbW}" height="${fl.defPipeH}" rx="2" fill="#0369a1" opacity="0.85"/>
        <text x="${dnnBoxX + gnbMargin + gnbW / 2}" y="${fl.defPipeY + fl.defPipeH / 2 + 3}" text-anchor="middle" fill="#fff" font-size="6" font-weight="bold">gNB</text>
        <text x="${txStartX + 8}" y="${fl.defPipeY + 10}" fill="#94a3b8" font-size="7">QoS Flow — Default / Best-Effort (5QI ${s.flowDefQfi})</text>
      `;

      // Transport field spanning both QoS flows (from after gNB through 5G Core)
      const txFieldEndX = rrpStartX + rrpWidth + 72;
      const txFieldW = txFieldEndX - txStartX;
      const txFieldY = fl.dedPipeY - 4;
      const txFieldH = (fl.defPipeY + fl.defPipeH) - fl.dedPipeY + 8;
      html += `
        <rect x="${txStartX}" y="${txFieldY}" width="${txFieldW}" height="${txFieldH}" rx="2" fill="#1e3a5f" opacity="0.45"/>
        <line x1="${txStartX}" y1="${txFieldY}" x2="${txFieldEndX}" y2="${txFieldY}" stroke="#3b82f6" stroke-width="0.5" opacity="0.6"/>
        <line x1="${txStartX}" y1="${txFieldY + txFieldH}" x2="${txFieldEndX}" y2="${txFieldY + txFieldH}" stroke="#3b82f6" stroke-width="0.5" opacity="0.6"/>
        <text x="${rrpRightEdge - 10}" y="${txFieldY + txFieldH / 2 + 3}" text-anchor="middle" fill="#93c5fd" font-size="8" font-weight="bold" stroke="#0f172a" stroke-width="2" paint-order="stroke">Transport Network</text>
      `;
      // App Server for L4S flows (beyond 5G Core)
      html += this._svgNode(fl.srvX, fl.nodeY, 64, 70, '#ea580c', 'App Srv', 'Edge');

      // Directional arrows
      const arrowColor = '#94a3b8';
      const arrowDir = isDownlink ? 'L' : 'R';
      const dedMidY = fl.dedPipeY + fl.dedPipeH / 2;
      const defMidY = fl.defPipeY + fl.defPipeH / 2;
      // UE side arrows (from UE box to QoS flow box edge)
      const ueRightX = ueBoxX + ueBoxW + 2;
      const flowLeftX = dnnBoxX;
      html += `
        <line x1="${ueRightX}" y1="${dedMidY}" x2="${flowLeftX}" y2="${dedMidY}" stroke="${arrowColor}" stroke-width="1" stroke-dasharray="3 2" marker-end="url(#l4sArrow${arrowDir})"/>
        <line x1="${ueRightX}" y1="${defMidY}" x2="${flowLeftX}" y2="${defMidY}" stroke="${arrowColor}" stroke-width="1" stroke-dasharray="3 2" marker-end="url(#l4sArrow${arrowDir})"/>
      `;
      // App Server side arrows (dedicated + default)
      html += `
        <line x1="${fl.pipeX2 + 2}" y1="${dedMidY}" x2="${fl.srvX - 32}" y2="${dedMidY}" stroke="${arrowColor}" stroke-width="1" stroke-dasharray="3 2" marker-end="url(#l4sArrow${arrowDir})"/>
        <line x1="${fl.pipeX2 + 2}" y1="${defMidY}" x2="${fl.srvX - 32}" y2="${defMidY}" stroke="${arrowColor}" stroke-width="1" stroke-dasharray="3 2" marker-end="url(#l4sArrow${arrowDir})"/>
      `;

      // ECN marker at gNodeB
      html += `
        <g transform="translate(${fl.gnbX},${fl.ecnY})">
          <circle r="9" fill="${ecnActive ? '#dc2626' : '#1e293b'}" stroke="${ecnActive ? '#fca5a5' : '#475569'}" stroke-width="1.5" ${ecnActive ? 'filter="url(#flowGlow)"' : ''}/>
          <text text-anchor="middle" y="3" fill="#fff" font-size="8" font-weight="bold">ECN</text>
          ${ecnActive ? `<circle r="13" fill="none" stroke="#ef4444" stroke-width="0.7"><animate attributeName="r" from="9" to="18" dur="1s" repeatCount="indefinite"/><animate attributeName="opacity" from="0.6" to="0" dur="1s" repeatCount="indefinite"/></circle>` : ''}
        </g>
        <line x1="${fl.gnbX}" y1="${fl.ecnY + 9}" x2="${fl.gnbX}" y2="${fl.dedPipeY - 2}" stroke="${ecnActive ? '#ef4444' : '#475569'}" stroke-width="0.8" stroke-dasharray="3 2"/>
        ${ecnActive ? `<text x="${fl.gnbX + 14}" y="${fl.ecnY + 12}" fill="#ef4444" font-size="8" font-family="monospace">CE mark</text>` : ''}
      `;

      // UPF detection
      if (s.l4sUpfDetecting) {
        html += `
          <circle cx="${fl.upfX}" cy="${fl.dedPipeY + fl.dedPipeH / 2}" r="28" fill="none" stroke="#a78bfa" stroke-width="1.5" opacity="0.6">
            <animate attributeName="r" from="24" to="38" dur="1.2s" repeatCount="indefinite"/>
            <animate attributeName="opacity" from="0.7" to="0" dur="1.2s" repeatCount="indefinite"/>
          </circle>
          <g transform="translate(${fl.upfX},${fl.ecnY})">
            <rect x="-32" y="-7" width="64" height="14" rx="4" fill="#7c3aed" stroke="#a78bfa" stroke-width="1" filter="url(#flowGlow)"/>
            <text text-anchor="middle" y="3" fill="#fff" font-size="8" font-weight="bold" font-family="monospace">ECT(1) Detect</text>
          </g>
        `;
      }

      // L4S feedback path (direction-aware)
      // UE is always left, App Server always right
      // Downlink: data flows right→left (AppSrv→UE), feedback goes left→right (UE→AppSrv)
      // Uplink: data flows left→right (UE→AppSrv), feedback goes right→left (AppSrv→UE)
      if (s.l4sSimRunning && rateAdaptActive) {
        const fbY = fl.defPipeY + fl.defPipeH + 10;
        const fbFromX = isDownlink ? ueRightX : fl.srvX - 32;
        const fbToX = isDownlink ? fl.srvX - 32 : ueRightX;
        const markerEnd = isDownlink ? 'url(#arA)' : 'url(#arA-rev)';
        const fbLabel = isDownlink
          ? 'UE → ECN Feedback → App Server'
          : 'App Server → ECN Feedback → UE';
        const sign = isDownlink ? 1 : -1;
        html += `
          <path d="M ${fbFromX},${fbY} C ${fbFromX + sign * 10},${fbY + 20} ${fl.txX - sign * 10},${fbY + 22} ${fl.txX},${fbY + 18} C ${fl.txX + sign * 10},${fbY + 14} ${fbToX - sign * 10},${fbY + 10} ${fbToX},${fbY + 6}" fill="none" stroke="#f59e0b" stroke-width="1.5" stroke-dasharray="4 3" marker-end="${markerEnd}" opacity="0.8"/>
          <text x="${(fbFromX + fbToX) / 2}" y="${fbY + 34}" text-anchor="middle" fill="#f59e0b" font-size="8" font-weight="bold" font-family="monospace">${fbLabel}</text>
        `;
      }

      // Bottom area: bitrate gauge on left, info box on right
      const bottomY = fl.baseY + L4S_H - 68;
      const bitrateGaugeX = fl.pipeX1;
      const bitrateColor = s.l4sCongested && isOverloaded ? '#ef4444' : s.l4sBitrate / s.l4sMaxBitrate > 0.7 ? '#22c55e' : '#f59e0b';
      html += `
        <g transform="translate(${bitrateGaugeX},${bottomY})">
          <text x="0" y="0" fill="#94a3b8" font-size="8" font-weight="bold" font-family="monospace">L4S Bitrate</text>
          <rect x="0" y="6" width="140" height="10" rx="5" fill="#0f172a" stroke="#334155" stroke-width="0.5"/>
          <rect x="0" y="6" width="${140 * (s.l4sBitrate / s.l4sMaxBitrate)}" height="10" rx="5" fill="${bitrateColor}"/>
          <text x="148" y="15" fill="#e2e8f0" font-size="9" font-weight="bold" font-family="monospace">${s.l4sBitrate} Mbps</text>
        </g>
      `;

      // Info box: phase-dependent (to the right of bitrate gauge)
      const infoBoxX = fl.pipeX1 + 260;
      const phase = s.l4sPhase || 'normal';
      if (phase === 'simStarted' && s.l4sSimRunning) {
        html += `
          <g transform="translate(${infoBoxX},${bottomY - 6})">
            <rect x="0" y="0" width="280" height="36" rx="4" fill="#0c1527" stroke="#22c55e" stroke-width="1.2"/>
            <text x="140" text-anchor="middle" y="14" fill="#22c55e" font-size="10" font-weight="bold" font-family="monospace">✓ Normal Traffic Flow</text>
            <text x="10" y="28" fill="#94a3b8" font-size="9" font-family="monospace">Dedicated L4S QoS flow activated.</text>
          </g>
        `;
      } else if (phase === 'congestionMarker' && s.l4sCongested && isOverloaded) {
        html += `
          <g transform="translate(${infoBoxX},${bottomY - 6})">
            <rect x="0" y="0" width="280" height="48" rx="4" fill="#0c1527" stroke="#ef4444" stroke-width="1.2">
              <animate attributeName="stroke-opacity" values="1;0.4;1" dur="1s" repeatCount="indefinite"/>
            </rect>
            <text x="140" text-anchor="middle" y="14" fill="#ef4444" font-size="10" font-weight="bold" font-family="monospace">⚠ Congestion Detected</text>
            <text x="10" y="28" fill="#fca5a5" font-size="9" font-family="monospace">Congestion detected at early stage by gNodeB,</text>
            <text x="10" y="42" fill="#fca5a5" font-size="9" font-family="monospace">ECN marker inserted to tag dedicated L4S traffic.</text>
          </g>
        `;
      } else if (phase === 'rateAdapt' && rateAdaptActive) {
        html += `
          <g transform="translate(${infoBoxX},${bottomY - 6})">
            <rect x="0" y="0" width="280" height="36" rx="4" fill="#0c1527" stroke="#f59e0b" stroke-width="1.2">
              <animate attributeName="stroke-opacity" values="1;0.4;1" dur="1.5s" repeatCount="indefinite"/>
            </rect>
            <text x="140" text-anchor="middle" y="14" fill="#f59e0b" font-size="10" font-weight="bold" font-family="monospace">⚡ Rate Adaptation Active</text>
            <text x="10" y="28" fill="#fbbf24" font-size="9" font-family="monospace">Congestion info forwarded, rate adaptation applied.</text>
          </g>
        `;
      } else if (phase === 'recovery' && s.l4sSimRunning) {
        html += `
          <g transform="translate(${infoBoxX},${bottomY - 6})">
            <rect x="0" y="0" width="280" height="36" rx="4" fill="#0c1527" stroke="#22c55e" stroke-width="1.2"/>
            <text x="140" text-anchor="middle" y="14" fill="#22c55e" font-size="10" font-weight="bold" font-family="monospace">✓ Back to Normal</text>
            <text x="10" y="28" fill="#94a3b8" font-size="9" font-family="monospace">Congestion no longer present. Traffic restored.</text>
          </g>
        `;
      }

      // 5QI color legend at the very bottom
      const legendY = fl.baseY + L4S_H - 16;
      const dedQd = QOI_INFO.find(q => q.id === s.flowDedQfi) || { color: '#e879f9' };
      const defQd = QOI_INFO.find(q => q.id === s.flowDefQfi) || { color: '#06b6d4' };
      const legendItems = [
        { id: s.flowDedQfi, color: dedQd.color, label: `5QI ${s.flowDedQfi} (L4S Ded.)` },
        { id: s.flowDefQfi, color: defQd.color, label: `5QI ${s.flowDefQfi} (Default)` },
      ];
      html += `<g transform="translate(${fl.pipeX1},${legendY})">`;
      legendItems.forEach((item, i) => {
        const lx = i * 140;
        html += `
          <circle cx="${lx + 5}" cy="0" r="5" fill="${item.color}"/>
          <text x="${lx + 14}" y="4" fill="#94a3b8" font-size="9" font-family="monospace">${item.label}</text>
        `;
      });
      html += `</g>`;

      // Simulate button + direction toggle: aligned with right panel info column
      const ctrlX = rrpStartX + rrpWidth + 90;
      const privateRrp = this.getRrpConfig().find(r => r.id === 'private');
      const rrpBottomY = privateRrp ? privateRrp.baseY + privateRrp.height : fl.baseY + L4S_H;
      const ctrlY = rrpBottomY - 100;
      const phaseLabels = {
        normal: { label: 'Normal Traffic', color: '#22c55e' },
        simStarted: { label: 'L4S Flow Activated', color: '#22c55e' },
        congestionMarker: { label: 'Congestion Detected', color: '#ef4444' },
        rateAdapt: { label: 'Rate Adaptation', color: '#f59e0b' },
        recovery: { label: 'Traffic Restored', color: '#22c55e' },
      };
      const currentPhaseInfo = phaseLabels[s.l4sPhase] || phaseLabels.normal;
      html += `
        <foreignObject x="${ctrlX}" y="${ctrlY}" width="155" height="170">
          <div xmlns="http://www.w3.org/1999/xhtml" style="font-family:system-ui,-apple-system,sans-serif;">
            <button data-action="toggle-l4s-sim" style="
              background:${s.l4sSimRunning ? 'linear-gradient(135deg,#dc2626,#b91c1c)' : 'linear-gradient(135deg,#2563eb,#7c3aed)'};
              color:#fff;border:none;border-radius:6px;padding:7px 6px;font-size:9px;font-weight:bold;
              font-family:monospace;cursor:pointer;width:100%;">
              ${s.l4sSimRunning ? '■ Stop L4S Sim' : '▶ Simulate L4S Congestion'}
            </button>
            ${s.l4sSimRunning ? `<div style="margin-top:4px;font-size:10px;font-weight:bold;font-family:monospace;color:${currentPhaseInfo.color};text-align:center;">${currentPhaseInfo.label}</div>` : ''}
            <a href="l4s-flow.html" target="_blank" style="
              display:block;margin-top:4px;background:linear-gradient(135deg,#1e293b,#334155);
              color:#c4b5fd;border:1px solid #7c3aed;border-radius:6px;padding:7px 6px;font-size:9px;font-weight:bold;
              font-family:monospace;cursor:pointer;width:100%;text-align:center;text-decoration:none;box-sizing:border-box;">
              Open detailed L4S viz
            </a>
          </div>
        </foreignObject>
      `;

      return html;
    }

    _svgNode(cx, cy, w, h, fill, label, sub, opacity) {
      return `<g transform="translate(${cx},${cy})" ${opacity != null ? 'opacity="' + opacity + '"' : ''}>
        <rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="5" fill="${fill}" opacity="0.9" stroke="${fill}88" stroke-width="0.6"/>
        ${label ? `<text text-anchor="middle" y="${sub ? -2 : 3}" fill="#fff" font-size="${h > 30 ? 10 : 8}" font-weight="bold" font-family="monospace">${label}</text>` : ''}
        ${sub ? `<text text-anchor="middle" y="${label ? 9 : 3}" fill="#ffffffcc" font-size="8" font-family="monospace">${sub}</text>` : ''}
      </g>`;
    }

    _renderMacroPackets() {
      return this.state.packets.map(p => {
        const halo = p.borrowed ? `
          <circle r="${p.size + 4}" fill="none" stroke="#fbbf24" stroke-width="1" opacity="0.6">
            <animate attributeName="r" values="${p.size + 3};${p.size + 6};${p.size + 3}" dur="0.6s" repeatCount="indefinite"/>
            <animate attributeName="opacity" values="0.6;0.2;0.6" dur="0.6s" repeatCount="indefinite"/>
          </circle>` : '';
        return `
          <g transform="translate(${p.x},${p.y})">
            ${halo}
            <circle r="${p.size + 2}" fill="${p.sliceColor}" opacity="0.8"/>
            <circle r="${p.size}" fill="${p.qoiColor}"><animate attributeName="opacity" values="1;0.7;1" dur="0.3s" repeatCount="indefinite"/></circle>
            <text y="3" text-anchor="middle" fill="white" font-size="7" font-weight="bold">${p.qoi}</text>
          </g>`;
      }).join('');
    }

    _renderFlowPackets() {
      return this.state.flowPackets.map(p => `
        <g transform="translate(${p.x},${p.y})">
          <circle r="${p.size + 2}" fill="${p.color}" opacity="0.7"/>
          <circle r="${p.size}" fill="${p.qoiColor}"><animate attributeName="opacity" values="1;0.65;1" dur="0.3s" repeatCount="indefinite"/></circle>
          <text y="3" text-anchor="middle" fill="#fff" font-size="8" font-weight="bold">${p.qfi}</text>
        </g>
      `).join('');
    }

    _renderRightPanel() {
      const { dnns, activeDnn, slices, activeSlice } = this.state;
      const { rrpStartX, rrpWidth } = LAYOUT;
      const panelX = rrpStartX + rrpWidth + 90;
      const W = 130;
      let curY = 0;

      // UE info box
      const ueBox = `
        <g transform="translate(0, ${curY})">
          <rect width="${W}" height="52" rx="6" fill="#1e293b" stroke="#ea580c" stroke-width="1.5"/>
          <text x="18" y="20" fill="#ea580c" font-size="14">📱</text>
          <text x="38" y="18" fill="white" font-size="10" font-weight="bold">UE</text>
          <text x="38" y="30" fill="#94a3b8" font-size="8">User Equipment</text>
          <text x="38" y="42" fill="#64748b" font-size="7">Client Device</text>
        </g>
      `;
      curY += 60;

      // S-NSSAI info box
      const sliceBoxes = slices.map((slice, index) => `
        <g transform="translate(5, ${20 + index * 18})" opacity="${!activeSlice || activeSlice === slice.id ? 1 : 0.3}">
          <rect width="${W - 10}" height="14" rx="3" fill="${slice.color}40" stroke="${slice.color}" stroke-width="1"/>
          <text x="${(W - 10) / 2}" y="10" text-anchor="middle" fill="${slice.color}" font-size="8" font-weight="bold">${slice.snssai} — ${slice.name}</text>
        </g>
      `).join('');
      const snssaiH = 28 + slices.length * 18;
      const snssaiBox = `
        <g transform="translate(0, ${curY})">
          <rect width="${W}" height="${snssaiH}" rx="6" fill="#1e293b" stroke="#475569" stroke-width="1"/>
          <text x="${W / 2}" y="13" text-anchor="middle" fill="white" font-size="9" font-weight="bold">Subscribed S-NSSAIs</text>
          ${sliceBoxes}
        </g>
      `;
      curY += snssaiH + 8;

      // DNN header
      const dnnHeader = `<text x="${W / 2}" y="${curY + 10}" text-anchor="middle" fill="white" font-size="10">Data Networks (DNN)</text>`;
      curY += 18;

      // DNN info boxes
      const networks = dnns.map((dnn, index) => {
        const qoiBadges = dnn.qois.map((qoi, qi) => {
          const qd = QOI_INFO.find(q => q.id === qoi);
          return qd ? `<g transform="translate(${qi * 24},0)"><circle cx="7" cy="7" r="7" fill="${qd.color}"/><text x="7" y="10" text-anchor="middle" fill="white" font-size="6" font-weight="bold">${qoi}</text></g>` : '';
        }).join('');
        const y = curY + index * 56;
        return `
          <g transform="translate(0,${y})" opacity="${!activeDnn || activeDnn === dnn.id ? 1 : 0.25}">
            <rect width="${W}" height="50" rx="5" fill="#1e293b" stroke="${dnn.color}" stroke-width="1.5"/>
            <text x="${W / 2}" y="14" text-anchor="middle" fill="white" font-size="9" font-weight="bold">${dnn.id}</text>
            <text x="${W / 2}" y="26" text-anchor="middle" fill="#64748b" font-size="8">5QIs:</text>
            <g transform="translate(${(W - dnn.qois.length * 24) / 2},32)">${qoiBadges}</g>
          </g>`;
      }).join('');

      return `
        <g transform="translate(${panelX},28)">
          ${ueBox}
          ${snssaiBox}
          ${dnnHeader}
          ${networks}
        </g>`;
    }

    // -----------------------------------------------------------------------
    // L4S Control Bar (below main SVG, dedicated site only)
    // -----------------------------------------------------------------------

    // L4S controls are now rendered inside the SVG via _renderL4SInsideRrp

    // -----------------------------------------------------------------------
    // 5QI Reference Panel
    // -----------------------------------------------------------------------

    _render5QIPanel() {
      return `
        <div class="qfi-panel">
          <div class="config-header">
            <h3 class="config-title">5QI Reference</h3>
            <button class="close-btn" data-action="close-5qi">×</button>
          </div>
          ${Object.entries(FIVE_QI_GROUPS).map(([key, g]) => `
            <div style="margin-bottom:12px">
              <h4 style="color:${key === 'dcGbr' ? '#f43f5e' : '#0ea5e9'};margin:0 0 4px 0;font-size:13px">${g.label}</h4>
              <p style="color:#94a3b8;font-size:11px;font-family:monospace;margin:0 0 6px 0">
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
                  <tr class="table-row">
                    <td class="table-cell" style="color:#e2e8f0;font-weight:bold">${q.id}</td>
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
          `).join('')}
        </div>
      `;
    }

    // -----------------------------------------------------------------------
    // Event Listeners
    // -----------------------------------------------------------------------

    _attachEventListeners() {
      this.shadowRoot.querySelectorAll('[data-action]').forEach(el => {
        el.addEventListener('click', (e) => {
          const action = e.currentTarget.dataset.action;
          switch (action) {
            case 'site-dedicated': this.handleSiteTypeChange('dedicated'); break;
            case 'site-public': this.handleSiteTypeChange('public'); break;
            case 'toggle-running': this.handleToggleRunning(); break;
            case 'toggle-config': this.handleToggleConfig(); break;
            case 'close-config': this.setState({ configMode: 'none' }); break;
            case 'config-mode-rrp': this.setState({ configMode: 'rrp' }); break;
            case 'config-mode-dnn': this.setState({ configMode: 'dnn' }); break;
            case 'filter-slice-all': this.setState({ activeSlice: null, activeDnn: null }); break;
            case 'filter-slice': this.handleSliceChange(e.currentTarget.dataset.sliceId); break;
            case 'filter-dnn-all': this.setState({ activeDnn: null }); break;
            case 'filter-dnn': this.handleDnnChange(e.currentTarget.dataset.dnnId); break;
            case 'toggle-slice-rrp': this.handleToggleSliceRrp(e.currentTarget.dataset.sliceId, e.currentTarget.dataset.rrpId); break;
            case 'toggle-dnn-slice': this.handleToggleDnnSlice(e.currentTarget.dataset.dnnId, e.currentTarget.dataset.sliceId); break;
            case 'toggle-spectrum': this.setState({ showSpectrumPanel: !this.state.showSpectrumPanel }); break;
            case 'close-spectrum': this.setState({ showSpectrumPanel: false }); break;
            case 'toggle-5qi': this.setState({ show5qiPanel: !this.state.show5qiPanel }); break;
            case 'close-5qi': this.setState({ show5qiPanel: false }); break;
            case 'toggle-l4s-sim': this._toggleL4SSim(); break;
            case 'toggle-l4s-direction-up':
              if (this.state.l4sDirection !== 'uplink') this.handleToggleL4sDirection();
              break;
            case 'toggle-l4s-direction-down':
              if (this.state.l4sDirection !== 'downlink') this.handleToggleL4sDirection();
              break;
          }
        });
      });
    }

    attachSpectrumListeners() {
      this.shadowRoot.querySelectorAll('.spectrum-range').forEach(el => {
        el.addEventListener('input', (e) => this.handleTrafficLoadChange(e.target.dataset.rrpId, e.target.value));
      });
      this.shadowRoot.querySelectorAll('[data-scenario]').forEach(el => {
        el.addEventListener('click', (e) => this.handleSetScenario(e.currentTarget.dataset.scenario));
      });
      const closeBtn = this.shadowRoot.querySelector('[data-action="close-spectrum"]');
      if (closeBtn) closeBtn.addEventListener('click', () => this.setState({ showSpectrumPanel: false }));
    }

    // -----------------------------------------------------------------------
    // Styles
    // -----------------------------------------------------------------------

    getStyles() {
      return `
        :host { display: block; font-family: system-ui, -apple-system, sans-serif; }
        .container { background-color: #0f172a; padding: 8px; border-radius: 12px; }
        .header { text-align: center; margin-bottom: 8px; }
        .title { font-size: 18px; font-weight: bold; color: white; margin: 0; }
        .subtitle { color: #94a3b8; font-size: 12px; margin: 4px 0 0 0; }

        .control-bar, .filter-bar { display: flex; justify-content: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; align-items: center; }
        .filter-bar { font-size: 12px; gap: 4px; }
        .button-group { display: flex; gap: 4px; background-color: #1e293b; border-radius: 4px; padding: 4px; }
        .site-type-group { background-color: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 4px 6px; gap: 8px; }

        .btn { padding: 4px 8px; border-radius: 4px; font-size: 12px; border: none; cursor: pointer; transition: all 0.2s; background: transparent; color: #cbd5e1; }
        .btn:hover { opacity: 0.8; }
        .btn-filter { padding: 2px 8px; border-radius: 4px; font-size: 12px; border: none; cursor: pointer; transition: all 0.2s; }
        .btn-active-purple { background-color: #9333ea; color: white; }
        .btn-amber { background-color: #f59e0b; color: white; }
        .btn-green { background-color: #22c55e; color: white; }
        .btn-pink { background-color: #db2777; color: white; }
        .btn-slate { background-color: #475569; color: white; }
        .btn-spectrum-active { background-color: #d97706; color: white; }

        .btn-site { padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: bold; border: 2px solid transparent; cursor: pointer; transition: all 0.3s ease; background: transparent; color: #94a3b8; }
        .btn-site:hover { color: #fff; background: rgba(255,255,255,0.1); }
        .btn-site-dedicated-active {
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; border-color: #60a5fa;
          box-shadow: 0 0 12px rgba(37,99,235,0.6), 0 0 24px rgba(37,99,235,0.3), inset 0 1px 0 rgba(255,255,255,0.2);
          animation: pulse-ded 2s ease-in-out infinite;
        }
        .btn-site-public-active {
          background: linear-gradient(135deg, #ea580c 0%, #c2410c 100%); color: white; border-color: #fb923c;
          box-shadow: 0 0 12px rgba(234,88,12,0.6), 0 0 24px rgba(234,88,12,0.3), inset 0 1px 0 rgba(255,255,255,0.2);
          animation: pulse-pub 2s ease-in-out infinite;
        }
        .btn-site-dedicated-active::before { content: "🏢"; margin-right: 4px; }
        .btn-site-public-active::before { content: "🌐"; margin-right: 4px; }

        @keyframes pulse-ded { 0%, 100% { box-shadow: 0 0 12px rgba(37,99,235,0.6); } 50% { box-shadow: 0 0 16px rgba(37,99,235,0.8); } }
        @keyframes pulse-pub { 0%, 100% { box-shadow: 0 0 12px rgba(234,88,12,0.6); } 50% { box-shadow: 0 0 16px rgba(234,88,12,0.8); } }

        .filter-label { color: white; }
        .separator { color: #475569; margin: 0 4px; }

        .config-panel { background-color: #1e293b; border-radius: 8px; padding: 12px; margin-bottom: 12px; }
        .config-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
        .config-title-row { display: flex; align-items: center; gap: 8px; }
        .config-title { color: white; font-weight: bold; font-size: 14px; margin: 0; }
        .tab-group { display: flex; gap: 4px; background-color: #334155; border-radius: 4px; padding: 2px; }
        .btn-tab { padding: 2px 8px; border-radius: 4px; font-size: 12px; border: none; cursor: pointer; transition: all 0.2s; background: transparent; color: #94a3b8; }
        .btn-tab-active-purple { background-color: #9333ea; color: white; }
        .btn-tab-active-cyan { background-color: #0891b2; color: white; }

        .close-btn { color: #94a3b8; font-size: 18px; background: none; border: none; cursor: pointer; padding: 0 4px; }
        .close-btn:hover { color: white; }
        .config-desc { color: #94a3b8; font-size: 12px; margin-bottom: 12px; }
        .config-table { width: 100%; font-size: 12px; border-collapse: collapse; }
        .table-header { text-align: left; padding: 4px; color: #94a3b8; }
        .table-header-center { text-align: center; padding: 4px; }
        .table-row { border-top: 1px solid #334155; }
        .table-cell { padding: 4px; }
        .table-cell-center { padding: 4px; text-align: center; }
        .label-with-dot { display: inline-flex; align-items: center; gap: 4px; }
        .color-dot { width: 12px; height: 12px; border-radius: 4px; }
        .color-dot-sm { width: 10px; height: 10px; border-radius: 2px; flex-shrink: 0; }
        .label-text { color: white; }

        .checkbox-btn { width: 24px; height: 24px; border-radius: 4px; border: 2px solid #475569; background: transparent; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; transition: all 0.2s; color: #4ade80; font-size: 14px; }
        .checkbox-btn:hover { border-color: #94a3b8; }
        .checkbox-checked { border-color: #22c55e; background-color: rgba(34,197,94,0.3); }
        .checkbox-disabled { opacity: 0.2; cursor: not-allowed; }

        .svg-canvas { width: 100%; height: auto; background-color: #020617; border-radius: 8px; }

        /* Spectrum panel */
        .spectrum-panel { background-color: #1e293b; border-radius: 8px; padding: 12px; margin-bottom: 12px; }
        .spectrum-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
        .spectrum-sliders { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
        .spectrum-slider-row { display: flex; align-items: center; gap: 8px; }
        .spectrum-slider-label { display: flex; align-items: center; gap: 4px; width: 80px; }
        .spectrum-slider-track { flex: 1; position: relative; }
        .spectrum-range { width: 100%; height: 8px; -webkit-appearance: none; appearance: none; border-radius: 4px; outline: none; cursor: pointer; }
        .spectrum-range::-webkit-slider-thumb { -webkit-appearance: none; width: 16px; height: 16px; border-radius: 50%; background: white; border: 2px solid #64748b; cursor: pointer; }
        .spectrum-marker { position: absolute; top: -4px; width: 1px; height: 16px; background: #fbbf24; pointer-events: none; }
        .spectrum-slider-value { width: 40px; text-align: right; font-size: 12px; color: #cbd5e1; font-weight: bold; }
        .spectrum-value-over { color: #fbbf24; }

        .spectrum-scenarios { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 12px; align-items: center; }
        .scenario-label { color: #94a3b8; font-size: 12px; }
        .btn-scenario { padding: 4px 8px; border-radius: 4px; font-size: 11px; border: 1px solid #475569; cursor: pointer; transition: all 0.2s; background-color: #1e293b; color: #94a3b8; }
        .btn-scenario:hover { opacity: 0.8; }
        .btn-scenario-active { font-weight: bold; transform: scale(1.05); border-width: 2px; }
        .btn-scenario-default { background-color: #334155; border-color: #64748b; color: white; }

        .alloc-section { margin-top: 8px; }
        .alloc-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
        .alloc-title { color: white; font-size: 13px; font-weight: bold; }
        .alloc-active-badge { background-color: #f59e0b20; color: #f59e0b; font-size: 10px; font-weight: bold; padding: 2px 8px; border-radius: 4px; border: 1px solid #f59e0b40; }

        .alloc-row { margin-bottom: 6px; }
        .alloc-row-bar { display: flex; align-items: center; gap: 6px; }
        .alloc-label { width: 70px; font-size: 12px; color: #94a3b8; font-weight: bold; flex-shrink: 0; }
        .alloc-bar-bg { flex: 1; height: 16px; background-color: #0f172a; border-radius: 4px; display: flex; overflow: hidden; }
        .alloc-bar-guaranteed { height: 100%; position: relative; }
        .alloc-bar-used { height: 100%; opacity: 0.5; }
        .alloc-bar-borrowed { height: 100%; }
        .alloc-bar-donated { height: 100%; background-color: #475569; opacity: 0.3; }
        .alloc-values { display: flex; gap: 4px; min-width: 100px; font-size: 11px; }
        .alloc-val-base { color: white; font-weight: bold; }
        .alloc-val-borrowed { color: #fbbf24; }
        .alloc-val-donated { color: #38bdf8; }

        .donor-info { display: flex; gap: 4px; margin-left: 76px; margin-top: 2px; align-items: center; flex-wrap: wrap; }
        .donor-arrow { color: #fbbf24; font-size: 10px; }
        .donor-tag { font-size: 10px; padding: 1px 6px; border-radius: 3px; font-weight: bold; }

        .spectrum-legend { display: flex; gap: 12px; margin-top: 8px; }
        .legend-item { display: flex; align-items: center; gap: 4px; font-size: 11px; color: #94a3b8; }
        .legend-swatch { width: 16px; height: 10px; border-radius: 2px; }
        .legend-swatch-donated { background-color: #475569; opacity: 0.3; }

        /* 5QI Reference panel */
        .btn-5qi-active { background-color: #0891b2; color: white; }
        .qfi-panel { background-color: #1e293b; border-radius: 8px; padding: 12px; margin-bottom: 8px; }
        .qfi-panel .config-table { font-size: 11px; }
        .qfi-panel .table-cell { padding: 3px 4px; color: #cbd5e1; }
        .qfi-panel .table-header { padding: 3px 4px; }
      `;
    }
  }

  customElements.define('unified-5g-viz', Unified5GViz);
})();
