/**
 * WebGL utility functions and setup
 */

import { CONFIG } from './config.js';
import * as Shaders from './shaders.js';

export class WebGLContext {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = canvas.getContext('webgl2', {
            alpha: false,
            premultipliedAlpha: false,
            preserveDrawingBuffer: true
        });

        if (!this.gl) {
            throw new Error('WebGL2 not supported!');
        }

        // Check for required extensions
        if (!this.gl.getExtension('EXT_color_buffer_float')) {
            throw new Error('Float textures not supported!');
        }

        // Try to enable linear filtering for float textures
        this.floatLinear = this.gl.getExtension('OES_texture_float_linear');
        console.log('Float linear filtering:', this.floatLinear ? 'supported' : 'NOT supported');

        this.programs = this.createPrograms();
        this.quadBuffer = this.createQuadBuffer();
    }

    createShader(type, source) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('Shader compilation error:', gl.getShaderInfoLog(shader));
            console.error('Source:', source);
            gl.deleteShader(shader);
            return null;
        }
        
        return shader;
    }

    createProgram(fragmentShaderSource) {
        const gl = this.gl;
        const program = gl.createProgram();
        
        const vs = this.createShader(gl.VERTEX_SHADER, Shaders.vertexShader);
        const fs = this.createShader(gl.FRAGMENT_SHADER, fragmentShaderSource);
        
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
        
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('Program link error:', gl.getProgramInfoLog(program));
            gl.deleteProgram(program);
            return null;
        }
        
        return program;
    }

    createPrograms() {
        return {
            advect: this.createProgram(Shaders.advectFragmentShader),
            jacobi: this.createProgram(Shaders.jacobiFragmentShader),
            divergence: this.createProgram(Shaders.divergenceFragmentShader),
            gradient: this.createProgram(Shaders.gradientFragmentShader),
            splat: this.createProgram(Shaders.splatFragmentShader),
            display: this.createProgram(Shaders.displayFragmentShader)
        };
    }

    createQuadBuffer() {
        const gl = this.gl;
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
        return buffer;
    }

    createFBO() {
        const gl = this.gl;
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, CONFIG.gridSize, CONFIG.gridSize, 0, gl.RGBA, gl.FLOAT, null);
        
        // Use LINEAR if supported, otherwise NEAREST
        const filterMode = this.floatLinear ? gl.LINEAR : gl.NEAREST;
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filterMode);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filterMode);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        
        const fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
        
        const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        if (status !== gl.FRAMEBUFFER_COMPLETE) {
            console.error('FBO incomplete:', status);
        }
        
        return { fbo, tex };
    }

    createDoubleFBO() {
        return {
            fbo1: this.createFBO(),
            fbo2: this.createFBO(),
            swap() {
                const temp = this.fbo1;
                this.fbo1 = this.fbo2;
                this.fbo2 = temp;
            }
        };
    }

    renderQuad(program) {
        const gl = this.gl;
        const posLoc = gl.getAttribLocation(program, 'a_pos');
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
}
