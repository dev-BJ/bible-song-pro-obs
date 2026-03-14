const features = [
  {
    title: "Auto-Retrieve Lyrics",
    summary: "Pull in song lyrics quickly from the built-in search workflow so you can prepare and project faster during service planning.",
    image: "../Bible Song Pro_Screenshot/Auto-Retrieve Lyrics 02.png"
  },
  {
    title: "Dual Bible Version",
    summary: "Preview and compare two Bible versions in a stacked layout so scripture can be presented with more flexibility and clarity.",
    image: "../Bible Song Pro_Screenshot/Dual Bible Version 02.png"
  },
  {
    title: "Multi-Language Interface",
    summary: "Switch the interface into native-language workflows to support churches, ministries, and teams serving multilingual audiences.",
    image: "../Bible Song Pro_Screenshot/Support for 50+ Languages.png"
  },
  {
    title: "Quick Actions",
    summary: "Access important live controls quickly from the side without constantly reopening the full settings panel.",
    image: "../Bible Song Pro_Screenshot/Quick Actions.png"
  },
  {
    title: "Flexible Backgrounds",
    summary: "Choose between color, image, gradient, and video backgrounds to shape the exact visual mood you want on screen.",
    image: "../Bible Song Pro_Screenshot/Image_Video Background.png"
  },
  {
    title: "Lower Third Mode",
    summary: "Present scripture and lyrics in a cleaner lower-third format when full-screen projection is not the right fit for the moment.",
    image: "../Bible Song Pro_Screenshot/Lowerthird Mode.png"
  }
];

let activeIndex = 0;

const featureList = document.getElementById("feature-list");
const detailTitle = document.getElementById("feature-detail-title");
const detailCopy = document.getElementById("feature-detail-copy");
const featureScreen = document.getElementById("feature-screen");
const navUp = document.getElementById("nav-up");
const navDown = document.getElementById("nav-down");
const closeBtn = document.getElementById("tour-close");

function renderFeatureList() {
  featureList.innerHTML = "";
  features.forEach((feature, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `feature-pill${index === activeIndex ? " active" : ""}`;
    button.innerHTML = `
      <span class="feature-icon">${index === activeIndex ? "•" : "+"}</span>
      <span>${feature.title}</span>
    `;
    button.onclick = () => {
      activeIndex = index;
      render();
    };
    featureList.appendChild(button);
  });
}

function render() {
  const feature = features[activeIndex];
  detailTitle.textContent = feature.title;
  detailCopy.textContent = feature.summary;
  featureScreen.src = feature.image;
  featureScreen.alt = feature.title;
  renderFeatureList();
}

navUp.addEventListener("click", () => {
  activeIndex = (activeIndex - 1 + features.length) % features.length;
  render();
});

navDown.addEventListener("click", () => {
  activeIndex = (activeIndex + 1) % features.length;
  render();
});

closeBtn.addEventListener("click", () => {
  window.location.href = "https://github.com/Johnbatey/Bible-Song-Pro";
});

render();
