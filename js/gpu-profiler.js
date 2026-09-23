/**
 * GPU Profiler - Hardware detection and timer query management
 */

import { CONFIG } from './config.js';

export class GPUProfiler {
    constructor(gl) {
        this.gl = gl;
        this.debugInfo = null;
        this.timerExt = null;
        this.queryPool = [];
        this.maxPoolSize = 50;
        
        this.init();
    }

    init() {
        // Get debug renderer info extension
        this.debugInfo = this.gl.getExtension('WEBGL_debug_renderer_info');
        
        // Try to get timer query extension for WebGL2
        this.timerExt = this.gl.getExtension('EXT_disjoint_timer_query_webgl2');
        
        if (this.timerExt) {
            console.log('✓ GPU timer queries available');
        } else {
            console.log('✗ GPU timer queries not available - using CPU timing fallback');
        }
    }

    /**
     * Detect if using hardware or software rendering
     */
    detectRenderingMode() {
        if (!this.debugInfo) {
            return {
                mode: 'unknown',
                confidence: 'low'
            };
        }

        const renderer = this.gl.getParameter(this.debugInfo.UNMASKED_RENDERER_WEBGL).toLowerCase();
        
        // Software rendering indicators
        const softwareIndicators = [
            'swiftshader',
            'llvmpipe',
            'software',
            'microsoft basic render',
            'gdi generic'
        ];

        const isSoftware = softwareIndicators.some(indicator => renderer.includes(indicator));
        
        return {
            mode: isSoftware ? 'software' : 'hardware',
            confidence: 'high',
            renderer: renderer
        };
    }

    /**
     * Get comprehensive GPU information
     */
    getGPUInfo() {
        const gl = this.gl;
        const info = {
            vendor: 'Unknown',
            renderer: 'Unknown',
            webglVersion: 'WebGL 2.0',
            maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
            maxViewportDims: gl.getParameter(gl.MAX_VIEWPORT_DIMS),
            extensions: {
                floatTextures: !!gl.getExtension('EXT_color_buffer_float'),
                floatLinear: !!gl.getExtension('OES_texture_float_linear'),
                timerQuery: !!this.timerExt,
                debugRenderer: !!this.debugInfo
            }
        };

        if (this.debugInfo) {
            info.vendor = gl.getParameter(this.debugInfo.UNMASKED_VENDOR_WEBGL);
            info.renderer = gl.getParameter(this.debugInfo.UNMASKED_RENDERER_WEBGL);
        } else {
            info.vendor = gl.getParameter(gl.VENDOR);
            info.renderer = gl.getParameter(gl.RENDERER);
        }

        return info;
    }

    /**
     * Calculate estimated GPU memory usage
     */
    getMemoryEstimate() {
        const gl = this.gl;
        const gridSize = CONFIG.gridSize;
        
        // RGBA32F = 4 channels × 4 bytes = 16 bytes per voxel
        const bytesPerVoxel = 16;
        
        // For 3D textures
        const textureSize = gridSize.x * gridSize.y * gridSize.z * bytesPerVoxel;
        
        // Count textures:
        // - velocity double buffer: 2 textures
        // - dye double buffer: 2 textures
        // - pressure double buffer: 2 textures
        // - divergence: 1 texture
        const textureCount = 7;
        
        const totalBytes = textureSize * textureCount;
        const totalMB = (totalBytes / (1024 * 1024)).toFixed(2);
        
        return {
            textureCount,
            textureSize: textureSize,
            totalBytes: totalBytes,
            totalMB: totalMB,
            gridSize: `${gridSize}×${gridSize}`
        };
    }

    /**
     * Check if GPU timing is available
     */
    isTimerAvailable() {
        return !!this.timerExt;
    }

    /**
     * Create a timer query (reuse from pool if available)
     */
    createTimerQuery() {
        if (!this.timerExt) {
            return null;
        }

        let query;
        if (this.queryPool.length > 0) {
            query = this.queryPool.pop();
        } else {
            query = this.gl.createQuery();
        }

        return query;
    }

    /**
     * Begin a timer query
     */
    beginQuery(query) {
        if (!this.timerExt || !query) {
            return false;
        }

        this.gl.beginQuery(this.timerExt.TIME_ELAPSED_EXT, query);
        return true;
    }

    /**
     * End a timer query
     */
    endQuery() {
        if (!this.timerExt) {
            return false;
        }

        this.gl.endQuery(this.timerExt.TIME_ELAPSED_EXT);
        return true;
    }

    /**
     * Check if query result is available
     */
    isQueryResultAvailable(query) {
        if (!this.timerExt || !query) {
            return false;
        }

        return this.gl.getQueryParameter(query, this.gl.QUERY_RESULT_AVAILABLE);
    }

    /**
     * Get query result in milliseconds
     */
    getQueryResult(query) {
        if (!this.timerExt || !query) {
            return null;
        }

        // Check for disjoint operation (GPU was reset)
        const disjoint = this.gl.getParameter(this.timerExt.GPU_DISJOINT_EXT);
        if (disjoint) {
            // Return query to pool and return null
            this.returnQuery(query);
            return null;
        }

        if (!this.isQueryResultAvailable(query)) {
            return null;
        }

        // Get result in nanoseconds, convert to milliseconds
        const timeNs = this.gl.getQueryParameter(query, this.gl.QUERY_RESULT);
        const timeMs = timeNs / 1000000;

        // Return query to pool for reuse
        this.returnQuery(query);

        return timeMs;
    }

    /**
     * Return a query to the pool for reuse
     */
    returnQuery(query) {
        if (query && this.queryPool.length < this.maxPoolSize) {
            this.queryPool.push(query);
        }
    }

    /**
     * Get diagnostic information
     */
    getDiagnostics() {
        const gl = this.gl;
        const renderMode = this.detectRenderingMode();
        const gpuInfo = this.getGPUInfo();
        const memoryInfo = this.getMemoryEstimate();

        return {
            renderMode,
            gpuInfo,
            memoryInfo,
            capabilities: {
                webgl2: true,
                timerQueries: this.isTimerAvailable(),
                floatTextures: gpuInfo.extensions.floatTextures,
                floatLinear: gpuInfo.extensions.floatLinear
            }
        };
    }
}
