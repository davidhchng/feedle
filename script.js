const HF_API_URL = "https://api-inference.huggingface.co/models/Salesforce/blip-image-captioning-large";

// Global variables
let folderFiles = [];
let photoFile = null;
let imageStore = {}; // { imageId: { name, colors } }
let mainImage = null; // NEW
let imageCounter = 0; // to generate unique IDs
let selectedImages = []; // for double-click swap functionality
let currentZoom = 100; // zoom level
let pinnedImages = []; // for triple-click pinning functionality

// Using Hugging Face free inference API - no registration required

// DOM elements
const folderInput = document.getElementById('folderInput');
const photoInput = document.getElementById('photoInput');
const folderPreview = document.getElementById('folderPreview');
const photoPreview = document.getElementById('photoPreview');
const clearBtn = document.getElementById('clearBtn');
const themeInput = document.getElementById('themeInput');
const generateCaptions = document.getElementById('generateCaptions');
const captionsOutput = document.getElementById('captionsOutput');
const themeToggle = document.getElementById('themeToggle');
const feedControls = document.getElementById('feedControls');
const zoomSidebar = document.getElementById('zoomSidebar');
const zoomOut = document.getElementById('zoomOut');
const zoomIn = document.getElementById('zoomIn');
const zoomLevel = document.getElementById('zoomLevel');

// Initialize event listeners
document.addEventListener('DOMContentLoaded', function() {
 setupEventListeners();
});

function setupEventListeners() {
 // Folder input change
 folderInput.addEventListener('change', handleFolderUpload);
 
 // Photo input change
 photoInput.addEventListener('change', handlePhotoUpload);
 
 // Clear button
 clearBtn.addEventListener('click', clearAll);
 
 // Generate captions button
 generateCaptions.addEventListener('click', generateInstagramCaptions);
 
 // Theme toggle button
 themeToggle.addEventListener('click', toggleTheme);
 
 // No feed controls needed for pinning - handled by triple-click
 
 // Zoom controls
 zoomOut.addEventListener('click', zoomOutFeed);
 zoomIn.addEventListener('click', zoomInFeed);

 const downloadFeedBtn = document.getElementById('downloadFeedBtn');
downloadFeedBtn.addEventListener('click', downloadFeedAsZip);
 
 // Drag and drop for upload cards
 setupDragAndDrop();

 // Start with clear button disabled
 clearBtn.disabled = true

 // Start with generate button disabled
 generateCaptions.disabled = true
 
 // Start with download feed button disabled
 downloadFeedBtn.disabled = true
}

function setupDragAndDrop() {
 const uploadCards = document.querySelectorAll('.upload-card');
 
 uploadCards.forEach(card => {
 card.addEventListener('dragover', handleDragOver);
 card.addEventListener('dragleave', handleDragLeave);
 card.addEventListener('drop', handleDrop);
 });
}

function handleDragOver(e) {
 e.preventDefault();
 e.currentTarget.classList.add('dragover');
}

function handleDragLeave(e) {
 e.preventDefault();
 e.currentTarget.classList.remove('dragover');
}

function handleDrop(e) {
 e.preventDefault();
 e.currentTarget.classList.remove('dragover');
 
 const files = Array.from(e.dataTransfer.files);
 const card = e.currentTarget;
 
 if (card.classList.contains('folder-upload')) {
 // For folder upload, we can't directly handle dropped folders
 // So we'll just show a message
 showNotification('Please use the "Choose Folder" button to select a folder', 'info');
 } else if (card.classList.contains('photo-upload')) {
 const imageFiles = files.filter(file => file.type.startsWith('image/'));
 if (imageFiles.length > 0) {
 photoFile = imageFiles[0];
 displayPhotoPreview();
 updateProcessButton();
 } else {
 showNotification('Please select a valid image file', 'error');
 }
 }
}

function handleFolderUpload(e) {
 const files = Array.from(e.target.files);
 folderFiles = files;
 displayFolderPreview();

 // Clear existing images to prevent duplication
 imageStore = {};
 imageCounter = 0;

 files.forEach(file => {
 if (file.type.startsWith("image/")) { // check if its even an image
 const imageId = `img_${++imageCounter}`;
 const reader = new FileReader();

 reader.onload = function(event) {
 const img = new Image();
 img.src = event.target.result;

 img.onload = function() {
 const colorThief = new ColorThief();
 const palette = colorThief.getPalette(img, 8);  
 let colors = palette.map(rgb => rgbToHex(rgb[0], rgb[1], rgb[2]));
 colors.sort((a, b) => poppiness(b) - poppiness(a)); // ✅ new line
 // store in object
 imageStore[imageId] = {
 name: file.name,
 colors: colors,
 src: event.target.result // NEW CHANGES 
 };

 console.log("Stored:", imageStore);
 updateProcessButton();
 };
 };

 reader.readAsDataURL(file);
 }
 });

 updateProcessButton();
}

function handlePhotoUpload(e) {
 const file = e.target.files[0];
 if (file && file.type.startsWith('image/')) {
 photoFile = file;
 displayPhotoPreview();

 const imageId = `img_${++imageCounter}`;
 const reader = new FileReader();

 reader.onload = function(event) {
 const img = new Image();
 img.src = event.target.result;

 img.onload = function() {
 const colorThief = new ColorThief();
 const palette = colorThief.getPalette(img, 8);
 let colors = palette.map(rgb => rgbToHex(rgb[0], rgb[1], rgb[2]));
 colors.sort((a, b) => poppiness(b) - poppiness(a)); // ✅ new line


 mainImage = {
 name: file.name,
 colors: colors,
 src: event.target.result,
 };
 sortDisplayImages(mainImage); // NEWLY ADDED 
 console.log("Stored:", imageStore);
 updateProcessButton();
 };
 };

 reader.readAsDataURL(file);

 updateProcessButton();
 } else {
 showNotification('Please select a valid image file', 'error');
 }
}

function displayFolderPreview() {
 folderPreview.innerHTML = '';
 
 if (folderFiles.length === 0) {
 folderPreview.innerHTML = '<p style="color: #666; font-style: italic;">No files selected</p>';
 return;
 }
 
 const fileCount = folderFiles.length;
 const totalSize = folderFiles.reduce((sum, file) => sum + file.size, 0);
 const sizeText = formatFileSize(totalSize);
 
 folderPreview.innerHTML = `
 <div class="file-item">
 <i class="fas fa-folder"></i>
 <span><strong>${fileCount}</strong> files selected (${sizeText})</span>
 </div>
 `;
 
 // Show first few files
 const maxDisplay = 5;
 const filesToShow = folderFiles.slice(0, maxDisplay);
 
 filesToShow.forEach(file => {
 const fileItem = document.createElement('div');
 fileItem.className = 'file-item';
 fileItem.innerHTML = `
 <i class="fas fa-file"></i>
 <span>${file.name} (${formatFileSize(file.size)})</span>
 `;
 folderPreview.appendChild(fileItem);
 });
 
 if (folderFiles.length > maxDisplay) {
 const moreItem = document.createElement('div');
 moreItem.className = 'file-item';
 moreItem.innerHTML = `
 <i class="fas fa-ellipsis-h"></i>
 <span>... and ${folderFiles.length - maxDisplay} more files</span>
 `;
 folderPreview.appendChild(moreItem);
 }
}

function displayPhotoPreview() {
 photoPreview.innerHTML = '';
 
 if (!photoFile) {
 photoPreview.innerHTML = '<p style="color: #666; font-style: italic;">No photo selected</p>';
 return;
 }
 
 const reader = new FileReader();
 reader.onload = function(e) {
 const img = document.createElement("img");
 img.src = e.target.result;
 img.alt = "Preview";
 img.className = "image-preview";

 // Call color extraction when image is actually loaded
 img.onload = function() {
 generateColorPalette(img);
 };

 photoPreview.innerHTML = '';
 photoPreview.appendChild(img);

 const fileItem = document.createElement('div');
 fileItem.className = 'file-item';
 fileItem.innerHTML = `
 <i class="fas fa-image"></i>
 <span>${photoFile.name} (${formatFileSize(photoFile.size)})</span>
 `;
 photoPreview.appendChild(fileItem);
 };
 reader.readAsDataURL(photoFile);
}

function updateProcessButton() {
    const hasFiles = folderFiles.length > 0 || photoFile !== null;

    // Update Generate button
    generateCaptions.disabled = !hasFiles;
    generateCaptions.innerHTML = '<i class="fas fa-magic"></i> Generate Instagram Feed';

    // Update Clear button
    clearBtn.disabled = !hasFiles;
    clearBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Clear All';

    //Update Download button
    downloadFeedBtn.disabled = !hasFiles;
    downloadFeedBtn.innerHTML = '<i class="fas fa-download"></i> Download Feed'
}

function displayResults() {
 resultsSection.style.display = 'block';
 displayFileList();
 resultsSection.scrollIntoView({ behavior: 'smooth' });
}

function generateColorPalette(imgElement) {
 colorPalette.innerHTML = '<h4>Color Palette</h4>';

 const colorThief = new ColorThief();

 if (imgElement.complete && imgElement.naturalWidth > 0) {
 const palette = colorThief.getPalette(imgElement, 6); 

 palette.forEach((rgb, index) => {
 const hex = rgbToHex(rgb[0], rgb[1], rgb[2]);
 const colorItem = document.createElement('div');
 colorItem.className = 'color-item';
 colorItem.innerHTML = `
 <div class="color-swatch" style="background-color: ${hex}"></div>
 <div class="color-info">
 <div class="color-name">Color ${index + 1}</div>
 <div class="color-value">${hex}</div>
 </div>
 `;
 colorPalette.appendChild(colorItem);
 });
 } else {
 setTimeout(() => generateColorPalette(imgElement), 100);
 }
}

function rgbToHex(r, g, b) {
 return "#" + ((1 << 24) + (r << 16) + (g << 8) + b)
 .toString(16).slice(1).toUpperCase();
}


function displayFileList() {
 fileList.innerHTML = '<h4>Uploaded Files</h4>';
 
 // Add folder files
 if (folderFiles.length > 0) {
 const folderHeader = document.createElement('div');
 folderHeader.className = 'file-list-item';
 folderHeader.innerHTML = '<i class="fas fa-folder"></i> <strong>Folder Contents:</strong>';
 fileList.appendChild(folderHeader);
 
 folderFiles.forEach(file => {
 const fileItem = document.createElement('div');
 fileItem.className = 'file-list-item';
 fileItem.innerHTML = `
 <i class="fas fa-file"></i>
 <span>${file.name} (${formatFileSize(file.size)})</span>
 `;
 fileList.appendChild(fileItem);
 });
 }
 
 // Add photo file
 if (photoFile) {
 const photoHeader = document.createElement('div');
 photoHeader.className = 'file-list-item';
 photoHeader.innerHTML = '<i class="fas fa-image"></i> <strong>Photo:</strong>';
 fileList.appendChild(photoHeader);
 
 const photoItem = document.createElement('div');
 photoItem.className = 'file-list-item';
 photoItem.innerHTML = `
 <i class="fas fa-image"></i>
 <span>${photoFile.name} (${formatFileSize(photoFile.size)})</span>
 `;
 fileList.appendChild(photoItem);
 }
}


function clearAll() {
 // Reset all variables
 folderFiles = [];
 photoFile = null;
 imageStore = {};
 imageCounter = 0;
 mainImage = null;
 
 // Clear inputs
 folderInput.value = '';
 photoInput.value = '';
 
 // Clear previews
 folderPreview.innerHTML = '<p style="color: #666; font-style: italic;">No files selected</p>';
 photoPreview.innerHTML = '<p style="color: #666; font-style: italic;">No photo selected</p>';
 
 // Clear captions output
 captionsOutput.innerHTML = '';
 themeInput.value = '';
 
 // Hide feed controls and zoom sidebar, reset zoom and pins
 feedControls.style.display = 'none';
 zoomSidebar.style.display = 'none';
 currentZoom = 100;
 pinnedImages = [];
 
 showNotification('All files cleared', 'info');
}

function formatFileSize(bytes) {
 if (bytes === 0) return '0 Bytes';
 
 const k = 1024;
 const sizes = ['Bytes', 'KB', 'MB', 'GB'];
 const i = Math.floor(Math.log(bytes) / Math.log(k));
 
 return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function showNotification(message, type = 'info') {
 // Create notification element
 const notification = document.createElement('div');
 notification.className = `notification ${type}`;
 notification.style.cssText = `
 position: fixed;
 top: 20px;
 right: 20px;
 background: ${type === 'error' ? '#dc3545' : type === 'success' ? '#28a745' : '#667eea'};
 color: white;
 padding: 15px 20px;
 border-radius: 10px;
 box-shadow: 0 5px 15px rgba(0,0,0,0.2);
 z-index: 1000;
 font-weight: 500;
 max-width: 300px;
 animation: slideIn 0.3s ease-out;
 `;
 
 notification.textContent = message;
 
 // Add to page
 document.body.appendChild(notification);
 
 // Remove after 3 seconds
 setTimeout(() => {
 notification.style.animation = 'slideOut 0.3s ease-in';
 setTimeout(() => {
 if (notification.parentNode) {
 notification.parentNode.removeChild(notification);
 }
 }, 300);
 }, 3000);
}

// Add CSS for notifications
const style = document.createElement('style');
style.textContent = `
 @keyframes slideIn {
 from { transform: translateX(100%); opacity: 0; }
 to { transform: translateX(0); opacity: 1; }
 }
 
 @keyframes slideOut {
 from { transform: translateX(0); opacity: 1; }
 to { transform: translateX(100%); opacity: 0; }
 }
`;
document.head.appendChild(style);

console.log("Stored:", imageStore);

function displayStoredImages(images = Object.entries(imageStore)) {
 resultsSection.style.display = 'block';
 resultsSection.innerHTML = "<h4>Stored Images & Colors</h4>";

 for (const [id, data] of images) {
 const item = document.createElement("div");
 item.className = "image-result";

 const img = document.createElement("img");
 img.src = data.src;
 img.alt = data.name;
 img.style.maxWidth = "150px";
 img.style.display = "block";
 img.style.marginBottom = "10px";

 const title = document.createElement("p");
 title.innerHTML = `<strong>${data.name}</strong> (${id})`;

 const paletteDiv = document.createElement("div");
 paletteDiv.className = "palette";

 data.colors.forEach(hex => {
 const swatch = document.createElement("div");
 swatch.className = "swatch";
 swatch.style.backgroundColor = hex;
 swatch.style.display = "inline-block";
 swatch.style.width = "30px";
 swatch.style.height = "30px";
 swatch.style.marginRight = "5px";
 paletteDiv.appendChild(swatch);
 });

 item.appendChild(img);
 item.appendChild(title);
 item.appendChild(paletteDiv);

 resultsSection.appendChild(item);
 }
}


function colorDistance(c1, c2) {
 const rDiff = c1[0] - c2[0];
 const gDiff = c1[1] - c2[1];
 const bDiff = c1[2] - c2[2];
 return Math.sqrt(rDiff * rDiff + gDiff * gDiff + bDiff * bDiff);
}

// hex → [r,g,b]
function hexToRgb(hex) {
 const bigint = parseInt(hex.slice(1), 16);
 return [
 (bigint >> 16) & 255,
 (bigint >> 8) & 255,
 bigint & 255
 ];
}

function rgbToHsl(r, g, b) {
 r /= 255; g /= 255; b /= 255;
 const max = Math.max(r, g, b), min = Math.min(r, g, b);
 let h, s, l = (max + min) / 2;

 if (max === min) {
 h = s = 0; // grey
 } else {
 const d = max - min;
 s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
 switch (max) {
 case r: h = (g - b) / d + (g < b ? 6 : 0); break;
 case g: h = (b - r) / d + 2; break;
 case b: h = (r - g) / d + 4; break;
 }
 h /= 6;
 }
 return [h * 360, s * 100, l * 100]; // H in [0-360], S/L in [0-100]
}

function poppiness(hex) {
 const [r, g, b] = hexToRgb(hex);
 const [h, s, l] = rgbToHsl(r, g, b);

 let score = s; // saturation is the base
 if (l < 15 || l > 85) score *= 0.3; // penalize too dark/too light

 return score; // higher = more poppy
}

function paletteSimilarity(colorsA, colorsB) {
 let total = 0;
 let count = 0;

 colorsA.forEach(hexA => {
 const rgbA = hexToRgb(hexA);
 let best = Infinity;
 colorsB.forEach(hexB => {
 const rgbB = hexToRgb(hexB);
 const dist = colorDistance(rgbA, rgbB);
 if (dist < best) best = dist;
 });

 total += best;
 count++;
 });

 return total / count; // average distance
}


function sortDisplayImages(theMainImage) {
    if (!theMainImage) {
        showNotification("No main image selected", "error");
        return [];
    }

    const results = [];
    const threshold = 40; // loosen for debugging

    for (const [id, data] of Object.entries(imageStore)) {
        const score = paletteSimilarity(
            theMainImage.colors.slice(0, 3),
            data.colors.slice(0, 3)
        );
        console.log(`Image ${id} score:`, score); // DEBUG
        if (score < threshold) {
            results.push([id, { ...data, score }]);
        }
    }

    results.sort((a, b) => a[1].score - b[1].score);

    if (results.length === 0) {
        showNotification("No images match your reference photo colors", "info");
        return [];
    }

    console.log(`Found ${results.length} matching images`);
    return results;
}


async function generateInstagramCaptions() {
    const theme = themeInput.value.trim();
  
    if (!theme) {
      showNotification('Please enter a theme for your captions', 'error');
      return;
    }
  
    if (Object.keys(imageStore).length === 0) {
      showNotification('Please upload a folder of images first.', 'error');
      return;
    }
  
    captionsOutput.innerHTML = '';
    generateCaptions.innerHTML = '<div class="loading"></div> Generating...';
    generateCaptions.disabled = true;
  
    try {
      let processedImages = Object.entries(imageStore);
  
      if (mainImage) {
        processedImages = sortDisplayImages(mainImage);
        if (processedImages.length === 0) {
          showNotification('No matches. Using all images instead.', 'info');
          processedImages = Object.entries(imageStore);
        }
      }
  
      // 🔹 Await Gemini captions here
      const captions = await createCaptionsForImages(theme, processedImages);
      displayCaptions(captions);
  
      feedControls.style.display = 'flex';
      zoomSidebar.style.display = 'block';
      showNotification('Instagram feed generated successfully!', 'success');
    } catch (error) {
      console.error('Error generating captions:', error);
      showNotification('Error generating feed. Please try again.', 'error');
    } finally {
      generateCaptions.innerHTML = '<i class="fas fa-magic"></i> Generate Instagram Feed';
      generateCaptions.disabled = false;
    }
  }
  

  async function createCaptionsForImages(theme, imageEntries) {
    const captions = [];
  
    for (const [id, data] of imageEntries) {
      const base64Image = data.src.split(",")[1];
      let caption = null;
  
      try {
        // Try Hugging Face first
        caption = await generateCaption(base64Image);
      } catch (err) {
        console.error("HF caption error, falling back:", err);
      }
  
      // If HF failed OR returned the default failure text → fallback
      if (!caption || caption.includes("Could not generate") || caption.includes("failed")) {
        caption = generateCaptionForImage(data.name, data.colors, theme, captions.length + 1);
      }
  
      captions.push({
        imageName: data.name,
        imageSrc: data.src,
        caption,
        colors: data.colors
      });
    }
  
    return captions;
  }
  

function generateCaptionForImage(imageName, colors, theme, imageNumber) {
 const colorNames = colors.map(hex => getColorName(hex));
 const dominantColor = colorNames[0];
 
 // Use the improved local generation
 return generateLocalCaption(imageName, colors, theme, imageNumber);
}

function generateLocalCaption(imageName, colors, theme, imageNumber) {
 const colorNames = colors.map(hex => getColorName(hex));
 const dominantColor = colorNames[0];
 
 // Create a much more varied and creative caption system
 return generateCreativeCaption(imageName, colors, theme, imageNumber);
}

function generateCreativeCaption(imageName, colors, theme, imageNumber) {
  // Interpret the theme more creatively
  const themeMood = interpretTheme(theme);
  const mood = themeMood.mood;
  const hashtags = themeMood.hashtags;
  
  // Create image-focused captions that use the theme as inspiration, not literal color descriptions
  const captionStyles = [
  // Storytelling style
  () => `Once upon a time, in a ${mood} moment captured forever... ✨ ${hashtags}`,
  () => `The whispers of ${mood} that only this moment can tell 💫 ${hashtags}`,
  () => `In this frame, ${mood} becomes more than just a feeling 🌟 ${hashtags}`,
  
  // Poetic style
  () => `Where memories meet ${mood}, magic dances in the light 🎭 ${hashtags}`,
  () => `The canvas of this moment, painted with ${mood} dreams 🎨 ${hashtags}`,
  () => `In the symphony of life, ${mood} finds its perfect note 🎵 ${hashtags}`,
  
  // Philosophical style
  () => `What if ${mood} was a photograph? It would look like this 🤔 ${hashtags}`,
  () => `The question: Can ${mood} be captured in a single frame? 📸 ${hashtags}`,
  () => `If ${mood} had a visual story, this would be its opening scene 🌈 ${hashtags}`,
  
  // Conversational style
  () => `POV: You're living your best ${mood} life right now 🎬 ${hashtags}`,
  () => `Plot twist: This moment is actually pure ${mood} energy 🎪 ${hashtags}`,
  () => `Hot take: ${mood} looks incredible in this light 🔥 ${hashtags}`,
  
  // Emotional style
  () => `This feels like ${mood} feels like home 🏠 ${hashtags}`,
  () => `When ${mood} and this moment collide, magic happens ✨ ${hashtags}`,
  () => `This frame? It's pure ${mood} energy captured ⚡ ${hashtags}`,
  
  // Creative style
  () => `Imagine if ${mood} was a sunset over mountains 🏔️ ${hashtags}`,
  () => `The recipe for ${mood}: 1 part this moment, 2 parts magic 🧙‍♀️ ${hashtags}`,
  () => `In the dictionary of life, ${mood} is defined by moments like this 📖 ${hashtags}`,
  
  // Abstract style
  () => `This moment + ${mood} = infinite possibilities ∞ ${hashtags}`,
  () => `The theory of ${mood}: it's all about the vibes in this frame 🌀 ${hashtags}`,
  () => `When ${mood} meets this moment, the universe smiles 🌌 ${hashtags}`,
  
  // Playful style
  () => `${mood} called, it wants its vibes back from this photo 📞 ${hashtags}`,
  () => `Plot twist: This photo is actually a ${mood} mood board 🎨 ${hashtags}`,
  () => `The challenge: describe this ${mood} moment in one word. Go! 🎯 ${hashtags}`,
  
  // Inspirational style
  () => `Today's reminder: ${mood} is always in style in moments like this 💪 ${hashtags}`,
  () => `The way to do ${mood}: with confidence and this energy ✨ ${hashtags}`,
  () => `If ${mood} was a superpower, it would look exactly like this 🦸‍♀️ ${hashtags}`,
  
  // Mysterious style
  () => `The secret to ${mood}: shh, it's hidden in this frame 🤫 ${hashtags}`,
  () => `In the shadows of this moment, ${mood} finds its true form 🌑 ${hashtags}`,
  () => `The mystery of ${mood}: solved in this perfect shot 🔍 ${hashtags}`,
  
  // Romantic style
  () => `The way to my heart? Through ${mood} and moments like this 💕 ${hashtags}`,
  () => `If ${mood} was a love language, it would speak in this light 💌 ${hashtags}`,
  () => `The romance of ${mood}: it's written in this perfect frame ⭐ ${hashtags}`,
  
  // Adventure style
  () => `The adventure begins where ${mood} meets this moment 🗺️ ${hashtags}`,
  () => `Pack your ${mood} dreams in frames like this 🎒 ${hashtags}`,
  () => `The expedition to find the perfect ${mood} moment ends here 🧭 ${hashtags}`,
  
  // Artistic style
  () => `The masterpiece of ${mood}: painted with perfect timing 🖌️ ${hashtags}`,
  () => `In the gallery of life, ${mood} is the star of this exhibit 🎭 ${hashtags}`,
  () => `The art of ${mood}: it's all in the details of this shot 🎨 ${hashtags}`,
  
  // Energetic style
  () => `The energy of ${mood}: it's electric in this frame! ⚡ ${hashtags}`,
  () => `When ${mood} meets this moment, the party starts 🎉 ${hashtags}`,
  () => `The power of ${mood}: it's unstoppable in this shot! 💥 ${hashtags}`,
  
  // Chill style
  () => `The zen of ${mood}: peaceful and perfect in this moment 🧘‍♀️ ${hashtags}`,
  () => `In the calm of this ${mood} frame, everything makes sense 🌸 ${hashtags}`,
  () => `The serenity of ${mood}: it's pure bliss captured here 🕯️ ${hashtags}`
  ];
  
  // Randomly select a style and execute it
  const randomStyle = captionStyles[Math.floor(Math.random() * captionStyles.length)];
  return randomStyle();
}

function interpretTheme(theme, dominantHex = null) {
    const themeLower = theme.toLowerCase();
    const words = themeLower.split(/\s+/);
  
    // --- STEP 1: Theme keyword check ---
    if (words.some(word => ['romantic','love','romance','sweet','tender','passionate','intimate','affectionate','caring'].includes(word))) {
      return { mood: 'romantic', hashtags: '#romantic #love #aesthetic' };
    }
    if (words.some(word => ['adventure','explore','travel','wander','journey','wild','outdoor','bold','daring','exciting'].includes(word))) {
      return { mood: 'adventurous', hashtags: '#adventure #explore #wanderlust' };
    }
    if (words.some(word => ['casual','chill','relaxed','easy','simple','comfortable','laid','back','mellow'].includes(word))) {
      return { mood: 'chill', hashtags: '#casual #chill #vibes' };
    }
    if (words.some(word => ['mysterious','mystery','dark','moody','mystical','enigmatic','secretive','hidden','shadowy'].includes(word))) {
      return { mood: 'mysterious', hashtags: '#mysterious #moody #darkaesthetic' };
    }
    if (words.some(word => ['fun','playful','happy','joyful','cheerful','bright','lively','energetic','upbeat'].includes(word))) {
      return { mood: 'playful', hashtags: '#fun #playful #happy' };
    }
    if (words.some(word => ['poetic','poetry','artistic','creative','elegant','sophisticated','beautiful','graceful'].includes(word))) {
      return { mood: 'artistic', hashtags: '#poetic #artistic #creative' };
    }
    if (words.some(word => ['exciting','energy','vibrant','dynamic','intense','powerful','electric','thrilling'].includes(word))) {
      return { mood: 'energetic', hashtags: '#exciting #energy #vibrant' };
    }
  
    // --- STEP 2: Color-based fallback ---
    if (dominantHex) {
      const [r, g, b] = hexToRgb(dominantHex);
  
      // Greenish tones → matcha / nature / picnic
      if (g > 160 && r < 200 && b < 160) {
        return { mood: "nature", hashtags: "#matcha #nature #picnic #fresh" };
      }
      // Yellowish → summer / vibes
      if (r > 200 && g > 200 && b < 120) {
        return { mood: "summer", hashtags: "#summer #vibes #sunny" };
      }
      // Pink / purple → flower
      if (r > 200 && b > 150 && g < 180) {
        return { mood: "floral", hashtags: "#flower #bloom #springvibes" };
      }
      // Blue tones → calm / fresh
      if (b > 180 && r < 160 && g < 200) {
        return { mood: "calm", hashtags: "#fresh #calm #serene" };
      }
      // Orange / warm tones → cozy / picnic
      if (r > 200 && g > 120 && b < 100) {
        return { mood: "cozy", hashtags: "#picnic #cozy #warmvibes" };
      }
    }
  
    // --- STEP 3: Random fallback moods ---
    const defaultMoods = [
      { mood: "aesthetic", hashtags: "#aesthetic #vibes #mood" },
      { mood: "dreamy", hashtags: "#dreamy #vibes #magic" },
      { mood: "vintage", hashtags: "#vintage #retro #classic" },
      { mood: "modern", hashtags: "#modern #minimal #clean" },
      { mood: "bold", hashtags: "#bold #bright #statement" }
    ];
  
    return defaultMoods[Math.floor(Math.random() * defaultMoods.length)];
  }

function getColorName(hex) {
  const rgb = hexToRgb(hex);
  const [r, g, b] = rgb;
  const [h, s, l] = rgbToHsl(r, g, b);
  
  // Enhanced color detection using HSL values for better accuracy
  if (l < 20) return 'black';
  if (l > 85) return 'white';
  if (s < 15) return 'gray';
  
  // Use hue for primary color detection
  if (h >= 0 && h < 15) return 'red';
  if (h >= 15 && h < 45) return 'orange';
  if (h >= 45 && h < 75) return 'yellow';
  if (h >= 75 && h < 165) return 'green';
  if (h >= 165 && h < 195) return 'cyan';
  if (h >= 195 && h < 255) return 'blue';
  if (h >= 255 && h < 285) return 'purple';
  if (h >= 285 && h < 315) return 'pink';
  if (h >= 315 && h < 360) return 'red';
  
  return 'colorful';
}   

function displayCaptions(captions) {
    captionsOutput.innerHTML = '<h4>Instagram Feed</h4>';
  
    const feedContainer = document.createElement('div');
    feedContainer.className = 'instagram-feed';
  
    captions.forEach((item, index) => {
      const flipCard = document.createElement('div');
      flipCard.className = 'flip-card';
      flipCard.innerHTML = `
        <div class="flip-card-inner">
          <div class="flip-card-front">
            <img src="${item.imageSrc}" alt="${item.imageName}" class="feed-image" />
            <div class="image-overlay">
              <i class="fas fa-eye"></i>
            </div>
            <button class="pin-btn-front" onclick="handleImagePinning(this.closest('.flip-card'), ${index})">
              <i class="fas fa-thumbtack"></i>
            </button>
            <button class="remove-btn-front" onclick="removeImageFromFeed(this.closest('.flip-card'), ${index})">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="flip-card-back">
            <div class="caption-content">
              <p class="caption-text">${item.caption}</p>
              <div class="color-chips">
                ${item.colors.map(color => `<span class="color-chip" style="background-color: ${color}"></span>`).join('')}
              </div>
              <div class="caption-actions">
                <button class="copy-btn" onclick="copyToClipboard('${item.caption.replace(/'/g, "\\'")}')">
                  <i class="fas fa-copy"></i> Copy Caption
                </button>
                <button class="regenerate-btn" onclick="regenerateCaption(this.closest('.flip-card'), ${index})">
                  <i class="fas fa-sync-alt"></i> Regenerate
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
  
      // Flip behaviour
      flipCard.addEventListener('click', function(event) {
        if (event.target.closest('button') || event.target.closest('input')) return;
        flipCard.classList.toggle('flipped');
      });
  
      // Double-click swap
      flipCard.addEventListener('dblclick', function() {
        handleImageSelection(flipCard, index);
      });
  
      feedContainer.appendChild(flipCard);
    });
  
    captionsOutput.appendChild(feedContainer);
  }
  

function copyToClipboard(text) {
 navigator.clipboard.writeText(text).then(() => {
 showNotification('Caption copied to clipboard!', 'success');
 }).catch(() => {
 showNotification('Failed to copy caption', 'error');
 });
}

function toggleTheme() {
 const body = document.body;
 const isLightMode = body.classList.contains('light-mode');
 
 if (isLightMode) {
 body.classList.remove('light-mode');
 themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
 } else {
 body.classList.add('light-mode');
 themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
 }
}

function handleImageSelection(flipCard, index) {
 // Add visual selection indicator
 flipCard.classList.toggle('selected');
 
 if (flipCard.classList.contains('selected')) {
 selectedImages.push({ element: flipCard, index: index });
 showNotification(`Image ${selectedImages.length} selected. Double-click another to swap.`, 'info');
 } else {
 selectedImages = selectedImages.filter(item => item.element !== flipCard);
 }
 
 // If two images are selected, swap them
 if (selectedImages.length === 2) {
 swapImages(selectedImages[0], selectedImages[1]);
 selectedImages = [];
 }
}

function swapImages(image1, image2) {
 const feedContainer = document.querySelector('.instagram-feed');
 const children = Array.from(feedContainer.children);
 
 // Get the actual DOM elements
 const element1 = image1.element;
 const element2 = image2.element;
 
 // Get their current positions
 const index1 = children.indexOf(element1);
 const index2 = children.indexOf(element2);
 
 // Swap their positions in the DOM
 if (index1 < index2) {
 feedContainer.insertBefore(element2, element1);
 feedContainer.insertBefore(element1, children[index2 + 1]);
 } else {
 feedContainer.insertBefore(element1, element2);
 feedContainer.insertBefore(element2, children[index1 + 1]);
 }
 
 // Remove selection styling
 element1.classList.remove('selected');
 element2.classList.remove('selected');
 
 showNotification('Images swapped successfully!', 'success');
}

function handleImagePinning(flipCard, index) {
 const feedContainer = document.querySelector('.instagram-feed');
 if (!feedContainer) return;
 
 // Check if already pinned
 if (flipCard.classList.contains('pinned')) {
 // Unpin the image
 flipCard.classList.remove('pinned');
 pinnedImages = pinnedImages.filter(item => item.element !== flipCard);
 showNotification('Image unpinned', 'info');
 return;
 }
 
 // Check if we already have 3 pinned images
 if (pinnedImages.length >= 3) {
 // Remove the first pinned image
 const firstPinned = pinnedImages.shift();
 firstPinned.element.classList.remove('pinned');
 showNotification('First pinned image removed', 'info');
 }
 
 // Pin the new image
 flipCard.classList.add('pinned');
 pinnedImages.push({ element: flipCard, index: index });
 
 // Move pinned images to the top row
 movePinnedToTop();
 
 showNotification(`Image pinned! (${pinnedImages.length}/3)`, 'success');
}

function movePinnedToTop() {
  const feedContainer = document.querySelector('.instagram-feed');
  if (!feedContainer) return;
  
  // Move all pinned images to the beginning
  pinnedImages.forEach(({ element }) => {
  feedContainer.insertBefore(element, feedContainer.firstChild);
  });
}

function removeImageFromFeed(flipCard, index) {
  // Remove from pinned images if it was pinned
  pinnedImages = pinnedImages.filter(item => item.element !== flipCard);
  
  // Remove the flip card from the DOM
  flipCard.remove();
  
  showNotification('Image removed from feed', 'info');
}

function zoomOutFeed() {
 if (currentZoom > 25) {
 currentZoom -= 25;
 updateZoom();
 }
}

function zoomInFeed() {
 if (currentZoom < 300) {
 currentZoom += 25;
 updateZoom();
 }
}

function updateZoom() {
 const feedContainer = document.querySelector('.instagram-feed');
 if (feedContainer) {
 feedContainer.style.transform = `scale(${currentZoom / 100})`;
 feedContainer.style.transformOrigin = 'top center';
 zoomLevel.textContent = `${currentZoom}%`;
 }
}

function regenerateCaption(flipCard, index) {
 const theme = themeInput.value.trim();
 if (!theme) {
 showNotification('Please enter a theme first', 'error');
 return;
 }
 
 // Get the image data
 const img = flipCard.querySelector('.feed-image');
 const imageName = img.alt;
 
 // Find this image in our stored data
 let storedColors = null;
 for (const [id, data] of Object.entries(imageStore)) {
 if (data.name === imageName) {
 storedColors = data.colors;
 break;
 }
 }
 
 if (!storedColors) {
 showNotification('Image data not found', 'error');
 return;
 }
 
 // Generate new caption
 const newCaption = generateCaptionForImage(imageName, storedColors, theme, index + 1);
 
 // Update the caption text
 const captionText = flipCard.querySelector('.caption-text');
 captionText.textContent = newCaption;
 
 // Update the copy button onclick
 const copyBtn = flipCard.querySelector('.copy-btn');
 copyBtn.setAttribute('onclick', `copyToClipboard('${newCaption.replace(/'/g, "\\'")}')`);
 
 showNotification('Caption regenerated!', 'success');
}

function suggestCaptionChanges(button) {
  const suggestionInput = button.previousElementSibling;
  const suggestion = suggestionInput.value.trim();
  
  if (!suggestion) {
  showNotification('Please enter a suggestion', 'error');
  return;
  }
  
  // Find the flip card that contains this button
  const flipCard = button.closest('.flip-card');
  const cardIndex = Array.from(document.querySelectorAll('.flip-card')).indexOf(flipCard);
  
  // Get the current image data
  const currentImage = imageStore[Object.keys(imageStore)[cardIndex]];
  if (currentImage) {
  // Use the suggestion as the new theme direction for creative interpretation
  const newCaption = generateCaptionForImage(currentImage.name, currentImage.colors, suggestion, cardIndex + 1);
  
  // Update the caption text
  const captionTextElement = flipCard.querySelector('.caption-text');
  if (captionTextElement) {
  captionTextElement.textContent = newCaption;
  // Update the copy button onclick
  const copyBtn = flipCard.querySelector('.copy-btn');
  copyBtn.setAttribute('onclick', `copyToClipboard('${newCaption.replace(/'/g, "\\'")}')`);
  showNotification(`Caption updated with your suggestion!`, 'success');
  suggestionInput.value = ''; // Clear input
  }
  } else {
  showNotification('Could not find image data to update caption.', 'error');
  }
}

// Gradient functions removed - replaced with pinning functionality


// ✅ NEW: Browser-safe caption generator using Hugging Face


async function generateCaption(base64Image) {
    try {
      const imageInput = "data:image/jpeg;base64," + base64Image;
      const response = await fetch(
        "https://api-inference.huggingface.co/models/Salesforce/blip-image-captioning-large",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            inputs: { image: imageInput }
          }),
        }
      );
  
      const result = await response.json();
      console.log("HF caption result:", result);
  
      if (Array.isArray(result) && result[0]?.generated_text) {
        return result[0].generated_text;
      }
      return "✨ Could not generate caption, please try again ✨";
    } catch (err) {
      console.error("Error calling HF API:", err);
      return "⚠️ Caption generation failed";
    }
  }

  async function downloadFeedAsZip() {
    if (!document.querySelector('.instagram-feed')) {
      showNotification('No feed to save!', 'error');
      return;
    }
  
    const zip = new JSZip();
    const folder = zip.folder("Feedle_Export");
    const cards = document.querySelectorAll('.flip-card-front');
  
    for (let i = 0; i < cards.length; i++) {
      const img = cards[i].querySelector('.feed-image');
      const caption = cards[i].querySelector('.caption-text')?.textContent || "";
      const filename = `${String(i + 1).padStart(2, '0')}_${img.alt || 'image'}.jpg`;
  
      // Add image
      const imgData = img.src.split(",")[1]; // remove data prefix
      folder.file(filename, imgData, { base64: true });
  
      // Add caption text
      folder.file(filename.replace('.jpg', '.txt'), caption);
    }
  
    const content = await zip.generateAsync({ type: "blob" });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(content);
    a.download = "Feedle_Feed.zip";
    a.click();
  
    showNotification('Feed downloaded as ZIP!', 'success');
  }
