/** Reads a file or blob into a data URL, which an <img> shows without anything to release. */
export function toDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // readAsDataURL always ends with a string result.
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('The image could not be read'));
    };
    reader.onerror = () => {
      reject(new Error('The image could not be read'));
    };
    reader.readAsDataURL(blob);
  });
}

/** Opens a picture the way an <img> shows it (camera rotation applied). */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      resolve(image);
    };
    image.onerror = () => {
      reject(new Error('The file is not an image the browser can open'));
    };
    image.src = src;
  });
}

/** The picture's real size in pixels. */
export async function imageSizeOf(
  src: string,
): Promise<{ naturalWidth: number; naturalHeight: number }> {
  const { naturalWidth, naturalHeight } = await loadImage(src);
  return { naturalWidth, naturalHeight };
}
