// js/fileHandling.js
// This file will manage all aspects of file loading, parsing, encoding, and decoding.
import { showLoadingOverlay, hideLoadingOverlay, createAssetCard, markCardAsEdited } from './ui.js';

// Stores original and modified asset data
// Structure: { "folderNumber": { "fileName": { originalBase64: "...", currentBase64: "...", type: "jpg/png/mp3", isEdited: true/false } } }
export const assetData = {};

// Stores lists from .txt files
export const assetLists = {
    mp3: [],
    jpg: [],
    png: []
};

// Store edited assets separately for easier export later
// Structure: { "folderNumber": { "fileName": { base64Data: "...", type: "...", originalFileName: "...", originalType: "..." } } }
export const editedAssets = {};

/**
 * Fetches and parses a JSON file.
 * @param {string} url - The URL of the JSON file.
 * @returns {Promise<object>} A promise that resolves with the parsed JSON data.
 */
async function fetchJsonFile(url) {
    console.log(`FileHandling: Fetching JSON file from ${url}`);
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`FileHandling: Error fetching JSON file ${url}:`, error);
        alert(`Failed to load essential data: ${url}. Please check your connection or file path.`);
        throw error;
    }
}

/**
 * Fetches and parses a text file, returning an array of lines.
 * @param {string} url - The URL of the text file.
 * @returns {Promise<string[]>} A promise that resolves with an array of lines.
 */
async function fetchTxtFile(url) {
    console.log(`FileHandling: Fetching TXT file from ${url}`);
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const text = await response.text();
        return text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    } catch (error) {
        console.error(`FileHandling: Error fetching TXT file ${url}:`, error);
        alert(`Failed to load asset list: ${url}.`);
        throw error;
    }
}

/**
 * Loads all asset lists and JSON data into memory.
 * This is the initial loading process shown to the user.
 * @returns {Promise<void>} A promise that resolves when all assets are loaded.
 */
export async function loadAllAssetsIntoMemory() {
    console.log('FileHandling: Starting to load all assets into memory.');
    showLoadingOverlay('Loading asset lists...');

    try {
        // Load asset lists (.txt files)
        const [mp3List, jpgList, pngList] = await Promise.all([
            fetchTxtFile('assets/mp3list.txt'),
            fetchTxtFile('assets/jpglist.txt'),
            fetchTxtFile('assets/pnglist.txt')
        ]);

        assetLists.mp3 = mp3List;
        assetLists.jpg = jpgList;
        assetLists.png = pngList;
        console.log('FileHandling: Asset lists loaded.');
        console.log('MP3 List:', assetLists.mp3.length);
        console.log('JPG List:', assetLists.jpg.length);
        console.log('PNG List:', assetLists.png.length);


        // Load Base64 JSON data
        showLoadingOverlay('Loading asset data (this might take a moment)...');
        // Fetch the full JSON structure now
        const [fullJpgJson, fullPngJson, fullMp3Json] = await Promise.all([
            fetchJsonFile('assets/jpg_files_structure.json'),
            fetchJsonFile('assets/png_files_structure.json'),
            fetchJsonFile('assets/mp3_files_structure.json')
        ]);
        console.log('FileHandling: Full asset JSON data loaded.');

        // Extract the relevant 'assets' object from the deep nesting
        // Using optional chaining to safely access nested properties
        const jpgJson = fullJpgJson?.["mod-client-export"]?.["Venge Client"]?.["Resource Swapper"]?.["files"]?.["assets"] || {};
        const pngJson = fullPngJson?.["mod-client-export"]?.["Venge Client"]?.["Resource Swapper"]?.["files"]?.["assets"] || {};
        const mp3Json = fullMp3Json?.["mod-client-export"]?.["Venge Client"]?.["Resource Swapper"]?.["files"]?.["assets"] || {};

        if (Object.keys(jpgJson).length === 0 && Object.keys(pngJson).length === 0 && Object.keys(mp3Json).length === 0) {
            console.warn('FileHandling: No asset data found at the expected nested path within the JSON files. Please check JSON structure.');
            alert('Warning: No asset data found. Make sure your JSON files are correctly structured.');
        }


        const assetGrid = document.getElementById('asset-grid');
        let loadedCount = 0;
        const totalAssets = jpgList.length + pngList.length + mp3List.length;

        // Process JPG assets
        for (const line of jpgList) {
            const [folderNumber, fileName] = line.split(' ');
            // Access the 'data' property from the nested structure
            const assetDetails = jpgJson[folderNumber]?.["1"]?.[fileName];
            if (assetDetails && assetDetails.data) {
                const base64Data = assetDetails.data;
                if (!assetData[folderNumber]) {
                    assetData[folderNumber] = {};
                }
                assetData[folderNumber][fileName] = {
                    originalBase64: base64Data,
                    currentBase64: base64Data,
                    type: 'jpg', // Still infer type from list for consistency
                    isEdited: false
                };
                const card = createAssetCard({ folderNumber, fileName, base64Data, type: 'jpg' });
                assetGrid.appendChild(card);
            } else {
                console.warn(`FileHandling: JPG asset data not found or 'data' property missing for ${folderNumber}/${fileName}`);
            }
            loadedCount++;
            showLoadingOverlay('Loading asset data...', `${loadedCount}/${totalAssets} assets processed.`);
        }

        // Process PNG assets
        for (const line of pngList) {
            const [folderNumber, fileName] = line.split(' ');
            const assetDetails = pngJson[folderNumber]?.["1"]?.[fileName];
            if (assetDetails && assetDetails.data) {
                const base64Data = assetDetails.data;
                if (!assetData[folderNumber]) {
                    assetData[folderNumber] = {};
                }
                assetData[folderNumber][fileName] = {
                    originalBase64: base64Data,
                    currentBase64: base64Data,
                    type: 'png',
                    isEdited: false
                };
                const card = createAssetCard({ folderNumber, fileName, base64Data, type: 'png' });
                assetGrid.appendChild(card);
            } else {
                console.warn(`FileHandling: PNG asset data not found or 'data' property missing for ${folderNumber}/${fileName}`);
            }
            loadedCount++;
            showLoadingOverlay('Loading asset data...', `${loadedCount}/${totalAssets} assets processed.`);
        }

        // Process MP3 assets (no image preview for these, so create card differently)
        for (const line of mp3List) {
            const [folderNumber, fileName] = line.split(' ');
            const assetDetails = mp3Json[folderNumber]?.["1"]?.[fileName];
            if (assetDetails && assetDetails.data) {
                const base64Data = assetDetails.data; // MP3 data will be stored but not displayed as image
                if (!assetData[folderNumber]) {
                    assetData[folderNumber] = {};
                }
                assetData[folderNumber][fileName] = {
                    originalBase64: base64Data,
                    currentBase64: base64Data,
                    type: 'mp3',
                    isEdited: false
                };
                const card = createAssetCard({ folderNumber, fileName, base64Data: '', type: 'mp3' }); // No base64Data for image
                assetGrid.appendChild(card);
            } else {
                console.warn(`FileHandling: MP3 asset data not found or 'data' property missing for ${folderNumber}/${fileName}`);
            }
            loadedCount++;
            showLoadingOverlay('Loading asset data...', `${loadedCount}/${totalAssets} assets processed.`);
        }

        console.log('FileHandling: All assets processed and cards created.');
    } catch (error) {
        console.error('FileHandling: Error during asset loading:', error);
        alert('An error occurred while loading assets. Please check the console for details.');
    } finally {
        hideLoadingOverlay();
        console.log('FileHandling: Asset loading complete. Overlay hidden.');
    }
}

/**
 * Converts a Base64 string to a Blob.
 * @param {string} base64 - The Base64 string.
 * @param {string} mimeType - The MIME type of the data (e.g., 'image/png', 'audio/mpeg').
 * @returns {Blob} The created Blob.
 */
export function base64ToBlob(base64, mimeType) {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
}

/**
 * Converts a Blob or File to a Base64 string.
 * @param {Blob|File} blob - The Blob or File object.
 * @returns {Promise<string>} A promise that resolves with the Base64 string.
 */
export function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            // Remove the "data:image/png;base64," prefix that FileReader.readAsDataURL adds
            const base64String = reader.result.split(',')[1];
            resolve(base64String);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

/**
 * Downloads a single asset.
 * @param {string} folderNumber - The folder number of the asset.
 * @param {string} fileName - The file name of the asset.
 */
export function downloadAsset(folderNumber, fileName) {
    console.log(`FileHandling: Initiating download for ${folderNumber}/${fileName}`);
    const asset = assetData[folderNumber]?.[fileName];
    if (!asset) {
        console.error(`FileHandling: Asset not found for download: ${folderNumber}/${fileName}`);
        alert('Asset not found for download!');
        return;
    }

    const mimeTypeMap = {
        'jpg': 'image/jpeg',
        'png': 'image/png',
        'mp3': 'audio/mpeg'
    };
    const mimeType = mimeTypeMap[asset.type] || 'application/octet-stream';
    const blob = base64ToBlob(asset.currentBase64, mimeType);

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName; // Use the actual file name for download
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log(`FileHandling: Download for ${fileName} completed.`);
}

/**
 * Updates an asset's data in memory and marks it as edited.
 * Also updates the corresponding card in the UI.
 * @param {string} folderNumber - The folder number of the asset.
 * @param {string} fileName - The file name of the asset.
 * @param {string} newBase64Data - The new Base64 encoded data.
 * @param {string} newType - The new type if it changed (e.g., from jpg to png due to conversion).
 */
export function updateAssetInMemory(folderNumber, fileName, newBase64Data, newType) {
    console.log(`FileHandling: Updating asset in memory: ${folderNumber}/${fileName}. New Type: ${newType}`);
    if (assetData[folderNumber] && assetData[folderNumber][fileName]) {
        assetData[folderNumber][fileName].currentBase64 = newBase64Data;
        assetData[folderNumber][fileName].isEdited = true;
        // Update the type if it changed (e.g., from image conversion)
        assetData[folderNumber][fileName].type = newType;

        // Add to editedAssets for export
        editedAssets[folderNumber] = editedAssets[folderNumber] || {};
        editedAssets[folderNumber][fileName] = {
            base64Data: newBase64Data,
            type: newType,
            originalFileName: fileName, // Keep original file name
            originalType: assetData[folderNumber][fileName].originalType || assetData[folderNumber][fileName].type // Keep original type
        };

        // Update the UI card
        const cardElement = document.querySelector(`.asset-card[data-folder-number="${folderNumber}"][data-file-name="${fileName}"]`);
        if (cardElement) {
            markCardAsEdited(cardElement, newBase64Data, newType);
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

                // Clear current edited assets and apply imported ones
                for (const folderNum in editedAssets) {
                    delete editedAssets[folderNum];
                }

                for (const folderNumber in importedData) {
                    for (const fileName in importedData[folderNumber]) {
                        const { base64Data, type } = importedData[folderNumber][fileName];
                        // Ensure the asset exists in original assetData before applying
                        if (assetData[folderNumber] && assetData[folderNumber][fileName]) {
                            updateAssetInMemory(folderNumber, fileName, base64Data, type);
                            console.log(`FileHandling: Applied imported change for ${folderNumber}/${fileName}`);
                        } else {
                            console.warn(`FileHandling: Skipping imported asset ${folderNumber}/${fileName} as it does not exist in original asset list.`);
                        }
                    }
                }
                alert('Changes imported successfully!');
                console.log('FileHandling: Import complete.');
            } catch (jsonError) {
                console.error('FileHandling: Error parsing imported JSON:', jsonError);
                alert('Invalid JSON file format.');
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
 * Exports current edited assets to a JSON file.
 */
export function exportChanges() {
    console.log('FileHandling: Exporting changes to JSON file.');
    if (Object.keys(editedAssets).length === 0) {
        alert('No changes to export yet!');
        console.log('FileHandling: No edited assets to export.');
        return;
    }

    const dataStr = JSON.stringify(editedAssets, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'venge_mod_changes.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log('FileHandling: Changes exported successfully.');
}