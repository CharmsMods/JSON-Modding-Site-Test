// js/ui.js
// This file will handle all User Interface related manipulations.

/**
 * Shows the loading overlay with a specific message and optionally updates progress.
 * @param {string} message - The message to display (e.g., "Loading assets...").
 * @param {string} [progressMessage=''] - Optional progress message (e.g., "File X of Y").
 */
export function showLoadingOverlay(message, progressMessage = '') {
    console.log(`UI: Showing loading overlay. Message: ${message}, Progress: ${progressMessage}`);
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingMessage = document.getElementById('loading-message');
    const loadingProgress = document.getElementById('loading-progress');

    loadingMessage.textContent = message;
    loadingProgress.textContent = progressMessage;
    loadingOverlay.classList.remove('hidden');
}

/**
 * Hides the loading overlay.
 */
export function hideLoadingOverlay() {
    console.log('UI: Hiding loading overlay.');
    const loadingOverlay = document.getElementById('loading-overlay');
    loadingOverlay.classList.add('hidden');
}

/**
 * Updates the count of selected assets displayed in the header.
 * @param {number} count - The number of assets currently selected.
 */
export function updateSelectedAssetsCount(count) {
    console.log(`UI: Updating selected assets count to ${count}`);
    const selectedCountSpan = document.getElementById('selected-assets-count');
    selectedCountSpan.textContent = `${count} Assets Selected`;

    const editSelectedBtn = document.getElementById('edit-selected-btn');
    if (count > 0) {
        editSelectedBtn.removeAttribute('disabled');
    } else {
        editSelectedBtn.setAttribute('disabled', 'true');
    }
}

/**
 * Creates and appends an asset card to the asset grid.
 * @param {object} asset - An object containing asset details.
 * @param {string} asset.folderNumber - The long folder number.
 * @param {string} asset.fileName - The file name (e.g., "texture.png").
 * @param {string} asset.base64Data - The Base64 encoded image data for display.
 * @param {string} asset.type - The asset type (e.g., 'jpg', 'png', 'mp3').
 * @param {boolean} [isEdited=false] - True if the asset has been modified.
 * @returns {HTMLElement} The created asset card element.
 */
export function createAssetCard(asset, isEdited = false) {
    console.log(`UI: Creating asset card for ${asset.folderNumber}/${asset.fileName}`);
    const card = document.createElement('div');
    card.classList.add('asset-card');
    card.dataset.folderNumber = asset.folderNumber;
    card.dataset.fileName = asset.fileName; // Store file name for easier lookup
    card.dataset.assetType = asset.type; // Store asset type

    if (isEdited) {
        card.classList.add('edited');
    }

    // Only add image preview for image types
    if (asset.type === 'jpg' || asset.type === 'png') {
        const img = document.createElement('img');
        img.src = `data:image/${asset.type};base64,${asset.base64Data}`;
        img.alt = asset.fileName;
        card.appendChild(img);
    } else if (asset.type === 'mp3') {
        // Placeholder for audio files, maybe an audio icon or a simple text
        const audioPlaceholder = document.createElement('div');
        audioPlaceholder.classList.add('audio-placeholder');
        audioPlaceholder.textContent = '🎵 Audio File';
        card.appendChild(audioPlaceholder);
    }


    const folderNumSpan = document.createElement('div');
    folderNumSpan.classList.add('folder-number');
    folderNumSpan.textContent = asset.folderNumber;
    card.appendChild(folderNumSpan);

    const fileNameSpan = document.createElement('div');
    fileNameSpan.classList.add('file-name');
    fileNameSpan.textContent = asset.fileName;
    card.appendChild(fileNameSpan);

    const buttonContainer = document.createElement('div');
    buttonContainer.classList.add('asset-card-buttons');

    const copyBtn = document.createElement('button');
    copyBtn.classList.add('copy-btn');
    copyBtn.textContent = 'Copy ID';
    copyBtn.onclick = () => {
        navigator.clipboard.writeText(asset.folderNumber);
        console.log(`Copied folder number: ${asset.folderNumber}`);
        // Optionally, show a small "Copied!" tooltip
    };
    buttonContainer.appendChild(copyBtn);

    const downloadBtn = document.createElement('button');
    downloadBtn.classList.add('download-btn');
    downloadBtn.textContent = 'Download';
    downloadBtn.onclick = () => {
        console.log(`Downloading ${asset.fileName}`);
        // This will be handled by a function in fileHandling.js
        // For now, it just logs.
    };
    buttonContainer.appendChild(downloadBtn);

    card.appendChild(buttonContainer);

    return card;
}

/**
 * Marks an asset card as selected or unselected.
 * @param {HTMLElement} cardElement - The asset card DOM element.
 * @param {boolean} isSelected - True to select, false to unselect.
 */
export function toggleCardSelection(cardElement, isSelected) {
    console.log(`UI: Toggling card selection for ${cardElement.dataset.folderNumber}. Selected: ${isSelected}`);
    if (isSelected) {
        cardElement.classList.add('selected');
    } else {
        cardElement.classList.remove('selected');
    }
}

/**
 * Marks an asset card as edited and updates its image preview.
 * @param {HTMLElement} cardElement - The asset card DOM element.
 * @param {string} newBase64Data - The new Base64 encoded image data.
 * @param {string} type - The asset type (e.g., 'jpg', 'png').
 */
export function markCardAsEdited(cardElement, newBase64Data, type) {
    console.log(`UI: Marking card ${cardElement.dataset.folderNumber} as edited and updating image.`);
    cardElement.classList.add('edited');
    // Update the image preview if it's an image
    if (type === 'jpg' || type === 'png') {
        const imgElement = cardElement.querySelector('img');
        if (imgElement) {
            imgElement.src = `data:image/${type};base64,${newBase64Data}`;
        }
    }
}

/**
 * Opens the bulk texture operations modal.
 */
export function openBulkTextureModal() {
    console.log('UI: Opening bulk texture modal.');
    const modal = document.getElementById('bulk-texture-modal');
    modal.classList.remove('hidden');
    // Ensure default section is visible
    document.querySelectorAll('.modal-section').forEach(section => section.classList.add('hidden'));
    document.getElementById('adjust-texture-section').classList.remove('hidden');
    document.querySelectorAll('.modal-option-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById('adjust-texture-btn').classList.add('active');
}

/**
 * Closes the bulk texture operations modal.
 */
export function closeBulkTextureModal() {
    console.log('UI: Closing bulk texture modal.');
    const modal = document.getElementById('bulk-texture-modal');
    modal.classList.add('hidden');
}

/**
 * Switches the active section within the bulk texture operations modal.
 * @param {string} sectionId - The ID of the section to show (e.g., 'adjust-texture-section').
 * @param {string} buttonId - The ID of the button to mark as active.
 */
export function switchModalSection(sectionId, buttonId) {
    console.log(`UI: Switching modal section to ${sectionId}.`);
    document.querySelectorAll('.modal-section').forEach(section => section.classList.add('hidden'));
    document.getElementById(sectionId).classList.remove('hidden');

    document.querySelectorAll('.modal-option-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(buttonId).classList.add('active');
}