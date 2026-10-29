/**
 * Mouse, touch and keyboard input handling.
 *
 * Supports two camera modes (orbit / free-flight) switched by the F key.
 * The active camera reference (this.camera) always points to the live controller.
 * Set this.freeCamera and this.onCameraSwitch from main.js after construction.
 */

import { ColorMode, CURRENT_COLOR_MODE, CONFIG } from './config.js';
import { Raycaster3D } from './raycaster3d.js';
import { OrbitController, FreeFlightController } from './camera3d.js';

export class InputHandler {
    constructor(canvas, simulation, renderer = null, camera = null) {
        this.canvas      = canvas;
        this.simulation  = simulation;
        this.renderer    = renderer;
        this.camera      = camera;        // Active camera (starts as orbit)
        this.orbitCamera = camera;        // Orbit controller reference

        // Set by main.js after construction:
        this.freeCamera       = null;     // FreeFlightController instance
        this.onCameraSwitch   = null;     // callback(newCamera) when mode toggles

        this.mouseDown      = false;
        this.rightMouseDown = false;
        this.mouseX = 0;
        this.mouseY = 0;
        this.prevX  = 0;
        this.prevY  = 0;

        // Key state map (populated by keydown/keyup listeners)
        this.keys = {};

        // Raycaster (for 3D force injection in orbit mode)
        this.raycaster    = camera ? new Raycaster3D(camera) : null;
        this.lastRaycast  = null;

        this.setupEventListeners();
    }

    setupEventListeners() {
        this.canvas.addEventListener('mousedown',    (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove',    (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup',      (e) => this.onMouseUp(e));
        this.canvas.addEventListener('mouseleave',   ()  => this.onMouseLeave());
        this.canvas.addEventListener('contextmenu',  (e) => e.preventDefault());
        this.canvas.addEventListener('wheel',        (e) => this.onWheel(e), { passive: false });

        // Touch
        this.canvas.addEventListener('touchstart', (e) => this.onTouchStart(e));
        this.canvas.addEventListener('touchmove',  (e) => this.onTouchMove(e));
        this.canvas.addEventListener('touchend',   ()  => this.onMouseLeave());

        // Keyboard — track state AND handle shortcuts
        document.addEventListener('keydown', (e) => {
            this.keys[e.key] = true;
            this.onKeyDown(e);
        });
        document.addEventListener('keyup', (e) => {
            this.keys[e.key] = false;
        });
    }

    /**
     * Per-frame update — drives free-flight movement.
     * Call this each frame from main.js with the frame delta time (ms).
     * @param {number} dt   Milliseconds since last frame
     */
    update(dt) {
        if (this.camera && typeof this.camera.update === 'function') {
            this.camera.update(dt, this.keys);
        }
    }

    getCanvasPosition(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x:  (clientX - rect.left)  / rect.width,
            y: 1.0 - (clientY - rect.top) / rect.height
        };
    }

    onMouseDown(e) {
        if      (e.button === 0) this.mouseDown      = true;
        else if (e.button === 2) this.rightMouseDown = true;

        const pos = this.getCanvasPosition(e.clientX, e.clientY);
        this.prevX = this.mouseX = pos.x;
        this.prevY = this.mouseY = pos.y;

        if (e.button === 0) this.applyForce();
    }

    onMouseMove(e) {
        this.prevX = this.mouseX;
        this.prevY = this.mouseY;

        const pos = this.getCanvasPosition(e.clientX, e.clientY);
        this.mouseX = pos.x;
        this.mouseY = pos.y;

        if (this.mouseDown) {
            this.applyForce();
        } else if (this.rightMouseDown && this.camera) {
            // Route drag to whichever camera controller is active
            const dx = (this.mouseX - this.prevX) * this.canvas.width;
            const dy = (this.mouseY - this.prevY) * this.canvas.height;

            if (typeof this.camera.onMouseMove === 'function') {
                // Free-flight: mouse look
                this.camera.onMouseMove(dx, dy);
            } else if (typeof this.camera.rotate === 'function') {
                // Orbit: trackball rotate
                this.camera.rotate(dx, dy);
            }
        }
    }

    onMouseUp(e) {
        if      (e.button === 0) this.mouseDown      = false;
        else if (e.button === 2) this.rightMouseDown = false;
    }

    onMouseLeave() {
        this.mouseDown      = false;
        this.rightMouseDown = false;
    }

    onWheel(e) {
        e.preventDefault();
        // Only orbit camera has zoom; free-flight ignores wheel
        if (this.camera && typeof this.camera.zoom === 'function') {
            this.camera.zoom(e.deltaY * 0.01);
        }
    }

    onKeyDown(e) {
        if (this.isTyping()) return;

        switch (e.key) {
            case 'r': case 'R':
                if (this.camera && typeof this.camera.reset === 'function') {
                    this.camera.reset();
                }
                break;
            case 'f': case 'F':
                this.toggleCameraMode();
                break;
        }
    }

    /**
     * Toggle between orbit and free-flight camera modes.
     * Copies position so the view doesn't jump.
     */
    toggleCameraMode() {
        if (!this.freeCamera) return;

        if (CONFIG.cameraMode === 'orbit') {
            // → free-flight: copy current orbit position/direction
            this.freeCamera.fromOrbit(this.orbitCamera);
            this.camera = this.freeCamera;
            CONFIG.cameraMode = 'freefly';
        } else {
            // → orbit: set target from free-flight look-direction
            const fwdTarget = this.freeCamera.toOrbitTarget();
            this.orbitCamera.target = fwdTarget;
            this.orbitCamera.updatePosition();
            this.camera = this.orbitCamera;
            CONFIG.cameraMode = 'orbit';
        }

        if (this.onCameraSwitch) this.onCameraSwitch(this.camera);
    }

    isTyping() {
        const el = document.activeElement;
        return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
    }

    // Touch events
    onTouchStart(e) {
        e.preventDefault();
        const touch = e.touches[0];
        this.mouseDown = true;
        const pos = this.getCanvasPosition(touch.clientX, touch.clientY);
        this.prevX = this.mouseX = pos.x;
        this.prevY = this.mouseY = pos.y;
    }

    onTouchMove(e) {
        e.preventDefault();
        if (!this.mouseDown) return;
        const touch = e.touches[0];
        this.prevX = this.mouseX;
        this.prevY = this.mouseY;
        const pos = this.getCanvasPosition(touch.clientX, touch.clientY);
        this.mouseX = pos.x;
        this.mouseY = pos.y;
        this.applyForce();
    }

    applyForce() {
        const rawDx = (this.mouseX - this.prevX) * this.simulation.params.forceMultiplier;
        const rawDy = (this.mouseY - this.prevY) * this.simulation.params.forceMultiplier;

        let x, y, z;     // 3D injection position in [0,1]³ texture space
        let vx, vy, vz;  // 3D velocity for the splat

        if (CONFIG.renderMode === 'raymarch' && this.raycaster && this.camera) {
            // ── Ray-march mode ───────────────────────────────────────────────
            // Cast a ray from the active camera through the mouse position.
            // Always pass the live camera so orbit↔free-flight switches are
            // picked up instantly with no stored-reference problem.
            const result = this.raycaster.castRay(this.mouseX, this.mouseY, this.camera);
            this.lastRaycast = result;

            if (!result.hit) return;  // cursor not over the volume — skip injection

            [x, y, z] = result.point;  // already in [0,1]³ texture space

            // Map screen-space drag delta to world-space velocity by projecting
            // through the camera's right (col 0) and up (col 1) axes from V.
            // Column-major view matrix: right = [V[0], V[4], V[8]],
            //                          up    = [V[1], V[5], V[9]]
            const V  = this.camera.getViewMatrix();
            const rx = V[0], ry = V[4], rz = V[8];  // camera right in world space
            const ux = V[1], uy = V[5], uz = V[9];  // camera up    in world space
            vx = rawDx * rx + rawDy * ux;
            vy = rawDx * ry + rawDy * uy;
            vz = rawDx * rz + rawDy * uz;

        } else {
            // ── Slice mode (or no camera) ────────────────────────────────────
            // Raw canvas coords map directly to texture coords when the camera
            // faces straight down the Z axis (the default view).
            x  = this.mouseX;
            y  = this.mouseY;
            z  = this.renderer?.sliceDepth ?? 0.5;
            vx = rawDx;
            vy = rawDy;
            vz = 0.0;
        }

        const hasMotion = Math.abs(vx) > 0.001 || Math.abs(vy) > 0.001 || Math.abs(vz) > 0.001;
        if (hasMotion) {
            this.simulation.splat3D(this.simulation.velocity, x, y, z, vx, vy, vz);
        }

        const color = this.getColor(vx, vy);
        this.simulation.splat3D(this.simulation.dye, x, y, z, color.r, color.g, color.b);
    }

    getColor(dx, dy) {
        switch (CURRENT_COLOR_MODE) {
            case ColorMode.DIRECTION:
                return {
                    r: Math.abs(dx) * 1.0,
                    g: Math.abs(dy) * 1.0,
                    b: (Math.abs(dx) + Math.abs(dy)) * 0.5
                };
            case ColorMode.RAINBOW: {
                const angle = Math.atan2(dy, dx) / (Math.PI * 2) + 0.5;
                return {
                    r: Math.sin(angle * Math.PI * 2) * 0.5 + 0.5,
                    g: Math.sin((angle + 0.33) * Math.PI * 2) * 0.5 + 0.5,
                    b: Math.sin((angle + 0.66) * Math.PI * 2) * 0.5 + 0.5
                };
            }
            case ColorMode.RANDOM:
            default:
                return {
                    r: Math.random() * 0.5,
                    g: Math.random() * 0.5,
                    b: Math.random() * 0.5
                };
        }
    }
}
