// exportImport.js

import { blobToBase64, base64ToBlob, showLoader } from './utils.js';
// JSZip library would be required for ZIP functionality.
// You'd typically include it via a <script> tag in index.html:
// <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>

const CLIENT_EXPORT_BASE_PATH = "Venge Client/Resource Swapper/files/assets/";
const BROWSER_EXPORT_BASE_PATH = "files/assets/";

/**
 * Exports the modified assets as a ZIP file or an uncompressed folder.
 * Requires JSZip library for ZIP functionality.
 * @param {Array<import('./fileLoader.js').ModAsset>} assets The array of all ModAsset objects.
 * @param {string} exportType 'zip' or 'folder'.
 * @param {string} exportMode 'client' or 'browser'.
 */
export async function exportMod(assets, exportType, exportMode) {
    showLoader(true, 0, 'Preparing export...');

    const zip = new JSZip(); // Assuming JSZip is loaded globally or imported

    const filteredAssets = assets.filter(asset => asset.isEdited && !asset.isExcluded);

    if (filteredAssets.length === 0) {
        alert('No edited assets to export. Please modify some assets first.');
        showLoader(false);
        return;
    }

    const totalFiles = filteredAssets.length;
    let processedFiles = 0;

    for (const asset of filteredAssets) {
        processedFiles++;
        showLoader(true, (processedFiles / totalFiles) * 100, `Adding ${asset.fileName} to bundle...`);

        try {
            const blob = base64ToBlob(asset.base64Data);

            let filePath;
            if (exportMode === 'client') {
                filePath = `${CLIENT_EXPORT_BASE_PATH}${asset.folderNumber}/1/${asset.fileName}`;
            } else if (exportMode === 'browser') {
                filePath = `${BROWSER_EXPORT_BASE_PATH}${asset.folderNumber}/1/${asset.fileName}`;
            } else {
                throw new Error('Invalid export mode specified.');
            }

            zip.file(filePath, blob, { base64: false });

        } catch (error) {
            console.error(`Failed to add asset ${asset.id} to zip:`, error);
        }
    }

    if (exportType === 'zip') {
        showLoader(true, 0, 'Compressing files...');
        try {
            const content = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 9 } }, (metadata) => {
                showLoader(true, metadata.percent, `Compressing: ${metadata.currentFile || '...'}`);
            });
            const filename = exportMode === 'client' ? 'Venge_Client_Mod.zip' : 'Venge_Browser_Mod.zip';
            saveAs(content, filename); // saveAs function comes from FileSaver.js (another library)
                                       // <script src="https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js"></script>
            alert('Mod exported successfully as ZIP!'); // Temporary feedback
        } catch (error) {
            console.error('Error generating ZIP:', error);
            alert('Failed to generate ZIP file.'); // Temporary feedback
        }
    } else if (exportType === 'folder') {
        // For 'folder' export, we effectively create a nested zip and immediately extract it
        // The browser typically handles "downloading a folder" by creating a zip on the fly anyway.
        // A direct 'folder' export implies downloading individual files into a structured directory
        // but browsers don't directly support saving to arbitrary local file paths for security.
        // The common workaround is to still generate a ZIP and prompt the user to extract it.
        // Or, if targeting a specific environment (like an Electron app), direct folder creation is possible.
        // For a web browser, ZIP is the practical way to export a "folder structure".

        // For simplicity and browser compatibility, we'll suggest downloading the ZIP and manually extracting.
        // If a true "uncompressed folder" is strictly required without user interaction for extraction,
        // this would typically involve a backend service or a browser extension/desktop app.
        alert('Browser security prevents direct folder creation. The mod will be exported as a ZIP file. Please extract it manually to get the folder structure.');
        try {
             showLoader(true, 0, 'Generating folder structure (as ZIP)...');
             const content = await zip.generateAsync({ type: "blob", compression: "STORE" }, (metadata) => { // No compression
                 showLoader(true, metadata.percent, `Bundling: ${metadata.currentFile || '...'}`);
             });
             const filename = exportMode === 'client' ? 'Venge_Client_Mod_Folder.zip' : 'Venge_Browser_Mod_Folder.zip';
             saveAs(content, filename); // Using FileSaver.js
             alert('Uncompressed mod folder bundle exported successfully as ZIP. Please extract it manually.');
         } catch (error) {
             console.error('Error generating uncompressed ZIP:', error);
             alert('Failed to generate uncompressed mod folder.');
         }
    }
    showLoader(false);
}

/**
 * Saves the current session state to a JSON file.
 * Includes edited assets' base64 data and exclusion status.
 * @param {Array<import('./fileLoader.js').ModAsset>} assets The array of all ModAsset objects.
 */
export function saveSession(assets) {
    const sessionData = assets.map(asset => ({
        id: asset.id,
        isEdited: asset.isEdited,
        isExcluded: asset.isExcluded,
        base64Data: asset.isEdited ? asset.base64Data : undefined // Only save base64 if edited
    }));

    const dataStr = JSON.stringify(sessionData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    saveAs(blob, 'venge_mod_session.json'); // Using FileSaver.js
    console.log('Session saved.');
}

/**
 * Loads a session from a JSON file and applies it to the assets.
 * @param {File} file The JSON file selected by the user.
 * @param {Array<import('./fileLoader.js').ModAsset>} assets The array of all ModAsset objects (will be modified).
 * @returns {Promise<Array<string>>} A promise that resolves with an array of IDs of the assets that were modified/reloaded.
 */
export async function loadSession(file, assets) {
    showLoader(true, 0, 'Loading session file...');
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = async (event) => {
            try {
                const sessionData = JSON.parse(event.target.result);
                const updatedAssetIds = [];
                let processedCount = 0;
                const totalUpdates = sessionData.length;

                for (const sessionAsset of sessionData) {
                    processedCount++;
                    showLoader(true, (processedCount / totalUpdates) * 100, `Applying session: ${sessionAsset.id}`);

                    const asset = assets.find(a => a.id === sessionAsset.id);
                    if (asset) {
                        asset.isEdited = sessionAsset.isEdited;
                        asset.isExcluded = sessionAsset.isExcluded;
                        if (sessionAsset.isEdited && sessionAsset.base64Data) {
                            asset.base64Data = sessionAsset.base64Data;
                        }
                        updatedAssetIds.push(asset.id);
                    } else {
                        console.warn(`Asset ${sessionAsset.id} from session not found in current loaded assets.`);
                    }
                }
                showLoader(false);
                console.log('Session loaded successfully. Applied to assets:', updatedAssetIds.length);
                resolve(updatedAssetIds);
            } catch (e) {
                showLoader(false);
                console.error('Error parsing or applying session file:', e);
                alert('Failed to load session file. Make sure it is a valid JSON.'); // Temporary feedback
                reject(e);
            }
        };

        reader.onerror = (error) => {
            showLoader(false);
            console.error('Error reading session file:', error);
            alert('Failed to read session file.'); // Temporary feedback
            reject(error);
        };

        reader.readAsText(file);
    });
}