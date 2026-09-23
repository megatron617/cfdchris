/**
 * 3D Fluid simulation logic with layer-by-layer rendering
 */

import { CONFIG } from './config.js';

export class FluidSimulation3D {
    constructor(webglContext, performanceMonitor = null) {
        this.gl = webglContext.gl;
        this.programs = webglContext.programs;
        this.webglContext = webglContext;
        this.performanceMonitor = performanceMonitor;
        
        // Create 3D framebuffers
        console.log('Creating 3D simulation buffers...');
        this.velocity = webglContext.createDoubleFBO3D();
        this.dye = webglContext.createDoubleFBO3D();
        this.pressure = webglContext.createDoubleFBO3D();
        this.divergence = webglContext.createFBO3D();
        
        console.log('✓ 3D simulation buffers created');
        
        this.params = {
            iterations: CONFIG.iterations,
            forceMultiplier: CONFIG.forceMultiplier,
            dt: CONFIG.dt
        };
        
        // Cache grid dimensions
        this.gridSize = CONFIG.gridSize;
        this.gridScale = [
            1.0 / this.gridSize.x,
            1.0 / this.gridSize.y,
            1.0 / this.gridSize.z
        ];
        
        // Cache uniform locations for performance
        this.uniformCache = {};
        this.cacheUniformLocations();
    }

    /**
     * Cache uniform locations to avoid repeated lookups
     */
    cacheUniformLocations() {
        const gl = this.gl;
        const programs = this.programs;
        
        this.uniformCache = {
            advect3D: {
                u_velocity: gl.getUniformLocation(programs.advect3D, 'u_velocity'),
                u_source: gl.getUniformLocation(programs.advect3D, 'u_source'),
                u_dt: gl.getUniformLocation(programs.advect3D, 'u_dt'),
                u_gridScale: gl.getUniformLocation(programs.advect3D, 'u_gridScale'),
                u_layer: gl.getUniformLocation(programs.advect3D, 'u_layer')
            },
            jacobi3D: {
                u_x: gl.getUniformLocation(programs.jacobi3D, 'u_x'),
                u_b: gl.getUniformLocation(programs.jacobi3D, 'u_b'),
                u_alpha: gl.getUniformLocation(programs.jacobi3D, 'u_alpha'),
                u_rBeta: gl.getUniformLocation(programs.jacobi3D, 'u_rBeta'),
                u_layer: gl.getUniformLocation(programs.jacobi3D, 'u_layer')
            },
            divergence3D: {
                u_velocity: gl.getUniformLocation(programs.divergence3D, 'u_velocity'),
                u_layer: gl.getUniformLocation(programs.divergence3D, 'u_layer')
            },
            gradient3D: {
                u_pressure: gl.getUniformLocation(programs.gradient3D, 'u_pressure'),
                u_velocity: gl.getUniformLocation(programs.gradient3D, 'u_velocity'),
                u_layer: gl.getUniformLocation(programs.gradient3D, 'u_layer')
            },
            splat3D: {
                u_field: gl.getUniformLocation(programs.splat3D, 'u_field'),
                u_point: gl.getUniformLocation(programs.splat3D, 'u_point'),
                u_value: gl.getUniformLocation(programs.splat3D, 'u_value'),
                u_radius: gl.getUniformLocation(programs.splat3D, 'u_radius'),
                u_layer: gl.getUniformLocation(programs.splat3D, 'u_layer')
            }
        };
    }

    /**
     * Render to all layers of a 3D texture
     * This is the core of layer-by-layer rendering
     */
    renderToAllLayers(program, outputFBO, uniformSetup) {
        const gl = this.gl;
        const { x, y, z } = this.gridSize;
        
        gl.viewport(0, 0, x, y);
        gl.useProgram(program);
        
        // Set uniforms that are constant across all layers
        if (uniformSetup) {
            uniformSetup();
        }
        
        // Render each Z-layer
        for (let layer = 0; layer < z; layer++) {
            // Attach this layer to the framebuffer
            this.webglContext.attachTextureLayer(
                outputFBO.fbo,
                outputFBO.tex,
                layer
            );
            
            // Set layer uniform (normalized 0.0 to 1.0)
            const layerUV = layer / (z - 1);
            const u_layer = gl.getUniformLocation(program, 'u_layer');
            gl.uniform1f(u_layer, layerUV);
            
            // Render fullscreen quad for this layer
            this.webglContext.renderQuad(program);
        }
    }

    /**
     * 3D Splat: Inject force/dye at a 3D position
     */
    splat3D(target, x, y, z, dx, dy, dz) {
        if (this.performanceMonitor) {
            this.performanceMonitor.startTiming('splat');
        }
        
        const gl = this.gl;
        const program = this.programs.splat3D;
        const uniforms = this.uniformCache.splat3D;
        
        const uniformSetup = () => {
            // Bind input texture (3D)
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_3D, target.fbo1.tex);
            gl.uniform1i(uniforms.u_field, 0);
            
            // Set splat parameters
            gl.uniform3f(uniforms.u_point, x, y, z);
            gl.uniform3f(uniforms.u_value, dx, dy, dz);
            gl.uniform1f(uniforms.u_radius, CONFIG.splatRadius);
        };
        
        // Render to all layers
        this.renderToAllLayers(program, target.fbo2, uniformSetup);
        
        // Swap buffers
        target.swap();
        
        if (this.performanceMonitor) {
            this.performanceMonitor.endTiming('splat');
        }
    }

    /**
     * 3D Advection: Transport velocity/dye along the velocity field
     */
    advect3D(target, dissipation = 1.0) {
        const gl = this.gl;
        const program = this.programs.advect3D;
        const uniforms = this.uniformCache.advect3D;
        
        const uniformSetup = () => {
            // Bind velocity field (3D)
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_3D, this.velocity.fbo1.tex);
            gl.uniform1i(uniforms.u_velocity, 0);
            
            // Bind source field (3D)
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_3D, target.fbo1.tex);
            gl.uniform1i(uniforms.u_source, 1);
            
            // Set timestep and grid scale
            gl.uniform1f(uniforms.u_dt, this.params.dt * dissipation);
            gl.uniform3fv(uniforms.u_gridScale, this.gridScale);
        };
        
        // Render to all layers
        this.renderToAllLayers(program, target.fbo2, uniformSetup);
        
        // Swap buffers
        target.swap();
    }

    /**
     * Compute divergence of velocity field
     */
    computeDivergence3D() {
        if (this.performanceMonitor) {
            this.performanceMonitor.startTiming('divergence');
        }
        
        const gl = this.gl;
        const program = this.programs.divergence3D;
        const uniforms = this.uniformCache.divergence3D;
        
        const uniformSetup = () => {
            // Bind velocity field (3D)
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_3D, this.velocity.fbo1.tex);
            gl.uniform1i(uniforms.u_velocity, 0);
        };
        
        // Render to all layers
        this.renderToAllLayers(program, this.divergence, uniformSetup);
        
        if (this.performanceMonitor) {
            this.performanceMonitor.endTiming('divergence');
        }
    }

    /**
     * Solve for pressure using Jacobi iteration
     */
    solvePressure3D() {
        if (this.performanceMonitor) {
            this.performanceMonitor.startTiming('pressureSolve');
        }
        
        const gl = this.gl;
        const program = this.programs.jacobi3D;
        const uniforms = this.uniformCache.jacobi3D;
        const { x, y, z } = this.gridSize;
        
        // Clear pressure buffers (all layers)
        this.clearTexture3D(this.pressure.fbo1);
        this.clearTexture3D(this.pressure.fbo2);
        
        // Jacobi parameters for 3D (beta = 6 instead of 4)
        const alpha = -1.0;  // -Δx² for pressure Poisson equation
        const rBeta = 1.0 / 6.0;  // Reciprocal beta for 3D (not 1/4!)
        
        const targetIterations = this.params.iterations;
        let actualIterations = 0;
        
        // Jacobi iteration loop
        for (let i = 0; i < targetIterations; i++) {
            const uniformSetup = () => {
                // Bind current pressure estimate (3D)
                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_3D, this.pressure.fbo1.tex);
                gl.uniform1i(uniforms.u_x, 0);
                
                // Bind divergence (3D)
                gl.activeTexture(gl.TEXTURE1);
                gl.bindTexture(gl.TEXTURE_3D, this.divergence.tex);
                gl.uniform1i(uniforms.u_b, 1);
                
                // Set Jacobi parameters
                gl.uniform1f(uniforms.u_alpha, alpha);
                gl.uniform1f(uniforms.u_rBeta, rBeta);
            };
            
            // Render to all layers
            this.renderToAllLayers(program, this.pressure.fbo2, uniformSetup);
            
            // Swap buffers
            this.pressure.swap();
            actualIterations++;
        }
        
        // Update quality metrics
        if (this.performanceMonitor) {
            this.performanceMonitor.updateQualityMetrics(targetIterations, actualIterations);
            this.performanceMonitor.endTiming('pressureSolve');
        }
    }

    /**
     * Subtract pressure gradient from velocity to enforce incompressibility
     */
    subtractGradient3D() {
        if (this.performanceMonitor) {
            this.performanceMonitor.startTiming('gradient');
        }
        
        const gl = this.gl;
        const program = this.programs.gradient3D;
        const uniforms = this.uniformCache.gradient3D;
        
        const uniformSetup = () => {
            // Bind pressure field (3D)
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_3D, this.pressure.fbo1.tex);
            gl.uniform1i(uniforms.u_pressure, 0);
            
            // Bind velocity field (3D)
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_3D, this.velocity.fbo1.tex);
            gl.uniform1i(uniforms.u_velocity, 1);
        };
        
        // Render to all layers
        this.renderToAllLayers(program, this.velocity.fbo2, uniformSetup);
        
        // Swap buffers
        this.velocity.swap();
        
        if (this.performanceMonitor) {
            this.performanceMonitor.endTiming('gradient');
        }
    }

    /**
     * Clear all layers of a 3D texture to black
     */
    clearTexture3D(fbo) {
        const gl = this.gl;
        const { z } = this.gridSize;
        
        gl.clearColor(0, 0, 0, 1);
        
        for (let layer = 0; layer < z; layer++) {
            this.webglContext.attachTextureLayer(fbo.fbo, fbo.tex, layer);
            gl.clear(gl.COLOR_BUFFER_BIT);
        }
    }

    /**
     * Main simulation step
     */
    step() {
        // Advect velocity and dye
        if (this.performanceMonitor) {
            this.performanceMonitor.startTiming('advectVelocity');
        }
        this.advect3D(this.velocity, CONFIG.velocityDissipation);
        if (this.performanceMonitor) {
            this.performanceMonitor.endTiming('advectVelocity');
        }
        
        if (this.performanceMonitor) {
            this.performanceMonitor.startTiming('advectDye');
        }
        this.advect3D(this.dye, CONFIG.dyeDissipation);
        if (this.performanceMonitor) {
            this.performanceMonitor.endTiming('advectDye');
        }
        
        // Compute divergence
        this.computeDivergence3D();
        
        // Solve for pressure
        this.solvePressure3D();
        
        // Subtract pressure gradient from velocity
        this.subtractGradient3D();
    }

    /**
     * Clear all simulation fields
     */
    clear() {
        console.log('Clearing 3D simulation fields...');
        
        // Clear all 3D textures
        this.clearTexture3D(this.velocity.fbo1);
        this.clearTexture3D(this.velocity.fbo2);
        this.clearTexture3D(this.dye.fbo1);
        this.clearTexture3D(this.dye.fbo2);
        this.clearTexture3D(this.pressure.fbo1);
        this.clearTexture3D(this.pressure.fbo2);
        this.clearTexture3D(this.divergence);
        
        console.log('✓ 3D fields cleared');
    }

    /**
     * Update simulation parameters
     */
    updateParams(params) {
        Object.assign(this.params, params);
    }

    /**
     * Get diagnostic information
     */
    getDiagnostics() {
        return {
            gridSize: this.gridSize,
            totalVoxels: this.gridSize.x * this.gridSize.y * this.gridSize.z,
            params: this.params,
            textures: {
                velocity: !!this.velocity,
                dye: !!this.dye,
                pressure: !!this.pressure,
                divergence: !!this.divergence
            }
        };
    }
}
