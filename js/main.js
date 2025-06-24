// js/main.js
// This is the entry point of the application, coordinating all modules.
import { loadAllAssetsIntoMemory, downloadAsset, importChanges, exportChanges, assetData } from './fileHandling.js';
import { initializeSelection, clearAllSelections, selectAllDisplayedAssets, getIsSelectMode } from './selection.js';
import { initializeBulkOperations } from './bulkOperations.js';
import { showLoadingOverlay, hideLoadingOverlay } from './ui.js';

// Make assetData globally accessible for selection.js
// This is a common pattern for managing shared state across modules
// You could also use a more sophisticated state management system like Redux or simply pass it around.
window.assetData = assetData;

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Main: DOMContentLoaded. Initializing application...');
    await loadAllAssetsIntoMemory(); // Load all assets first

    initializeSelection(); // Set up card selection logic
    initializeBulkOperations(); // Set up bulk operations modal logic

    // Event Listeners for Header Buttons
    document.getElementById('clear-search-btn').addEventListener('click', handleClearSearch);
    document.getElementById('download-all-zip-btn').addEventListener('click', () => {
        // This will call the function from export.js
        window.downloadAllAssetsAsZip(); // Using window to access it if not directly imported or if using script tags
    });
    document.getElementById('import-changes-btn').addEventListener('click', handleImportChanges);
    document.getElementById('export-changes-btn').addEventListener('click', exportChanges);

    const searchBar = document.getElementById('search-bar');
    searchBar.addEventListener('input', handleSearchInput);

    // Event listener for "Select All Currently Displaying Assets" (needs a new button in header)
    // For now, let's just make it part of the 'Select Assets' button's functionality
    // if in select mode. Or, add a separate button. For now, adding a separate button.
    const selectAssetsBtn = document.getElementById('select-assets-btn');
    const headerRight = document.querySelector('.header-right');
    const selectAllBtn = document.createElement('button');
    selectAllBtn.id = 'select-all-displayed-btn';
    selectAllBtn.classList.add('header-button', 'hidden'); // Hidden by default
    selectAllBtn.textContent = 'Select All Displayed';
    selectAllBtn.addEventListener('click', selectAllDisplayedAssets);
    headerRight.insertBefore(selectAllBtn, selectAssetsBtn.nextSibling); // Insert after select-assets-btn

    selectAssetsBtn.addEventListener('click', () => {
        // Toggle visibility of 'Select All Displayed' button when entering/exiting select mode
        if (getIsSelectMode()) { // If entering select mode
            selectAllBtn.classList.remove('hidden');
        } else { // If exiting select mode
            selectAllBtn.classList.add('hidden');
        }
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
    });

    console.log('Main: Application initialized.');
});

/**
 * Handles the search bar input, filtering displayed assets.
 */
function handleSearchInput() {
    const searchTerm = document.getElementById('search-bar').value.toLowerCase();
    console.log(`Main: Search input changed to: "${searchTerm}"`);
    const assetCards = document.querySelectorAll('.asset-card');

    assetCards.forEach(card => {
        const folderNumber = card.dataset.folderNumber.toLowerCase();
        const fileName = card.dataset.fileName.toLowerCase();

        if (folderNumber.includes(searchTerm) || fileName.includes(searchTerm)) {
            card.style.display = ''; // Show card
        } else {
            card.style.display = 'none'; // Hide card
        }
    });
}

/**
 * Clears the search bar and shows all assets.
 */
function handleClearSearch() {
    console.log('Main: Clear search button clicked.');
    document.getElementById('search-bar').value = '';
    document.querySelectorAll('.asset-card').forEach(card => {
        card.style.display = ''; // Show all cards
    });
}

/**
 * Handles the import changes button click, prompting for a file.
 */
function handleImportChanges() {
    console.log('Main: Import Changes button clicked.');
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (event) => {
        const file = event.target.files[0];
        if (file) {
            await importChanges(file);
        } else {
            console.log('Main: No file selected for import.');
        }
    };
    input.click();
}