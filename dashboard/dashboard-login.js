const loginForm = document.getElementById("dashboard-login-form");
const loginError = document.getElementById("login-error");

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginError.textContent = "";
  const tokenInput = loginForm.elements.namedItem("token");
  const body = new URLSearchParams({ token: tokenInput.value });

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
  }
});
