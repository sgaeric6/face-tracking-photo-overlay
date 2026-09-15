let selectedFile = null;
let cameraActive = false;
let videoStream = null;
let faceDetector = null;
let animationFrameId = null;
let videoElement = null;

const photoInput = document.getElementById('photoInput');
const uploadBtn = document.getElementById('uploadBtn');
const uploadSection = document.getElementById('uploadSection');
const cameraSection = document.getElementById('cameraSection');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const resetBtn = document.getElementById('resetBtn');
const overlayImageElement = document.getElementById('overlayImage');
const uploadBox = document.querySelector('.upload-box');

photoInput.addEventListener('change', (e) => {
  selectedFile = e.target.files[0];
  if (selectedFile) uploadBtn.disabled = false;
});

uploadBox.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadBox.classList.add('dragover');
});

uploadBox.addEventListener('dragleave', () => {
  uploadBox.classList.remove('dragover');
});

uploadBox.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadBox.classList.remove('dragover');
  selectedFile = e.dataTransfer.files[0];
  if (selectedFile && selectedFile.type.startsWith('image/')) {
    uploadBtn.disabled = false;
  }
});

uploadBtn.addEventListener('click', async () => {
  if (!selectedFile) return;
  
  const formData = new FormData();
  formData.append('photo', selectedFile);
  
  try {
    uploadBtn.disabled = true;
    uploadBtn.textContent = 'Uploading...';
    
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });
    
    const data = await response.json();
    
    if (data.success) {
      overlayImageElement.src = data.filepath;
      uploadSection.style.display = 'none';
      cameraSection.style.display = 'block';
      uploadBtn.textContent = 'Upload Photo';
    }
  } catch (error) {
    console.error('Upload error:', error);
    alert('Error uploading photo');
    uploadBtn.disabled = false;
    uploadBtn.textContent = 'Upload Photo';
  }
});

// Initialize Face Detection with better model loading
async function initializeFaceDetection() {
  try {
    await tf.ready();
    console.log('TensorFlow ready');
    faceDetector = await blazeface.load();
    console.log('BlazeFace loaded successfully');
    return true;
  } catch (error) {
    console.error('Face detection init error:', error);
    alert('Face detection model failed to load');
    return false;
  }
}

startBtn.addEventListener('click', async () => {
  try {
    // Request camera with mobile-optimized settings
    videoStream = await navigator.mediaDevices.getUserMedia({
      video: { 
        facingMode: 'user',
        width: { ideal: 640 },
        height: { ideal: 480 }
      },
      audio: false
    });
    
    const video = document.createElement('video');
    video.srcObject = videoStream;
    video.setAttribute('playsinline', 'true'); // Mobile support
    video.setAttribute('autoplay', 'true');
    video.setAttribute('muted', 'true');
    video.play();
    video.style.display = 'none';
    document.body.appendChild(video);
    
    videoElement = video;
    cameraActive = true;
    startBtn.disabled = true;
    stopBtn.disabled = false;
    
    if (!faceDetector) {
      const loaded = await initializeFaceDetection();
      if (!loaded) {
        cameraActive = false;
        startBtn.disabled = false;
        stopBtn.disabled = true;
        videoStream.getTracks().forEach(track => track.stop());
        return;
      }
    }
    
    console.log('Starting face tracking...');
    detectFacesAndTrack(video);
    
  } catch (error) {
    console.error('Camera error:', error);
    alert('Unable to access camera. Please check permissions and try again.');
    startBtn.disabled = false;
  }
});

stopBtn.addEventListener('click', () => {
  cameraActive = false;
  startBtn.disabled = false;
  stopBtn.disabled = true;
  
  if (videoStream) {
    videoStream.getTracks().forEach(track => track.stop());
    videoStream = null;
  }
  
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }
  
  // Reset image position
  overlayImageElement.style.transform = 'translate(0, 0) scale(1)';
});

resetBtn.addEventListener('click', () => {
  if (cameraActive) stopBtn.click();
  uploadSection.style.display = 'block';
  cameraSection.style.display = 'none';
  selectedFile = null;
  photoInput.value = '';
  uploadBtn.disabled = true;
});

// Smooth tracking with interpolation
let smoothX = 0;
let smoothY = 0;
let smoothScale = 1;
const smoothFactor = 0.15; // Adjust for smoother/snappier movement

async function detectFacesAndTrack(video) {
  if (!cameraActive || !faceDetector) return;
  
  try {
    const predictions = await faceDetector.estimateFaces(video, false);
    
    if (predictions && predictions.length > 0) {
      const face = predictions[0];
      const start = face.start;
      const end = face.end;
      
      // Calculate face dimensions
      const faceWidth = end[0] - start[0];
      const faceHeight = end[1] - start[1];
      const faceCenterX = start[0] + faceWidth / 2;
      const faceCenterY = start[1] + faceHeight / 2;
      
      const containerSize = 500;
      
      // Map face position to container (-100 to 100 range)
      const targetX = ((faceCenterX / video.videoWidth) * 200 - 100);
      const targetY = ((faceCenterY / video.videoHeight) * 200 - 100);
      
      // Calculate scale based on face size (0.6 to 1.4 range)
      const faceSize = Math.max(faceWidth, faceHeight);
      const targetScale = 0.7 + (faceSize / video.videoWidth) * 0.8;
      
      // Smooth interpolation for realistic movement
      smoothX += (targetX - smoothX) * smoothFactor;
      smoothY += (targetY - smoothY) * smoothFactor;
      smoothScale += (targetScale - smoothScale) * smoothFactor;
      
      // Apply transformation with smooth movement
      overlayImageElement.style.transform = `translate(${smoothX}px, ${smoothY}px) scale(${smoothScale})`;
      
    } else {
      // Face not detected - slightly reset to center
      smoothX += (0 - smoothX) * smoothFactor * 0.5;
      smoothY += (0 - smoothY) * smoothFactor * 0.5;
      smoothScale += (1 - smoothScale) * smoothFactor * 0.5;
      overlayImageElement.style.transform = `translate(${smoothX}px, ${smoothY}px) scale(${smoothScale})`;
    }
    
  } catch (error) {
    console.error('Detection error:', error);
  }
  
  animationFrameId = requestAnimationFrame(() => detectFacesAndTrack(video));
}

// Initialize on load
window.addEventListener('load', async () => {
  console.log('Page loaded, preparing face detection...');
  const initialized = await initializeFaceDetection();
  if (initialized) {
    console.log('Face detection ready!');
  }
});
