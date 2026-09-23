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
        this.elevation += deltaY * this.rotateSensitivity;
        
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
 * For Task 10 - stub for now
 */
export class FreeFlightController extends Camera3D {
    constructor() {
        super();
        console.log('FreeFlightController created (Task 10 - not yet implemented)');
    }

    // TODO: Task 10 implementation
    // - WASD movement
    // - Mouse look
    // - Q/E up/down
}
