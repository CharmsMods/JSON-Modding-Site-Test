// js/export.js
// This file handles the logic for exporting the modified assets into ZIP files.
import { showLoadingOverlay, hideLoadingOverlay } from './ui.js';
import { assetData, editedAssets, base64ToBlob } from './fileHandling.js';

// We'll need a library for ZIP creation, like JSZip. Let's assume it's loaded from a CDN.
// For example, in index.html: <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>

/**
 * Initiates the download of all assets as a ZIP file.
 * This will include original assets for non-edited files and current (potentially edited) assets for edited files.
 */
export async function downloadAllAssetsAsZip() {
    console.log('Export: Initiating download of all assets as ZIP.');
    const exportOption = prompt('Choose export option: "client" or "browser". (Type "client" or "browser")').toLowerCase();

    if (exportOption !== 'client' && exportOption !== 'browser') {
        alert('Invalid export option. Please type "client" or "browser".');
        console.warn('Export: Invalid export option provided.');
        return;
    }

    showLoadingOverlay('Preparing assets for ZIP...', 'This may take a moment.');

    try {
        const zip = new JSZip(); // JSZip instance

        // Base folder for the ZIP structure
        let rootFolder = '';
        if (exportOption === 'client') {
            rootFolder = 'Venge Client/';
            // Add static client folders (CSS, Resource Swapper, Skin Swapper, Userscript)
            // Even if empty, their presence might be important for the mod structure
            zip.folder(`${rootFolder}CSS`);
            zip.folder(`${rootFolder}Resource Swapper`); // This one will contain 'files/assets'
            zip.folder(`${rootFolder}Skin Swapper`);
            zip.folder(`${rootFolder}Userscript`);
            console.log('Export: Client export structure base folders added.');
        } else { // browser
            rootFolder = 'Venge Client Browser/';
            // Add static browser files (dummy for now, based on browser-export-static-files.json)
            // NOTE: In a real scenario, you'd fetch this from your 'assets' folder
            // For now, returning an empty object from a dummy fetchJsonFile
            const browserStaticFiles = await fetchJsonFile('assets/browser-export-static-files.json');
            for (const filePath in browserStaticFiles) {
                const base64Content = browserStaticFiles[filePath];
                // Assuming filePath includes the full path like "script.js" or "lib/data.wasm"
                zip.file(`${rootFolder}${filePath}`, base64ToBlob(base64Content, 'application/octet-stream'));
                console.log(`Export: Added browser static file: ${filePath}`);
            }
        }

        const assetsFolderPath = `${rootFolder}files/assets/`;

        let processedCount = 0;
        const totalAssets = Object.keys(assetData).reduce((sum, folderNum) => sum + Object.keys(assetData[folderNum]).length, 0);

        for (const folderNumber in assetData) {
            for (const fileName in assetData[folderNumber]) {
                const asset = assetData[folderNumber][fileName];
                let fileContent;
                let mimeType;

                // Use edited asset if available, otherwise use original
                if (editedAssets[folderNumber] && editedAssets[folderNumber][fileName]) {
                    fileContent = editedAssets[folderNumber][fileName].base64Data;
                    mimeType = getMimeType(editedAssets[folderNumber][fileName].type);
                    console.log(`Export: Including edited asset: ${folderNumber}/${fileName}`);
                } else {
                    fileContent = asset.originalBase64;
                    mimeType = getMimeType(asset.type);
                    console.log(`Export: Including original asset: ${folderNumber}/${fileName}`);
                }

                const blob = base64ToBlob(fileContent, mimeType);
                // The crucial folder structure: files/assets/long-folder-number/1/file.ext
                const zipPath = `${assetsFolderPath}${folderNumber}/1/${fileName}`;
                zip.file(zipPath, blob);

                processedCount++;
                showLoadingOverlay('Compressing assets...', `${processedCount}/${totalAssets} files added.`);
            }
        }

        console.log('Export: All assets added to ZIP object. Generating ZIP file...');
        // Compression level set to 1 (fastest, least compression)
        const content = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 1 } }, (metadata) => {
            if (metadata.percent) {
                showLoadingOverlay('Generating ZIP file...', `ZIP Progress: ${metadata.percent.toFixed(2)}%`);
            }
        });

        // Trigger download
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Venge_Mod_${exportOption}_Export.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        alert('ZIP file created and download initiated!');
        console.log('Export: ZIP file successfully created and downloaded.');

    } catch (error) {
        console.error('Export: Error during ZIP creation or download:', error);
        alert('An error occurred during ZIP export. Check console for details.');
    } finally {
        hideLoadingOverlay();
    }
}

/**
 * Helper function to get MIME type from asset type.
 * @param {string} type - The asset type (e.g., 'jpg', 'png', 'mp3').
 * @returns {string} The corresponding MIME type.
 */
function getMimeType(type) {
    switch (type) {
        case 'jpg':
            return 'image/jpeg';
        case 'png':
            return 'image/png';
        case 'mp3':
            return 'audio/mpeg';
        default:
            return 'application/octet-stream';
    }
}

/**
 * Dummy fetch for browser-export-static-files.json if it doesn't exist yet.
 * This function would be replaced with actual fetching from the 'assets' folder
 * if you had predefined static files for the browser export that were also base64 encoded.
 * For now, it returns an empty object to prevent errors.
 * @param {string} url - The URL to fetch.
 * @returns {Promise<object>} A promise resolving to an empty object for now.
 */
async function fetchJsonFile(url) {
    console.log(`Export: Attempting to fetch browser static files from ${url}. If this file exists, ensure it's properly structured. Currently returning empty object.`);
    // In a real scenario, you'd fetch this from your 'assets' folder
    // For now, return an empty object to prevent errors if the file is not yet created.
    // Example content for browser-export-static-files.json could be:
    // {
    //   "script.js": "base64_of_script_js",
    //   "css/style.css": "base64_of_style_css"
    // }
    try {
        const response = await fetch(url);
        if (response.ok) {
            return await response.json();
        } else {
            console.warn(`Export: ${url} not found or inaccessible. Returning empty object for browser static files.`);
            return {};
        }
    } catch (error) {
        console.warn(`Export: Error fetching ${url}. Returning empty object for browser static files. Error:`, error);
        return {};
    }
}