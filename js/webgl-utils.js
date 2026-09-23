/**
 * WebGL utility functions and setup
 */

import { CONFIG } from './config.js';
import * as Shaders from './shaders3d.js';

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
        
        // Log 3D texture support
        console.log('WebGL2 3D textures: supported');
        console.log('Target grid resolution:', `${CONFIG.gridSize.x}×${CONFIG.gridSize.y}×${CONFIG.gridSize.z}`);
        console.log('Total voxels:', (CONFIG.gridSize.x * CONFIG.gridSize.y * CONFIG.gridSize.z / 1000000).toFixed(2) + 'M');

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

    createProgram(vertexShaderSource, fragmentShaderSource) {
        const gl = this.gl;
        const program = gl.createProgram();
        
        const vs = this.createShader(gl.VERTEX_SHADER, vertexShaderSource);
        const fs = this.createShader(gl.FRAGMENT_SHADER, fragmentShaderSource);
        
        if (!vs || !fs) {
            console.error('Failed to create shaders');
            return null;
        }
        
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
        console.log('Creating 3D shader programs...');
        
        const programs = {
            // Simulation programs (3D)
            advect3D: this.createProgram(Shaders.vertexShader3D, Shaders.advect3DFragmentShader),
            jacobi3D: this.createProgram(Shaders.vertexShader3D, Shaders.jacobi3DFragmentShader),
            divergence3D: this.createProgram(Shaders.vertexShader3D, Shaders.divergence3DFragmentShader),
            gradient3D: this.createProgram(Shaders.vertexShader3D, Shaders.gradient3DFragmentShader),
            splat3D: this.createProgram(Shaders.vertexShader3D, Shaders.splat3DFragmentShader),
            
            // Rendering programs
            slice3D: this.createProgram(Shaders.vertexShader, Shaders.slice3DFragmentShader),
            display: this.createProgram(Shaders.vertexShader, Shaders.displayFragmentShader),
            
            // Future: Ray marching (Phase 2)
            // rayMarch3D: this.createProgram(Shaders.vertexShader, Shaders.rayMarch3DFragmentShader),
        };
        
        // Verify all programs compiled successfully
        const programNames = Object.keys(programs);
        const validPrograms = programNames.filter(name => programs[name] !== null);
        
        console.log(`✓ Created ${validPrograms.length}/${programNames.length} shader programs`);
        
        if (validPrograms.length !== programNames.length) {
            const failed = programNames.filter(name => programs[name] === null);
            console.error('Failed to compile programs:', failed);
        }
        
        return programs;
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
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, CONFIG.gridSize.x, CONFIG.gridSize.y, 0, gl.RGBA, gl.FLOAT, null);
        
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

    createTexture3D(width, height, depth) {
        const gl = this.gl;
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_3D, tex);
        
        // Allocate 3D texture
        gl.texImage3D(
            gl.TEXTURE_3D,
            0,                  // mip level
            gl.RGBA32F,         // internal format
            width,
            height,
            depth,
            0,                  // border
            gl.RGBA,            // format
            gl.FLOAT,           // type
            null                // data (null = allocate but don't fill)
        );
        
        // Use LINEAR if supported, otherwise NEAREST
        const filterMode = this.floatLinear ? gl.LINEAR : gl.NEAREST;
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, filterMode);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, filterMode);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
        
        return tex;
    }

    createFBO3D() {
        const gl = this.gl;
        const { x, y, z } = CONFIG.gridSize;
        
        // Create 3D texture
        const tex = this.createTexture3D(x, y, z);
        
        // Create framebuffer (will attach layers individually when rendering)
        const fbo = gl.createFramebuffer();
        
        console.log(`Created 3D FBO: ${x}×${y}×${z} (${(x*y*z/1000000).toFixed(2)}M voxels)`);
        
        return { fbo, tex, width: x, height: y, depth: z };
    }

    attachTextureLayer(fbo, texture, layer) {
        const gl = this.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        
        // Attach specific layer of 3D texture to framebuffer
        gl.framebufferTextureLayer(
            gl.FRAMEBUFFER,
            gl.COLOR_ATTACHMENT0,
            texture,
            0,      // mip level
            layer   // layer index
        );
        
        // Verify framebuffer is complete
        const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        if (status !== gl.FRAMEBUFFER_COMPLETE) {
            console.error(`FBO incomplete for layer ${layer}:`, status);
            return false;
        }
        
        return true;
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

    createDoubleFBO3D() {
        return {
            fbo1: this.createFBO3D(),
            fbo2: this.createFBO3D(),
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
