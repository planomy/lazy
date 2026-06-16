# Lazy Laser

System-wide fading laser pointer for Windows. **Honest caveat:** this is an unsigned hobby app. Some school/work PCs block it with antivirus or GPU policies. If it won't run, use the [Prez](https://github.com/planomy/prez) laser in the browser instead (works reliably).

---

## Download (Windows PC only — not Mac, not iPad)

1. **https://github.com/planomy/lazy/releases/latest**
2. Download **`Lazy-Laser-…-win.zip`** (under **Assets**, not "Source code")
3. Right-click the zip → **Extract All**
4. Open the folder → double-click **`Lazy Laser.exe`**
5. A **Lazy Laser** window appears — click **Turn laser ON**, then move the mouse

**Pin it:** run **`create-shortcut.bat`** once — puts **Lazy Laser** on the Desktop. Double-click that anytime.  
Or right-click **`Lazy Laser.exe`** → **Pin to taskbar** (needs v0.1.7+ for a visible icon).

If a file **`lazy-started.txt`** appears on the Desktop but there is no window, Windows is blocking the display — check antivirus.

---

## Controls

- **Click the button** in the control window
- **F8** — toggle laser
- **Ctrl+Shift+Backspace** — clear trail

---

## If nothing works

Stop here. Use **Prez** fullscreen with its built-in laser for presentations, or a **$15 USB presentation clicker** with a built-in laser — those always work on any PC.

Developers: `npm install` → `npm start`
