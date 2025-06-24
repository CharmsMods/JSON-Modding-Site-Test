// js/export.js
// This file handles the logic for exporting assets as a ZIP file.
import { assetData, editedAssets, base64ToBlob, getMimeType } from './fileHandling.js';
import { showLoadingOverlay, hideLoadingOverlay } from './ui.js';
// Note: getExcludedAssets is primarily for the UI selection Set.
// The true source for exclusion status in export should be `editedAssets` and `assetData`.
// import { getExcludedAssets } from './selection.js'; 

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
        const zip = new JSZip();

        let rootFolder = '';
        if (exportOption === 'client') {
            rootFolder = 'Venge Client/';
            // Add static client folders (CSS, Resource Swapper, Skin Swapper, Userscript)
            zip.folder(`${rootFolder}CSS`);
            zip.folder(`${rootFolder}Resource Swapper`); // This one will contain 'files/assets'
            zip.folder(`${rootFolder}Skin Swapper`);
            zip.folder(`${rootFolder}Userscript`);
            console.log('Export: Client export structure base folders added.');
        } else { // browser
            rootFolder = 'Venge Client Browser/';
            // This 'browser-export-static-files.json' would be a file you create in your 'assets' folder
            // containing base64 data for any static files needed for the browser client export.
            // Example structure: { "js/some_script.js": "BASE64_CONTENT_OF_SCRIPT", "css/styles.css": "BASE64_CONTENT_OF_CSS" }
            const browserStaticFiles = await fetchJsonFile('assets/browser-export-static-files.json').catch(e => {
                console.warn('Export: Could not load browser static files JSON. Skipping.', e);
                return {}; // Return empty object if file not found/error
            });
            for (const filePath in browserStaticFiles) {
                const base64Content = browserStaticFiles[filePath];
                if (!base64Content || typeof base64Content !== 'string') {
                    console.warn(`Export: Skipping malformed or missing content for static browser file: ${filePath}`);
                    continue;
                }
                try {
                    const blob = base64ToBlob(base64Content, 'application/octet-stream');
                    zip.file(`${rootFolder}${filePath}`, blob);
                    console.log(`Export: Added browser static file: ${filePath}`);
                } catch (blobError) {
                    console.error(`Export: Failed to create blob for static browser file ${filePath}:`, blobError);
                    alert(`Warning: Could not include static browser file ${filePath}. Check console for details.`);
                }
            }
        }

        const assetsFolderPath = `${rootFolder}files/assets/`;

        let processedCount = 0;
        // Count total assets for progress, excluding those that will be skipped for reasons other than exclusion (e.g., malformed data)
        const totalAssets = Object.keys(assetData).reduce((sum, folderNum) => sum + Object.keys(assetData[folderNum]).length, 0);

        for (const folderNumber in assetData) {
            for (const fileName in assetData[folderNumber]) {
                const assetKey = `${folderNumber}/${fileName}`;
                const originalAssetInfo = assetData[folderNumber][fileName]; // Get the original and current status

                // Check if the asset is explicitly marked as excluded
                if (originalAssetInfo.isExcluded) {
                    console.log(`Export: Skipping excluded asset: ${folderNumber}/${fileName}`);
                    processedCount++; // Still count for progress display
                    showLoadingOverlay('Compressing assets...', `${processedCount}/${totalAssets} files added. (Skipping excluded)`);
                    continue; // Skip this asset, do not add to ZIP
                }

                let fileContent;
                let mimeType;
                let isEditedAsset = false;

                // Use edited asset data if it exists and is not excluded
                if (editedAssets[folderNumber] && editedAssets[folderNumber][fileName]) {
                    const editedAsset = editedAssets[folderNumber][fileName];
                    // Double check if the edited asset itself is marked as excluded.
                    // This is redundant with the `originalAssetInfo.isExcluded` check above if that's kept synchronized.
                    if (editedAsset.isExcluded) {
                        console.log(`Export: Skipping edited asset ${folderNumber}/${fileName} due to its exclusion status.`);
                        processedCount++;
                        showLoadingOverlay('Compressing assets...', `${processedCount}/${totalAssets} files added. (Skipping excluded)`);
                        continue;
                    }
                    fileContent = editedAsset.base64Data;
                    mimeType = getMimeType(editedAsset.type);
                    isEditedAsset = true;
                    console.log(`Export: Including edited asset: ${folderNumber}/${fileName}`);
                } else {
                    // Otherwise, use the original asset data
                    fileContent = originalAssetInfo.originalBase64;
                    mimeType = getMimeType(originalAssetInfo.type);
                    console.log(`Export: Including original asset: ${folderNumber}/${fileName}`);
                }

                if (!fileContent || typeof fileContent !== 'string' || fileContent.length === 0) {
                    console.error(`Export: Skipping asset ${folderNumber}/${fileName} due to invalid or empty base64 data.`);
                    processedCount++; // Count for progress, but log error
                    continue;
                }

                try {
                    const blob = base64ToBlob(fileContent, mimeType);
                    // The crucial folder structure: files/assets/long-folder-number/1/file.ext
                    const zipPath = `${assetsFolderPath}${folderNumber}/1/${fileName}`;
                    zip.file(zipPath, blob);
                } catch (blobError) {
                    console.error(`Export: Failed to create blob for asset ${folderNumber}/${fileName}:`, blobError);
                    alert(`Warning: Could not include asset ${fileName} in ZIP. Check console for details.`);
                    processedCount++; // Count for progress, but log error
                    continue; // Continue with other assets even if one fails
                }

                processedCount++;
                showLoadingOverlay('Compressing assets...', `${processedCount}/${totalAssets} files added.`);
            }
        }

        console.log('Export: All eligible assets added to ZIP object. Generating ZIP file...');
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
        alert('An error occurred during ZIP export. Check console for details. (Likely a problem with an asset\'s data)');
    } finally {
        hideLoadingOverlay();
    }
}

/**
 * Helper function to fetch a JSON file.
 * @param {string} url - The URL of the JSON file.
 * @returns {Promise<object>} A promise that resolves with the parsed JSON data.
 */
async function fetchJsonFile(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
    }
    return response.json();
}