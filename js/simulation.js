/**
 * Fluid simulation logic
 */

import { CONFIG } from './config.js';

export class FluidSimulation {
    constructor(webglContext, performanceMonitor = null) {
        this.gl = webglContext.gl;
        this.programs = webglContext.programs;
        this.webglContext = webglContext;
        this.performanceMonitor = performanceMonitor;
        
        // Create framebuffers
        this.velocity = webglContext.createDoubleFBO();
        this.dye = webglContext.createDoubleFBO();
        this.pressure = webglContext.createDoubleFBO();
        this.divergence = webglContext.createFBO();
        
        this.params = {
            iterations: CONFIG.iterations,
            forceMultiplier: CONFIG.forceMultiplier,
            dt: CONFIG.dt
        };
    }

    splat(target, x, y, dx, dy, dz) {
        if (this.performanceMonitor) {
            this.performanceMonitor.startTiming('splat');
        }
        
        const gl = this.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo2.fbo);
        gl.viewport(0, 0, CONFIG.gridSize.x, CONFIG.gridSize.y);
        gl.useProgram(this.programs.splat);
        
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, target.fbo1.tex);
        gl.uniform1i(gl.getUniformLocation(this.programs.splat, 'u_field'), 0);
        gl.uniform2f(gl.getUniformLocation(this.programs.splat, 'u_point'), x, y);
        gl.uniform3f(gl.getUniformLocation(this.programs.splat, 'u_value'), dx, dy, dz);
        gl.uniform1f(gl.getUniformLocation(this.programs.splat, 'u_radius'), CONFIG.splatRadius);
        
        this.webglContext.renderQuad(this.programs.splat);
        target.swap();
        
        if (this.performanceMonitor) {
            this.performanceMonitor.endTiming('splat');
        }
    }

    advect(target, dissipation = 1.0) {
        const gl = this.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo2.fbo);
        gl.viewport(0, 0, CONFIG.gridSize.x, CONFIG.gridSize.y);
        gl.useProgram(this.programs.advect);
        
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.velocity.fbo1.tex);
        gl.uniform1i(gl.getUniformLocation(this.programs.advect, 'u_velocity'), 0);
        
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, target.fbo1.tex);
        gl.uniform1i(gl.getUniformLocation(this.programs.advect, 'u_source'), 1);
        gl.uniform1f(gl.getUniformLocation(this.programs.advect, 'u_dt'), this.params.dt * dissipation);
        
        this.webglContext.renderQuad(this.programs.advect);
        target.swap();
    }

    computeDivergence() {
        if (this.performanceMonitor) {
            this.performanceMonitor.startTiming('divergence');
        }
        
        const gl = this.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.divergence.fbo);
        gl.viewport(0, 0, CONFIG.gridSize.x, CONFIG.gridSize.y);
        gl.useProgram(this.programs.divergence);
        
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.velocity.fbo1.tex);
        gl.uniform1i(gl.getUniformLocation(this.programs.divergence, 'u_velocity'), 0);
        
        this.webglContext.renderQuad(this.programs.divergence);
        
        if (this.performanceMonitor) {
            this.performanceMonitor.endTiming('divergence');
        }
    }

    solvePressure() {
        if (this.performanceMonitor) {
            this.performanceMonitor.startTiming('pressureSolve');
        }
        
        const gl = this.gl;
        
        // Clear pressure buffers
        gl.clearColor(0, 0, 0, 1);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.pressure.fbo1.fbo);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.pressure.fbo2.fbo);
        gl.clear(gl.COLOR_BUFFER_BIT);
        
        // Jacobi iteration
        gl.useProgram(this.programs.jacobi);
        gl.uniform1f(gl.getUniformLocation(this.programs.jacobi, 'u_alpha'), -1.0);
        gl.uniform1f(gl.getUniformLocation(this.programs.jacobi, 'u_rBeta'), 0.25);
        
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.divergence.tex);
        gl.uniform1i(gl.getUniformLocation(this.programs.jacobi, 'u_b'), 1);
        
        const targetIterations = this.params.iterations;
        let actualIterations = 0;
        
        for (let i = 0; i < targetIterations; i++) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.pressure.fbo2.fbo);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.pressure.fbo1.tex);
            gl.uniform1i(gl.getUniformLocation(this.programs.jacobi, 'u_x'), 0);
            this.webglContext.renderQuad(this.programs.jacobi);
            this.pressure.swap();
            actualIterations++;
        }
        
        // Update quality metrics
        if (this.performanceMonitor) {
            this.performanceMonitor.updateQualityMetrics(targetIterations, actualIterations);
            this.performanceMonitor.endTiming('pressureSolve');
        }
    }

    subtractGradient() {
        if (this.performanceMonitor) {
            this.performanceMonitor.startTiming('gradient');
        }
        
        const gl = this.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.velocity.fbo2.fbo);
        gl.viewport(0, 0, CONFIG.gridSize.x, CONFIG.gridSize.y);
        gl.useProgram(this.programs.gradient);
        
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.pressure.fbo1.tex);
        gl.uniform1i(gl.getUniformLocation(this.programs.gradient, 'u_pressure'), 0);
        
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.velocity.fbo1.tex);
        gl.uniform1i(gl.getUniformLocation(this.programs.gradient, 'u_velocity'), 1);
        
        this.webglContext.renderQuad(this.programs.gradient);
        this.velocity.swap();
        
        if (this.performanceMonitor) {
            this.performanceMonitor.endTiming('gradient');
        }
    }

    step() {
        // Advect velocity and dye
        if (this.performanceMonitor) {
            this.performanceMonitor.startTiming('advectVelocity');
        }
        this.advect(this.velocity, CONFIG.velocityDissipation);
        if (this.performanceMonitor) {
            this.performanceMonitor.endTiming('advectVelocity');
        }
        
        if (this.performanceMonitor) {
            this.performanceMonitor.startTiming('advectDye');
        }
        this.advect(this.dye, CONFIG.dyeDissipation);
        if (this.performanceMonitor) {
            this.performanceMonitor.endTiming('advectDye');
        }
        
        // Compute divergence
        this.computeDivergence();
        
        // Solve for pressure
        this.solvePressure();
        
        // Subtract pressure gradient from velocity
        this.subtractGradient();
    }

    clear() {
        const gl = this.gl;
        gl.clearColor(0, 0, 0, 1);
        [this.velocity.fbo1, this.velocity.fbo2, 
         this.dye.fbo1, this.dye.fbo2, 
         this.pressure.fbo1, this.pressure.fbo2].forEach(f => {
            gl.bindFramebuffer(gl.FRAMEBUFFER, f.fbo);
            gl.clear(gl.COLOR_BUFFER_BIT);
        });
    }

    updateParams(params) {
        Object.assign(this.params, params);
    }
}
