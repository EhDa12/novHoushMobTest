/************************************
 * server.js
 ************************************/
require('dotenv').config();  // Load .env
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

// --- 1) Load the phone catalog from phones.json
const phonesPath = path.join(__dirname, 'phones.json');
let phoneCatalog = [];
try {
  const fileData = fs.readFileSync(phonesPath, 'utf-8');
  phoneCatalog = JSON.parse(fileData);
} catch (error) {
  console.error('Error reading phones.json:', error);
  phoneCatalog = [];
}

const app = express();
const PORT = 3000;

app.use(bodyParser.json());

// --- 2) Serve frontend from 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

/**
 * POST /api/chat
 * Expects: { messages: [ { role: "user"|"assistant", content: string }, ... ], sessionId: string }
 * Returns: { assistantMessage: { role: "assistant", content: string } }
 */
app.post('/api/chat', async (req, res) => {
  const { messages, sessionId } = req.body;

  // Validate the request body
  if (!messages || !sessionId) {
    return res.status(400).json({ error: 'No messages or sessionId provided' });
  }

  // --- 3) Build the "system" prompt using the phone catalog
  const systemPrompt = `
  You are a helpful shopping assistant. You ONLY know about the following phone catalog:
  
  ${JSON.stringify(phoneCatalog, null, 2)}
  
  Instructions:
  1. Only use the above phone catalog to answer questions about phones.
  2. If a user's requirements do not match any phone, politely apologize and suggest the closest phone in the catalog.
  3. Never use external sources or knowledge beyond the catalog.
  4. Act like a friendly salesperson in a real shop.
  5. **Important**: Whenever you recommend phones, provide the phone list in a JSON block at the end of your message:
     \`\`\`json
     {
       "recommendations": [
         {
           "brand": "BrandName",
           "model": "ModelName",
           "camera": "...",
           "price": "..."
         },
         ...
       ]
     }
     \`\`\`
     This helps the front-end parse and display product cards.
  `;

  // Insert system message at the start of the conversation
  const conversation = [
    { role: 'system', content: systemPrompt },
    ...messages
  ];

  // --- 4) Call the Avalai "chat completions" endpoint
  try {
    const response = await fetch("https://api.avalai.ir/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.AVALAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o",   // or whichever model Avalai suggests
        messages: conversation,
        temperature: 0.7   // or your preference
      })
    });

    // Optional logging
    console.log('Avalai response status:', response.status);

    // If not OK, read raw text for error details
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Avalai error:", errorText);
      return res.status(response.status).send(errorText);
    }

    // Parse JSON
    const data = await response.json();
    if (!data.choices || !data.choices.length) {
      return res.status(500).json({ error: 'No assistant response from Avalai' });
    }

    const assistantMessage = data.choices[0].message; // { role: "assistant", content: ... }

    // --- 5) Save or append the conversation to a single file per session
    try {
      const logsDir = path.join(__dirname, '/newLogs/chat_logs');
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }

      // Build filename for this user's session
      const logFilePath = path.join(logsDir, `chat_${sessionId}.json`);

      // If there's an existing file, load its content
      let existingConversation = [];
      if (fs.existsSync(logFilePath)) {
        const fileData = fs.readFileSync(logFilePath, 'utf-8');
        existingConversation = JSON.parse(fileData);
      }

      // Get the user's last message
      const lastUserMessage = messages[messages.length - 1] || null;
      const timestamp = new Date().toISOString();

      // Append user + assistant messages with timestamps
      if (lastUserMessage && lastUserMessage.role === 'user') {
        existingConversation.push({
          role: 'user',
          content: lastUserMessage.content,
          timestamp
        });
      }

      existingConversation.push({
        role: 'assistant',
        content: assistantMessage.content,
        timestamp
      });

      // Write the updated array back to the file
      fs.writeFileSync(logFilePath, JSON.stringify(existingConversation, null, 2), 'utf-8');
    } catch (err) {
      console.error("Error saving conversation to file:", err);
    }

    // Return the assistant's response to the client
    return res.json({ assistantMessage });
  } catch (error) {
    console.error('Error calling Avalai API:', error);
    return res.status(500).json({ error: error.toString() });
  }
});

/**
 * POST /api/feedback
 * Expects: 
 *   { sessionId: string, userName?: string, email?: string, userExperience: string, rating: number, ... }
 * We'll store the feedback in feedback.json
 */
app.post('/api/feedback', (req, res) => {
  const { 
    sessionId, 
    userName, 
    email, 
    userExperience, 
    ratingOverall, 
    ratingRecommend 
  } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
   }

  // Load or create feedback.json
  const feedbackFilePath = path.join(__dirname, '/newLogs/feedback.json');
  let feedbackData = [];
  if (fs.existsSync(feedbackFilePath)) {
    const raw = fs.readFileSync(feedbackFilePath, 'utf-8');
    feedbackData = JSON.parse(raw);
  }

  // Add new entry
  const newEntry = {
    sessionId,
    userName,
    email,
    ratingOverall,
    ratingRecommend,
    userExperience,
    submittedAt: new Date().toISOString()
  };

  feedbackData.push(newEntry);

  fs.writeFileSync(feedbackFilePath, JSON.stringify(feedbackData, null, 2), 'utf-8');
  return res.json({ success: true, message: 'بازخورد شما ثبت شد. متشکریم!' });
});

// --- 6) Start the server
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
