/**
 * Mouse and touch input handling
 */

import { ColorMode, CURRENT_COLOR_MODE } from './config.js';

export class InputHandler {
    constructor(canvas, simulation) {
        this.canvas = canvas;
        this.simulation = simulation;
        this.mouseDown = false;
        this.mouseX = 0;
        this.mouseY = 0;
        this.prevX = 0;
        this.prevY = 0;
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', () => this.onMouseUp());
        this.canvas.addEventListener('mouseleave', () => this.onMouseUp());
        
        // Touch support
        this.canvas.addEventListener('touchstart', (e) => this.onTouchStart(e));
        this.canvas.addEventListener('touchmove', (e) => this.onTouchMove(e));
        this.canvas.addEventListener('touchend', () => this.onMouseUp());
    }

    getCanvasPosition(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (clientX - rect.left) / rect.width;
        const y = 1.0 - (clientY - rect.top) / rect.height;
        return { x, y };
    }

    onMouseDown(e) {
        this.mouseDown = true;
        const pos = this.getCanvasPosition(e.clientX, e.clientY);
        this.prevX = this.mouseX = pos.x;
        this.prevY = this.mouseY = pos.y;
    }

    onMouseMove(e) {
        if (this.mouseDown) {
            this.prevX = this.mouseX;
            this.prevY = this.mouseY;
            
            const pos = this.getCanvasPosition(e.clientX, e.clientY);
            this.mouseX = pos.x;
            this.mouseY = pos.y;
            
            this.applyForce();
        }
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

    onMouseUp() {
        this.mouseDown = false;
    }

    applyForce() {
        const dx = (this.mouseX - this.prevX) * this.simulation.params.forceMultiplier;
        const dy = (this.mouseY - this.prevY) * this.simulation.params.forceMultiplier;
        
        // Add velocity
        this.simulation.splat(this.simulation.velocity, this.mouseX, this.mouseY, dx, dy, 0);
        
        // Add dye color
        const color = this.getColor(dx, dy);
        this.simulation.splat(this.simulation.dye, this.mouseX, this.mouseY, color.r, color.g, color.b);
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
