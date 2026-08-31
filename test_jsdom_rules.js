const { JSDOM } = require("jsdom");
const fs = require("fs");

const html = fs.readFileSync("/Users/vladimir/Documents/GitHub/Love-play/index.html", "utf8");
const coreCode = fs.readFileSync("/Users/vladimir/Documents/GitHub/Love-play/games/core.js", "utf8");

const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true });
const window = dom.window;

try {
  const scriptEl = window.document.createElement("script");
  scriptEl.textContent = coreCode;
  window.document.body.appendChild(scriptEl);
} catch(e) {
  console.error("Script error:", e.message);
}

const hub = window.document.getElementById("rulesHubModal");
const list = window.document.getElementById("rulesHubList");

console.log("rulesHubModal exists:", !!hub);
console.log("rulesHubList exists:", !!list);
console.log("list.innerHTML length:", list ? list.innerHTML.length : 0);

if (list && list.innerHTML.length > 0) {
  const groups = list.querySelectorAll(".rules-group");
  const items = list.querySelectorAll(".rules-item");
  console.log("Rendered groups:", groups.length);
  console.log("Rendered items:", items.length);

  if (window.__openRulesHub) {
    console.log("__openRulesHub exists: YES");
    window.__openRulesHub();
    console.log("Hub has show class:", hub.classList.contains("show"));
  } else {
    console.log("__openRulesHub is NOT defined!");
  }

  const introText = window.document.querySelector(".rules-hub-card .intro-text");
  if (introText) {
    const styles = window.getComputedStyle(introText);
    console.log("Intro text color:", styles.color);
    const rgbMatch = styles.color.match(/\\d+/g);
    if (rgbMatch) {
      const hex = rgbMatch.slice(0, 3).map(v => parseInt(v).toString(16).padStart(2, "0")).join("");
      console.log("Intro text computed hex color: #" + hex);
    }
    const bgStyles = window.getComputedStyle(window.document.querySelector(".rules-hub-card"));
    console.log("Hub card background image:", bgStyles.backgroundImage);
  }
} else {
  console.log("rulesHubList is EMPTY!");
}
