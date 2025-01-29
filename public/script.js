/************************************
 * script.js
 ************************************/

const BASE_URL = "http://localhost:3000"; // Update if server runs elsewhere
let messages = []; // Store the conversation

// 1) Generate or retrieve a sessionId
let sessionId = localStorage.getItem("chatSessionId");
if (!sessionId) {
  sessionId = "session_" + Date.now() + "_" + Math.random().toString(36).substr(2, 8);
  localStorage.setItem("chatSessionId", sessionId);
}

// DOM references
const chatWindow = document.getElementById("chatWindow");
const userInput = document.getElementById("userInput");

/** 
 * Attempt to find a fenced code block containing JSON (```json ... ```).
 * Returns { cleanedText, recommendations }:
 *   - cleanedText: message text with the JSON snippet removed
 *   - recommendations: array of phone objects (if any)
 */
function extractRecommendations(content) {
  // Regex to capture ```json ... ```
  const regex = /```json([\s\S]*?)```/i;
  const match = content.match(regex);
  if (!match) {
    return {
      cleanedText: content,
      recommendations: []
    };
  }

  // This is the raw JSON string between the fences
  const jsonString = match[1].trim();
  let recommendations = [];

  // Try to parse the JSON
  try {
    const parsed = JSON.parse(jsonString);
    if (parsed && Array.isArray(parsed.recommendations)) {
      recommendations = parsed.recommendations;
    }
  } catch (error) {
    console.error("Error parsing JSON snippet:", error);
  }

  // Remove the entire code block from the displayed content
  const cleanedText = content.replace(regex, "").trim();

  return {
    cleanedText,
    recommendations
  };
}

/** Render the conversation in the chat window */
function renderMessages() {
  chatWindow.innerHTML = "";
  
  messages.forEach((msg) => {
    // System messages are hidden
    if (msg.role === "system") return;

    // Create a wrapper for the entire assistant or user "bubble"
    const bubbleWrapper = document.createElement("div");
    bubbleWrapper.classList.add("bubble-wrapper", msg.role);

    // Create the bubble (the grey or green box)
    const bubble = document.createElement("div");
    bubble.classList.add("message", msg.role);

    // If it's an assistant message with 'cleanedText' or normal content
    bubble.innerHTML = msg.cleanedText || msg.content;
    bubbleWrapper.appendChild(bubble);

    // If assistant provided recommendations, we can optionally show bullet points inside the bubble
    if (msg.role === "assistant" && msg.recommendations && msg.recommendations.length > 0) {
      // Create a bullet list of each recommendation
      const ul = document.createElement("ul");
      ul.style.marginTop = "10px";
      msg.recommendations.forEach((rec) => {
        const li = document.createElement("li");
        li.innerHTML = `
          <strong>برند:</strong> ${rec.brand}, 
          <strong>مدل:</strong> ${rec.model}, 
          <strong>دوربین:</strong> ${rec.camera}, 
          <strong>قیمت:</strong> ${rec.price}
        `;
        ul.appendChild(li);
      });
      bubble.appendChild(ul);
    }

    // Then add the entire bubble wrapper to the chat window
    chatWindow.appendChild(bubbleWrapper);

    // If assistant has product cards to show, create them outside the bubble
    if (msg.role === "assistant" && msg.recommendations && msg.recommendations.length > 0) {
      // A container for the cards
      const cardContainer = document.createElement("div");
      cardContainer.classList.add("product-card-container");
      
      msg.recommendations.forEach((product) => {
        const card = renderProductCard(product);
        cardContainer.appendChild(card);
      });
      chatWindow.appendChild(cardContainer);
    }
  });

  // Scroll to bottom
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

/** Render a single product card DOM element */
function renderProductCard(product) {
  const card = document.createElement("div");
  card.classList.add("product-card");
  card.innerHTML = `
    <h3>${product.model}</h3>
    <p><strong>برند:</strong> ${product.brand}</p>
    <p><strong>دوربین:</strong> ${product.camera}</p>
    <p><strong>قیمت:</strong> ${product.price}</p>
  `;
  return card;
}

/** Handle sending a message */
async function handleSend() {
  const text = userInput.value.trim();
  if (!text) return;

  // Add user's message to the conversation
  messages.push({ role: "user", content: text });
  renderMessages();
  userInput.value = "";

  // Send the conversation + sessionId to the server
  try {
    const response = await fetch(`${BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages,
        sessionId
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error from server:", errorText);
      return;
    }

    const data = await response.json();
    if (data.assistantMessage) {
      // 1) Extract recommendations & remove JSON from the text
      const { cleanedText, recommendations } = extractRecommendations(data.assistantMessage.content);

      // 2) Store this in the messages array
      messages.push({
        role: "assistant",
        // Store the cleaned text that hides the JSON snippet
        cleanedText,
        // Keep the original text if you want (but not necessary)
        content: data.assistantMessage.content,
        // Array of phone objects
        recommendations
      });

      // Re-render
      renderMessages();
    }
  } catch (error) {
    console.error("Error sending message:", error);
  }
}
function endChat() {
  window.location.href = "feedback.html";
}
/**
 * Optional: If user tries to close/refresh the page, we can prompt them or redirect.
 * Browsers often override or ignore custom text. They may just say "Are you sure you want to leave?".
 */
window.onbeforeunload = function(e) {
  // Attempt a redirect to feedback. 
  // Usually the browser will show a confirm dialog, if you return a string.
  // If they confirm, they leave the page. If not, they stay.
  const message = "اگر پیش از خروج به ما بازخورد بدهید، خوشحال خواهیم شد.";
  e.returnValue = message; 
  return message;
};

// Listen for "Enter" key in the input field
userInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleSend();
});
