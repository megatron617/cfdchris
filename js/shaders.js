/**
 * WebGL shader source code
 */

import { CONFIG } from './config.js';

export const vertexShader = `#version 300 es
    in vec2 a_pos;
    out vec2 v_uv;
    void main() {
        v_uv = a_pos * 0.5 + 0.5;
        gl_Position = vec4(a_pos, 0.0, 1.0);
    }`;

export const advectFragmentShader = `#version 300 es
    precision highp float;
    in vec2 v_uv;
    out vec4 outColor;
    uniform sampler2D u_velocity;
    uniform sampler2D u_source;
    uniform float u_dt;
    void main() {
        vec2 vel = texture(u_velocity, v_uv).xy;
        // Back-trace along velocity field
        vec2 pos = v_uv - u_dt * vel;
        outColor = texture(u_source, pos);
    }`;

export const jacobiFragmentShader = `#version 300 es
    precision highp float;
    in vec2 v_uv;
    out vec4 outColor;
    uniform sampler2D u_x;
    uniform sampler2D u_b;
    uniform float u_alpha;
    uniform float u_rBeta;
    void main() {
        vec2 px = vec2(1.0/${CONFIG.gridSize.x.toFixed(1)});
        vec4 xL = texture(u_x, v_uv - vec2(px.x, 0));
        vec4 xR = texture(u_x, v_uv + vec2(px.x, 0));
        vec4 xB = texture(u_x, v_uv - vec2(0, px.y));
        vec4 xT = texture(u_x, v_uv + vec2(0, px.y));
        vec4 bC = texture(u_b, v_uv);
        outColor = (xL + xR + xB + xT + u_alpha * bC) * u_rBeta;
    }`;

export const divergenceFragmentShader = `#version 300 es
    precision highp float;
    in vec2 v_uv;
    out vec4 outColor;
    uniform sampler2D u_velocity;
    void main() {
        vec2 px = vec2(1.0/${CONFIG.gridSize.x.toFixed(1)});
        vec2 vL = texture(u_velocity, v_uv - vec2(px.x, 0)).xy;
        vec2 vR = texture(u_velocity, v_uv + vec2(px.x, 0)).xy;
        vec2 vB = texture(u_velocity, v_uv - vec2(0, px.y)).xy;
        vec2 vT = texture(u_velocity, v_uv + vec2(0, px.y)).xy;
        float div = 0.5 * ((vR.x - vL.x) + (vT.y - vB.y));
        outColor = vec4(div, 0, 0, 1);
    }`;

export const gradientFragmentShader = `#version 300 es
    precision highp float;
    in vec2 v_uv;
    out vec4 outColor;
    uniform sampler2D u_pressure;
    uniform sampler2D u_velocity;
    void main() {
        vec2 px = vec2(1.0/${CONFIG.gridSize.x.toFixed(1)});
        float pL = texture(u_pressure, v_uv - vec2(px.x, 0)).x;
        float pR = texture(u_pressure, v_uv + vec2(px.x, 0)).x;
        float pB = texture(u_pressure, v_uv - vec2(0, px.y)).x;
        float pT = texture(u_pressure, v_uv + vec2(0, px.y)).x;
        vec2 vel = texture(u_velocity, v_uv).xy;
        vel -= 0.5 * vec2(pR - pL, pT - pB);
        outColor = vec4(vel, 0, 1);
    }`;

export const splatFragmentShader = `#version 300 es
    precision highp float;
    in vec2 v_uv;
    out vec4 outColor;
    uniform sampler2D u_field;
    uniform vec2 u_point;
    uniform vec3 u_value;
    uniform float u_radius;
    void main() {
        vec4 base = texture(u_field, v_uv);
        float d = distance(v_uv, u_point);
        float splat = exp(-d * d / (u_radius * u_radius));
        outColor = base + vec4(u_value * splat, 0);
    }`;

export const displayFragmentShader = `#version 300 es
    precision highp float;
    in vec2 v_uv;
    out vec4 outColor;
    uniform sampler2D u_field;
    void main() {
        vec4 texColor = texture(u_field, v_uv);
        outColor = vec4(texColor.rgb * ${CONFIG.colorBrightness.toFixed(1)}, 1.0);
    }`;
