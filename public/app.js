let selectedFile = null;
let cameraActive = false;
let videoStream = null;
let faceDetector = null;
let animationFrameId = null;

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

async function initializeFaceDetection() {
  try {
    await tf.ready();
    faceDetector = await blazeface.load();
  } catch (error) {
    console.error('Face detection init error:', error);
  }
}

startBtn.addEventListener('click', async () => {
  try {
    videoStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user' }
    });
    
    const video = document.createElement('video');
    video.srcObject = videoStream;
    video.play();
    video.style.display = 'none';
    document.body.appendChild(video);
    
    cameraActive = true;
    startBtn.disabled = true;
    stopBtn.disabled = false;
    
    if (!faceDetector) {
      await initializeFaceDetection();
    }
    
    detectFacesAndTrack(video);
  } catch (error) {
    console.error('Camera error:', error);
    alert('Unable to access camera');
  }
});

stopBtn.addEventListener('click', () => {
  cameraActive = false;
  startBtn.disabled = false;
  stopBtn.disabled = true;
  
  if (videoStream) {
    videoStream.getTracks().forEach(track => track.stop());
  }
  
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }
});

resetBtn.addEventListener('click', () => {
  if (cameraActive) stopBtn.click();
  uploadSection.style.display = 'block';
  cameraSection.style.display = 'none';
  selectedFile = null;
  photoInput.value = '';
  uploadBtn.disabled = true;
});

async function detectFacesAndTrack(video) {
  if (!cameraActive) return;
  
  try {
    const predictions = await faceDetector.estimateFaces(video, false);
    
    if (predictions && predictions.length > 0) {
      const face = predictions[0];
      const start = face.start;
      const end = face.end;
      
      const faceWidth = end[0] - start[0];
      const faceHeight = end[1] - start[1];
      const faceCenterX = start[0] + faceWidth / 2;
      const faceCenterY = start[1] + faceHeight / 2;
      
      const containerSize = 500;
      const faceScale = Math.max(faceWidth, faceHeight) / 100;
      
      const offsetX = (faceCenterX / video.videoWidth) * containerSize - containerSize / 2;
      const offsetY = (faceCenterY / video.videoHeight) * containerSize - containerSize / 2;
      
      overlayImageElement.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${0.8 + faceScale * 0.2})`;
    }
  } catch (error) {
    console.error('Detection error:', error);
  }
  
  animationFrameId = requestAnimationFrame(() => detectFacesAndTrack(video));
}

window.addEventListener('load', () => {
  initializeFaceDetection();
});
