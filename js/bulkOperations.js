// js/bulkOperations.js
// This file handles the logic for the "Bulk Texture Operations" modal.
import { openBulkTextureModal, closeBulkTextureModal, switchModalSection, markCardAsEdited } from './ui.js';
import { getSelectedAssets } from './selection.js';
import { base64ToBlob, blobToBase64, updateAssetInMemory } from './fileHandling.js';

/**
 * Initializes event listeners for the bulk texture operations modal.
 */
export function initializeBulkOperations() {
    console.log('BulkOperations: Initializing bulk operations event listeners.');
    document.getElementById('edit-selected-btn').addEventListener('click', handleEditSelectedClick);
    document.querySelector('#bulk-texture-modal .close-button').addEventListener('click', closeBulkTextureModal);

    // Section switch buttons
    document.getElementById('adjust-texture-btn').addEventListener('click', () => switchModalSection('adjust-texture-section', 'adjust-texture-btn'));
    document.getElementById('create-new-texture-btn').addEventListener('click', () => switchModalSection('create-new-texture-section', 'create-new-texture-btn'));
    document.getElementById('upload-new-image-btn').addEventListener('click', () => switchModalSection('upload-new-image-section', 'upload-new-image-btn'));

    // Apply buttons
    document.getElementById('apply-adjustments-btn').addEventListener('click', applyTextureAdjustments);
    document.getElementById('generate-texture-btn').addEventListener('click', generateNewTexture);
    document.getElementById('apply-uploaded-image-btn').addEventListener('click', applyUploadedImage);
}

/**
 * Handles the click event for the "Edit Selected Assets" button.
 * Opens the bulk texture operations modal.
 */
function handleEditSelectedClick() {
    const selected = getSelectedAssets();
    if (selected.length === 0) {
        alert('Please select at least one asset to edit.');
        console.warn('BulkOperations: No assets selected for editing.');
        return;
    }
    console.log(`BulkOperations: Opening modal for ${selected.length} selected assets.`);
    openBulkTextureModal();
}

/**
 * Applies saturation, brightness, and contrast adjustments to selected image assets.
 */
async function applyTextureAdjustments() {
    console.log('BulkOperations: Applying texture adjustments.');
    const selected = getSelectedAssets();
    const imageAssets = selected.filter(asset => asset.type === 'jpg' || asset.type === 'png');

    if (imageAssets.length === 0) {
        alert('No image assets selected for adjustment. This operation only applies to images.');
        console.warn('BulkOperations: No image assets found for adjustment.');
        return;
    }

    const saturation = document.getElementById('saturation-slider').value;
    const brightness = document.getElementById('brightness-slider').value;
    const contrast = document.getElementById('contrast-slider').value;

    console.log(`BulkOperations: Adjustments - Saturation: ${saturation}, Brightness: ${brightness}, Contrast: ${contrast}`);

    const applyPromises = imageAssets.map(async (asset) => {
        return new Promise(async (resolve) => {
            const img = new Image();
            img.onload = async () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = img.width;
                canvas.height = img.height;

                // Apply filters using CSS filter property (canvas doesn't have direct support for these)
                // Draw image and then apply filter
                ctx.filter = `saturate(${saturation}%) brightness(${brightness}%) contrast(${contrast}%)`;
                ctx.drawImage(img, 0, 0);

                // Convert canvas to Base64
                const newBase64 = await blobToBase64(await new Promise(res => canvas.toBlob(res, `image/${asset.type}`)));
                updateAssetInMemory(asset.folderNumber, asset.fileName, newBase64, asset.type);
                console.log(`BulkOperations: Applied adjustments to ${asset.fileName}`);
                resolve();
            };
            img.onerror = () => {
                console.error(`BulkOperations: Failed to load image for adjustment: ${asset.fileName}`);
                resolve(); // Resolve anyway to not block other operations
            };
            img.src = `data:image/${asset.type};base64,${asset.base64Data}`;
        });
    });

    Promise.all(applyPromises).then(() => {
        alert('Texture adjustments applied to selected images!');
        closeBulkTextureModal();
    }).catch(error => {
        console.error('BulkOperations: Error applying texture adjustments:', error);
        alert('An error occurred while applying adjustments.');
    });
}

/**
 * Generates a new solid color texture for selected assets.
 */
async function generateNewTexture() {
    console.log('BulkOperations: Generating new texture.');
    const selected = getSelectedAssets();
    const imageAssets = selected.filter(asset => asset.type === 'jpg' || asset.type === 'png');

    if (imageAssets.length === 0) {
        alert('No image assets selected for new texture generation.');
        console.warn('BulkOperations: No image assets found for new texture generation.');
        return;
    }

    const color = document.getElementById('color-picker').value;
    const width = parseInt(document.getElementById('resolution-width').value);
    const height = parseInt(document.getElementById('resolution-height').value);

    if (isNaN(width) || isNaN(height) || width <= 0 || height <= 0) {
        alert('Please enter valid positive numbers for width and height.');
        console.warn('BulkOperations: Invalid resolution for new texture.');
        return;
    }

    const generatePromises = imageAssets.map(async (asset) => {
        return new Promise(async (resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = width;
            canvas.height = height;

            ctx.fillStyle = color;
            ctx.fillRect(0, 0, width, height);

            // Convert canvas to Base64
            // Always generate PNG to preserve transparency if needed, then convert if original was JPG
            const mimeType = asset.type === 'jpg' ? 'image/jpeg' : 'image/png';
            const newBase64 = await blobToBase64(await new Promise(res => canvas.toBlob(res, mimeType)));

            // If original was JPG, ensure the new texture is also JPG if desired, or let it be PNG.
            // For simplicity here, we'll keep the type based on the original asset.
            // A more robust solution might convert to all selected types.
            updateAssetInMemory(asset.folderNumber, asset.fileName, newBase64, asset.type);
            console.log(`BulkOperations: Generated new texture for ${asset.fileName}`);
            resolve();
        });
    });

    Promise.all(generatePromises).then(() => {
        alert('New texture generated and applied to selected images!');
        closeBulkTextureModal();
    }).catch(error => {
        console.error('BulkOperations: Error generating new texture:', error);
        alert('An error occurred while generating new textures.');
    });
}

/**
 * Handles the upload of a new image and applies it to selected assets, converting types if necessary.
 */
async function applyUploadedImage() {
    console.log('BulkOperations: Applying uploaded image.');
    const selected = getSelectedAssets();
    const imageAssets = selected.filter(asset => asset.type === 'jpg' || asset.type === 'png');

    if (imageAssets.length === 0) {
        alert('No image assets selected for image upload.');
        console.warn('BulkOperations: No image assets found for image upload.');
        return;
    }

    const fileInput = document.getElementById('new-image-upload');
    const uploadedFile = fileInput.files[0];

    if (!uploadedFile) {
        alert('Please select an image file to upload.');
        console.warn('BulkOperations: No file selected for upload.');
        return;
    }

    if (!uploadedFile.type.startsWith('image/')) {
        alert('Please upload a valid image file (JPG or PNG).');
        console.warn('BulkOperations: Uploaded file is not an image.');
        return;
    }

    try {
        const uploadedImageBase64 = await blobToBase64(uploadedFile);
        const uploadedImageType = uploadedFile.type.split('/')[1]; // e.g., 'jpeg', 'png'

        // Determine all unique target types among selected assets
        const targetTypes = new Set(imageAssets.map(asset => asset.type));
        const conversionPromises = [];

        // Pre-convert the uploaded image to all necessary target formats
        const convertedImages = new Map(); // Map: 'jpg' -> base64, 'png' -> base64

        // Always convert uploaded image to a common format first (e.g., PNG) to ensure consistent processing
        const uploadedImg = new Image();
        uploadedImg.src = `data:${uploadedFile.type};base64,${uploadedImageBase64}`;
        await new Promise(resolve => uploadedImg.onload = resolve);

        for (const targetType of targetTypes) {
            if (targetType === uploadedImageType || targetType === 'mp3') { // No conversion needed if types match or if mp3 (which won't get image)
                convertedImages.set(targetType, uploadedImageBase64);
                continue;
            }

            console.log(`BulkOperations: Converting uploaded image to ${targetType}...`);
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = uploadedImg.width;
            canvas.height = uploadedImg.height;
            ctx.drawImage(uploadedImg, 0, 0);

            const mimeType = targetType === 'jpg' ? 'image/jpeg' : 'image/png';
            const convertedBase64 = await blobToBase64(await new Promise(res => canvas.toBlob(res, mimeType, 0.9))); // 0.9 for JPEG quality
            convertedImages.set(targetType, convertedBase64);
            console.log(`BulkOperations: Converted to ${targetType}.`);
        }

        const applyPromises = imageAssets.map(async (asset) => {
            const base64ToApply = convertedImages.get(asset.type);
            if (base64ToApply) {
                updateAssetInMemory(asset.folderNumber, asset.fileName, base64ToApply, asset.type);
                console.log(`BulkOperations: Applied uploaded image to ${asset.fileName} (converted to ${asset.type}).`);
            } else {
                console.warn(`BulkOperations: No suitable converted image for asset ${asset.fileName} of type ${asset.type}.`);
            }
        });

        await Promise.all(applyPromises);
        alert('Uploaded image applied to selected assets (with necessary conversions)!');
        closeBulkTextureModal();

    } catch (error) {
        console.error('BulkOperations: Error applying uploaded image:', error);
        alert('An error occurred while applying the uploaded image.');
    }
}