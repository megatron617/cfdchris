/**
 * Rendering logic
 */

import { CONFIG } from './config.js';

export class Renderer {
    constructor(webglContext, displayCanvas, simulation) {
        this.webglContext = webglContext;
        this.gl = webglContext.gl;
        this.webglCanvas = webglContext.canvas;
        this.displayCanvas = displayCanvas;
        this.displayCtx = displayCanvas.getContext('2d');
        this.simulation = simulation;
        this.programs = webglContext.programs;
    }

    render() {
        const gl = this.gl;
        
        // Render dye to WebGL canvas
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, CONFIG.gridSize, CONFIG.gridSize);
        
        // Clear to black
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        
        // Render the dye texture
        gl.useProgram(this.programs.display);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.simulation.dye.fbo1.tex);
        gl.uniform1i(gl.getUniformLocation(this.programs.display, 'u_field'), 0);
        this.webglContext.renderQuad(this.programs.display);
        
        // Copy to display canvas with scaling
        this.displayCtx.drawImage(
            this.webglCanvas, 
            0, 0, 
            this.displayCanvas.width, 
            this.displayCanvas.height
        );
    }
}
