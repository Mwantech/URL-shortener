# URL Shortener Application

A Node.js URL shortening service with API key authentication and JSON storage.

## Features

- URL shortening with unique identifiers
- API key authentication
- JSON-based storage for URLs and API keys
- Error handling and input validation
- RESTful API endpoints
- Redirect service for shortened URLs

## Setup

1. Install dependencies:
```bash
npm install express
```

2. Create a `data` directory in the project root (automatically created on first run).

3. Start the server:
```bash
node server.js
```

The server will run on port 3000 by default (configurable via PORT environment variable).

## API Endpoints

### 1. Generate API Key
```
POST /api/keys
```
Returns a new API key and associated user ID.

Example response:
```json
{
  "apiKey": "f7d12a0b4e2c6f8d",
  "userId": "9a8b7c6d"
}
```

### 2. Shorten URL
```
POST /api/shorten
Headers: 
  - X-API-Key: your-api-key
Body:
  {
    "url": "https://example.com/very/long/url"
  }
```
Returns the shortened URL.

Example response:
```json
{
  "shortUrl": "http://localhost:3000/a1b2c3d4",
  "originalUrl": "https://example.com/very/long/url"
}
```

### 3. Access Shortened URL
```
GET /:shortUrl
```
Redirects to the original URL.

## Error Handling

The application handles various error cases:
- Invalid URLs
- Missing or invalid API keys
- Non-existent short URLs
- Server errors

## Scalability Considerations

For production use, consider the following improvements:

1. **Database Migration:**
   - Replace JSON file storage with a proper database (e.g., MongoDB, PostgreSQL)
   - Implement database indexing for faster lookups
   - Add caching layer (e.g., Redis) for frequently accessed URLs

2. **Performance Optimizations:**
   - Implement rate limiting
   - Add request caching
   - Use load balancer for horizontal scaling

3. **Security Enhancements:**
   - Add HTTPS support
   - Implement request validation middleware
   - Add URL scanning for malicious content
   - Implement API key rotation

4. **Monitoring and Logging:**
   - Add request logging
   - Implement performance monitoring
   - Set up error tracking

## Testing

To test the application:

1. Generate an API key:
```bash
curl -X POST http://localhost:3000/api/keys
```

2. Shorten a URL:
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"url":"https://example.com/long/url"}' \
  http://localhost:3000/api/shorten
```

3. Visit the shortened URL in your browser or use curl:
```bash
curl -L http://localhost:3000/shortUrl
```