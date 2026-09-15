const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static('public'));

// In-memory storage for images
const imageStorage = new Map();

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// Routes
app.post('/api/upload', upload.single('photo'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  try {
    // Convert buffer to base64
    const base64Data = req.file.buffer.toString('base64');
    const mimeType = req.file.mimetype;
    const dataUrl = `data:${mimeType};base64,${base64Data}`;
    
    // Generate a unique ID for this image
    const imageId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    
    // Store in memory
    imageStorage.set(imageId, dataUrl);
    
    res.json({ 
      success: true,
      filename: req.file.originalname,
      imageId: imageId,
      filepath: dataUrl
    });
  } catch (error) {
    console.error('Upload processing error:', error);
    res.status(500).json({ error: 'Error processing upload' });
  }
});

// Serve stored images
app.get('/api/image/:imageId', (req, res) => {
  const { imageId } = req.params;
  const dataUrl = imageStorage.get(imageId);
  
  if (!dataUrl) {
    return res.status(404).json({ error: 'Image not found' });
  }
  
  // Parse data URL to get mime type and data
  const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches) {
    return res.status(500).json({ error: 'Invalid image data' });
  }
  
  const mimeType = matches[1];
  const buffer = Buffer.from(matches[2], 'base64');
  
  res.set('Content-Type', mimeType);
  res.set('Content-Length', buffer.length);
  res.send(buffer);
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: err.message || 'Server error' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
