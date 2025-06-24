// js/utils.js

/**
 * Converts a Base64 string to a Blob object.
 * Useful for images and other binary data stored as Base64.
 * @param {string} base64String - The Base64 string (e.g., "data:image/png;base64,iVBORw0KGgo...").
 * @returns {Blob | null} A Blob object, or null if the string is invalid.
 * @comment This function is crucial for converting our base64 image data from the JSON files
 * into a format that can be used by the browser to display images (e.g., in an <img> tag).
 */
export function base64ToBlob(base64String) {
    console.log("utils.js: Converting Base64 to Blob...");
    try {
        // Check if the string starts with a data URL prefix
        const parts = base64String.split(';base64,');
        if (parts.length !== 2) {
            console.error("utils.js: Invalid Base64 string format. Expected 'data:mime/type;base64,...'");
            return null;
        }

        const mimeType = parts[0].split(':')[1]; // e.g., 'image/png'
        const base64 = parts[1];

        // Decode Base64 string
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);

        return new Blob([byteArray], { type: mimeType });
    } catch (error) {
        console.error("utils.js: Error converting Base64 to Blob:", error);
        return null;
    }
}

/**
 * Converts a Base64 string to a Data URL (e.g., "data:image/png;base64,...").
 * This is often directly usable as the `src` for <img> tags.
 * @param {string} base64String - The raw Base64 data (without "data:image/png;base64," prefix).
 * @param {string} mimeType - The MIME type of the data (e.g., "image/png", "audio/mp3").
 * @returns {string} The Data URL.
 * @comment This is useful if we store just the raw base64 data and need to prepend the mime type.
 * However, if the incoming base64 already has the full data URI, we might use it directly.
 */
export function createDataURL(base64String, mimeType) {
    console.log(`utils.js: Creating Data URL for mimeType: ${mimeType}`);
    return `data:${mimeType};base64,${base64String}`;
}

/**
 * Loads an image and returns its dimensions (width, height) and a Data URL.
 * @param {string} dataUrl - The Data URL of the image.
 * @returns {Promise<{width: number, height: number, dataUrl: string}>} A promise that resolves with image dimensions and data URL.
 * @comment This can be used to ensure images are loaded correctly and to get their intrinsic sizes if needed.
 */
export function loadImageDimensions(dataUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            console.log(`utils.js: Image loaded with dimensions: ${img.width}x${img.height}`);
            resolve({ width: img.width, height: img.height, dataUrl });
        };
        img.onerror = (err) => {
            console.error("utils.js: Failed to load image from Data URL", err);
            reject(new Error("Failed to load image"));
        };
        img.src = dataUrl;
    });
}

/**
 * Creates a blank canvas and draws a solid color, returning its Data URL.
 * @param {string} color - CSS color string (e.g., '#FF0000', 'blue', 'rgba(255,0,0,0.5)').
 * @param {number} width - Width of the canvas.
 * @param {number} height - Height of the canvas.
 * @param {string} type - Image type for data URL (e.g., 'image/png', 'image/jpeg').
 * @returns {string} Data URL of the generated image.
 * @comment This will be used in the "Make New Texture" panel to create new color textures.
 */
export function createColorTexture(color, width, height, type = 'image/png') {
    console.log(`utils.js: Creating new color texture (${width}x${height}) with color ${color} as ${type}`);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error("utils.js: Could not get 2D context for canvas.");
        return '';
    }
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);
    return canvas.toDataURL(type);
}

/**
 * Applies image adjustments (saturation, brightness, contrast) to a given image Data URL.
 * @param {string} originalDataUrl - The Data URL of the original image.
 * @param {object} adjustments - An object with saturation, brightness, contrast percentages (e.g., { saturation: 150, brightness: 120, contrast: 80 }).
 * @returns {Promise<string>} A promise that resolves with the Data URL of the adjusted image.
 * @comment This function will be key for the 'Adjust Texture' panel.
 */
export function applyImageAdjustments(originalDataUrl, { saturation, brightness, contrast }) {
    return new Promise((resolve, reject) => {
        console.log(`utils.js: Applying adjustments (Saturation: ${saturation}%, Brightness: ${brightness}%, Contrast: ${contrast}%)`);
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                console.error("utils.js: Could not get 2D context for canvas for adjustments.");
                reject(new Error("Failed to get canvas context"));
                return;
            }

            // Apply filters. Note: filter values are typically 0 to 1 for saturation/brightness/contrast,
            // so we normalize the 0-200% range to 0-2.
            ctx.filter = `
                saturate(${saturation / 100})
                brightness(${brightness / 100})
                contrast(${contrast / 100})
            `;
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/png')); // Output as PNG to preserve transparency if any
        };
        img.onerror = (err) => {
            console.error("utils.js: Failed to load image for adjustments:", err);
            reject(new Error("Failed to load image for adjustments"));
        };
        img.src = originalDataUrl;
    });
}

/**
 * Converts an image Data URL to a specified MIME type, maintaining aspect ratio.
 * @param {string} dataUrl - The source Data URL.
 * @param {string} targetMimeType - The desired output MIME type (e.g., 'image/png', 'image/jpeg').
 * @param {number | null} [targetWidth=null] - Optional target width. If null, original width is used.
 * @param {number | null} [targetHeight=null] - Optional target height. If null, original height is used.
 * @returns {Promise<string>} A promise that resolves with the Data URL of the converted image.
 * @comment This is crucial for the "Upload New Image" panel if the uploaded image doesn't match
 * the type of the selected assets.
 */
export function convertImageDataURL(dataUrl, targetMimeType, targetWidth = null, targetHeight = null) {
    return new Promise((resolve, reject) => {
        console.log(`utils.js: Converting image to ${targetMimeType} with target dimensions: ${targetWidth}x${targetHeight}`);
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = targetWidth || img.width;
            let height = targetHeight || img.height;

            // Adjust dimensions to maintain aspect ratio if only one target dimension is provided
            if (targetWidth && !targetHeight) {
                height = (img.height / img.width) * targetWidth;
            } else if (targetHeight && !targetWidth) {
                width = (img.width / img.height) * targetHeight;
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                console.error("utils.js: Could not get 2D context for canvas during conversion.");
                reject(new Error("Failed to get canvas context"));
                return;
            }

            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL(targetMimeType));
        };
        img.onerror = (err) => {
            console.error("utils.js: Failed to load image for conversion:", err);
            reject(new Error("Failed to load image for conversion"));
        };
        img.src = dataUrl;
    });
}

/**
 * Reads a file from a file input element and returns its Data URL.
 * @param {File} file - The file object from an input element.
 * @returns {Promise<string>} A promise that resolves with the Data URL of the file.
 * @comment Used for reading uploaded files in the "Upload New Image" panel.
 */
export function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        console.log(`utils.js: Reading file ${file.name} as Data URL.`);
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
}
