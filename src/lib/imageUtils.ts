/**
 * Compresses and converts an image file to JPEG base64.
 * This ensures compatibility with AI vision APIs by:
 * - Converting HEIC/WEBP/PNG to JPEG
 * - Resizing images larger than maxDimension
 * - Compressing to reduce payload size
 */
export function compressImageToBase64(
  file: File,
  maxDimension = 1600,
  quality = 0.8
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;

        // Scale down if needed
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas não suportado"));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Convert to JPEG base64
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        const base64 = dataUrl.split(",")[1];
        resolve(base64);
      };
      img.onerror = () => reject(new Error(`Não foi possível carregar a imagem: ${file.name}`));
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function fileToVisionBase64Images(
  file: File,
  options?: {
    maxDimension?: number;
    quality?: number;
    maxPdfPages?: number;
  },
): Promise<string[]> {
  const maxDimension = options?.maxDimension ?? 1600;
  const quality = options?.quality ?? 0.8;
  const maxPdfPages = options?.maxPdfPages ?? 3;

  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return [await compressImageToBase64(file, maxDimension, quality)];
  }

  const [{ getDocument, GlobalWorkerOptions }, workerUrl] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min?url"),
  ]);

  (GlobalWorkerOptions as any).workerSrc = (workerUrl as any).default ?? workerUrl;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await (getDocument as any)({ data: arrayBuffer }).promise;
  const pages = Math.min(pdf.numPages || 0, Math.max(1, maxPdfPages));
  const images: string[] = [];

  for (let pageNumber = 1; pageNumber <= pages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const initialViewport = page.getViewport({ scale: 2 });
    const ratio = Math.max(initialViewport.width / maxDimension, initialViewport.height / maxDimension, 1);
    const viewport = page.getViewport({ scale: 2 / ratio });

    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas não suportado");

    await page.render({ canvasContext: ctx, viewport }).promise;
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    images.push(dataUrl.split(",")[1]);
  }

  return images;
}
