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
        
        this.initializeEventListeners();
      }

      initializeEventListeners() {
        const elements = {
          imageInput: document.getElementById('imageInput'),
          uploadArea: document.querySelector('.upload-area'),
          generateBtn: document.getElementById('generateBtn'),
          strategySelect: document.getElementById('strategySelect'),
          customSizesInput: document.getElementById('customSizesInput'),
          formatBtns: document.querySelectorAll('.format-btn'),
          downloadBtn: document.getElementById('downloadBtn')
        };

        // File input and drag & drop
        elements.imageInput.addEventListener('change', (e) => this.handleFileSelect(e));
        elements.uploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
        elements.uploadArea.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        elements.uploadArea.addEventListener('drop', (e) => this.handleDrop(e));

        // Strategy selection
        elements.strategySelect.addEventListener('change', (e) => this.handleStrategyChange(e));
        elements.customSizesInput.addEventListener('input', (e) => this.handleCustomSizes(e));

        // Format selection
        elements.formatBtns.forEach(btn => {
          btn.addEventListener('click', () => this.toggleFormat(btn));
        });

        // Generate button
        elements.generateBtn.addEventListener('click', () => this.generateFavicons());
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

      updateCustomSizes() {
        const input = document.getElementById('customSizesInput');
        const sizes = input.value.split(',')
          .map(s => parseInt(s.trim()))
          .filter(s => s > 0 && s <= 2048);
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

        const img = new Image();
        img.src = URL.createObjectURL(file);
        
        img.onload = () => {
          this.currentImage = img;
          this.showToast('Image loaded successfully!');
          document.getElementById('generateBtn').disabled = false;
        };

        img.onerror = () => {
          this.showToast('Failed to load image', 'error');
        };
      }

      async generateFavicons() {
        if (!this.currentImage) {
          this.showToast('Please select an image first', 'error');
          return;
        }

        if (this.activeFormats.size === 0) {
          this.showToast('Please select at least one output format', 'error');
          return;
        }

        const strategy = document.getElementById('strategySelect').value;
        const sizes = this.strategies[strategy];

        if (sizes.length === 0) {
          this.showToast('No sizes selected', 'error');
          return;
        }

        this.showProgress();
        this.generatedFiles.clear();

        const zip = new JSZip();
        const iconsFolder = zip.folder('favicons');
        const previewGrid = document.getElementById('previewGrid');
        previewGrid.innerHTML = '';

        let progress = 0;
        const totalOperations = sizes.length * this.activeFormats.size;

        for (let i = 0; i < sizes.length; i++) {
          const size = sizes[i];
          
          for (const format of this.activeFormats) {
            try {
              const result = await this.createIcon(size, format);
              
              if (result) {
                this.generatedFiles.set(`${size}-${format}`, result);
                iconsFolder.file(result.filename, result.data, result.options || {});
                this.addPreviewItem(size, format, result.dataUrl);
              }
              
              progress++;
              this.updateProgress((progress / totalOperations) * 100);
              
              // Small delay to prevent UI blocking
              await new Promise(resolve => setTimeout(resolve, 10));
            } catch (error) {
              console.error(`Error generating ${size}px ${format}:`, error);
            }
          }
        }

        // Generate ZIP
        try {
          const zipBlob = await zip.generateAsync({ 
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
          });
          
          const zipUrl = URL.createObjectURL(zipBlob);
          const downloadBtn = document.getElementById('downloadBtn');
          downloadBtn.href = zipUrl;
          downloadBtn.download = 'favicons.zip';
          downloadBtn.style.display = 'inline-flex';
          
          document.getElementById('previewSection').style.display = 'block';
          this.hideProgress();
          this.showToast(`Generated ${this.generatedFiles.size} favicon files!`);
        } catch (error) {
          this.hideProgress();
          this.showToast('Error creating ZIP file', 'error');
          console.error('ZIP generation error:', error);
        }
      }

      async createIcon(size, format) {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        
        // High-quality scaling
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // Draw with proper aspect ratio handling
        const scale = Math.min(size / this.currentImage.width, size / this.currentImage.height);
        const scaledWidth = this.currentImage.width * scale;
        const scaledHeight = this.currentImage.height * scale;
        const x = (size - scaledWidth) / 2;
        const y = (size - scaledHeight) / 2;
        
        ctx.drawImage(this.currentImage, x, y, scaledWidth, scaledHeight);

        let filename, data, dataUrl, options;

        switch (format) {
          case 'png':
            dataUrl = canvas.toDataURL('image/png');
            filename = `favicon-${size}x${size}.png`;
            data = dataUrl.split(',')[1];
            options = { base64: true };
            break;
            
          case 'webp':
            dataUrl = canvas.toDataURL('image/webp', 0.9);
            filename = `favicon-${size}x${size}.webp`;
            data = dataUrl.split(',')[1];
            options = { base64: true };
            break;
            
          case 'ico':
            // For ICO, we'll use PNG data but with .ico extension
            dataUrl = canvas.toDataURL('image/png');
            filename = size === 32 ? 'favicon.ico' : `favicon-${size}x${size}.ico`;
            data = dataUrl.split(',')[1];
            options = { base64: true };
            break;
            
          case 'svg':
            // For SVG, we'll embed the PNG as base64 (simplified approach)
            dataUrl = canvas.toDataURL('image/png');
            const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
              <image href="${dataUrl}" width="${size}" height="${size}"/>
            </svg>`;
            filename = `favicon-${size}x${size}.svg`;
            data = svgContent;
            options = {};
            break;
            
          default:
            return null;
        }

        return { filename, data, dataUrl, options };
      }

      addPreviewItem(size, format, dataUrl) {
        const previewGrid = document.getElementById('previewGrid');
        const item = document.createElement('div');
        item.className = 'preview-item';
        
        item.innerHTML = `
          <img src="${dataUrl}" alt="${size}x${size} ${format}" />
          <div class="size-label">${size}×${size}</div>
          <div class="format-label">${format.toUpperCase()}</div>
        `;
        
        previewGrid.appendChild(item);
      }

      showProgress() {
        document.getElementById('progressBar').style.display = 'block';
        document.getElementById('generateBtn').innerHTML = '<div class="loading-spinner"></div> Generating...';
        document.getElementById('generateBtn').disabled = true;
      }

      hideProgress() {
        document.getElementById('progressBar').style.display = 'none';
        document.getElementById('generateBtn').innerHTML = '<i class="fas fa-magic"></i> Generate Favicons';
        document.getElementById('generateBtn').disabled = false;
      }

      updateProgress(percent) {
        document.getElementById('progressFill').style.width = percent + '%';
      }

      showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
          <div style="display: flex; align-items: center; gap: 10px;">
            <i class="fas fa-${type === 'error' ? 'exclamation-circle' : 'check-circle'}"></i>
            <span>${message}</span>
          </div>
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => toast.classList.add('show'), 100);
        
        setTimeout(() => {
          toast.classList.remove('show');
          setTimeout(() => document.body.removeChild(toast), 300);
        }, 3000);
      }
    }

    // Initialize the application
    document.addEventListener('DOMContentLoaded', () => {
      new FaviconGenerator();
    });