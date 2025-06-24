// js/fileHandler.js

import { createDataURL } from './utils.js';

/**
 * Fetches a text file and returns its content.
 * @param {string} url - The URL of the text file.
 * @returns {Promise<string>} A promise that resolves with the text content.
 */
async function fetchTextFile(url) {
    console.log(`fileHandler.js: Fetching text file: ${url}`);
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} for ${url}`);
        }
        const text = await response.text();
        console.log(`fileHandler.js: Successfully fetched ${url}`);
        return text;
    } catch (error) {
        console.error(`fileHandler.js: Error fetching text file ${url}:`, error);
        throw error;
    }
}

/**
 * Fetches a JSON file and returns its parsed content.
 * @param {string} url - The URL of the JSON file.
 * @returns {Promise<object>} A promise that resolves with the parsed JSON object.
 */
async function fetchJsonFile(url) {
    console.log(`fileHandler.js: Fetching JSON file: ${url}`);
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} for ${url}`);
        }
        const json = await response.json();
        console.log(`fileHandler.js: Successfully fetched ${url}`);
        return json;
    } catch (error) {
        console.error(`fileHandler.js: Error fetching JSON file ${url}:`, error);
        throw error;
    }
}

/**
 * Parses the asset list text (e.g., mp3list.txt) into an array of objects.
 * Each line is expected to be "long_folder_number file_name_with_extension".
 * @param {string} textContent - The raw text content of the list file.
 * @param {string} type - The type of asset (e.g., 'image', 'audio').
 * @returns {Array<object>} An array of asset descriptor objects.
 */
function parseAssetList(textContent, type) {
    console.log(`fileHandler.js: Parsing ${type} asset list.`);
    const lines = textContent.split('\n').filter(line => line.trim() !== '');
    const assets = lines.map(line => {
        const parts = line.trim().split(' ');
        if (parts.length < 2) {
            console.warn(`fileHandler.js: Skipping malformed line in ${type} list: "${line}"`);
            return null;
        }
        const longFolderNumber = parts[0];
        const fileName = parts.slice(1).join(' ');
        const fileExtension = fileName.split('.').pop();
        const fullPath = `${longFolderNumber}/1/${fileName}`;
        return {
            longFolderNumber,
            fileName,
            fileExtension,
            type, // 'image' or 'audio'
            fullPath,
            dataUrl: null, // This will be loaded on demand
            originalDataUrl: null, // This will be populated once dataUrl is loaded
            mimeType: type === 'image' ? `image/${fileExtension === 'jpg' ? 'jpeg' : fileExtension}` : `audio/mpeg`, // Pre-determine MIME type
            assetType: type,
            isEdited: false
        };
    }).filter(asset => asset !== null);
    console.log(`fileHandler.js: Parsed ${assets.length} ${type} assets.`);
    return assets;
}

/**
 * Helper to extract Base64 data from the nested JSON structure.
 * This is designed for the 'mod-client-export' format.
 * @param {object} jsonObj - The full JSON object loaded from a _files_structure.json file.
 * @param {string} longFolderNumber - The folder ID (e.g., "29398287").
 * @param {string} fileName - The file name (e.g., "Hit-sound.mp3").
 * @returns {string | null} The Base64 data string, or null if not found.
 */
const getBase64DataFromNestedJson = (jsonObj, longFolderNumber, fileName) => {
    try {
        const modExport = jsonObj['mod-client-export'];
        if (!modExport) return null;
        const vengeClient = modExport['Venge Client'];
        if (!vengeClient) return null;
        const resourceSwapper = vengeClient['Resource Swapper'];
        if (!resourceSwapper) return null;
        const files = resourceSwapper['files'];
        if (!files) return null;
        const assets = files['assets'];
        if (!assets) return null;

        const folderData = assets[longFolderNumber];
        if (!folderData) return null;
        const oneKeyData = folderData['1'];
        if (!oneKeyData) return null;
        const fileEntry = oneKeyData[fileName];
        if (!fileEntry) return null;

        return fileEntry.data;
    } catch (e) {
        console.error(`fileHandler.js: Error navigating JSON for ${longFolderNumber}/${fileName}:`, e);
        return null;
    }
};

/**
 * Loads only the asset lists (metadata) at application startup.
 * The actual Base64 data from JSON files is NOT loaded here.
 * @param {Function} updateProgress - Callback to update loading progress UI.
 * @returns {Promise<{parsedJpgAssets: Array<object>, parsedPngAssets: Array<object>, parsedMp3Assets: Array<object>, rawJsonData: object}>}
 * An object containing arrays of parsed assets (metadata only) and the raw JSON data maps.
 * @comment This function is called once at startup to quickly populate the grid with placeholders.
 */
export async function loadAssetLists(updateProgress) {
    console.log("fileHandler.js: Starting to load asset lists (metadata only)...");

    // Fetch all text list files
    const [jpgListText, pngListText, mp3ListText] = await Promise.all([
        fetchTextFile('assets/jpglist.txt'),
        fetchTextFile('assets/pnglist.txt'),
        fetchTextFile('assets/mp3list.txt')
    ]);

    // Parse text lists into asset metadata objects
    const parsedJpgAssets = parseAssetList(jpgListText, 'image');
    const parsedPngAssets = parseAssetList(pngListText, 'image');
    const parsedMp3Assets = parseAssetList(mp3ListText, 'audio');

    // Fetch all JSON data files, but don't process them yet. Just store the raw data.
    const [jpgData, pngData, mp3Data] = await Promise.all([
        fetchJsonFile('assets/jpg_files_structure.json'),
        fetchJsonFile('assets/png_files_structure.json'),
        fetchJsonFile('assets/mp3_files_structure.json')
    ]);

    // Store the raw JSON data for on-demand access
    const rawJsonData = {
        jpg: jpgData,
        png: pngData,
        mp3: mp3Data
    };

    // This initial progress update reflects only the list loading
    const totalAssetsMetadata = parsedJpgAssets.length + parsedPngAssets.length + parsedMp3Assets.length;
    updateProgress(totalAssetsMetadata, totalAssetsMetadata, "Asset lists loaded.");

    console.log(`fileHandler.js: All asset lists loaded. Total metadata items: ${totalAssetsMetadata}`);
    return { parsedJpgAssets, parsedPngAssets, parsedMp3Assets, rawJsonData };
}


/**
 * Loads the Base64 data for a specific asset on demand.
 * This function modifies the provided asset object in place.
 * @param {object} asset - The asset object (from `allGameAssets`) to populate with data.
 * @param {object} assetDataMaps - An object containing the raw JSON data for each type (jpg, png, mp3).
 * @returns {Promise<void>} A promise that resolves when the asset's dataUrl is populated.
 * @comment This is the core of the on-demand loading.
 */
export async function loadAssetDataOnDemand(asset, assetDataMaps) {
    console.log(`fileHandler.js: Attempting to load data on demand for ${asset.fileName} (${asset.longFolderNumber})...`);

    if (asset.dataUrl) {
        console.log(`fileHandler.js: Data for ${asset.fileName} already loaded.`);
        return; // Data already present, no need to re-load
    }

    let rawDataJson = null;
    let mimeType = '';

    // Determine which JSON data map to use based on asset type
    if (asset.assetType === 'image') {
        if (asset.fileExtension === 'jpg') {
            rawDataJson = assetDataMaps.jpg;
            mimeType = 'image/jpeg';
        } else if (asset.fileExtension === 'png') {
            rawDataJson = assetDataMaps.png;
            mimeType = 'image/png';
        }
    } else if (asset.assetType === 'audio' && asset.fileExtension === 'mp3') {
        rawDataJson = assetDataMaps.mp3;
        mimeType = 'audio/mpeg';
    }

    if (!rawDataJson) {
        console.error(`fileHandler.js: No raw JSON data map found for asset type: ${asset.assetType}`);
        throw new Error(`Could not find data source for asset: ${asset.fileName}`);
    }

    // Extract the Base64 data using the helper
    const base64Data = getBase64DataFromNestedJson(rawDataJson, asset.longFolderNumber, asset.fileName);

    if (base64Data) {
        asset.dataUrl = createDataURL(base64Data, mimeType);
        asset.originalDataUrl = asset.dataUrl; // Set originalDataUrl when data is first loaded
        console.log(`fileHandler.js: Successfully loaded data for ${asset.fileName}.`);
    } else {
        console.error(`fileHandler.js: Base64 data not found in JSON for ${asset.fileName}.`);
        throw new Error(`Data not found for ${asset.fileName}`);
    }
}


console.log("fileHandler.js: File Loading and Parsing module loaded.");
