const loginForm = document.getElementById("dashboard-login-form");
const loginError = document.getElementById("login-error");
const loginSubmit = document.getElementById("dashboard-login-submit");

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginError.textContent = "";
  const tokenInput = loginForm.elements.namedItem("token");
  const body = new URLSearchParams({ token: tokenInput.value });
  loginSubmit.disabled = true;
  loginSubmit.setAttribute("aria-busy", "true");
  const originalText = loginSubmit.textContent;
  loginSubmit.textContent = "Checking...";

  try {
    const response = await fetch("/dashboard/session", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    tokenInput.value = "";
    if (!response.ok) {
      loginError.textContent = "Authentication failed.";
      return;
    }
    window.location.assign("/dashboard");
  } catch {
    tokenInput.value = "";
    loginError.textContent = "Dashboard session unavailable.";
  } finally {
    loginSubmit.disabled = false;
    loginSubmit.removeAttribute("aria-busy");
    loginSubmit.textContent = originalText;
  }
});
