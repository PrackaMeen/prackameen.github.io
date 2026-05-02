const imageCache = new Map();

export function loadImage(url) {
  if (!url) {
    return Promise.resolve(null);
  }

  const cached = imageCache.get(url);
  if (cached) {
    return cached instanceof Promise ? cached : Promise.resolve(cached);
  }

  const pending = new Promise((resolve) => {
    if (typeof Image === 'undefined') {
      resolve(null);
      return;
    }

    const image = new Image();
    image.onload = () => {
      imageCache.set(url, image);
      resolve(image);
    };
    image.onerror = () => {
      imageCache.delete(url);
      resolve(null);
    };
    image.src = url;
  });

  imageCache.set(url, pending);
  return pending;
}