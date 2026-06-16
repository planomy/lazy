# Lazy Laser

A tiny **Windows** tray app — fading red laser trail on top of any app (PowerPoint, Excel, browser, etc.). Same feel as the laser in [Prez](https://github.com/planomy/prez).

---

## Download and run (for teachers / presenters)

**No Node. No git. No terminal.**

1. Open **[Releases](https://github.com/planomy/lazy/releases/latest)**
2. Download **`Lazy Laser … .exe`** from the latest release
   - If the `.exe` does nothing, try the **`.zip`** instead — unzip it, then double-click **`Lazy Laser.exe`** inside
3. **Double-click** to run (Windows may ask you to allow it once)
4. A popup confirms it started — click **OK**
5. Press **Ctrl+Alt+L** to turn the laser on/off

Look for the **red dot** in the system tray (near the clock). Click the **^** arrow if you do not see it.

| Action | Shortcut |
|--------|----------|
| Toggle laser | **Ctrl+Alt+L** |
| Clear trail | **Ctrl+Shift+Backspace** |
| Toggle laser | Click the tray icon |
| Quit | Tray menu → Quit Lazy |

The app sits in the system tray (near the clock). Leave it running in the background so the hotkey works.

---

## Developers

```bash
npm install
npm start          # smoke test (Mac or Windows)
npm run pack:win   # build portable .exe locally on Windows
```

Pushing a version tag (e.g. `v0.1.1`) triggers GitHub Actions to build the `.exe` and attach it to a release automatically.
