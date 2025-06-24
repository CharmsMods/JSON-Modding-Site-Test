// js/bulkTextureOperations.js

// Import utility functions for image processing
import { applyImageAdjustments, createColorTexture, readFileAsDataURL, convertImageDataURL } from './utils.js';
// Import global state and UI update function from main.js
import { allGameAssets, selectedAssets, updateAssetCardDisplay } from './main.js';

// --- DOM Element References for Modal Controls ---
const bulkOperationsModalOverlay = document.getElementById('bulk-operations-modal-overlay');

// Adjust Texture controls
const saturationSlider = document.getElementById('saturation-slider');
const saturationValueSpan = document.getElementById('saturation-value');
const brightnessSlider = document.getElementById('brightness-slider');
const brightnessValueSpan = document.getElementById('brightness-value');
const contrastSlider = document.getElementById('contrast-slider');
const contrastValueSpan = document.getElementById('contrast-value');
const applyAdjustmentsBtn = document.getElementById('apply-adjustments-btn');

// Make New Texture controls
const colorPicker = document.getElementById('color-picker');
const resolutionSelect = document.getElementById('resolution-select');
const createNewTextureBtn = document.getElementById('create-new-texture-btn');

// Upload New Image controls
const uploadImageInput = document.getElementById('upload-image-input');
const triggerUploadBtn = document.getElementById('trigger-upload-btn');
const uploadedFileNameSpan = document.getElementById('uploaded-file-name');
const applyUploadBtn = document.getElementById('apply-upload-btn');

let uploadedFileDataURL = null; // To store the Data URL of the temporarily uploaded file

// --- Helper Functions ---

/**
 * Resets the modal input fields to their default states.
 * @comment Ensures a clean state each time the modal is opened.
 */
function resetModalInputs() {
    console.log("bulkTextureOperations.js: Resetting modal inputs.");
    // Adjust Texture
    saturationSlider.value = 100;
    saturationValueSpan.textContent = '100%';
    brightnessSlider.value = 100;
    brightnessValueSpan.textContent = '100%';
    contrastSlider.value = 100;
    contrastValueSpan.textContent = '100%';

    // Make New Texture
    colorPicker.value = '#000000';
    resolutionSelect.value = '256x256'; // Default resolution

    // Upload New Image
    uploadImageInput.value = ''; // Clear file input
    uploadedFileDataURL = null;
    uploadedFileNameSpan.textContent = 'No file chosen';

    // Reset button states (important if they were disabled/enabled based on selections)
    applyAdjustmentsBtn.disabled = false;
    createNewTextureBtn.disabled = false;
    applyUploadBtn.disabled = false;
}

/**
 * Gets the asset objects corresponding to the currently selected asset full paths.
 * @returns {Array<object>} An array of asset objects.
 * @comment Filters `allGameAssets` based on `selectedAssets` Set.
 */
function getSelectedAssetObjects() {
    const assets = [];
    selectedAssets.forEach(fullPath => {
        const asset = allGameAssets.find(a => a.fullPath === fullPath);
        if (asset) {
            assets.push(asset);
        }
    });
    console.log(`bulkTextureOperations.js: Found ${assets.length} selected asset objects.`);
    return assets;
}

// --- Event Handlers for Bulk Operations ---

/**
 * Handles applying saturation, brightness, and contrast adjustments to selected image assets.
 * @comment Iterates through selected assets, applies the filter, and updates the UI.
 */
async function handleApplyAdjustments() {
    console.log("bulkTextureOperations.js: Applying adjustments...");
    const selectedImageAssets = getSelectedAssetObjects().filter(asset => asset.assetType === 'image');

    if (selectedImageAssets.length === 0) {
        console.warn("bulkTextureOperations.js: No image assets selected for adjustments.");
        // Consider showing a user-friendly message
        return;
    }

    applyAdjustmentsBtn.disabled = true; // Disable button during processing
    applyAdjustmentsBtn.textContent = 'Applying...';

    const saturation = parseInt(saturationSlider.value);
    const brightness = parseInt(brightnessSlider.value);
    const contrast = parseInt(contrastSlider.value);

    for (const asset of selectedImageAssets) {
        try {
            console.log(`bulkTextureOperations.js: Processing adjustments for ${asset.fileName}`);
            const newAdjustedDataUrl = await applyImageAdjustments(asset.originalDataUrl, { saturation, brightness, contrast });
            updateAssetCardDisplay(asset.fullPath, newAdjustedDataUrl); // Update main grid UI
            console.log(`bulkTextureOperations.js: Adjustments applied to ${asset.fileName}`);
        } catch (error) {
            console.error(`bulkTextureOperations.js: Error applying adjustments to ${asset.fileName}:`, error);
        }
    }
    applyAdjustmentsBtn.disabled = false;
    applyAdjustmentsBtn.textContent = 'Apply Adjustments';
    console.log("bulkTextureOperations.js: All adjustments applied.");
}

/**
 * Handles creating a new texture from a chosen color and resolution for selected image assets.
 * @comment Generates a new image and applies it to selected image assets.
 */
async function handleCreateNewTexture() {
    console.log("bulkTextureOperations.js: Creating new texture...");
    const selectedImageAssets = getSelectedAssetObjects().filter(asset => asset.assetType === 'image');

    if (selectedImageAssets.length === 0) {
        console.warn("bulkTextureOperations.js: No image assets selected for new texture creation.");
        return;
    }

    createNewTextureBtn.disabled = true; // Disable button during processing
    createNewTextureBtn.textContent = 'Creating...';

    const color = colorPicker.value;
    const [width, height] = resolutionSelect.value.split('x').map(Number);
    const commonType = 'image/png'; // Always create new texture as PNG for best quality/transparency

    try {
        const newTextureDataUrl = createColorTexture(color, width, height, commonType);
        console.log(`bulkTextureOperations.js: Generated new texture data URL.`);

        for (const asset of selectedImageAssets) {
            // Convert the newly created texture to the target asset's original type if different
            let finalDataUrl = newTextureDataUrl;
            if (asset.mimeType !== commonType) {
                 // Ensure target dimensions are relevant for conversion if original image had specific size
                const originalImage = new Image();
                originalImage.src = asset.originalDataUrl;
                await new Promise(resolve => originalImage.onload = resolve); // Wait for original image to load for dimensions
                finalDataUrl = await convertImageDataURL(newTextureDataUrl, asset.mimeType, originalImage.width, originalImage.height);
            }
            updateAssetCardDisplay(asset.fullPath, finalDataUrl); // Update main grid UI
            console.log(`bulkTextureOperations.js: Applied new texture to ${asset.fileName}`);
        }
    } catch (error) {
        console.error("bulkTextureOperations.js: Error creating new texture:", error);
    }

    createNewTextureBtn.disabled = false;
    createNewTextureBtn.textContent = 'Create Texture';
    console.log("bulkTextureOperations.js: All new textures created.");
}

/**
 * Handles an image file selection from the upload input.
 * Stores the Data URL of the selected file.
 * @param {Event} event - The change event from the file input.
 * @comment Reads the selected file and updates the preview text.
 */
async function handleImageUploadChange(event) {
    const file = event.target.files[0];
    if (file) {
        console.log(`bulkTextureOperations.js: File selected for upload: ${file.name}`);
        uploadedFileNameSpan.textContent = file.name;
        try {
            uploadedFileDataURL = await readFileAsDataURL(file);
            console.log("bulkTextureOperations.js: Uploaded file read as Data URL.");
            applyUploadBtn.disabled = false; // Enable apply button once file is read
        } catch (error) {
            console.error("bulkTextureOperations.js: Error reading uploaded file:", error);
            uploadedFileDataURL = null;
            uploadedFileNameSpan.textContent = 'Failed to read file';
            applyUploadBtn.disabled = true;
        }
    } else {
        uploadedFileDataURL = null;
        uploadedFileNameSpan.textContent = 'No file chosen';
        applyUploadBtn.disabled = true;
    }
}

/**
 * Applies the uploaded image to all selected image assets, converting types if necessary.
 * @comment This is the most complex part of the image operations, handling type conversions.
 */
async function handleApplyUploadedImage() {
    console.log("bulkTextureOperations.js: Applying uploaded image to selected assets...");
    if (!uploadedFileDataURL) {
        console.warn("bulkTextureOperations.js: No image uploaded to apply.");
        // Consider showing a user-friendly message
        return;
    }

    const selectedImageAssets = getSelectedAssetObjects().filter(asset => asset.assetType === 'image');

    if (selectedImageAssets.length === 0) {
        console.warn("bulkTextureOperations.js: No image assets selected to apply uploaded image to.");
        return;
    }

    applyUploadBtn.disabled = true; // Disable button during processing
    applyUploadBtn.textContent = 'Applying Upload...';

    // Get the MIME type of the uploaded file
    const uploadedMimeType = uploadedFileDataURL.substring(uploadedFileDataURL.indexOf(':') + 1, uploadedFileDataURL.indexOf(';'));
    console.log(`bulkTextureOperations.js: Uploaded image MIME type: ${uploadedMimeType}`);

    for (const asset of selectedImageAssets) {
        try {
            console.log(`bulkTextureOperations.js: Applying uploaded image to ${asset.fileName}`);
            let finalDataUrl = uploadedFileDataURL;

            // Check if conversion is needed (if uploaded type doesn't match asset's original type)
            if (uploadedMimeType !== asset.mimeType) {
                console.log(`bulkTextureOperations.js: Converting uploaded image from ${uploadedMimeType} to ${asset.mimeType} for ${asset.fileName}`);

                // Load the original image to get its dimensions for conversion,
                // ensuring the converted image matches the original asset's dimensions.
                const originalImage = new Image();
                originalImage.src = asset.originalDataUrl;
                await new Promise(resolve => originalImage.onload = resolve); // Wait for image to load

                finalDataUrl = await convertImageDataURL(uploadedFileDataURL, asset.mimeType, originalImage.width, originalImage.height);
            }
            updateAssetCardDisplay(asset.fullPath, finalDataUrl); // Update main grid UI
            console.log(`bulkTextureOperations.js: Uploaded image applied to ${asset.fileName}`);
        } catch (error) {
            console.error(`bulkTextureOperations.js: Error applying uploaded image to ${asset.fileName}:`, error);
        }
    }
    applyUploadBtn.disabled = false;
    applyUploadBtn.textContent = 'Apply Uploaded Image';
    console.log("bulkTextureOperations.js: All uploaded images applied.");
    resetModalInputs(); // Reset inputs after successful application
}

// --- Event Listeners ---

// Listen for the modal to be shown (by main.js) to reset inputs
bulkOperationsModalOverlay.addEventListener('transitionend', (event) => {
    // Check if the 'visible' class was added and it's the opacity transition
    if (event.propertyName === 'opacity' && bulkOperationsModalOverlay.classList.contains('visible')) {
        console.log("bulkTextureOperations.js: Modal became visible. Resetting inputs.");
        resetModalInputs();
    }
});


// Adjust Texture Sliders
saturationSlider.addEventListener('input', () => {
    saturationValueSpan.textContent = `${saturationSlider.value}%`;
});
brightnessSlider.addEventListener('input', () => {
    brightnessValueSpan.textContent = `${brightnessSlider.value}%`;
});
contrastSlider.addEventListener('input', () => {
    contrastValueSpan.textContent = `${contrastSlider.value}%`;
});
applyAdjustmentsBtn.addEventListener('click', handleApplyAdjustments);

// Make New Texture
createNewTextureBtn.addEventListener('click', handleCreateNewTexture);

// Upload New Image
triggerUploadBtn.addEventListener('click', () => {
    // Programmatically click the hidden file input
    uploadImageInput.click();
});
uploadImageInput.addEventListener('change', handleImageUploadChange);
applyUploadBtn.addEventListener('click', handleApplyUploadedImage);

console.log("bulkTextureOperations.js: Bulk Texture Operations module loaded.");

