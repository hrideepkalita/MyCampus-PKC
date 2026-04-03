import imageCompression from "browser-image-compression";

const OPTIONS = {
  maxSizeMB: 3,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
};

export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const compressed = await imageCompression(file, OPTIONS);
    return new File([compressed], file.name, { type: compressed.type });
  } catch {
    return file;
  }
}
