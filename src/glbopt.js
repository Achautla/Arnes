// Comprime un .glb en el propio teléfono antes de guardarlo: texturas a WebP (máx. 2048 px),
// geometría con Meshopt y sin datos repetidos. Un modelo de 20 MB suele quedar en 2 a 5 MB.
// Usa glTF-Transform y meshoptimizer (MIT), empaquetados en src/vendor/gltf-opt.mjs; se carga solo al importar.
let G = null;
async function lib() {
  if (G) return G;
  G = await import("./vendor/gltf-opt.mjs");
  await Promise.all([G.MeshoptEncoder.ready, G.MeshoptDecoder.ready, G.MeshoptSimplifier.ready]);
  return G;
}
export async function optimizeGlb(buf, { maxTex = 2048, maxTris = 400000, onStep } = {}) {
  const L = await lib();
  const io = new L.WebIO().registerExtensions(L.ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": L.MeshoptDecoder, "meshopt.encoder": L.MeshoptEncoder });
  // un modelo con Draco no se puede releer aquí sin su decodificador: se deja como viene
  const head = new TextDecoder().decode(new Uint8Array(buf, 20, Math.min(200000, buf.byteLength - 20)));
  if (head.includes("KHR_draco_mesh_compression")) return { data: new Uint8Array(buf), skipped: "draco" };
  const doc = await io.readBinary(new Uint8Array(buf));
  let tris = 0;
  for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) { const i = p.getIndices(); tris += (i ? i.getCount() : p.getAttribute("POSITION").getCount()) / 3; }
  onStep?.("Limpiando…");
  await doc.transform(L.dedup(), L.prune());
  if (tris > maxTris) { onStep?.("Simplificando la malla…"); await doc.transform(L.weld(), L.simplify({ simplifier: L.MeshoptSimplifier, ratio: maxTris / tris, error: 0.002 })); }
  onStep?.("Comprimiendo texturas…");
  // texturas con el lienzo del navegador: color a 2048 px, el resto (normales, rugosidad) a 1024, en WebP
  let webp = null;
  for (const tex of doc.getRoot().listTextures()) {
    const img = tex.getImage(); if (!img) continue;
    const color = L.listTextureSlots(tex).some(s => /baseColor|emissive|diffuse/i.test(s));
    try {
      const bmp = await createImageBitmap(new Blob([img], { type: tex.getMimeType() || "image/png" }));
      const max = color ? maxTex : maxTex / 2, k = Math.min(1, max / Math.max(bmp.width, bmp.height));
      const w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k));
      const cv = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(w, h) : Object.assign(document.createElement("canvas"), { width: w, height: h });
      cv.getContext("2d").drawImage(bmp, 0, 0, w, h);
      const blob = cv.convertToBlob ? await cv.convertToBlob({ type: "image/webp", quality: color ? 0.84 : 0.8 }) : await new Promise(r => cv.toBlob(r, "image/webp", color ? 0.84 : 0.8));
      if (!blob || blob.type !== "image/webp" || blob.size >= img.byteLength) continue;
      tex.setImage(new Uint8Array(await blob.arrayBuffer())).setMimeType("image/webp").setURI((tex.getURI() || tex.getName() || "tex").replace(/\.\w+$/, "") + ".webp");
      webp ??= doc.createExtension(L.EXTTextureWebP).setRequired(true);
    } catch { /* si el navegador no la puede leer, se queda como venía */ }
  }
  onStep?.("Comprimiendo geometría…");
  await doc.transform(L.meshopt({ encoder: L.MeshoptEncoder, level: "medium" }));
  return { data: await io.writeBinary(doc), tris };
}
