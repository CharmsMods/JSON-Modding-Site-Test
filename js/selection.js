// js/selection.js
// This file manages the selection state of asset cards.
import { updateSelectedAssetsCount } from './ui.js';
import { assetData, editedAssets } from './fileHandling.js'; // Need to import assetData to get asset type and editedAssets for exclusion status

let selectedAssets = new Set(); // Stores folderNumber/fileName strings of selected assets (for editing, cyan border)
let excludedAssets = new Set(); // Stores folderNumber/fileName strings of excluded assets (for export, red border)

let isSelectMode = false; // Toggles 'Select Assets' mode
let isExcludeMode = false; // Toggles 'Exclude from Export' mode

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
    document.getElementById('exclude-assets-btn').addEventListener('click', toggleExcludeMode);
}

/**
 * Handles clicks on asset cards for selection/exclusion.
 * @param {Event} event - The click event.
 */
function handleCardClick(event) {
    // Only proceed if either select mode or exclude mode is active
    if (!isSelectMode && !isExcludeMode) {
        // console.log('Selection: Neither select nor exclude mode is active. Card click ignored for selection/exclusion.');
        return; // Let other event listeners handle clicks (e.g., play button)
    }

    const card = event.target.closest('.asset-card');
    if (!card) {
        return; // Click was not on a card
    }

    // If the click target is a button inside the card, let the button's own handler take over
    if (event.target.tagName === 'BUTTON') {
        // console.log('Selection: Click on button, deferring to button handler.');
        return;
    }

    const folderNumber = card.dataset.folderNumber;
    const fileName = card.dataset.fileName;
    const assetKey = `${folderNumber}/${fileName}`;

    // Get the type of the clicked asset from the authoritative `assetData`
    const clickedAssetOriginalType = assetData[folderNumber]?.[fileName]?.originalType;
    if (!clickedAssetOriginalType) {
        console.warn(`Selection: Could not determine original type for clicked asset: ${assetKey}`);
        return;
    }

    // Determine if it's an image or mp3 for grouping
    const groupType = (clickedAssetOriginalType === 'jpg' || clickedAssetOriginalType === 'png') ? 'image' :
                      (clickedAssetOriginalType === 'mp3') ? 'mp3' : null;

    if (!groupType) {
        console.warn(`Selection: Unsupported asset type for selection: ${clickedAssetOriginalType}. Card click ignored.`);
        return; // Don't allow selection of unknown types
    }

    console.log(`Selection: Card clicked: ${assetKey}. Original Type: ${clickedAssetOriginalType}, Group: ${groupType}. Shift key: ${event.shiftKey}. Mode: ${isSelectMode ? 'Select' : 'Exclude'}`);

    // Type restriction logic (applies to both modes)
    // If nothing is selected/excluded in *either* set, set the allowed type based on the first eligible item clicked
    if (selectedAssets.size === 0 && excludedAssets.size === 0) {
        allowedSelectionType = groupType;
        console.log(`Selection: Setting allowed selection type to: ${allowedSelectionType}`);
    } else if (allowedSelectionType !== groupType) {
        // If something is already selected and the types don't match
        alert(`You can only select/exclude ${allowedSelectionType} files at a time (images or MP3s) within a single session.`);
        console.warn(`Selection: Attempted to select/exclude a ${groupType} file while ${allowedSelectionType} files are already selected/excluded.`);
        return; // Prevent selection/exclusion
    }

    // Handle selection/exclusion based on active mode
    if (isSelectMode) {
        handleToggleSelection(card, assetKey, event.shiftKey, groupType);
    } else if (isExcludeMode) {
        handleToggleExclusion(card, assetKey, event.shiftKey, groupType);
    }

    // Update last clicked card for next shift-click (applies to both modes)
    lastClickedCard = card;

    // If no assets are selected/excluded after an action, reset the allowed type
    if (selectedAssets.size === 0 && excludedAssets.size === 0) {
        allowedSelectionType = null;
        console.log('Selection: No assets selected/excluded, resetting allowed selection type.');
    }

    updateSelectedAssetsCount(selectedAssets.size + excludedAssets.size); // Display total count in header
}

/**
 * Toggles a card's selection state (cyan border).
 * @param {HTMLElement} card - The card DOM element.
 * @param {string} assetKey - The unique key for the asset.
 * @param {boolean} isShiftClick - True if shift key was pressed.
 * @param {string} groupType - The group type ('image' or 'mp3').
 */
function handleToggleSelection(card, assetKey, isShiftClick, groupType) {
    if (isShiftClick && lastClickedCard) {
        // Shift-click: Select range
        const allCards = Array.from(document.querySelectorAll('.asset-card'));
        const lastIndex = allCards.indexOf(lastClickedCard);
        const currentIndex = allCards.indexOf(card);

        const startIndex = Math.min(lastIndex, currentIndex);
        const endIndex = Math.max(lastIndex, currentIndex);

        for (let i = startIndex; i <= endIndex; i++) {
            const cardToModify = allCards[i];
            // Only process visible cards and those matching the group type
            if (cardToModify.style.display !== 'none') {
                const modifyFolder = cardToModify.dataset.folderNumber;
                const modifyFile = cardToModify.dataset.fileName;
                const modifyAssetKey = `${modifyFolder}/${modifyFile}`;
                const modifyAssetOriginalType = assetData[modifyFolder]?.[modifyFile]?.originalType;
                const modifyGroupType = (modifyAssetOriginalType === 'jpg' || modifyAssetOriginalType === 'png') ? 'image' :
                                        (modifyAssetOriginalType === 'mp3') ? 'mp3' : null;

                if (modifyGroupType === groupType) { // Ensure range selection respects type constraint
                    // Cannot select if currently excluded for export
                    if (excludedAssets.has(modifyAssetKey) || (editedAssets[modifyFolder] && editedAssets[modifyFolder][modifyFile] && editedAssets[modifyFolder][modifyFile].isExcluded)) {
                        console.log(`Selection: Cannot select ${modifyAssetKey}, it's currently excluded from export.`);
                        continue;
                    }
                    if (!selectedAssets.has(modifyAssetKey)) {
                        selectedAssets.add(modifyAssetKey);
                        toggleCardSelectionUI(cardToModify, true);
                    }
                }
            }
        }
    } else {
        // Regular click: Toggle single card selection
        if (selectedAssets.has(assetKey)) {
            selectedAssets.delete(assetKey);
            toggleCardSelectionUI(card, false);
        } else {
            // Cannot select if currently excluded for export
            if (excludedAssets.has(assetKey) || (editedAssets[folderNumber] && editedAssets[folderNumber][fileName] && editedAssets[folderNumber][fileName].isExcluded)) {
                alert("This asset is currently excluded from export. Please remove it from exclusion first.");
                return;
            }
            selectedAssets.add(assetKey);
            toggleCardSelectionUI(card, true);
        }
    }
}

/**
 * Toggles a card's exclusion state (red border).
 * @param {HTMLElement} card - The card DOM element.
 * @param {string} assetKey - The unique key for the asset.
 * @param {boolean} isShiftClick - True if shift key was pressed.
 * @param {string} groupType - The group type ('image' or 'mp3').
 */
function handleToggleExclusion(card, assetKey, isShiftClick, groupType) {
    if (isShiftClick && lastClickedCard) {
        // Shift-click: Exclude range
        const allCards = Array.from(document.querySelectorAll('.asset-card'));
        const lastIndex = allCards.indexOf(lastClickedCard);
        const currentIndex = allCards.indexOf(card);

        const startIndex = Math.min(lastIndex, currentIndex);
        const endIndex = Math.max(lastIndex, currentIndex);

        for (let i = startIndex; i <= endIndex; i++) {
            const cardToModify = allCards[i];
            // Only process visible cards and those matching the group type
            if (cardToModify.style.display !== 'none') {
                const modifyFolder = cardToModify.dataset.folderNumber;
                const modifyFile = cardToModify.dataset.fileName;
                const modifyAssetKey = `${modifyFolder}/${modifyFile}`;
                const modifyAssetOriginalType = assetData[modifyFolder]?.[modifyFile]?.originalType;
                const modifyGroupType = (modifyAssetOriginalType === 'jpg' || modifyAssetOriginalType === 'png') ? 'image' :
                                        (modifyAssetOriginalType === 'mp3') ? 'mp3' : null;

                if (modifyGroupType === groupType) { // Ensure range exclusion respects type constraint
                    // Cannot exclude if currently selected for editing
                    if (selectedAssets.has(modifyAssetKey) || cardToModify.classList.contains('selected')) { // Check actual class as well for UI consistency
                        console.log(`Selection: Cannot exclude ${modifyAssetKey}, it's currently selected for editing.`);
                        continue;
                    }
                    if (!excludedAssets.has(modifyAssetKey)) {
                        excludedAssets.add(modifyAssetKey);
                        toggleCardExclusionUI(cardToModify, true);
                        // Also update `isExcluded` status in `editedAssets` and `assetData`
                        if (assetData[modifyFolder] && assetData[modifyFolder][modifyFile]) {
                             // Use updateAssetInMemory to handle setting editedAssets and isEdited flag
                             const currentBase64 = assetData[modifyFolder][modifyFile].currentBase64;
                             const currentType = assetData[modifyFolder][modifyFile].type;
                             assetData[modifyFolder][modifyFile].isExcluded = true; // Update main assetData too
                             // Call updateAssetInMemory to ensure editedAssets is correctly set and isEdited flag is managed
                             // Pass null for base64Data/type if only updating exclusion status and not content
                             // Or, pass current data to simply update the flag within the edited object.
                             // Best to pass the current state so it doesn't revert data.
                             // NOTE: This might trigger UI update that redraws edited state.
                             import('./fileHandling.js').then(({ updateAssetInMemory }) => {
                                updateAssetInMemory(modifyFolder, modifyFile, currentBase64, currentType, true);
                             });
                        }
                    }
                }
            }
        }
    } else {
        // Regular click: Toggle single card exclusion
        const isCurrentlyExcluded = excludedAssets.has(assetKey);

        if (isCurrentlyExcluded) {
            excludedAssets.delete(assetKey);
            toggleCardExclusionUI(card, false);
            // Also update `isExcluded` status in `editedAssets` and `assetData`
            if (assetData[folderNumber] && assetData[folderNumber][fileName]) {
                const currentBase64 = assetData[folderNumber][fileName].currentBase64;
                const currentType = assetData[folderNumber][fileName].type;
                assetData[folderNumber][fileName].isExcluded = false; // Update main assetData too
                // Call updateAssetInMemory to ensure editedAssets is correctly set and isEdited flag is managed
                import('./fileHandling.js').then(({ updateAssetInMemory }) => {
                    updateAssetInMemory(folderNumber, fileName, currentBase64, currentType, false);
                });
            }
        } else {
            // Cannot exclude if currently selected for editing
            if (selectedAssets.has(assetKey) || card.classList.contains('selected')) {
                alert("This asset is currently selected for editing. Please deselect it first.");
                return;
            }
            excludedAssets.add(assetKey);
            toggleCardExclusionUI(card, true);
            // Also update `isExcluded` status in `editedAssets` and `assetData`
            if (assetData[folderNumber] && assetData[folderNumber][fileName]) {
                const currentBase64 = assetData[folderNumber][fileName].currentBase64;
                const currentType = assetData[folderNumber][fileName].type;
                assetData[folderNumber][fileName].isExcluded = true; // Update main assetData too
                 import('./fileHandling.js').then(({ updateAssetInMemory }) => {
                    updateAssetInMemory(folderNumber, fileName, currentBase64, currentType, true);
                 });
            }
        }
    }
}


/**
 * Toggles the 'Select Assets' mode on/off.
 */
export function toggleSelectMode() {
    isSelectMode = !isSelectMode;
    // When entering or exiting Select Mode, ensure Exclude Mode is OFF
    if (isExcludeMode) {
        isExcludeMode = false;
        document.getElementById('exclude-assets-btn').textContent = 'Exclude from Export';
        document.getElementById('exclude-assets-btn').style.backgroundColor = '';
        clearAllExclusions(); // Clear exclusions when switching modes
    }

    console.log(`Selection: Select mode is now ${isSelectMode ? 'ON' : 'OFF'}. Exclude mode is OFF.`);
    const selectButton = document.getElementById('select-assets-btn');
    const editButton = document.getElementById('edit-selected-btn'); // For enabling/disabling

    if (isSelectMode) {
        selectButton.textContent = 'Exit Select Mode';
        selectButton.style.backgroundColor = '#d19a66'; // Change color to indicate active mode
    } else {
        selectButton.textContent = 'Select Assets';
        selectButton.style.backgroundColor = ''; // Reset color
        clearAllSelections(); // Clear selections when exiting mode
    }
    // Update edit button state based on current selections
    editButton.disabled = selectedAssets.size === 0;
    updateSelectedAssetsCount(selectedAssets.size + excludedAssets.size); // Update total count
}

/**
 * Toggles the 'Exclude from Export' mode on/off.
 */
export function toggleExcludeMode() {
    isExcludeMode = !isExcludeMode;
    // When entering or exiting Exclude Mode, ensure Select Mode is OFF
    if (isSelectMode) {
        isSelectMode = false;
        document.getElementById('select-assets-btn').textContent = 'Select Assets';
        document.getElementById('select-assets-btn').style.backgroundColor = '';
        clearAllSelections(); // Clear selections when switching modes
    }

    console.log(`Selection: Exclude mode is now ${isExcludeMode ? 'ON' : 'OFF'}. Select mode is OFF.`);
    const excludeButton = document.getElementById('exclude-assets-btn');
    const editButton = document.getElementById('edit-selected-btn'); // For enabling/disabling

    if (isExcludeMode) {
        excludeButton.textContent = 'Exit Exclude Mode';
        excludeButton.style.backgroundColor = '#e74c3c'; // Red color for exclude mode
    } else {
        excludeButton.textContent = 'Exclude from Export';
        excludeButton.style.backgroundColor = ''; // Reset color
        clearAllExclusions(); // Clear exclusions when exiting mode
    }
    // Disable edit button when in exclude mode, regardless of selectedAssets count
    editButton.disabled = true; // Always disable edit button in exclude mode
    updateSelectedAssetsCount(selectedAssets.size + excludedAssets.size); // Update total count
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
            toggleCardSelectionUI(card, false);
        }
    });
    selectedAssets.clear();
    lastClickedCard = null;
    if (excludedAssets.size === 0) { // Only reset allowed type if nothing is selected or excluded
        allowedSelectionType = null;
    }
    updateSelectedAssetsCount(selectedAssets.size + excludedAssets.size);
}

/**
 * Clears all currently excluded assets. Also updates `isExcluded` status in `assetData` and `editedAssets`.
 */
export function clearAllExclusions() {
    console.log('Selection: Clearing all exclusions.');
    // Dynamically import fileHandling to avoid circular dependency
    import('./fileHandling.js').then(({ updateAssetInMemory }) => {
        excludedAssets.forEach(assetKey => {
            const [folderNumber, fileName] = assetKey.split('/');
            const card = document.querySelector(`.asset-card[data-folder-number="${folderNumber}"][data-file-name="${fileName}"]`);
            if (card) {
                toggleCardExclusionUI(card, false); // Remove red border
            }
            // Reset the isExcluded flag in the actual asset data
            if (assetData[folderNumber] && assetData[folderNumber][fileName]) {
                const currentBase64 = assetData[folderNumber][fileName].currentBase64;
                const currentType = assetData[folderNumber][fileName].type;
                updateAssetInMemory(folderNumber, fileName, currentBase64, currentType, false); // Explicitly set isExcluded to false
            }
        });
        excludedAssets.clear();
        lastClickedCard = null;
        if (selectedAssets.size === 0) { // Only reset allowed type if nothing is selected or excluded
            allowedSelectionType = null;
        }
        updateSelectedAssetsCount(selectedAssets.size + excludedAssets.size);
    });
}


/**
 * Selects/Excludes all currently displayed asset cards of the allowed type.
 */
export function selectAllDisplayedAssets() {
    if (!isSelectMode && !isExcludeMode) {
        console.warn('Selection: Cannot select/exclude all assets, not in an active mode.');
        return;
    }
    console.log(`Selection: Selecting/Excluding all displayed assets in ${isSelectMode ? 'Select' : 'Exclude'} mode.`);

    let typeToProcess = allowedSelectionType;
    const visibleCards = Array.from(document.querySelectorAll('.asset-card:not([style*="display: none"])'));

    // If no type is set yet (e.g., first action is "Select All"), determine it from the first eligible visible card
    if (!typeToProcess && visibleCards.length > 0) {
        const firstEligibleCard = visibleCards.find(card => {
            const folder = card.dataset.folderNumber;
            const file = card.dataset.fileName;
            const originalType = assetData[folder]?.[file]?.originalType;
            return (originalType === 'jpg' || originalType === 'png' || originalType === 'mp3');
        });

        if (firstEligibleCard) {
            const firstEligibleOriginalType = assetData[firstEligibleCard.dataset.folderNumber]?.[firstEligibleCard.dataset.fileName]?.originalType;
            typeToProcess = (firstEligibleOriginalType === 'jpg' || firstEligibleOriginalType === 'png') ? 'image' :
                             (firstEligibleOriginalType === 'mp3') ? 'mp3' : null;
            if (!typeToProcess) {
                alert('No eligible image or MP3 assets displayed to select/exclude.');
                console.warn('Selection: No eligible image or MP3 assets displayed for Select All.');
                return;
            }
            allowedSelectionType = typeToProcess; // Set the allowed type for the session
            console.log(`Selection: Determined type for Select All Displayed: ${typeToProcess}`);
        } else {
            alert('No assets are currently displayed to select/exclude.');
            return;
        }
    } else if (!typeToProcess) {
        alert('No assets are currently displayed to select/exclude.');
        return;
    }

    // Dynamically import updateAssetInMemory for updating exclusion status
    import('./fileHandling.js').then(({ updateAssetInMemory }) => {
        visibleCards.forEach(card => {
            const folderNumber = card.dataset.folderNumber;
            const fileName = card.dataset.fileName;
            const assetKey = `${folderNumber}/${fileName}`;
            const assetOriginalType = assetData[folderNumber]?.[fileName]?.originalType;
            const groupType = (assetOriginalType === 'jpg' || assetOriginalType === 'png') ? 'image' :
                              (assetOriginalType === 'mp3') ? 'mp3' : null;

            if (groupType === typeToProcess) {
                if (isSelectMode) {
                    // Only select if not already selected and not excluded
                    if (!selectedAssets.has(assetKey) && !excludedAssets.has(assetKey) && !(editedAssets[folderNumber] && editedAssets[folderNumber][fileName] && editedAssets[folderNumber][fileName].isExcluded)) {
                        selectedAssets.add(assetKey);
                        toggleCardSelectionUI(card, true);
                    }
                } else if (isExcludeMode) {
                    // Only exclude if not already excluded and not selected for editing
                    if (!excludedAssets.has(assetKey) && !selectedAssets.has(assetKey) && !card.classList.contains('selected')) {
                        excludedAssets.add(assetKey);
                        toggleCardExclusionUI(card, true);
                        // Update the in-memory asset state as well for export consistency
                        const currentBase64 = assetData[folderNumber][fileName].currentBase64;
                        const currentType = assetData[folderNumber][fileName].type;
                        updateAssetInMemory(folderNumber, fileName, currentBase64, currentType, true);
                    }
                }
            } else {
                console.log(`Selection: Skipping card ${assetKey} (type ${groupType}) in Select All Displayed because it does not match ${typeToProcess}.`);
            }
        });
        updateSelectedAssetsCount(selectedAssets.size + excludedAssets.size);
        lastClickedCard = null;
    });
}

/**
 * Returns a list of the currently selected asset details (for editing).
 * @returns {Array<object>} An array of objects, each with folderNumber, fileName, and currentBase64Data.
 */
export function getSelectedAssets() {
    const assetsDetails = [];
    selectedAssets.forEach(assetKey => {
        const [folderNumber, fileName] = assetKey.split('/');
        const assetInfo = assetData[folderNumber]?.[fileName];
        // Ensure it's not currently marked as excluded, as that would be a conflict for editing
        if (assetInfo && !assetInfo.isExcluded) {
            assetsDetails.push({
                folderNumber: folderNumber,
                fileName: fileName,
                base64Data: assetInfo.currentBase64,
                type: assetInfo.type
            });
        }
    });
    console.log('Selection: Retrieved selected assets for editing:', assetsDetails.map(a => a.fileName));
    return assetsDetails;
}

/**
 * Returns a set of asset keys (folder/fileName) for assets currently marked as excluded.
 * This function primarily reflects the state of the `excludedAssets` Set, which is managed by UI interactions.
 * The canonical source of truth for exclusion status for export is `editedAssets` and `assetData`.
 * @returns {Set<string>} A set of string keys for excluded assets.
 */
export function getExcludedAssets() {
    return new Set(excludedAssets); // Return a copy to prevent external modification
}

/**
 * Exposes the isSelectMode state.
 * @returns {boolean} True if in select mode, false otherwise.
 */
export function getIsSelectMode() {
    return isSelectMode;
}

/**
 * Exposes the isExcludeMode state.
 * @returns {boolean} True if in exclude mode, false otherwise.
 */
export function getIsExcludeMode() {
    return isExcludeMode;
}


/**
 * Returns the currently allowed selection type ('image' or 'mp3').
 * @returns {string|null} The allowed type or null if nothing is selected.
 */
export function getAllowedSelectionType() {
    return allowedSelectionType;
}

/**
 * For UI only: directly toggles the 'selected' class on a card.
 * This function is called by selection.js and fileHandling.js.
 * @param {HTMLElement} cardElement - The asset card DOM element.
 * @param {boolean} isSelected - True to add 'selected' class, false to remove.
 */
export function toggleCardSelectionUI(cardElement, isSelected) {
    if (isSelected) {
        cardElement.classList.add('selected');
    } else {
        cardElement.classList.remove('selected');
    }
    // Update edit button disabled state (only depends on selectedAssets, not excluded)
    // This is handled by updateSelectedAssetsCount now
    // const editButton = document.getElementById('edit-selected-btn');
    // editButton.disabled = document.querySelectorAll('.asset-card.selected').length === 0;
}

/**
 * For UI only: directly toggles the 'excluded' class on a card.
 * This function is called by selection.js and fileHandling.js.
 * @param {HTMLElement} cardElement - The asset card DOM element.
 * @param {boolean} isExcluded - True to add 'excluded' class, false to remove.
 */
export function toggleCardExclusionUI(cardElement, isExcluded) {
    if (isExcluded) {
        cardElement.classList.add('excluded');
    } else {
        cardElement.classList.remove('excluded');
    }
}