/**
 * 3D Camera system with orbit and free-flight modes
 */

import { CONFIG } from './config.js';

/**
 * Base Camera class
 */
export class Camera3D {
    constructor() {
        this.position = [0, 0, CONFIG.cameraDistance];
        this.target = [0.5, 0.5, 0.5];  // Center of volume (0-1 normalized)
        this.up = [0, 1, 0];
        this.fov = CONFIG.cameraFOV;
        this.aspect = 1.0;
        this.near = 0.1;
        this.far = 10.0;
    }

    /**
     * Get view matrix (world to camera space)
     */
    getViewMatrix() {
        return this.lookAt(this.position, this.target, this.up);
    }

    /**
     * Get projection matrix (camera to clip space)
     */
    getProjectionMatrix() {
        return this.perspective(this.fov, this.aspect, this.near, this.far);
    }

    /**
     * Set aspect ratio
     */
    setAspect(aspect) {
        this.aspect = aspect;
    }

    /**
     * lookAt matrix (view matrix)
     */
    lookAt(eye, center, up) {
        const z = this.normalize(this.subtract(eye, center));
        const x = this.normalize(this.cross(up, z));
        const y = this.cross(z, x);

        return [
            x[0], y[0], z[0], 0,
            x[1], y[1], z[1], 0,
            x[2], y[2], z[2], 0,
            -this.dot(x, eye), -this.dot(y, eye), -this.dot(z, eye), 1
        ];
    }

    /**
     * Perspective projection matrix
     */
    perspective(fovy, aspect, near, far) {
        const f = 1.0 / Math.tan(fovy * Math.PI / 360.0);
        const rangeInv = 1.0 / (near - far);

        return [
            f / aspect, 0, 0, 0,
            0, f, 0, 0,
            0, 0, (near + far) * rangeInv, -1,
            0, 0, near * far * rangeInv * 2, 0
        ];
    }

    // Vector math helpers
    subtract(a, b) {
        return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    }

    cross(a, b) {
        return [
            a[1] * b[2] - a[2] * b[1],
            a[2] * b[0] - a[0] * b[2],
            a[0] * b[1] - a[1] * b[0]
        ];
    }

    dot(a, b) {
        return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    }

    length(v) {
        return Math.sqrt(this.dot(v, v));
    }

    normalize(v) {
        const len = this.length(v);
        return len > 0 ? [v[0] / len, v[1] / len, v[2] / len] : [0, 0, 0];
    }
}

/**
 * Orbit Camera Controller (Trackball)
 * Rotate around a center point
 */
export class OrbitController extends Camera3D {
    constructor() {
        super();
        
        // Orbit parameters (spherical coordinates)
        this.azimuth = 0;       // Horizontal angle (radians)
        this.elevation = 0;     // Vertical angle (radians)
        this.distance = CONFIG.cameraDistance;
        
        // Limits
        this.minDistance = 1.0;
        this.maxDistance = 8.0;
        this.minElevation = -Math.PI / 2 + 0.01;  // Prevent gimbal lock
        this.maxElevation = Math.PI / 2 - 0.01;
        
        // Sensitivity
        this.rotateSensitivity = 0.005;
        this.zoomSensitivity = 0.1;
        
        this.updatePosition();
    }

    /**
     * Update camera position from spherical coordinates
     */
    updatePosition() {
        // Convert spherical to Cartesian coordinates
        const x = this.distance * Math.cos(this.elevation) * Math.sin(this.azimuth);
        const y = this.distance * Math.sin(this.elevation);
        const z = this.distance * Math.cos(this.elevation) * Math.cos(this.azimuth);
        
        // Position relative to target
        this.position = [
            this.target[0] + x,
            this.target[1] + y,
            this.target[2] + z
        ];
    }

    /**
     * Rotate camera (from mouse drag delta)
     */
    rotate(deltaX, deltaY) {
        this.azimuth -= deltaX * this.rotateSensitivity;
        this.elevation -= deltaY * this.rotateSensitivity;
        
        // Clamp elevation to prevent flipping
        this.elevation = Math.max(this.minElevation, Math.min(this.maxElevation, this.elevation));
        
        this.updatePosition();
    }

    /**
     * Zoom camera (from mouse wheel delta)
     */
    zoom(delta) {
        this.distance += delta * this.zoomSensitivity;
        this.distance = Math.max(this.minDistance, Math.min(this.maxDistance, this.distance));
        
        this.updatePosition();
    }

    /**
     * Reset camera to default position
     */
    reset() {
        this.azimuth = 0;
        this.elevation = 0;
        this.distance = CONFIG.cameraDistance;
        this.target = [0.5, 0.5, 0.5];
        this.updatePosition();
        
        console.log('Camera reset to default position');
    }

    /**
     * Get camera info for debugging
     */
    getInfo() {
        return {
            type: 'orbit',
            position: this.position.map(v => v.toFixed(2)),
            target: this.target.map(v => v.toFixed(2)),
            azimuth: (this.azimuth * 180 / Math.PI).toFixed(1) + '°',
            elevation: (this.elevation * 180 / Math.PI).toFixed(1) + '°',
            distance: this.distance.toFixed(2)
        };
    }
}

/**
 * Free-Flight Camera Controller (FPS-style)
 * WASD + QE movement, mouse-look via yaw/pitch.
 */
export class FreeFlightController extends Camera3D {
    constructor() {
        super();
        // Start just outside the front face of the unit cube, centred
        this.position = [0.5, 0.5, -0.5];
        this.yaw   = 0;    // horizontal rotation (radians)
        this.pitch = 0;    // vertical   rotation (radians), clamped ±89°
        this.speed = 0.005; // world units per millisecond

        // Mouse-look sensitivity (radians per pixel delta)
        this.mouseSensitivity = 0.003;
    }

    /** World-space direction the camera is looking. */
    getForward() {
        const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
        const cy = Math.cos(this.yaw),   sy = Math.sin(this.yaw);
        return [cp * sy, sp, cp * cy];
    }

    /** World-space right vector (independent of pitch — always horizontal). */
    getRight() {
        // right = cross(worldUp, forward_horizontal)
        return [Math.cos(this.yaw), 0, -Math.sin(this.yaw)];
    }

    getViewMatrix() {
        const fwd    = this.getForward();
        const target = [
            this.position[0] + fwd[0],
            this.position[1] + fwd[1],
            this.position[2] + fwd[2]
        ];
        return this.lookAt(this.position, target, this.up);
    }

    getProjectionMatrix() {
        return this.perspective(this.fov, this.aspect, this.near, this.far);
    }

    /**
     * Per-frame movement update.
     * @param {number} dt   Delta time in milliseconds
     * @param {object} keys Key-state map from InputHandler
     */
    update(dt, keys) {
        let speed = this.speed;
        if (keys['Shift'])   speed *= 2.0;
        if (keys['Control']) speed *= 0.25;

        const fwd   = this.getForward();
        const right = this.getRight();
        const move  = [0, 0, 0];

        if (keys['w'] || keys['W']) { move[0] += fwd[0]; move[1] += fwd[1]; move[2] += fwd[2]; }
        if (keys['s'] || keys['S']) { move[0] -= fwd[0]; move[1] -= fwd[1]; move[2] -= fwd[2]; }
        if (keys['a'] || keys['A']) { move[0] -= right[0]; move[2] -= right[2]; }
        if (keys['d'] || keys['D']) { move[0] += right[0]; move[2] += right[2]; }
        if (keys['q'] || keys['Q']) move[1] += 1;
        if (keys['e'] || keys['E']) move[1] -= 1;

        const len = Math.sqrt(move[0]*move[0] + move[1]*move[1] + move[2]*move[2]);
        if (len > 0) {
            const s = speed * dt / len;
            this.position[0] += move[0] * s;
            this.position[1] += move[1] * s;
            this.position[2] += move[2] * s;
        }
    }

    /**
     * Mouse look — called on right-click drag.
     * @param {number} dx  Pixel delta X (right = positive)
     * @param {number} dy  Pixel delta Y (up = positive)
     */
    onMouseMove(dx, dy) {
        this.yaw   += dx * this.mouseSensitivity;
        this.pitch += dy * this.mouseSensitivity;   // positive dy = dragging down = looks up
        const limit = 89 * Math.PI / 180;
        this.pitch = Math.max(-limit, Math.min(limit, this.pitch));
    }

    /**
     * Copy position and look-direction from an OrbitController so the view
     * doesn't jump on switch.
     * @param {OrbitController} orbit
     */
    fromOrbit(orbit) {
        this.position = [...orbit.position];
        const dx = orbit.target[0] - orbit.position[0];
        const dy = orbit.target[1] - orbit.position[1];
        const dz = orbit.target[2] - orbit.position[2];
        const len = Math.sqrt(dx*dx + dy*dy + dz*dz);
        if (len > 0) {
            this.yaw   = Math.atan2(dx / len, dz / len);
            this.pitch = Math.asin(Math.max(-1, Math.min(1, dy / len)));
        }
    }

    /**
     * Returns a world-space point one unit ahead along the look-direction.
     * Used to seed the orbit camera's target when switching back.
     */
    toOrbitTarget() {
        const fwd = this.getForward();
        return [
            this.position[0] + fwd[0],
            this.position[1] + fwd[1],
            this.position[2] + fwd[2]
        ];
    }

    reset() {
        this.position = [0.5, 0.5, -0.5];
        this.yaw   = 0;
        this.pitch = 0;
    }

    getInfo() {
        return {
            type: 'freefly',
            x:     this.position[0].toFixed(2),
            y:     this.position[1].toFixed(2),
            z:     this.position[2].toFixed(2),
            yaw:   (this.yaw   * 180 / Math.PI).toFixed(1) + '°',
            pitch: (this.pitch * 180 / Math.PI).toFixed(1) + '°'
        };
    }
}
