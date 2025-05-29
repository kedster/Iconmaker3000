class FaviconGenerator {
  constructor() {
    this.strategies = {
      standard: [16, 32, 48, 64, 96, 128, 256],
      web: [16, 32, 48, 180, 192],
      app: [57, 60, 72, 76, 114, 120, 144, 152, 167, 180, 1024],
      custom: []
    };
    
    this.activeFormats = new Set(['png', 'ico']);
    this.currentImage = null;
    this.generatedFiles = new Map();
    this.selectedPath = '';
    this.isGenerating = false;
    
    this.initializeEventListeners();
  }

  initializeEventListeners() {
    const imageInput = document.getElementById('imageInput');
    const uploadArea = document.querySelector('.upload-area');
    const generateBtn = document.getElementById('generateBtn');
    const strategySelect = document.getElementById('strategySelect');
    const customSizesInput = document.getElementById('customSizesInput');
    const formatBtns = document.querySelectorAll('.format-btn');
    const downloadBtn = document.getElementById('downloadBtn');
    const pathSelect = document.getElementById('pathSelect');
    const customPathInput = document.getElementById('customPathInput');
    const copyCodeBtn = document.getElementById('copyCodeBtn');

    // File input and drag & drop
    imageInput?.addEventListener('change', (e) => this.handleFileSelect(e));
    uploadArea?.addEventListener('dragover', (e) => this.handleDragOver(e));
    uploadArea?.addEventListener('dragleave', (e) => this.handleDragLeave(e));
    uploadArea?.addEventListener('drop', (e) => this.handleDrop(e));

    // Strategy selection
    strategySelect?.addEventListener('change', (e) => this.handleStrategyChange(e));
    customSizesInput?.addEventListener('input', (e) => this.handleCustomSizes(e));

    // Path selection
    pathSelect?.addEventListener('change', (e) => this.handlePathChange(e));
    customPathInput?.addEventListener('input', (e) => this.handleCustomPathInput(e));

    // Format selection
    formatBtns?.forEach(btn => {
      btn.addEventListener('click', () => this.toggleFormat(btn));
    });

    // Generate button
    generateBtn?.addEventListener('click', () => this.generateFavicons());

    // Copy code button
    copyCodeBtn?.addEventListener('click', () => this.copyHtmlCode());
  }

  handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) this.loadImage(file);
  }

  handleDragOver(event) {
    event.preventDefault();
    event.currentTarget.classList.add('dragover');
  }

  handleDragLeave(event) {
    event.currentTarget.classList.remove('dragover');
  }

  handleDrop(event) {
    event.preventDefault();
    event.currentTarget.classList.remove('dragover');
    
    const files = event.dataTransfer.files;
    if (files.length > 0) {
      this.loadImage(files[0]);
    }
  }

  handleStrategyChange(event) {
    const customSizesDiv = document.getElementById('customSizes');
    if (event.target.value === 'custom') {
      customSizesDiv.style.display = 'block';
      this.updateCustomSizes();
    } else {
      customSizesDiv.style.display = 'none';
    }
  }

  handleCustomSizes(event) {
    this.updateCustomSizes();
  }

  handlePathChange(event) {
    const customPathInput = document.getElementById('customPathInput');
    const selectedValue = event.target.value;
    
    if (selectedValue === 'custom') {
      customPathInput.style.display = 'block';
      customPathInput.focus();
      this.selectedPath = customPathInput.value;
    } else {
      customPathInput.style.display = 'none';
      this.selectedPath = selectedValue;
    }
  }

  handleCustomPathInput(event) {
    this.selectedPath = event.target.value;
  }

  updateCustomSizes() {
    const input = document.getElementById('customSizesInput');
    if (!input.value.trim()) {
      this.strategies.custom = [];
      return;
    }
    
    const sizes = input.value.split(',')
      .map(s => parseInt(s.trim()))
      .filter(s => !isNaN(s) && s > 0 && s <= 2048);
    this.strategies.custom = sizes;
  }

  toggleFormat(button) {
    const format = button.dataset.format;
    
    if (this.activeFormats.has(format)) {
      this.activeFormats.delete(format);
      button.classList.remove('active');
    } else {
      this.activeFormats.add(format);
      button.classList.add('active');
    }
  }

  async loadImage(file) {
    if (!file.type.startsWith('image/')) {
      this.showToast('Please select a valid image file', 'error');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      this.showToast('File size must be less than 10MB', 'error');
      return;
    }

    try {
      const img = new Image();
      const reader = new FileReader();
      
      reader.onload = (e) => {
        img.onload = () => {
          this.currentImage = img;
          this.showToast('Image loaded successfully!');
          const generateBtn = document.getElementById('generateBtn');
          if (generateBtn) generateBtn.disabled = false;
        };
        
        img.onerror = () => {
          this.showToast('Failed to load image', 'error');
        };
        
        img.src = e.target.result;
      };
      
      reader.onerror = () => {
        this.showToast('Failed to read file', 'error');
      };
      
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error loading image:', error);
      this.showToast('Error loading image', 'error');
    }
  }

  async generateFavicons() {
    if (this.isGenerating) {
      this.showToast('Generation in progress...', 'error');
      return;
    }

    if (!this.currentImage) {
      this.showToast('Please select an image first', 'error');
      return;
    }

    if (this.activeFormats.size === 0) {
      this.showToast('Please select at least one output format', 'error');
      return;
    }

    const strategy = document.getElementById('strategySelect').value;
    const sizes = [...this.strategies[strategy]];

    if (sizes.length === 0) {
      this.showToast('No sizes selected', 'error');
      return;
    }

    this.isGenerating = true;
    this.showProgress();
    this.generatedFiles.clear();

    const previewGrid = document.getElementById('previewGrid');
    if (previewGrid) previewGrid.innerHTML = '';

    const includeGreyedOut = document.getElementById('includeGreyedOut')?.checked || false;
    const variants = includeGreyedOut ? ['normal', 'greyed'] : ['normal'];

    try {
      const zip = new JSZip();
      let progress = 0;
      const totalOperations = sizes.length * this.activeFormats.size * variants.length;

      // Process each combination with proper async handling
      for (const size of sizes) {
        for (const format of this.activeFormats) {
          for (const variant of variants) {
            try {
              const result = await this.createIcon(size, format, variant);
              
              if (result) {
                this.generatedFiles.set(`${size}-${format}-${variant}`, result);
                zip.file(result.filename, result.data);
                this.addPreviewItem(size, format, variant, result.dataUrl);
              }
              
              progress++;
              this.updateProgress((progress / totalOperations) * 100);
              
              // Yield control to prevent browser freeze
              if (progress % 3 === 0) {
                await new Promise(resolve => setTimeout(resolve, 10));
              }
            } catch (error) {
              console.error(`Error generating ${size}px ${format} ${variant}:`, error);
            }
          }
        }
      }

      // Generate ZIP file
      const zipBlob = await zip.generateAsync({ 
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });
      
      const zipUrl = URL.createObjectURL(zipBlob);
      
      const downloadBtn = document.getElementById('downloadBtn');
      if (downloadBtn) {
        downloadBtn.href = zipUrl;
        downloadBtn.download = 'favicons.zip';
        downloadBtn.style.display = 'inline-flex';
      }
      
      this.hideProgress();
      this.showPreview();
      this.generateHtmlCode();
      
      this.showToast(`Generated ${this.generatedFiles.size} favicon files!`);
    } catch (error) {
      console.error('Error during generation:', error);
      this.showToast('Error generating favicons', 'error');
      this.hideProgress();
    } finally {
      this.isGenerating = false;
    }
  }

  createIcon(size, format, variant) {
    return new Promise((resolve, reject) => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = size;
        canvas.height = size;

        // Clear canvas
        ctx.clearRect(0, 0, size, size);

        // Apply greyscale filter if needed
        if (variant === 'greyed') {
          ctx.filter = 'grayscale(100%) opacity(0.5)';
        }

        // Draw image with proper scaling
        ctx.drawImage(this.currentImage, 0, 0, size, size);

        const filename = this.getFilename(size, format, variant);
        const mimeType = this.getMimeType(format);

        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Failed to create blob'));
            return;
          }

          const reader = new FileReader();
          reader.onload = () => {
            resolve({
              filename,
              data: reader.result,
              dataUrl: canvas.toDataURL(mimeType, 0.9)
            });
          };
          reader.onerror = () => reject(new Error('Failed to read blob'));
          reader.readAsArrayBuffer(blob);
        }, mimeType, 0.9);
      } catch (error) {
        reject(error);
      }
    });
  }

  getFilename(size, format, variant) {
    const customFilename = document.getElementById('customFilenameInput')?.value || 'favicon';
    const path = this.selectedPath;
    const variantSuffix = variant === 'greyed' ? '-disabled' : '';
    
    let filename;
    if (format === 'ico' && size === 16) {
      filename = `${customFilename}${variantSuffix}.ico`;
    } else {
      filename = `${customFilename}-${size}x${size}${variantSuffix}.${format}`;
    }
    
    return path ? `${path}${filename}` : filename;
  }

  getMimeType(format) {
    const mimeTypes = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      webp: 'image/webp',
      svg: 'image/svg+xml',
      ico: 'image/png' // Use PNG for ICO compatibility
    };
    return mimeTypes[format] || 'image/png';
  }

  addPreviewItem(size, format, variant, dataUrl) {
    const previewGrid = document.getElementById('previewGrid');
    if (!previewGrid) return;
    
    const item = document.createElement('div');
    item.className = 'preview-item';
    
    const variantLabel = variant === 'greyed' ? '<div class="variant-label">Disabled</div>' : '';
    
    item.innerHTML = `
      <img src="${dataUrl}" alt="${size}px ${format}" loading="lazy">
      <div class="size-label">${size}×${size}</div>
      <div class="format-label">${format.toUpperCase()}</div>
      ${variantLabel}
    `;
    
    previewGrid.appendChild(item);
  }

  generateHtmlCode() {
    const customFilename = document.getElementById('customFilenameInput')?.value || 'favicon';
    const path = this.selectedPath;
    const strategy = document.getElementById('strategySelect').value;
    const sizes = this.strategies[strategy];
    const includeGreyedOut = document.getElementById('includeGreyedOut')?.checked || false;

    let htmlCode = '<!-- Favicon Links -->\n';
    
    // Standard favicon
    htmlCode += `<link rel="icon" type="image/x-icon" href="${path}${customFilename}.ico">\n`;
    
    // Size-specific favicons
    for (const format of this.activeFormats) {
      if (format === 'ico') continue;
      
      for (const size of sizes) {
        const mimeType = this.getMimeType(format);
        htmlCode += `<link rel="icon" type="${mimeType}" sizes="${size}x${size}" href="${path}${customFilename}-${size}x${size}.${format}">\n`;
      }
    }
    
    // Apple touch icons
    if (this.activeFormats.has('png') && sizes.includes(180)) {
      htmlCode += `<link rel="apple-touch-icon" href="${path}${customFilename}-180x180.png">\n`;
    }
    
    // Theme color
    htmlCode += '<meta name="theme-color" content="#667eea">';
    
    const htmlCodeOutput = document.getElementById('htmlCodeOutput');
    if (htmlCodeOutput) {
      htmlCodeOutput.value = htmlCode;
    }
    
    const htmlCodeSection = document.getElementById('htmlCodeSection');
    if (htmlCodeSection) {
      htmlCodeSection.style.display = 'block';
    }
  }

  copyHtmlCode() {
    const htmlCodeOutput = document.getElementById('htmlCodeOutput');
    const copyBtn = document.getElementById('copyCodeBtn');
    
    if (!htmlCodeOutput || !copyBtn) return;
    
    htmlCodeOutput.select();
    document.execCommand('copy');
    
    const originalText = copyBtn.innerHTML;
    copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
    copyBtn.classList.add('copied');
    
    setTimeout(() => {
      copyBtn.innerHTML = originalText;
      copyBtn.classList.remove('copied');
    }, 2000);
    
    this.showToast('HTML code copied to clipboard!');
  }

  showProgress() {
    const progressBar = document.getElementById('progressBar');
    if (progressBar) {
      progressBar.style.display = 'block';
      this.updateProgress(0);
    }
  }

  updateProgress(percentage) {
    const progressFill = document.getElementById('progressFill');
    if (progressFill) {
      progressFill.style.width = `${Math.min(100, Math.max(0, percentage))}%`;
    }
  }

  hideProgress() {
    const progressBar = document.getElementById('progressBar');
    if (progressBar) {
      progressBar.style.display = 'none';
    }
  }

  showPreview() {
    const previewSection = document.getElementById('previewSection');
    if (previewSection) {
      previewSection.style.display = 'block';
      previewSection.scrollIntoView({ behavior: 'smooth' });
    }
  }

  showToast(message, type = 'success') {
    // Remove existing toast
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
      existingToast.remove();
    }

    // Create new toast
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // Show toast
    setTimeout(() => toast.classList.add('show'), 100);
    
    // Hide toast after 3 seconds
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.remove();
        }
      }, 300);
    }, 3000);
  }
}

// Initialize the favicon generator when the page loads
document.addEventListener('DOMContentLoaded', () => {
  try {
    new FaviconGenerator();
  } catch (error) {
    console.error('Failed to initialize FaviconGenerator:', error);
  }
});