// js/selection.js
// This file manages the selection state of asset cards.
import { updateSelectedAssetsCount, toggleCardSelection } from './ui.js';

let selectedAssets = new Set(); // Stores folderNumber/fileName strings of selected assets
let isSelectMode = false; // Toggles selection mode
let lastClickedCard = null; // Used for shift-click functionality

/**
 * Initializes selection event listeners.
 * Should be called after assets are loaded and cards are present.
 */
export function initializeSelection() {
    console.log('Selection: Initializing selection event listeners.');
    const assetGrid = document.getElementById('asset-grid');
    assetGrid.addEventListener('click', handleCardClick);

    document.getElementById('select-assets-btn').addEventListener('click', toggleSelectMode);
    // Event listener for "Edit Selected Assets" button (will open modal)
    // This listener will be in main.js or bulkOperations.js once we integrate them
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

    console.log(`Selection: Card clicked: ${assetKey}. Shift key: ${event.shiftKey}`);

    if (event.shiftKey && lastClickedCard) {
        // Shift-click: Select range
        const allCards = Array.from(document.querySelectorAll('.asset-card'));
        const lastIndex = allCards.indexOf(lastClickedCard);
        const currentIndex = allCards.indexOf(card);

        const startIndex = Math.min(lastIndex, currentIndex);
        const endIndex = Math.max(lastIndex, currentIndex);

        for (let i = startIndex; i <= endIndex; i++) {
            const cardToSelect = allCards[i];
            // Only select if the card is currently displayed
            if (cardToSelect.style.display !== 'none') {
                const selectKey = `${cardToSelect.dataset.folderNumber}/${cardToSelect.dataset.fileName}`;
                if (!selectedAssets.has(selectKey)) {
                    selectedAssets.add(selectKey);
                    toggleCardSelection(cardToSelect, true);
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
    console.log('Selection: Current selected assets:', Array.from(selectedAssets));
}

/**
 * Toggles the selection mode on/off.
 */
function toggleSelectMode() {
    isSelectMode = !isSelectMode;
    console.log(`Selection: Select mode is now ${isSelectMode ? 'ON' : 'OFF'}.`);
    const selectButton = document.getElementById('select-assets-btn');
    const selectAllBtn = document.getElementById('select-all-displayed-btn'); // Get the Select All button

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
    updateSelectedAssetsCount(0);
}

/**
 * Selects all currently displayed asset cards.
 */
export function selectAllDisplayedAssets() {
    if (!isSelectMode) {
        console.warn('Selection: Cannot select all assets, not in select mode.');
        return;
    }
    console.log('Selection: Selecting all displayed assets.');
    // Only select cards that are currently visible (not display: none)
    document.querySelectorAll('.asset-card').forEach(card => {
        if (card.style.display !== 'none') { // Check if the card is visible
            const folderNumber = card.dataset.folderNumber;
            const fileName = card.dataset.fileName;
            const assetKey = `${folderNumber}/${fileName}`;
            if (!selectedAssets.has(assetKey)) {
                selectedAssets.add(assetKey);
                toggleCardSelection(card, true);
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
        // Assuming assetData is accessible (it's exported from fileHandling.js)
        // If not, it needs to be passed or imported.
        const assetInfo = window.assetData[folderNumber]?.[fileName]; // Access from window if globally available
        if (assetInfo) {
            assetsDetails.push({
                folderNumber: folderNumber,
                fileName: fileName,
                base64Data: assetInfo.currentBase64,
                type: assetInfo.type // Include type
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