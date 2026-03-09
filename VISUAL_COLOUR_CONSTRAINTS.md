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

---

## 6. Surface reflectance and material behaviour

The substrate matters as much as the printed colour.

### Matte surface

* diffuses light broadly
* softer look
* better for even mapping
* lower punch
* better for glow and atmosphere

### Glossy surface

* stronger highlights
* can appear brighter in spots
* can create glare and hotspots
* can break the illusion

### Textured surface

* scatters light unevenly
* can create beautiful organic glow
* can also destroy fine detail and edge consistency

### Canvas / paper / wall paint

Each has a different reflectance profile and different scattering behaviour.

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

I can turn this into a cleaner one-page memo next, with sections like **Optics, Perception, Constraints, and Design Implications for Falling Up**.
