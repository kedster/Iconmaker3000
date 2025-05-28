const sizes = [16, 32, 48, 64, 128, 256];
const imageInput = document.getElementById('imageInput');
const generateBtn = document.getElementById('generateBtn');
const downloadLink = document.getElementById('downloadLink');
const preview = document.getElementById('preview');

function createCanvasImage(img, size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, size, size);
  return canvas.toDataURL('image/png');
}

generateBtn.addEventListener('click', async () => {
  const file = imageInput.files[0];
  if (!file) {
    alert('Please upload an image.');
    return;
  }

  const img = new Image();
  img.src = URL.createObjectURL(file);

  img.onload = async () => {
    const zip = new JSZip();
    const iconsFolder = zip.folder('favicons');
    preview.innerHTML = '';

    for (const size of sizes) {
      const dataURL = createCanvasImage(img, size);
      const base64 = dataURL.split(',')[1];

      preview.innerHTML += `<div><strong>${size}x${size}</strong><br/><img src="${dataURL}" /></div>`;

      iconsFolder.file(`favicon-${size}x${size}.png`, base64, { base64: true });
    }

    // Create .ico file from 16, 32, 48 (only possible with external lib or server-side)
    // Workaround: Use 48x48 PNG and name it .ico (not perfect but acceptable for many uses)
    const icoDataURL = createCanvasImage(img, 48);
    const icoBase64 = icoDataURL.split(',')[1];
    iconsFolder.file('favicon.ico', icoBase64, { base64: true });

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const zipURL = URL.createObjectURL(zipBlob);

    downloadLink.href = zipURL;
    downloadLink.download = 'favicons.zip';
    downloadLink.style.display = 'inline-block';
    downloadLink.innerText = 'Download ZIP';
  };
});
