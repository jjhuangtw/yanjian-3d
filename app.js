import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { PROJECT, EXTERIOR, UNITS, IDLE_MS, FURNISH, PACKED_MODELS } from './config.js';

const $ = (id) => document.getElementById(id);
const V3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const qs = new URLSearchParams(location.search);

// ---------------------------------------------------------------- renderer
const stage = $('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.appendChild(renderer.domElement);

const labelRenderer = new CSS2DRenderer({ element: $('labels') });
labelRenderer.setSize(innerWidth, innerHeight);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environment = envTex;

const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.05, 6000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.screenSpacePanning = true;

const sun = new THREE.DirectionalLight(0xfff1dc, 2.2);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight(0xdfe8f5, 0x3a3128, 0.35);
scene.add(hemi);

const cutPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 2.45);

// ---------------------------------------------------------------- loading
const draco = new DRACOLoader().setDecoderPath('vendor/three/addons/libs/draco/gltf/');
const loader = new GLTFLoader().setDRACOLoader(draco);
const cache = new Map();

function prepMaterial(m) {
  if (m.userData.prepped) return;
  m.userData.prepped = true;
  // Real transmission is costly on a kiosk; fake glass / sheers with alpha.
  if (m.transmission > 0) {
    const sheer = /sheer|frost/i.test(m.name);
    m.transmission = 0;
    m.transparent = true;
    m.opacity = sheer ? 0.62 : 0.2;
    m.depthWrite = false;
    if (!sheer) { m.roughness = Math.min(m.roughness, 0.08); m.metalness = 0.1; }
  }
  if (m.emissive && m.emissive.getHex() !== 0) m.userData.baseEmissive = m.emissiveIntensity;
  m.shadowSide = THREE.FrontSide;
}

// Hosts that cannot serve .glb get each model as <name>.glb.json = {data: base64 GLB}; decode it here.
async function loadPacked(url, onProgress) {
  const res = await fetch(url + '.json');
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const total = +res.headers.get('content-length') || 0;
  const reader = res.body.getReader();
  const chunks = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value); got += value.length;
    if (total) onProgress?.(Math.min(0.95, got / total));
  }
  const text = new TextDecoder().decode(await new Blob(chunks).arrayBuffer());
  const bin = Uint8Array.from(atob(JSON.parse(text).data), (c) => c.charCodeAt(0));
  return loader.parseAsync(bin.buffer, '');
}

function loadGLTF(url, onProgress) {
  if (PACKED_MODELS) return loadPacked(url, onProgress);
  return new Promise((res, rej) => loader.load(url, res, (e) => e.total && onProgress?.(e.loaded / e.total), rej));
}

function loadSite(site, onProgress) {
  if (cache.has(site.id)) return cache.get(site.id);
  const p = Promise.all([
    fetch(site.meta).then((r) => r.json()),
    loadGLTF(site.file, onProgress),
  ]).then(([meta, gltf]) => {
    const root = gltf.scene;
    root.name = site.id;
    const groups = {};
    const mats = new Set();
    root.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { prepMaterial(m); mats.add(m); });
      }
    });
    for (const child of root.children) groups[child.name.replace(/\.\d+$/, '')] = child;
    for (const g of site.hideGroups || []) if (groups[g]) groups[g].visible = false;
    if (groups.Curtains) groups.Curtains.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    const views = Object.fromEntries(meta.views.map((v) => [v.name, v]));
    const box = new THREE.Box3();
    for (const g of meta.groups) {
      if ((site.hideGroups || []).includes(g.name)) continue;
      if (site.id === 'exterior' && g.name !== '01_Tower_LOD0') continue;
      box.expandByPoint(V3(g.min)).expandByPoint(V3(g.max));
    }
    const s = { site, root, groups, views, meta, mats: [...mats], box, spots: [] };
    if (site.rooms) buildSpots(s);
    root.visible = false;
    scene.add(root);
    return s;
  });
  cache.set(site.id, p);
  return p;
}

function buildSpots(s) {
  for (const r of s.site.rooms) {
    const g = s.meta.groups.find((x) => x.name === r.group);
    if (!g) continue;
    const el = document.createElement('button');
    el.className = 'spot';
    el.textContent = r.label;
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
    el.addEventListener('click', (e) => { e.stopPropagation(); goView(r.view); });
    const obj = new CSS2DObject(el);
    obj.position.set((g.min[0] + g.max[0]) / 2, 1.1, (g.min[2] + g.max[2]) / 2);
    s.root.add(obj);
    s.spots.push(obj);
  }
}

// ---------------------------------------------------------------- state
let cur = null;           // loaded site state
let mode = 'overview';    // overview | plan | room
let night = false;
let showCurtains = true;
let showContext = true;
let activeView = null;

// ---------------------------------------------------------------- camera tween
let tween = null;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
function flyTo(pos, target, fov, dur = 1600) {
  const from = { p: camera.position.clone(), t: controls.target.clone(), f: camera.fov };
  tween = { from, to: { p: pos.clone(), t: target.clone(), f: fov ?? camera.fov }, t0: performance.now(), dur };
  controls.enabled = false;
  return new Promise((res) => (tween.done = res));
}
function stepTween(now) {
  if (!tween) return;
  const k = Math.min(1, (now - tween.t0) / tween.dur);
  const e = ease(k);
  camera.position.lerpVectors(tween.from.p, tween.to.p, e);
  controls.target.lerpVectors(tween.from.t, tween.to.t, e);
  camera.fov = THREE.MathUtils.lerp(tween.from.f, tween.to.f, e);
  camera.updateProjectionMatrix();
  camera.lookAt(controls.target);
  if (k >= 1) { const d = tween.done; tween = null; controls.enabled = true; d?.(); }
}

// ---------------------------------------------------------------- modes
function applyLook() {
  const ext = cur?.site.id === 'exterior';
  const interiorRoom = !ext && mode === 'room';
  scene.background = new THREE.Color(night ? (ext ? 0x0b1220 : 0x0d0e12) : (ext ? 0xc9d3dc : interiorRoom ? 0xdde4ea : 0x1a1917));
  scene.fog = ext ? new THREE.Fog(night ? 0x0b1220 : 0xc9d3dc, 260, 900) : null;
  scene.environmentIntensity = night ? (ext ? 0.06 : 0.28) : (interiorRoom ? 1.0 : 0.85);
  sun.intensity = night ? (ext ? 0.15 : 0.0) : (ext ? 2.6 : 2.0);
  sun.color.set(night ? 0x8fa6d8 : 0xfff1dc);
  hemi.intensity = night ? 0.06 : (ext ? 0.5 : 0.3);
  renderer.toneMappingExposure = night ? 1.15 : 1.0;
  if (cur) for (const m of cur.mats) {
    if (m.userData.baseEmissive !== undefined) m.emissiveIntensity = m.userData.baseEmissive * (night ? (ext ? 18 : 3.5) : 1);
  }
  // Dollhouse cut only in overview / plan of interiors
  renderer.clippingPlanes = !ext && mode !== 'room' ? [cutPlane] : [];
  cutPlane.constant = mode === 'plan' ? 2.2 : 2.45;
  if (cur?.groups.Ceilings) cur.groups.Ceilings.visible = ext || mode === 'room';
  if (cur?.groups.Curtains) cur.groups.Curtains.visible = showCurtains;
  for (const g of EXTERIOR.contextGroups) if (ext && cur.groups[g]) cur.groups[g].visible = showContext;
  document.body.classList.toggle('labels-off', ext || mode !== 'overview');
  $('info').classList.toggle('hide', interiorRoom);
}

function placeSun() {
  const b = cur.box, c = b.getCenter(new THREE.Vector3()), size = b.getSize(new THREE.Vector3());
  const r = Math.max(size.x, size.y, size.z);
  const ext = cur.site.id === 'exterior';
  sun.position.copy(c).add(new THREE.Vector3(0.55, 0.9, 0.35).normalize().multiplyScalar(ext ? 200 : 30));
  sun.target.position.copy(c);
  const sc = sun.shadow.camera;
  const half = ext ? 90 : r * 0.75;
  sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half;
  sc.near = 1; sc.far = ext ? 450 : 80;
  sc.updateProjectionMatrix();
}

function overviewPose() {
  const s = cur;
  if (s.site.id === 'exterior') return { pos: V3(EXTERIOR.home.pos), target: V3(EXTERIOR.home.target), fov: 40 };
  const c = s.box.getCenter(new THREE.Vector3());
  const size = s.box.getSize(new THREE.Vector3());
  const axon = Object.values(s.views).find((v) => /axon/i.test(v.name));
  const dir = axon ? V3(axon.pos).sub(c).setY(0).normalize() : new THREE.Vector3(1, 0, 1).normalize();
  const r = Math.max(size.x, size.z);
  const target = c.clone().setY(0.6);
  const pos = target.clone().add(dir.multiplyScalar(r * 1.12)).setY(r * 1.2);
  return { pos, target, fov: 40 };
}

function setOrbitLimits(kind) {
  controls.enableZoom = true;
  controls.enablePan = kind !== 'room';
  controls.rotateSpeed = 0.6;
  controls.minPolarAngle = 0;
  if (kind === 'room') {
    controls.minDistance = controls.maxDistance = 0.35;
    controls.enableZoom = false;
    controls.rotateSpeed = -0.35;
    controls.maxPolarAngle = Math.PI * 0.85; controls.minPolarAngle = Math.PI * 0.18;
  } else if (cur.site.id === 'exterior') {
    controls.minDistance = 25; controls.maxDistance = 520; controls.maxPolarAngle = Math.PI * 0.495;
  } else {
    const r = cur.box.getSize(new THREE.Vector3()).length();
    controls.minDistance = 4; controls.maxDistance = r * 1.6;
    controls.maxPolarAngle = kind === 'plan' ? 0.05 : Math.PI * 0.42;
  }
}

async function goOverview(animate = true) {
  mode = 'overview'; activeView = null;
  applyLook();
  setOrbitLimits('overview');
  const p = overviewPose();
  if (animate) await flyTo(p.pos, p.target, p.fov);
  else { camera.position.copy(p.pos); controls.target.copy(p.target); camera.fov = p.fov; camera.updateProjectionMatrix(); }
  renderDock();
  hint(cur.site.id === 'exterior' ? '單指旋轉 · 雙指縮放平移' : '點選房間標籤進入室內 · 單指旋轉');
}

async function goPlan() {
  mode = 'plan'; activeView = '__plan';
  applyLook();
  setOrbitLimits('plan');
  const c = cur.box.getCenter(new THREE.Vector3());
  const size = cur.box.getSize(new THREE.Vector3());
  const fov = 30;
  const fit = Math.max(size.z, size.x / camera.aspect) * 0.9 / Math.tan(THREE.MathUtils.degToRad(fov / 2));
  renderDock();
  await flyTo(c.clone().setY(fit), c.clone().setY(0).add(new THREE.Vector3(0, 0, -0.001)), fov);
  hint('平面俯視 · 雙指縮放');
}

async function goView(name) {
  const v = cur.views[name];
  if (!v) return;
  const ext = cur.site.id === 'exterior';
  activeView = name;
  const pos = V3(v.pos), look = V3(v.target);
  if (ext) {
    mode = 'overview';
    applyLook(); setOrbitLimits('overview');
    renderDock();
    await flyTo(pos, V3(EXTERIOR.orbitTarget).lerp(look, name.includes('Entrance') || name.includes('Street') ? 0.85 : 0.35), v.fov);
    controls.target.copy(V3(EXTERIOR.orbitTarget).lerp(look, name.includes('Entrance') || name.includes('Street') ? 0.85 : 0.35));
    return;
  }
  const wasRoom = mode === 'room';
  if (!wasRoom) {
    // swoop: rise above the room, then descend into it
    const above = pos.clone().setY(cur.box.max.y + 4);
    await flyTo(above, pos.clone().setY(0), 45, 900);
  }
  mode = 'room';
  applyLook();
  setOrbitLimits('room');
  renderDock();
  const dir = look.clone().sub(pos).normalize();
  await flyTo(pos.clone(), pos.clone().add(dir.multiplyScalar(0.35)), Math.max(50, Math.min(v.fov, 72)), wasRoom ? 1400 : 1100);
  hint('拖曳環視 · 下方切換空間');
}

// ---------------------------------------------------------------- sites
async function openSite(site, { animate = true } = {}) {
  setMenu(site.id);
  const firstLoad = !cache.has(site.id);
  const ld = $('loader');
  if (firstLoad) { ld.classList.remove('done'); if (cur) ld.classList.add('soft'); $('loaderTxt').textContent = `載入 ${site.title}`; }
  const s = await loadSite(site, (k) => { $('loaderBar').style.width = `${Math.round(k * 100)}%`; });
  if (cur && cur !== s) { if (furnishOn) setFurnish(false); cur.root.visible = false; }
  cur = s;
  s.root.visible = true;
  showCurtains = true;
  placeSun();
  renderInfo();
  ld.classList.add('done');
  await goOverview(animate && !firstLoad);
}

// ---------------------------------------------------------------- UI
function setMenu(id) {
  for (const b of $('menu').querySelectorAll('.menu-btn[data-id]')) b.classList.toggle('on', b.dataset.id === id);
}

function buildMenu() {
  const m = $('menu');
  const add = (site, extra = '') => {
    const b = document.createElement('button');
    b.className = `menu-btn ${extra}`;
    b.dataset.id = site.id;
    b.innerHTML = `<span class="t">${site.title}</span><span class="s">${site.sub}</span>`;
    b.onclick = () => openSite(site);
    m.appendChild(b);
  };
  add(EXTERIOR);
  const sep = document.createElement('div'); sep.className = 'menu-sep'; m.appendChild(sep);
  UNITS.forEach((u) => add(u));
  const sep2 = document.createElement('div'); sep2.className = 'menu-sep'; m.appendChild(sep2);
  for (const [t, fn] of [['精裝圖庫', () => openGallery()], ['建案資訊', () => openFacts()]]) {
    const b = document.createElement('button');
    b.className = 'menu-btn small';
    b.innerHTML = `<span class="t">${t}</span>`;
    b.onclick = fn;
    m.appendChild(b);
  }
}

function renderInfo() {
  const site = cur.site;
  const ext = site.id === 'exterior';
  $('infoKicker').textContent = ext ? 'ARCHITECTURE' : 'FLOOR PLAN';
  $('infoTitle').textContent = site.title;
  $('infoLayout').textContent = ext ? '地上 17 層 · 地下 4 層 · 45 戶' : site.layout;
  const list = ext
    ? ['雙列折面陽台與獨立折線金屬框', '深色石材分縫與分層玻璃立面', '入口雨庇、前庭鋪面與基地喬木', '周邊建物依 OSM 街廓量體示意']
    : site.highlights;
  $('infoList').innerHTML = list.map((t) => `<li>${t}</li>`).join('');
  const pt = $('planThumb');
  pt.hidden = ext;
  if (!ext) $('planImg').src = site.plan;
}

function chip(label, on, fn, cls = '') {
  const b = document.createElement('button');
  b.className = `chip ${cls} ${on ? 'on' : ''}`;
  b.textContent = label;
  b.onclick = fn;
  return b;
}
function toggle(icon, label, on, fn) {
  const b = document.createElement('button');
  b.className = `tg ${on ? 'on' : ''}`;
  b.innerHTML = `<i>${icon}</i>${label}`;
  b.onclick = fn;
  return b;
}

function renderDock() {
  const chips = $('chips'), tg = $('toggles');
  chips.innerHTML = ''; tg.innerHTML = '';
  const site = cur.site;
  const ext = site.id === 'exterior';
  chips.appendChild(chip(ext ? '環繞全景' : '立體模型', mode === 'overview' && !activeView, () => goOverview(), 'lead'));
  if (!ext) chips.appendChild(chip('平面俯視', mode === 'plan', () => goPlan(), 'lead'));
  for (const v of site.views) {
    if (!cur.views[v.cam]) continue;
    chips.appendChild(chip(v.label, activeView === v.cam, () => goView(v.cam)));
  }
  tg.appendChild(toggle(night ? '☾' : '☀', night ? '夜景' : '日景', night, () => { night = !night; applyLook(); renderDock(); }));
  if (ext) tg.appendChild(toggle('▦', '周邊', showContext, () => { showContext = !showContext; applyLook(); renderDock(); }));
  else tg.appendChild(toggle('❘❘', '窗簾', showCurtains, () => { showCurtains = !showCurtains; applyLook(); renderDock(); }));
  if (FURNISH.enabled !== false && cur.meta.slots && Object.keys(cur.meta.slots).length) tg.appendChild(toggle('⇄', '家具選配', furnishOn, () => setFurnish(!furnishOn)));
  tg.appendChild(toggle('⟳', '自動', controls.autoRotate, () => { controls.autoRotate = !controls.autoRotate; renderDock(); }));
  const on = chips.querySelector('.on');
  on?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
}

let hintTimer;
function hint(t) {
  const h = $('hint');
  h.textContent = t; h.classList.add('show');
  clearTimeout(hintTimer); hintTimer = setTimeout(() => h.classList.remove('show'), 4200);
}

// ---------------------------------------------------------------- modals
function openModal(html) {
  $('modalBody').innerHTML = html;
  $('modal').hidden = false;
}
$('modalClose').onclick = () => { $('modal').hidden = true; };

function openGallery(filter) {
  const sets = [EXTERIOR, ...UNITS];
  const active = filter || (cur?.site.id ?? 'exterior');
  const site = sets.find((s) => s.id === active) || EXTERIOR;
  openModal(`
    <h2 class="m-title">精裝圖庫</h2>
    <div class="m-sub">由本案 3D 模型實際渲染之示意畫面</div>
    <div class="tabs">${sets.map((s) => `<button class="chip ${s.id === site.id ? 'on' : ''}" data-tab="${s.id}">${s.title}</button>`).join('')}</div>
    <div class="grid">${site.gallery.map((g, i) => `<button data-i="${i}"><img loading="lazy" src="gallery/${g}.jpg" alt=""></button>`).join('')}</div>`);
  const body = $('modalBody');
  body.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => openGallery(b.dataset.tab)));
  body.querySelectorAll('[data-i]').forEach((b) => (b.onclick = () => lightbox(site.gallery, +b.dataset.i)));
}

function lightbox(list, i) {
  const lb = document.createElement('div');
  lb.className = 'lightbox';
  const show = () => { lb.querySelector('img').src = `gallery/${list[i]}.jpg`; };
  lb.innerHTML = `<img alt=""><button class="nav prev">‹</button><button class="nav next">›</button><button class="modal-close">✕</button>`;
  lb.querySelector('.prev').onclick = () => { i = (i - 1 + list.length) % list.length; show(); };
  lb.querySelector('.next').onclick = () => { i = (i + 1) % list.length; show(); };
  lb.querySelector('.modal-close').onclick = () => lb.remove();
  let x0 = null;
  lb.addEventListener('pointerdown', (e) => (x0 = e.clientX));
  lb.addEventListener('pointerup', (e) => {
    if (x0 === null) return;
    const dx = e.clientX - x0; x0 = null;
    if (Math.abs(dx) > 60) { i = (i + (dx < 0 ? 1 : -1) + list.length) % list.length; show(); }
  });
  show();
  document.body.appendChild(lb);
}

function openFacts() {
  openModal(`
    <h2 class="m-title">${PROJECT.developer ? PROJECT.developer + "「" + PROJECT.name + "」" : PROJECT.name}</h2>
    <div class="m-sub">${PROJECT.tagline}</div>
    <dl class="facts">${PROJECT.facts.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
    <p class="note">${PROJECT.disclaimer}</p>`);
}

$('planThumb').onclick = () => {
  if (!cur || cur.site.id === 'exterior') return;
  openModal(`<h2 class="m-title">${cur.site.title}｜平面配置</h2><div class="m-sub">${cur.site.layout} · 模型俯視渲染，尺寸為估算示意</div><img class="plan-full" src="${cur.site.plan}" alt="">`);
};

// ---------------------------------------------------------------- furniture comparison (家具選配)
let furnishOn = false;
let furnishCat = FURNISH.categories[0].id;
let catalog = null;                 // {cat: [entry...]} current design first, then UE candidates
const choice = {};                  // cat -> chosen entry id
const placed = {};                  // cat -> THREE.Group of placed candidate copies
const furnModels = new Map();       // id -> Promise<THREE.Object3D>
let showOriginal = false;
try { Object.assign(choice, JSON.parse(localStorage.getItem('yj_furnish') || '{}')); } catch { /* storage unavailable */ }

async function loadCatalog() {
  if (catalog) return catalog;
  const ue = await fetch(FURNISH.catalog).then((r) => r.json());
  const unit = await loadSite(UNITS.find((u) => u.id === FURNISH.unit));
  const curr = (unit.meta.current_furniture || []).map((c) => ({
    ...c, file: `models/ue_furniture/${c.id}.glb`, thumb: `gallery/ue_furniture/${c.id}.jpg`, current: true,
  }));
  catalog = {};
  for (const c of FURNISH.categories) catalog[c.id] = [...curr.filter((x) => x.cat === c.id), ...ue.filter((x) => x.cat === c.id)];
  return catalog;
}

function loadFurniture(entry) {
  if (!furnModels.has(entry.id)) {
    furnModels.set(entry.id, new Promise((res, rej) => loader.load(entry.file, (g) => {
      g.scene.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = o.receiveShadow = true;
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { prepMaterial(m); cur.mats.push(m); });
        }
      });
      res(g.scene);
    }, undefined, rej)));
  }
  return furnModels.get(entry.id);
}

// One copy per slot instance. Candidates are normalised to face -Z (three.js), centred on X/Z,
// with the floor (pendants: the canopy) at y = 0.
function placeCopies(model, cat) {
  const grp = new THREE.Group();
  grp.name = 'FURNISH_' + cat;
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const bc = box.getCenter(new THREE.Vector3());
  const top = cat === 'pendant';
  for (const inst of cur.meta.slots[cat]) {
    const mn = V3(inst.min), mx = V3(inst.max);
    const f = new THREE.Vector3(inst.front[0], 0, inst.front[1]).normalize();
    const m = model.clone(true);
    m.position.set(-bc.x, top ? -box.max.y : -box.min.y, -bc.z);
    const holder = new THREE.Group();
    holder.add(m);
    holder.rotation.y = Math.atan2(-f.x, -f.z);
    const pos = mn.clone().add(mx).multiplyScalar(0.5);
    pos.y = top ? mx.y : mn.y;
    if (cat === 'sofa') {
      // keep the back against the wall: align the backs, then step forward by half the new depth
      const slotDepth = Math.abs((mx.x - mn.x) * f.x) + Math.abs((mx.z - mn.z) * f.z);
      pos.addScaledVector(f, -slotDepth / 2 + size.z / 2);
    }
    holder.position.copy(pos);
    grp.add(holder);
  }
  return grp;
}

function slotNodes(cat) {
  return (cur.meta.slots?.[cat] || []).map((i) => cur.root.getObjectByName(i.node)).filter(Boolean);
}

async function applyChoice(cat) {
  const list = catalog[cat];
  const entry = list.find((e) => e.id === choice[cat]) || list[0];
  if (placed[cat]) { cur.root.remove(placed[cat]); placed[cat] = null; }
  const useOriginal = entry.current || showOriginal || !furnishOn;
  slotNodes(cat).forEach((n) => (n.visible = useOriginal));
  if (useOriginal) return;
  const model = await loadFurniture(entry);
  if (!furnishOn || showOriginal || (choice[cat] || list[0].id) !== entry.id || placed[cat]) return; // changed meanwhile
  placed[cat] = placeCopies(model, cat);
  cur.root.add(placed[cat]);
  applyLook();
}

const cm = (v) => Math.round(v * 100);
const dims = (e) => `寬 ${cm(e.size_m[0])} × 深 ${cm(e.size_m[1])} × 高 ${cm(e.size_m[2])} cm`;
const fname = (e) => FURNISH.names[e.id] || e.ue_asset || e.id;
const cat2view = (c) => FURNISH.categories.find((x) => x.id === c).view;
const CEILING = 3.124;

function renderFurnish() {
  const p = $('furnish');
  const cat = FURNISH.categories.find((c) => c.id === furnishCat);
  const list = catalog[furnishCat];
  const sel = list.find((e) => e.id === choice[furnishCat]) || list[0];
  const orig = list.find((e) => e.current);
  let diff = '';
  if (orig && !sel.current) {
    const d = sel.size_m.map((v, i) => cm(v - orig.size_m[i]));
    const sign = (v) => (v > 0 ? '+' + v : String(v));
    diff = `<div class="fu-diff">與現有設計相比：寬 <b>${sign(d[0])}</b>、深 <b>${sign(d[1])}</b>、高 <b>${sign(d[2])}</b> cm`;
    if (furnishCat === 'sofa' && sel.size_m[0] < orig.size_m[0] - 0.6)
      diff += `<br><span class="warn">比現有沙發短 ${cm(orig.size_m[0] - sel.size_m[0])} cm，主牆前會留下較大空檔。</span>`;
    if (furnishCat === 'pendant' && CEILING - sel.size_m[2] < 1.4)
      diff += `<br><span class="warn">燈體底緣離地約 ${cm(CEILING - sel.size_m[2])} cm，實際安裝需縮短吊線。</span>`;
    diff += `<br>UE 原始面數 ${(sel.tris_source || sel.tris).toLocaleString()}，網頁版 ${sel.tris.toLocaleString()}。</div>`;
  } else if (orig) {
    diff = `<div class="fu-diff">目前為 <b>現有 Luxury v2 設計</b>（${dims(orig)}）。點選下方 UE5 家具即可原位替換。</div>`;
  }
  p.innerHTML = `
    <div class="fu-head"><div class="info-kicker">FURNITURE OPTIONS</div><h3>家具選配比較</h3>
      <p>UE5 UMU1331 家具庫候選 ⇄ 現有精修設計，於 75 坪三房原位替換預覽。</p></div>
    <div class="fu-tabs">${FURNISH.categories.map((c) => `<button data-cat="${c.id}" class="${c.id === furnishCat ? 'on' : ''}">${c.label}</button>`).join('')}</div>
    <div class="fu-list">${list.map((e) => `
      <button class="fu-item ${e.id === sel.id ? 'on' : ''}" data-id="${e.id}">
        <img src="${e.thumb}" alt="" loading="lazy">
        <span><span class="n">${fname(e)}</span>
        <span class="d" style="display:block"><span class="tag ${e.current ? '' : 'ue'}">${e.current ? '現有' : 'UE5'}</span>${dims(e)}${e.current ? '' : '<br>' + e.ue_asset}</span></span>
      </button>`).join('')}</div>
    ${diff}
    <dl class="fu-sum">${FURNISH.categories.map((c) => {
      const e = catalog[c.id].find((x) => x.id === choice[c.id]) || catalog[c.id][0];
      return `<dt>${c.label}</dt><dd>${fname(e)}</dd>`;
    }).join('')}</dl>
    <div class="fu-foot">
      <button id="fuAB" class="${showOriginal ? 'on' : ''}">${showOriginal ? '顯示選配' : '對照原設計'}</button>
      <button id="fuView">前往${cat.label}</button>
      <button id="fuReset">全部還原</button>
    </div>`;
  p.querySelectorAll('[data-cat]').forEach((b) => (b.onclick = () => {
    furnishCat = b.dataset.cat;
    renderFurnish();
    if (activeView !== cat2view(furnishCat)) goView(cat2view(furnishCat));
  }));
  p.querySelectorAll('[data-id]').forEach((b) => (b.onclick = () => {
    choice[furnishCat] = b.dataset.id;
    try { localStorage.setItem('yj_furnish', JSON.stringify(choice)); } catch { /* ignore */ }
    showOriginal = false;
    applyChoice(furnishCat);
    renderFurnish();
    if (activeView !== cat2view(furnishCat)) goView(cat2view(furnishCat));
  }));
  $('fuAB').onclick = () => { showOriginal = !showOriginal; FURNISH.categories.forEach((c) => applyChoice(c.id)); renderFurnish(); };
  $('fuView').onclick = () => goView(cat2view(furnishCat));
  $('fuReset').onclick = () => {
    for (const c of FURNISH.categories) delete choice[c.id];
    try { localStorage.removeItem('yj_furnish'); } catch { /* ignore */ }
    showOriginal = false;
    FURNISH.categories.forEach((c) => applyChoice(c.id));
    renderFurnish();
  };
}

async function setFurnish(on) {
  furnishOn = on;
  document.body.classList.toggle('furnishing', on);
  $('furnish').hidden = !on;
  if (on) {
    await loadCatalog();
    for (const c of FURNISH.categories) if (choice[c.id] && !catalog[c.id].some((e) => e.id === choice[c.id])) delete choice[c.id];
    FURNISH.categories.forEach((c) => applyChoice(c.id));
    renderFurnish();
    goView(cat2view(furnishCat));
  } else if (catalog) {
    // leave the unit exactly as designed when the panel closes
    showOriginal = false;
    FURNISH.categories.forEach((c) => applyChoice(c.id));
  }
  renderDock();
}

// ---------------------------------------------------------------- attract / idle
let lastInput = performance.now();
let attracting = false;
const idleMs = (+qs.get('idle') || 0) * 1000 || IDLE_MS; // ?idle=秒數 可覆寫
let attractTimer = null;
const attractSeq = [EXTERIOR, ...UNITS];
let attractIdx = 0;

function wake() {
  lastInput = performance.now();
  if (!attracting) return;
  attracting = false;
  clearTimeout(attractTimer);
  document.body.classList.remove('attracting');
  controls.autoRotate = false;
  renderDock();
}
['pointerdown', 'wheel', 'keydown'].forEach((ev) => addEventListener(ev, wake, { capture: true }));

async function attractStep() {
  if (!attracting) return;
  const site = attractSeq[attractIdx++ % attractSeq.length];
  $('attractTitle').textContent = site.id === 'exterior' ? `${PROJECT.name}` : `${PROJECT.name}｜${site.title}`;
  night = false;
  await openSite(site);
  if (!attracting) return;
  controls.autoRotate = true;
  controls.autoRotateSpeed = site.id === 'exterior' ? 0.6 : 0.9;
  attractTimer = setTimeout(attractStep, site.id === 'exterior' ? 26000 : 18000);
}
setInterval(() => {
  if (!attracting && !tween && $('modal').hidden && !document.querySelector('.lightbox') && performance.now() - lastInput > idleMs) {
    attracting = true;
    if (furnishOn) setFurnish(false);
    document.body.classList.add('attracting');
    attractIdx = 0;
    attractStep();
  }
}, 2000);

// ---------------------------------------------------------------- loop
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  labelRenderer.setSize(innerWidth, innerHeight);
});

renderer.setAnimationLoop((now) => {
  stepTween(now);
  if (!tween) controls.update();
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
});

// ---------------------------------------------------------------- boot
$('brandDev').textContent = PROJECT.developer;
$('brandDev').hidden = !PROJECT.developer;
$('brandName').textContent = PROJECT.name;
$('brandTag').textContent = PROJECT.tagline;
$('legal').textContent = PROJECT.disclaimer;
buildMenu();
camera.position.set(200, 120, 260);
const start = [EXTERIOR, ...UNITS].find((s) => s.id === qs.get('site')) || EXTERIOR;
openSite(start, { animate: false }).then(() => {
  // warm the cache so switching units is instant
  [EXTERIOR, ...UNITS].reduce((p, s) => p.then(() => loadSite(s)), Promise.resolve());
});
window.__signage = { setFurnish, goView, goPlan, goOverview, openSite, get cur() { return cur; }, camera, controls, renderer };
