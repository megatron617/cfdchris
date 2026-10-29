/**
 * TransferFunction — GPU texture that maps a scalar (0–1) to an RGBA colour.
 *
 * Color gradient and opacity mode are kept independent: pick any gradient,
 * pick any opacity curve, and set() composes them into a 256×1 RGBA32F
 * TEXTURE_2D that the ray march shader samples via vec2(scalar, 0.5).
 *
 * WebGL2 does not expose sampler1D, so we use TEXTURE_2D with height = 1.
 */
export class TransferFunction {
    /**
     * @param {WebGL2RenderingContext} gl
     * @param {number} [size=256]
     */
    constructor(gl, size = 256) {
        this.gl   = gl;
        this.size = size;
        this.texture = gl.createTexture();
        this._allocate();
        // Default: heat colours with sensitive opacity
        this.set(TransferFunction.gradients.heat, TransferFunction.opacityModes.sensitive);
    }

    /** Allocate/reset the 256×1 RGBA32F texture. */
    _allocate() {
        const gl = this.gl;
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, this.size, 1, 0, gl.RGBA, gl.FLOAT, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }

    /**
     * Compose a new LUT from independent gradient and opacity functions, then upload.
     * @param {function(number): [number,number,number]} colorGradientFn  t → [r,g,b] (each 0–1)
     * @param {function(number): number}                 opacityFn         t → alpha  (0–1)
     */
    set(colorGradientFn, opacityFn) {
        const data = new Float32Array(this.size * 4);
        for (let i = 0; i < this.size; i++) {
            const t       = i / (this.size - 1);
            const [r,g,b] = colorGradientFn(t);
            data[i * 4 + 0] = r;
            data[i * 4 + 1] = g;
            data[i * 4 + 2] = b;
            data[i * 4 + 3] = opacityFn(t);
        }
        this.upload(data);
    }

    /**
     * Low-level upload of a raw Float32Array (size×4 RGBA).
     * @param {Float32Array} rgbaFloat32Array
     */
    upload(rgbaFloat32Array) {
        const gl = this.gl;
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, this.size, 1, 0, gl.RGBA, gl.FLOAT, rgbaFloat32Array);
    }

    /**
     * Bind the LUT texture to the given texture unit.
     * @param {number} unit
     */
    bind(unit) {
        const gl = this.gl;
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
    }

    // ── Color gradient presets ───────────────────────────────────────────────
    // Each entry is a function  t (0–1) → [r, g, b]  (each 0–1)

    static gradients = {
        /** Black → red → yellow → white */
        heat: (t) => {
            if (t < 0.333) { const s = t / 0.333;             return [s,   0,   0  ]; }
            if (t < 0.667) { const s = (t - 0.333) / 0.334;  return [1,   s,   0  ]; }
            const s = (t - 0.667) / 0.333;                    return [1,   1,   s  ];
        },
        /** Black → blue → cyan → white */
        cool: (t) => {
            if (t < 0.333) { const s = t / 0.333;             return [0,   0,   s  ]; }
            if (t < 0.667) { const s = (t - 0.333) / 0.334;  return [0,   s,   1  ]; }
            const s = (t - 0.667) / 0.333;                    return [s,   1,   1  ];
        },
        /** Black → purple → orange → white */
        plasma: (t) => {
            if (t < 0.333) { const s = t / 0.333;             return [s*0.5, 0,     s  ]; }
            if (t < 0.667) { const s = (t - 0.333) / 0.334;  return [0.5+s*0.5, s*0.5, 1-s]; }
            const s = (t - 0.667) / 0.333;                    return [1,   0.5+s*0.5, s  ];
        },
        /** Greyscale ramp */
        grayscale: (t) => [t, t, t],
    };

    // ── Opacity mode presets ─────────────────────────────────────────────────
    // Each entry is a function  t (0–1) → alpha (0–1)

    static opacityModes = {
        /** Linear — neutral, proportional to density */
        linear:    (t) => t,
        /** Concave — reveals faint/thin regions */
        sensitive: (t) => Math.sqrt(t),
        /** Convex — suppresses noise, shows dense core */
        dense:     (t) => t * t,
        /** Cuts low-density haze entirely */
        threshold: (t) => t < 0.3 ? 0 : (t - 0.3) / 0.7,
    };
}
