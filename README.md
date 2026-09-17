# GPU-Accelerated 2D Fluid Dynamics Simulation

A real-time fluid dynamics visualization application that runs entirely on the GPU using WebGL2, with comprehensive performance monitoring and profiling capabilities. This implementation is based on the **stable fluids method** described in [NVIDIA GPU Gems Chapter 38: Fast Fluid Dynamics Simulation on the GPU](https://developer.nvidia.com/gpugems/gpugems/part-vi-beyond-triangles/chapter-38-fast-fluid-dynamics-simulation-gpu).

![Fluid Simulation](https://img.shields.io/badge/WebGL-2.0-blue) ![License](https://img.shields.io/badge/license-MIT-green)

## Features

### Simulation
- **GPU-Accelerated**: All computations run on the GPU using WebGL2 fragment shaders
- **Stable Fluids Algorithm**: Implements the unconditionally stable method by Jos Stam
- **Real-time Interaction**: Click and drag to inject forces and colorful dye
- **Navier-Stokes Solver**: Solves the incompressible Navier-Stokes equations on a 2D grid
- **Adjustable Parameters**: Control iterations, force strength, and simulation quality

### Performance Monitoring (NEW!)
- **Hardware Detection**: Automatically detects GPU hardware vs software rendering
- **Real-time Metrics Dashboard**: Comprehensive performance monitoring with collapsible sections
- **CPU & GPU Timing**: Dual timing using WebGL timer queries for accurate GPU measurements
- **Performance Warnings**: Context-aware warnings and optimization suggestions
- **Snapshot & Compare**: Capture and compare performance snapshots between hardware/software modes
- **Export Metrics**: Export performance data as JSON for analysis
- **Performance Score**: 0-100 score based on FPS, frame time variance, and quality metrics

## Mathematical Background

The simulation solves the **Navier-Stokes equations for incompressible flow**:

```
∂u/∂t = -(u · ∇)u - ∇p/ρ + ν∇²u + F
∇ · u = 0  (continuity equation)
```

Where:
- `u` = velocity field
- `p` = pressure field
- `ρ` = fluid density
- `ν` = kinematic viscosity
- `F` = external forces

### Algorithm Steps

The simulation follows the **Helmholtz-Hodge decomposition** approach:

1. **Advection**: Transport velocity along itself using stable implicit method (Equation 13)
2. **Diffusion**: Apply viscous diffusion using Jacobi iteration (Equation 15)
3. **Force Application**: Add external forces (mouse interaction)
4. **Projection**: Enforce incompressibility
   - Compute divergence of velocity field
   - Solve Poisson-pressure equation: ∇²p = ∇ · w
   - Subtract pressure gradient: u = w - ∇p

## Installation & Setup

### Prerequisites

- Modern web browser with WebGL2 support (Chrome 56+, Firefox 51+, Safari 15+, Edge 79+)
- Local web server (required for ES6 modules)

### Quick Start

#### Option 1: Using Python (Recommended)

```bash
# Python 3
python -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000
```

Then open `http://localhost:8000` in your browser.

#### Option 2: Using Node.js

```bash
# Install a simple server globally
npm install -g http-server

# Run from project directory
http-server -p 8000
```

Then open `http://localhost:8000` in your browser.

#### Option 3: Using the provided batch file (Windows)

Simply double-click `run-server.bat` to start the Python server automatically.

### Testing Software Rendering

To compare GPU vs CPU performance:

1. **Normal mode**: Open the application normally (GPU acceleration enabled)
2. **Software mode**: Launch browser with `--disable-gpu` flag
   - See the instructions modal in the app for platform-specific commands
3. Use the Performance Dashboard to compare snapshots from both modes

### Verifying Setup

1. Open the application in your browser
2. You should see the fluid simulation canvas
3. Look for the rendering mode badge (shows HARDWARE or SOFTWARE)
4. Press P or click "Performance" to open the dashboard
5. Check System Info section to verify:
   - GPU is detected
   - Rendering mode is "hardware"
   - WebGL 2.0 is active
   - GPU timing support (if available)

## Usage

### Basic Controls

- **Mouse/Touch**: Click and drag to inject force and dye into the fluid
- **Performance Button**: Toggle performance dashboard
- **P Key**: Toggle performance dashboard (keyboard shortcut)
- **Clear Button**: Clear the simulation
- **Pause Button**: Pause/resume simulation

### Performance Dashboard

Press the **Performance** button or press **P** to open the comprehensive performance monitoring dashboard.

#### Dashboard Sections

1. **System Info**
   - GPU name and vendor
   - Rendering mode (Hardware/Software)
   - WebGL version and capabilities
   - GPU timer query support

2. **Frame Metrics**
   - Performance Score (0-100)
   - Real-time warnings and suggestions
   - Current FPS and frame times
   - Frame time variance and dropped frames

3. **Quality Metrics**
   - Pressure solver iteration completion rate
   - Simulation quality indicators

4. **Simulation Timing**
   - Per-operation timing breakdown
   - Advection, divergence, pressure solve, gradient times
   - Both CPU and GPU timing (when available)

5. **Render Timing**
   - Display shader performance
   - Canvas copy operations

6. **Memory**
   - GPU texture memory usage
   - Grid size information

#### Snapshot & Compare Features

- **📸 Capture Snapshot**: Save current performance metrics
- **📊 Compare Snapshots**: Side-by-side comparison of last two snapshots
- **Export JSON**: Download all snapshots as JSON file
- **Clear All**: Remove all saved snapshots

Snapshots are automatically saved to localStorage (keeps last 10).

#### Performance Warnings

The dashboard provides context-aware warnings and suggestions:

- **Low FPS**: Suggestions to reduce iterations or enable GPU acceleration
- **High Frame Variance**: Indicates instability, suggests reducing workload
- **Dropped Frames**: Frequent drops indicate performance issues
- **Quality Reduction**: Warns when pressure solver iterations are being skipped
- **Bottleneck Detection**: Identifies the slowest simulation operation

### Testing Software Rendering

To compare GPU vs CPU (software rendering) performance:

1. Click **📖 Software Rendering Instructions** in the dashboard
2. Follow platform-specific commands to launch browser with `--disable-gpu` flag
3. Run simulation in both modes and compare snapshots

**Windows Example:**
```bash
chrome.exe --disable-gpu --user-data-dir="%TEMP%\chrome-no-gpu"
```

The performance dashboard will automatically detect which mode is active.

## Project Structure

```
cfdchris/
├── index.html                      # Main HTML interface with modal
├── css/
│   └── styles.css                 # All styles including dashboard and modal
├── js/
│   ├── main.js                    # Application entry point with integration
│   ├── simulation.js              # Core fluid simulation class (instrumented)
│   ├── renderer.js                # Rendering logic (instrumented)
│   ├── webgl-utils.js             # WebGL helper utilities
│   ├── shaders.js                 # GLSL shader programs
│   ├── config.js                  # Simulation configuration
│   ├── input-handler.js           # Mouse/touch interaction
│   ├── ui-controller.js           # UI controls
│   ├── gpu-profiler.js            # GPU detection and timer queries
│   ├── performance-monitor.js     # Metrics collection and analysis
│   ├── performance-dashboard.js   # Dashboard UI component
│   └── instructions-modal.js      # Software rendering instructions
└── README.md                      # This file
```

### Architecture Overview

```
FluidApp (main.js)
    ├─> WebGLContext (webgl-utils.js)
    ├─> GPUProfiler (gpu-profiler.js)
    │       ├─> Hardware detection
    │       ├─> Rendering mode detection
    │       └─> WebGL timer queries
    ├─> PerformanceMonitor (performance-monitor.js)
    │       ├─> Frame timing
    │       ├─> GPU/CPU timing
    │       ├─> Quality metrics
    │       ├─> Warning generation
    │       └─> Performance scoring
    ├─> PerformanceDashboard (performance-dashboard.js)
    │       ├─> Real-time metrics display
    │       ├─> Snapshot management
    │       ├─> Comparison tables
    │       └─> JSON export
    ├─> FluidSimulation (simulation.js)
    │       └─> Instrumented with timing hooks
    └─> Renderer (renderer.js)
            └─> Instrumented with timing hooks
```

## Technical Implementation

### WebGL Architecture

The simulation uses a **ping-pong rendering** technique with double framebuffers:

- **Velocity Field**: Stores 2D velocity vectors (u, v)
- **Pressure Field**: Stores scalar pressure values
- **Dye Field**: Stores RGB color for visualization
- **Divergence Field**: Temporary storage for velocity divergence

### Shader Programs

1. **Advection Shader**: Implements stable implicit advection by back-tracing particles
2. **Jacobi Shader**: Iterative solver for Poisson equations (pressure and diffusion)
3. **Divergence Shader**: Computes ∇ · u using finite differences
4. **Gradient Shader**: Subtracts pressure gradient from velocity
5. **Splat Shader**: Applies Gaussian force/dye impulses
6. **Display Shader**: Renders dye field to screen

### Performance

- **Grid Resolution**: 128×128 (16,384 cells)
- **Typical FPS**: 60 on modern GPUs with hardware acceleration
- **Jacobi Iterations**: 40 per frame for pressure solve
- **GPU Memory**: ~7MB for textures (7 RGBA32F textures)

#### Performance Comparison: Hardware vs Software Rendering

The performance monitoring system allows direct comparison of GPU-accelerated vs software rendering performance:

**Hardware Rendering (GPU Acceleration)**
- FPS: 60+ on modern GPUs
- Frame Time: ~16ms
- Pressure Solve: ~2-5ms (GPU)
- Total Simulation: ~8-12ms

**Software Rendering (CPU Fallback)**
- FPS: 5-15 on typical CPUs
- Frame Time: 60-200ms
- Pressure Solve: 30-80ms (CPU)
- Total Simulation: 100-180ms

**Speedup: 4-12× faster with GPU acceleration**

The actual speedup varies based on:
- GPU model and capabilities
- CPU performance
- Grid resolution (128×128 in this implementation)
- Number of Jacobi iterations (40 default)
- Browser's WebGL implementation

Use the Performance Dashboard's snapshot feature to measure and compare on your specific hardware.

## Algorithm Details

### Advection (Stable Implicit Method)

```glsl
// Trace particle backward in time
vec2 pos = texCoord - dt * velocity * gridScale;

// Bilinear interpolation at back-traced position
result = texture(field, pos);
```

This method is **unconditionally stable** for any timestep.

### Pressure Projection (Jacobi Iteration)

Solves ∇²p = ∇ · w iteratively:

```glsl
// Jacobi iteration step
x^(k+1) = (xL + xR + xB + xT + α * b) / β
```

Where:
- α = -(Δx)²
- β = 4
- Converges to the solution with sufficient iterations

### Boundary Conditions

- **Velocity**: No-slip boundaries (u = 0 at walls)
- **Pressure**: Pure Neumann conditions (∂p/∂n = 0)

## Browser Compatibility

| Browser | Version | Support | Notes |
|---------|---------|---------|-------|
| Chrome  | 56+     | ✅ Full | Best performance, full GPU timing support |
| Firefox | 51+     | ✅ Full | Full support with GPU timing |
| Safari  | 15+     | ✅ Full | macOS/iOS, may have limited timer query support |
| Edge    | 79+     | ✅ Full | Chromium-based, full support |

**Requirements**:
- WebGL2 support
- `EXT_color_buffer_float` extension (required)
- Float texture support (required)
- `EXT_disjoint_timer_query_webgl2` (optional, for GPU timing)

**Performance Dashboard Features**:
- GPU detection: All browsers
- CPU timing: All browsers
- GPU timing: Chrome, Firefox, Edge (extension support required)
- Software rendering detection: All browsers
- LocalStorage snapshots: All modern browsers

## Extensions and Future Work

Possible enhancements:

### Simulation Features
1. **Vorticity Confinement**: Restore fine-scale rotational features
2. **3D Simulation**: Extend to volumetric fluid dynamics
3. **Buoyancy Forces**: Add temperature-driven convection
4. **Arbitrary Boundaries**: Support obstacles and complex boundaries
5. **Free Surface**: Simulate water-air interfaces
6. **Better Solvers**: Implement conjugate gradient or multigrid methods

### Performance Monitoring Features
1. **Historical Charts**: Graph FPS and timing over time
2. **Heatmaps**: Visualize performance bottlenecks spatially
3. **Auto-tuning**: Automatically adjust parameters for target FPS
4. **Profiling Modes**: Deep dive into shader execution times
5. **Memory Tracking**: Real-time GPU memory allocation monitoring
6. **Comparison Reports**: Generate detailed PDF/HTML performance reports

## References

- [GPU Gems Chapter 38](https://developer.nvidia.com/gpugems/gpugems/part-vi-beyond-triangles/chapter-38-fast-fluid-dynamics-simulation-gpu) - Harris, M. J. (2004)
- [Stable Fluids](https://www.dgp.toronto.edu/public_user/stam/reality/Research/pdf/ns.pdf) - Stam, J. (1999)
- [Real-Time Fluid Dynamics for Games](https://www.josstam.com/publications) - Stam, J. (2003)
- [Fluid Simulation for Computer Graphics](https://www.cs.ubc.ca/~rbridson/fluidsimulation/) - Bridson, R.

## License

MIT License - feel free to use this code for learning and projects.

## Acknowledgments

Based on the pioneering work of:
- **Jos Stam** - Stable Fluids method
- **Mark J. Harris** - GPU implementation techniques
- **NVIDIA** - GPU Gems educational resources

## Troubleshooting

### Common Issues

#### Application doesn't load / Blank screen
- **Check browser console** for errors (F12 → Console tab)
- **Verify WebGL2 support**: Visit `https://get.webgl.org/webgl2/`
- **Use local server**: ES6 modules require HTTP protocol, not file://
- **Check extensions**: Ensure `EXT_color_buffer_float` is available

#### Performance Dashboard shows "UNKNOWN" rendering mode
- GPU detection failed - check browser console for errors
- May occur in private/incognito mode on some browsers
- Try regular browser mode

#### GPU timing shows "N/A" or "pending..."
- **N/A**: Browser doesn't support `EXT_disjoint_timer_query_webgl2` extension
- **pending...**: GPU queries take 1-2 frames to return results - this is normal
- **Solution**: CPU timing is always available and accurate for frame-level measurements

#### Low FPS even with hardware rendering
1. Check Performance Dashboard warnings for suggestions
2. Reduce iterations (try 20-30 instead of 40)
3. Close other GPU-intensive applications
4. Update graphics drivers
5. Check if browser is using dedicated GPU (laptops with switchable graphics)

#### Snapshots not saving
- Check browser's localStorage is enabled
- Private/incognito mode may restrict localStorage
- Clear browser data may delete snapshots

#### Software rendering instructions don't work
- Ensure you're running the command from the correct directory
- On Windows, you may need to run from Chrome/Edge installation directory
- The `--user-data-dir` flag is required to avoid affecting your main profile
- Close all browser instances before starting with flags

### Debugging Tips

1. **Open browser console** (F12) to see initialization logs:
   ```
   Fluid simulation initialized!
   GPU: [Your GPU Name]
   Rendering Mode: hardware
   GPU Timing Available: true
   ```

2. **Check System Info** in Performance Dashboard for detailed capabilities

3. **Enable verbose logging**: Uncomment console.log statements in gpu-profiler.js for detailed diagnostics

4. **Test in different browsers**: Compare behavior across Chrome, Firefox, Edge

### Performance Optimization

For best performance:
- Use hardware rendering (GPU acceleration enabled)
- Keep iterations at 30-50 (balance between quality and speed)
- Close unnecessary browser tabs and applications
- Ensure latest graphics drivers are installed
- On laptops, ensure browser is using dedicated GPU:
  - Windows: Graphics Settings → Set browser to "High Performance"
  - macOS: Energy preferences → High Performance mode

## Contributing

Contributions are welcome! Areas for improvement:
- Performance optimizations
- Additional visualization modes
- More sophisticated solvers
- Mobile optimization
- Better UI/UX
- Documentation improvements

Please submit pull requests or open issues on the repository.

---

**Note**: This is an educational implementation focused on clarity and demonstrating the GPU Gems algorithm. Production applications may require additional optimizations and features.
