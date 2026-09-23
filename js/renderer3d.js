/**
 * 3D Rendering logic with slice visualization
 */

import { CONFIG, SliceAxis } from './config.js';

export class Renderer3D {
    constructor(webglContext, displayCanvas, simulation, camera = null, performanceMonitor = null) {
        this.webglContext = webglContext;
        this.gl = webglContext.gl;
        this.webglCanvas = webglContext.canvas;
        this.displayCanvas = displayCanvas;
        this.displayCtx = displayCanvas.getContext('2d');
        this.simulation = simulation;
        this.programs = webglContext.programs;
        this.performanceMonitor = performanceMonitor;
        this.camera = camera;  // 3D camera (for future ray marching)
        
        // Slice rendering state
        this.sliceAxis = CONFIG.sliceAxis;      // 'x', 'y', or 'z'
        this.sliceDepth = CONFIG.sliceDepth;    // 0.0 to 1.0
        this.brightness = CONFIG.colorBrightness;
        
        console.log('Renderer3D initialized');
        console.log(`  Slice axis: ${this.sliceAxis}`);
        console.log(`  Slice depth: ${this.sliceDepth}`);
        console.log(`  Camera: ${camera ? 'enabled' : 'not set'}`);
    }

    /**
     * Render a 2D slice through the 3D volume
     */
    renderSlice() {
        if (this.performanceMonitor) {
            this.performanceMonitor.startTiming('display');
        }
        
        const gl = this.gl;
        const program = this.programs.slice3D;
        
        // Render slice to WebGL canvas (offscreen)
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, CONFIG.gridSize.x, CONFIG.gridSize.y);
        
        // Clear to black
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        
        // Use slice shader
        gl.useProgram(program);
        
        // Bind 3D dye texture
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_3D, this.simulation.dye.fbo1.tex);
        gl.uniform1i(gl.getUniformLocation(program, 'u_field'), 0);
        
        // Set slice parameters
        const axisValue = this.getAxisValue(this.sliceAxis);
        gl.uniform1f(gl.getUniformLocation(program, 'u_sliceAxis'), axisValue);
        gl.uniform1f(gl.getUniformLocation(program, 'u_sliceDepth'), this.sliceDepth);
        gl.uniform1f(gl.getUniformLocation(program, 'u_brightness'), this.brightness);
        
        // Render fullscreen quad
        this.webglContext.renderQuad(program);
        
        if (this.performanceMonitor) {
            this.performanceMonitor.endTiming('display');
        }
    }

    /**
     * Copy WebGL canvas to display canvas
     */
    copyToDisplay() {
        if (this.performanceMonitor) {
            this.performanceMonitor.startTiming('canvasCopy');
        }
        
        // Copy with scaling
        this.displayCtx.drawImage(
            this.webglCanvas, 
            0, 0, 
            this.displayCanvas.width, 
            this.displayCanvas.height
        );
        
        if (this.performanceMonitor) {
            this.performanceMonitor.endTiming('canvasCopy');
        }
    }

    /**
     * Main render function
     */
    render() {
        this.renderSlice();
        this.copyToDisplay();
    }

    /**
     * Convert slice axis string to float value for shader
     */
    getAxisValue(axis) {
        switch(axis.toLowerCase()) {
            case 'x': return 2.0;  // YZ plane
            case 'y': return 1.0;  // XZ plane
            case 'z':
            default:  return 0.0;  // XY plane (default)
        }
    }

    /**
     * Update slice axis (x, y, or z)
     */
    setSliceAxis(axis) {
        if (['x', 'y', 'z'].includes(axis.toLowerCase())) {
            this.sliceAxis = axis.toLowerCase();
            console.log(`Slice axis set to: ${this.sliceAxis}`);
        } else {
            console.warn(`Invalid slice axis: ${axis}, must be x, y, or z`);
        }
    }

    /**
     * Update slice depth (0.0 to 1.0)
     */
    setSliceDepth(depth) {
        this.sliceDepth = Math.max(0.0, Math.min(1.0, depth));
        console.log(`Slice depth set to: ${this.sliceDepth.toFixed(3)}`);
    }

    /**
     * Update brightness multiplier
     */
    setBrightness(brightness) {
        this.brightness = Math.max(0.1, Math.min(10.0, brightness));
        console.log(`Brightness set to: ${this.brightness.toFixed(1)}`);
    }

    /**
     * Get current slice layer number (0-127)
     */
    getSliceLayer() {
        const { x, y, z } = CONFIG.gridSize;
        switch(this.sliceAxis) {
            case 'x': return Math.floor(this.sliceDepth * (x - 1));
            case 'y': return Math.floor(this.sliceDepth * (y - 1));
            case 'z':
            default:  return Math.floor(this.sliceDepth * (z - 1));
        }
    }

    /**
     * Get current rendering info for UI
     */
    getRenderInfo() {
        const layer = this.getSliceLayer();
        const maxLayer = CONFIG.gridSize[this.sliceAxis] - 1;
        
        return {
            axis: this.sliceAxis.toUpperCase(),
            depth: this.sliceDepth,
            layer: layer,
            maxLayer: maxLayer,
            layerLabel: `${layer}/${maxLayer}`,
            brightness: this.brightness
        };
    }
}
