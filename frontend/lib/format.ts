export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

export function validateImageFile(file: File): string | null {
  const name = file.name.toLowerCase();
  const extensionOk = EXTENSIONS.some((extension) => name.endsWith(extension));
  const typeOk = ["image/jpeg", "image/png", "image/webp"].includes(file.type);
  if (!extensionOk && !typeOk) return "Use a JPEG, PNG, or WebP image.";
  if (file.size === 0) return "That file is empty.";
  if (file.size > MAX_UPLOAD_BYTES) return "That file is larger than 10 MB.";
  return null;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatMs(value: number | null | undefined) {
  if (value == null) return null;
  if (value >= 1000) return `${(value / 1000).toFixed(2)} s`;
  return `${value.toFixed(value >= 100 ? 0 : 1)} ms`;
}
