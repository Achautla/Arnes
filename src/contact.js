// Contactos y deformación (Fase 3): la piel y la tela se aplanan contra muebles, el piso y otros cuerpos.
// Los obstáculos son cajas orientadas (cada pieza de la utilería) y cápsulas (los cuerpos de los demás).
import * as THREE from "three";

const _v = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3();
const box3 = new THREE.Box3();

// Cajas de la utilería y cápsulas de los otros personajes, en coordenadas del mundo
export function gatherObstacles(groups, figsList, exclude) {
  const boxes = [], caps = [];
  for (const g of groups) {
    if (g === exclude || g.userData.hidesFloor || g.userData.isFigure) continue;
    g.updateMatrixWorld(true);
    g.traverse(m => {
      if (!m.isMesh || !m.visible || m.userData.noContact) return;
      const geo = m.geometry; if (!geo.boundingBox) geo.computeBoundingBox();
      const s = geo.boundingBox.getSize(_v).multiply(m.getWorldScale(_a));
      if (Math.min(s.x, s.y, s.z) < 0.004 || Math.max(s.x, s.y, s.z) < 0.03) return; // láminas y piezas diminutas no cuentan
      const mat = m.matrixWorld.clone(), inv = mat.clone().invert();
      box3.copy(geo.boundingBox).applyMatrix4(mat);
      boxes.push({ mat, inv, min: geo.boundingBox.min.clone(), max: geo.boundingBox.max.clone(), world: box3.clone() });
    });
  }
  for (const f of figsList) {
    if (f.root === exclude) continue;
    const J = n => f.joints[n].getWorldPosition(new THREE.Vector3()), H = f.d.H, t = f.d.t;
    const c = (a, b, r) => caps.push([J(a), J(b), r]);
    c("hips", "chest", 0.075 * H * t); c("chest", "neck1", 0.06 * H * t);
    for (const s of ["L", "R"]) {
      c("shoulder_" + s, "elbow_" + s, 0.026 * H * t); c("elbow_" + s, "wrist_" + s, 0.021 * H * t);
      c("hip_" + s, "knee_" + s, 0.042 * H * t); c("knee_" + s, "ankle_" + s, 0.031 * H * t);
    }
    const h = f.joints.head.localToWorld(new THREE.Vector3(0, f.d.hh * 0.5, 0)); caps.push([h, h.clone(), f.d.hh * 0.42]);
  }
  return { boxes, caps };
}

// Empuja un punto (mundo) fuera de los obstáculos. Devuelve true si lo movió.
export function pushOut(p, obs, floorY = -Infinity, margin = 0.004) {
  let moved = false;
  for (const B of obs.boxes) {
    if (p.x < B.world.min.x - margin || p.x > B.world.max.x + margin || p.y < B.world.min.y - margin || p.y > B.world.max.y + margin || p.z < B.world.min.z - margin || p.z > B.world.max.z + margin) continue;
    _v.copy(p).applyMatrix4(B.inv);
    const dx0 = _v.x - B.min.x, dx1 = B.max.x - _v.x, dy0 = _v.y - B.min.y, dy1 = B.max.y - _v.y, dz0 = _v.z - B.min.z, dz1 = B.max.z - _v.z;
    if (dx0 < -margin || dx1 < -margin || dy0 < -margin || dy1 < -margin || dz0 < -margin || dz1 < -margin) continue;
    const m = Math.min(dx0, dx1, dy0, dy1, dz0, dz1);
    if (m === dy1) _v.y = B.max.y + margin; else if (m === dy0) _v.y = B.min.y - margin;
    else if (m === dx0) _v.x = B.min.x - margin; else if (m === dx1) _v.x = B.max.x + margin;
    else if (m === dz0) _v.z = B.min.z - margin; else _v.z = B.max.z + margin;
    p.copy(_v.applyMatrix4(B.mat)); moved = true;
  }
  for (const [a, b, r] of obs.caps) {
    _a.subVectors(b, a); const L2 = _a.lengthSq();
    const tt = L2 > 1e-9 ? Math.min(1, Math.max(0, _b.subVectors(p, a).dot(_a) / L2)) : 0;
    _b.copy(a).addScaledVector(_a, tt);
    const d = p.distanceTo(_b), R = r + margin;
    if (d < R) { p.sub(_b).multiplyScalar(R / (d || 1e-6)).add(_b); moved = true; }
  }
  if (p.y < floorY + margin) { p.y = floorY + margin; moved = true; }
  return moved;
}

// Piel: los vértices que se meten en un mueble, el piso u otro cuerpo se aplanan contra la superficie,
// y la carne desplazada se reparte un poco hacia los lados (abultamiento).
export function deformSkin(fig, obs, floorY = 0) {
  let n = 0;
  fig.root.traverse(m => {
    if (!m.isMesh || !m.userData.joint || m.userData.cloth || m.userData.acc || m.userData.face) return;
    const geo = m.geometry;
    if (!m.userData.ownGeo) { if (!m.visible) return; m.geometry = geo.clone(); m.userData.ownGeo = true; m.userData.restPos = m.geometry.attributes.position.array.slice(); }
    const pos = m.geometry.attributes.position, arr = pos.array, rest = m.userData.restPos;
    m.updateMatrixWorld(true);
    if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
    const c = m.geometry.boundingSphere.center.clone().applyMatrix4(m.matrixWorld), rad = m.geometry.boundingSphere.radius * m.getWorldScale(_a).x * 1.5 + 0.02;
    const near = c.y - rad < floorY + 0.01 || obs.boxes.some(B => B.world.distanceToPoint(c) < rad) || obs.caps.some(([a, b, r]) => distSeg(c, a, b) < rad + r);
    if (!near) { if (m.userData.deformed) { arr.set(rest); pos.needsUpdate = true; m.geometry.computeVertexNormals(); m.userData.deformed = false; } return; }
    const inv = m.matrixWorld.clone().invert();
    let any = false;
    for (let i = 0; i < arr.length; i += 3) {
      _v.set(rest[i], rest[i + 1], rest[i + 2]).applyMatrix4(m.matrixWorld);
      const before = _v.clone();
      if (pushOut(_v, obs, floorY, 0.001)) { any = true; n++; const d = before.distanceTo(_v); _v.applyMatrix4(inv); arr[i] = _v.x; arr[i + 1] = _v.y; arr[i + 2] = _v.z; void d; }
      else { arr[i] = rest[i]; arr[i + 1] = rest[i + 1]; arr[i + 2] = rest[i + 2]; }
    }
    if (any || m.userData.deformed) { pos.needsUpdate = true; m.geometry.computeVertexNormals(); m.geometry.computeBoundingSphere(); }
    m.userData.deformed = any;
  });
  return n;
}
function distSeg(p, a, b) {
  _a.subVectors(b, a); const L2 = _a.lengthSq();
  const t = L2 > 1e-9 ? Math.min(1, Math.max(0, _b.subVectors(p, a).dot(_a) / L2)) : 0;
  return p.distanceTo(_b.copy(a).addScaledVector(_a, t));
}

// Para la tela: los obstáculos pasados al espacio de la figura (que solo se mueve y gira en Y)
export function toLocal(obs, rootInv) {
  const boxes = obs.boxes.map(B => {
    const mat = new THREE.Matrix4().multiplyMatrices(rootInv, B.mat), inv = mat.clone().invert();
    return { mat, inv, min: B.min, max: B.max, world: B.world.clone().applyMatrix4(rootInv) };
  });
  const caps = obs.caps.map(([a, b, r]) => [a.clone().applyMatrix4(rootInv), b.clone().applyMatrix4(rootInv), r]);
  return { boxes, caps };
}

export function resetSkin(fig) {
  fig.root.traverse(m => {
    if (m.isMesh && m.userData.deformed) { m.geometry.attributes.position.array.set(m.userData.restPos); m.geometry.attributes.position.needsUpdate = true; m.geometry.computeVertexNormals(); m.userData.deformed = false; }
  });
}
