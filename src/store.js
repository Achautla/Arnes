// Proyecto, viñetas, deshacer y guardado sin conexión
import { clone, uid } from "./util.js";

export const ASPECTS = { libre: null, "1:1": 1, "4:3": 4 / 3, "3:4": 3 / 4, "16:9": 16 / 9, "2:1": 2, "1:2": 0.5 };

export function defaultView() {
  return { mode: "clay", tones: 3, th: 0.5, outline: false, thick: 1.5, background: "papel", grid: true, ruler: true, horizon: true, vp: false, action: false, com: true };
}
export function defaultCamera() {
  return { pos: [2.6, 1.6, 3.2], target: [0, 0.9, 0], mm: 35, roll: 0, aspect: "4:3", shot: null, angle: "normal" };
}
export function newVineta(name = "Viñeta") {
  return { id: uid("v"), name, objects: [], lights: [], camera: defaultCamera(), view: defaultView() };
}

export class Store {
  constructor() {
    this.project = null; this.past = []; this.future = []; this.snap = null;
    this.listeners = new Set(); this.saveTimer = null; this.db = null;
  }
  get v() { return this.project.vinetas[this.project.cur]; }
  load(project) {
    this.project = project;
    this.snap = JSON.stringify(project); this.past = []; this.future = [];
  }
  commit() {
    const s = JSON.stringify(this.project);
    if (s === this.snap) return;
    this.past.push(this.snap); if (this.past.length > 50) this.past.shift();
    this.snap = s; this.future = [];
    this.scheduleSave(); this.emit("commit");
  }
  // Cambios de cámara: se guardan pero no ocupan un paso de deshacer
  touch() { this.snap = JSON.stringify(this.project); this.scheduleSave(); }
  undo() {
    if (!this.past.length) return false;
    this.future.push(this.snap); this.snap = this.past.pop();
    this.project = JSON.parse(this.snap); this.scheduleSave(); this.emit("restore"); return true;
  }
  redo() {
    if (!this.future.length) return false;
    this.past.push(this.snap); this.snap = this.future.pop();
    this.project = JSON.parse(this.snap); this.scheduleSave(); this.emit("restore"); return true;
  }
  on(fn) { this.listeners.add(fn); }
  emit(kind) { this.listeners.forEach(f => f(kind)); }

  // --- Viñetas ---
  addVineta() { const v = newVineta(`Viñeta ${this.project.vinetas.length + 1}`); this.project.vinetas.splice(this.project.cur + 1, 0, v); this.project.cur++; }
  duplicateVineta() {
    const c = clone(this.v); c.id = uid("v"); c.name = this.nextName(this.v.name);
    this.project.vinetas.splice(this.project.cur + 1, 0, c); this.project.cur++;
  }
  nextName(name) {
    const m = name.match(/^(.*?)(\d+)$/);
    return m ? m[1] + (Number(m[2]) + 1) : name + " (copia)";
  }
  deleteVineta() {
    if (this.project.vinetas.length < 2) return false;
    this.project.vinetas.splice(this.project.cur, 1);
    this.project.cur = Math.max(0, this.project.cur - 1); return true;
  }
  // Copia un objeto a todas las viñetas siguientes (lo reemplaza si ya existe con el mismo id)
  copyForward(objId) {
    const o = this.v.objects.find(x => x.id === objId) || this.v.lights.find(x => x.id === objId);
    if (!o) return 0;
    const key = this.v.objects.includes(o) ? "objects" : "lights";
    let n = 0;
    for (let i = this.project.cur + 1; i < this.project.vinetas.length; i++) {
      const list = this.project.vinetas[i][key];
      const k = list.findIndex(x => x.id === objId);
      if (k >= 0) list[k] = clone(o); else list.push(clone(o));
      n++;
    }
    return n;
  }

  // --- Guardado en el dispositivo (IndexedDB) ---
  async openDb() {
    if (this.db !== null) return this.db;
    this.db = await new Promise(res => {
      try {
        const r = indexedDB.open("arnes", 1);
        r.onupgradeneeded = () => r.result.createObjectStore("kv");
        r.onsuccess = () => res(r.result); r.onerror = () => res(false);
      } catch { res(false); }
    });
    return this.db;
  }
  async readSaved() {
    const db = await this.openDb(); if (!db) return null;
    return new Promise(res => {
      try {
        const q = db.transaction("kv").objectStore("kv").get("project");
        q.onsuccess = () => res(q.result || null); q.onerror = () => res(null);
      } catch { res(null); }
    });
  }
  scheduleSave() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.saveNow(), 700);
  }
  async saveNow() {
    const db = await this.openDb(); if (!db) { this.emit("save-failed"); return; }
    try {
      const tx = db.transaction("kv", "readwrite");
      tx.objectStore("kv").put(JSON.stringify(this.project), "project");
      tx.oncomplete = () => this.emit("saved");
    } catch { this.emit("save-failed"); }
  }
}
