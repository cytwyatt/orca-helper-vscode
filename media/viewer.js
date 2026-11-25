/* global $3Dmol, Chart, acquireVsCodeApi */
(function () {
  const vscode = acquireVsCodeApi();
  const HARTREE_TO_KCAL = 627.509474;
  const HARTREE_TO_KJ = 2625.499638;

  let data = null;
  let config = {
    defaultRepresentation: 'ballstick',
    showGhostAtoms: true,
    irBroadeningFwhm: 20,
    uvBroadeningEv: 0.3
  };

  let viewer = null;
  let currentFrameIdx = 0;
  let playTimer = null;
  let isPlaying = false;

  // Style state
  let representation = 'ballstick';
  let labelMode = 'none';
  let colorMode = 'element'; // element | mulliken | loewdin | hirshfeld
  let showGhosts = true;
  let showDipole = false;
  let showGradients = true;
  let darkBg = true;

  // Measurement state
  let measureMode = false;
  let selectedAtoms = []; // [{index, element, x, y, z, isGhost}]
  let measureShapes = [];
  let measureLabels = [];

  // Vibration animation state
  let activeVibMode = null;
  let vibAnimFrame = null;
  let vibStartTime = 0;
  let vibAmplitude = 0.45;
  let vibSpeed = 1.0;
  let showVibVectors = false;
  let hideTransRot = true;

  // Chart instances
  const charts = {};
  let energyUnit = 'kcal'; // eh | kcal | kj
  let irFwhm = 20;
  let uvSigma = 0.3;
  let activeChargeScheme = 'mulliken';

  // DOM helpers
  const $ = (id) => document.getElementById(id);

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function destroyChart(key) {
    if (charts[key]) {
      charts[key].destroy();
      delete charts[key];
    }
  }

  function initViewer() {
    const el = $('mol-viewport');
    if (!el || typeof $3Dmol === 'undefined') {
      return;
    }
    if (!viewer) {
      viewer = $3Dmol.createViewer(el, {
        backgroundColor: darkBg ? '#131720' : '#f8fafc',
        antialias: true
      });
      if (typeof ResizeObserver !== 'undefined') {
        new ResizeObserver(() => {
          if (viewer) {
            viewer.resize();
            viewer.render();
          }
        }).observe(el);
      }
    }
  }

  function buildXyzString(atoms, comment) {
    const lines = [String(atoms.length), comment || 'ORCA 6 Helper'];
    for (const a of atoms) {
      lines.push(
        `${a.element} ${a.x.toFixed(6)} ${a.y.toFixed(6)} ${a.z.toFixed(6)}`
      );
    }
    return lines.join('\n');
  }

  function getChargeArrayForScheme(scheme) {
    if (!data) return [];
    if (scheme === 'loewdin' && data.loewdinCharges.length > 0) return data.loewdinCharges;
    if (scheme === 'hirshfeld' && data.hirshfeldCharges.length > 0) return data.hirshfeldCharges;
    if (data.mullikenCharges.length > 0) return data.mullikenCharges;
    if (data.loewdinCharges.length > 0) return data.loewdinCharges;
    return data.hirshfeldCharges || [];
  }

  function chargeToColor(val, maxAbs) {
    const norm = Math.max(-1, Math.min(1, val / (maxAbs || 0.5)));
    if (norm < 0) {
      // Negative -> red
      const t = -norm;
      const g = Math.round(255 * (1 - t * 0.78));
      const b = Math.round(255 * (1 - t * 0.78));
      return `rgb(245,${g},${b})`;
    } else {
      // Positive -> blue
      const t = norm;
      const r = Math.round(255 * (1 - t * 0.78));
      const g = Math.round(255 * (1 - t * 0.55));
      return `rgb(${r},${g},250)`;
    }
  }

  function getStyleSpec(rep, customColor) {
    const colorPart = customColor ? { color: customColor } : { colorscheme: 'Jmol' };
    switch (rep) {
      case 'stick':
        return { stick: { radius: 0.16, ...colorPart } };
      case 'sphere':
        return { sphere: { scale: 0.85, ...colorPart } };
      case 'line':
        return { line: { linewidth: 2, ...colorPart } };
      case 'ballstick':
      default:
        return {
          stick: { radius: 0.12, ...colorPart },
          sphere: { scale: 0.28, ...colorPart }
        };
    }
  }

  function renderFrame(frameIdx, keepCamera = false, customAtoms = null) {
    if (!data || !data.frames || data.frames.length === 0) {
      return;
    }
    initViewer();
    if (!viewer) return;

    currentFrameIdx = Math.max(0, Math.min(frameIdx, data.frames.length - 1));
    const frame = data.frames[currentFrameIdx];
    const atoms = customAtoms || frame.atoms;

    let savedView = null;
    if (keepCamera) {
      try {
        savedView = viewer.getView();
      } catch (_) {}
    }

    viewer.removeAllModels();
    viewer.removeAllShapes();
    viewer.removeAllLabels();
    measureShapes = [];
    measureLabels = [];

    const realAtoms = atoms.filter((a) => !a.isGhost);
    const ghostAtoms = atoms.filter((a) => a.isGhost);

    // Charge lookup map
    const chargeMap = new Map();
    const scheme = colorMode !== 'element' ? colorMode : activeChargeScheme;
    const chList = getChargeArrayForScheme(scheme);
    let maxAbsChg = 0.2;
    for (const c of chList) {
      chargeMap.set(c.atomIndex, c.charge);
      maxAbsChg = Math.max(maxAbsChg, Math.abs(c.charge));
    }

    // 1. Add real atoms model
    if (realAtoms.length > 0) {
      const mReal = viewer.addModel(buildXyzString(realAtoms, frame.label), 'xyz');
      const modelAtoms = mReal.selectedAtoms({});
      for (let k = 0; k < modelAtoms.length && k < realAtoms.length; k++) {
        modelAtoms[k].orcaAtom = realAtoms[k];
      }

      if (colorMode !== 'element' && chList.length > 0) {
        for (let k = 0; k < realAtoms.length; k++) {
          const ch = chargeMap.get(realAtoms[k].index) ?? 0;
          const col = chargeToColor(ch, maxAbsChg);
          mReal.setStyle({ index: k }, getStyleSpec(representation, col));
        }
      } else {
        mReal.setStyle({}, getStyleSpec(representation, null));
      }

      // Click handler for measurements / inspection
      mReal.setClickable({}, true, (atomObj) => {
        if (atomObj && atomObj.orcaAtom) {
          handleAtomClick(atomObj.orcaAtom);
        }
      });
    }

    // 2. Add ghost atoms as separate translucent model
    if (showGhosts && ghostAtoms.length > 0) {
      const mGhost = viewer.addModel(buildXyzString(ghostAtoms, 'ghost'), 'xyz');
      const gModelAtoms = mGhost.selectedAtoms({});
      for (let k = 0; k < gModelAtoms.length && k < ghostAtoms.length; k++) {
        gModelAtoms[k].orcaAtom = ghostAtoms[k];
      }
      mGhost.setStyle(
        {},
        {
          sphere: { radius: 0.24, color: '#38bdf8', opacity: 0.42 },
          stick: { radius: 0.06, color: '#38bdf8', opacity: 0.3 }
        }
      );
      mGhost.setClickable({}, true, (atomObj) => {
        if (atomObj && atomObj.orcaAtom) {
          handleAtomClick(atomObj.orcaAtom);
        }
      });
    }

    // 3. Atom labels
    if (labelMode !== 'none') {
      const targetAtoms = showGhosts ? atoms : realAtoms;
      for (const a of targetAtoms) {
        let text = '';
        if (labelMode === 'element') {
          text = a.isGhost ? `${a.element}:` : a.element;
        } else if (labelMode === 'index') {
          text = String(a.index);
        } else if (labelMode === 'elemIndex') {
          text = `${a.element}${a.isGhost ? ':' : ''}${a.index}`;
        } else if (labelMode === 'charge') {
          const ch = chargeMap.get(a.index);
          text = ch !== undefined ? (ch >= 0 ? `+${ch.toFixed(2)}` : ch.toFixed(2)) : '';
        }
        if (text) {
          viewer.addLabel(text, {
            position: { x: a.x, y: a.y, z: a.z },
            fontSize: 11,
            fontColor: darkBg ? '#f1f5f9' : '#0f172a',
            backgroundColor: darkBg ? 'rgba(15,23,42,0.68)' : 'rgba(255,255,255,0.78)',
            backgroundOpacity: 0.72,
            borderThickness: 0,
            inFront: true
          });
        }
      }
    }

    // 4. Dipole moment arrow
    if (showDipole && data.dipole && realAtoms.length > 0) {
      const cx = realAtoms.reduce((s, a) => s + a.x, 0) / realAtoms.length;
      const cy = realAtoms.reduce((s, a) => s + a.y, 0) / realAtoms.length;
      const cz = realAtoms.reduce((s, a) => s + a.z, 0) / realAtoms.length;
      const mag = Math.hypot(data.dipole.x, data.dipole.y, data.dipole.z);
      if (mag > 1e-6) {
        const scale = Math.min(3.5, Math.max(1.2, data.dipole.magnitudeDebye * 0.65)) / mag;
        const ex = cx + data.dipole.x * scale;
        const ey = cy + data.dipole.y * scale;
        const ez = cz + data.dipole.z * scale;
        viewer.addArrow({
          start: { x: cx, y: cy, z: cz },
          end: { x: ex, y: ey, z: ez },
          radius: 0.09,
          radiusRatio: 2.2,
          mid: 0.78,
          color: '#facc15'
        });
        viewer.addLabel(`μ = ${data.dipole.magnitudeDebye.toFixed(2)} D`, {
          position: { x: ex, y: ey, z: ez },
          fontSize: 11,
          fontColor: '#fef08a',
          backgroundColor: 'rgba(20,22,28,0.8)'
        });
      }
    }

    // 5. Gradient arrows (.engrad)
    if (showGradients && data.fileType === 'engrad') {
      let maxG = 0;
      for (const a of atoms) {
        if (a.gx !== undefined) {
          maxG = Math.max(maxG, Math.hypot(a.gx, a.gy, a.gz));
        }
      }
      const gScale = maxG > 1e-8 ? 1.5 / maxG : 0;
      for (const a of atoms) {
        if (a.gx !== undefined && gScale > 0) {
          const gNorm = Math.hypot(a.gx, a.gy, a.gz);
          if (gNorm > maxG * 0.05) {
            viewer.addArrow({
              start: { x: a.x, y: a.y, z: a.z },
              end: {
                x: a.x - a.gx * gScale,
                y: a.y - a.gy * gScale,
                z: a.z - a.gz * gScale
              },
              radius: 0.05,
              color: '#f87171'
            });
          }
        }
      }
    }

    // 6. Vibrational displacement arrows (if enabled while animating a mode)
    if (showVibVectors && activeVibMode && activeVibMode.displacements) {
      const baseAtoms = data.frames[currentFrameIdx].atoms;
      let maxD = 0;
      for (const d of activeVibMode.displacements) {
        maxD = Math.max(maxD, Math.hypot(d.dx, d.dy, d.dz));
      }
      const scale = maxD > 1e-6 ? 1.4 / maxD : 0;
      for (let i = 0; i < baseAtoms.length && i < activeVibMode.displacements.length; i++) {
        const a = baseAtoms[i];
        const d = activeVibMode.displacements[i];
        const norm = Math.hypot(d.dx, d.dy, d.dz);
        if (norm > maxD * 0.08) {
          viewer.addArrow({
            start: { x: a.x, y: a.y, z: a.z },
            end: { x: a.x + d.dx * scale, y: a.y + d.dy * scale, z: a.z + d.dz * scale },
            radius: 0.05,
            color: '#38bdf8'
          });
        }
      }
    }

    // Re-draw measurement overlays if any
    redrawMeasurements();

    if (savedView) {
      viewer.setView(savedView);
    } else {
      viewer.zoomTo();
    }
    viewer.render();

    updateTrajectoryUI();
    updateActiveCycleConvergence();
  }

  // ---- Geometry measurement math ----
  function vecSub(a, b) {
    return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  }
  function dot(u, v) {
    return u.x * v.x + u.y * v.y + u.z * v.z;
  }
  function cross(u, v) {
    return {
      x: u.y * v.z - u.z * v.y,
      y: u.z * v.x - u.x * v.z,
      z: u.x * v.y - u.y * v.x
    };
  }
  function norm(u) {
    return Math.hypot(u.x, u.y, u.z);
  }
  function calcDistance(a, b) {
    return norm(vecSub(a, b));
  }
  function calcAngle(a, b, c) {
    const ba = vecSub(a, b);
    const bc = vecSub(c, b);
    const cos = Math.max(-1, Math.min(1, dot(ba, bc) / (norm(ba) * norm(bc) || 1)));
    return (Math.acos(cos) * 180) / Math.PI;
  }
  function calcDihedral(a, b, c, d) {
    const b1 = vecSub(b, a);
    const b2 = vecSub(c, b);
    const b3 = vecSub(d, c);
    const n1 = cross(b1, b2);
    const n2 = cross(b2, b3);
    const m1 = cross(n1, { x: b2.x / (norm(b2) || 1), y: b2.y / (norm(b2) || 1), z: b2.z / (norm(b2) || 1) });
    const x = dot(n1, n2);
    const y = dot(m1, n2);
    return (Math.atan2(y, x) * 180) / Math.PI;
  }

  function handleAtomClick(atom) {
    if (!measureMode) {
      // Quick atom info chip
      const chip = $('atom-info-chip');
      if (chip) {
        chip.classList.remove('hidden');
        const extra = atom.isGhost ? ' [GHOST]' : atom.hasEcp ? ' [ECP]' : '';
        chip.textContent = `Atom #${atom.index} (${atom.element}${extra}): (${atom.x.toFixed(4)}, ${atom.y.toFixed(4)}, ${atom.z.toFixed(4)}) Å`;
      }
      return;
    }

    const existsIdx = selectedAtoms.findIndex((a) => a.index === atom.index);
    if (existsIdx >= 0) {
      selectedAtoms.splice(existsIdx, 1);
    } else {
      if (selectedAtoms.length >= 4) {
        selectedAtoms = [];
      }
      selectedAtoms.push(atom);
    }
    redrawMeasurements();
    if (viewer) viewer.render();
  }

  function redrawMeasurements() {
    if (!viewer) return;
    for (const s of measureShapes) {
      try { viewer.removeShape(s); } catch (_) {}
    }
    for (const l of measureLabels) {
      try { viewer.removeLabel(l); } catch (_) {}
    }
    measureShapes = [];
    measureLabels = [];

    const bar = $('measure-overlay');
    const txt = $('measure-text');
    if (!measureMode || selectedAtoms.length === 0) {
      if (bar) bar.classList.add('hidden');
      return;
    }

    // Refresh coordinates from current frame
    const frameAtoms = data?.frames?.[currentFrameIdx]?.atoms || [];
    const curSel = selectedAtoms.map((s) => frameAtoms[s.index] || s);

    for (const a of curSel) {
      measureShapes.push(
        viewer.addSphere({
          center: { x: a.x, y: a.y, z: a.z },
          radius: 0.42,
          color: '#facc15',
          opacity: 0.48
        })
      );
    }

    for (let i = 0; i < curSel.length - 1; i++) {
      const a = curSel[i];
      const b = curSel[i + 1];
      measureShapes.push(
        viewer.addCylinder({
          start: { x: a.x, y: a.y, z: a.z },
          end: { x: b.x, y: b.y, z: b.z },
          radius: 0.04,
          color: '#facc15',
          dashed: true
        })
      );
    }

    let summary = '';
    const tag = (a) => `${a.element}${a.index}`;
    if (curSel.length === 1) {
      const a = curSel[0];
      summary = `Selected ${tag(a)} — click a 2nd atom for distance, 3rd for angle, 4th for dihedral`;
    } else if (curSel.length === 2) {
      const d = calcDistance(curSel[0], curSel[1]);
      summary = `Distance ${tag(curSel[0])} – ${tag(curSel[1])} = ${d.toFixed(4)} Å`;
      measureLabels.push(
        viewer.addLabel(`${d.toFixed(3)} Å`, {
          position: {
            x: (curSel[0].x + curSel[1].x) / 2,
            y: (curSel[0].y + curSel[1].y) / 2,
            z: (curSel[0].z + curSel[1].z) / 2
          },
          fontSize: 12,
          fontColor: '#fef08a',
          backgroundColor: 'rgba(15,23,42,0.85)'
        })
      );
    } else if (curSel.length === 3) {
      const ang = calcAngle(curSel[0], curSel[1], curSel[2]);
      summary = `Angle ${tag(curSel[0])} – ${tag(curSel[1])} – ${tag(curSel[2])} = ${ang.toFixed(2)}°`;
      measureLabels.push(
        viewer.addLabel(`${ang.toFixed(1)}°`, {
          position: { x: curSel[1].x, y: curSel[1].y + 0.4, z: curSel[1].z },
          fontSize: 12,
          fontColor: '#fef08a',
          backgroundColor: 'rgba(15,23,42,0.85)'
        })
      );
    } else if (curSel.length === 4) {
      const dih = calcDihedral(curSel[0], curSel[1], curSel[2], curSel[3]);
      summary = `Dihedral ${tag(curSel[0])}–${tag(curSel[1])}–${tag(curSel[2])}–${tag(curSel[3])} = ${dih.toFixed(2)}°`;
    }

    if (bar && txt) {
      txt.textContent = summary;
      bar.classList.remove('hidden');
    }
  }

  // ---- Trajectory playback ----
  function stopPlayback() {
    if (playTimer) {
      clearInterval(playTimer);
      playTimer = null;
    }
    isPlaying = false;
    const btn = $('btn-play');
    if (btn) btn.textContent = '▶ Play';
  }

  function startPlayback() {
    if (!data || data.frames.length <= 1) return;
    stopVibration();
    isPlaying = true;
    const btn = $('btn-play');
    if (btn) btn.textContent = '⏸ Pause';
    const speed = parseFloat($('traj-speed')?.value || '1');
    const intervalMs = Math.max(80, Math.round(450 / speed));
    playTimer = setInterval(() => {
      let next = currentFrameIdx + 1;
      if (next >= data.frames.length) {
        if ($('traj-loop')?.checked) {
          next = 0;
        } else {
          stopPlayback();
          return;
        }
      }
      renderFrame(next, true);
    }, intervalMs);
  }

  function updateTrajectoryUI() {
    const bar = $('traj-bar');
    if (!bar || !data) return;
    if (data.frames.length <= 1) {
      bar.classList.add('hidden');
      return;
    }
    bar.classList.remove('hidden');
    const slider = $('traj-slider');
    if (slider) {
      slider.max = String(data.frames.length - 1);
      slider.value = String(currentFrameIdx);
    }
    const frame = data.frames[currentFrameIdx];
    const refE = data.frames[0]?.energy;
    let eText = '';
    if (frame.energy !== undefined) {
      eText = ` | E = ${frame.energy.toFixed(6)} Eh`;
      if (refE !== undefined) {
        const dKcal = (frame.energy - refE) * HARTREE_TO_KCAL;
        eText += ` (ΔE = ${dKcal >= 0 ? '+' : ''}${dKcal.toFixed(2)} kcal/mol)`;
      }
    }
    const info = $('traj-info');
    if (info) {
      info.textContent = `Frame ${currentFrameIdx + 1} / ${data.frames.length} — ${frame.label}${eText}`;
    }
  }

  // ---- Vibrational mode animation ----
  function stopVibration() {
    if (vibAnimFrame) {
      cancelAnimationFrame(vibAnimFrame);
      vibAnimFrame = null;
    }
    const wasActive = activeVibMode !== null;
    activeVibMode = null;
    $('vib-bar')?.classList.add('hidden');
    document.querySelectorAll('.freq-row.selected-row').forEach((el) => el.classList.remove('selected-row'));
    if (wasActive && data && data.frames.length > 0) {
      renderFrame(currentFrameIdx, true);
    }
  }

  function startVibration(mode) {
    if (!mode || !mode.displacements || !data || data.frames.length === 0) {
      return;
    }
    stopPlayback();
    if (vibAnimFrame) {
      cancelAnimationFrame(vibAnimFrame);
      vibAnimFrame = null;
    }
    activeVibMode = mode;
    // Switch to final geometry for frequency animation
    currentFrameIdx = data.frames.length - 1;
    const baseAtoms = data.frames[currentFrameIdx].atoms;

    const vibBar = $('vib-bar');
    const vibLabel = $('vib-label');
    if (vibBar && vibLabel) {
      vibLabel.textContent = `Mode ${mode.mode}: ${mode.frequency.toFixed(2)} cm⁻¹${mode.isImaginary ? ' (IMAGINARY)' : ''}`;
      vibBar.classList.remove('hidden');
    }

    // Highlight table row
    document.querySelectorAll('.freq-row').forEach((el) => {
      el.classList.toggle('selected-row', Number(el.dataset.mode) === mode.mode);
    });

    // Normalize displacement scale so max atom moves by vibAmplitude
    let maxD = 0;
    for (const d of mode.displacements) {
      maxD = Math.max(maxD, Math.hypot(d.dx, d.dy, d.dz));
    }
    const normFactor = maxD > 1e-6 ? 1 / maxD : 1;

    // Render base frame once so camera is initialized
    renderFrame(currentFrameIdx, true);
    vibStartTime = performance.now();
    let lastDraw = 0;

    function tick(now) {
      if (!activeVibMode) return;
      if (now - lastDraw >= 33) {
        lastDraw = now;
        const phase = Math.sin(((now - vibStartTime) / 1000) * 4.5 * vibSpeed);
        const scale = phase * vibAmplitude * normFactor;
        const displaced = baseAtoms.map((a, idx) => {
          const d = activeVibMode.displacements[idx];
          if (!d) return a;
          return {
            ...a,
            x: a.x + d.dx * scale,
            y: a.y + d.dy * scale,
            z: a.z + d.dz * scale
          };
        });
        renderFrame(currentFrameIdx, true, displaced);
      }
      vibAnimFrame = requestAnimationFrame(tick);
    }
    vibAnimFrame = requestAnimationFrame(tick);
  }

  // ---- Tabs & Panels Rendering ----
  function setupTabs() {
    const hasConv =
      data.optCycles.length > 0 ||
      data.scfSteps.length > 0 ||
      data.frames.filter((f) => f.energy !== undefined).length > 1;
    const hasFreq = data.frequencies.length > 0;
    const hasUv = data.excitedStates.length > 0;
    const hasOrbOrChg =
      data.orbitals.length > 0 ||
      data.mullikenCharges.length > 0 ||
      data.loewdinCharges.length > 0 ||
      data.hirshfeldCharges.length > 0;

    $('tab-btn-conv').classList.toggle('hidden', !hasConv);
    $('tab-btn-freq').classList.toggle('hidden', !hasFreq);
    $('tab-btn-uv').classList.toggle('hidden', !hasUv);
    $('tab-btn-orb').classList.toggle('hidden', !hasOrbOrChg);

    if (hasFreq) {
      $('tab-btn-freq').textContent =
        data.imaginaryCount > 0
          ? `Frequencies (${data.frequencies.length}, ${data.imaginaryCount} imag!)`
          : `Frequencies & IR (${data.frequencies.length})`;
    }
    if (hasUv) {
      $('tab-btn-uv').textContent = `UV-Vis (${data.excitedStates.length})`;
    }

    // Ensure an active visible tab is selected
    const activeBtn = document.querySelector('.tab-btn.active:not(.hidden)');
    if (!activeBtn) {
      switchTab('summary');
    }
  }

  function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.tab === tabName);
    });
    document.querySelectorAll('.tab-panel').forEach((p) => {
      p.classList.toggle('hidden', p.id !== `panel-${tabName}`);
    });
    if (tabName === 'conv') {
      renderConvergenceCharts();
    } else if (tabName === 'freq') {
      renderIrChart();
    } else if (tabName === 'uv') {
      renderUvChart();
    }
  }

  function renderSummaryTab() {
    const kpi = $('summary-kpis');
    const cards = [];

    cards.push({ label: 'Formula', val: data.formula });
    cards.push({
      label: 'Atoms',
      val: data.nGhostAtoms > 0 ? `${data.nAtoms} (${data.nGhostAtoms} ghost)` : String(data.nAtoms)
    });
    if (data.charge !== undefined && data.multiplicity !== undefined) {
      cards.push({ label: 'Charge / Mult', val: `${data.charge} / ${data.multiplicity}` });
    }
    if (data.finalEnergyEh !== undefined) {
      cards.push({ label: 'Final Energy', val: `${data.finalEnergyEh.toFixed(8)} Eh` });
    }
    if (data.mp2EnergyEh !== undefined && data.mp2EnergyEh !== data.finalEnergyEh) {
      cards.push({ label: 'MP2 Energy', val: `${data.mp2EnergyEh.toFixed(8)} Eh` });
    }
    if (data.optCycles.length > 0) {
      cards.push({
        label: 'Opt Cycles',
        val: `${data.optCycles.length} (${data.optConverged ? 'Converged' : 'Not converged'})`
      });
    } else if (data.frames.length > 1) {
      cards.push({ label: 'Frames', val: String(data.frames.length) });
    }
    if (data.frequencies.length > 0) {
      cards.push({
        label: 'Imaginary Freqs',
        val: data.imaginaryCount > 0 ? `${data.imaginaryCount} ⚠️` : '0 (Minimum ✓)'
      });
    }
    if (data.homoLumoGapEv !== undefined) {
      cards.push({ label: 'HOMO–LUMO Gap', val: `${data.homoLumoGapEv.toFixed(3)} eV` });
    }
    if (data.dipole) {
      cards.push({ label: 'Dipole Moment', val: `${data.dipole.magnitudeDebye.toFixed(3)} D` });
    }
    if (data.thermo?.zpeEh !== undefined) {
      cards.push({ label: 'ZPE', val: `${data.thermo.zpeEh.toFixed(6)} Eh` });
    }
    if (data.thermo?.finalGibbsEh !== undefined) {
      cards.push({ label: 'Gibbs Free Energy', val: `${data.thermo.finalGibbsEh.toFixed(6)} Eh` });
    }
    if (data.runtime) {
      cards.push({ label: 'Total Runtime', val: data.runtime });
    }

    kpi.innerHTML = cards
      .map(
        (c) =>
          `<div class="kpi-card"><div class="kpi-label">${escapeHtml(c.label)}</div><div class="kpi-val">${escapeHtml(c.val)}</div></div>`
      )
      .join('');

    // Keywords
    const kwSec = $('summary-keywords-sec');
    if (data.simpleInputKeywords && data.simpleInputKeywords.length > 0) {
      kwSec.classList.remove('hidden');
      $('summary-keywords').innerHTML = data.simpleInputKeywords
        .map((k) => `<span class="kw-pill">${escapeHtml(k)}</span>`)
        .join('');
    } else {
      kwSec.classList.add('hidden');
    }

    // Thermochemistry table
    const thermoSec = $('summary-thermo-sec');
    if (data.thermo) {
      thermoSec.classList.remove('hidden');
      const t = data.thermo;
      const rows = [
        ['Temperature / Pressure', `${t.temperatureK ?? '—'} K / ${t.pressureAtm ?? '—'} atm`],
        ['Point Group / Mass', `${t.pointGroup ?? '—'} / ${t.totalMassAmu ? t.totalMassAmu.toFixed(2) + ' AMU' : '—'}`],
        ['Electronic Energy', t.electronicEnergyEh !== undefined ? `${t.electronicEnergyEh.toFixed(8)} Eh` : '—'],
        ['Zero-Point Energy (ZPE)', t.zpeEh !== undefined ? `${t.zpeEh.toFixed(8)} Eh (${t.zpeKcal?.toFixed(2) ?? '—'} kcal/mol)` : '—'],
        ['Total Thermal Energy (U)', t.totalThermalEnergyEh !== undefined ? `${t.totalThermalEnergyEh.toFixed(8)} Eh` : '—'],
        ['Total Enthalpy (H)', t.totalEnthalpyEh !== undefined ? `${t.totalEnthalpyEh.toFixed(8)} Eh` : '—'],
        ['Final Gibbs Energy (G)', t.finalGibbsEh !== undefined ? `${t.finalGibbsEh.toFixed(8)} Eh` : '—'],
        ['G − E(el)', t.gMinusEelEh !== undefined ? `${t.gMinusEelEh.toFixed(8)} Eh (${t.gMinusEelKcal?.toFixed(2) ?? '—'} kcal/mol)` : '—']
      ];
      $('summary-thermo-body').innerHTML = rows
        .map(([k, v]) => `<tr><td>${escapeHtml(k)}</td><td>${escapeHtml(v)}</td></tr>`)
        .join('');
    } else {
      thermoSec.classList.add('hidden');
    }

    // Errors & warnings
    const errSec = $('summary-errors-sec');
    const msgs = [
      ...data.errors.map((e) => ({ kind: 'err', ...e })),
      ...data.warnings.map((w) => ({ kind: 'warn', ...w }))
    ];
    if (msgs.length > 0) {
      errSec.classList.remove('hidden');
      $('summary-errors-list').innerHTML = msgs
        .map(
          (m) =>
            `<div class="msg-item ${m.kind}" data-line="${m.line}">L${m.line + 1}: ${escapeHtml(m.message)}</div>`
        )
        .join('');
      $('summary-errors-list').querySelectorAll('.msg-item').forEach((el) => {
        el.addEventListener('click', () => {
          vscode.postMessage({ type: 'jumpToLine', line: Number(el.dataset.line) });
        });
      });
    } else {
      errSec.classList.add('hidden');
    }

    updateActiveCycleConvergence();
  }

  function updateActiveCycleConvergence() {
    const convSec = $('summary-conv-sec');
    if (!convSec || !data || data.optCycles.length === 0) {
      convSec?.classList.add('hidden');
      return;
    }
    // Find matching opt cycle for currentFrameIdx, fallback to last cycle
    let cyc = data.optCycles.find((c) => c.frameIndex === currentFrameIdx);
    if (!cyc) cyc = data.optCycles[data.optCycles.length - 1];
    if (!cyc || !cyc.criteria || cyc.criteria.length === 0) {
      convSec.classList.add('hidden');
      return;
    }
    convSec.classList.remove('hidden');
    $('summary-conv-title').textContent = `Geometry Convergence — Cycle ${cyc.cycle}`;
    $('summary-conv-body').innerHTML = cyc.criteria
      .map(
        (c) =>
          `<tr>
            <td>${escapeHtml(c.item)}</td>
            <td>${c.value.toExponential(3)}</td>
            <td>${c.tolerance.toExponential(2)}</td>
            <td><span class="badge ${c.converged ? 'badge-ok' : 'badge-warn'}">${c.converged ? 'YES' : 'NO'}</span></td>
          </tr>`
      )
      .join('');
  }

  // ---- Convergence & Energy Charts ----
  function renderConvergenceCharts() {
    if (!data || typeof Chart === 'undefined') return;

    const textColor = getComputedStyle(document.body).color || '#cccccc';
    const gridColor = 'rgba(128,128,128,0.18)';

    // 1. Energy profile (Opt cycles or XYZ frames with energy)
    const energyPoints =
      data.optCycles.filter((c) => c.energy !== undefined).length > 0
        ? data.optCycles
            .filter((c) => c.energy !== undefined)
            .map((c) => ({
              label: `C${c.cycle}`,
              energy: c.energy,
              frameIndex: c.frameIndex ?? c.cycle - 1
            }))
        : data.frames
            .filter((f) => f.energy !== undefined)
            .map((f) => ({
              label: `F${f.index + 1}`,
              energy: f.energy,
              frameIndex: f.index
            }));

    const eCard = $('chart-energy-card');
    if (energyPoints.length > 0) {
      eCard.classList.remove('hidden');
      const minE = Math.min(...energyPoints.map((p) => p.energy));
      const yData = energyPoints.map((p) => {
        if (energyUnit === 'kcal') return (p.energy - minE) * HARTREE_TO_KCAL;
        if (energyUnit === 'kj') return (p.energy - minE) * HARTREE_TO_KJ;
        return p.energy;
      });
      const yLabel =
        energyUnit === 'kcal'
          ? 'ΔE (kcal/mol)'
          : energyUnit === 'kj'
            ? 'ΔE (kJ/mol)'
            : 'Energy (Eh)';

      destroyChart('energy');
      charts.energy = new Chart($('chart-energy'), {
        type: 'line',
        data: {
          labels: energyPoints.map((p) => p.label),
          datasets: [
            {
              label: yLabel,
              data: yData,
              borderColor: '#38bdf8',
              backgroundColor: 'rgba(56, 189, 248, 0.15)',
              tension: 0.15,
              pointRadius: 4,
              pointHoverRadius: 6,
              fill: true
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          onClick: (_, elements) => {
            if (elements.length > 0) {
              const idx = elements[0].index;
              const pt = energyPoints[idx];
              if (pt && pt.frameIndex !== undefined) {
                stopPlayback();
                stopVibration();
                renderFrame(pt.frameIndex, true);
              }
            }
          },
          plugins: {
            legend: { labels: { color: textColor } },
            tooltip: {
              callbacks: {
                afterLabel: (ctx) => {
                  const pt = energyPoints[ctx.dataIndex];
                  return `Abs: ${pt.energy.toFixed(8)} Eh (click to view 3D)`;
                }
              }
            }
          },
          scales: {
            x: { ticks: { color: textColor }, grid: { color: gridColor } },
            y: {
              title: { display: true, text: yLabel, color: textColor },
              ticks: { color: textColor },
              grid: { color: gridColor }
            }
          }
        }
      });
    } else {
      eCard.classList.add('hidden');
    }

    // 2. Gradient & Step Convergence (log scale)
    const gradCycles = data.optCycles.filter(
      (c) => c.rmsGrad !== undefined || c.maxGrad !== undefined
    );
    const gCard = $('chart-grad-card');
    if (gradCycles.length > 0) {
      gCard.classList.remove('hidden');
      const safeLog = (v) => (v !== undefined && Math.abs(v) > 0 ? Math.abs(v) : null);
      destroyChart('grad');
      charts.grad = new Chart($('chart-grad'), {
        type: 'line',
        data: {
          labels: gradCycles.map((c) => `C${c.cycle}`),
          datasets: [
            {
              label: 'RMS Grad',
              data: gradCycles.map((c) => safeLog(c.rmsGrad)),
              borderColor: '#3fb950',
              tension: 0.1,
              pointRadius: 3
            },
            {
              label: 'MAX Grad',
              data: gradCycles.map((c) => safeLog(c.maxGrad)),
              borderColor: '#f85149',
              tension: 0.1,
              pointRadius: 3
            },
            {
              label: 'RMS Step',
              data: gradCycles.map((c) => safeLog(c.rmsStep)),
              borderColor: '#d29922',
              borderDash: [4, 3],
              tension: 0.1,
              pointRadius: 2.5
            },
            {
              label: 'MAX Step',
              data: gradCycles.map((c) => safeLog(c.maxStep)),
              borderColor: '#a78bfa',
              borderDash: [4, 3],
              tension: 0.1,
              pointRadius: 2.5
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          onClick: (_, elements) => {
            if (elements.length > 0) {
              const c = gradCycles[elements[0].index];
              if (c && c.frameIndex !== undefined) {
                stopPlayback();
                stopVibration();
                renderFrame(c.frameIndex, true);
              }
            }
          },
          plugins: { legend: { labels: { color: textColor, boxWidth: 12 } } },
          scales: {
            x: { ticks: { color: textColor }, grid: { color: gridColor } },
            y: {
              type: 'logarithmic',
              title: { display: true, text: 'a.u. (log)', color: textColor },
              ticks: { color: textColor },
              grid: { color: gridColor }
            }
          }
        }
      });
    } else {
      gCard.classList.add('hidden');
    }

    // 3. SCF Convergence
    const scfCard = $('chart-scf-card');
    if (data.scfSteps.length > 1) {
      scfCard.classList.remove('hidden');
      const scfWithDelta = data.scfSteps.filter(
        (s) => s.deltaE !== undefined && Math.abs(s.deltaE) > 0
      );
      destroyChart('scf');
      charts.scf = new Chart($('chart-scf'), {
        type: 'line',
        data: {
          labels: scfWithDelta.map((s) => `${s.iter}`),
          datasets: [
            {
              label: '|ΔE| (Eh)',
              data: scfWithDelta.map((s) => Math.abs(s.deltaE)),
              borderColor: '#f59e0b',
              tension: 0.1,
              pointRadius: 2.5
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { labels: { color: textColor } } },
          scales: {
            x: { title: { display: true, text: 'SCF Iter', color: textColor }, ticks: { color: textColor }, grid: { color: gridColor } },
            y: { type: 'logarithmic', title: { display: true, text: '|ΔE| (Eh)', color: textColor }, ticks: { color: textColor }, grid: { color: gridColor } }
          }
        }
      });
    } else {
      scfCard.classList.add('hidden');
    }
  }

  // ---- Frequencies & IR Spectrum ----
  function renderFrequencyTable() {
    const tbody = $('freq-table-body');
    if (!tbody || !data) return;
    const modes = data.frequencies.filter((f) =>
      hideTransRot ? Math.abs(f.frequency) > 1.0 : true
    );
    tbody.innerHTML = modes
      .map((f) => {
        const badge = f.isImaginary
          ? ' <span class="badge badge-err">IMAG</span>'
          : '';
        const hasAnim = f.displacements && f.displacements.length > 0;
        return `<tr class="freq-row clickable" data-mode="${f.mode}">
          <td>${f.mode}</td>
          <td>${f.frequency.toFixed(2)}${badge}</td>
          <td>${f.irIntensity !== undefined ? f.irIntensity.toFixed(2) : '—'}</td>
          <td>${hasAnim ? '<button class="mini-play">▶</button>' : '—'}</td>
        </tr>`;
      })
      .join('');

    tbody.querySelectorAll('.freq-row').forEach((row) => {
      row.addEventListener('click', () => {
        const modeIdx = Number(row.dataset.mode);
        const mode = data.frequencies.find((f) => f.mode === modeIdx);
        if (mode && mode.displacements) {
          startVibration(mode);
        }
      });
    });
  }

  function renderIrChart() {
    if (!data || typeof Chart === 'undefined') return;
    const irModes = data.frequencies.filter(
      (f) => f.frequency > 1 && f.irIntensity !== undefined && f.irIntensity > 0
    );
    const card = $('chart-ir-card');
    if (irModes.length === 0) {
      card.classList.add('hidden');
      return;
    }
    card.classList.remove('hidden');

    const maxFreq = Math.max(4000, Math.ceil((Math.max(...irModes.map((m) => m.frequency)) + 200) / 100) * 100);
    const step = 4;
    const gamma = Math.max(2, irFwhm / 2);
    const curvePts = [];
    for (let x = 0; x <= maxFreq; x += step) {
      let y = 0;
      for (const m of irModes) {
        const dx = x - m.frequency;
        y += (m.irIntensity * (gamma * gamma)) / (dx * dx + gamma * gamma);
      }
      curvePts.push({ x, y });
    }

    const textColor = getComputedStyle(document.body).color || '#cccccc';
    const gridColor = 'rgba(128,128,128,0.18)';

    destroyChart('ir');
    charts.ir = new Chart($('chart-ir'), {
      type: 'line',
      data: {
        datasets: [
          {
            label: `Simulated IR (FWHM ${irFwhm} cm⁻¹)`,
            data: curvePts,
            parsing: false,
            borderColor: '#38bdf8',
            backgroundColor: 'rgba(56, 189, 248, 0.16)',
            borderWidth: 1.6,
            pointRadius: 0,
            fill: true
          },
          {
            type: 'scatter',
            label: 'IR Peaks (click to animate)',
            data: irModes.map((m) => ({ x: m.frequency, y: m.irIntensity, mode: m.mode })),
            backgroundColor: '#f59e0b',
            pointRadius: 3.5,
            pointHoverRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        onClick: (_, elements) => {
          const hit = elements.find((e) => e.datasetIndex === 1);
          if (hit) {
            const m = irModes[hit.index];
            if (m && m.displacements) startVibration(m);
          }
        },
        plugins: { legend: { labels: { color: textColor, boxWidth: 12 } } },
        scales: {
          x: {
            type: 'linear',
            reverse: true,
            min: 0,
            max: maxFreq,
            title: { display: true, text: 'Wavenumber (cm⁻¹)', color: textColor },
            ticks: { color: textColor },
            grid: { color: gridColor }
          },
          y: {
            beginAtZero: true,
            title: { display: true, text: 'Intensity (km/mol)', color: textColor },
            ticks: { color: textColor },
            grid: { color: gridColor }
          }
        }
      }
    });
  }

  // ---- UV-Vis Spectrum ----
  function renderUvTab() {
    const tbody = $('uv-table-body');
    if (!tbody || !data) return;
    tbody.innerHTML = data.excitedStates
      .map(
        (s) =>
          `<tr>
            <td>${s.state}</td>
            <td>${escapeHtml(s.transition)}</td>
            <td>${s.energyEv.toFixed(3)}</td>
            <td>${s.wavelengthNm.toFixed(1)}</td>
            <td>${s.fosc.toFixed(5)}</td>
          </tr>`
      )
      .join('');
  }

  function renderUvChart() {
    if (!data || data.excitedStates.length === 0 || typeof Chart === 'undefined') return;
    const wls = data.excitedStates.map((s) => s.wavelengthNm);
    const minNm = Math.max(100, Math.floor(Math.min(...wls) - 60));
    const maxNm = Math.ceil(Math.max(...wls) + 80);
    const sigma = Math.max(0.05, uvSigma);
    const pts = [];
    for (let nm = minNm; nm <= maxNm; nm += 2) {
      const eEv = 1239.84193 / nm;
      let val = 0;
      for (const s of data.excitedStates) {
        const d = (eEv - s.energyEv) / sigma;
        val += s.fosc * Math.exp(-0.5 * d * d);
      }
      pts.push({ x: nm, y: val });
    }
    const textColor = getComputedStyle(document.body).color || '#cccccc';
    const gridColor = 'rgba(128,128,128,0.18)';

    destroyChart('uv');
    charts.uv = new Chart($('chart-uv'), {
      type: 'line',
      data: {
        datasets: [
          {
            label: `UV-Vis (σ = ${sigma} eV)`,
            data: pts,
            parsing: false,
            borderColor: '#a78bfa',
            backgroundColor: 'rgba(167, 139, 250, 0.2)',
            borderWidth: 1.8,
            pointRadius: 0,
            fill: true
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: textColor } } },
        scales: {
          x: {
            type: 'linear',
            min: minNm,
            max: maxNm,
            title: { display: true, text: 'Wavelength (nm)', color: textColor },
            ticks: { color: textColor },
            grid: { color: gridColor }
          },
          y: {
            beginAtZero: true,
            title: { display: true, text: 'Relative Absorption', color: textColor },
            ticks: { color: textColor },
            grid: { color: gridColor }
          }
        }
      }
    });
  }

  // ---- Orbitals & Charges Tab ----
  function renderOrbitalsAndCharges() {
    // Orbitals (show frontier window HOMO-6 .. LUMO+6)
    const orbSec = $('orb-section');
    if (data.orbitals.length > 0) {
      orbSec.classList.remove('hidden');
      // Group by spin (show restricted or alpha first)
      const primarySpin = data.orbitals.some((o) => o.spin === 'restricted') ? 'restricted' : 'alpha';
      const spinOrbs = data.orbitals.filter((o) => o.spin === primarySpin);
      let homoIdx = -1;
      for (let i = 0; i < spinOrbs.length; i++) {
        if (spinOrbs[i].occ > 0.01) homoIdx = i;
      }
      const start = Math.max(0, homoIdx - 6);
      const end = Math.min(spinOrbs.length, (homoIdx >= 0 ? homoIdx : 0) + 7);
      const windowOrbs = spinOrbs.slice(start, end).reverse();

      $('orb-table-body').innerHTML = windowOrbs
        .map((o) => {
          const isHomo = homoIdx >= 0 && o.index === spinOrbs[homoIdx].index;
          const isLumo = homoIdx >= 0 && spinOrbs[homoIdx + 1] && o.index === spinOrbs[homoIdx + 1].index;
          const tag = isHomo ? 'HOMO' : isLumo ? 'LUMO' : o.occ > 0.01 ? 'Occ' : 'Virt';
          const cls = isHomo ? 'homo-row' : isLumo ? 'lumo-row' : '';
          return `<tr class="${cls}">
            <td>${o.index}</td>
            <td>${tag}</td>
            <td>${o.occ.toFixed(4)}</td>
            <td>${o.energyEh.toFixed(6)}</td>
            <td>${o.energyEv.toFixed(4)}</td>
          </tr>`;
        })
        .join('');
    } else {
      orbSec.classList.add('hidden');
    }

    // Charges
    const chgSec = $('charges-section');
    const schemeSel = $('charge-scheme');
    if (schemeSel) {
      schemeSel.querySelector('option[value="mulliken"]').disabled = data.mullikenCharges.length === 0;
      schemeSel.querySelector('option[value="loewdin"]').disabled = data.loewdinCharges.length === 0;
      schemeSel.querySelector('option[value="hirshfeld"]').disabled = data.hirshfeldCharges.length === 0;
      if (getChargeArrayForScheme(activeChargeScheme).length === 0) {
        if (data.mullikenCharges.length > 0) activeChargeScheme = 'mulliken';
        else if (data.loewdinCharges.length > 0) activeChargeScheme = 'loewdin';
        else if (data.hirshfeldCharges.length > 0) activeChargeScheme = 'hirshfeld';
      }
      schemeSel.value = activeChargeScheme;
    }

    const list = getChargeArrayForScheme(activeChargeScheme);
    if (list.length > 0) {
      chgSec.classList.remove('hidden');
      $('charges-table-body').innerHTML = list
        .map(
          (c) =>
            `<tr class="clickable charge-row" data-atom="${c.atomIndex}">
              <td>${c.atomIndex}</td>
              <td>${escapeHtml(c.element)}</td>
              <td style="color:${c.charge >= 0 ? '#60a5fa' : '#f87171'}">${c.charge >= 0 ? '+' : ''}${c.charge.toFixed(5)}</td>
            </tr>`
        )
        .join('');
      $('charges-table-body').querySelectorAll('.charge-row').forEach((row) => {
        row.addEventListener('click', () => {
          const idx = Number(row.dataset.atom);
          const a = data.frames?.[currentFrameIdx]?.atoms?.[idx];
          if (a && viewer) {
            viewer.addSphere({
              center: { x: a.x, y: a.y, z: a.z },
              radius: 0.52,
              color: '#facc15',
              opacity: 0.45
            });
            viewer.render();
            setTimeout(() => renderFrame(currentFrameIdx, true), 900);
          }
        });
      });
    } else {
      chgSec.classList.add('hidden');
    }
  }

  // ---- Load Data Entry Point ----
  function loadPayload(payload) {
    stopPlayback();
    stopVibration();
    data = payload.data;
    if (payload.config) {
      config = { ...config, ...payload.config };
      representation = config.defaultRepresentation || 'ballstick';
      showGhosts = config.showGhostAtoms !== false;
      irFwhm = config.irBroadeningFwhm || 20;
      uvSigma = config.uvBroadeningEv || 0.3;
    }

    // Update topbar
    $('file-title').textContent = data.fileName;
    const statusBadge = $('status-badge');
    const st = data.status;
    statusBadge.textContent =
      st === 'converged'
        ? 'CONVERGED ✓'
        : st === 'normal'
          ? 'TERMINATED NORMALLY'
          : st === 'error'
            ? 'ERROR'
            : st === 'running'
              ? 'RUNNING / INCOMPLETE'
              : data.fileType.toUpperCase();
    statusBadge.className = `badge ${
      st === 'converged' || st === 'normal'
        ? 'badge-ok'
        : st === 'error'
          ? 'badge-err'
          : st === 'running'
            ? 'badge-warn'
            : 'badge-info'
    }`;

    const verBadge = $('version-badge');
    if (data.orcaVersion) {
      verBadge.textContent = `ORCA ${data.orcaVersion}`;
      verBadge.classList.remove('hidden');
    } else {
      verBadge.classList.add('hidden');
    }

    // Sync controls
    $('rep-select').value = representation;
    $('chk-ghosts').checked = showGhosts;
    $('wrap-ghosts').classList.toggle('hidden', data.nGhostAtoms === 0);
    $('wrap-dipole').classList.toggle('hidden', !data.dipole);
    $('wrap-grad').classList.toggle('hidden', data.fileType !== 'engrad');
    $('color-select').querySelector('option[value="mulliken"]').disabled = data.mullikenCharges.length === 0;
    $('color-select').querySelector('option[value="loewdin"]').disabled = data.loewdinCharges.length === 0;
    $('color-select').querySelector('option[value="hirshfeld"]').disabled = data.hirshfeldCharges.length === 0;
    $('ir-fwhm').value = String(irFwhm);
    $('ir-fwhm-val').textContent = `${irFwhm} cm⁻¹`;

    setupTabs();
    renderSummaryTab();
    renderFrequencyTable();
    renderUvTab();
    renderOrbitalsAndCharges();

    // Start on final frame for opt outputs, frame 0 for scan/xyz
    const initialFrame =
      data.fileType === 'orca-output' && data.frames.length > 0 ? data.frames.length - 1 : 0;
    selectedAtoms = [];
    renderFrame(initialFrame, false);

    // Refresh chart if currently visible
    const activeTab = document.querySelector('.tab-btn.active')?.dataset?.tab;
    if (activeTab === 'conv') renderConvergenceCharts();
    if (activeTab === 'freq') renderIrChart();
    if (activeTab === 'uv') renderUvChart();
  }

  // ---- Wire DOM Event Listeners ----
  function bindEvents() {
    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    $('rep-select').addEventListener('change', (e) => {
      representation = e.target.value;
      renderFrame(currentFrameIdx, true);
    });

    $('label-select').addEventListener('change', (e) => {
      labelMode = e.target.value;
      renderFrame(currentFrameIdx, true);
    });

    $('color-select').addEventListener('change', (e) => {
      colorMode = e.target.value;
      renderFrame(currentFrameIdx, true);
    });

    $('chk-ghosts').addEventListener('change', (e) => {
      showGhosts = e.target.checked;
      renderFrame(currentFrameIdx, true);
    });

    $('chk-dipole').addEventListener('change', (e) => {
      showDipole = e.target.checked;
      renderFrame(currentFrameIdx, true);
    });

    $('chk-grad').addEventListener('change', (e) => {
      showGradients = e.target.checked;
      renderFrame(currentFrameIdx, true);
    });

    $('btn-measure').addEventListener('click', () => {
      measureMode = !measureMode;
      $('btn-measure').classList.toggle('active', measureMode);
      if (!measureMode) {
        selectedAtoms = [];
      }
      redrawMeasurements();
      if (viewer) viewer.render();
    });

    $('btn-clear-measure').addEventListener('click', () => {
      selectedAtoms = [];
      redrawMeasurements();
      if (viewer) viewer.render();
    });

    $('btn-reset-view').addEventListener('click', () => {
      if (viewer) {
        viewer.zoomTo();
        viewer.render();
      }
    });

    $('btn-bg-toggle').addEventListener('click', () => {
      darkBg = !darkBg;
      if (viewer) {
        viewer.setBackgroundColor(darkBg ? '#131720' : '#f8fafc');
        renderFrame(currentFrameIdx, true);
      }
    });

    $('btn-copy-orca').addEventListener('click', () => {
      if (!data || !data.frames[currentFrameIdx]) return;
      vscode.postMessage({
        type: 'copyOrcaBlock',
        frame: data.frames[currentFrameIdx],
        charge: data.charge ?? 0,
        multiplicity: data.multiplicity ?? 1
      });
    });

    $('btn-export-xyz').addEventListener('click', () => {
      if (!data || !data.frames[currentFrameIdx]) return;
      vscode.postMessage({
        type: 'exportXyz',
        frame: data.frames[currentFrameIdx]
      });
    });

    $('btn-screenshot').addEventListener('click', () => {
      if (!viewer) return;
      const uri = viewer.pngURI();
      vscode.postMessage({ type: 'savePng', dataUrl: uri });
    });

    // Trajectory controls
    $('btn-first').addEventListener('click', () => {
      stopPlayback();
      stopVibration();
      renderFrame(0, true);
    });
    $('btn-prev').addEventListener('click', () => {
      stopPlayback();
      stopVibration();
      renderFrame(Math.max(0, currentFrameIdx - 1), true);
    });
    $('btn-next').addEventListener('click', () => {
      stopPlayback();
      stopVibration();
      renderFrame(Math.min((data?.frames?.length ?? 1) - 1, currentFrameIdx + 1), true);
    });
    $('btn-last').addEventListener('click', () => {
      stopPlayback();
      stopVibration();
      renderFrame((data?.frames?.length ?? 1) - 1, true);
    });
    $('btn-play').addEventListener('click', () => {
      if (isPlaying) stopPlayback();
      else startPlayback();
    });
    $('traj-slider').addEventListener('input', (e) => {
      stopPlayback();
      stopVibration();
      renderFrame(Number(e.target.value), true);
    });
    $('traj-speed').addEventListener('change', () => {
      if (isPlaying) {
        stopPlayback();
        startPlayback();
      }
    });
    $('btn-jump-frame').addEventListener('click', () => {
      const f = data?.frames?.[currentFrameIdx];
      if (f && f.line !== undefined) {
        vscode.postMessage({ type: 'jumpToLine', line: f.line });
      }
    });

    // Vibration controls
    $('btn-stop-vib').addEventListener('click', stopVibration);
    $('vib-amp').addEventListener('input', (e) => {
      vibAmplitude = parseFloat(e.target.value);
    });
    $('vib-speed').addEventListener('input', (e) => {
      vibSpeed = parseFloat(e.target.value);
    });
    $('chk-vib-vectors').addEventListener('change', (e) => {
      showVibVectors = e.target.checked;
      if (!activeVibMode) renderFrame(currentFrameIdx, true);
    });
    $('chk-hide-tr').addEventListener('change', (e) => {
      hideTransRot = e.target.checked;
      renderFrequencyTable();
    });

    // Chart controls
    $('energy-unit').addEventListener('change', (e) => {
      energyUnit = e.target.value;
      renderConvergenceCharts();
    });
    $('ir-fwhm').addEventListener('input', (e) => {
      irFwhm = Number(e.target.value);
      $('ir-fwhm-val').textContent = `${irFwhm} cm⁻¹`;
      renderIrChart();
    });
    $('uv-sigma').addEventListener('input', (e) => {
      uvSigma = parseFloat(e.target.value);
      $('uv-sigma-val').textContent = `${uvSigma.toFixed(2)} eV`;
      renderUvChart();
    });
    $('charge-scheme').addEventListener('change', (e) => {
      activeChargeScheme = e.target.value;
      renderOrbitalsAndCharges();
      if (colorMode !== 'element') {
        colorMode = activeChargeScheme;
        $('color-select').value = colorMode;
        renderFrame(currentFrameIdx, true);
      }
    });
  }

  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (msg.type === 'loadData') {
      loadPayload(msg);
    }
  });

  bindEvents();
  vscode.postMessage({ type: 'ready' });
})();
