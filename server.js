// server.js - Main application file
const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');
const app = express();

// Middleware
app.use(express.json());

// File paths
const API_KEYS_FILE = path.join(__dirname, 'data', 'api-keys.json');
const URLS_FILE = path.join(__dirname, 'data', 'urls.json');

// Ensure data directory exists
const ensureDataDir = async () => {
    try {
        await fs.mkdir(path.join(__dirname, 'data'), { recursive: true });
    } catch (error) {
        console.error('Error creating data directory:', error);
    }
};

// JSON file operations middleware
const jsonFileMiddleware = {
    async readJSON(filePath) {
        try {
            const data = await fs.readFile(filePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            if (error.code === 'ENOENT') {
                return {};
            }
            throw error;
        }
    },

    async writeJSON(filePath, data) {
        await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    }
};

// Validate API key middleware
const validateApiKey = async (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
        return res.status(401).json({ error: 'API key is required' });
    }

    try {
        const apiKeys = await jsonFileMiddleware.readJSON(API_KEYS_FILE);
        if (!apiKeys[apiKey]) {
            return res.status(401).json({ error: 'Invalid API key' });
        }
        req.userId = apiKeys[apiKey].userId;
        next();
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Generate short URL
const generateShortUrl = () => {
    return crypto.randomBytes(4).toString('hex');
};

// URL validation
const isValidUrl = (string) => {
    try {
        new URL(string);
        return true;
    } catch (error) {
        return false;
    }
};

// Routes
// Generate API key
app.post('/api/keys', async (req, res) => {
    try {
        const apiKey = crypto.randomBytes(16).toString('hex');
        const userId = crypto.randomBytes(8).toString('hex');
        
        const apiKeys = await jsonFileMiddleware.readJSON(API_KEYS_FILE);
        apiKeys[apiKey] = {
            userId,
            createdAt: new Date().toISOString()
        };
        
        await jsonFileMiddleware.writeJSON(API_KEYS_FILE, apiKeys);
        res.json({ apiKey, userId });
    } catch (error) {
        res.status(500).json({ error: 'Error generating API key' });
    }
});

// Shorten URL
app.post('/api/shorten', validateApiKey, async (req, res) => {
    const { url } = req.body;
    
    if (!url || !isValidUrl(url)) {
        return res.status(400).json({ error: 'Invalid URL provided' });
    }

    try {
        const urls = await jsonFileMiddleware.readJSON(URLS_FILE);
        const shortUrl = generateShortUrl();
        
        urls[shortUrl] = {
            originalUrl: url,
            userId: req.userId,
            createdAt: new Date().toISOString()
        };
        
        await jsonFileMiddleware.writeJSON(URLS_FILE, urls);
        res.json({
            shortUrl: `${req.protocol}://${req.get('host')}/${shortUrl}`,
            originalUrl: url
        });
    } catch (error) {
        res.status(500).json({ error: 'Error shortening URL' });
    }
});

// Redirect to original URL
app.get('/:shortUrl', async (req, res) => {
    try {
        const { shortUrl } = req.params;
        const urls = await jsonFileMiddleware.readJSON(URLS_FILE);
        
        if (!urls[shortUrl]) {
            return res.status(404).json({ error: 'Short URL not found' });
        }
        
        res.redirect(urls[shortUrl].originalUrl);
    } catch (error) {
        res.status(500).json({ error: 'Error redirecting to URL' });
    }
});

// Initialize server
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    await ensureDataDir();
    console.log(`Server running on port ${PORT}`);
});