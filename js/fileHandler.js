// js/fileHandler.js

import { createDataURL } from './utils.js'; // Import utility for creating data URLs if needed

/**
 * Fetches a text file and returns its content.
 * @param {string} url - The URL of the text file.
 * @returns {Promise<string>} A promise that resolves with the text content.
 * @comment This function is generic for fetching any plain text file, like our asset lists.
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
        throw error; // Re-throw to be handled by the caller
    }
}

/**
 * Fetches a JSON file and returns its parsed content.
 * @param {string} url - The URL of the JSON file.
 * @returns {Promise<object>} A promise that resolves with the parsed JSON object.
 * @comment This function is generic for fetching JSON data, like our asset structure files.
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
        throw error; // Re-throw to be handled by the caller
    }
}

/**
 * Parses the asset list text (e.g., mp3list.txt) into an array of objects.
 * Each line is expected to be "long_folder_number file_name_with_extension".
 * @param {string} textContent - The raw text content of the list file.
 * @param {string} type - The type of asset (e.g., 'image', 'audio').
 * @returns {Array<object>} An array of asset descriptor objects.
 * @comment This function transforms the simple text lists into a structured array
 * that's easier to work with in our application.
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
        // Re-join parts from index 1 onwards to handle file names with spaces if any
        const fileName = parts.slice(1).join(' ');
        const fileExtension = fileName.split('.').pop();
        const fullPath = `${longFolderNumber}/1/${fileName}`; // Construct the full path based on game structure
        return {
            longFolderNumber,
            fileName,
            fileExtension,
            type, // 'image' or 'audio'
            fullPath,
            dataUrl: null, // Placeholder for actual image data URL
            originalDataUrl: null, // To keep track of the original for reset/comparison
            isEdited: false // Flag to track if the asset has been modified
        };
    }).filter(asset => asset !== null);
    console.log(`fileHandler.js: Parsed ${assets.length} ${type} assets.`);
    return assets;
}

/**
 * Loads all asset lists and their corresponding JSON data files.
 * Combines list information with base64 data from JSONs.
 * @param {Function} updateProgress - Callback function to update loading progress UI.
 * @returns {Promise<Array<object>>} A promise that resolves with a combined array of all assets.
 * @comment This is the main function for loading all initial game assets.
 */
export async function loadAllAssets(updateProgress) {
    console.log("fileHandler.js: Starting to load all assets...");
    const assetLists = {
        jpg: await fetchTextFile('assets/jpglist.txt'),
        png: await fetchTextFile('assets/pnglist.txt'),
        mp3: await fetchTextFile('assets/mp3list.txt')
    };

    const assetDataPromises = {
        jpg: fetchJsonFile('assets/jpg_files_structure.json'),
        png: fetchJsonFile('assets/png_files_structure.json'),
        mp3: fetchJsonFile('assets/mp3_files_structure.json')
    };

    // Wait for all JSON data to be fetched
    const [jpgData, pngData, mp3Data] = await Promise.all([
        assetDataPromises.jpg,
        assetDataPromises.png,
        assetDataPromises.mp3
    ]);

    const parsedJpgAssets = parseAssetList(assetLists.jpg, 'image');
    const parsedPngAssets = parseAssetList(assetLists.png, 'image');
    const parsedMp3Assets = parseAssetList(assetLists.mp3, 'audio');

    let allAssets = [];

    // Combine assets with their Base64 data
    const totalAssetsToProcess = parsedJpgAssets.length + parsedPngAssets.length + parsedMp3Assets.length;
    let processedAssetsCount = 0;

    // Helper to extract data from the nested JSON structure
    // This is the key change to handle the user's specific JSON format
    const getBase64DataFromNestedJson = (jsonObj, longFolderNumber, fileName) => {
        try {
            // Navigate the fixed path structure: mod-client-export -> Venge Client -> Resource Swapper -> files -> assets
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

            // Then, access by longFolderNumber, then '1', then fileName, and finally the 'data' field
            const folderData = assets[longFolderNumber];
            if (!folderData) return null;
            const oneKeyData = folderData['1'];
            if (!oneKeyData) return null;
            const fileEntry = oneKeyData[fileName];
            if (!fileEntry) return null;

            return fileEntry.data; // This is the Base64 string we need
        } catch (e) {
            console.error(`fileHandler.js: Error navigating JSON for ${longFolderNumber}/${fileName}:`, e);
            return null;
        }
    };


    // Helper to add data and update progress
    const addAssetsWithData = (parsedAssets, dataMap, mimeType, assetType) => {
        parsedAssets.forEach(asset => {
            let base64Data = null;

            // Attempt to get data from the deeply nested structure first
            base64Data = getBase64DataFromNestedJson(dataMap, asset.longFolderNumber, asset.fileName);

            // Fallback to previous logic if the nested structure doesn't yield data
            // (useful if other JSONs are in a flatter format, or if future JSONs change)
            if (!base64Data) {
                if (dataMap[asset.longFolderNumber] && dataMap[asset.longFolderNumber]['1']) {
                    base64Data = dataMap[asset.longFolderNumber]['1'];
                } else if (dataMap[asset.fullPath]) {
                    base64Data = dataMap[asset.fullPath];
                } else if (dataMap[asset.longFolderNumber] && typeof dataMap[asset.longFolderNumber] === 'object') {
                    base64Data = dataMap[asset.longFolderNumber][asset.fileName];
                }
            }


            if (base64Data) {
                // Prepend data URL prefix as it's typically just the raw base64 data in the JSON
                asset.dataUrl = createDataURL(base64Data, mimeType);
                asset.originalDataUrl = asset.dataUrl; // Store original for reset
                asset.mimeType = mimeType;
                asset.assetType = assetType; // 'image' or 'audio'
                allAssets.push(asset);
            } else {
                console.warn(`fileHandler.js: Data not found for asset: ${asset.fullPath}. Check JSON structure.`);
            }
            processedAssetsCount++;
            updateProgress(processedAssetsCount, totalAssetsToProcess, asset.fileName);
        });
    };

    addAssetsWithData(parsedJpgAssets, jpgData, 'image/jpeg', 'image');
    addAssetsWithData(parsedPngAssets, pngData, 'image/png', 'image');
    addAssetsWithData(parsedMp3Assets, mp3Data, 'audio/mpeg', 'audio'); // Assuming mp3 is audio/mpeg

    console.log(`fileHandler.js: Total assets loaded: ${allAssets.length}`);
    return allAssets;
}

