// js/main.js

// Import necessary functions from fileHandler.js
import { loadAllAssets } from './fileHandler.js';
// Import bulkTextureOperations.js to activate its event listeners
import './bulkTextureOperations.js';
// Import downloadAllAssetsAsZip for zip functionality
import { downloadAllAssetsAsZip } from './zipper.js';
// Import session management functions
import { exportChanges, importChanges } from './sessionManager.js';


// --- Global State Variables ---
// Store all loaded assets here. This will be the main source of truth for asset data.
let allGameAssets = [];
// Keep track of currently selected assets for bulk operations.
let selectedAssets = new Set();
// Flag to indicate if the application is in selection mode.
let isSelectMode = false;
// Store the index of the last selected card for shift+click functionality.
let lastSelectedIndex = -1;

// --- DOM Element References ---
const loadingOverlay = document.getElementById('loading-overlay');
const loadingAssetName = document.getElementById('loading-asset-name');
const loadingBar = document.getElementById('loading-bar');
const appContainer = document.getElementById('app-container');
const assetGrid = document.getElementById('asset-grid');
const selectedAssetsCounter = document.getElementById('selected-assets-counter');
const editSelectedBtn = document.getElementById('edit-selected-btn');
const selectModeBtn = document.getElementById('select-mode-btn');
const selectAllBtn = document.getElementById('select-all-btn');
const downloadAllBtn = document.getElementById('download-all-btn');
const importChangesBtn = document.getElementById('import-changes-btn'); // New reference for import button
const exportChangesBtn = document.getElementById('export-changes-btn'); // New reference for export button


// --- Functions to update UI ---

/**
 * Updates the loading progress bar and text on the loading overlay.
 * @param {number} loadedCount - The number of assets processed so far.
 * @param {number} totalCount - The total number of assets to process.
 * @param {string} assetName - The name of the asset currently being loaded/processed.
 * @comment This function is passed as a callback to `loadAllAssets` and `downloadAllAssetsAsZip` to provide real-time feedback to the user.
 */
function updateLoadingProgress(loadedCount, totalCount, assetName) {
    console.log(`main.js: Loading progress - ${loadedCount}/${totalCount} (${assetName})`);
    const progressPercentage = (loadedCount / totalCount) * 100;
    loadingBar.style.width = `${progressPercentage}%`;
    loadingAssetName.textContent = `Loading: ${assetName} (${loadedCount}/${totalCount})`;
}

/**
 * Renders a single asset card to the DOM.
 * @param {object} asset - The asset object containing details like longFolderNumber, fileName, dataUrl, etc.
 * @comment This function creates the HTML structure for each asset card.
 */
function renderAssetCard(asset) {
    const card = document.createElement('div');
    card.id = `asset-card-${asset.longFolderNumber}-${asset.fileName.replace(/\./g, '-')}`; // Unique ID for the card
    card.classList.add(
        'asset-card',
        'bg-gray-800', 'rounded-lg', 'shadow-lg', 'p-4', 'flex', 'flex-col', 'items-center',
        'transition', 'duration-200', 'ease-in-out', 'transform', 'hover:scale-105', 'cursor-pointer'
    );
    // Add border to indicate if it's edited
    if (asset.isEdited) {
        card.classList.add('border-2', 'border-white'); // White border for edited assets
    } else {
        card.classList.remove('border-2', 'border-white');
    }

    // Add selected class if the asset is currently selected
    if (selectedAssets.has(asset.fullPath)) {
        card.classList.add('bg-selected-card', 'border-cyan-500', 'border-2');
    } else {
        card.classList.remove('bg-selected-card', 'border-cyan-500', 'border-2');
    }

    // Display image for image assets, or a placeholder/icon for audio
    if (asset.assetType === 'image') {
        const img = document.createElement('img');
        img.src = asset.dataUrl;
        img.alt = asset.fileName;
        img.classList.add('mb-3', 'rounded-md', 'object-contain', 'h-32', 'w-full'); // Tailwind classes for image styling
        // Fallback for broken images
        img.onerror = (e) => {
            console.error(`main.js: Failed to load image for asset ${asset.fullPath}`, e);
            img.src = `https://placehold.co/120x120/4a5568/a0aec0?text=Image+Error`; // Placeholder image
            img.alt = "Image Load Error";
        };
        card.appendChild(img);
    } else if (asset.assetType === 'audio') {
        const audioIcon = document.createElement('div');
        audioIcon.classList.add('mb-3', 'text-6xl', 'text-gray-400');
        audioIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 6v.008l12-3v.008" />
                            </svg>`;
        card.appendChild(audioIcon);
        // Optional: Add a small audio player for preview (consider impact on performance for many audio files)
        // const audioPlayer = document.createElement('audio');
        // audioPlayer.src = asset.dataUrl;
        // audioPlayer.controls = true;
        // audioPlayer.classList.add('w-full', 'mt-2');
        // card.appendChild(audioPlayer);
    }

    const folderNumDiv = document.createElement('div');
    folderNumDiv.classList.add('text-sm', 'font-semibold', 'text-gray-300', 'mb-1');
    folderNumDiv.textContent = asset.longFolderNumber;
    card.appendChild(folderNumDiv);

    const fileNameDiv = document.createElement('div');
    fileNameDiv.classList.add('text-xs', 'text-gray-400', 'text-center', 'truncate', 'w-full', 'px-2');
    fileNameDiv.textContent = asset.fileName;
    card.appendChild(fileNameDiv);

    // Buttons Container
    const buttonsContainer = document.createElement('div');
    buttonsContainer.classList.add('flex', 'gap-2', 'mt-3', 'w-full', 'justify-center');

    // Copy Folder Number Button
    const copyBtn = document.createElement('button');
    copyBtn.classList.add('px-3', 'py-1', 'bg-indigo-600', 'hover:bg-indigo-700', 'text-white', 'rounded-md', 'text-xs', 'transition', 'duration-200');
    copyBtn.textContent = 'Copy ID';
    copyBtn.onclick = (e) => {
        e.stopPropagation(); // Prevent card selection when button is clicked
        navigator.clipboard.writeText(asset.longFolderNumber)
            .then(() => {
                console.log(`main.js: Copied ID: ${asset.longFolderNumber}`);
                // Optional: Provide visual feedback to the user (e.g., a temporary tooltip)
            })
            .catch(err => {
                console.error('main.js: Failed to copy ID:', err);
            });
    };
    buttonsContainer.appendChild(copyBtn);

    // Download Button
    const downloadBtn = document.createElement('button');
    downloadBtn.classList.add('px-3', 'py-1', 'bg-emerald-600', 'hover:bg-emerald-700', 'text-white', 'rounded-md', 'text-xs', 'transition', 'duration-200');
    downloadBtn.textContent = 'Download';
    downloadBtn.onclick = (e) => {
        e.stopPropagation(); // Prevent card selection when button is clicked
        console.log(`main.js: Initiating download for ${asset.fileName}`);
        const link = document.createElement('a');
        link.href = asset.dataUrl;
        link.download = asset.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    buttonsContainer.appendChild(downloadBtn);

    card.appendChild(buttonsContainer);

    // Attach click listener for selection
    card.addEventListener('click', (event) => {
        if (isSelectMode) {
            toggleAssetSelection(asset, card, event.shiftKey);
        }
    });

    assetGrid.appendChild(card);
}

/**
 * Renders all assets in the asset grid.
 * @param {Array<object>} assetsToRender - The array of assets to display.
 * @comment This clears the grid and re-renders all visible assets, useful for search/filter.
 */
function renderAllAssets(assetsToRender) {
    console.log(`main.js: Rendering ${assetsToRender.length} assets.`);
    assetGrid.innerHTML = ''; // Clear existing cards
    assetsToRender.forEach(asset => renderAssetCard(asset));
    updateSelectedAssetsCounter(); // Ensure counter is updated after rendering
}

/**
 * Toggles the selection state of an asset card.
 * @param {object} asset - The asset object associated with the card.
 * @param {HTMLElement} cardElement - The DOM element of the asset card.
 * @param {boolean} isShiftKey - True if the shift key was pressed during the click.
 * @comment Implements the single click and shift+click selection logic.
 */
function toggleAssetSelection(asset, cardElement, isShiftKey) {
    const assetId = asset.fullPath; // Use fullPath as a unique identifier for selection

    if (selectedAssets.has(assetId)) {
        // Deselect
        selectedAssets.delete(assetId);
        cardElement.classList.remove('bg-selected-card', 'border-cyan-500', 'border-2');
        console.log(`main.js: Deselected asset: ${asset.fileName}`);
    } else {
        // Select
        if (isShiftKey && lastSelectedIndex !== -1) {
            // Shift + Click: Select range
            console.log("main.js: Shift+click detected. Selecting range.");
            const currentAssetIndex = allGameAssets.findIndex(a => a.fullPath === asset.fullPath);
            const startIndex = Math.min(lastSelectedIndex, currentAssetIndex);
            const endIndex = Math.max(lastSelectedIndex, currentAssetIndex);

            for (let i = startIndex; i <= endIndex; i++) {
                const rangeAsset = allGameAssets[i];
                if (rangeAsset) {
                    const rangeCard = document.getElementById(`asset-card-${rangeAsset.longFolderNumber}-${rangeAsset.fileName.replace(/\./g, '-')}`);
                    if (rangeCard && !selectedAssets.has(rangeAsset.fullPath)) {
                        selectedAssets.add(rangeAsset.fullPath);
                        rangeCard.classList.add('bg-selected-card', 'border-cyan-500', 'border-2');
                    }
                }
            }
        } else {
            // Single click: Select individual asset
            selectedAssets.add(assetId);
            cardElement.classList.add('bg-selected-card', 'border-cyan-500', 'border-2');
            console.log(`main.js: Selected asset: ${asset.fileName}`);
        }
        lastSelectedIndex = allGameAssets.findIndex(a => a.fullPath === asset.fullPath);
    }
    updateSelectedAssetsCounter();
}


/**
 * Updates the counter displayed in the header for selected assets.
 * Also enables/disables the "Edit Selected Assets" button.
 * @comment This function ensures the UI reflects the current selection state.
 */
function updateSelectedAssetsCounter() {
    selectedAssetsCounter.textContent = selectedAssets.size;
    if (selectedAssets.size > 0) {
        editSelectedBtn.disabled = false;
        editSelectedBtn.classList.remove('cursor-not-allowed', 'opacity-50', 'bg-cyan-800');
        editSelectedBtn.classList.add('bg-cyan-600', 'hover:bg-cyan-700');
    } else {
        editSelectedBtn.disabled = true;
        editSelectedBtn.classList.add('cursor-not-allowed', 'opacity-50', 'bg-cyan-800');
        editSelectedBtn.classList.remove('bg-cyan-600', 'hover:bg-cyan-700');
    }
}

/**
 * Toggles the "Select Assets" mode.
 * In select mode, cards become clickable for selection.
 * @comment This function manages the UI state for asset selection.
 */
function toggleSelectMode() {
    isSelectMode = !isSelectMode;
    console.log(`main.js: Select mode toggled to: ${isSelectMode}`);

    if (isSelectMode) {
        selectModeBtn.classList.remove('bg-purple-600');
        selectModeBtn.classList.add('bg-purple-800', 'ring-2', 'ring-purple-400');
        selectAllBtn.classList.remove('hidden'); // Show "Select All Displayed" button
    } else {
        selectModeBtn.classList.remove('bg-purple-800', 'ring-2', 'ring-purple-400');
        selectModeBtn.classList.add('bg-purple-600');
        selectAllBtn.classList.add('hidden'); // Hide "Select All Displayed" button
        clearSelection(); // Clear selection when exiting select mode
    }
}

/**
 * Clears all currently selected assets and updates their card styling.
 * @comment Used when exiting select mode or clicking "Clear Selection".
 */
function clearSelection() {
    console.log("main.js: Clearing all selected assets.");
    selectedAssets.forEach(assetPath => {
        const asset = allGameAssets.find(a => a.fullPath === assetPath);
        if (asset) {
            const cardElement = document.getElementById(`asset-card-${asset.longFolderNumber}-${asset.fileName.replace(/\./g, '-')}`);
            if (cardElement) {
                cardElement.classList.remove('bg-selected-card', 'border-cyan-500', 'border-2');
            }
        }
    });
    selectedAssets.clear();
    lastSelectedIndex = -1; // Reset last selected index
    updateSelectedAssetsCounter();
}

/**
 * Selects all assets currently displayed in the grid.
 * @comment Useful for quick bulk operations on visible assets.
 */
function selectAllDisplayedAssets() {
    console.log("main.js: Selecting all currently displayed assets.");
    const currentAssetCards = assetGrid.querySelectorAll('.asset-card');
    currentAssetCards.forEach(cardElement => {
        // Extract asset details from card ID to find the corresponding asset object
        const parts = cardElement.id.split('-'); // e.g., "asset-card-LONGNUMBER-FILENAME-EXT"
        const longFolderNumber = parts[2];
        const fileNameWithExt = parts.slice(3).join('-').replace(/-/g, '.').replace(/\.ext$/, ''); // Reconstruct filename
        // Find the actual asset object
        const asset = allGameAssets.find(a => a.longFolderNumber === longFolderNumber && a.fileName === fileNameWithExt);

        if (asset && !selectedAssets.has(asset.fullPath)) {
            selectedAssets.add(asset.fullPath);
            cardElement.classList.add('bg-selected-card', 'border-cyan-500', 'border-2');
        }
    });
    updateSelectedAssetsCounter();
    console.log(`main.js: Total selected assets after 'Select All Displayed': ${selectedAssets.size}`);
}


/**
 * Handles search input: filters displayed assets based on user input.
 * @comment Provides real-time filtering as the user types.
 */
function handleSearchInput() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    console.log(`main.js: Search term changed to: "${searchTerm}"`);
    const filteredAssets = allGameAssets.filter(asset =>
        asset.fileName.toLowerCase().includes(searchTerm) ||
        asset.longFolderNumber.toLowerCase().includes(searchTerm)
    );
    renderAllAssets(filteredAssets);
}

/**
 * Updates the display of a specific asset card after it has been edited.
 * This will change its image preview and add the 'edited' border.
 * @param {string} fullPath - The full path of the edited asset (used to find its DOM element).
 * @param {string} newDataUrl - The new Data URL of the asset.
 * @comment This function ensures the UI reacts to image modifications.
 */
export function updateAssetCardDisplay(fullPath, newDataUrl) {
    const asset = allGameAssets.find(a => a.fullPath === fullPath);
    if (asset) {
        asset.dataUrl = newDataUrl; // Update the asset's data URL
        asset.isEdited = true; // Mark as edited

        const cardElement = document.getElementById(`asset-card-${asset.longFolderNumber}-${asset.fileName.replace(/\./g, '-')}`);
        if (cardElement) {
            // Update image source if it's an image asset
            if (asset.assetType === 'image') {
                const imgElement = cardElement.querySelector('img');
                if (imgElement) {
                    imgElement.src = newDataUrl;
                    console.log(`main.js: Updated image for card ${asset.fileName}`);
                }
            }
            // Add white border to indicate it's edited
            cardElement.classList.add('border-2', 'border-white');
            console.log(`main.js: Marked card for ${asset.fileName} as edited.`);
        }
    } else {
        console.warn(`main.js: Could not find asset with fullPath ${fullPath} to update its card display.`);
    }
}


// --- Event Listeners ---

// Listen for when the DOM is fully loaded before attempting to load assets
window.addEventListener('DOMContentLoaded', async () => {
    console.log("main.js: DOMContentLoaded. Starting asset loading process.");
    // Show loading overlay and hide app container initially
    loadingOverlay.classList.remove('hidden');
    appContainer.classList.add('hidden');

    try {
        // Load all assets and update progress using the callback
        allGameAssets = await loadAllAssets(updateLoadingProgress);
        console.log(`main.js: All assets loaded successfully. Total: ${allGameAssets.length}`);

        // Hide loading overlay and show main app container
        loadingOverlay.classList.add('hidden');
        appContainer.classList.remove('hidden');

        // Render all assets initially
        renderAllAssets(allGameAssets);

        // Debugging: Log first few assets to console
        console.log("main.js: First 5 loaded assets:", allGameAssets.slice(0, 5));

    } catch (error) {
        console.error("main.js: Failed to load assets:", error);
        loadingAssetName.textContent = `Error loading assets: ${error.message}`;
        loadingBar.style.width = '0%';
        // Potentially show a retry button or error message prominently
    }
});


// Header button event listeners
selectModeBtn.addEventListener('click', toggleSelectMode);
selectAllBtn.addEventListener('click', selectAllDisplayedAssets);
document.getElementById('clear-search-btn').addEventListener('click', () => {
    document.getElementById('search-input').value = ''; // Clear search input
    handleSearchInput(); // Re-render all assets
    clearSelection(); // Also clear selection on clear search
});
document.getElementById('search-input').addEventListener('input', handleSearchInput);

// Download All Assets button listener
downloadAllBtn.addEventListener('click', async () => {
    // Show a custom modal or better UI for export type choice later
    const exportType = prompt("Enter export type ('client' or 'browser'):").toLowerCase(); // Simple prompt for now

    if (exportType === 'client' || exportType === 'browser') {
        loadingOverlay.classList.remove('hidden'); // Show loading overlay during zipping
        loadingAssetName.textContent = `Preparing ${exportType} ZIP...`;
        loadingBar.style.width = '0%';
        try {
            await downloadAllAssetsAsZip(exportType, updateLoadingProgress);
            console.log(`main.js: ${exportType} ZIP process completed.`);
        } catch (error) {
            console.error(`main.js: Error during ${exportType} ZIP process:`, error);
            loadingAssetName.textContent = `Error during ZIP: ${error.message}`;
            loadingBar.style.width = '0%';
        } finally {
            // A short delay to ensure the "ZIP download complete!" message is visible
            setTimeout(() => {
                loadingOverlay.classList.add('hidden'); // Hide loading overlay after zipping
            }, 1000); // 1 second delay
        }
    } else {
        console.warn("main.js: Invalid export type entered. Please enter 'client' or 'browser'.");
        // Provide user feedback (e.g., a custom alert/toast)
    }
});

// Import Changes button listener
importChangesBtn.addEventListener('click', importChanges);

// Export Changes button listener
exportChangesBtn.addEventListener('click', exportChanges);


// --- Bulk Operations Modal Logic ---
const bulkOperationsModalOverlay = document.getElementById('bulk-operations-modal-overlay');
const closeModalBtn = document.getElementById('close-modal-btn');

editSelectedBtn.addEventListener('click', () => {
    if (selectedAssets.size > 0) {
        console.log("main.js: Opening bulk operations modal for selected assets.");
        bulkOperationsModalOverlay.classList.add('visible');
    } else {
        console.warn("main.js: Attempted to open modal with no assets selected.");
    }
});

closeModalBtn.addEventListener('click', () => {
    console.log("main.js: Closing bulk operations modal.");
    bulkOperationsModalOverlay.classList.remove('visible');
});

// Allow clicking outside the modal to close it
bulkOperationsModalOverlay.addEventListener('click', (event) => {
    if (event.target === bulkOperationsModalOverlay) {
        bulkOperationsModalOverlay.classList.remove('visible');
    }
});

// Export utility functions and variables if other modules need to access them
export { allGameAssets, selectedAssets, updateAssetCardDisplay, renderAllAssets };
