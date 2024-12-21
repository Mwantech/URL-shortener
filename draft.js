// server.js
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

// Constants for API key management
const API_KEY_EXPIRATION_DAYS = 30;
const MAX_KEYS_PER_USER = 5;

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

// API Key Management Functions
const apiKeyManager = {
    generateApiKey() {
        return crypto.randomBytes(16).toString('hex');
    },

    isKeyExpired(keyData) {
        const expirationDate = new Date(keyData.expiresAt);
        return expirationDate < new Date();
    },

    async countUserKeys(userId) {
        const apiKeys = await jsonFileMiddleware.readJSON(API_KEYS_FILE);
        return Object.values(apiKeys).filter(key => key.userId === userId).length;
    },

    getExpirationDate() {
        const date = new Date();
        date.setDate(date.getDate() + API_KEY_EXPIRATION_DAYS);
        return date.toISOString();
    }
};

// Validate API key middleware with enhanced checking
const validateApiKey = async (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
        return res.status(401).json({ error: 'API key is required' });
    }

    try {
        const apiKeys = await jsonFileMiddleware.readJSON(API_KEYS_FILE);
        const keyData = apiKeys[apiKey];

        if (!keyData) {
            return res.status(401).json({ error: 'Invalid API key' });
        }

        if (keyData.revoked) {
            return res.status(401).json({ error: 'API key has been revoked' });
        }

        if (apiKeyManager.isKeyExpired(keyData)) {
            return res.status(401).json({ error: 'API key has expired' });
        }

        // Update last used timestamp
        apiKeys[apiKey].lastUsed = new Date().toISOString();
        await jsonFileMiddleware.writeJSON(API_KEYS_FILE, apiKeys);

        req.userId = keyData.userId;
        req.apiKey = apiKey;
        next();
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};

// API Key Routes
// Generate new API key
app.post('/api/keys', async (req, res) => {
    try {
        const userId = req.body.userId || crypto.randomBytes(8).toString('hex');
        const keyCount = await apiKeyManager.countUserKeys(userId);

        if (keyCount >= MAX_KEYS_PER_USER) {
            return res.status(400).json({ 
                error: `Maximum number of API keys (${MAX_KEYS_PER_USER}) reached for this user` 
            });
        }

        const apiKey = apiKeyManager.generateApiKey();
        const apiKeys = await jsonFileMiddleware.readJSON(API_KEYS_FILE);
        
        apiKeys[apiKey] = {
            userId,
            createdAt: new Date().toISOString(),
            expiresAt: apiKeyManager.getExpirationDate(),
            lastUsed: null,
            revoked: false,
            description: req.body.description || null
        };
        
        await jsonFileMiddleware.writeJSON(API_KEYS_FILE, apiKeys);
        res.json({ 
            apiKey, 
            userId,
            expiresAt: apiKeys[apiKey].expiresAt
        });
    } catch (error) {
        res.status(500).json({ error: 'Error generating API key' });
    }
});

// List all API keys for a user
app.get('/api/keys/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const apiKeys = await jsonFileMiddleware.readJSON(API_KEYS_FILE);
        
        const userKeys = Object.entries(apiKeys)
            .filter(([_, data]) => data.userId === userId)
            .map(([key, data]) => ({
                apiKey: key,
                ...data
            }));

        res.json(userKeys);
    } catch (error) {
        res.status(500).json({ error: 'Error retrieving API keys' });
    }
});

// Revoke an API key
app.delete('/api/keys/:apiKey', async (req, res) => {
    try {
        const { apiKey } = req.params;
        const apiKeys = await jsonFileMiddleware.readJSON(API_KEYS_FILE);

        if (!apiKeys[apiKey]) {
            return res.status(404).json({ error: 'API key not found' });
        }

        apiKeys[apiKey].revoked = true;
        apiKeys[apiKey].revokedAt = new Date().toISOString();
        
        await jsonFileMiddleware.writeJSON(API_KEYS_FILE, apiKeys);
        res.json({ message: 'API key revoked successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Error revoking API key' });
    }
});

// Update API key description
app.patch('/api/keys/:apiKey', async (req, res) => {
    try {
        const { apiKey } = req.params;
        const { description } = req.body;
        const apiKeys = await jsonFileMiddleware.readJSON(API_KEYS_FILE);

        if (!apiKeys[apiKey]) {
            return res.status(404).json({ error: 'API key not found' });
        }

        apiKeys[apiKey].description = description;
        apiKeys[apiKey].updatedAt = new Date().toISOString();
        
        await jsonFileMiddleware.writeJSON(API_KEYS_FILE, apiKeys);
        res.json({ 
            apiKey,
            ...apiKeys[apiKey]
        });
    } catch (error) {
        res.status(500).json({ error: 'Error updating API key' });
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