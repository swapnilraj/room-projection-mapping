Yes. Here is the proper technical write-up.

# Technical interaction between the base image and projection light

## 1. Core principle

A projection-mapped artwork is **not** a normal image display system.

A monitor emits the image directly.
A projector does something very different:

* it emits light toward a surface
* the surface selectively reflects some of that light
* the viewer sees the reflected result, not the projector’s intended colour directly

So the final visual result is always a **compound product** of:

1. the **projected light**
2. the **base image / print / wall surface**
3. the **room lighting**
4. the **geometry and alignment**
5. the **viewer’s visual perception**

That is the whole system.

**In the simulator:** The toolbar lets you switch between **Digital Ideal** (monitor-like, screen blend) and **Physical Approx** (this full compound model: surface, ambient, projector limits).

---

## 2. The optical model

At a practical level, the visible result can be thought of as:

**Visible image = ambient reflected light + projected reflected light**

And the projected reflected light is approximately:

**Projected reflected light = projector spectral output × surface reflectance**

That multiplication is the key.

The projector sends light in certain spectral bands.
The base image and substrate decide how much of each band gets sent back to the eye.

So the base image is not passive. It acts as a **wavelength-selective filter**.

**In the simulator:** **Physical Approx** mode implements this: projected light is multiplied by the reflectance map (derived from the base image with Surface gamma and floor). **Digital Ideal** mode skips the reflectance multiply and uses a simple screen blend.

---

## 3. Additive light versus subtractive surface

This distinction matters more than almost anything else.

### Projector

A projector is an **additive light source**.
It adds red, green, and blue light.

### Printed artwork / coloured wall

The artwork is a **subtractive reflective surface**.
It absorbs some wavelengths and reflects others.

So projection mapping is never “putting an RGB image on top of another RGB image” in a simple digital sense.

It is:

* additive light
* filtered by subtractive material
* under real-world viewing conditions

That is why colours that look perfect on a laptop fail on the wall.

---

## 4. Role of the base image colour

The colour of the base image determines which projected colours can survive.

### Example: blue background

A blue area usually reflects blue wavelengths well, may reflect some green, and often reflects red poorly.

Result:

* projected blue survives better
* projected cyan/green may survive moderately well
* projected red may dim or muddy badly

### Example: red/orange subject

A warm red/orange area tends to reflect red, orange, and some yellowish components better, and blue worse.

Result:

* projected warm colours can pop
* projected cool tones may weaken or shift strangely

So every coloured region of the base image creates a different local response to the projection.

This means the same projected animation can look radically different as it crosses different zones of the print.

**In the simulator:** The base image is set via **Upload Image** or the **preset** dropdown (e.g. Falling Up). The reflectance map is built from that image (gamma + floor); every region’s response to the projection is determined by that map, so colour survival varies by zone automatically.

---

## 5. Role of luminance in the base image

Colour is only half the issue.
The other half is **luminance**.

A projector does not create darkness.
It can only add light.

That means:

* bright projected areas can become visible
* dark projected details on dark areas usually vanish

So if the base image has a dark background and the projection tries to add a dark blur over it, that blur may be effectively invisible.

This is a critical constraint.

### Consequence

Projection animation reads best when it is based on:

* brightening
* glowing
* blooming
* pulsing
* luminous edge shifts
* light-based reveal

It reads badly when it depends on:

* subtle shadow movement
* dark-on-dark shading
* low-luminance blur displacement

That is why the animated layer must usually be designed as **moving light**, not moving shade.

**In the simulator:** Luminance behaviour comes from the reflectance multiply: dark base areas absorb more projected light, bright areas reflect more. There is no separate “luminance” control; the **Effects stack** is designed as moving light (glow, bloom, particles, edge drift).

---

## 6. Surface reflectance and material behaviour

The substrate matters as much as the printed colour.

### How the simulator models surface reflectance

The simulator does **not** use the raw base image as the reflectance filter. Raw sRGB pixel values underestimate how much light dark printed areas actually reflect. Two parameters model real paper/ink behaviour:

- **Surface gamma** (e.g. 0.5): A power curve applied per channel. Values &lt; 1 lift darks, so that dark regions of the print still reflect a plausible amount of projected light. This approximates the non-linear relationship between print density and reflectance (similar in spirit to print/reflectance models, but not a full spectral simulation).
- **Surface floor** (e.g. 3%): A minimum reflectance per channel. Real surfaces always reflect some light; the floor prevents fully black areas and keeps the multiply stable.

The **reflectance map** is then: `reflectance = floor + (1 − floor) × (pixel/255)^gamma`, applied to the base image. Projected light is **multiplied** by this map, so dark print absorbs more and bright print reflects more. Black level (projector leak) is also filtered through the same reflectance map, not the raw base.

### Matte surface

* diffuses light broadly
* softer look
* better for even mapping
* lower punch
* better for glow and atmosphere

In the simulator: **Matte** = no extra pass (baseline reflectance × projection only).

### Glossy surface

* stronger highlights
* can appear brighter in spots
* can create glare and hotspots
* can break the illusion

In the simulator: **Glossy** = overlay blend of the filtered projection (suggestive highlight, not calibrated).

### Textured surface

* scatters light unevenly
* can create beautiful organic glow
* can also destroy fine detail and edge consistency

In the simulator: **Textured** = subtle noise multiply on the reflectance-filtered result (suggestive only).

### Canvas / paper / wall paint

Each has a different reflectance profile and different scattering behaviour. In the simulator: **Canvas** = light blur plus noise multiply (suggestive). The simulator does not simulate full spectral or BRDF behaviour; materials are perceptual hints.

So the visual result is not just colour-dependent, but also **material-dependent**.

---

## 7. Spectral output of the projector

Projectors do not emit ideal mathematical RGB.

Real projectors have:

* limited brightness
* imperfect primaries
* unequal channel power
* different contrast performance
* non-ideal blacks
* different colour gamuts

This matters because a projected “red” is not some absolute red. It is whatever that projector’s red channel can produce.

Some projectors have:

* weak red
* strong green
* mediocre blue
* poor dark-level separation

That is why some hues feel stronger than others even before they hit the wall.

**In the simulator:** **Projector brightness** = **Projector Brightness** slider. **Imperfect primaries / non-ideal spectrum** = **Spectral Bleed** slider (3×3 RGB crosstalk matrix; e.g. blue leaks into green). **Projection Color** picker sets the effective “white” of the projector. **Color Temperature** = warm / neutral / cool tint multiply. **Non-ideal blacks** = **Black Level** slider (see §12).

---

## 8. Human visual perception

The eye is not a neutral measuring instrument.

Visual outcome is shaped by:

* spectral sensitivity of human vision
* local contrast adaptation
* simultaneous colour contrast
* edge perception
* brightness illusion
* halo effects

For example:

* green often appears very bright
* yellow-green can feel more luminous than red even at comparable power
* warm/cool contrast can feel “electric”
* soft edges can read as glow
* hard edges read more like graphics than light

So the final image is not only physics. It is also perception.

A colour may have mediocre physical output but still feel radiant because of contextual contrast.

**In the simulator:** Perception is not simulated (no contrast adaptation, halo model, etc.). What you see is the physical-style composite only.

---

## 9. Ambient light contamination

Room light is part of the image system whether you want it or not.

Ambient light:

* raises the base brightness of the artwork
* reduces contrast between projected and non-projected areas
* contaminates colour perception
* weakens subtle animation
* makes low-luminance motion disappear first

This is why projection mapping becomes much stronger in darkness.

The darker the room, the more the projector becomes the dominant light source.

In a brighter room:

* colour subtleties collapse
* glow effects weaken
* the piece starts looking flatter and more decorative

**In the simulator:** **Ambient Light** slider (0–100%) sets the alpha of the base image layer before the projected light is added. Higher = room light raises the base and flattens contrast.

---

## 10. Geometry and alignment constraints

Projection mapping is not only about colour.
Spatial accuracy matters.

### Key geometric constraints

* projector angle
* keystone distortion
* surface flatness
* lens distortion
* scaling accuracy
* edge alignment
* warping precision

If the projected image is misaligned even slightly:

* motion looks detached from the print
* edges shimmer in the wrong place
* the illusion breaks

For your kind of piece, where the projection is meant to look like the static image is coming alive, alignment must be extremely tight.

The more abstract and soft the image, the more forgiving it is.
The more hard-edged the image, the more punishing small errors become.

**In the simulator:** **Warp & Registration**: **Enable Corner-Pin** turns on a 4-point perspective warp (homography, 14×14 triangle mesh). Drag TL/TR/BR/BL handles to match projector angle and keystone. **Show Grid** and **Edge Overlay** help alignment. Working resolution is capped at 1024 px wide. Lens distortion is not simulated, only perspective.

---

## 11. Registration between base image and projected image

The visual illusion depends on correct registration between:

* the static subject in the printed artwork
* the projected brightening / stretching / motion layer

If the projection does not match the print’s form:

* the body looks doubled
* the face floats incorrectly
* the motion feels pasted on rather than emerging from within

For an artwork like yours, registration is especially important around:

* face
* top contour
* shoulder/body edge
* inner glow zones
* any rising trail or stretch extension

This is why simple shape language works better than overly detailed source images.

**In the simulator:** Registration is the **warp** (corner-pin) plus the alignment overlays. **Onion Skin** slider draws the base image over the composite so you can check how well the projection lines up with the print.

---

## 12. Dynamic range limitations

Projectors have limited dynamic range compared with ideal digital images.

This creates several consequences:

### Black level problem

The projector cannot make true black.
Black is just “no light,” which means you are seeing the surface plus ambient light.

### Highlight ceiling

A projector has a finite brightness ceiling.
Very bright-looking digital concepts may not translate physically.

### Midtone compression

Subtle tonal steps may collapse when projected onto a textured coloured print.

So your usable image range is smaller than what your monitor suggests.

This is one reason why pale luminous cores and clear glow zones often work better than nuanced low-contrast tonal play.

**In the simulator:** **Black level** = **Black Level** slider: a warm flat “leak” colour is multiplied by the reflectance map and added (projectors don’t produce true black). **Brightness ceiling** = **Projector Brightness** slider scales the whole projected layer. **Digital Ideal** mode shows the “ideal” screen blend; **Physical Approx** shows the compressed range.

---

## 13. Effective gamut collapse

The surface narrows the projector’s usable colour gamut.

This is a major constraint.

On a white screen, a projector can display something close to its designed gamut.

On a coloured artwork:

* some hues are attenuated
* some shift
* some disappear
* some become muddy
* some remain surprisingly strong

So the base image imposes an **effective local gamut restriction**.

A blue field may support:

* blue
* cyan
* some green
* white-ish light

But weaken:

* red
* orange
* peach

A warm subject zone may do the opposite.

That means your animation cannot assume one global colour behaviour.
It has to be designed with the base image’s local gamut constraints in mind.

**In the simulator:** Gamut collapse is the natural result of the reflectance multiply: each region of the base image scales the projected RGB differently. There is no separate “gamut” control; **Projection Color**, **Spectral Bleed**, and **Color Temperature** shape the projector side; the base image and **Surface gamma/floor** shape the surface side.

---

## 14. Why mud happens

Mud is the failure state where a projected colour does not read as luminous or distinct.

Mud usually comes from some combination of:

* low reflectance of the projected hue on that surface
* weak luminance contrast
* overreliance on saturation instead of brightness
* poor local separation from surrounding colours
* surface texture scattering away edge clarity
* ambient contamination
* excessive colour conflict

A muddy result is not one single technical fault.
It is the combined outcome of low radiance, low clarity, and weak contrast.

**In the simulator:** Mud is influenced by **Ambient Light** (too high flattens), **Surface gamma/floor**, **Spectral Bleed**, **Scatter**, and **Black Level**. The **Compare** button shows Base / Digital Ideal / Physical Approx side by side to see where the physical model diverges.

---

## 15. The role of edge softness

Edge structure strongly affects whether something reads as:

* light
* motion
* aura
* object
* glitch

### Soft edges

* feel atmospheric
* support glow
* support emergence
* help transitions feel natural

### Hard edges

* feel graphic
* expose alignment errors
* can look digital and pasted on
* are useful only when intentional

For your piece, soft edges are essential. The projection should feel like the artwork is self-modifying, not that a second separate image is sitting on top.

**In the simulator:** Effects use soft gradients and blur (radial gradients, bloom, particle glows, edge drift). There is no explicit “edge hardness” control; design the effect layer to stay soft.

---

## 16. Motion design constraints

Not all motion reads equally well in projection.

### Motion that works well

* brightening and dimming
* halo pulsing
* gentle expansion
* rising particles
* edge drift
* luminous elongation
* spectral colour shift tied to brightness
* breathing gradients

### Motion that works poorly

* subtle dark blur translation
* low-contrast internal texture movement
* fine detail flicker
* tiny displacements
* complex chromatic shifts with no brightness change

So the animation must be designed around **perceptually legible events**, not purely digital ones.

**In the simulator:** The **Effects stack** provides: **Glow Pulse** (radial pulse, centre/radius/speed/min–max alpha, RGB), **Bloom Expansion** (expanding/contracting radial bloom), **Rising Particles** (particle count, speed, size, spread, origin Y, RGB), **Edge Drift** (edge map–driven drift, speed, brightness, width, RGB). Each effect has per-parameter sliders and can be toggled or removed. **Speed** (footer) and **Play/Pause** control global animation time. Add/remove effects via **+ Add**; save/load **Presets** (JSON) to capture the full stack and environment.

---

## 17. Constraints specific to making a still image “come alive”

If the goal is to make the print appear animated rather than simply projected onto, then the system needs:

### A. Structural compatibility

The printed image must contain forms that can plausibly move:

* glow
* mist
* stretched contours
* blur
* latent motion

### B. Optical compatibility

The print must not be so saturated or so dark that projection freedom disappears.

### C. Luminance scaffold

The still image must contain enough readable subject brightness for modulation to be visible.

### D. Negative space

There must be room for the animated event to expand into, especially if the motion is upward.

### E. Limited visual complexity

Busy images make motion harder to read and mapping errors easier to notice.

**In the simulator:** Base image is chosen via **Upload Image** or the **preset** dropdown. Optical compatibility is tuned with **Surface gamma/floor** and **Ambient**; the **Effects stack** is the motion layer (glow, bloom, particles, edge drift). Presets store a full snapshot (env + warp + effects) for repeatable “come alive” setups.

---

## 18. Best base-image properties for projection mapping

A good base image for this kind of installation usually has:

* dark, low-saturation background
* clearly readable subject
* mid-light luminous figure zones
* soft transitions
* limited chromatic aggression
* simple silhouette
* room for motion expansion
* latent energy rather than fully resolved colour drama

It should behave like a stage set for light, not a finished colour argument that the projector has to fight.

**In the simulator:** Use **Upload Image** or a preset (e.g. Falling Up) that matches these properties; adjust **Surface gamma/floor** and **Ambient** until the base reads as a stage, not flat or crushed.

---

## 19. Best projected-image properties

A good projected layer usually has:

* high perceived luminance
* colours that survive the substrate
* bright core or active edge
* soft bloom
* limited reliance on dark values
* minimal dependence on exact monitor appearance
* motion built from light changes, not shadow changes
* simple, readable deformation patterns

The projected layer should usually be the **peak light event** in the system.

**In the simulator:** Design the **Effects stack** (Glow Pulse, Bloom Expansion, Rising Particles, Edge Drift) and **Projector Brightness** / **Projection Color** so the projected layer is the brightest element; use **Physical Approx** and **Compare** to check against the base.

---

## 20. The governing constraints on visual outcome

The final visual outcome is controlled by all of the following:

### Optical constraints

* projector spectrum
* projector brightness
* projector contrast
* surface reflectance
* printed colour
* material finish
* texture

### Environmental constraints

* ambient light
* viewing angle
* viewing distance
* room darkness
* stray reflections

### Geometric constraints

* alignment accuracy
* warp accuracy
* scale match
* lens angle
* keystone and distortion correction

### Perceptual constraints

* luminance contrast
* chromatic contrast
* edge softness
* visual adaptation
* local context
* motion legibility

### Artistic constraints

* base image simplicity
* composition
* negative space
* subject readability
* whether motion is latent or pasted-on
* whether projected colour belongs to the piece emotionally

All of them matter. None of them can be ignored.

---

## 21. The central design tension

Your project sits inside one major tension:

### If the base image is too colourful and too complete:

the projection has no room to transform it.

### If the base image is too dark and too subtle:

the projection has no visible foothold.

So the target is neither:

* saturated finished artwork
  nor
* dead dark ghost image

The target is:

**optically permissive background + luminous readable subject + projection as the brightest transforming layer**

That is the real design balance.

---

## 22. The specific implication for your kind of piece

For a piece like *Falling Up*, where the static image is meant to appear to rise beyond itself, the ideal system is:

### Base image

* dark neutral or softly cool background
* warm or spectral but restrained figure
* soft luminous face/body scaffold
* simplified monolithic silhouette
* latent vertical pull

### Projection

* brightening and stretching of existing form
* pale luminous extension
* halo or edge bloom
* rising particles or energy traces
* colour shifts only where the substrate will support them
* motion readable through luminance change

That is the correct division of labour.

---

## 23. Short formal summary

If you want a concise technical summary:

> In projection mapping, the visible image is not the projector output alone but the result of additive projected light filtered by the subtractive spectral reflectance of the base artwork and substrate. Each region of the base image constrains the brightness and colour gamut of the projection according to its local reflectance properties, while ambient light, surface finish, alignment accuracy, projector dynamic range, and human visual perception further shape the final result. Because a projector can only add light and cannot create true darkness, motion that depends on low-luminance contrast often disappears, especially on dark coloured surfaces. Successful projection-mapped still imagery therefore requires a base image with a low-conflict background, a readable luminance scaffold in the subject, and a projected layer designed around high-perceived-luminance events such as glow, bloom, brightening, and soft deformation rather than shadow-like movement.

---

## 24. Blunt practical takeaway

The final visual outcome is controlled by a brutal fact:

**the base image decides what the projector is allowed to become.**

That is the truth.

The print is not just the thing being animated.
It is the optical rulebook that determines:

* which colours live
* which colours die
* which motions read
* which motions disappear
* whether the piece feels alive or pasted-on

That is the system you are designing.

---

## 25. Simulator implementation reference

The web **Projection Simulator** (Next.js app at `/`, static build in `simulator/`) implements the model described above. This section is the full implementation reference.

### Modes

| Mode | Behaviour |
|------|-----------|
| **Digital Ideal** | Base image + screen blend of projection at brightness. No reflectance, no black level, no bloom/scatter. “Monitor” preview. |
| **Physical Approx** | Ambient (base × ambient alpha) → black-level leak (× reflectance) → projection with bloom (× reflectance × material) → scatter. Full optical approximation. |

**Compare** shows Base only, Digital Ideal, and Physical Approx side by side.

### Environment parameters (Physical mode)

| Parameter | UI | Default | Effect |
|-----------|----|---------|--------|
| **ambient** | Ambient Light (%) | 15 | Alpha of base image layer (room light). |
| **brightness** | Projector Brightness (%) | 85 | Scale of projected layer (and leak, scatter). |
| **blackLevel** | Black Level (%) | 0 | Warm leak colour × reflectance map, added. |
| **lensBloom** | Lens Bloom (%) | 5 | Blurred copy of projection added (two radii). |
| **spectralBleed** | Spectral Bleed (%) | 70 | Scale of 3×3 RGB crosstalk matrix. |
| **surfaceGamma** | Surface Gamma | 0.50 | Power curve for reflectance map (per channel). |
| **surfaceFloor** | Surface Floor (%) | 3 | Minimum reflectance per channel. |
| **scatter** | Scatter (%) | 10 | Heavily blurred projection added (not × reflectance). |
| **projColor** | Projection Color | #ffffff | RGB of projector “white”; effects are tinted. |
| **temp** | Color Temperature | neutral | warm / neutral / cool tint multiply. |
| **material** | Material | matte | matte / glossy / textured / canvas (see §6). |

### Base image and reflectance

- **Base image:** Upload or preset (e.g. Falling Up). Max working width 1024 px.
- **Reflectance map:** `floor + (1 − floor) × (pixel/255)^gamma` per channel, rebuilt when gamma or floor change. Projection and black-level leak are multiplied by this map.

### Warp and registration

- **Corner-pin:** 4 corners (TL, TR, BR, BL), homography, 14×14 triangle mesh. Drag handles when **Enable Corner-Pin** is on. **Reset Warp** restores unit quad.
- **Show Grid** / **Edge Overlay:** Alignment aids.
- **Onion Skin:** Base image drawn over composite (0–100%).

### Effects stack

- **Glow Pulse:** Radial pulse (centre, radius, speed, min/max alpha, RGB).
- **Bloom Expansion:** Expanding/contracting radial bloom (centre, max radius, speed, softness, RGB).
- **Rising Particles:** Particles rising from origin Y (count, speed, size, spread, RGB).
- **Edge Drift:** Edge-map–driven drift + tint (speed, brightness, width, RGB).

Effects are composited in order onto the projection canvas, then the result goes through the physical pipeline (crosstalk if non-white, warp if enabled, reflectance × material, scatter). **Speed** and **Play/Pause** control global time.

### Presets and calibration

- **Presets:** JSON files (e.g. `presets/falling-up.json`) store env, warp, effects, mode, speed. **Save Preset** / **Load Preset** (file) or load from URL on init.
- **Calibration API:** `window._calibration` (see `docs/CALIBRATION.md`): `setEnv`, `setFlatProjection`, `sampleRegion`, `sampleAll`, `forceRender`. Used by `scripts/calibrate-simulator.js` to fit parameters to a real-world photo.

### Other UI

- **Export PNG:** Snapshot of current view (or Compare layout).
- **FPS** and **canvas size** in footer.

### Not implemented

Full spectral simulation, view-dependent BRDF, lens distortion (only perspective warp), perceptual models (contrast adaptation, halos). The simulator is an **approximation** for preview and calibration; use `scripts/calibrate-simulator.js` to fit env parameters to a reference photo.
