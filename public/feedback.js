/************************************
 * feedback.js
 ************************************/

const BASE_URL = ""; // or your actual server
// sessionId is the same from localStorage
let sessionId = localStorage.getItem("chatSessionId") || "";

/** Handle feedback form submission */
async function submitFeedback(event) {
  event.preventDefault();

  const userName = document.getElementById("userName").value.trim();
  const email = document.getElementById("email").value.trim();
  const ratingOverall = document.getElementById("ratingOverall").value;
  const ratingRecommend = document.getElementById("ratingRecommend").value;
  const userExperience = document.getElementById("userExperience").value.trim();

  const bodyData = {
    sessionId,
    userName,
    email,
    ratingOverall,
    ratingRecommend,
    userExperience
  };

  try {
    const response = await fetch(`${BASE_URL}/api/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bodyData),
    });

    const result = await response.json();
    const feedbackMsg = document.getElementById("feedbackMsg");

    if (response.ok) {
            feedbackMsg.textContent = "بازخورد شما با موفقیت ثبت شد. سپاس از همراهی شما، پس از لحظاتی به صفحه اول هدایت خواهید شد!";
      setTimeout(() => {
        window.location.href = "index.html";
  }, 2000);
      // Optional: clear sessionId if you want a fresh session next time
      // localStorage.removeItem("chatSessionId");
    } else {
      feedbackMsg.textContent = "خطایی رخ داد: " + (result.error || "نامشخص");
    }
  } catch (error) {
    console.error("Error sending feedback:", error);
    document.getElementById("feedbackMsg").textContent = "مشکلی پیش آمد؛ لطفاً دوباره تلاش کنید.";
  }
}
