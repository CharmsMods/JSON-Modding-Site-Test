// js/selection.js
// This file manages the selection state of asset cards.
import { updateSelectedAssetsCount, toggleCardSelection } from './ui.js';
import { assetData } from './fileHandling.js'; // Need to import assetData to get asset type

let selectedAssets = new Set(); // Stores folderNumber/fileName strings of selected assets
let isSelectMode = false; // Toggles selection mode
let lastClickedCard = null; // Used for shift-click functionality
let allowedSelectionType = null; // 'image' or 'mp3' - restricts what can be selected together

/**
 * Initializes selection event listeners.
 * Should be called after assets are loaded and cards are present.
 */
export function initializeSelection() {
    console.log('Selection: Initializing selection event listeners.');
    const assetGrid = document.getElementById('asset-grid');
    assetGrid.addEventListener('click', handleCardClick);

    document.getElementById('select-assets-btn').addEventListener('click', toggleSelectMode);
}

/**
 * Handles clicks on asset cards for selection.
 * @param {Event} event - The click event.
 */
function handleCardClick(event) {
    if (!isSelectMode) {
        console.log('Selection: Not in select mode. Card click ignored.');
        return;
    }

    const card = event.target.closest('.asset-card');
    if (!card) {
        return; // Click was not on a card
    }

    const folderNumber = card.dataset.folderNumber;
    const fileName = card.dataset.fileName;
    const assetKey = `${folderNumber}/${fileName}`;

    // Get the type of the clicked asset
    const clickedAssetType = assetData[folderNumber]?.[fileName]?.type;
    if (!clickedAssetType) {
        console.warn(`Selection: Could not determine type for clicked asset: ${assetKey}`);
        return;
    }

    // Determine if it's an image or mp3 for grouping
    const groupType = (clickedAssetType === 'jpg' || clickedAssetType === 'png') ? 'image' :
                      (clickedAssetType === 'mp3') ? 'mp3' : null;

    if (!groupType) {
        console.warn(`Selection: Unsupported asset type for selection: ${clickedAssetType}`);
        return; // Don't allow selection of unknown types
    }

    console.log(`Selection: Card clicked: ${assetKey}. Type: ${clickedAssetType}, Group: ${groupType}. Shift key: ${event.shiftKey}`);

    // Type restriction logic
    if (selectedAssets.size === 0) {
        // If nothing is selected, set the allowed type based on the first selected item
        allowedSelectionType = groupType;
        console.log(`Selection: Setting allowed selection type to: ${allowedSelectionType}`);
    } else if (allowedSelectionType !== groupType) {
        // If something is already selected and the types don't match
        alert(`You can only select ${allowedSelectionType} files at a time (images or MP3s).`);
        console.warn(`Selection: Attempted to select a ${groupType} file while ${allowedSelectionType} files are already selected.`);
        return; // Prevent selection
    }


    if (event.shiftKey && lastClickedCard) {
        // Shift-click: Select range
        const allCards = Array.from(document.querySelectorAll('.asset-card'));
        const lastIndex = allCards.indexOf(lastClickedCard);
        const currentIndex = allCards.indexOf(card);

        const startIndex = Math.min(lastIndex, currentIndex);
        const endIndex = Math.max(lastIndex, currentIndex);

        for (let i = startIndex; i <= endIndex; i++) {
            const cardToSelect = allCards[i];
            // Only select if the card is currently displayed AND matches the allowed type
            if (cardToSelect.style.display !== 'none') {
                const selectFolderNumber = cardToSelect.dataset.folderNumber;
                const selectFileName = cardToSelect.dataset.fileName;
                const selectAssetKey = `${selectFolderNumber}/${selectFileName}`;
                const selectAssetOriginalType = assetData[selectFolderNumber]?.[selectFileName]?.type;
                const selectGroupType = (selectAssetOriginalType === 'jpg' || selectAssetOriginalType === 'png') ? 'image' :
                                        (selectAssetOriginalType === 'mp3') ? 'mp3' : null;

                if (selectGroupType === allowedSelectionType) { // Ensure range selection also respects the type constraint
                    if (!selectedAssets.has(selectAssetKey)) {
                        selectedAssets.add(selectAssetKey);
                        toggleCardSelection(cardToSelect, true);
                    }
                } else {
                    console.warn(`Selection: Skipping card ${selectAssetKey} in shift-click range due to type mismatch (${selectGroupType} vs ${allowedSelectionType}).`);
                }
            }
        }
    } else {
        // Regular click: Toggle single card selection
        if (selectedAssets.has(assetKey)) {
            selectedAssets.delete(assetKey);
            toggleCardSelection(card, false);
        } else {
            selectedAssets.add(assetKey);
            toggleCardSelection(card, true);
        }
    }

    lastClickedCard = card; // Update last clicked card for next shift-click
    updateSelectedAssetsCount(selectedAssets.size);

    // If no assets are selected after an action, reset the allowed type
    if (selectedAssets.size === 0) {
        allowedSelectionType = null;
        console.log('Selection: No assets selected, resetting allowed selection type.');
    }

    console.log('Selection: Current selected assets:', Array.from(selectedAssets));
}

/**
 * Toggles the selection mode on/off.
 */
function toggleSelectMode() {
    isSelectMode = !isSelectMode;
    console.log(`Selection: Select mode is now ${isSelectMode ? 'ON' : 'OFF'}.`);
    const selectButton = document.getElementById('select-assets-btn');
    const selectAllBtn = document.getElementById('select-all-displayed-btn');

    if (isSelectMode) {
        selectButton.textContent = 'Exit Select Mode';
        selectButton.style.backgroundColor = '#d19a66'; // Change color to indicate active mode
        if (selectAllBtn) {
            selectAllBtn.classList.remove('hidden'); // Show Select All button
        }
    } else {
        selectButton.textContent = 'Select Assets';
        selectButton.style.backgroundColor = ''; // Reset color
        clearAllSelections(); // Clear selections when exiting mode
        if (selectAllBtn) {
            selectAllBtn.classList.add('hidden'); // Hide Select All button
        }
    }
}

/**
 * Clears all currently selected assets.
 */
export function clearAllSelections() {
    console.log('Selection: Clearing all selections.');
    selectedAssets.forEach(assetKey => {
        const [folderNumber, fileName] = assetKey.split('/');
        const card = document.querySelector(`.asset-card[data-folder-number="${folderNumber}"][data-file-name="${fileName}"]`);
        if (card) {
            toggleCardSelection(card, false);
        }
    });
    selectedAssets.clear();
    lastClickedCard = null;
    allowedSelectionType = null; // Reset allowed type when selections are cleared
    updateSelectedAssetsCount(0);
}

/**
 * Selects all currently displayed asset cards of the allowed type.
 */
export function selectAllDisplayedAssets() {
    if (!isSelectMode) {
        console.warn('Selection: Cannot select all assets, not in select mode.');
        return;
    }
    console.log('Selection: Selecting all displayed assets.');
    // Determine the type to select based on current allowedSelectionType
    // If nothing is selected, we need to determine it from the first visible eligible card,
    // or prompt the user if they're trying to select nothing.
    let typeToSelect = allowedSelectionType;
    if (!typeToSelect && document.querySelectorAll('.asset-card:not([style*="display: none"])').length > 0) {
        // If selectAllDisplayed is clicked and no specific type is allowed yet,
        // determine it from the first visible card.
        const firstVisibleCard = document.querySelector('.asset-card:not([style*="display: none"])');
        const firstVisibleFolder = firstVisibleCard.dataset.folderNumber;
        const firstVisibleFile = firstVisibleCard.dataset.fileName;
        const firstVisibleAssetType = assetData[firstVisibleFolder]?.[firstVisibleFile]?.type;
        typeToSelect = (firstVisibleAssetType === 'jpg' || firstVisibleAssetType === 'png') ? 'image' :
                       (firstVisibleAssetType === 'mp3') ? 'mp3' : null;
        if (!typeToSelect) {
            alert('No eligible image or MP3 assets displayed to select.');
            console.warn('Selection: No eligible image or MP3 assets displayed for Select All.');
            return;
        }
        allowedSelectionType = typeToSelect; // Set it for subsequent single selections
        console.log(`Selection: Determined type for Select All Displayed: ${typeToSelect}`);
    } else if (!typeToSelect) {
        // No assets displayed at all
        alert('No assets are currently displayed to select.');
        return;
    }


    document.querySelectorAll('.asset-card').forEach(card => {
        if (card.style.display !== 'none') { // Check if the card is visible
            const folderNumber = card.dataset.folderNumber;
            const fileName = card.dataset.fileName;
            const assetKey = `${folderNumber}/${fileName}`;
            const assetOriginalType = assetData[folderNumber]?.[fileName]?.type;
            const groupType = (assetOriginalType === 'jpg' || assetOriginalType === 'png') ? 'image' :
                              (assetOriginalType === 'mp3') ? 'mp3' : null;

            // Only select if the card matches the determined type to select
            if (groupType === typeToSelect) {
                if (!selectedAssets.has(assetKey)) {
                    selectedAssets.add(assetKey);
                    toggleCardSelection(card, true);
                }
            } else {
                console.log(`Selection: Skipping card ${assetKey} (type ${groupType}) in Select All Displayed because it does not match ${typeToSelect}.`);
            }
        }
    });
    updateSelectedAssetsCount(selectedAssets.size);
    lastClickedCard = null; // Reset last clicked card after select all
}

/**
 * Returns a list of the currently selected asset details.
 * @returns {Array<object>} An array of objects, each with folderNumber, fileName, and currentBase64Data.
 */
export function getSelectedAssets() {
    const assetsDetails = [];
    selectedAssets.forEach(assetKey => {
        const [folderNumber, fileName] = assetKey.split('/');
        const assetInfo = assetData[folderNumber]?.[fileName];
        if (assetInfo) {
            assetsDetails.push({
                folderNumber: folderNumber,
                fileName: fileName,
                base64Data: assetInfo.currentBase64,
                type: assetInfo.type
            });
        }
    });
    console.log('Selection: Retrieved selected assets:', assetsDetails.map(a => a.fileName));
    return assetsDetails;
}

/**
 * Exposes the isSelectMode state.
 * @returns {boolean} True if in select mode, false otherwise.
 */
export function getIsSelectMode() {
    return isSelectMode;
}

/**
 * Returns the currently allowed selection type ('image' or 'mp3').
 * @returns {string|null} The allowed type or null if nothing is selected.
 */
export function getAllowedSelectionType() {
    return allowedSelectionType;
}