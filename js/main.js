// js/main.js
import { loadAllAssetsIntoMemory, downloadAsset, importChanges, exportChanges, assetData } from './fileHandling.js';
import { initializeSelection, clearAllSelections, selectAllDisplayedAssets, getIsSelectMode, getIsExcludeMode, clearAllExclusions } from './selection.js';
import { initializeBulkOperations } from './bulkOperations.js';
import { showLoadingOverlay, hideLoadingOverlay } from './ui.js';
import { downloadAllAssetsAsZip } from './export.js';

// Expose assetData globally or for other modules if needed (e.g., selection.js uses it directly)
window.assetData = assetData; 

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Main: DOMContentLoaded. Initializing application...');
    await loadAllAssetsIntoMemory(); // Load all assets first

    initializeSelection(); // Set up card selection logic
    initializeBulkOperations(); // Set up bulk operations modal logic

    // Event Listeners for Header Buttons
    document.getElementById('clear-search-btn').addEventListener('click', handleClearSearch);
    document.getElementById('download-all-zip-btn').addEventListener('click', () => {
        downloadAllAssetsAsZip();
    });
    document.getElementById('import-changes-btn').addEventListener('click', handleImportChanges);
    document.getElementById('export-changes-btn').addEventListener('click', exportChanges);

    const searchBar = document.getElementById('search-bar');
    searchBar.addEventListener('input', handleSearchInput);

    // Event listener for "Select All Currently Displaying Assets" button management
    const selectAssetsBtn = document.getElementById('select-assets-btn');
    const excludeAssetsBtn = document.getElementById('exclude-assets-btn'); // New button
    const headerRight = document.querySelector('.header-right');
    let selectAllBtn = document.getElementById('select-all-displayed-btn');

    // Create "Select All Displayed" button if it doesn't exist
    if (!selectAllBtn) {
        selectAllBtn = document.createElement('button');
        selectAllBtn.id = 'select-all-displayed-btn';
        selectAllBtn.classList.add('header-button', 'hidden'); // Hidden by default
        selectAllBtn.textContent = 'Select All Displayed';
        selectAllBtn.addEventListener('click', selectAllDisplayedAssets);
        // Insert after exclude-assets-btn if it exists, otherwise after select-assets-btn
        headerRight.insertBefore(selectAllBtn, excludeAssetsBtn ? excludeAssetsBtn.nextSibling : selectAssetsBtn.nextSibling);
    }

    // Logic to show/hide "Select All Displayed" button based on mode
    // Also ensures selections/exclusions are cleared when modes are toggled off
    [selectAssetsBtn, excludeAssetsBtn].forEach(btn => {
        btn.addEventListener('click', () => {
            if (getIsSelectMode() || getIsExcludeMode()) {
                selectAllBtn.classList.remove('hidden');
            } else {
                selectAllBtn.classList.add('hidden');
            }
            // Clear selections/exclusions for the mode that was just *turned off*
            // Example: If select mode was ON and is now OFF, clear selections.
            // If exclude mode was ON and is now OFF, clear exclusions.
            // Note: Toggling one mode OFF will automatically toggle the other mode OFF in selection.js
            if (!getIsSelectMode()) clearAllSelections();
            if (!getIsExcludeMode()) clearAllExclusions();
        });
    });


    // Event listener for individual card download button (delegated from asset-grid-container)
    document.getElementById('asset-grid').addEventListener('click', (event) => {
        const downloadBtn = event.target.closest('.download-btn');
        if (downloadBtn) {
            const card = downloadBtn.closest('.asset-card');
            if (card) {
                const folderNumber = card.dataset.folderNumber;
                const fileName = card.dataset.fileName;
                downloadAsset(folderNumber, fileName);
            }
        }
        
        // Event listener for individual card play audio button (delegated from asset-grid-container)
        const playAudioBtn = event.target.closest('.play-audio-btn');
        if (playAudioBtn) {
            const card = playAudioBtn.closest('.asset-card');
            if (card) {
                const folderNumber = card.dataset.folderNumber;
                const fileName = card.dataset.fileName;
                const asset = assetData[folderNumber][fileName];
                if (asset && asset.type === 'mp3' && asset.currentBase64) {
                    const audioBlob = new Blob([base64ToBlob(asset.currentBase64, 'audio/mpeg')], { type: 'audio/mpeg' });
                    const audioUrl = URL.createObjectURL(audioBlob);
                    const audio = new Audio(audioUrl);
                    audio.play();
                    audio.onended = () => {
                        URL.revokeObjectURL(audioUrl); // Clean up the URL after playing
                    };
                    audio.onerror = (e) => {
                        console.error('Error playing audio:', e);
                        alert('Could not play audio. Check console for errors.');
                        URL.revokeObjectURL(audioUrl);
                    };
                } else {
                    console.warn('Attempted to play non-MP3 or missing audio data.', asset);
                }
            }
        }
    });

    console.log('Main: Application initialized.');
});

/**
 * Handles input on the search bar to filter asset cards.
 * @param {Event} event - The input event.
 */
function handleSearchInput(event) {
    const searchTerm = event.target.value.toLowerCase();
    const assetCards = document.querySelectorAll('.asset-card');

    assetCards.forEach(card => {
        const assetName = card.dataset.fileName.toLowerCase();
        const folderNumber = card.dataset.folderNumber.toLowerCase();
        const assetType = card.dataset.fileType.toLowerCase(); // Assuming dataset.fileType exists

        if (assetName.includes(searchTerm) || folderNumber.includes(searchTerm) || assetType.includes(searchTerm)) {
            card.style.display = 'flex'; // Show card
        } else {
            card.style.display = 'none'; // Hide card
        }
    });
}

/**
 * Clears the search bar and shows all asset cards.
 */
function handleClearSearch() {
    document.getElementById('search-bar').value = '';
    document.querySelectorAll('.asset-card').forEach(card => {
        card.style.display = 'flex'; // Show all cards
    });
}

/**
 * Handles the import changes button click, triggering file selection.
 */
function handleImportChanges() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (event) => {
        if (event.target.files && event.target.files[0]) {
            await importChanges(event.target.files[0]);
        }
    };
    input.click();
}

// Helper function to convert base64 to Blob (needed for audio playing in main.js, can't directly import from fileHandling because of circular dependency or if fileHandling isn't designed to expose it)
// It's better to ensure this is available if needed, or refine imports.
// For now, duplicating a simplified version here for direct audio playback.
function base64ToBlob(base64, mimeType) {
    if (!base64 || typeof base64 !== 'string') {
        console.error("Base64 to Blob helper received invalid base64 data.");
        return new Blob([]); // Return empty blob on error
    }

    try {
        const byteCharacters = atob(base64); // This might fail if base64 is malformed
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type: mimeType });
    } catch (e) {
        console.error("Error converting base64 to blob for audio playback:", e);
        return new Blob([]); // Return empty blob on error
    }
}