/**
 * 3D Rendering — slice visualisation and volumetric ray march
 */

import { CONFIG, SliceAxis } from './config.js';

export class Renderer3D {
    constructor(webglContext, displayCanvas, simulation, camera = null, performanceMonitor = null) {
        this.webglContext       = webglContext;
        this.gl                 = webglContext.gl;
        this.webglCanvas        = webglContext.canvas;
        this.displayCanvas      = displayCanvas;
        this.displayCtx         = displayCanvas.getContext('2d');
        this.simulation         = simulation;
        this.programs           = webglContext.programs;
        this.performanceMonitor = performanceMonitor;
        this.camera             = camera;

        // Slice rendering state
        this.sliceAxis  = CONFIG.sliceAxis;
        this.sliceDepth = CONFIG.sliceDepth;
        this.brightness = CONFIG.colorBrightness;

        // Volumetric rendering state
        this.transferFunction = null;   // set via setTransferFunction()
        this.showWireframe    = true;   // overlay unit-cube bounding box in raymarch mode

        console.log('Renderer3D initialized');
        console.log(`  Slice axis: ${this.sliceAxis}`);
        console.log(`  Slice depth: ${this.sliceDepth}`);
        console.log(`  Camera: ${camera ? 'enabled' : 'not set'}`);
    }

    /** Attach a TransferFunction instance used by renderVolume(). */
    setTransferFunction(tf) {
        this.transferFunction = tf;
    }

    // ── Slice renderer ─────────────────────────────────────────────────────

    renderSlice() {
        if (this.performanceMonitor) this.performanceMonitor.startTiming('display');

        const gl      = this.gl;
        const program = this.programs.slice3D;

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, CONFIG.gridSize.x, CONFIG.gridSize.y);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.useProgram(program);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_3D, this.simulation.dye.fbo1.tex);
        gl.uniform1i(gl.getUniformLocation(program, 'u_field'), 0);

        gl.uniform1f(gl.getUniformLocation(program, 'u_sliceAxis'),  this.getAxisValue(this.sliceAxis));
        gl.uniform1f(gl.getUniformLocation(program, 'u_sliceDepth'), this.sliceDepth);
        gl.uniform1f(gl.getUniformLocation(program, 'u_brightness'), this.brightness);

        this.webglContext.renderQuad(program);

        if (this.performanceMonitor) this.performanceMonitor.endTiming('display');
    }

    // ── Volumetric ray-march renderer ──────────────────────────────────────

    /**
     * Render the volume by ray marching through the dye 3D texture.
     * Requires this.transferFunction to be set.
     */
    renderVolume() {
        if (!this.transferFunction || !this.camera) {
            // Fall back to slice if not yet ready
            this.renderSlice();
            return;
        }
        if (this.performanceMonitor) this.performanceMonitor.startTiming('display');

        const gl      = this.gl;
        const program = this.programs.rayMarch3D;
        if (!program) {
            console.warn('rayMarch3D program not compiled — falling back to slice');
            this.renderSlice();
            return;
        }

        // Update camera aspect ratio from the display canvas
        this.camera.setAspect(this.displayCanvas.width / this.displayCanvas.height);

        // Compute inverse view-projection matrix
        const V       = this.camera.getViewMatrix();
        const P       = this.camera.getProjectionMatrix();
        const VP      = this.mat4Multiply(P, V);   // P * V  (column-major)
        const invVP   = this.mat4Invert(VP);
        if (!invVP) {
            if (this.performanceMonitor) this.performanceMonitor.endTiming('display');
            return;
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, this.webglCanvas.width, this.webglCanvas.height);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.useProgram(program);

        // Texture unit 0 — dye 3D texture
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_3D, this.simulation.dye.fbo1.tex);
        gl.uniform1i(gl.getUniformLocation(program, 'u_dye'), 0);

        // Texture unit 1 — transfer function
        this.transferFunction.bind(1);
        gl.uniform1i(gl.getUniformLocation(program, 'u_transfer'), 1);

        // Matrix and camera uniforms
        gl.uniformMatrix4fv(gl.getUniformLocation(program, 'u_invViewProj'), false, invVP);
        gl.uniform3fv(gl.getUniformLocation(program, 'u_cameraPos'), this.camera.position);

        // Ray march parameters
        gl.uniform1f(gl.getUniformLocation(program, 'u_stepCount'),    CONFIG.rayMarchSteps);
        gl.uniform1f(gl.getUniformLocation(program, 'u_opacityScale'), CONFIG.opacityScale);
        gl.uniform1f(gl.getUniformLocation(program, 'u_densityScale'), CONFIG.densityScale);

        this.webglContext.renderQuad(program);

        if (this.performanceMonitor) this.performanceMonitor.endTiming('display');
    }

    // ── Main render dispatch ───────────────────────────────────────────────

    render() {
        if (CONFIG.renderMode === 'raymarch') {
            this.renderVolume();
        } else {
            this.renderSlice();
        }
        this.copyToDisplay();
        // 2D wireframe overlay — drawn on the display canvas after the WebGL copy
        // so it renders at display resolution regardless of WebGL canvas size.
        if (CONFIG.renderMode === 'raymarch') {
            this.drawWireframe2D();
        }
    }

    /** Copy the (possibly up-scaled) WebGL canvas to the display canvas. */
    copyToDisplay() {
        if (this.performanceMonitor) this.performanceMonitor.startTiming('canvasCopy');

        this.displayCtx.drawImage(
            this.webglCanvas,
            0, 0,
            this.displayCanvas.width,
            this.displayCanvas.height
        );

        if (this.performanceMonitor) this.performanceMonitor.endTiming('canvasCopy');
    }

    /** Set render mode: 'slice' | 'raymarch' */
    setMode(mode) {
        CONFIG.renderMode = mode;
        console.log(`Render mode → ${mode}`);
    }

    // ── Slice helpers ──────────────────────────────────────────────────────

    getAxisValue(axis) {
        switch (axis.toLowerCase()) {
            case 'x': return 2.0;  // YZ plane
            case 'y': return 1.0;  // XZ plane
            case 'z':
            default:  return 0.0;  // XY plane
        }
    }

    setSliceAxis(axis) {
        if (['x', 'y', 'z'].includes(axis.toLowerCase())) {
            this.sliceAxis = axis.toLowerCase();
            console.log(`Slice axis → ${this.sliceAxis}`);
        }
    }

    setSliceDepth(depth) {
        this.sliceDepth = Math.max(0.0, Math.min(1.0, depth));
    }

    setBrightness(brightness) {
        this.brightness = Math.max(0.1, Math.min(10.0, brightness));
    }

    getSliceLayer() {
        const { x, y, z } = CONFIG.gridSize;
        switch (this.sliceAxis) {
            case 'x': return Math.floor(this.sliceDepth * (x - 1));
            case 'y': return Math.floor(this.sliceDepth * (y - 1));
            case 'z':
            default:  return Math.floor(this.sliceDepth * (z - 1));
        }
    }

    getRenderInfo() {
        const layer    = this.getSliceLayer();
        const maxLayer = CONFIG.gridSize[this.sliceAxis] - 1;
        return {
            axis:       this.sliceAxis.toUpperCase(),
            depth:      this.sliceDepth,
            layer,
            maxLayer,
            layerLabel: `${layer}/${maxLayer}`,
            brightness: this.brightness
        };
    }

    // ── Bounding-box wireframe overlay ────────────────────────────────────

    /**
     * Project the 12 edges of the unit cube [0,0,0]→[1,1,1] through the
     * current view-projection matrix and draw them on the 2D display canvas.
     * Running this AFTER copyToDisplay() means it composites at display
     * resolution (512×512) regardless of the WebGL canvas gridSize.
     *
     * Near-plane clipping is handled so edges that straddle the camera near
     * plane are drawn correctly instead of disappearing entirely.
     */
    drawWireframe2D() {
        if (!this.camera || !this.showWireframe) return;

        this.camera.setAspect(this.displayCanvas.width / this.displayCanvas.height);
        const V  = this.camera.getViewMatrix();
        const P  = this.camera.getProjectionMatrix();
        const VP = this.mat4Multiply(P, V);

        const W    = this.displayCanvas.width;
        const H    = this.displayCanvas.height;
        const NEAR = 0.001;   // homogeneous w threshold for near-plane clip

        /**
         * Transform a world-space point to homogeneous clip coords.
         * Column-major VP: element [col*4+row], so row 0 = VP[0,4,8,12], etc.
         */
        const toClip = (x, y, z) => ({
            cx: VP[0]*x + VP[4]*y + VP[ 8]*z + VP[12],
            cy: VP[1]*x + VP[5]*y + VP[ 9]*z + VP[13],
            cw: VP[3]*x + VP[7]*y + VP[11]*z + VP[15]
        });

        /** Perspective-divide to display canvas pixel coords. */
        const toPixel = ({ cx, cy, cw }) => [
            ( cx / cw + 1.0) * 0.5 * W,
            (1.0 - cy / cw)  * 0.5 * H
        ];

        // 12 edges of the unit cube expressed as pairs of corner coords.
        const EDGES = [
            // Bottom ring  (y = 0)
            [0,0,0, 1,0,0], [1,0,0, 1,0,1], [1,0,1, 0,0,1], [0,0,1, 0,0,0],
            // Top ring     (y = 1)
            [0,1,0, 1,1,0], [1,1,0, 1,1,1], [1,1,1, 0,1,1], [0,1,1, 0,1,0],
            // Vertical pillars
            [0,0,0, 0,1,0], [1,0,0, 1,1,0], [1,0,1, 1,1,1], [0,0,1, 0,1,1],
        ];

        const ctx = this.displayCtx;
        ctx.save();
        ctx.strokeStyle = 'rgba(160, 220, 255, 0.85)';
        ctx.lineWidth   = 1;
        ctx.beginPath();

        for (const [x0,y0,z0, x1,y1,z1] of EDGES) {
            const c0 = toClip(x0, y0, z0);
            const c1 = toClip(x1, y1, z1);

            // Both behind near plane → skip entirely.
            if (c0.cw <= NEAR && c1.cw <= NEAR) continue;

            if (c0.cw > NEAR && c1.cw > NEAR) {
                // Both in front → draw directly.
                const p0 = toPixel(c0);
                const p1 = toPixel(c1);
                ctx.moveTo(p0[0], p0[1]);
                ctx.lineTo(p1[0], p1[1]);
            } else {
                // One vertex straddles the near plane → clip at cw == NEAR.
                const t = (c0.cw - NEAR) / (c0.cw - c1.cw);
                const clipped = {
                    cx: c0.cx + (c1.cx - c0.cx) * t,
                    cy: c0.cy + (c1.cy - c0.cy) * t,
                    cw: NEAR
                };
                const front = c0.cw > NEAR ? c0 : c1;
                const pFront   = toPixel(front);
                const pClipped = toPixel(clipped);
                ctx.moveTo(pFront[0],   pFront[1]);
                ctx.lineTo(pClipped[0], pClipped[1]);
            }
        }

        ctx.stroke();
        ctx.restore();
    }

    // ── Matrix utilities ───────────────────────────────────────────────────

    /**
     * 4×4 column-major matrix multiply: returns a * b.
     * Element at (row r, col c) = mat[c*4+r].
     * @param {number[]|Float32Array} a
     * @param {number[]|Float32Array} b
     * @returns {Float32Array}
     */
    mat4Multiply(a, b) {
        const out = new Float32Array(16);
        for (let col = 0; col < 4; col++) {
            for (let row = 0; row < 4; row++) {
                let sum = 0;
                for (let k = 0; k < 4; k++) {
                    sum += a[k * 4 + row] * b[col * 4 + k];
                }
                out[col * 4 + row] = sum;
            }
        }
        return out;
    }

    /**
     * Invert a 4×4 column-major matrix using the adjugate/determinant method.
     * Returns null when the matrix is singular.
     * @param {number[]|Float32Array} m
     * @returns {Float32Array|null}
     */
    mat4Invert(m) {
        const n = new Float32Array(16);

        n[0]  =  m[5]*m[10]*m[15] - m[5]*m[11]*m[14] - m[9]*m[6]*m[15]  + m[9]*m[7]*m[14]  + m[13]*m[6]*m[11]  - m[13]*m[7]*m[10];
        n[4]  = -m[4]*m[10]*m[15] + m[4]*m[11]*m[14] + m[8]*m[6]*m[15]  - m[8]*m[7]*m[14]  - m[12]*m[6]*m[11]  + m[12]*m[7]*m[10];
        n[8]  =  m[4]*m[9] *m[15] - m[4]*m[11]*m[13] - m[8]*m[5]*m[15]  + m[8]*m[7]*m[13]  + m[12]*m[5]*m[11]  - m[12]*m[7]*m[9];
        n[12] = -m[4]*m[9] *m[14] + m[4]*m[10]*m[13] + m[8]*m[5]*m[14]  - m[8]*m[6]*m[13]  - m[12]*m[5]*m[10]  + m[12]*m[6]*m[9];

        n[1]  = -m[1]*m[10]*m[15] + m[1]*m[11]*m[14] + m[9]*m[2]*m[15]  - m[9]*m[3]*m[14]  - m[13]*m[2]*m[11]  + m[13]*m[3]*m[10];
        n[5]  =  m[0]*m[10]*m[15] - m[0]*m[11]*m[14] - m[8]*m[2]*m[15]  + m[8]*m[3]*m[14]  + m[12]*m[2]*m[11]  - m[12]*m[3]*m[10];
        n[9]  = -m[0]*m[9] *m[15] + m[0]*m[11]*m[13] + m[8]*m[1]*m[15]  - m[8]*m[3]*m[13]  - m[12]*m[1]*m[11]  + m[12]*m[3]*m[9];
        n[13] =  m[0]*m[9] *m[14] - m[0]*m[10]*m[13] - m[8]*m[1]*m[14]  + m[8]*m[2]*m[13]  + m[12]*m[1]*m[10]  - m[12]*m[2]*m[9];

        n[2]  =  m[1]*m[6] *m[15] - m[1]*m[7] *m[14] - m[5]*m[2]*m[15]  + m[5]*m[3]*m[14]  + m[13]*m[2]*m[7]   - m[13]*m[3]*m[6];
        n[6]  = -m[0]*m[6] *m[15] + m[0]*m[7] *m[14] + m[4]*m[2]*m[15]  - m[4]*m[3]*m[14]  - m[12]*m[2]*m[7]   + m[12]*m[3]*m[6];
        n[10] =  m[0]*m[5] *m[15] - m[0]*m[7] *m[13] - m[4]*m[1]*m[15]  + m[4]*m[3]*m[13]  + m[12]*m[1]*m[7]   - m[12]*m[3]*m[5];
        n[14] = -m[0]*m[5] *m[14] + m[0]*m[6] *m[13] + m[4]*m[1]*m[14]  - m[4]*m[2]*m[13]  - m[12]*m[1]*m[6]   + m[12]*m[2]*m[5];

        n[3]  = -m[1]*m[6] *m[11] + m[1]*m[7] *m[10] + m[5]*m[2]*m[11]  - m[5]*m[3]*m[10]  - m[9]*m[2]*m[7]    + m[9]*m[3]*m[6];
        n[7]  =  m[0]*m[6] *m[11] - m[0]*m[7] *m[10] - m[4]*m[2]*m[11]  + m[4]*m[3]*m[10]  + m[8]*m[2]*m[7]    - m[8]*m[3]*m[6];
        n[11] = -m[0]*m[5] *m[11] + m[0]*m[7] *m[9]  + m[4]*m[1]*m[11]  - m[4]*m[3]*m[9]   - m[8]*m[1]*m[7]    + m[8]*m[3]*m[5];
        n[15] =  m[0]*m[5] *m[10] - m[0]*m[6] *m[9]  - m[4]*m[1]*m[10]  + m[4]*m[2]*m[9]   + m[8]*m[1]*m[6]    - m[8]*m[2]*m[5];

        const det = m[0]*n[0] + m[1]*n[4] + m[2]*n[8] + m[3]*n[12];
        if (Math.abs(det) < 1e-15) return null;

        const inv = 1.0 / det;
        for (let i = 0; i < 16; i++) n[i] *= inv;
        return n;
    }
}
