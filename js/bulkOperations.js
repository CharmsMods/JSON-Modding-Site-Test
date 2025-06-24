// js/bulkOperations.js
// This module handles logic for bulk editing operations (e.g., image color, audio upload).
import { getSelectedAssets, clearAllSelections } from './selection.js';
import { updateAssetInMemory, getMimeType } from './fileHandling.js';
import { showLoadingOverlay, hideLoadingOverlay, updateSelectedAssetsCount } from './ui.js';

const bulkAudioModal = document.getElementById('bulk-audio-modal');
const bulkImageModal = document.getElementById('bulk-image-modal');
const editSelectedBtn = document.getElementById('edit-selected-btn');

let uploadedAudioFile = null;
let uploadedAudioBuffer = null; // Store decoded AudioBuffer for trimming
let audioDuration = 0; // Store duration for slider max values

/**
 * Initializes event listeners for bulk operations.
 */
export function initializeBulkOperations() {
    console.log('BulkOperations: Initializing bulk operations.');

    editSelectedBtn.addEventListener('click', openBulkOperationsModal);

    // Audio Modal Listeners
    document.getElementById('new-audio-upload').addEventListener('change', handleNewAudioUpload);
    document.getElementById('apply-uploaded-audio-btn').addEventListener('click', applyUploadedAudio);

    // Audio Trimming Sliders
    document.getElementById('trim-start-slider').addEventListener('input', handleTrimSliderInput);
    document.getElementById('trim-end-slider').addEventListener('input', handleTrimSliderInput);


    // Image Modal Listeners
    document.getElementById('color-strength-slider').addEventListener('input', (e) => {
        document.getElementById('color-strength-value').textContent = `${e.target.value}%`;
    });
    document.getElementById('apply-color-change-btn').addEventListener('click', applyColorChange);
}

/**
 * Opens the appropriate bulk operations modal based on selected asset types.
 */
function openBulkOperationsModal() {
    const selected = getSelectedAssets();
    if (selected.length === 0) {
        alert('No assets selected for editing.');
        return;
    }

    const firstAssetType = selected[0].type;
    let hasImage = false;
    let hasMp3 = false;

    // Determine if selected assets are primarily images or audio
    for (const asset of selected) {
        if (asset.type === 'jpg' || asset.type === 'png') {
            hasImage = true;
        } else if (asset.type === 'mp3') {
            hasMp3 = true;
        }
    }

    if (hasImage && hasMp3) {
        alert('You have selected a mix of image and audio files. Please select only images or only audio files for bulk editing.');
        console.warn('BulkOperations: Mixed selection, cannot open modal.');
        return;
    }

    if (hasImage) {
        openModal(bulkImageModal);
        console.log('BulkOperations: Opened image modal.');
    } else if (hasMp3) {
        openModal(bulkAudioModal);
        console.log('BulkOperations: Opened audio modal.');
    } else {
        alert('Selected assets are not supported for bulk editing (only images and MP3s).');
        console.warn('BulkOperations: Unsupported asset type selection.');
    }
}

/**
 * Closes the bulk operations modal and clears selection.
 * @param {string} type - The type of modal that was closed ('image' or 'mp3').
 */
function closeBulkOperationsModal(type) {
    if (type === 'image') {
        bulkImageModal.classList.add('hidden');
    } else if (type === 'mp3') {
        bulkAudioModal.classList.add('hidden');
        // Reset audio upload state
        document.getElementById('new-audio-upload').value = '';
        document.getElementById('apply-uploaded-audio-btn').disabled = true;
        document.getElementById('audio-upload-status').textContent = '';
        document.getElementById('audio-trim-controls').classList.add('hidden');
        uploadedAudioFile = null;
        uploadedAudioBuffer = null;
        audioDuration = 0;
        document.getElementById('trim-start-slider').value = 0;
        document.getElementById('trim-end-slider').value = 0; // Will be set to max based on audioDuration on new upload
        document.getElementById('trim-start-value').textContent = '0.00';
        document.getElementById('trim-end-value').textContent = '0.00';
    }
    clearAllSelections(); // Clear selection after operations
    updateSelectedAssetsCount(0); // Update count display
    console.log(`BulkOperations: Closed ${type} modal and cleared selection.`);
}

// Function to open a specific modal (re-exported from ui.js for direct use here)
function openModal(modalElement) {
    modalElement.classList.remove('hidden');
}

/**
 * Handles the change event for the new audio file upload.
 * Decodes the audio to prepare for trimming.
 * @param {Event} event - The file input change event.
 */
function handleNewAudioUpload(event) {
    const file = event.target.files[0];
    const statusText = document.getElementById('audio-upload-status');
    const applyButton = document.getElementById('apply-uploaded-audio-btn');
    const trimControls = document.getElementById('audio-trim-controls');
    const trimStartSlider = document.getElementById('trim-start-slider');
    const trimEndSlider = document.getElementById('trim-end-slider');
    const trimStartValue = document.getElementById('trim-start-value');
    const trimEndValue = document.getElementById('trim-end-value');

    uploadedAudioFile = null;
    uploadedAudioBuffer = null;
    audioDuration = 0;
    trimControls.classList.add('hidden');
    applyButton.disabled = true;
    statusText.textContent = '';
    // document.getElementById('new-audio-upload').value = ''; // Clear input immediately for clean state - causes re-trigger on cancel

    if (file) {
        if (file.type !== 'audio/wav' && file.type !== 'audio/mpeg') {
            statusText.style.color = 'red';
            statusText.textContent = 'Invalid file type. Please upload a .wav or .mp3 file.';
            return;
        }

        uploadedAudioFile = file;
        statusText.style.color = 'grey';
        statusText.textContent = `File selected: ${file.name}. Decoding audio...`;
        showLoadingOverlay('Decoding audio for trimming...');

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                uploadedAudioBuffer = await audioContext.decodeAudioData(e.target.result);
                audioDuration = uploadedAudioBuffer.duration;

                // Set slider max values and initial positions
                trimStartSlider.max = audioDuration.toFixed(2);
                trimEndSlider.max = audioDuration.toFixed(2);
                trimStartSlider.value = 0;
                trimEndSlider.value = audioDuration.toFixed(2);
                trimStartValue.textContent = (0).toFixed(2);
                trimEndValue.textContent = audioDuration.toFixed(2);

                trimControls.classList.remove('hidden');
                applyButton.disabled = false;
                statusText.textContent = `File ready: ${file.name} (${audioDuration.toFixed(2)}s). Adjust trim points if needed.`;
                console.log('BulkOperations: Audio file decoded for trimming:', file.name, audioDuration.toFixed(2), 'seconds.');
            } catch (error) {
                console.error('BulkOperations: Error decoding audio for trimming:', error);
                statusText.style.color = 'red';
                statusText.textContent = `Error decoding audio: ${error.message}. Please try another file.`;
                uploadedAudioFile = null;
                uploadedAudioBuffer = null;
                audioDuration = 0;
                trimControls.classList.add('hidden');
            } finally {
                hideLoadingOverlay();
            }
        };
        reader.onerror = (error) => {
            console.error('BulkOperations: Error reading audio file for upload:', error);
            statusText.style.color = 'red';
            statusText.textContent = `Error reading file: ${error.message}.`;
            uploadedAudioFile = null;
            uploadedAudioBuffer = null;
            audioDuration = 0;
            trimControls.classList.add('hidden');
            hideLoadingOverlay();
        };
        reader.readAsArrayBuffer(file); // Read as ArrayBuffer for AudioContext
    }
}

/**
 * Handles input events on trim sliders, ensuring start <= end and updating display values.
 * @param {Event} event - The slider input event.
 */
function handleTrimSliderInput(event) {
    const trimStartSlider = document.getElementById('trim-start-slider');
    const trimEndSlider = document.getElementById('trim-end-slider');
    const trimStartValue = document.getElementById('trim-start-value');
    const trimEndValue = document.getElementById('trim-end-value');

    let startValue = parseFloat(trimStartSlider.value);
    let endValue = parseFloat(trimEndSlider.value);

    if (event.target.id === 'trim-start-slider') {
        if (startValue > endValue) {
            endValue = startValue;
            trimEndSlider.value = endValue.toFixed(2);
        }
    } else if (event.target.id === 'trim-end-slider') {
        if (endValue < startValue) {
            startValue = endValue;
            trimStartSlider.value = startValue.toFixed(2);
        }
    }

    trimStartValue.textContent = startValue.toFixed(2);
    trimEndValue.textContent = endValue.toFixed(2);
}


/**
 * Applies the uploaded (and potentially trimmed) audio to all selected MP3 assets.
 */
async function applyUploadedAudio() {
    console.log('BulkOperations: Applying uploaded audio (with potential trimming).');
    const selected = getSelectedAssets();
    if (selected.length === 0) return alert('No assets selected.');
    if (!uploadedAudioBuffer) { // Now check for decoded buffer
        return alert('Please upload and decode an audio file first.');
    }

    showLoadingOverlay('Processing audio file...', 'This may take a moment.');
    const statusText = document.getElementById('audio-upload-status');

    try {
        const trimStartTime = parseFloat(document.getElementById('trim-start-slider').value);
        const trimEndTime = parseFloat(document.getElementById('trim-end-slider').value);

        let finalMp3Base64 = null;
        statusText.textContent = `Trimming audio from ${trimStartTime.toFixed(2)}s to ${trimEndTime.toFixed(2)}s and converting to MP3...`;

        // Create a new AudioBuffer based on trim points
        const sampleRate = uploadedAudioBuffer.sampleRate;
        const startSample = Math.floor(trimStartTime * sampleRate);
        let endSample = Math.floor(trimEndTime * sampleRate);
        // Ensure endSample does not exceed the buffer length
        if (endSample > uploadedAudioBuffer.length) {
            endSample = uploadedAudioBuffer.length;
        }

        const trimmedBufferLength = endSample - startSample;
        if (trimmedBufferLength <= 0) {
            throw new Error("Trimmed audio duration is zero or negative. Adjust trim points.");
        }

        const trimmedAudioBuffer = new AudioContext().createBuffer(
            uploadedAudioBuffer.numberOfChannels,
            trimmedBufferLength,
            sampleRate
        );

        for (let i = 0; i < uploadedAudioBuffer.numberOfChannels; i++) {
            const originalChannelData = uploadedAudioBuffer.getChannelData(i);
            const trimmedChannelData = trimmedAudioBuffer.getChannelData(i);
            for (let j = 0; j < trimmedBufferLength; j++) {
                trimmedChannelData[j] = originalChannelData[startSample + j];
            }
        }

        // Now convert the trimmed AudioBuffer to MP3
        finalMp3Base64 = await convertAudioBufferToMp3(trimmedAudioBuffer);

        if (!finalMp3Base64) {
            throw new Error('Failed to obtain Base64 MP3 data after trimming.');
        }

        showLoadingOverlay('Applying audio to selected assets...', '0%');
        for (let i = 0; i < selected.length; i++) {
            const asset = selected[i];
            if (asset.type !== 'mp3') {
                console.warn(`BulkOperations: Skipping non-MP3 asset ${asset.fileName} for audio replacement.`);
                continue;
            }
            updateAssetInMemory(asset.folderNumber, asset.fileName, finalMp3Base64, 'mp3');
            showLoadingOverlay('Applying audio to selected assets...', `${((i + 1) / selected.length * 100).toFixed(0)}%`);
        }

        hideLoadingOverlay();
        alert('New audio (trimmed) applied to selected assets.');
        closeBulkOperationsModal('mp3');
    } catch (error) {
        console.error('BulkOperations: Error applying uploaded audio:', error);
        statusText.style.color = 'red';
        statusText.textContent = `Error: ${error.message}`;
        alert(`An error occurred while processing audio: ${error.message}`);
        hideLoadingOverlay();
    }
}

/**
 * Converts an AudioBuffer to a Base64 MP3 string using Lame.js.
 * @param {AudioBuffer} audioBuffer - The AudioBuffer to convert.
 * @returns {Promise<string>} A promise that resolves with the Base64 encoded MP3 string.
 */
async function convertAudioBufferToMp3(audioBuffer) {
    return new Promise((resolve, reject) => {
        try {
            const channels = [];
            for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
                channels.push(audioBuffer.getChannelData(i));
            }

            const mp3encoder = new Lame.Mp3Encoder(audioBuffer.numberOfChannels, audioBuffer.sampleRate);
            let mp3Data = [];
            const sampleBlockSize = 1152; // Lame.js typical sample block size

            // Process audio frames
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

            // Flush any remaining data in the encoder
            const mp3buf = mp3encoder.flush();
            if (mp3buf.length > 0) {
                mp3Data.push(new Int8Array(mp3buf));
            }

            const finalMp3Blob = new Blob(mp3Data, { type: 'audio/mpeg' });
            const mp3Reader = new FileReader();
            mp3Reader.onloadend = () => resolve(mp3Reader.result.split(',')[1]); // Resolve with pure base64
            mp3Reader.onerror = reject;
            mp3Reader.readAsDataURL(finalMp3Blob);

        } catch (e) {
            console.error("Lame.js AudioBuffer conversion error:", e);
            reject(new Error(`AudioBuffer to MP3 conversion failed: ${e.message}`));
        }
    });
}

/**
 * Converts a WAV Blob to a Base64 MP3 string.
 * This is primarily for the original upload type handling, but it now leverages AudioBuffer conversion.
 * @param {Blob} wavBlob - The WAV Blob to convert.
 * @returns {Promise<string>} A promise that resolves with the Base64 encoded MP3 string.
 */
async function convertWavToMp3(wavBlob) {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const arrayBuffer = await wavBlob.arrayBuffer(); // Read blob as array buffer
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer); // Decode WAV

    // Now use the generic AudioBuffer to MP3 converter
    return convertAudioBufferToMp3(audioBuffer);
}


/**
 * Applies a color change to all selected image assets.
 */
async function applyColorChange() {
    console.log('BulkOperations: Applying color change.');
    const selected = getSelectedAssets();
    if (selected.length === 0) return alert('No assets selected.');

    const colorPicker = document.getElementById('color-picker');
    const colorStrengthSlider = document.getElementById('color-strength-slider');
    const targetColor = colorPicker.value; // e.g., #FF0000
    const strength = parseFloat(colorStrengthSlider.value) / 100; // 0.0 to 1.0

    showLoadingOverlay('Applying color changes...', '0%');

    try {
        for (let i = 0; i < selected.length; i++) {
            const asset = selected[i];
            if (asset.type !== 'jpg' && asset.type !== 'png') {
                console.warn(`BulkOperations: Skipping non-image asset ${asset.fileName} for color change.`);
                continue;
            }

            const img = new Image();
            img.src = `data:${getMimeType(asset.type)};base64,${asset.base64Data}`;
            img.crossOrigin = 'Anonymous'; // Needed for canvas security if images are from different origin

            await new Promise((resolve, reject) => {
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    canvas.width = img.width;
                    canvas.height = img.height;

                    ctx.drawImage(img, 0, 0);

                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const data = imageData.data;

                    // Convert target color from #RRGGBB to separate R, G, B values
                    const rTarget = parseInt(targetColor.substring(1, 3), 16);
                    const gTarget = parseInt(targetColor.substring(3, 5), 16);
                    const bTarget = parseInt(targetColor.substring(5, 7), 16);

                    for (let j = 0; j < data.length; j += 4) {
                        const r = data[j];
                        const g = data[j + 1];
                        const b = data[j + 2];

                        // Simple color overlay blending (can be more complex)
                        // Blend current pixel color towards the target color based on strength
                        data[j] = Math.round(r * (1 - strength) + rTarget * strength);
                        data[j + 1] = Math.round(g * (1 - strength) + gTarget * strength);
                        data[j + 2] = Math.round(b * (1 - strength) + bTarget * strength);
                    }

                    ctx.putImageData(imageData, 0, 0);
                    const newBase64 = canvas.toDataURL(getMimeType(asset.type)).split(',')[1];
                    updateAssetInMemory(asset.folderNumber, asset.fileName, newBase64, asset.type);
                    resolve();
                };
                img.onerror = (e) => {
                    console.error('Error loading image for color change:', e);
                    reject(new Error(`Failed to load image ${asset.fileName} for color change.`));
                };
            });
            showLoadingOverlay('Applying color changes...', `${((i + 1) / selected.length * 100).toFixed(0)}%`);
        }
        hideLoadingOverlay();
        alert('Color change applied to selected images.');
        closeBulkOperationsModal('image');
    } catch (error) {
        console.error('BulkOperations: Error applying color change:', error);
        alert(`An error occurred while changing color: ${error.message}`);
        hideLoadingOverlay();
    }
}