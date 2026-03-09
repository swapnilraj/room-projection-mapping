import Script from 'next/script'

export default function Home() {
  return (
    <>
      <div className="app">
        <header className="toolbar">
          <h1 className="toolbar-title">Projection Simulator</h1>
          <div className="toolbar-actions">
            <label className="mode-toggle">
              <input type="radio" name="mode" value="digital" id="modeDigital" />
              <span>Digital Ideal</span>
            </label>
            <label className="mode-toggle">
              <input type="radio" name="mode" value="physical" id="modePhysical" defaultChecked />
              <span>Physical Approx</span>
            </label>
            <button id="btnCompare" className="btn btn-outline">Compare</button>
            <button id="btnExport" className="btn btn-primary">Export PNG</button>
          </div>
        </header>

        <main className="workspace">
          <aside className="panel panel-left">
            <section className="panel-section">
              <h2 className="section-title">Base Image</h2>
              <button id="btnUpload" className="btn btn-block">Upload Image</button>
              <input type="file" id="fileInput" accept="image/*" hidden />
              <select id="presetImage" className="select" defaultValue="/falling-up.jpeg">
                <option value="">-- preset --</option>
                <option value="/falling-up.jpeg">Falling Up</option>
              </select>
            </section>

            <section className="panel-section">
              <h2 className="section-title">Environment</h2>
              <label className="slider-label">
                Ambient Light
                <input type="range" id="ambientLight" min="0" max="100" defaultValue="15" className="slider" />
                <span className="slider-value" data-for="ambientLight">15%</span>
              </label>
              <label className="slider-label">
                Projector Brightness
                <input type="range" id="projBrightness" min="0" max="100" defaultValue="85" className="slider" />
                <span className="slider-value" data-for="projBrightness">85%</span>
              </label>
              <label className="slider-label">
                Black Level
                <input type="range" id="blackLevel" min="0" max="30" defaultValue="0" className="slider" />
                <span className="slider-value" data-for="blackLevel">0%</span>
              </label>
              <label className="slider-label">
                Lens Bloom
                <input type="range" id="lensBloom" min="0" max="100" defaultValue="5" className="slider" />
                <span className="slider-value" data-for="lensBloom">5%</span>
              </label>
              <label className="slider-label">
                Spectral Bleed
                <input type="range" id="spectralBleed" min="0" max="100" defaultValue="70" className="slider" />
                <span className="slider-value" data-for="spectralBleed">70%</span>
              </label>
              <label className="slider-label">
                Surface Gamma
                <input type="range" id="surfaceGamma" min="20" max="120" defaultValue="50" className="slider" />
                <span className="slider-value" data-for="surfaceGamma">0.50</span>
              </label>
              <label className="slider-label">
                Surface Floor
                <input type="range" id="surfaceFloor" min="0" max="15" defaultValue="3" className="slider" />
                <span className="slider-value" data-for="surfaceFloor">3%</span>
              </label>
              <label className="slider-label">
                Scatter
                <input type="range" id="scatter" min="0" max="50" defaultValue="10" className="slider" />
                <span className="slider-value" data-for="scatter">10%</span>
              </label>
              <div className="color-wheel-section">
                <span className="slider-label" style={{ marginBottom: 6 }}>Projection Color</span>
                <div className="color-wheel-wrap">
                  <canvas id="colorWheel" width={180} height={180} />
                </div>
                <div className="color-wheel-footer">
                  <input type="color" id="projColor" defaultValue="#ffffff" className="color-picker" />
                  <input type="text" id="projColorHex" defaultValue="#ffffff" className="hex-input" maxLength={7} spellCheck={false} />
                </div>
              </div>
              <label className="slider-label">
                Color Temperature
                <select id="projTemp" className="select">
                  <option value="warm">Warm</option>
                  <option value="neutral" defaultChecked>Neutral</option>
                  <option value="cool">Cool</option>
                </select>
              </label>
              <label className="slider-label">
                Material
                <select id="materialType" className="select">
                  <option value="matte" defaultChecked>Matte</option>
                  <option value="glossy">Glossy</option>
                  <option value="textured">Textured</option>
                  <option value="canvas">Canvas</option>
                </select>
              </label>
            </section>

            <section className="panel-section">
              <h2 className="section-title">Warp &amp; Registration</h2>
              <label className="checkbox-label">
                <input type="checkbox" id="warpEnabled" /> Enable Corner-Pin
              </label>
              <button id="btnResetWarp" className="btn btn-small">Reset Warp</button>
              <label className="checkbox-label">
                <input type="checkbox" id="showGrid" /> Show Grid
              </label>
              <label className="checkbox-label">
                <input type="checkbox" id="showEdgeOverlay" /> Edge Overlay
              </label>
              <label className="slider-label">
                Onion Skin
                <input type="range" id="onionSkin" min="0" max="100" defaultValue="0" className="slider" />
                <span className="slider-value" data-for="onionSkin">0%</span>
              </label>
            </section>

            <section className="panel-section">
              <h2 className="section-title">Presets</h2>
              <button id="btnSavePreset" className="btn btn-small">Save Preset</button>
              <button id="btnLoadPreset" className="btn btn-small">Load Preset</button>
              <input type="file" id="presetFileInput" accept=".json" hidden />
            </section>
          </aside>

          <div className="canvas-area">
            <div className="canvas-wrapper" id="canvasWrapper">
              <canvas id="preview" />
            </div>
            <div className="canvas-status">
              <span id="statusFps">-- fps</span>
              <span id="statusSize">--</span>
            </div>
          </div>

          <aside className="panel panel-right">
            <section className="panel-section">
              <h2 className="section-title">
                Effects Stack
                <button id="btnAddEffect" className="btn btn-small btn-accent">+ Add</button>
              </h2>
              <div id="effectAddMenu" className="effect-add-menu hidden">
                <button data-type="glowPulse" className="btn btn-small">Glow Pulse</button>
                <button data-type="bloomExpansion" className="btn btn-small">Bloom Expansion</button>
                <button data-type="risingParticles" className="btn btn-small">Rising Particles</button>
                <button data-type="edgeDrift" className="btn btn-small">Edge Drift</button>
              </div>
              <div id="effectsList" className="effects-list" />
            </section>
          </aside>
        </main>

        <footer className="statusbar">
          <button id="btnPlayPause" className="btn btn-small">⏸ Pause</button>
          <label className="slider-label slider-inline">
            Speed
            <input type="range" id="animSpeed" min="10" max="300" defaultValue="100" className="slider slider-narrow" />
            <span className="slider-value" data-for="animSpeed">1.0x</span>
          </label>
        </footer>
      </div>

      <Script src="/simulator.js" strategy="afterInteractive" />
    </>
  )
}
