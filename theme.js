const THEME_STORAGE_KEY = "between-the-lines-theme";

function getStoredTheme() {
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY);
  } catch (error) {
    return null;
  }
}

function saveTheme(theme) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch (error) {
    // The site still works if browser storage is unavailable.
  }
}

function isDarkTheme() {
  return document.documentElement.dataset.theme === "dark";
}

function updateThemeButton() {
  const button = document.getElementById("theme-toggle");
  if (!button) return;
  const dark = isDarkTheme();
  button.setAttribute("aria-pressed", String(dark));
  button.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
  button.innerHTML = `<span class="theme-toggle-icon" aria-hidden="true">${dark ? "☀" : "◐"}</span><span>${dark ? "Light mode" : "Dark mode"}</span>`;
}

function setTheme(theme) {
  if (theme === "dark") document.documentElement.dataset.theme = "dark";
  else delete document.documentElement.dataset.theme;
  saveTheme(theme);
  updateThemeButton();
  window.dispatchEvent(new CustomEvent("themechange", { detail: { theme } }));
}

const storedTheme = getStoredTheme();
const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
if (storedTheme === "dark" || (!storedTheme && prefersDark)) document.documentElement.dataset.theme = "dark";

document.addEventListener("DOMContentLoaded", () => {
  updateThemeButton();
  const button = document.getElementById("theme-toggle");
  if (button) button.addEventListener("click", () => setTheme(isDarkTheme() ? "light" : "dark"));
});
