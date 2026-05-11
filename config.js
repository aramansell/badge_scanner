// BadgeScan Configuration
// ========================
// The only required config is your OpenAI API key.
// Get one at: https://platform.openai.com/api-keys
//
// Your key is stored in localStorage and NEVER sent anywhere except
// directly to api.openai.com. No backend, no middleman.
//
// HOW TO SET UP:
// 1. Open index.html in a browser
// 2. When prompted, paste your OpenAI API key (starts with sk-...)
// 3. Allow camera access when prompted
// 4. Start scanning!
//
// MODELS USED:
// - Badge parsing (vision):  gpt-4o            (supports image input)
// - Email lookup:             gpt-4.5-preview   (falls back to gpt-4o)
//
// The app is a static PWA — deploy to Netlify, Vercel, GitHub Pages,
// or any static host. Must be served over HTTPS for camera access
// (localhost works for testing).
