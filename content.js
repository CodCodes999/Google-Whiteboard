if (!document.getElementById("whiteboardCanvas")) {
  // ===== Create Canvas Overlay =====
  let canvas = document.createElement("canvas");
  canvas.id = "whiteboardCanvas";
  canvas.style.position = "fixed";
  canvas.style.top = "0";
  canvas.style.left = "0";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.zIndex = "999999";
  canvas.style.pointerEvents = "none"; // browsing mode default
  document.body.appendChild(canvas);

  let ctx = canvas.getContext("2d");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  // ===== Drawing State =====
  let writing = false;
  let mode = "pen"; // pen, highlighter, eraser
  let currentColor = "#ff0000";
  let strokes = [];
  let currentStroke = null;
  let drawing = false;

  // ===== Toolbar Factory =====
  function createToolbar() {
    if (document.getElementById("whiteboardToolbar")) return;

    let toolbar = document.createElement("div");
    toolbar.id = "whiteboardToolbar";
    toolbar.style.position = "fixed";
    toolbar.style.top = "10px";
    toolbar.style.left = "50%";
    toolbar.style.transform = "translateX(-50%)";
    toolbar.style.background = "white";
    toolbar.style.padding = "8px";
    toolbar.style.border = "1px solid #ccc";
    toolbar.style.borderRadius = "8px";
    toolbar.style.zIndex = "1000000";
    toolbar.style.display = "flex";
    toolbar.style.gap = "8px";
    toolbar.style.alignItems = "center";
    document.body.appendChild(toolbar);

    // ===== Button Factory with Highlight =====
    function makeButton(imgSrc, title, onClick) {
      let btn = document.createElement("button");
      let img = document.createElement("img");
      img.src = chrome.runtime.getURL(`icons/${imgSrc}`);
      img.style.width = "24px";
      img.style.height = "24px";
      btn.appendChild(img);
      btn.title = title;
      btn.style.cursor = "pointer";
      btn.style.padding = "4px";
      btn.style.border = "none";
      btn.style.background = "#eee";
      btn.style.borderRadius = "6px";

      btn.addEventListener("click", () => {
        onClick(); // set mode
        highlightSelected(btn);
      });

      return btn;
    }

    // Highlight logic
    function highlightSelected(selectedBtn) {
      [penBtn, highlighterBtn, eraserBtn].forEach((btn) => {
        btn.style.background = (btn === selectedBtn) ? "#ccc" : "#eee";
      });
    }

    // ===== Toggle button =====
    let toggleBtn = document.createElement("button");
    let toggleImg = document.createElement("img");
    toggleImg.src = chrome.runtime.getURL("icons/switch_off.png");
    toggleImg.style.width = "40px";
    toggleImg.style.height = "24px";
    toggleBtn.appendChild(toggleImg);
    toggleBtn.title = "Toggle Drawing Mode";
    toggleBtn.style.cursor = "pointer";
    toggleBtn.style.padding = "4px";
    toggleBtn.style.border = "none";
    toggleBtn.style.background = "#eee";
    toggleBtn.style.borderRadius = "6px";

    toggleBtn.addEventListener("click", () => {
      writing = !writing;
      canvas.style.pointerEvents = writing ? "auto" : "none";
      toggleImg.src = chrome.runtime.getURL(
        writing ? "icons/switch_on.png" : "icons/switch_off.png"
      );
    });

    // ===== Tool Buttons =====
    let penBtn = makeButton("pen.png", "Pen", () => (mode = "pen"));
    let highlighterBtn = makeButton("highlighter.png", "Highlighter", () => (mode = "highlighter"));
    let eraserBtn = makeButton("eraser.png", "Eraser", () => (mode = "eraser"));

    // Highlight default tool
    highlightSelected(penBtn);

    // ===== Color Picker =====
    let colorInput = document.createElement("input");
    colorInput.type = "color";
    colorInput.value = currentColor;
    colorInput.title = "Pick Color";
    colorInput.style.width = "40px";
    colorInput.style.height = "30px";
    colorInput.style.cursor = "pointer";
    colorInput.style.border = "none";
    colorInput.style.padding = "0";
    colorInput.addEventListener("input", (e) => {
      currentColor = e.target.value;
    });

    // ===== Close Button =====
    let closeBtn = document.createElement("button");
    closeBtn.innerText = "✖";
    closeBtn.title = "Close Toolbar";
    closeBtn.style.fontSize = "16px";
    closeBtn.style.cursor = "pointer";
    closeBtn.style.padding = "4px 6px";
    closeBtn.style.border = "none";
    closeBtn.style.background = "#f88";
    closeBtn.style.color = "white";
    closeBtn.style.borderRadius = "6px";
    closeBtn.addEventListener("click", () => {
      toolbar.remove();
    });

    toolbar.appendChild(toggleBtn);
    toolbar.appendChild(penBtn);
    toolbar.appendChild(highlighterBtn);
    toolbar.appendChild(eraserBtn);
    toolbar.appendChild(colorInput);
    toolbar.appendChild(closeBtn);
  }

  // ===== Redraw Function =====
  function redraw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let stroke of strokes) {
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.type === "highlighter" ? 10 : 3;
      ctx.globalAlpha = stroke.type === "highlighter" ? 0.3 : 1.0;
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let p of stroke.points) ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1.0;
  }

  // ===== Eraser Helper =====
  function eraseStrokeAt(x, y) {
    let anyRemoved = false;
    strokes = strokes.filter((stroke) => {
      const hit = stroke.points.some((p) => Math.hypot(p.x - x, p.y - y) < 10);
      if (hit) anyRemoved = true;
      return !hit;
    });
    if (anyRemoved) redraw();
  }

  // ===== Drawing Logic =====
  canvas.addEventListener("mousedown", (e) => {
    if (!writing) return;

    drawing = true;

    if (mode !== "eraser") {
      currentStroke = {
        type: mode,
        color: currentColor,
        points: [{ x: e.clientX, y: e.clientY }]
      };
      strokes.push(currentStroke);
    } else {
      eraseStrokeAt(e.clientX, e.clientY);
    }
  });

  canvas.addEventListener("mousemove", (e) => {
    if (!drawing) return;

    if (mode === "eraser") {
      eraseStrokeAt(e.clientX, e.clientY);
    } else {
      currentStroke.points.push({ x: e.clientX, y: e.clientY });
      redraw();
    }
  });

  canvas.addEventListener("mouseup", () => {
    drawing = false;
    currentStroke = null;
  });

  window.addEventListener("resize", () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    redraw();
  });

  // ===== Init Toolbar on First Load =====
  createToolbar();

  // ===== Message Listener for Reopening Toolbar =====
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "toggleToolbar") {
      if (!document.getElementById("whiteboardToolbar")) {
        createToolbar();
      }
    }
  });
}
