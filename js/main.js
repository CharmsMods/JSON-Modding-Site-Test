// main.js
import { showLoader, hideLoader, fileToBase64, getImageDimensionsFromBase64 } from './utils.js';
import { loadZip, saveSession, loadSession, updateAssetData, getAssetType, getAssetBase64Data, getAllAssets, getAssetPath } from './fileLoader.js';
import { exportModAsZip, exportModAsFolder } from './exportImport.js';

let currentSelectedAssets = new Set(); // Stores asset IDs

// DOM Elements
const zipFileInput = document.getElementById('zipFileInput');
const fileNameDisplay = document.getElementById('fileNameDisplay');
const loadZipButton = document.getElementById('loadZipButton');
const assetList = document.getElementById('assetList');
const exportModButton = document.getElementById('exportModButton');
const saveSessionButton = document.getElementById('saveSessionButton');
const loadSessionButton = document.getElementById('loadSessionButton');
const clearAllButton = document.getElementById('clearAllButton');
const selectAllButton = document.getElementById('selectAllButton');
const deselectAllButton = document.getElementById('deselectAllButton');
const toggleExclusionButton = document.getElementById('toggleExclusionButton');
const selectedCountSpan = document.getElementById('selectedCount');
const assetManagementSection = document.getElementById('assetManagement');

// Modals
const replaceModal = document.getElementById('replaceModal');
const replaceModalCloseButton = replaceModal.querySelector('.close-button');
const modalAssetInfo = document.getElementById('modalAssetInfo');
const replaceFileInput = document.getElementById('replaceFileInput');
const replaceFileNameDisplay = document.getElementById('replaceFileNameDisplay');
const confirmReplaceButton = document.getElementById('confirmReplaceButton');

// Image Edit Controls
const imageEditControls = document.getElementById('imageEditControls');
const brightnessSlider = document.getElementById('brightnessSlider');
const brightnessValueSpan = document.getElementById('brightnessValue');
const contrastSlider = document.getElementById('contrastSlider');
const contrastValueSpan = document.getElementById('contrastValue');
const saturationSlider = document.getElementById('saturationSlider');
const saturationValueSpan = document.getElementById('saturationValue');
const colorFillPicker = document.getElementById('colorFillPicker');
const applyEditsButton = document.getElementById('applyEditsButton');

// Audio Edit Controls
const audioEditControls = document.getElementById('audioEditControls');

const exportOptionsModal = document.getElementById('exportOptionsModal');
const exportOptionsCloseButton = exportOptionsModal.querySelector('.close-button');
const startExportButton = document.getElementById('startExportButton');

// Image processing canvas
const imageProcessingCanvas = document.getElementById('imageProcessingCanvas');
const ctx = imageProcessingCanvas.getContext('2d');

let currentEditingAssetId = null; // Stores the ID of the asset currently being edited in the modal
let originalBase64Image = null; // Stores the original base64 data for image edits
let currentBase64Image = null; // Stores the current base64 data after applying edits (not yet committed to fileLoader)

// --- Event Listeners ---

zipFileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        fileNameDisplay.textContent = file.name;
    } else {
        fileNameDisplay.textContent = 'No file chosen';
    }
});

loadZipButton.addEventListener('click', async () => {
    const file = zipFileInput.files[0];
    if (!file) {
        alert('Please select a ZIP file first.');
        return;
    }

    if (file.type !== 'application/zip') {
        alert('Please upload a valid ZIP file.');
        return;
    }

    showLoader('Loading Venge.io files...');
    try {
        await loadZip(file);
        renderAssetList();
        assetManagementSection.classList.remove('hidden');
        alert('Files loaded successfully!');
    } catch (error) {
        console.error('Error loading ZIP:', error);
        alert('Failed to load ZIP file. Please ensure it\'s a valid Venge.io client ZIP.');
    } finally {
        hideLoader();
    }
});

assetList.addEventListener('click', (event) => {
    const assetCard = event.target.closest('.asset-card');
    if (!assetCard) return;

    const assetId = assetCard.dataset.id;

    // Handle clicks on specific buttons/elements within the card
    if (event.target.classList.contains('select-button')) {
        toggleAssetSelection(assetId);
    } else if (event.target.classList.contains('replace-button')) {
        openReplaceModal(assetId);
    } else if (event.target.classList.contains('reset-button')) {
        if (confirm('Are you sure you want to reset this asset to its original state?')) {
            resetAsset(assetId);
        }
    } else {
        // Allow clicking anywhere else on the card to toggle selection
        toggleAssetSelection(assetId);
    }
});

replaceModalCloseButton.addEventListener('click', () => {
    closeReplaceModal();
});

// Close modal when clicking outside
window.addEventListener('click', (event) => {
    if (event.target === replaceModal) {
        closeReplaceModal();
    }
    if (event.target === exportOptionsModal) {
        closeExportOptionsModal();
    }
});

replaceFileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        replaceFileNameDisplay.textContent = file.name;
        // If a file is uploaded, disable color fill and brightness/contrast/saturation
        brightnessSlider.disabled = true;
        contrastSlider.disabled = true;
        saturationSlider.disabled = true;
        colorFillPicker.disabled = true;
    } else {
        replaceFileNameDisplay.textContent = 'No file chosen';
        // Re-enable image edit controls if no file is chosen
        brightnessSlider.disabled = false;
        contrastSlider.disabled = false;
        saturationSlider.disabled = false;
        colorFillPicker.disabled = false;
    }
});

brightnessSlider.addEventListener('input', () => {
    brightnessValueSpan.textContent = `${brightnessSlider.value}%`;
});
contrastSlider.addEventListener('input', () => {
    contrastValueSpan.textContent = `${contrastSlider.value}%`;
});
saturationSlider.addEventListener('input', () => {
    saturationValueSpan.textContent = `${saturationSlider.value}%`;
});


applyEditsButton.addEventListener('click', async () => {
    if (!currentEditingAssetId) return;

    showLoader('Applying image edits...');
    try {
        const file = replaceFileInput.files[0];
        let base64ToProcess = originalBase64Image;

        if (file) {
            // If a new file is provided, use it for processing
            base64ToProcess = await fileToBase64(file);
        } else if (colorFillPicker.value && getAssetType(currentEditingAssetId) === 'image') {
            // If color fill is selected and no new file, generate a colored image
            const dimensions = await getImageDimensionsFromBase64(originalBase64Image);
            base64ToProcess = createColorFillImage(colorFillPicker.value, dimensions.width, dimensions.height);
        }

        // Apply filters only if it's an image and no new file was chosen (or if file is also an image)
        if (getAssetType(currentEditingAssetId) === 'image' && base64ToProcess) {
            const brightness = parseFloat(brightnessSlider.value) / 100; // 0 to 2
            const contrast = parseFloat(contrastSlider.value) / 100;     // 0 to 2
            const saturation = parseFloat(saturationSlider.value) / 100; // 0 to 2

            currentBase64Image = await applyImageFilters(base64ToProcess, brightness, contrast, saturation);
        } else {
            currentBase64Image = base64ToProcess; // No filters if audio or new file directly replaces
        }

        // Update the preview in the modal
        const previewImg = replaceModal.querySelector('.asset-preview img');
        if (previewImg && currentBase64Image) {
            previewImg.src = currentBase64Image;
        }

        alert('Edits applied to preview. Click "Confirm Replacement" to finalize.');

    } catch (error) {
        console.error('Error applying edits:', error);
        alert('Failed to apply edits: ' + error.message);
    } finally {
        hideLoader();
    }
});


confirmReplaceButton.addEventListener('click', async () => {
    if (!currentEditingAssetId) return;

    showLoader('Confirming replacement...');
    try {
        const file = replaceFileInput.files[0];
        let newBase64Data = null;
        let newAssetType = null;

        if (file) {
            // If a file was uploaded, use it directly (or its processed version if image filters applied)
            newBase64Data = currentBase64Image || await fileToBase64(file);
            newAssetType = file.type.startsWith('image/') ? 'image' : 'audio'; // Determine type from uploaded file
        } else if (getAssetType(currentEditingAssetId) === 'image' && (brightnessSlider.value !== '100' || contrastSlider.value !== '100' || saturationSlider.value !== '100' || colorFillPicker.value !== '#ffffff')) {
            // If no new file, but image edits were made, use the currentBase64Image
            newBase64Data = currentBase64Image;
            newAssetType = 'image';
        } else {
            alert('No changes detected for replacement.');
            hideLoader();
            return;
        }

        // Ensure we have base64 data to proceed
        if (!newBase64Data) {
            throw new Error('No valid data to replace asset with.');
        }

        // Update asset data in fileLoader.js
        updateAssetData(currentEditingAssetId, newBase64Data, newAssetType);

        // Update the asset card in the UI
        const assetCard = document.querySelector(`.asset-card[data-id="${currentEditingAssetId}"]`);
        if (assetCard) {
            const previewElement = assetCard.querySelector('.asset-preview');
            if (newAssetType === 'image') {
                previewElement.innerHTML = `<img src="${newBase64Data}" alt="Asset Preview">`;
            } else if (newAssetType === 'audio') {
                previewElement.innerHTML = `<audio controls src="${newBase64Data}"></audio>`;
            }
            assetCard.classList.add('replaced'); // Mark as replaced
            assetCard.querySelector('.asset-status').textContent = 'Status: Replaced';
        }

        alert('Asset replaced successfully!');
        closeReplaceModal();
    } catch (error) {
        console.error('Error confirming replacement:', error);
        alert('Failed to confirm replacement: ' + error.message);
    } finally {
        hideLoader();
    }
});


exportModButton.addEventListener('click', () => {
    openExportOptionsModal();
});

exportOptionsCloseButton.addEventListener('click', () => {
    closeExportOptionsModal();
});

startExportButton.addEventListener('click', async () => {
    closeExportOptionsModal();
    showLoader('Exporting mod...');

    const exportFormat = document.querySelector('input[name="exportFormat"]:checked').value;
    const exportTarget = document.querySelector('input[name="exportTarget"]:checked').value;

    try {
        if (exportFormat === 'zip') {
            await exportModAsZip(exportTarget);
        } else if (exportFormat === 'folder') {
            await exportModAsFolder(exportTarget);
        }
        alert('Mod exported successfully!');
    } catch (error) {
        console.error('Error exporting mod:', error);
        alert('Failed to export mod: ' + error.message);
    } finally {
        hideLoader();
    }
});

saveSessionButton.addEventListener('click', () => {
    if (confirm('This will save the current state of your loaded files and modifications to your browser. You can load it later.')) {
        try {
            saveSession();
            alert('Session saved successfully!');
        } catch (error) {
            console.error('Error saving session:', error);
            alert('Failed to save session.');
        }
    }
});

loadSessionButton.addEventListener('click', async () => {
    if (confirm('This will load a previously saved session, overwriting any current unsaved work. Continue?')) {
        showLoader('Loading session...');
        try {
            await loadSession();
            renderAssetList();
            assetManagementSection.classList.remove('hidden');
            alert('Session loaded successfully!');
        } catch (error) {
            console.error('Error loading session:', error);
            alert('Failed to load session. No saved session found or data is corrupted.');
        } finally {
            hideLoader();
        }
    }
});

clearAllButton.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all loaded assets and modifications? This cannot be undone.')) {
        // Implement logic to clear all assets from fileLoader
        // For now, let's just clear the UI and state
        currentSelectedAssets.clear();
        assetList.innerHTML = '';
        selectedCountSpan.textContent = '0 selected';
        assetManagementSection.classList.add('hidden');
        // A full clear would involve resetting the internal state of fileLoader as well
        alert('All assets cleared.');
    }
});

selectAllButton.addEventListener('click', () => {
    const assetCards = assetList.querySelectorAll('.asset-card');
    assetCards.forEach(card => {
        const id = card.dataset.id;
        if (!currentSelectedAssets.has(id)) {
            currentSelectedAssets.add(id);
            card.classList.add('selected');
        }
    });
    updateSelectedCount();
});

deselectAllButton.addEventListener('click', () => {
    const assetCards = assetList.querySelectorAll('.asset-card');
    assetCards.forEach(card => {
        const id = card.dataset.id;
        if (currentSelectedAssets.has(id)) {
            currentSelectedAssets.delete(id);
            card.classList.remove('selected');
        }
    });
    updateSelectedCount();
});

toggleExclusionButton.addEventListener('click', () => {
    if (currentSelectedAssets.size === 0) {
        alert('Please select assets to toggle their exclusion status.');
        return;
    }

    const firstAssetId = currentSelectedAssets.values().next().value;
    const isCurrentlyExcluded = document.querySelector(`.asset-card[data-id="${firstAssetId}"]`).classList.contains('excluded');

    currentSelectedAssets.forEach(id => {
        const assetCard = document.querySelector(`.asset-card[data-id="${id}"]`);
        if (assetCard) {
            if (isCurrentlyExcluded) {
                assetCard.classList.remove('excluded');
                assetCard.querySelector('.asset-status').textContent = 'Status: Active';
            } else {
                assetCard.classList.add('excluded');
                assetCard.querySelector('.asset-status').textContent = 'Status: Excluded';
            }
        }
    });
    alert(`Selected assets are now ${isCurrentlyExcluded ? 'included' : 'excluded'} from export.`);
});

// --- Functions ---

function renderAssetList() {
    assetList.innerHTML = '';
    const allAssets = getAllAssets();
    allAssets.forEach(asset => {
        const assetCard = document.createElement('div');
        assetCard.classList.add('asset-card');
        assetCard.dataset.id = asset.id;

        const assetType = getAssetType(asset.id);
        const base64Data = getAssetBase64Data(asset.id);

        let previewHTML = '';
        if (assetType === 'image' && base64Data) {
            previewHTML = `<img src="${base64Data}" alt="Asset Preview">`;
        } else if (assetType === 'audio' && base64Data) {
            previewHTML = `<audio controls src="${base64Data}"></audio>`;
        } else {
            previewHTML = `<div class="no-preview">No preview available</div>`;
        }

        const isReplaced = asset.isReplaced ? 'replaced' : '';
        const isExcluded = asset.isExcluded ? 'excluded' : '';
        const statusText = asset.isReplaced ? 'Replaced' : (asset.isExcluded ? 'Excluded' : 'Active');

        assetCard.innerHTML = `
            <div class="asset-preview ${isReplaced}">
                ${previewHTML}
            </div>
            <div class="asset-info">
                <h3>${asset.name}</h3>
                <p>Path: ${asset.path}</p>
                <p>Type: ${assetType}</p>
                <p class="asset-status">Status: ${statusText}</p>
            </div>
            <div class="asset-actions">
                <button class="select-button">Select</button>
                <button class="replace-button">Replace</button>
                <button class="reset-button">Reset</button>
            </div>
        `;
        assetList.appendChild(assetCard);

        if (currentSelectedAssets.has(asset.id)) {
            assetCard.classList.add('selected');
        }
    });
    updateSelectedCount();
}

function toggleAssetSelection(assetId) {
    const assetCard = document.querySelector(`.asset-card[data-id="${assetId}"]`);
    if (currentSelectedAssets.has(assetId)) {
        currentSelectedAssets.delete(assetId);
        assetCard.classList.remove('selected');
    } else {
        currentSelectedAssets.add(assetId);
        assetCard.classList.add('selected');
    }
    updateSelectedCount();
}

function updateSelectedCount() {
    selectedCountSpan.textContent = `${currentSelectedAssets.size} selected`;
}

async function openReplaceModal(assetId) {
    currentEditingAssetId = assetId;
    replaceFileInput.value = ''; // Clear previous file selection
    replaceFileNameDisplay.textContent = 'No file chosen';
    brightnessSlider.value = 100;
    brightnessValueSpan.textContent = '100%';
    contrastSlider.value = 100;
    contrastValueSpan.textContent = '100%';
    saturationSlider.value = 100;
    saturationValueSpan.textContent = '100%';
    colorFillPicker.value = '#ffffff';

    // Re-enable image edit controls by default
    brightnessSlider.disabled = false;
    contrastSlider.disabled = false;
    saturationSlider.disabled = false;
    colorFillPicker.disabled = false;


    const asset = getAllAssets().find(a => a.id === assetId);
    if (!asset) {
        alert('Asset not found.');
        return;
    }

    modalAssetInfo.innerHTML = `
        <h3>Editing: ${asset.name}</h3>
        <p>Path: ${asset.path}</p>
        <p>Type: ${getAssetType(assetId)}</p>
        <div class="asset-preview">
            ${getAssetType(assetId) === 'image' ? `<img src="${getAssetBase64Data(assetId)}" alt="Current Asset Preview">` :
             getAssetType(assetId) === 'audio' ? `<audio controls src="${getAssetBase64Data(assetId)}"></audio>` :
             `<div class="no-preview">No preview available</div>`}
        </div>
    `;

    // Show/hide image/audio controls based on asset type
    if (getAssetType(assetId) === 'image') {
        imageEditControls.classList.remove('hidden');
        audioEditControls.classList.add('hidden');
        originalBase64Image = getAssetBase64Data(assetId);
        currentBase64Image = originalBase64Image; // Initialize current with original
    } else if (getAssetType(assetId) === 'audio') {
        imageEditControls.classList.add('hidden');
        audioEditControls.classList.remove('hidden');
        originalBase64Image = null; // Clear image specific state
        currentBase64Image = null;
    } else {
        imageEditControls.classList.add('hidden');
        audioEditControls.classList.add('hidden');
        originalBase64Image = null;
        currentBase64Image = null;
    }

    replaceModal.classList.add('active');
}

function closeReplaceModal() {
    replaceModal.classList.remove('active');
    currentEditingAssetId = null;
    originalBase64Image = null;
    currentBase64Image = null;
    replaceFileInput.value = ''; // Clear file input
    replaceFileNameDisplay.textContent = 'No file chosen';
    // Hide controls when closing
    imageEditControls.classList.add('hidden');
    audioEditControls.classList.add('hidden');
}

async function resetAsset(assetId) {
    showLoader('Resetting asset...');
    try {
        const success = updateAssetData(assetId, null, null, true); // Pass true to indicate reset
        if (success) {
            const assetCard = document.querySelector(`.asset-card[data-id="${assetId}"]`);
            if (assetCard) {
                assetCard.classList.remove('replaced', 'excluded');
                assetCard.querySelector('.asset-status').textContent = 'Status: Active';
                // Re-render preview based on original asset
                const asset = getAllAssets().find(a => a.id === assetId);
                const previewElement = assetCard.querySelector('.asset-preview');
                if (asset.type === 'image' && asset.originalBase64Data) {
                    previewElement.innerHTML = `<img src="${asset.originalBase64Data}" alt="Asset Preview">`;
                } else if (asset.type === 'audio' && asset.originalBase64Data) {
                    previewElement.innerHTML = `<audio controls src="${asset.originalBase64Data}"></audio>`;
                } else {
                    previewElement.innerHTML = `<div class="no-preview">No preview available</div>`;
                }
            }
            alert('Asset reset to original successfully!');
        } else {
            alert('Failed to reset asset.');
        }
    } catch (error) {
        console.error('Error resetting asset:', error);
        alert('Error resetting asset: ' + error.message);
    } finally {
        hideLoader();
    }
}

function openExportOptionsModal() {
    exportOptionsModal.classList.add('active');
}

function closeExportOptionsModal() {
    exportOptionsModal.classList.remove('active');
}

/**
 * Applies brightness, contrast, and saturation filters to an image using canvas.
 * @param {string} base64Data - The input image as a Base64 data URL.
 * @param {number} brightness - Brightness multiplier (e.g., 1.0 for original, 0.5 for half, 2.0 for double).
 * @param {number} contrast - Contrast multiplier (e.g., 1.0 for original, 0.5 for half, 2.0 for double).
 * @param {number} saturation - Saturation multiplier (e.g., 1.0 for original, 0.5 for half, 2.0 for double).
 * @returns {Promise<string>} A promise that resolves with the filtered image as a Base64 data URL.
 */
async function applyImageFilters(base64Data, brightness, contrast, saturation) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            imageProcessingCanvas.width = img.width;
            imageProcessingCanvas.height = img.height;
            ctx.clearRect(0, 0, imageProcessingCanvas.width, imageProcessingCanvas.height);
            ctx.drawImage(img, 0, 0);

            let imageData = ctx.getImageData(0, 0, imageProcessingCanvas.width, imageProcessingCanvas.height);
            let pixels = imageData.data;
            const length = pixels.length;

            // Apply filters pixel by pixel
            for (let i = 0; i < length; i += 4) {
                let r = pixels[i];
                let g = pixels[i + 1];
                let b = pixels[i + 2];

                // Brightness
                r = r * brightness;
                g = g * brightness;
                b = b * brightness;

                // Contrast
                // Algorithm from: https://stackoverflow.com/questions/10521978/html5-canvas-image-contrast
                const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));
                r = factor * (r - 128) + 128;
                g = factor * (g - 128) + 128;
                b = factor * (b - 128) + 128;

                // Saturation
                // Algorithm from: https://stackoverflow.com/questions/9294437/javascript-image-saturation
                const L = 0.3086 * r + 0.6094 * g + 0.0820 * b; // Luminance
                r = L + saturation * (r - L);
                g = L + saturation * (g - L);
                b = L + saturation * (b - L);

                // Clamp values to 0-255
                pixels[i] = Math.min(255, Math.max(0, r));
                pixels[i + 1] = Math.min(255, Math.max(0, g));
                pixels[i + 2] = Math.min(255, Math.max(0, b));
            }

            ctx.putImageData(imageData, 0, 0);
            resolve(imageProcessingCanvas.toDataURL());
        };
        img.onerror = (error) => {
            reject(new Error('Failed to load image for filter application: ' + error.message));
        };
        img.src = base64Data;
    });
}

/**
 * Creates a new image as a Base64 data URL filled with a solid color.
 * @param {string} color - The CSS color string (e.g., '#RRGGBB').
 * @param {number} width - The width of the new image.
 * @param {number} height - The height of the new image.
 * @returns {string} The Base64 data URL of the color-filled image.
 */
function createColorFillImage(color, width, height) {
    imageProcessingCanvas.width = width;
    imageProcessingCanvas.height = height;
    ctx.clearRect(0, 0, width, height); // Clear previous content
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);
    return imageProcessingCanvas.toDataURL();
}