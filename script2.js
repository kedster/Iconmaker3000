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
      downloadBtn: document.getElementById('downloadBtn'),
      pathSelect: document.getElementById('pathSelect'),
      customPathInput: document.getElementById('customPathInput'),
      copyCodeBtn: document.getElementById('copyCodeBtn')
    };

    // File input and drag & drop
    elements.imageInput.addEventListener('change', (e) => this.handleFileSelect(e));
    elements.uploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
    elements.uploadArea.addEventListener('dragleave', (e) => this.handleDragLeave(e));
    elements.uploadArea.addEventListener('drop', (e) => this.handleDrop(e));

    // Strategy selection
    elements.strategySelect.addEventListener('change', (e) => this.handleStrategyChange(e));
    elements.customSizesInput.addEventListener('input', (e) => this.handleCustomSizes(e));

    // Path selection
    elements.pathSelect.addEventListener('change', (e) => this.handlePathChange(e));
    elements.customPathInput.addEventListener('input', (e) => this.handleCustomPathInput(e));

    // Format selection
    elements.formatBtns.forEach(btn => {
      btn.addEventListener('click', () => this.toggleFormat(btn));
    });

    // Generate button
    elements.generateBtn.addEventListener('click', () => this.generateFavicons());

    // Copy code button
    elements.copyCodeBtn.addEventListener('click', () => this.copyHtmlCode());
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

    const includeGreyedOut = document.getElementById('includeGreyedOut').checked;
    const variants = includeGreyedOut ? ['normal', 'greyed'] : ['normal'];

    let progress = 0;
    const totalOperations = sizes.length * this.activeFormats.size * variants.length;

    for (let i = 0; i < sizes.length; i++) {
      const size = sizes[i];
      
      for (const format of this.activeFormats) {
        for (const variant of variants) {
          try {
            const result = await this.createIcon(size, format, variant);
            
            if (result) {
              this.generatedFiles.set(`${size}-${format}-${variant}`, result);
              iconsFolder.file(result.filename, result.data, result.options || {});
              this.addPreviewItem(size, format, variant, result.dataUrl);
            }
            
            progress++;
            this.updateProgress((progress / totalOperations) * 100);
            
            // Small delay to prevent UI blocking
            await new Promise(resolve => setTimeout(resolve, 10));
          } catch (error) {
            console.error(`Error generating ${size}px ${format} ${variant}:`, error);
          }
        }
      }
    }