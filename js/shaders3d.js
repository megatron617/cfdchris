/**
 * WebGL 3D shader source code for volumetric fluid simulation
 */

import { CONFIG } from './config.js';

// ============================================================================
// VERTEX SHADERS
// ============================================================================

/**
 * Standard vertex shader for fullscreen quad rendering
 * Maps normalized device coordinates (-1 to 1) to texture coordinates (0 to 1)
 * For 3D, we'll set the Z coordinate via uniform when rendering layer-by-layer
 */
export const vertexShader = `#version 300 es
    in vec2 a_pos;
    out vec2 v_uv;
    
    void main() {
        v_uv = a_pos * 0.5 + 0.5;
        gl_Position = vec4(a_pos, 0.0, 1.0);
    }`;

/**
 * Vertex shader for 3D operations
 * Includes uniform for current Z layer being rendered
 */
export const vertexShader3D = `#version 300 es
    in vec2 a_pos;
    uniform float u_layer;     // Current Z layer (0.0 to 1.0)
    out vec3 v_uvw;            // 3D texture coordinates
    
    void main() {
        vec2 uv = a_pos * 0.5 + 0.5;
        v_uvw = vec3(uv, u_layer);
        gl_Position = vec4(a_pos, 0.0, 1.0);
    }`;

// ============================================================================
// SIMULATION SHADERS (3D)
// ============================================================================

/**
 * 3D Advection shader
 * Implements stable implicit advection by back-tracing particles through the velocity field
 * Uses vec3 velocity (u, v, w) and samples 3D textures
 */
export const advect3DFragmentShader = `#version 300 es
    precision highp float;
    precision highp sampler3D;
    
    in vec3 v_uvw;
    out vec4 outColor;
    
    uniform sampler3D u_velocity;   // 3D velocity field (vec3)
    uniform sampler3D u_source;     // Field to advect
    uniform float u_dt;             // Time step × dissipation
    uniform vec3 u_gridScale;       // Reciprocal of grid size for proper scaling
    
    void main() {
        // Sample velocity at current position
        vec3 vel = texture(u_velocity, v_uvw).xyz;
        
        // Back-trace along velocity field
        // Scale velocity by grid dimensions for correct advection
        vec3 pos = v_uvw - u_dt * vel * u_gridScale;
        
        // Sample source field at back-traced position
        // Linear interpolation is automatic with LINEAR texture filtering
        outColor = texture(u_source, pos);
    }`;

/**
 * 3D Jacobi iteration shader
 * Solves Poisson equations: ∇²φ = b using iterative method
 * Uses 6-neighbor stencil (±X, ±Y, ±Z) instead of 4-neighbor (2D)
 */
export const jacobi3DFragmentShader = `#version 300 es
    precision highp float;
    precision highp sampler3D;
    
    in vec3 v_uvw;
    out vec4 outColor;
    
    uniform sampler3D u_x;       // Current estimate
    uniform sampler3D u_b;       // Right-hand side
    uniform float u_alpha;       // Constant (e.g., -Δx² for pressure)
    uniform float u_rBeta;       // Reciprocal of beta (1/6 for 3D)
    
    void main() {
        // Voxel size in texture coordinates
        vec3 px = vec3(
            1.0 / ${CONFIG.gridSize.x.toFixed(1)},
            1.0 / ${CONFIG.gridSize.y.toFixed(1)},
            1.0 / ${CONFIG.gridSize.z.toFixed(1)}
        );
        
        // Sample 6 neighbors (left, right, bottom, top, front, back)
        vec4 xL = texture(u_x, v_uvw - vec3(px.x, 0.0, 0.0));  // Left (-X)
        vec4 xR = texture(u_x, v_uvw + vec3(px.x, 0.0, 0.0));  // Right (+X)
        vec4 xB = texture(u_x, v_uvw - vec3(0.0, px.y, 0.0));  // Bottom (-Y)
        vec4 xT = texture(u_x, v_uvw + vec3(0.0, px.y, 0.0));  // Top (+Y)
        vec4 xF = texture(u_x, v_uvw - vec3(0.0, 0.0, px.z));  // Front (-Z)
        vec4 xK = texture(u_x, v_uvw + vec3(0.0, 0.0, px.z));  // Back (+Z)
        
        // Sample center value
        vec4 bC = texture(u_b, v_uvw);
        
        // Jacobi iteration: x^(k+1) = (sum of neighbors + α*b) / β
        // For 3D: β = 6 (not 4 as in 2D), so u_rBeta = 1/6 ≈ 0.16667
        outColor = (xL + xR + xB + xT + xF + xK + u_alpha * bC) * u_rBeta;
    }`;

/**
 * 3D Divergence shader
 * Computes ∇·u = ∂u/∂x + ∂v/∂y + ∂w/∂z using central differences
 */
export const divergence3DFragmentShader = `#version 300 es
    precision highp float;
    precision highp sampler3D;
    
    in vec3 v_uvw;
    out vec4 outColor;
    
    uniform sampler3D u_velocity;
    
    void main() {
        // Voxel size in texture coordinates
        vec3 px = vec3(
            1.0 / ${CONFIG.gridSize.x.toFixed(1)},
            1.0 / ${CONFIG.gridSize.y.toFixed(1)},
            1.0 / ${CONFIG.gridSize.z.toFixed(1)}
        );
        
        // Sample velocity at 6 neighbors
        vec3 vL = texture(u_velocity, v_uvw - vec3(px.x, 0.0, 0.0)).xyz;
        vec3 vR = texture(u_velocity, v_uvw + vec3(px.x, 0.0, 0.0)).xyz;
        vec3 vB = texture(u_velocity, v_uvw - vec3(0.0, px.y, 0.0)).xyz;
        vec3 vT = texture(u_velocity, v_uvw + vec3(0.0, px.y, 0.0)).xyz;
        vec3 vF = texture(u_velocity, v_uvw - vec3(0.0, 0.0, px.z)).xyz;
        vec3 vK = texture(u_velocity, v_uvw + vec3(0.0, 0.0, px.z)).xyz;
        
        // Compute divergence using central differences
        // ∇·u = (∂u/∂x + ∂v/∂y + ∂w/∂z)
        float div = 0.5 * (
            (vR.x - vL.x) +  // ∂u/∂x
            (vT.y - vB.y) +  // ∂v/∂y
            (vK.z - vF.z)    // ∂w/∂z
        );
        
        // Store divergence in red channel
        outColor = vec4(div, 0.0, 0.0, 1.0);
    }`;

/**
 * 3D Gradient subtraction shader
 * Subtracts pressure gradient from velocity to enforce incompressibility
 * u = w - ∇p, where w is intermediate velocity
 */
export const gradient3DFragmentShader = `#version 300 es
    precision highp float;
    precision highp sampler3D;
    
    in vec3 v_uvw;
    out vec4 outColor;
    
    uniform sampler3D u_pressure;
    uniform sampler3D u_velocity;
    
    void main() {
        // Voxel size in texture coordinates
        vec3 px = vec3(
            1.0 / ${CONFIG.gridSize.x.toFixed(1)},
            1.0 / ${CONFIG.gridSize.y.toFixed(1)},
            1.0 / ${CONFIG.gridSize.z.toFixed(1)}
        );
        
        // Sample pressure at 6 neighbors
        float pL = texture(u_pressure, v_uvw - vec3(px.x, 0.0, 0.0)).x;
        float pR = texture(u_pressure, v_uvw + vec3(px.x, 0.0, 0.0)).x;
        float pB = texture(u_pressure, v_uvw - vec3(0.0, px.y, 0.0)).x;
        float pT = texture(u_pressure, v_uvw + vec3(0.0, px.y, 0.0)).x;
        float pF = texture(u_pressure, v_uvw - vec3(0.0, 0.0, px.z)).x;
        float pK = texture(u_pressure, v_uvw + vec3(0.0, 0.0, px.z)).x;
        
        // Compute pressure gradient using central differences
        vec3 gradP = 0.5 * vec3(
            pR - pL,  // ∂p/∂x
            pT - pB,  // ∂p/∂y
            pK - pF   // ∂p/∂z
        );
        
        // Get current velocity
        vec3 vel = texture(u_velocity, v_uvw).xyz;
        
        // Subtract gradient: u = w - ∇p
        vel -= gradP;
        
        outColor = vec4(vel, 1.0);
    }`;

/**
 * 3D Splat shader
 * Injects force/dye into the simulation at a 3D point with Gaussian falloff
 */
export const splat3DFragmentShader = `#version 300 es
    precision highp float;
    precision highp sampler3D;
    
    in vec3 v_uvw;
    out vec4 outColor;
    
    uniform sampler3D u_field;   // Current field (velocity or dye)
    uniform vec3 u_point;        // Injection point (3D)
    uniform vec3 u_value;        // Value to inject (velocity or color)
    uniform float u_radius;      // Splat radius
    
    void main() {
        // Sample current field value
        vec4 base = texture(u_field, v_uvw);
        
        // Compute 3D distance from injection point
        float d = distance(v_uvw, u_point);
        
        // Gaussian falloff: exp(-d²/r²)
        float splat = exp(-d * d / (u_radius * u_radius));
        
        // Add splat to base value
        outColor = base + vec4(u_value * splat, 0.0);
    }`;

// ============================================================================
// RENDERING SHADERS
// ============================================================================

/**
 * Slice rendering shader
 * Displays a 2D slice through the 3D volume
 * Supports XY, XZ, and YZ planes
 */
export const slice3DFragmentShader = `#version 300 es
    precision highp float;
    precision highp sampler3D;
    
    in vec2 v_uv;
    out vec4 outColor;
    
    uniform sampler3D u_field;      // 3D field to visualize (usually dye)
    uniform float u_sliceAxis;      // 0.0=XY, 1.0=XZ, 2.0=YZ
    uniform float u_sliceDepth;     // Depth along the slice axis (0.0 to 1.0)
    uniform float u_brightness;     // Brightness multiplier
    
    void main() {
        vec3 samplePos;
        
        // Determine 3D sampling position based on slice axis
        // Using float comparison to avoid integer uniform issues
        if (u_sliceAxis < 0.5) {
            // XY plane (slice through Z)
            samplePos = vec3(v_uv.x, v_uv.y, u_sliceDepth);
        } else if (u_sliceAxis < 1.5) {
            // XZ plane (slice through Y)
            samplePos = vec3(v_uv.x, u_sliceDepth, v_uv.y);
        } else {
            // YZ plane (slice through X)
            samplePos = vec3(u_sliceDepth, v_uv.x, v_uv.y);
        }
        
        // Sample the 3D texture
        vec4 color = texture(u_field, samplePos);
        
        // Apply brightness and output
        outColor = vec4(color.rgb * u_brightness, 1.0);
    }`;

/**
 * Simple display shader (for backwards compatibility with 2D rendering)
 * This will be used temporarily until we fully switch to slice rendering
 */
export const displayFragmentShader = `#version 300 es
    precision highp float;
    
    in vec2 v_uv;
    out vec4 outColor;
    
    uniform sampler2D u_field;
    
    void main() {
        vec4 texColor = texture(u_field, v_uv);
        outColor = vec4(texColor.rgb * ${CONFIG.colorBrightness.toFixed(1)}, 1.0);
    }`;

/**
 * Ray marching shader (for Phase 2)
 * Volumetric rendering through the 3D texture
 * This is a placeholder - full implementation comes in Task 8
 */
export const rayMarch3DFragmentShader = `#version 300 es
    precision highp float;
    precision highp sampler3D;
    
    in vec2 v_uv;
    out vec4 outColor;
    
    uniform sampler3D u_volume;
    uniform mat4 u_invViewProj;     // Inverse view-projection matrix
    uniform vec3 u_cameraPos;       // Camera position
    uniform float u_stepSize;       // Ray march step size
    uniform int u_maxSteps;         // Maximum samples per ray
    
    // Ray-box intersection
    // Returns entry and exit t values, or negative if no intersection
    vec2 rayBoxIntersect(vec3 rayOrigin, vec3 rayDir) {
        vec3 boxMin = vec3(0.0);
        vec3 boxMax = vec3(1.0);
        
        vec3 invDir = 1.0 / rayDir;
        vec3 tMin = (boxMin - rayOrigin) * invDir;
        vec3 tMax = (boxMax - rayOrigin) * invDir;
        
        vec3 t1 = min(tMin, tMax);
        vec3 t2 = max(tMin, tMax);
        
        float tNear = max(max(t1.x, t1.y), t1.z);
        float tFar = min(min(t2.x, t2.y), t2.z);
        
        return vec2(tNear, tFar);
    }
    
    void main() {
        // TODO: Full implementation in Task 8
        // For now, just output a placeholder color
        outColor = vec4(0.1, 0.1, 0.2, 1.0);
        
        /* FUTURE IMPLEMENTATION:
        // Compute ray direction from camera through pixel
        // Ray-box intersection to find entry/exit points
        // March through volume accumulating color/opacity
        // Front-to-back or back-to-front compositing
        */
    }`;

// ============================================================================
// SHADER METADATA
// ============================================================================

export const SHADER_INFO = {
    vertex: {
        name: 'Standard Vertex Shader',
        dimensions: '2D/3D',
        description: 'Maps quad to texture coordinates'
    },
    vertex3D: {
        name: '3D Vertex Shader',
        dimensions: '3D',
        description: 'Includes layer uniform for 3D rendering'
    },
    advect3D: {
        name: '3D Advection',
        dimensions: '3D',
        description: 'Stable implicit advection with vec3 velocity',
        neighbors: 'Trilinear interpolation'
    },
    jacobi3D: {
        name: '3D Jacobi Iteration',
        dimensions: '3D',
        description: 'Poisson solver with 6-neighbor stencil',
        neighbors: 6,
        beta: 1/6
    },
    divergence3D: {
        name: '3D Divergence',
        dimensions: '3D',
        description: 'Computes ∇·u in 3D',
        neighbors: 6
    },
    gradient3D: {
        name: '3D Gradient Subtraction',
        dimensions: '3D',
        description: 'Enforces incompressibility (u = w - ∇p)',
        neighbors: 6
    },
    splat3D: {
        name: '3D Splat',
        dimensions: '3D',
        description: 'Gaussian force/dye injection in 3D'
    },
    slice3D: {
        name: '3D Slice Renderer',
        dimensions: '3D',
        description: 'Visualizes 2D slice through volume'
    },
    rayMarch3D: {
        name: 'Ray Marching (Volumetric)',
        dimensions: '3D',
        description: 'Full volumetric rendering (Phase 2)'
    }
};

console.log('3D Shaders loaded:', Object.keys(SHADER_INFO).length, 'shader programs');
