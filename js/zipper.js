// js/zipper.js

// JSZip library for creating zip files in the browser
// This will be loaded via a script tag in index.html or assumed available.
// For browser environment, we usually include it via CDN in index.html like:
// <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
// <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip-utils/0.1.0/jszip-utils.min.js"></script>

// We need to assume JSZip and JSZipUtils are available globally because of the CDN import.
// In a module context, if they aren't globally exposed, we would need to import them differently.
// For this setup, we're proceeding assuming they are attached to `window`.

import { allGameAssets } from './main.js'; // Access to all loaded assets

/**
 * Defines the mod folder structures for different export types.
 * @comment These paths are crucial for ensuring the mod works correctly with Venge.io.
 */
const MOD_STRUCTURES = {
    'client': {
        basePath: 'Venge Client/',
        assetRoot: 'Venge Client/Resource Swapper/files/assets/'
    },
    'browser': {
        basePath: 'Venge Client Browser/',
        assetRoot: 'Venge Client Browser/files/assets/',
        staticFiles: [ // These files will be fetched from 'browser-export-static-files.json'
            { name: 'index.html', pathInZip: 'Venge Client Browser/index.html' },
            { name: 'main.js', pathInZip: 'Venge Client Browser/main.js' },
            { name: 'styles.css', pathInZip: 'Venge Client Browser/styles.css' },
            // Add other static browser files as needed, from browser-export-static-files.json
        ]
    }
};

/**
 * Loads static files for browser export from a JSON file.
 * @returns {Promise<object>} A promise that resolves with an object where keys are file paths/names and values are their Base64 data.
 * @comment This function fetches the special JSON containing browser-specific static files.
 */
async function fetchBrowserStaticFiles() {
    console.log("zipper.js: Fetching browser static files from 'browser-export-static-files.json'...");
    try {
        const response = await fetch('assets/browser-export-static-files.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} for browser-export-static-files.json`);
        }
        const data = await response.json();
        console.log("zipper.js: Successfully fetched browser static files.");
        return data;
    } catch (error) {
        console.error("zipper.js: Error fetching browser static files:", error);
        // Return an empty object or re-throw based on desired error handling
        return {};
    }
}


/**
 * Converts a Data URL string to a Blob object.
 * This is necessary for JSZip.loadAsync with 'blob' type.
 * @param {string} dataurl - The Data URL string (e.g., "data:image/png;base64,...").
 * @returns {Promise<Blob>} A promise that resolves with the Blob object.
 * @comment Re-using a utility might be better, but including here for self-containment for JSZip.
 */
function dataURLToBlob(dataurl) {
    return new Promise((resolve, reject) => {
        const parts = dataurl.split(';base64,');
        if (parts.length < 2) {
            return reject(new Error("Invalid Data URL format"));
        }
        const mime = parts[0].split(':')[1];
        const base64 = parts[1];
        try {
            const byteString = atob(base64);
            const arrayBuffer = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(arrayBuffer);
            for (let i = 0; i < byteString.length; i++) {
                ia[i] = byteString.charCodeAt(i);
            }
            resolve(new Blob([arrayBuffer], { type: mime }));
        } catch (e) {
            reject(e);
        }
    });
}


/**
 * Initiates the download of all assets as a ZIP file.
 * This function handles both client and browser export types.
 * @param {string} exportType - 'client' or 'browser'.
 * @param {Function} updateProgress - Callback to update the loading overlay progress.
 * @comment This is the core function for generating and downloading the mod zip.
 */
export async function downloadAllAssetsAsZip(exportType, updateProgress) {
    console.log(`zipper.js: Starting download of all assets as ZIP (${exportType} export).`);

    updateProgress(0, 1, "Initializing ZIP creation..."); // Initial state for ZIP progress

    const zip = new JSZip();
    const structure = MOD_STRUCTURES[exportType];

    if (!structure) {
        console.error(`zipper.js: Invalid export type: ${exportType}`);
        updateProgress(0, 1, "Error: Invalid export type.");
        return;
    }

    let filesAddedCount = 0;
    let totalFiles = allGameAssets.length;

    // Add static files for browser export
    if (exportType === 'browser') {
        const browserStaticFilesData = await fetchBrowserStaticFiles();
        for (const staticFile of structure.staticFiles) {
            const fileContent = browserStaticFilesData[staticFile.name]; // Assuming key is the filename
            if (fileContent) {
                // Assuming staticFileContent might be raw text or base64 data depending on original content
                // If it's Base64, convert it to Blob
                if (fileContent.startsWith('data:')) { // Check if it's a data URL
                    const blob = await dataURLToBlob(fileContent);
                    zip.file(staticFile.pathInZip, blob);
                } else { // Assume it's plain text content
                    zip.file(staticFile.pathInZip, fileContent);
                }
                filesAddedCount++;
                totalFiles++; // Increment total count for static files
            } else {
                console.warn(`zipper.js: Static file content not found for: ${staticFile.name}`);
            }
        }
        updateProgress(filesAddedCount, totalFiles, `Added static browser files.`);
    }

    // Add all assets (original or edited) to the zip
    for (const asset of allGameAssets) {
        try {
            // Get the Data URL for the asset (either original or edited)
            const dataUrl = asset.dataUrl;

            // Extract just the base64 data part (after 'data:mime/type;base64,')
            const base64Content = dataUrl.split(';base64,')[1];
            if (!base64Content) {
                console.error(`zipper.js: Missing base64 content for ${asset.fileName}`);
                continue;
            }

            // Construct the path within the zip file based on the game's folder structure
            // Example: Venge Client/Resource Swapper/files/assets/long_folder_number/1/file_name.ext
            const zipPath = `${structure.assetRoot}${asset.longFolderNumber}/1/${asset.fileName}`;

            // Add the file to the zip. Use Base64 string directly for efficiency
            zip.file(zipPath, base64Content, { base64: true });

            filesAddedCount++;
            updateProgress(filesAddedCount, totalFiles, `Adding ${asset.fileName} to ZIP...`);
        } catch (error) {
            console.error(`zipper.js: Error adding asset ${asset.fileName} to zip:`, error);
        }
    }

    updateProgress(totalFiles, totalFiles, "Generating ZIP file..."); // Before actual generation

    // Generate the ZIP file
    try {
        const content = await zip.generateAsync({ type: "blob" }, (metadata) => {
            // JSZip provides progress feedback here, useful for large zips
            if (metadata.percent) {
                updateProgress(filesAddedCount + (totalFiles * metadata.percent / 100), totalFiles * 2, `Compressing: ${metadata.percent.toFixed(0)}%`);
            }
        });

        // Trigger download
        const zipFileName = `VengeMod_${exportType}_${new Date().toISOString().slice(0, 10)}.zip`;
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = zipFileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href); // Clean up the URL object

        console.log(`zipper.js: Successfully generated and downloaded ${zipFileName}`);
        updateProgress(totalFiles * 2, totalFiles * 2, "ZIP download complete!");
    } catch (error) {
        console.error("zipper.js: Error generating or downloading ZIP:", error);
        updateProgress(0, 1, `ZIP generation failed: ${error.message}`);
    }
}

console.log("zipper.js: Zip File Generation module loaded.");
