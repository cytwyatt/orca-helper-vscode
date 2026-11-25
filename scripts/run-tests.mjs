import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as esbuild from 'esbuild';

const root = path.resolve(import.meta.dirname, '..');
const fixturesDir = path.join(root, 'test-fixtures');
const outFile = path.join(root, 'dist', 'parsers-test-bundle.cjs');
const relatedOutFile = path.join(root, 'dist', 'related-test-bundle.cjs');

// Bundle parsers and pure utilities for direct Node test execution
await esbuild.build({
  entryPoints: [path.join(root, 'src', 'parsers', 'index.ts')],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  outfile: outFile
});
await esbuild.build({
  entryPoints: [path.join(root, 'src', 'utils', 'relatedFiles.ts')],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  outfile: relatedOutFile
});

const parsers = await import(outFile);
const related = await import(relatedOutFile);

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (err) {
    console.error(`  FAIL  ${name}`);
    console.error(`        ${err.message}`);
    failed++;
  }
}

console.log('\n=== Testing ORCA 6 Helper Parsers ===\n');

test('Parse h2.inp (simple input + inline * xyz)', () => {
  const fp = path.join(fixturesDir, 'h2.inp');
  const res = parsers.parseOrcaInput(fs.readFileSync(fp, 'utf8'), fp);
  assert.equal(res.diagnostics.length, 0, `Unexpected diagnostics: ${JSON.stringify(res.diagnostics)}`);
  assert.equal(res.data.formula, 'H2');
  assert.equal(res.data.nAtoms, 2);
  assert.equal(res.data.charge, 0);
  assert.equal(res.data.multiplicity, 1);
  assert.equal(res.data.frames.length, 1);
});

test('Parse water_ghost.inp (ghost atoms ":" + %scf + %pal inline)', () => {
  const fp = path.join(fixturesDir, 'water_ghost.inp');
  const res = parsers.parseOrcaInput(fs.readFileSync(fp, 'utf8'), fp);
  assert.equal(
    res.diagnostics.filter((d) => d.severity === 'error').length,
    0,
    `Unexpected errors: ${JSON.stringify(res.diagnostics)}`
  );
  assert.equal(res.data.nAtoms, 6);
  assert.equal(res.data.nGhostAtoms, 3);
  assert.equal(res.data.formula, 'H2O (+3 ghost)');
});

test('Parse hi_mp2_ecp.inp (MP2 + %basis NewGTO/NewECP)', () => {
  const fp = path.join(fixturesDir, 'hi_mp2_ecp.inp');
  const res = parsers.parseOrcaInput(fs.readFileSync(fp, 'utf8'), fp);
  assert.equal(
    res.diagnostics.filter((d) => d.severity === 'error').length,
    0,
    `Unexpected errors: ${JSON.stringify(res.diagnostics)}`
  );
  assert.equal(res.data.nAtoms, 2);
  assert.ok(res.data.simpleInputKeywords.includes('MP2'));
  assert.ok(res.data.simpleInputKeywords.includes('NumFreq'));
});

test('Parse water_opt_freq.out (ORCA 6.1.1 DFT Opt + Freq + Normal Modes + IR + Thermo)', () => {
  const fp = path.join(fixturesDir, 'water_opt_freq.out');
  const data = parsers.parseOrcaOutput(fs.readFileSync(fp, 'utf8'), fp);
  assert.equal(data.orcaVersion, '6.1.1');
  assert.equal(data.status, 'converged');
  assert.equal(data.optConverged, true);
  assert.equal(data.formula, 'H2O');
  assert.equal(data.nAtoms, 3);
  assert.equal(data.optCycles.length, 3);
  assert.ok(data.frames.length >= 4, `Frames: ${data.frames.length}`);
  assert.ok(Math.abs(data.finalEnergyEh - -76.438912345678) < 1e-6, `Final E: ${data.finalEnergyEh}`);
  assert.ok(data.scfSteps.length >= 3, 'Expected SCF steps');
  assert.equal(data.orbitals.length, 7);
  assert.ok(data.homoEv !== undefined && data.lumoEv !== undefined && data.homoLumoGapEv > 9.0);
  assert.equal(data.mullikenCharges.length, 3);
  assert.equal(data.loewdinCharges.length, 3);
  assert.equal(data.hirshfeldCharges.length, 3);
  assert.ok(data.dipole && Math.abs(data.dipole.magnitudeDebye - 1.868) < 0.01);
  assert.equal(data.frequencies.length, 9);
  assert.equal(data.imaginaryCount, 0);
  const mode6 = data.frequencies.find((m) => m.mode === 6);
  assert.ok(mode6 && Math.abs(mode6.frequency - 1625.4) < 0.1);
  assert.ok(mode6.irIntensity !== undefined && Math.abs(mode6.irIntensity - 73.42) < 0.1);
  assert.ok(
    mode6.displacements && mode6.displacements.length === 3,
    'Expected 3 atomic displacements on mode 6'
  );
  assert.ok(data.thermo && Math.abs(data.thermo.finalGibbsEh - -76.435226) < 1e-5);
  assert.ok(data.thermo && Math.abs(data.thermo.zpeEh - 0.021345) < 1e-5);
  assert.ok(data.outline.length >= 5, `Expected rich outline, got ${data.outline.length}`);
  assert.ok(data.runtime && data.runtime.includes('4 seconds'));
});

test('Parse hi_ghost_ecp.out (ORCA 6.1.1 SP with ghost atoms & ECP detection via A.U. table)', () => {
  const fp = path.join(fixturesDir, 'hi_ghost_ecp.out');
  const data = parsers.parseOrcaOutput(fs.readFileSync(fp, 'utf8'), fp);
  assert.equal(data.orcaVersion, '6.1.1');
  assert.equal(data.status, 'normal');
  assert.equal(data.nAtoms, 5);
  assert.equal(data.nGhostAtoms, 3);
  assert.equal(data.frames[0].atoms[0].element, 'I');
  assert.equal(data.frames[0].atoms[0].hasEcp, true);
  assert.equal(data.frames[0].atoms[2].isGhost, true);
  assert.equal(data.frames[0].atoms[4].isGhost, true);
  assert.ok(Math.abs(data.finalEnergyEh - -298.4123456789) < 1e-6);
});

test('Parse hi_mp2_opt.out (ORCA 6.1.1 MP2 Opt + NumFreq)', () => {
  const fp = path.join(fixturesDir, 'hi_mp2_opt.out');
  const data = parsers.parseOrcaOutput(fs.readFileSync(fp, 'utf8'), fp);
  assert.equal(data.orcaVersion, '6.1.1');
  assert.equal(data.status, 'converged');
  assert.equal(data.nAtoms, 2);
  assert.ok(data.mp2EnergyEh !== undefined && Math.abs(data.mp2EnergyEh - -295.432890123) < 1e-6);
  assert.equal(data.optCycles.length, 2);
  assert.equal(data.frequencies.length, 6);
});

test('Parse water_opt_trj.xyz (ORCA 6 multi-frame trajectory + energy extraction)', () => {
  const fp = path.join(fixturesDir, 'water_opt_trj.xyz');
  const data = parsers.parseXyzContent(fs.readFileSync(fp, 'utf8'), fp);
  assert.equal(data.frames.length, 3);
  assert.equal(data.nAtoms, 3);
  assert.ok(data.frames[0].energy !== undefined && Math.abs(data.frames[0].energy - -76.43812) < 1e-5);
  assert.equal(data.optCycles.length, data.frames.length);
});

test('Parse scan_h2o.xyz (multi-frame radial scan XYZ)', () => {
  const fp = path.join(fixturesDir, 'scan_h2o.xyz');
  const data = parsers.parseXyzContent(fs.readFileSync(fp, 'utf8'), fp);
  assert.equal(data.frames.length, 4);
  assert.equal(data.nAtoms, 3);
  assert.ok(data.frames[0].comment.includes('O-H stretch scan 0.85 A'));
});

test('Parse water_opt.hess (Hessian geometry + frequencies + normal modes + IR)', () => {
  const fp = path.join(fixturesDir, 'water_opt.hess');
  const data = parsers.parseHessContent(fs.readFileSync(fp, 'utf8'), fp);
  assert.equal(data.nAtoms, 3);
  assert.equal(data.frequencies.length, 9);
  const mode6 = data.frequencies.find((m) => m.mode === 6);
  assert.ok(mode6 && Math.abs(mode6.frequency - 1625.4) < 0.2);
  assert.ok(mode6.displacements && mode6.displacements.length === 3);
  assert.ok(mode6.irIntensity !== undefined && Math.abs(mode6.irIntensity - 73.42) < 0.1);
  // Verify Bohr->Angstrom conversion (~O-H bond ~0.958 A, not ~1.81 Bohr)
  const o0 = data.frames[0].atoms[0];
  const h1 = data.frames[0].atoms[1];
  const d = Math.hypot(o0.x - h1.x, o0.y - h1.y, o0.z - h1.z);
  assert.ok(d > 0.9 && d < 1.05, `Expected O-H bond ~0.96 A, got ${d}`);
});

test('Parse water_opt.engrad (Bohr->Angstrom + gradient vectors)', () => {
  const fp = path.join(fixturesDir, 'water_opt.engrad');
  const data = parsers.parseEngradContent(fs.readFileSync(fp, 'utf8'), fp);
  assert.equal(data.nAtoms, 3);
  assert.ok(Math.abs(data.finalEnergyEh - -76.438912345678) < 1e-6);
  assert.ok(data.frames[0].atoms[0].gz !== undefined && Math.abs(data.frames[0].atoms[0].gz - -0.0000042) < 1e-9);
  const o0 = data.frames[0].atoms[0];
  const h1 = data.frames[0].atoms[1];
  const d = Math.hypot(o0.x - h1.x, o0.y - h1.y, o0.z - h1.z);
  assert.ok(d > 0.9 && d < 1.05, `Expected O-H bond ~0.96 A, got ${d}`);
});

test('Diagnostics catch spin parity mismatch, unclosed %block, deprecated Grid5, and short contacts', () => {
  const badInp = `
! B3LYP Grid5 def2-SVP Opt
%scf
  MaxIter 200
* xyz 0 2
H 0.0 0.0 0.0
H 0.0 0.0 0.1
*
`;
  const res = parsers.parseOrcaInput(badInp, '/tmp/bad.inp');
  const codes = new Set(res.diagnostics.map((d) => d.code));
  assert.ok(codes.has('deprecated-orca6-keyword'), 'Should warn on Grid5');
  assert.ok(codes.has('unclosed-block'), 'Should error on unclosed %scf');
  assert.ok(codes.has('spin-parity-mismatch'), 'Should error on H2 charge 0 mult 2');
  assert.ok(codes.has('short-contact'), 'Should warn on 0.1 A H-H distance');
});

test('Parse synthetic ORCA 6 TD-DFT absorption spectrum + imaginary frequency', () => {
  const mockOut = `
                         Program Version 6.1.1  -  RELEASE   -
---------------------------------
CARTESIAN COORDINATES (ANGSTROEM)
---------------------------------
  O   0.000000   0.000000   0.000000
  H   0.757000   0.586000   0.000000
  H  -0.757000   0.586000   0.000000

-----------------------
VIBRATIONAL FREQUENCIES
-----------------------
     0:       0.00 cm**-1
     6:    -142.55 cm**-1 ***imaginary mode***
     7:    1625.10 cm**-1

------------------------------------------------------------------------------------------
         ABSORPTION SPECTRUM VIA TRANSITION ELECTRIC DIPOLE MOMENTS
------------------------------------------------------------------------------------------
     Transition      Energy     Energy  Wavelength fosc(D2)      D2        DX        DY        DZ
                      (eV)      (cm-1)    (nm)                 (au**2)    (au)      (au)      (au)
------------------------------------------------------------------------------------------
  0-1A  ->  1-1A    7.2145    58188.9    171.9   0.0523100   0.29580   0.00000   0.54387   0.00000
  0-1A  ->  2-1A    9.1230    73581.9    135.9   0.1452000   0.64910   0.80567   0.00000   0.00000

                             ****ORCA TERMINATED NORMALLY****
`;
  const data = parsers.parseOrcaOutput(mockOut, '/tmp/tddft.out');
  assert.equal(data.imaginaryCount, 1);
  assert.equal(data.excitedStates.length, 2);
  assert.equal(data.excitedStates[0].transition, '0-1A -> 1-1A');
  assert.ok(Math.abs(data.excitedStates[0].wavelengthNm - 171.9) < 0.01);
  assert.ok(Math.abs(data.excitedStates[1].fosc - 0.1452) < 1e-4);
});

test('Auto-detect distinguishes ORCA .inp from Packmol .inp and Abaqus .inp', () => {
  const packmolInp = `
# Packmol input file
tolerance 2.0
filetype pdb
output mixture.pdb

structure water.pdb
  number 500
  inside box 0. 0. 0. 40. 40. 40.
end structure
`;
  const abaqusInp = `
*HEADING
Cantilever beam
*NODE
1, 0.0, 0.0, 0.0
`;
  const orcaInp = `
%pal nprocs 8 end
! B3LYP D3BJ def2-TZVP Opt Freq
* xyz 0 1
H 0.0 0.0 0.0
H 0.0 0.0 0.74
*
`;
  assert.equal(parsers.isOrcaInputContent(packmolInp), false);
  assert.equal(parsers.isOrcaInputContent(abaqusInp), false);
  assert.equal(parsers.isOrcaInputContent(orcaInp), true);
  assert.equal(parsers.parseAnyOrcaFile(packmolInp, '/tmp/packmol.inp'), undefined);
  assert.ok(parsers.parseAnyOrcaFile(orcaInp, '/tmp/orca.inp') !== undefined);
});

test('Parse .allxyz (with ">" frame separators) and .trj trajectories', () => {
  const allxyz = `2
-1.172000
H 0.0 0.0 0.0
H 0.0 0.0 .74
>
2
-1.168500
H 0.0 0.0 0.0
H 0.0 0.0 .84
`;
  const parsedAll = parsers.parseAnyOrcaFile(allxyz, '/tmp/scan.allxyz');
  assert.ok(parsedAll, 'Expected .allxyz to parse');
  assert.equal(parsedAll.frames.length, 2);
  assert.ok(Math.abs(parsedAll.frames[0].energy - -1.172) < 1e-6);
  assert.ok(Math.abs(parsedAll.frames[1].atoms[1].z - 0.84) < 1e-6);

  const parsedTrj = parsers.parseAnyOrcaFile(allxyz, '/tmp/md.trj');
  assert.ok(parsedTrj, 'Expected .trj to parse');
  assert.equal(parsedTrj.frames.length, 2);
});

test('Discover sibling trajectory/hessian files and enrich .out frequencies from sibling .hess', () => {
  const trjPath = path.join(fixturesDir, 'water_opt_trj.xyz');
  const siblings = related.findRelatedOrcaFiles(trjPath);
  const names = siblings.map((s) => s.fileName);
  assert.ok(names.includes('water_opt.hess'), `Expected water_opt.hess in ${names}`);
  assert.ok(names.includes('water_opt.engrad'), `Expected water_opt.engrad in ${names}`);

  // Build an .out missing NORMAL MODES sitting next to water_opt.hess
  const fakeOutPath = path.join(fixturesDir, 'water_opt.out');
  const minimalOut = `
                         Program Version 6.1.1  -  RELEASE   -
---------------------------------
CARTESIAN COORDINATES (ANGSTROEM)
---------------------------------
  O   0.000000   0.000000   0.117300
  H   0.000000   0.757000  -0.469200
  H   0.000000  -0.757000  -0.469200
-----------------------
VIBRATIONAL FREQUENCIES
-----------------------
     0:       0.00 cm**-1
     6:    1625.40 cm**-1

                             ****ORCA TERMINATED NORMALLY****
`;
  const parsedOut = parsers.parseOrcaOutput(minimalOut, fakeOutPath);
  assert.equal(parsedOut.frequencies.find((m) => m.mode === 6).displacements, undefined);
  const enriched = related.enrichParsedWithSiblingHess(parsedOut);
  const enrichedMode6 = enriched.frequencies.find((m) => m.mode === 6);
  assert.ok(
    enrichedMode6.displacements && enrichedMode6.displacements.length === 3,
    'Expected displacements merged from sibling water_opt.hess'
  );
  assert.ok(Math.abs(enrichedMode6.irIntensity - 73.42) < 0.1);
});

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
if (failed > 0) {
  process.exit(1);
}
