import { api } from './lib';

// Longest side of an uploaded product photo: enough for the catalog, small enough for the 4 MB server limit.
const MAX_SIDE = 1600;

/** Shrink a photo from a phone or computer to a JPEG that fits the upload limit and loads quickly. */
export async function shrinkPhoto(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('Не удалось открыть фото. Выберите файл JPEG, PNG или WebP.');
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Не удалось подготовить фото. Попробуйте другой файл.');
  // JPEG has no transparency: paint a white background so PNG transparency does not turn black.
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.86));
  if (!blob) throw new Error('Не удалось подготовить фото. Попробуйте другой файл.');
  return blob;
}

/** Upload one product photo through the backend and return the public URL to save on the product. */
export async function uploadProductPhoto(file: File): Promise<string> {
  const photo = await shrinkPhoto(file);
  const form = new FormData();
  form.append('file', photo, 'photo.jpg');
  const response = await api<{ url: string }>('/admin/uploads/product-image/', { method: 'POST', body: form });
  return response.url;
}
