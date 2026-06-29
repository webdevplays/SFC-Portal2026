/**
 * Browser-side utility to compress images using Canvas.
 * Reduces image dimensions and uses JPEG compression to minimize file size while preserving high quality.
 */
export function compressImage(
  file: File,
  maxDimension: number = 1600,
  quality: number = 0.82
): Promise<{ base64: string; compressedFile: File }> {
  return new Promise((resolve) => {
    // Only compress image files
    if (!file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        resolve({ base64: reader.result as string, compressedFile: file });
      };
      reader.onerror = () => {
        resolve({ base64: '', compressedFile: file });
      };
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions keeping aspect ratio
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({ base64: e.target?.result as string || '', compressedFile: file });
          return;
        }

        // Handle drawing on white background for transparency to avoid black borders on PNG to JPEG
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);

        ctx.drawImage(img, 0, 0, width, height);

        // Convert to quality compressed JPEG
        const base64 = canvas.toDataURL('image/jpeg', quality);

        // Convert base64 back to a File object
        const arr = base64.split(',');
        const mime = arr[0].match(/:(.*?);/)![1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        
        const compressedFile = new File([u8arr], file.name.replace(/\.[^.]+$/, '.jpg'), {
          type: mime,
          lastModified: Date.now()
        });

        resolve({ base64, compressedFile });
      };
      img.onerror = () => {
        resolve({ base64: e.target?.result as string || '', compressedFile: file });
      };
      img.src = e.target?.result as string;
    };
    reader.onerror = () => {
      resolve({ base64: '', compressedFile: file });
    };
    reader.readAsDataURL(file);
  });
}
