// js/fileHandling.js
// This file handles loading asset data from JSON, converting formats, and managing edited assets.
import { renderAssetCards, showLoadingOverlay, hideLoadingOverlay, updateLoadingProgress, createAssetCard, markCardAsEdited } from './ui.js';
import { toggleCardSelectionUI, toggleCardExclusionUI } from './selection.js'; // Import UI toggles for cards

// Global storage for original asset data
// Structure: { "folderNumber": { "fileName": { originalBase64: "...", currentBase64: "...", type: "...", originalType: "...", isEdited: false } } }
export const assetData = {};

// Store edited assets separately for easier export later
// Structure: { "folderNumber": { "fileName": { base64Data: "...", type: "...", isExcluded: true/false, originalFileName: "...", originalType: "..." } } }
export const editedAssets = {};

/**
 * Fetches the main assets JSON and processes it.
 */
export async function loadAllAssetsIntoMemory() {
    console.log('FileHandling: Loading all assets into memory...');
    showLoadingOverlay('Loading assets JSON...');
    try {
        const response = await fetch('assets/assets.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log('FileHandling: Assets JSON loaded successfully.');

        let processedCount = 0;
        const totalAssets = Object.keys(data).reduce((sum, folderNum) => sum + Object.keys(data[folderNum]).length, 0);

        for (const folderNumber in data) {
            assetData[folderNumber] = {};
            for (const fileName in data[folderNumber]) {
                const asset = data[folderNumber][fileName];
                assetData[folderNumber][fileName] = {
                    originalBase64: asset.base64,
                    currentBase64: asset.base64, // Initially, current is same as original
                    type: asset.type,
                    originalType: asset.type, // Store original type
                    isEdited: false,
                    isExcluded: false // Default to not excluded
                };
                processedCount++;
                updateLoadingProgress(`Processed ${processedCount}/${totalAssets} assets...`);
            }
        }
        renderAssetCards(assetData); // Render cards once all assets are loaded
        hideLoadingOverlay();
        console.log('FileHandling: All assets processed and rendered.');
    } catch (error) {
        console.error('FileHandling: Error loading assets:', error);
        showLoadingOverlay('Error loading assets!', 'Please check console for details.', true); // Show error indefinitely
    }
}

/**
 * Converts a Base64 string to a Blob.
 * @param {string} base64 - The Base64 string.
 * @param {string} mimeType - The MIME type of the data (e.g., 'image/png', 'audio/mpeg').
 * @returns {Blob} The created Blob.
 */
export function base64ToBlob(base64, mimeType) {
    if (!base64 || typeof base64 !== 'string') {
        console.error("FileHandling: base64ToBlob received invalid base64 data:", base64, "MIME:", mimeType);
        throw new Error("Invalid base64 string provided to base64ToBlob.");
    }

    // Attempt to add padding if it's missing, common issue with some base64 sources
    let paddedBase64 = base64;
    const len = base64.length;
    const remainder = len % 4;
    if (remainder !== 0) {
        // Only add padding if it's missing. Standard base64 should have padding.
        // It's possible base64 strings might not be perfectly padded if source is non-standard.
        for (let i = 0; i < 4 - remainder; i++) {
            paddedBase64 += '=';
        }
    }
    // Remove any non-base64 characters that might have snuck in (e.g., newlines, spaces)
    paddedBase64 = paddedBase64.replace(/[^A-Za-z0-9+/=]/g, '');

    let byteCharacters;
    try {
        byteCharacters = atob(paddedBase64);
    } catch (e) {
        console.error("FileHandling: Failed to decode base64 string using atob(). Possible invalid characters or malformation.", e, "Base64 snippet:", paddedBase64.substring(0, 100) + '...'); // Log first 100 chars
        throw new Error(`Failed to decode base64 string: ${e.message}. Data might be corrupted.`);
    }

    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
}

/**
 * Converts a Blob to a Base64 string.
 * @param {Blob} blob - The Blob to convert.
 * @returns {Promise<string>} A promise that resolves with the Base64 encoded string (without data:MIME/type;base64, prefix).
 */
export function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            // Remove the data:MIME/type;base64, prefix
            const base64String = reader.result.split(',')[1];
            resolve(base64String);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

/**
 * Gets the MIME type for a given asset type.
 * @param {string} type - The asset type (e.g., 'jpg', 'png', 'mp3').
 * @returns {string} The corresponding MIME type.
 */
export function getMimeType(type) {
    switch (type) {
        case 'jpg': return 'image/jpeg';
        case 'png': return 'image/png';
        case 'mp3': return 'audio/mpeg';
        case 'wav': return 'audio/wav'; // Though WAV usually gets converted
        default: return 'application/octet-stream'; // Generic binary data
    }
}

/**
 * Triggers a download of a specific asset.
 * @param {string} folderNumber - The folder number of the asset.
 * @param {string} fileName - The file name of the asset.
 */
export function downloadAsset(folderNumber, fileName) {
    console.log(`FileHandling: Downloading asset: ${folderNumber}/${fileName}`);
    const asset = assetData[folderNumber]?.[fileName];
    if (asset && asset.currentBase64) {
        try {
            const mimeType = getMimeType(asset.type);
            const blob = base64ToBlob(asset.currentBase64, mimeType);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            console.log(`FileHandling: Download initiated for ${fileName}.`);
        } catch (error) {
            console.error(`FileHandling: Error creating blob for download of ${fileName}:`, error);
            alert(`Failed to prepare download for ${fileName}. See console.`);
        }
    } else {
        console.warn(`FileHandling: Asset not found or no currentBase64 data for download: ${folderNumber}/${fileName}`);
        alert('Asset data not available for download.');
    }
}

/**
 * Updates an asset's data in memory and marks it as edited.
 * Also updates the corresponding card in the UI.
 * @param {string} folderNumber - The folder number of the asset.
 * @param {string} fileName - The file name of the asset.
 * @param {string} newBase64Data - The new Base64 encoded data.
 * @param {string} newType - The new type if it changed (e.g., from jpg to png due to conversion).
 * @param {boolean} [isExcluded=false] - Optional: If this update is specifically to mark/unmark for exclusion.
 */
export function updateAssetInMemory(folderNumber, fileName, newBase64Data, newType, isExcludedUpdate = null) {
    console.log(`FileHandling: Updating asset in memory: ${folderNumber}/${fileName}. New Type: ${newType}.`);
    if (assetData[folderNumber] && assetData[folderNumber][fileName]) {
        assetData[folderNumber][fileName].currentBase64 = newBase64Data;
        assetData[folderNumber][fileName].type = newType; // Update type

        // Ensure editedAssets entry exists
        editedAssets[folderNumber] = editedAssets[folderNumber] || {};
        editedAssets[folderNumber][fileName] = editedAssets[folderNumber][fileName] || {
            originalFileName: fileName,
            originalType: assetData[folderNumber][fileName].originalType || assetData[folderNumber][fileName].type,
            // Default isExcluded to false, but if it exists in editedAssets, preserve it
            isExcluded: assetData[folderNumber][fileName].isExcluded // Preserve current exclusion status
        };

        // Update properties in editedAssets
        editedAssets[folderNumber][fileName].base64Data = newBase64Data;
        editedAssets[folderNumber][fileName].type = newType;

        // Apply isExcludedUpdate if explicitly provided
        if (typeof isExcludedUpdate === 'boolean') {
            editedAssets[folderNumber][fileName].isExcluded = isExcludedUpdate;
            assetData[folderNumber][fileName].isExcluded = isExcludedUpdate; // Also update in main assetData for consistency
        }
        
        // Mark as edited if any change (including base64 data or exclusion status changed from default)
        // If the currentBase64 is different from originalBase64, it's edited.
        // If the isExcluded status is true, it's edited (from default false).
        const isContentChanged = assetData[folderNumber][fileName].currentBase64 !== assetData[folderNumber][fileName].originalBase64;
        const isTypeChanged = assetData[folderNumber][fileName].type !== assetData[folderNumber][fileName].originalType;
        const isExclusionStatusChanged = assetData[folderNumber][fileName].isExcluded === true; // Check if it's currently excluded

        assetData[folderNumber][fileName].isEdited = isContentChanged || isTypeChanged || isExclusionStatusChanged;

        // Update the UI card
        const cardElement = document.querySelector(`.asset-card[data-folder-number="${folderNumber}"][data-file-name="${fileName}"]`);
        if (cardElement) {
            if (assetData[folderNumber][fileName].isEdited) {
                markCardAsEdited(cardElement, newBase64Data, newType); // Handles normal edited state (orange text)
            } else {
                // If somehow it's no longer edited (e.g., reverted), remove class
                cardElement.classList.remove('edited');
                const typeSpan = cardElement.querySelector('.asset-type');
                if (typeSpan) typeSpan.textContent = assetData[folderNumber][fileName].originalType.toUpperCase();
            }

            // Apply exclusion UI if the asset is currently marked as excluded in editedAssets
            if (assetData[folderNumber][fileName].isExcluded) {
                toggleCardExclusionUI(cardElement, true);
            } else {
                toggleCardExclusionUI(cardElement, false);
            }
        } else {
            console.warn(`FileHandling: Could not find card element for ${folderNumber}/${fileName} to update.`);
        }
    } else {
        console.error(`FileHandling: Asset not found in memory to update: ${folderNumber}/${fileName}`);
    }
}


/**
 * Imports changes from a JSON file.
 * This will overwrite current edited assets with the imported data.
 * @param {File} file - The JSON file to import.
 */
export async function importChanges(file) {
    console.log('FileHandling: Importing changes from file...');
    showLoadingOverlay('Importing changes...');
    try {
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const importedData = JSON.parse(event.target.result);
                console.log('FileHandling: Imported data:', importedData);

                // Clear current selections/exclusions and edited state in UI and internal sets
                // These are imported from selection.js, so make sure they are functions or methods on imported objects
                // In this setup, selectedAssets and excludedAssets are direct Set objects, not functions.
                // You'd typically clear them directly if imported, or call functions like clearAllSelections().
                // Assuming selection.js provides functions to manage its state correctly:
                // If selectedAssets and excludedAssets are directly exported Sets from selection.js,
                // you would need to either import clearAllSelections/clearAllExclusions or ensure your usage respects module boundaries.
                // For now, let's explicitly clear classes and sets (assuming direct access is okay for cleanup).
                document.querySelectorAll('.asset-card.selected').forEach(card => card.classList.remove('selected'));
                document.querySelectorAll('.asset-card.excluded').forEach(card => card.classList.remove('excluded'));
                document.querySelectorAll('.asset-card.edited').forEach(card => card.classList.remove('edited'));
                // Clear the global selection sets if imported (assuming they are directly imported from selection.js)
                // If they are not directly imported sets, but rather managed internally by selection.js
                // then ensure selection.js has a clearAll function.
                // For the current setup, `selectedAssets` and `excludedAssets` from selection.js are directly exposed Sets.
                // The main.js code calls `clearAllSelections()`/`clearAllExclusions()` on button clicks.
                // Here, we need to manually clear the actual classes and reset the `assetData` status.
                
                // Reset all assets to original state first
                for (const folderNumber in assetData) {
                    for (const fileName in assetData[folderNumber]) {
                        assetData[folderNumber][fileName].currentBase64 = assetData[folderNumber][fileName].originalBase64;
                        assetData[folderNumber][fileName].type = assetData[folderNumber][fileName].originalType;
                        assetData[folderNumber][fileName].isEdited = false;
                        assetData[folderNumber][fileName].isExcluded = false; // Reset exclusion status
                        const cardElement = document.querySelector(`.asset-card[data-folder-number="${folderNumber}"][data-file-name="${fileName}"]`);
                        if (cardElement) {
                            cardElement.classList.remove('edited', 'selected', 'excluded');
                            const typeSpan = cardElement.querySelector('.asset-type');
                            if (typeSpan) typeSpan.textContent = assetData[folderNumber][fileName].originalType.toUpperCase();
                            const imgElement = cardElement.querySelector('.asset-preview-img');
                            const audioPlaceholder = cardElement.querySelector('.audio-placeholder');
                             if (imgElement) {
                                imgElement.src = `data:${getMimeType(assetData[folderNumber][fileName].originalType)};base64,${assetData[folderNumber][fileName].originalBase64}`;
                                imgElement.classList.remove('hidden');
                                if (audioPlaceholder) audioPlaceholder.classList.add('hidden');
                            } else if (audioPlaceholder) { // Re-show audio placeholder if it's audio and no img
                                audioPlaceholder.classList.remove('hidden');
                            }
                        }
                    }
                }
                // Clear the `editedAssets` object completely
                for (const folderNum in editedAssets) {
                    delete editedAssets[folderNum];
                }


                for (const folderNumber in importedData) {
                    for (const fileName in importedData[folderNumber]) {
                        const importedAsset = importedData[folderNumber][fileName];
                        // Default isExcluded to false if not present in imported data
                        const { base64Data, type, isExcluded = false, originalFileName, originalType } = importedAsset; 

                        // Ensure the asset exists in original assetData before applying
                        if (assetData[folderNumber] && assetData[folderNumber][fileName]) {
                            // Update assetData's current state
                            assetData[folderNumber][fileName].currentBase64 = base64Data;
                            assetData[folderNumber][fileName].type = type; // Update the asset's type
                            assetData[folderNumber][fileName].isEdited = true; // Mark as edited
                            assetData[folderNumber][fileName].isExcluded = isExcluded; // Apply exclusion status

                            // Populate editedAssets object
                            editedAssets[folderNumber] = editedAssets[folderNumber] || {};
                            editedAssets[folderNumber][fileName] = {
                                base64Data: base64Data,
                                type: type,
                                originalFileName: originalFileName || fileName, // Use originalFileName from import if present
                                originalType: originalType || assetData[folderNumber][fileName].originalType, // Use originalType from import if present
                                isExcluded: isExcluded
                            };

                            // Update the UI card
                            const cardElement = document.querySelector(`.asset-card[data-folder-number="${folderNumber}"][data-file-name="${fileName}"]`);
                            if (cardElement) {
                                markCardAsEdited(cardElement, base64Data, type); // Mark as edited (orange text, update preview)
                                if (isExcluded) {
                                    toggleCardExclusionUI(cardElement, true); // Apply red border
                                } else {
                                    toggleCardExclusionUI(cardElement, false);
                                }
                            }
                            console.log(`FileHandling: Applied imported change for ${folderNumber}/${fileName}. Excluded: ${isExcluded}`);
                        } else {
                            console.warn(`FileHandling: Skipping imported asset ${folderNumber}/${fileName} as it does not exist in original asset list.`);
                        }
                    }
                }
                alert('Changes imported successfully! Check cards for updated states.');
                console.log('FileHandling: Import complete.');
            } catch (jsonError) {
                console.error('FileHandling: Error parsing imported JSON:', jsonError);
                alert('Invalid JSON file format. Make sure it matches the export format.');
            } finally {
                hideLoadingOverlay();
            }
        };
        reader.onerror = (error) => {
            console.error('FileHandling: Error reading file for import:', error);
            alert('Error reading the imported file.');
            hideLoadingOverlay();
        };
        reader.readAsText(file);
    } catch (error) {
        console.error('FileHandling: Error during import process:', error);
        alert('An error occurred during import.');
        hideLoadingOverlay();
    }
}


/**
 * Exports currently edited assets to a JSON file.
 */
export function exportChanges() {
    console.log('FileHandling: Exporting changes to JSON...');
    const editedDataForExport = {};
    let hasEditedAssets = false;

    for (const folderNumber in editedAssets) {
        for (const fileName in editedAssets[folderNumber]) {
            const asset = editedAssets[folderNumber][fileName];
            // Only include assets that are actually edited or explicitly excluded
            // The `isEdited` flag in `assetData` dictates if it's truly changed from original.
            // If `isExcluded` is true, it should also be part of the export, even if `base64Data` is original.
            const originalAsset = assetData[folderNumber]?.[fileName];

            // If the base64 data has changed OR the type has changed OR it's explicitly excluded
            if (originalAsset && (asset.base64Data !== originalAsset.originalBase64 || asset.type !== originalAsset.originalType || asset.isExcluded)) {
                editedDataForExport[folderNumber] = editedDataForExport[folderNumber] || {};
                editedDataForExport[folderNumber][fileName] = {
                    base64Data: asset.base64Data,
                    type: asset.type,
                    originalFileName: asset.originalFileName, // Include original file name
                    originalType: asset.originalType, // Include original type
                    isExcluded: asset.isExcluded || false // Ensure isExcluded is always present, default to false
                };
                hasEditedAssets = true;
            }
        }
    }

    if (!hasEditedAssets) {
        alert('No changes to export. Edit assets or mark them for exclusion first.');
        console.log('FileHandling: No edited assets found for export.');
        return;
    }

    const jsonString = JSON.stringify(editedDataForExport, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'venge_mod_changes.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log('FileHandling: Changes exported to venge_mod_changes.json.');
    alert('Changes exported to venge_mod_changes.json!');
}