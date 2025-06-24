// utils.js

/**
 * Shows the loader with an optional message.
 * @param {string} message - The message to display in the loader.
 */
export function showLoader(message = 'Loading...') {
    const loader = document.getElementById('loader');
    const loaderText = document.getElementById('loaderText');
    if (loader && loaderText) {
        loaderText.textContent = message;
        loader.classList.remove('hidden');
    }
}

/**
 * Hides the loader.
 */
export function hideLoader() {
    const loader = document.getElementById('loader');
    if (loader) {
        loader.classList.add('hidden');
    }
}

/**
 * Converts a File object to a Base64 data URL.
 * @param {File} file - The File object to convert.
 * @returns {Promise<string>} A promise that resolves with the Base64 data URL.
 */
export function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
}

/**
 * Gets the dimensions (width and height) of an image from a Base64 data URL.
 * @param {string} base64Data - The Base64 data URL of the image.
 * @returns {Promise<{width: number, height: number}>} A promise that resolves with the image dimensions.
 */
export function getImageDimensionsFromBase64(base64Data) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            resolve({ width: img.naturalWidth, height: img.naturalHeight });
        };
        img.onerror = (error) => {
            reject(new Error('Failed to load image for dimension extraction: ' + error));
        };
        img.src = base64Data;
    });
}

// Global right-click prevention
document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
});