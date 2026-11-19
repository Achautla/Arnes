// Video entre viñetas: cada viñeta es un cuadro clave. Entre una y la siguiente se interpolan la cámara
// y, para los objetos que comparten identificador (al duplicar una viñeta se conservan), la posición,
// el giro y la pose de cada personaje. Se renderiza cuadro por cuadro con el estilo de la viñeta, así que
// el resultado no depende de la velocidad del teléfono. La tela se simula en vivo entre cuadros.
import * as THREE from "three";
import { sceneFor, disposeScene, frameFov } from "./scenes.js";
import { renderToBlob } from "./render.js";
import * as M from "./mannequin.js";

export const VIDEO_FORMATS = { "16:9": [16, 9], "9:16": [9, 16], "1:1": [1, 1], "4:5": [4, 5] };
const lerp = (a, b, t) => a + (b - a) * t;
const lerpArr = (a = [], b = [], t) => a.map((v, i) => lerp(v, b[i] ?? v, t));
const ease = t => t * t * (3 - 2 * t);
function lerpAngle(a, b, t) { let d = ((b - a + 540) % 360) - 180; return a + d * t; }

function lerpPose(A = {}, B = {}, t) {
  const rot = {};
  const keys = new Set([...Object.keys(A.rot || {}), ...Object.keys(B.rot || {})]);
  for (const k of keys) { const a = A.rot?.[k] || [0, 0, 0], b = B.rot?.[k] || [0, 0, 0]; rot[k] = a.map((v, i) => lerpAngle(v, b[i], t)); }
  const out = { ...A, rot, hips: lerpArr(A.hips || [0, 0, 0], B.hips || [0, 0, 0], t) };
  if (A.body || B.body) out.body = (A.body || [0, 0, 0]).map((v, i) => lerpAngle(v, (B.body || [0, 0, 0])[i], t));
  return out;
}

function sizeFor(format, quality) {
  const [a, b] = VIDEO_FORMATS[format] || [16, 9], short = quality === "720" ? 720 : 1080;
  const w = a >= b ? Math.round(short * a / b) : short, h = a >= b ? short : Math.round(short * b / a);
  return [w - (w % 2), h - (h % 2)];
}

async function encoder(w, h, fps) {
  if (typeof VideoEncoder !== "undefined") {
    try {
      const { Muxer, ArrayBufferTarget } = await import("./vendor/mp4-muxer.mjs");
      const codec = "avc1.640028";
      const sup = await VideoEncoder.isConfigSupported({ codec, width: w, height: h, bitrate: 8e6, framerate: fps });
      if (sup.supported) {
        const target = new ArrayBufferTarget();
        const muxer = new Muxer({ target, video: { codec: "avc", width: w, height: h }, fastStart: "in-memory" });
        let err = null;
        const enc = new VideoEncoder({ output: (c, m) => muxer.addVideoChunk(c, m), error: e => (err = e) });
        enc.configure({ codec, width: w, height: h, bitrate: w * h > 1.5e6 ? 8e6 : 4e6, framerate: fps });
        let i = 0;
        return {
          kind: "mp4",
          async add(canvas) {
            if (err) throw err;
            const f = new VideoFrame(canvas, { timestamp: Math.round(i * 1e6 / fps), duration: Math.round(1e6 / fps) });
            enc.encode(f, { keyFrame: i % (fps * 2) === 0 }); f.close(); i++;
            if (enc.encodeQueueSize > 8) await new Promise(r => setTimeout(r, 10));
          },
          async finish() { await enc.flush(); muxer.finalize(); return new Blob([target.buffer], { type: "video/mp4" }); },
        };
      }
    } catch { /* sigue con el respaldo */ }
  }
  // Respaldo: grabar un lienzo con MediaRecorder (WebM), un cuadro a la vez
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d"), stream = c.captureStream(0), track = stream.getVideoTracks()[0];
  const rec = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm", videoBitsPerSecond: 8e6 });
  const chunks = []; rec.ondataavailable = e => e.data.size && chunks.push(e.data); rec.start();
  return {
    kind: "webm",
    async add(canvas) { g.drawImage(canvas, 0, 0, w, h); track.requestFrame?.(); await new Promise(r => setTimeout(r, 1000 / fps)); },
    async finish() { await new Promise(r => { rec.onstop = r; rec.stop(); }); return new Blob(chunks, { type: "video/webm" }); },
  };
}

// vinetas: lista de cuadros clave en orden. Devuelve { blob, kind, frames }
export async function makeVideo({ renderer, composer, vinetas, seconds = 15, fps = 24, format = "16:9", quality = "1080", styleView, onProgress, cancelled }) {
  const [W, H] = sizeFor(format, quality);
  const total = Math.max(1, Math.round(seconds * fps));
  const segs = Math.max(1, vinetas.length - 1);
  const enc = await encoder(W, H, fps);
  let cur = -1, built = null;
  for (let f = 0; f < total; f++) {
    if (cancelled?.()) break;
    const T = total === 1 ? 0 : f / (total - 1);
    const si = Math.min(segs - 1, Math.floor(T * segs)), u = ease(Math.min(1, T * segs - si));
    const A = vinetas[si], B = vinetas[Math.min(vinetas.length - 1, si + 1)];
    if (si !== cur) {
      if (built) disposeScene(built.scene);
      built = sceneFor({ ...A, camera: { ...A.camera, aspect: `${W}:${H}` } }, { lowEnd: true, mode: styleView(A.view).mode });
      cur = si;
    }
    const { camera, figs, world } = built;
    // objetos que existen en las dos viñetas
    const byId = new Map(B.objects.map(o => [o.id, o]));
    for (const a of A.objects) {
      const b = byId.get(a.id) || a, g = world.get(a.id); if (!g) continue;
      g.position.fromArray(lerpArr(a.pos, b.pos, u));
      if (a.kind === "figure") {
        g.rotation.y = lerpAngle(a.rotY || 0, b.rotY || 0, u) * Math.PI / 180;
        const fig = figs.get(a.id);
        if (fig && a.pose && b.pose) { M.applyPose(fig, lerpPose(a.pose, b.pose, u), a.relaxed); fig.dress?.update?.("live"); }
      } else {
        g.rotation.set(...lerpArr(a.rot || [0, 0, 0], b.rot || [0, 0, 0], u).map(d => d * Math.PI / 180));
        g.scale.fromArray(lerpArr(a.scale || [1, 1, 1], b.scale || [1, 1, 1], u));
      }
    }
    // cámara: si solo hay una viñeta, un acercamiento lento (8 %)
    const ca = A.camera, cb = vinetas.length > 1 ? B.camera : { ...ca, pos: lerpArr(ca.pos, ca.target, 0.08) };
    camera.position.fromArray(lerpArr(ca.pos, cb.pos, u));
    camera.fov = lerp(frameFov(ca), frameFov(cb), u); camera.aspect = W / H;
    camera.up.set(0, 1, 0); camera.lookAt(new THREE.Vector3(...lerpArr(ca.target, cb.target, u)));
    const roll = lerp(ca.roll || 0, cb.roll || 0, u); if (roll) camera.rotateZ(roll * Math.PI / 180);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
    built.scene.updateMatrixWorld(true);
    const { canvas } = await renderToBlob(renderer, composer, built.scene, camera, styleView(A.view), W, H, { noBlob: true });
    await enc.add(canvas);
    onProgress?.((f + 1) / total);
  }
  if (built) disposeScene(built.scene);
  const blob = await enc.finish();
  return { blob, kind: enc.kind, frames: total, size: [W, H] };
}
