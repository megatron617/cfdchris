/**
 * Mouse and touch input handling
 */

import { ColorMode, CURRENT_COLOR_MODE } from './config.js';

export class InputHandler {
    constructor(canvas, simulation, renderer = null, camera = null) {
        this.canvas = canvas;
        this.simulation = simulation;
        this.renderer = renderer;  // Optional: for getting current slice depth
        this.camera = camera;      // Optional: for camera controls
        this.mouseDown = false;
        this.rightMouseDown = false;  // For camera rotation
        this.mouseX = 0;
        this.mouseY = 0;
        this.prevX = 0;
        this.prevY = 0;
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('mouseleave', () => this.onMouseLeave());
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());  // Prevent right-click menu
        this.canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
        
        // Touch support
        this.canvas.addEventListener('touchstart', (e) => this.onTouchStart(e));
        this.canvas.addEventListener('touchmove', (e) => this.onTouchMove(e));
        this.canvas.addEventListener('touchend', () => this.onMouseLeave());
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
    }

    getCanvasPosition(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (clientX - rect.left) / rect.width;
        const y = 1.0 - (clientY - rect.top) / rect.height;
        return { x, y };
    }

    onMouseDown(e) {
        if (e.button === 0) {  // Left click - fluid interaction
            this.mouseDown = true;
        } else if (e.button === 2) {  // Right click - camera rotation
            this.rightMouseDown = true;
        }
        
        const pos = this.getCanvasPosition(e.clientX, e.clientY);
        this.prevX = this.mouseX = pos.x;
        this.prevY = this.mouseY = pos.y;
    }

    onMouseMove(e) {
        this.prevX = this.mouseX;
        this.prevY = this.mouseY;
        
        const pos = this.getCanvasPosition(e.clientX, e.clientY);
        this.mouseX = pos.x;
        this.mouseY = pos.y;
        
        if (this.mouseDown) {
            // Left mouse - apply fluid force
            this.applyForce();
        } else if (this.rightMouseDown && this.camera) {
            // Right mouse - rotate camera
            const deltaX = (this.mouseX - this.prevX) * this.canvas.width;
            const deltaY = (this.mouseY - this.prevY) * this.canvas.height;
            this.camera.rotate(deltaX, deltaY);
        }
    }
    
    onMouseUp(e) {
        if (e.button === 0) {
            this.mouseDown = false;
        } else if (e.button === 2) {
            this.rightMouseDown = false;
        }
    }
    
    onMouseLeave() {
        this.mouseDown = false;
        this.rightMouseDown = false;
    }
    
    onWheel(e) {
        e.preventDefault();
        if (this.camera) {
            // Zoom camera
            this.camera.zoom(e.deltaY * 0.01);
        }
    }
    
    onKeyDown(e) {
        // Camera reset (R key)
        if (e.key === 'r' || e.key === 'R') {
            if (this.camera && !this.isTyping()) {
                this.camera.reset();
            }
        }
    }
    
    isTyping() {
        const active = document.activeElement;
        return active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA');
    }

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
        if (this.mouseDown) {
            const touch = e.touches[0];
            this.prevX = this.mouseX;
            this.prevY = this.mouseY;
            
            const pos = this.getCanvasPosition(touch.clientX, touch.clientY);
            this.mouseX = pos.x;
            this.mouseY = pos.y;
            
            this.applyForce();
        }
    }

    applyForce() {
        const dx = (this.mouseX - this.prevX) * this.simulation.params.forceMultiplier;
        const dy = (this.mouseY - this.prevY) * this.simulation.params.forceMultiplier;
        
        // Inject at current slice depth if renderer is available
        // Otherwise default to center (z = 0.5)
        const z = this.renderer?.sliceDepth ?? 0.5;
        const dz = 0.0;  // No Z-velocity for now (Task 6 will add this)
        
        // Add velocity (3D splat)
        this.simulation.splat3D(this.simulation.velocity, this.mouseX, this.mouseY, z, dx, dy, dz);
        
        // Add dye color (3D splat)
        const color = this.getColor(dx, dy);
        this.simulation.splat3D(this.simulation.dye, this.mouseX, this.mouseY, z, color.r, color.g, color.b);
    }

    getColor(dx, dy) {
        switch (CURRENT_COLOR_MODE) {
            case ColorMode.DIRECTION:
                // Direction-based colors
                return {
                    r: Math.abs(dx) * 1.0,
                    g: Math.abs(dy) * 1.0,
                    b: (Math.abs(dx) + Math.abs(dy)) * 0.5
                };
            
            case ColorMode.RAINBOW:
                // Rainbow based on angle
                const angle = Math.atan2(dy, dx) / (Math.PI * 2) + 0.5;
                return {
                    r: Math.sin(angle * Math.PI * 2) * 0.5 + 0.5,
                    g: Math.sin((angle + 0.33) * Math.PI * 2) * 0.5 + 0.5,
                    b: Math.sin((angle + 0.66) * Math.PI * 2) * 0.5 + 0.5
                };
            
            case ColorMode.RANDOM:
            default:
                // Random vibrant colors
                return {
                    r: Math.random() * 0.5,
                    g: Math.random() * 0.5,
                    b: Math.random() * 0.5
                };
        }
    }
}
