/**
 * Compresses and resizes a passport photo file for student registration.
 *
 * Requirements:
 * - Formats: JPG, JPEG, PNG, WebP (Max original 5 MB)
 * - Target dimensions: 400x500px (portrait passport aspect ratio)
 * - Target file size: <= 100 KB (or up to 150 KB if quality loss is significant)
 * - Returns compressed File object, Blob, preview URL, and metadata.
 */
export async function compressPassportPhoto(file) {
  if (!file) {
    throw new Error('No file provided.');
  }

  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const fileType = (file.type || '').toLowerCase();
  
  if (!validTypes.includes(fileType)) {
    throw new Error('Invalid image format. Please select a JPG, JPEG, PNG, or WebP image.');
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Original photo size exceeds the 5 MB limit. Please select a smaller photo.');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error('Failed to read photo file.'));

    reader.onload = (event) => {
      const img = new Image();

      img.onerror = () => reject(new Error('Failed to load image into memory for compression.'));

      img.onload = () => {
        try {
          // Standard passport dimensions: 400px width x 500px height (4:5 ratio)
          const targetWidth = 400;
          const targetHeight = 500;

          const canvas = document.createElement('canvas');
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          const ctx = canvas.getContext('2d');

          // High quality image scaling
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          // Fill white background (useful for transparent PNGs)
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, targetWidth, targetHeight);

          // Center-crop to 400x500 aspect ratio
          const imgAspect = img.width / img.height;
          const targetAspect = targetWidth / targetHeight;

          let renderWidth, renderHeight, offsetX, offsetY;

          if (imgAspect > targetAspect) {
            // Image is wider than 4:5 aspect ratio
            renderHeight = targetHeight;
            renderWidth = img.width * (targetHeight / img.height);
            offsetX = -(renderWidth - targetWidth) / 2;
            offsetY = 0;
          } else {
            // Image is taller or equal to 4:5 aspect ratio
            renderWidth = targetWidth;
            renderHeight = img.height * (targetWidth / img.width);
            offsetX = 0;
            offsetY = -(renderHeight - targetHeight) / 2;
          }

          ctx.drawImage(img, offsetX, offsetY, renderWidth, renderHeight);

          const getBlobWithQuality = (quality) => {
            return new Promise((res) => {
              canvas.toBlob((b) => res(b), 'image/jpeg', quality);
            });
          };

          (async () => {
            let quality = 0.85;
            let blob = await getBlobWithQuality(quality);

            // Step down quality if over 100 KB (102,400 bytes)
            while (blob.size > 100 * 1024 && quality > 0.45) {
              quality -= 0.07;
              blob = await getBlobWithQuality(quality);
            }

            // If still over 150 KB, compress to quality 0.38
            if (blob.size > 150 * 1024) {
              blob = await getBlobWithQuality(0.38);
            }

            const baseName = (file.name || 'passport').replace(/\.[^/.]+$/, '');
            const compressedFileName = `${baseName}_compressed.jpg`;
            const compressedFile = new File([blob], compressedFileName, { type: 'image/jpeg' });
            const previewUrl = URL.createObjectURL(blob);
            const sizeKb = Math.round(blob.size / 1024);
            const originalSizeKb = Math.round(file.size / 1024);

            resolve({
              blob,
              file: compressedFile,
              previewUrl,
              width: targetWidth,
              height: targetHeight,
              sizeKb,
              originalSizeKb,
            });
          })();
        } catch (err) {
          reject(err);
        }
      };

      img.src = event.target.result;
    };

    reader.readAsDataURL(file);
  });
}
