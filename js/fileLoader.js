// fileLoader.js

import { showLoader } from './utils.js';

/**
 * Represents a single mod asset.
 * @typedef {Object} ModAsset
 * @property {string} id Unique ID (e.g., "jpg_29307612_Scar_Normal_OpenGL.jpg").
 * @property {string} folderNumber The long folder number (e.g., "29307612").
 * @property {string} fileName The file name (e.g., "Scar_Normal_OpenGL.jpg").
 * @property {string} fileType The base type (e.g., "jpg", "png", "mp3").
 * @property {string} mimeType The MIME type (e.g., "image/jpeg", "image/png", "audio/mpeg").
 * @property {string} base64Data The base64 encoded data URI.
 * @property {boolean} isEdited Whether the asset has been modified.
 * @property {boolean} isExcluded Whether the asset is excluded from export.
 */

const ASSET_TYPES = ['jpg', 'png', 'mp3'];
const ASSET_MIME_TYPES = {
    jpg: 'image/jpeg',
    png: 'image/png',
    mp3: 'audio/mpeg'
};

/**
 * Loads a text file from a given path.
 * @param {string} path The path to the text file.
 * @returns {Promise<string>} The content of the text file.
 */
async function loadTextFile(path) {
    const response = await fetch(path);
    if (!response.ok) {
        throw new Error(`Failed to load text file: ${path} Status: ${response.status}`);
    }
    return response.text();
}

/**
 * Loads a JSON file from a given path.
 * @param {string} path The path to the JSON file.
 * @returns {Promise<Object>} The parsed JSON object.
 */
async function loadJsonFile(path) {
    const response = await fetch(path);
    if (!response.ok) {
        throw new Error(`Failed to load JSON file: ${path} Status: ${response.status}`);
    }
    return response.json();
}

/**
 * Parses a TXT list file into an array of { folderNumber, fileName } objects.
 * Example line: 29307612 Scar_Normal_OpenGL.jpg
 * @param {string} textContent The content of the TXT file.
 * @returns {Array<{folderNumber: string, fileName: string}>}
 */
function parseTxtList(textContent) {
    const lines = textContent.split('\n').filter(line => line.trim() !== '');
    return lines.map(line => {
        const parts = line.trim().split(' ');
        const folderNumber = parts[0];
        const fileName = parts.slice(1).join(' '); // Rejoin case for filenames with spaces
        return { folderNumber, fileName };
    });
}

/**
 * Extracts base64 data from the nested JSON structure.
 * @param {Object} jsonContent The parsed JSON object.
 * @param {string} folderNumber The folder number.
 * @param {string} fileName The file name.
 * @returns {string|null} The base64 data URI, or null if not found.
 */
function getBase64DataFromJson(jsonContent, folderNumber, fileName) {
    try {
        // Navigate through the fixed nested structure
        const fileData = jsonContent["mod-client-export"]
                               ["Venge Client"]
                               ["Resource Swapper"]
                               ["files"]
                               ["assets"]
                               [folderNumber]
                               ["1"]
                               [fileName];
        if (fileData && fileData.data) {
            // Prepend data URI prefix if not already present
            const mimeType = fileData.type || 'application/octet-stream'; // Use type from JSON if available
            return fileData.data.startsWith('data:') ? fileData.data : `data:${mimeType};base64,${fileData.data}`;
        }
    } catch (e) {
        console.warn(`Could not find data for ${folderNumber}/${fileName} in JSON:`, e);
    }
    return null;
}

/**
 * Loads all asset data by combining TXT list and JSON structure files.
 * @returns {Promise<Array<ModAsset>>} A promise that resolves with an array of ModAsset objects.
 */
export async function loadAllAssets() {
    showLoader(true, 0, 'Loading file lists...');
    const allAssets = [];
    let processedCount = 0;
    const totalFiles = ASSET_TYPES.length * 2; // Rough estimate for initial loading

    for (const type of ASSET_TYPES) {
        try {
            const listPath = `${type}list.txt`;
            const jsonPath = `${type}_files_structure.json`;

            showLoader(true, (processedCount / totalFiles) * 100, `Loading ${listPath}...`);
            const listContent = await loadTextFile(listPath);
            processedCount++;

            showLoader(true, (processedCount / totalFiles) * 100, `Loading ${jsonPath}...`);
            const jsonContent = await loadJsonFile(jsonPath);
            processedCount++;

            const parsedList = parseTxtList(listContent);
            
            let filesProcessedForType = 0;
            const totalFilesForType = parsedList.length;

            for (const { folderNumber, fileName } of parsedList) {
                const base64Data = getBase64DataFromJson(jsonContent, folderNumber, fileName);
                if (base64Data) {
                    const asset = {
                        id: `${type}_${folderNumber}_${fileName}`, // Unique ID
                        folderNumber: folderNumber,
                        fileName: fileName,
                        fileType: type,
                        mimeType: ASSET_MIME_TYPES[type],
                        base64Data: base64Data,
                        isEdited: false,
                        isExcluded: false,
                        // Add original size/lastModified if needed for export fidelity,
                        // but not strictly required for current display/edit.
                    };
                    allAssets.push(asset);
                }
                filesProcessedForType++;
                // Update progress for actual data processing
                showLoader(true, ((processedCount + (filesProcessedForType / totalFilesForType)) / (totalFiles + ASSET_TYPES.length)) * 100, `Processing ${fileName}`);
            }
        } catch (error) {
            console.error(`Error loading assets for type ${type}:`, error);
            // Continue loading other types even if one fails
        }
    }
    showLoader(false); // Hide loader after all is done
    return allAssets;
}

/**
 * Updates the base64 data for a specific asset in the in-memory array.
 * Marks the asset as 'edited'.
 * @param {Array<ModAsset>} assets The array of all ModAsset objects.
 * @param {string} assetId The ID of the asset to update.
 * @param {string} newBase64Data The new base64 data URI.
 */
export function updateAssetData(assets, assetId, newBase64Data) {
    const asset = assets.find(a => a.id === assetId);
    if (asset) {
        asset.base64Data = newBase64Data;
        asset.isEdited = true;
        console.log(`Asset ${assetId} updated and marked as edited.`);
    } else {
        console.warn(`Asset with ID ${assetId} not found for update.`);
    }
}

/**
 * Toggles the exclusion status of assets.
 * @param {Array<ModAsset>} assets The array of all ModAsset objects.
 * @param {Array<string>} assetIds The IDs of the assets to toggle exclusion for.
 */
export function toggleAssetExclusion(assets, assetIds) {
    assetIds.forEach(id => {
        const asset = assets.find(a => a.id === id);
        if (asset) {
            asset.isExcluded = !asset.isExcluded;
            console.log(`Asset ${id} exclusion toggled to ${asset.isExcluded}`);
        } else {
            console.warn(`Asset with ID ${id} not found for exclusion toggle.`);
        }
    });
}