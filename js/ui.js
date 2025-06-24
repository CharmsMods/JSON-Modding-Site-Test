// js/ui.js
// This file handles all User Interface interactions and dynamic rendering.

// Shared elements for convenience
const loadingOverlay = document.getElementById('loading-overlay');
const loadingMessage = document.getElementById('loading-message');
const loadingProgress = document.getElementById('loading-progress');
const bulkTextureModal = document.getElementById('bulk-texture-modal');
const bulkAudioModal = document.getElementById('bulk-audio-modal'); // NEW

/**
 * Displays the loading overlay with a message and optional progress.
 * @param {string} message - The message to display.
 * @param {string} [progress=''] - Optional progress text (e.g., "5/100 files").
 */
export function showLoadingOverlay(message, progress = '') {
    loadingMessage.textContent = message;
    loadingProgress.textContent = progress;
    loadingOverlay.classList.remove('hidden');
}

/**
 * Hides the loading overlay.
 */
export function hideLoadingOverlay() {
    loadingOverlay.classList.add('hidden');
    loadingMessage.textContent = '';
    loadingProgress.textContent = '';
}

/**
 * Creates an asset card HTML element.
 * @param {object} asset - The asset object { folderNumber, fileName, base64Data, type }.
 * @returns {HTMLElement} The created div element for the card.
 */
export function createAssetCard(asset) {
    const card = document.createElement('div');
    card.className = 'asset-card';
    card.dataset.folderNumber = asset.folderNumber;
    card.dataset.fileName = asset.fileName;
    card.dataset.type = asset.type; // Add type to dataset for easier access

    let contentHTML = '';
    if (asset.type === 'jpg' || asset.type === 'png') {
        contentHTML = `<img src="data:${asset.type === 'jpg' ? 'image/jpeg' : 'image/png'};base64,${asset.base64Data}" alt="${asset.fileName}" class="asset-preview-img">`;
    } else if (asset.type === 'mp3') {
        // For MP3s, display an audio icon or placeholder
        contentHTML = `
            <div class="audio-placeholder">
                <i class="fas fa-volume-up"></i> <button class="play-audio-btn">Play</button> </div>
        `;
    }

    card.innerHTML = `
        <div class="asset-preview">
            ${contentHTML}
        </div>
        <div class="asset-info">
            <span class="asset-name">${asset.fileName}</span>
            <span class="asset-folder">Folder: ${asset.folderNumber}</span>
            <span class="asset-type">Type: ${asset.type.toUpperCase()}</span>
        </div>
        <div class="asset-actions">
            <button class="download-btn">Download</button>
            </div>
        <div class="selection-overlay"></div>
    `;

    return card;
}


/**
 * Toggles the selection state of an asset card.
 * @param {HTMLElement} cardElement - The asset card DOM element.
 * @param {boolean} isSelected - True to select, false to deselect.
 */
export function toggleCardSelection(cardElement, isSelected) {
    if (isSelected) {
        cardElement.classList.add('selected');
    } else {
        cardElement.classList.remove('selected');
    }
    // Enable/disable the "Edit Selected Assets" button based on selection count
    const editButton = document.getElementById('edit-selected-btn');
    editButton.disabled = document.querySelectorAll('.asset-card.selected').length === 0;
}

/**
 * Updates the displayed count of selected assets.
 * @param {number} count - The current number of selected assets.
 */
export function updateSelectedAssetsCount(count) {
    document.getElementById('selected-assets-count').textContent = `${count} Assets Selected`;
}

/**
 * Marks an asset card as edited and updates its preview if applicable.
 * @param {HTMLElement} cardElement - The asset card DOM element.
 * @param {string} newBase64Data - The new Base64 data (for images).
 * @param {string} newType - The new type of the asset (e.g., 'png' if converted from jpg).
 */
export function markCardAsEdited(cardElement, newBase64Data, newType) {
    cardElement.classList.add('edited'); // Add 'edited' class for styling
    cardElement.dataset.type = newType; // Update the dataset type

    const previewContainer = cardElement.querySelector('.asset-preview');

    if (newType === 'jpg' || newType === 'png') {
        const imgElement = previewContainer.querySelector('.asset-preview-img');
        if (imgElement) {
            imgElement.src = `data:${newType === 'jpg' ? 'image/jpeg' : 'image/png'};base64,${newBase64Data}`;
        } else {
            // If it was an MP3 and now an image, replace content
            previewContainer.innerHTML = `<img src="data:${newType === 'jpg' ? 'image/jpeg' : 'image/png'};base64,${newBase64Data}" alt="${cardElement.dataset.fileName}" class="asset-preview-img">`;
        }
    } else if (newType === 'mp3') {
        // For MP3s, ensure the audio icon and play button are present
        previewContainer.innerHTML = `
            <div class="audio-placeholder">
                <i class="fas fa-volume-up"></i>
                <button class="play-audio-btn">Play</button>
            </div>
        `;
    }

    // Update the displayed type text
    const typeSpan = cardElement.querySelector('.asset-type');
    if (typeSpan) {
        typeSpan.textContent = `Type: ${newType.toUpperCase()} (Edited)`;
    }
}


/**
 * Opens the appropriate bulk operations modal.
 * @param {string} type - 'image' or 'mp3'.
 */
export function openBulkOperationsModal(type) {
    if (type === 'image') {
        bulkTextureModal.classList.remove('hidden');
        bulkAudioModal.classList.add('hidden'); // Ensure audio modal is hidden
    } else if (type === 'mp3') {
        bulkAudioModal.classList.remove('hidden');
        bulkTextureModal.classList.add('hidden'); // Ensure texture modal is hidden
    } else {
        console.error('UI: Unknown bulk operation modal type:', type);
        return;
    }
    // Add event listener to close button (delegated)
    const activeModal = type === 'image' ? bulkTextureModal : bulkAudioModal;
    activeModal.querySelector('.close-button').onclick = () => {
        closeBulkOperationsModal(type);
    };

    // Reset sections visibility
    if (type === 'image') {
        document.getElementById('adjust-texture-section').classList.remove('hidden');
        document.getElementById('create-new-texture-section').classList.add('hidden');
        document.getElementById('upload-new-image-section').classList.add('hidden');
        document.getElementById('adjust-texture-btn').classList.add('active');
        document.getElementById('create-new-texture-btn').classList.remove('active');
        document.getElementById('upload-new-image-btn').classList.remove('active');
    } else if (type === 'mp3') {
        document.getElementById('upload-audio-section').classList.remove('hidden');
        document.getElementById('upload-new-audio-btn').classList.add('active');
        document.getElementById('apply-uploaded-audio-btn').disabled = true; // Disable until file is selected
        document.getElementById('audio-upload-status').textContent = ''; // Clear status
    }
}

/**
 * Closes the bulk operations modal.
 * @param {string} type - 'image' or 'mp3' to determine which modal to close.
 */
export function closeBulkOperationsModal(type) {
    if (type === 'image') {
        bulkTextureModal.classList.add('hidden');
    } else if (type === 'mp3') {
        bulkAudioModal.classList.add('hidden');
    }
}