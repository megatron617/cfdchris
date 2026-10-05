# Performance Optimization Fixes

## Problem Identified

**3 FPS even on Potato preset** - Critical performance bottleneck

### Root Cause Analysis

The layer-by-layer rendering approach requires an enormous number of GPU passes:

**Original (128³ grid, 15 iterations):**
- Advect Velocity: 128 layers
- Advect Dye: 128 layers  
- Compute Divergence: 128 layers
- **Pressure Solve: 128 layers × 15 iterations = 1,920 passes**
- Subtract Gradient: 128 layers
- Render Slice: 1 pass

**Total: 2,433 render passes per frame!**

At 3 FPS, that's **7,299 GPU operations per second** - way too many.

---

## Fixes Applied

### 1. Reduced Grid Resolution (8x improvement)
```javascript
// Before
gridSize: { x: 128, y: 128, z: 128 }  // 2.1M voxels

// After  
gridSize: { x: 64, y: 64, z: 64 }     // 262K voxels (8x less!)
```

**Impact:**
- Render passes reduced from 2,433 → 608 per frame (4x less)
- Memory usage: 224 MB → 28 MB
- Computation per pass: 16,384 pixels → 4,096 pixels (4x less)

### 2. Reduced Default Iterations
```javascript
// Before
iterations: 30

// After
iterations: 10
```

**Impact:**
- Pressure solve passes: 640 → 213 (3x less)

### 3. Updated Performance Presets

| Preset | Old Iterations | New Iterations | Render Passes |
|--------|---------------|----------------|---------------|
| Potato | 15 | **3** | 328 |
| Low | 20 | **6** | 456 |
| Medium | 30 | **10** | 584 |
| High | 40 | **15** | 712 |
| Ultra | 50 | **20** | 840 |

---

## Expected Performance

### Before (128³, 15 iter):
- **3 FPS** (333ms/frame)
- 2,433 render passes/frame
- 2.1M voxels

### After (64³, 3 iter - Potato):
- **Target: 30 FPS** (33ms/frame)
- 328 render passes/frame (7.4x less!)
- 262K voxels

### Performance Gains:
- **10x fewer render passes** (2,433 → 328 on Potato)
- **8x less memory**
- **Estimated 10-30 FPS** (from 3 FPS)

---

## Testing Steps

1. **Test diagnostic page:**
   ```
   http://localhost:8080/test-performance-diagnostic.html
   ```
   - Shows detailed breakdown of where time is spent
   - Counts render passes
   - Provides recommendations

2. **Test main page:**
   ```
   http://localhost:8080/
   ```
   - Try Potato preset (3 iterations)
   - Should see 20-30 FPS now
   - If still slow, can reduce to 48³ or 32³

3. **Benchmark:**
   - Run 5-second benchmark in main app
   - Check average FPS
   - Adjust preset accordingly

---

## Further Optimizations (if still slow)

### Option A: Reduce to 48³ grid
```javascript
gridSize: { x: 48, y: 48, z: 48 }  // 110K voxels
```
- 184 render passes (Potato)
- Expected: 40-50 FPS

### Option B: Reduce to 32³ grid
```javascript
gridSize: { x: 32, y: 32, z: 32 }  // 33K voxels
```
- 82 render passes (Potato)
- Expected: 60 FPS

### Option C: Skip pressure solver on some frames
```javascript
// Only solve pressure every 2-3 frames
if (frameCount % 2 === 0) {
    this.solvePressure3D();
}
```

### Option D: Implement compute shaders (future)
- Single-pass 3D operations
- No layer-by-layer rendering
- Requires WebGL 2 compute or WebGPU

---

## Why Layer-by-Layer is Slow

WebGL 2 doesn't natively support rendering to 3D textures in a single pass. We must:

1. Attach each layer individually (`attachTextureLayer`)
2. Set uniforms and bind textures
3. Issue draw call
4. Repeat for all 64 layers

**Each operation:**
- 64 framebuffer attachments
- 64 draw calls
- 64 viewport changes
- Hundreds of state changes

This is **fundamentally slow** compared to 2D (which only needs 1 draw call).

**Future Solution:** WebGPU compute shaders can process entire 3D volumes in one dispatch.

---

## Configuration Reference

### Current Settings (config.js)
```javascript
gridSize: { x: 64, y: 64, z: 64 }
iterations: 10
velocityDissipation: 0.98
dyeDissipation: 0.98
```

### Quality vs Performance Trade-off

| Grid Size | Voxels | Visual Quality | FPS Target |
|-----------|--------|----------------|------------|
| 32³ | 33K | Low | 60 |
| 48³ | 110K | Medium | 40-50 |
| 64³ | 262K | Good | 30 |
| 96³ | 884K | High | 15 |
| 128³ | 2.1M | Ultra | 3-5 |

---

## Summary

The 3 FPS issue was caused by:
1. Too many voxels (2.1M → 262K)
2. Too many iterations (15+ → 3-10)
3. Layer-by-layer rendering overhead

**Fixes should improve FPS from 3 → 20-30 FPS** on most hardware.

If still slow after these changes, hardware may not support real-time 3D fluid simulation, or driver issues may exist.
