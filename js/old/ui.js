// js/ui.js
// This file handles all DOM manipulation and user interface updates.

const assetGrid = document.getElementById('asset-grid');
const selectedAssetsCountSpan = document.getElementById('selected-assets-count');
const editSelectedBtn = document.getElementById('edit-selected-btn');
const loadingOverlay = document.getElementById('loading-overlay');
const loadingMessage = document.getElementById('loading-message');
const loadingProgress = document.getElementById('loading-progress');

// Re-import assetData if needed for card creation/update
import { assetData, getMimeType } from './fileHandling.js';
import { getIsSelectMode, getIsExcludeMode, toggleCardSelectionUI, toggleCardExclusionUI } from './selection.js';

/**
 * Renders asset cards in the grid.
 * @param {object} assets - The asset data object.
 */
export function renderAssetCards(assets) {
    console.log('UI: Rendering asset cards...');
    assetGrid.innerHTML = ''; // Clear existing cards
    for (const folderNumber in assets) {
        for (const fileName in assets[folderNumber]) {
            const asset = assets[folderNumber][fileName];
            const card = createAssetCard(folderNumber, fileName, asset.currentBase64, asset.type, asset.isEdited, asset.isExcluded);
            assetGrid.appendChild(card);
        }
    }
    console.log('UI: Asset cards rendered.');
}

/**
 * Creates a single asset card DOM element.
 * @param {string} folderNumber - The folder number of the asset.
 * @param {string} fileName - The file name of the asset.
 * @param {string} base64Data - The Base64 data of the asset.
 * @param {string} type - The type of the asset (e.g., 'jpg', 'png', 'mp3').
 * @param {boolean} isEdited - True if the asset has been edited.
 * @param {boolean} isExcluded - True if the asset is excluded from export.
 * @returns {HTMLElement} The created asset card element.
 */
export function createAssetCard(folderNumber, fileName, base64Data, type, isEdited, isExcluded) {
    const card = document.createElement('div');
    card.className = 'asset-card';
    card.dataset.folderNumber = folderNumber;
    card.dataset.fileName = fileName;
    card.dataset.fileType = type; // Add fileType for search

    if (isEdited) {
        card.classList.add('edited');
    }
    if (isExcluded) {
        card.classList.add('excluded');
    }

    card.innerHTML = `
        <div class="selection-overlay"></div>
        <div class="asset-preview">
            </div>
        <div class="asset-info">
            <span class="asset-name">${fileName}</span>
            <span class="asset-folder">Folder: ${folderNumber}</span>
            <span class="asset-type">${type.toUpperCase()}</span>
        </div>
        <div class="asset-actions">
            <button class="download-btn">Download</button>
        </div>
    `;

    const previewContainer = card.querySelector('.asset-preview');
    const assetActions = card.querySelector('.asset-actions');

    if (type === 'jpg' || type === 'png') {
        const img = document.createElement('img');
        img.className = 'asset-preview-img';
        img.src = `data:${getMimeType(type)};base64,${base64Data}`;
        previewContainer.appendChild(img);
    } else if (type === 'mp3') {
        const audioPlaceholder = document.createElement('div');
        audioPlaceholder.className = 'audio-placeholder';
        audioPlaceholder.innerHTML = `
            <i class="fas fa-volume-up"></i>
            <button class="play-audio-btn">Play Audio</button>
        `;
        previewContainer.appendChild(audioPlaceholder);
    } else {
        // Placeholder for unknown types
        const unknownPlaceholder = document.createElement('div');
        unknownPlaceholder.className = 'unknown-placeholder';
        unknownPlaceholder.textContent = `Unsupported type: ${type}`;
        previewContainer.appendChild(unknownPlaceholder);
    }

    return card;
}


/**
 * Updates the selected assets count displayed in the header.
 * @param {number} count - The current number of selected assets.
 */
export function updateSelectedAssetsCount(count) {
    selectedAssetsCountSpan.textContent = `${count} Assets Selected`;
    editSelectedBtn.disabled = count === 0 || getIsExcludeMode(); // Disable edit button if no assets or if in exclude mode
}

/**
 * Shows the loading overlay with a message.
 * @param {string} message - The main loading message.
 * @param {string} [progress=''] - Optional progress text.
 * @param {boolean} [isError=false] - If true, displays as an error and hides loader.
 */
export function showLoadingOverlay(message, progress = '', isError = false) {
    loadingMessage.textContent = message;
    loadingProgress.textContent = progress;
    if (isError) {
        loadingMessage.style.color = 'red';
        loadingOverlay.querySelector('.loader').style.display = 'none';
    } else {
        loadingMessage.style.color = 'white';
        loadingOverlay.querySelector('.loader').style.display = 'block';
    }
    loadingOverlay.classList.remove('hidden');
}

/**
 * Updates the loading progress text.
 * @param {string} progress - The progress text.
 */
export function updateLoadingProgress(progress) {
    loadingProgress.textContent = progress;
}

/**
 * Hides the loading overlay.
 */
export function hideLoadingOverlay() {
    loadingOverlay.classList.add('hidden');
    // Reset colors and loader for next time
    loadingMessage.style.color = 'white';
    loadingOverlay.querySelector('.loader').style.display = 'block';
}

/**
 * Marks an asset card as edited and updates its preview/type.
 * @param {HTMLElement} cardElement - The DOM element of the asset card.
 * @param {string} newBase64Data - The new Base64 data for the asset.
 * @param {string} newType - The new type of the asset (e.g., 'png' if converted from 'jpg').
 */
export function markCardAsEdited(cardElement, newBase64Data, newType) {
    cardElement.classList.add('edited'); // Add edited class for styling (e.g., orange text)

    const typeSpan = cardElement.querySelector('.asset-type');
    if (typeSpan) {
        typeSpan.textContent = `${newType.toUpperCase()} (Edited)`;
    }

    const previewContainer = cardElement.querySelector('.asset-preview');
    let imgElement = cardElement.querySelector('.asset-preview-img');
    let audioPlaceholder = cardElement.querySelector('.audio-placeholder');

    // Remove old preview elements
    if (imgElement) imgElement.remove();
    if (audioPlaceholder) audioPlaceholder.remove();

    // Create new preview element based on newType
    if (newType === 'jpg' || newType === 'png') {
        imgElement = document.createElement('img');
        imgElement.className = 'asset-preview-img';
        imgElement.src = `data:${getMimeType(newType)};base64,${newBase64Data}`;
        previewContainer.appendChild(imgElement);
    } else if (newType === 'mp3') {
        audioPlaceholder = document.createElement('div');
        audioPlaceholder.className = 'audio-placeholder';
        audioPlaceholder.innerHTML = `
            <i class="fas fa-volume-up"></i>
            <button class="play-audio-btn">Play Audio</button>
        `;
        previewContainer.appendChild(audioPlaceholder);
    }
    // No action for unsupported types, the card will just show its info
}


// --- Modal related functions ---
// These are currently handled directly in bulkOperations.js and main.js for specific modals.
// If you want a generic modal controller here, we can refactor.
// For now, these are direct DOM references.
const bulkAudioModal = document.getElementById('bulk-audio-modal');
const bulkImageModal = document.getElementById('bulk-image-modal');


/**
 * Opens a specified modal.
 * @param {HTMLElement} modalElement - The modal DOM element to open.
 */
export function openModal(modalElement) {
    modalElement.classList.remove('hidden');
}

/**
 * Closes a specified modal.
 * @param {HTMLElement} modalElement - The modal DOM element to close.
 */
export function closeModal(modalElement) {
    modalElement.classList.add('hidden');
}

// Add event listeners for closing modals via the close button
document.querySelectorAll('.modal .close-button').forEach(button => {
    button.addEventListener('click', (event) => {
        const modal = event.target.closest('.modal');
        if (modal) {
            closeModal(modal);
        }
    });
});

// Close modal if clicking outside the modal content (optional)
document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (event) => {
        if (event.target === modal) { // Only close if clicking on the overlay itself
            closeModal(modal);
        }
    });
});