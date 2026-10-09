/**
 * Lecture des PDF du bloc « Ma candidature » avec pdf.js (Mozilla, licence Apache 2.0),
 * embarqué dans client/public/vendor/pdfjs (version « legacy », compatible Safari) et chargé
 * seulement quand on en a besoin.
 * Chaque page est dessinée dans un <canvas> : le document garde exactement sa mise en page,
 * dans le style du site (pas de lecteur PDF du navigateur).
 */
type Viewport = { width: number; height: number };
type PdfPage = {
  getViewport: (o: { scale: number }) => Viewport;
  render: (o: { canvasContext: CanvasRenderingContext2D; viewport: Viewport }) => { promise: Promise<void>; cancel: () => void };
};
export type PdfDoc = { numPages: number; getPage: (n: number) => Promise<PdfPage> };
type PdfJs = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (src: { url: string; disableRange?: boolean; disableStream?: boolean; disableAutoFetch?: boolean; isEvalSupported?: boolean }) => {
    promise: Promise<PdfDoc>;
  };
};

const BASE = "/vendor/pdfjs/";
let lib: Promise<PdfJs> | null = null;
const docs = new Map<string, Promise<PdfDoc>>();

function loadLib() {
  if (!lib) {
    // adresse absolue : en développement, Vite n'y ajoute pas « ?import » (fichier de public/ servi tel quel)
    const url = new URL(`${BASE}pdf.mjs`, window.location.href).href;
    lib = (import(/* @vite-ignore */ url) as Promise<PdfJs>).then((m) => {
      m.GlobalWorkerOptions.workerSrc = new URL(`${BASE}pdf.worker.mjs`, window.location.href).href;
      return m;
    });
    lib.catch(() => (lib = null));
  }
  return lib;
}

/** Ouvre un PDF (gardé en mémoire : la carte et la fenêtre partagent le même document). */
export function openPdf(url: string) {
  let p = docs.get(url);
  if (!p) {
    // délai de garde : un document qui ne s'ouvre pas laisse place au lien de secours
    const timeout = new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error("PDF : délai dépassé")), 20000));
    p = Promise.race([loadLib().then(
        (m) =>
          // fichier lu d'un bloc (pas de requêtes partielles ni de flux) : plus fiable sur Safari et derrière le proxy
          m.getDocument({ url, disableRange: true, disableStream: true, disableAutoFetch: true, isEvalSupported: false }).promise
      ), timeout]);
    p.catch((e) => console.warn("[pdf]", url, e));
    p.catch(() => docs.delete(url));
    docs.set(url, p);
  }
  return p;
}

/** Dessine une page à une largeur donnée (en pixels CSS), nette sur les écrans haute densité. */
export async function drawPage(doc: PdfDoc, n: number, canvas: HTMLCanvasElement, cssWidth: number) {
  const page = await doc.getPage(n);
  const base = page.getViewport({ scale: 1 });
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const viewport = page.getViewport({ scale: (cssWidth / base.width) * dpr });
  // rendu dans une toile à part, recopiée à la fin : deux rendus simultanés de la même page
  // (double montage de React en développement, redimensionnement…) ne se gênent jamais
  const off = document.createElement("canvas");
  off.width = Math.round(viewport.width);
  off.height = Math.round(viewport.height);
  const offCtx = off.getContext("2d");
  if (!offCtx) return base;
  await page.render({ canvasContext: offCtx, viewport }).promise;
  canvas.width = off.width;
  canvas.height = off.height;
  canvas.getContext("2d")?.drawImage(off, 0, 0);
  return base;
}

/** Rapport hauteur / largeur d'une page (A4 ≈ 1,414). */
export async function pageRatio(doc: PdfDoc, n = 1) {
  const v = (await doc.getPage(n)).getViewport({ scale: 1 });
  return v.height / v.width;
}
