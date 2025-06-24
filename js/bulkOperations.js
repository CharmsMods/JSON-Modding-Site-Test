// js/bulkOperations.js
// This file handles the logic for bulk operations on selected assets.
import { getSelectedAssets, getAllowedSelectionType } from './selection.js';
import { openBulkOperationsModal, closeBulkOperationsModal, showLoadingOverlay, hideLoadingOverlay } from './ui.js';
import { updateAssetInMemory, base64ToBlob, assetData } from './fileHandling.js'; // Added base64ToBlob and assetData

let currentAudioPlayer = null; // To manage a single audio playback

/**
 * Initializes listeners for bulk operations.
 */
export function initializeBulkOperations() {
    console.log('BulkOperations: Initializing bulk operation listeners.');

    document.getElementById('edit-selected-btn').addEventListener('click', handleEditSelected);

    // Image Modal Buttons
    document.getElementById('adjust-texture-btn').addEventListener('click', () => showTextureSection('adjust-texture-section', 'adjust-texture-btn'));
    document.getElementById('create-new-texture-btn').addEventListener('click', () => showTextureSection('create-new-texture-section', 'create-new-texture-btn'));
    document.getElementById('upload-new-image-btn').addEventListener('click', () => showTextureSection('upload-new-image-section', 'upload-new-image-btn'));

    document.getElementById('apply-adjustments-btn').addEventListener('click', applyImageAdjustments);
    document.getElementById('generate-texture-btn').addEventListener('click', generateNewTexture);
    document.getElementById('new-image-upload').addEventListener('change', handleNewImageUpload);
    document.getElementById('apply-uploaded-image-btn').addEventListener('click', applyUploadedImage);

    // Audio Modal Elements
    document.getElementById('upload-new-audio-btn').addEventListener('click', () => showAudioSection('upload-audio-section', 'upload-new-audio-btn'));
    document.getElementById('new-audio-upload').addEventListener('change', handleNewAudioUpload);
    document.getElementById('apply-uploaded-audio-btn').addEventListener('click', applyUploadedAudio);

    // Delegated event listener for Play button on MP3 cards
    document.getElementById('asset-grid').addEventListener('click', (event) => {
        const playBtn = event.target.closest('.play-audio-btn');
        if (playBtn) {
            const card = playBtn.closest('.asset-card');
            if (card && card.dataset.type === 'mp3') {
                const folderNumber = card.dataset.folderNumber;
                const fileName = card.dataset.fileName;
                playMp3Asset(folderNumber, fileName);
            }
        }
    });

    // Close buttons for both modals
    document.querySelectorAll('.modal .close-button').forEach(button => {
        button.addEventListener('click', (event) => {
            const modal = event.target.closest('.modal');
            if (modal.id === 'bulk-texture-modal') {
                closeBulkOperationsModal('image');
            } else if (modal.id === 'bulk-audio-modal') {
                closeBulkOperationsModal('mp3');
                stopCurrentAudioPlayback(); // Stop playback when closing audio modal
            }
        });
    });
}

/**
 * Handles the click of the "Edit Selected Assets" button.
 * Determines which modal to open based on the type of selected assets.
 */
function handleEditSelected() {
    const selectedAssets = getSelectedAssets();
    if (selectedAssets.length === 0) {
        alert('Please select at least one asset to edit.');
        return;
    }

    const allowedType = getAllowedSelectionType(); // Get the type from selection.js
    if (allowedType === 'image') {
        openBulkOperationsModal('image');
    } else if (allowedType === 'mp3') {
        openBulkOperationsModal('mp3');
    } else {
        // This case should ideally not happen if selection logic is correct
        // but it's a fallback.
        alert('Cannot determine asset type for bulk editing. Please ensure only images OR MP3s are selected.');
        console.error('BulkOperations: Mixed or unknown asset types selected for bulk editing.');
    }
}


// --- IMAGE OPERATIONS ---
function showTextureSection(sectionId, buttonId) {
    document.querySelectorAll('#bulk-texture-modal .modal-section').forEach(section => {
        section.classList.add('hidden');
    });
    document.getElementById(sectionId).classList.remove('hidden');

    document.querySelectorAll('#bulk-texture-modal .modal-option-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById(buttonId).classList.add('active');
}

async function applyImageAdjustments() {
    console.log('BulkOperations: Applying image adjustments.');
    const selected = getSelectedAssets();
    if (selected.length === 0) return alert('No assets selected.');

    const saturation = parseFloat(document.getElementById('saturation-slider').value) / 100;
    const brightness = parseFloat(document.getElementById('brightness-slider').value) / 100;
    const contrast = parseFloat(document.getElementById('contrast-slider').value) / 100;

    showLoadingOverlay('Applying image adjustments...', '0%');

    for (let i = 0; i < selected.length; i++) {
        const asset = selected[i];
        if (asset.type !== 'jpg' && asset.type !== 'png') {
            console.warn(`BulkOperations: Skipping non-image asset ${asset.fileName} for image adjustment.`);
            continue;
        }

        const img = new Image();
        img.src = `data:${asset.type === 'jpg' ? 'image/jpeg' : 'image/png'};base64,${asset.base64Data}`;

        await new Promise(resolve => {
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;

                ctx.filter = `saturate(${saturation * 100}%) brightness(${brightness * 100}%) contrast(${contrast * 100}%)`;
                ctx.drawImage(img, 0, 0);

                const newBase64 = canvas.toDataURL(`image/${asset.type === 'jpg' ? 'jpeg' : 'png'}`).split(',')[1];
                updateAssetInMemory(asset.folderNumber, asset.fileName, newBase64, asset.type);
                showLoadingOverlay('Applying image adjustments...', `${((i + 1) / selected.length * 100).toFixed(0)}%`);
                resolve();
            };
            img.onerror = () => {
                console.error(`BulkOperations: Failed to load image for adjustment: ${asset.fileName}`);
                resolve(); // Resolve anyway to continue with other assets
            };
        });
    }

    hideLoadingOverlay();
    alert('Image adjustments applied to selected assets.');
    closeBulkOperationsModal('image');
}

async function generateNewTexture() {
    console.log('BulkOperations: Generating new texture.');
    const selected = getSelectedAssets();
    if (selected.length === 0) return alert('No assets selected.');

    const color = document.getElementById('color-picker').value;
    const width = parseInt(document.getElementById('resolution-width').value);
    const height = parseInt(document.getElementById('resolution-height').value);

    if (isNaN(width) || isNaN(height) || width <= 0 || height <= 0) {
        alert('Please enter valid positive dimensions for the new texture.');
        return;
    }

    showLoadingOverlay('Generating new textures...', '0%');

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = width;
    canvas.height = height;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);

    const newBase64Content = canvas.toDataURL('image/png').split(',')[1]; // Always generate PNG

    for (let i = 0; i < selected.length; i++) {
        const asset = selected[i];
        // Ensure it's an image asset, even if changing type to PNG
        if (asset.type !== 'jpg' && asset.type !== 'png') {
            console.warn(`BulkOperations: Skipping non-image asset ${asset.fileName} for new texture generation.`);
            continue;
        }
        updateAssetInMemory(asset.folderNumber, asset.fileName, newBase64Content, 'png'); // Always converts to PNG
        showLoadingOverlay('Generating new textures...', `${((i + 1) / selected.length * 100).toFixed(0)}%`);
    }

    hideLoadingOverlay();
    alert('New texture generated and applied to selected assets.');
    closeBulkOperationsModal('image');
}

let uploadedImageBase64 = null;
let uploadedImageType = null;

function handleNewImageUpload(event) {
    const file = event.target.files[0];
    if (file) {
        if (!file.type.startsWith('image/')) {
            alert('Please upload an image file (JPG or PNG).');
            document.getElementById('new-image-upload').value = ''; // Clear input
            document.getElementById('apply-uploaded-image-btn').disabled = true;
            uploadedImageBase64 = null;
            uploadedImageType = null;
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            uploadedImageBase64 = reader.result.split(',')[1];
            uploadedImageType = file.type.split('/')[1]; // 'jpeg' or 'png'
            document.getElementById('apply-uploaded-image-btn').disabled = false;
            console.log('BulkOperations: Image uploaded, ready to apply.');
        };
        reader.onerror = (error) => {
            console.error('BulkOperations: Error reading uploaded image file:', error);
            alert('Could not read the uploaded image file.');
            document.getElementById('apply-uploaded-image-btn').disabled = true;
            uploadedImageBase64 = null;
            uploadedImageType = null;
        };
        reader.readAsDataURL(file);
    } else {
        document.getElementById('apply-uploaded-image-btn').disabled = true;
        uploadedImageBase64 = null;
        uploadedImageType = null;
    }
}

async function applyUploadedImage() {
    console.log('BulkOperations: Applying uploaded image.');
    const selected = getSelectedAssets();
    if (selected.length === 0) return alert('No assets selected.');
    if (!uploadedImageBase64 || !uploadedImageType) {
        return alert('Please upload an image first.');
    }

    showLoadingOverlay('Applying uploaded image...', '0%');

    for (let i = 0; i < selected.length; i++) {
        const asset = selected[i];
        if (asset.type !== 'jpg' && asset.type !== 'png') {
            console.warn(`BulkOperations: Skipping non-image asset ${asset.fileName} for image replacement.`);
            continue;
        }
        updateAssetInMemory(asset.folderNumber, asset.fileName, uploadedImageBase64, uploadedImageType);
        showLoadingOverlay('Applying uploaded image...', `${((i + 1) / selected.length * 100).toFixed(0)}%`);
    }

    hideLoadingOverlay();
    alert('Uploaded image applied to selected assets.');
    closeBulkOperationsModal('image');
    document.getElementById('new-image-upload').value = ''; // Clear input
    document.getElementById('apply-uploaded-image-btn').disabled = true;
    uploadedImageBase64 = null;
    uploadedImageType = null;
}


// --- AUDIO OPERATIONS ---
function showAudioSection(sectionId, buttonId) {
    // In this case, only one section for audio, but keep consistent with image modal
    document.querySelectorAll('#bulk-audio-modal .modal-section').forEach(section => {
        section.classList.add('hidden');
    });
    document.getElementById(sectionId).classList.remove('hidden');

    document.querySelectorAll('#bulk-audio-modal .modal-option-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById(buttonId).classList.add('active');
}

let uploadedAudioFile = null;

function handleNewAudioUpload(event) {
    const file = event.target.files[0];
    const statusText = document.getElementById('audio-upload-status');
    const applyButton = document.getElementById('apply-uploaded-audio-btn');

    if (file) {
        if (file.type !== 'audio/wav' && file.type !== 'audio/mpeg') { // Only allow WAV and MP3
            statusText.style.color = 'red';
            statusText.textContent = 'Invalid file type. Please upload a .wav or .mp3 file.';
            applyButton.disabled = true;
            uploadedAudioFile = null;
            document.getElementById('new-audio-upload').value = ''; // Clear input
            return;
        }
        uploadedAudioFile = file;
        applyButton.disabled = false;
        statusText.style.color = 'grey';
        statusText.textContent = `File selected: ${file.name}`;
        console.log('BulkOperations: Audio file uploaded, ready to apply:', file.name);
    } else {
        uploadedAudioFile = null;
        applyButton.disabled = true;
        statusText.textContent = '';
    }
}

async function applyUploadedAudio() {
    console.log('BulkOperations: Applying uploaded audio.');
    const selected = getSelectedAssets();
    if (selected.length === 0) return alert('No assets selected.');
    if (!uploadedAudioFile) {
        return alert('Please upload an audio file first.');
    }

    showLoadingOverlay('Processing audio file...', 'This may take a moment.');
    const statusText = document.getElementById('audio-upload-status');

    try {
        let finalBase64Audio = null;
        let finalAudioType = 'mp3'; // Target type is always MP3

        if (uploadedAudioFile.type === 'audio/mpeg') { // If already MP3, just read it
            const reader = new FileReader();
            finalBase64Audio = await new Promise((resolve, reject) => {
                reader.onloadend = () => resolve(reader.result.split(',')[1]);
                reader.onerror = reject;
                reader.readAsDataURL(uploadedAudioFile);
            });
            statusText.textContent = 'MP3 file read successfully.';
        } else if (uploadedAudioFile.type === 'audio/wav') { // If WAV, convert to MP3
            statusText.textContent = 'Converting WAV to MP3... This may take a moment.';
            finalBase64Audio = await convertWavToMp3(uploadedAudioFile);
            statusText.textContent = 'WAV converted to MP3 successfully.';
        } else {
            throw new Error('Unsupported audio file type for conversion.');
        }

        if (!finalBase64Audio) {
            throw new Error('Failed to obtain Base64 audio data.');
        }

        showLoadingOverlay('Applying audio to selected assets...', '0%');
        for (let i = 0; i < selected.length; i++) {
            const asset = selected[i];
            if (asset.type !== 'mp3') {
                console.warn(`BulkOperations: Skipping non-MP3 asset ${asset.fileName} for audio replacement.`);
                continue;
            }
            updateAssetInMemory(asset.folderNumber, asset.fileName, finalBase64Audio, finalAudioType);
            showLoadingOverlay('Applying audio to selected assets...', `${((i + 1) / selected.length * 100).toFixed(0)}%`);
        }

        hideLoadingOverlay();
        alert('New audio applied to selected assets.');
        closeBulkOperationsModal('mp3');
        document.getElementById('new-audio-upload').value = '';
        document.getElementById('apply-uploaded-audio-btn').disabled = true;
        uploadedAudioFile = null;
    } catch (error) {
        console.error('BulkOperations: Error applying uploaded audio:', error);
        statusText.style.color = 'red';
        statusText.textContent = `Error: ${error.message}`;
        alert(`An error occurred while processing audio: ${error.message}`);
        hideLoadingOverlay();
    }
}

/**
 * Converts a WAV Blob/File to a Base64 MP3 string using Lame.js.
 * @param {Blob|File} wavBlob - The WAV audio file/blob.
 * @returns {Promise<string>} A promise that resolves with the Base64 encoded MP3 string.
 */
async function convertWavToMp3(wavBlob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const arrayBuffer = event.target.result;
                const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

                // Lame.js takes samples as float32. Get channel data.
                const channels = [];
                for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
                    channels.push(audioBuffer.getChannelData(i));
                }

                // If mono, pass one channel. If stereo, pass both. Lame.js handles up to 2 channels.
                const mp3encoder = new Lame.Mp3Encoder(audioBuffer.numberOfChannels, audioContext.sampleRate);
                let mp3Data = [];
                const sampleBlockSize = 1152; // Typical block size for LAME

                // Process samples in blocks
                if (audioBuffer.numberOfChannels === 1) {
                    for (let i = 0; i < channels[0].length; i += sampleBlockSize) {
                        const sampleChunk = channels[0].subarray(i, i + sampleBlockSize);
                        const mp3buf = mp3encoder.encodeBuffer(sampleChunk);
                        if (mp3buf.length > 0) {
                            mp3Data.push(new Int8Array(mp3buf));
                        }
                    }
                } else if (audioBuffer.numberOfChannels === 2) {
                    for (let i = 0; i < channels[0].length; i += sampleBlockSize) {
                        const sampleChunkL = channels[0].subarray(i, i + sampleBlockSize);
                        const sampleChunkR = channels[1].subarray(i, i + sampleBlockSize);
                        const mp3buf = mp3encoder.encodeBuffer(sampleChunkL, sampleChunkR);
                        if (mp3buf.length > 0) {
                            mp3Data.push(new Int8Array(mp3buf));
                        }
                    }
                } else {
                    reject(new Error('Unsupported number of audio channels (Lame.js supports 1 or 2).'));
                    return;
                }

                const mp3buf = mp3encoder.flush();   // Finish encoding
                if (mp3buf.length > 0) {
                    mp3Data.push(new Int8Array(mp3buf));
                }

                const finalMp3Blob = new Blob(mp3Data, { type: 'audio/mpeg' });
                const mp3Reader = new FileReader();
                mp3Reader.onloadend = () => resolve(mp3Reader.result.split(',')[1]);
                mp3Reader.onerror = reject;
                mp3Reader.readAsDataURL(finalMp3Blob);

            } catch (e) {
                console.error("Lame.js conversion error:", e);
                reject(new Error(`Audio conversion failed: ${e.message}. Ensure the WAV file is valid and has 1 or 2 channels.`));
            }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(wavBlob);
    });
}


/**
 * Plays an MP3 asset from its Base64 data.
 * Stops any currently playing audio.
 * @param {string} folderNumber - The folder number of the asset.
 * @param {string} fileName - The file name of the asset.
 */
function playMp3Asset(folderNumber, fileName) {
    const asset = assetData[folderNumber]?.[fileName]; // Access from imported assetData
    if (!asset || asset.type !== 'mp3') {
        console.warn(`BulkOperations: Cannot play non-MP3 asset or asset not found: ${folderNumber}/${fileName}`);
        return;
    }

    stopCurrentAudioPlayback(); // Stop any currently playing audio

    const audioBlob = base64ToBlob(asset.currentBase64, 'audio/mpeg');
    const audioUrl = URL.createObjectURL(audioBlob);

    currentAudioPlayer = new Audio(audioUrl);
    currentAudioPlayer.volume = 0.5; // Default volume
    currentAudioPlayer.play().catch(e => console.error("Error playing audio:", e));

    currentAudioPlayer.onended = () => {
        console.log(`BulkOperations: Audio playback ended for ${fileName}.`);
        URL.revokeObjectURL(audioUrl); // Clean up URL when done
        currentAudioPlayer = null;
    };

    console.log(`BulkOperations: Playing audio: ${fileName}`);
}

/**
 * Stops any currently playing audio and cleans up.
 */
function stopCurrentAudioPlayback() {
    if (currentAudioPlayer) {
        console.log('BulkOperations: Stopping current audio playback.');
        currentAudioPlayer.pause();
        currentAudioPlayer.currentTime = 0;
        currentAudioPlayer = null;
    }
}