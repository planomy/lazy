const toggleBtn = document.getElementById('toggle')
const quitBtn = document.getElementById('quit')

function setUi(active) {
  if (active) {
    toggleBtn.textContent = 'Turn laser OFF'
    toggleBtn.classList.add('on')
  } else {
    toggleBtn.textContent = 'Turn laser ON'
    toggleBtn.classList.remove('on')
  }
}

toggleBtn.addEventListener('click', () => window.lazy.toggleLaser())
quitBtn.addEventListener('click', () => window.lazy.quit())

window.lazy.onLaserState((active) => setUi(active))
