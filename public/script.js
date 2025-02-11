/************************************
 * script.js
 ************************************/

const BASE_URL = ""; // e.g., "https://yourserver.example.com"
let messages = []; 

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
  const regex = /```json([\s\S]*?)```/i;
  const match = content.match(regex);
  if (!match) {
    return { cleanedText: content, recommendations: [] };
  }

  const jsonString = match[1].trim();
  let recommendations = [];

  try {
    const parsed = JSON.parse(jsonString);
    if (parsed && Array.isArray(parsed.recommendations)) {
      recommendations = parsed.recommendations;
    }
  } catch (error) {
    console.error("Error parsing JSON snippet:", error);
  }

  const cleanedText = content.replace(regex, "").trim();

  return { cleanedText, recommendations };
}

/** Render the conversation in the chat window */
function renderMessages() {
  chatWindow.innerHTML = "";
  
  messages.forEach((msg) => {
    // Hide system messages
    if (msg.role === "system") return;

    // Create a wrapper
    const bubbleWrapper = document.createElement("div");
    bubbleWrapper.classList.add("bubble-wrapper", msg.role);

    // Create the bubble
    const bubble = document.createElement("div");
    bubble.classList.add("message", msg.role);

    // For assistant with 'cleanedText', show that. Otherwise show normal content.
    bubble.innerHTML = msg.cleanedText || msg.content;
    bubbleWrapper.appendChild(bubble);

    // If assistant provided recommendations
    if (msg.role === "assistant" && msg.recommendations && msg.recommendations.length > 0) {
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

    // Append bubble to chat window
    chatWindow.appendChild(bubbleWrapper);

    // If there are product cards
    if (msg.role === "assistant" && msg.recommendations && msg.recommendations.length > 0) {
      const cardContainer = document.createElement("div");
      cardContainer.classList.add("product-card-container");
      msg.recommendations.forEach((product) => {
        const card = renderProductCard(product);
        cardContainer.appendChild(card);
      });
      chatWindow.appendChild(cardContainer);
    }
    chatWindow.scroll({
      top: chatWindow.scrollHeight,
      behavior: "smooth",
    });
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

/** 
 * FEATURE: Show a "loading" indicator while the request is in progress 
 * so the user knows the bot is thinking.
 */
function showLoadingBubble() {
  // Create a bubble-wrapper that acts like an assistant bubble
  const bubbleWrapper = document.createElement("div");
  bubbleWrapper.classList.add("bubble-wrapper", "assistant", "loading-indicator");

  const bubble = document.createElement("div");
  bubble.classList.add("message", "assistant");
  bubble.innerText = "بذار فکر کنم...";

  // Add a spinner element
  const spinner = document.createElement("div");
  spinner.classList.add("spinner");

  bubble.appendChild(spinner);
  bubbleWrapper.appendChild(bubble);

  chatWindow.appendChild(bubbleWrapper);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function hideLoadingBubble() {
  // Remove any existing loading-indicator bubble
  const loadingBubble = document.querySelector(".bubble-wrapper.loading-indicator");
  if (loadingBubble) {
    chatWindow.removeChild(loadingBubble);
  }
}

/** Handle sending a message */
async function handleSend() {
  const text = userInput.value.trim();
  if (!text) return;

  // 1) Push user message, render
  messages.push({ role: "user", content: text });
  renderMessages();
  userInput.value = "";

  // 2) Show a loading bubble while waiting for server
  showLoadingBubble();

  try {
    const response = await fetch(`${BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, sessionId }),
    });

    // 3) Remove loading bubble
    hideLoadingBubble();

    // 4) Handle response
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error from server:", errorText);
      return;
    }

    const data = await response.json();
    if (data.assistantMessage) {
      // Extract JSON recommendations
      const { cleanedText, recommendations } = extractRecommendations(data.assistantMessage.content);

      messages.push({
        role: "assistant",
        cleanedText,
        content: data.assistantMessage.content,
        recommendations
      });
      renderMessages();
    }
  } catch (error) {
    console.error("Error sending message:", error);
    // Also hide the loading bubble if an error occurs
    hideLoadingBubble();
  }
}

/** End chat and go to feedback */
function endChat() {
  window.location.href = "feedback.html";
}

/** Warn on page exit */
window.onbeforeunload = function(e) {
  const message = "اگر پیش از خروج به ما بازخورد بدهید، خوشحال خواهیم شد.";
  e.returnValue = message;
  return message;
};

// Listen for Enter key
userInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleSend();
});
