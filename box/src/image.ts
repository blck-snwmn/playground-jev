import { MAX_IMAGE_BYTES, MAX_SIDE, MIN_SIDE } from "./schema";

export function preparedSize(width: number, height: number) {
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  const contentWidth = Math.max(1, Math.round(width * scale));
  const contentHeight = Math.max(1, Math.round(height * scale));
  return {
    contentWidth,
    contentHeight,
    width: Math.max(MIN_SIDE, contentWidth),
    height: Math.max(MIN_SIDE, contentHeight),
  };
}

export async function prepareImage(file: File) {
  if (!["image/png", "image/jpeg"].includes(file.type)) {
    throw new Error("PNGまたはJPEGの画像を選んでください。");
  }
  if (!file.size || file.size > MAX_IMAGE_BYTES) {
    throw new Error("画像は16 MiB以下のファイルを選んでください。");
  }
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const size = preparedSize(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("画像を準備できませんでした。");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, size.width, size.height);
    context.drawImage(
      bitmap,
      (size.width - size.contentWidth) / 2,
      (size.height - size.contentHeight) / 2,
      size.contentWidth,
      size.contentHeight,
    );
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (value) => (value ? resolve(value) : reject(new Error("画像を変換できませんでした。"))),
        "image/png",
      );
    });
    if (blob.size > MAX_IMAGE_BYTES)
      throw new Error("変換後の画像が大きすぎます。小さな画像を選んでください。");
    return {
      file: new File([blob], "image.png", { type: "image/png" }),
      width: size.width,
      height: size.height,
      name: file.name,
    };
  } finally {
    bitmap.close();
  }
}

// Prepared browser uploads are PNG; the upstream API also validates full decoding.
export async function validatePreparedImage(file: File) {
  if (file.type !== "image/png" || !file.size || file.size > MAX_IMAGE_BYTES) return false;
  const bytes = new Uint8Array(await file.slice(0, 24).arrayBuffer());
  const signature = [137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82];
  if (bytes.length !== 24 || !signature.every((value, i) => bytes[i] === value)) return false;
  const view = new DataView(bytes.buffer);
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  return width >= MIN_SIDE && width <= MAX_SIDE && height >= MIN_SIDE && height <= MAX_SIDE;
}
