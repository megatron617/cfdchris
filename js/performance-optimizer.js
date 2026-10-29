/**
 * Performance Optimization System
 * Monitors FPS and automatically adjusts quality settings
 */

import { CONFIG } from './config.js';

export class PerformanceOptimizer {
    constructor(simulation, performanceMonitor) {
        this.simulation = simulation;
        this.performanceMonitor = performanceMonitor;
        
        // Performance targets
        this.targetFPS = 30;
        this.optimalFPS = 60;
        this.criticalFPS = 15;
        
        // Auto-optimization state
        this.autoOptimize = false;
        this.lastOptimizationTime = 0;
        this.optimizationCooldown = 5000;  // 5 seconds between adjustments
        
        // Preset configurations (calibrated for optimized renderer on RTX 4060-class GPUs)
        this.presets = {
            ultra: {
                name: 'Ultra',
                iterations: 40,
                velocityDissipation: 0.99,
                dyeDissipation: 0.99,
                description: 'Maximum quality'
            },
            high: {
                name: 'High',
                iterations: 30,
                velocityDissipation: 0.98,
                dyeDissipation: 0.98,
                description: 'High quality'
            },
            medium: {
                name: 'Medium',
                iterations: 20,
                velocityDissipation: 0.98,
                dyeDissipation: 0.98,
                description: 'Balanced (default)'
            },
            low: {
                name: 'Low',
                iterations: 10,
                velocityDissipation: 0.97,
                dyeDissipation: 0.97,
                description: 'Performance focused'
            },
            potato: {
                name: 'Potato',
                iterations: 5,
                velocityDissipation: 0.96,
                dyeDissipation: 0.96,
                description: 'Maximum FPS'
            }
        };
        
        this.currentPreset = 'medium';
        
        console.log('PerformanceOptimizer initialized');
        console.log(`  Target FPS: ${this.targetFPS}`);
        console.log(`  Optimal FPS: ${this.optimalFPS}`);
    }

    /**
     * Update performance monitoring (call each frame)
     */
    update() {
        if (!this.autoOptimize) return;
        
        const now = performance.now();
        if (now - this.lastOptimizationTime < this.optimizationCooldown) {
            return;  // Still in cooldown
        }
        
        const fps = this.performanceMonitor.getCurrentFPS();
        
        // Auto-adjust if performance is poor
        if (fps < this.targetFPS && fps > 0) {
            this.autoReduceQuality();
            this.lastOptimizationTime = now;
        } else if (fps > this.optimalFPS) {
            // Could increase quality, but let's be conservative
            // this.autoIncreaseQuality();
            // this.lastOptimizationTime = now;
        }
    }

    /**
     * Automatically reduce quality to improve FPS.
     * Priority: 1) reduce ray march steps, 2) reduce Jacobi iterations.
     */
    autoReduceQuality() {
        // Step 1 — reduce ray march step count before touching Jacobi
        if (CONFIG.renderMode === 'raymarch') {
            const stepLadder = [256, 192, 128, 96, 64];
            const currentSteps = CONFIG.rayMarchSteps;
            const currentIdx = stepLadder.indexOf(
                stepLadder.reduce((prev, val) => Math.abs(val - currentSteps) < Math.abs(prev - currentSteps) ? val : prev)
            );
            if (currentIdx < stepLadder.length - 1) {
                const newSteps = stepLadder[currentIdx + 1];
                CONFIG.rayMarchSteps = newSteps;
                console.log(`⚡ Auto-optimization: Reduced ray march steps ${currentSteps} → ${newSteps}`);
                this.showOptimizationNotice(`Reduced ray march steps to ${newSteps}`);
                return;
            }
        }

        // Step 2 — reduce Jacobi iterations
        const currentIterations = this.simulation.params.iterations;
        if (currentIterations > 3) {
            const newIterations = Math.max(3, currentIterations - 2);
            this.simulation.params.iterations = newIterations;
            console.log(`⚡ Auto-optimization: Reduced iterations ${currentIterations} → ${newIterations}`);
            this.showOptimizationNotice(`Reduced iterations to ${newIterations} for better FPS`);
        }
    }

    /**
     * Automatically increase quality when FPS is good
     */
    autoIncreaseQuality() {
        const currentIterations = this.simulation.params.iterations;
        
        if (currentIterations < 40) {
            const newIterations = Math.min(40, currentIterations + 5);
            this.simulation.params.iterations = newIterations;
            
            console.log(`⚡ Auto-optimization: Increased iterations ${currentIterations} → ${newIterations}`);
        }
    }

    /**
     * Apply a quality preset
     */
    applyPreset(presetName) {
        const preset = this.presets[presetName];
        if (!preset) {
            console.warn(`Unknown preset: ${presetName}`);
            return;
        }
        
        // Apply preset settings
        this.simulation.params.iterations = preset.iterations;
        this.simulation.params.velocityDissipation = preset.velocityDissipation;
        this.simulation.params.dyeDissipation = preset.dyeDissipation;
        
        this.currentPreset = presetName;
        
        console.log(`Applied preset: ${preset.name}`);
        console.log(`  Iterations: ${preset.iterations}`);
        console.log(`  Dissipation: ${preset.velocityDissipation}`);
        
        return preset;
    }

    /**
     * Get recommended preset based on current FPS
     */
    getRecommendedPreset() {
        const fps = this.performanceMonitor.getCurrentFPS();
        
        if (fps < 15) return 'potato';
        if (fps < 25) return 'low';
        if (fps < 35) return 'medium';
        if (fps < 50) return 'high';
        return 'ultra';
    }

    /**
     * Enable/disable auto-optimization
     */
    setAutoOptimize(enabled) {
        this.autoOptimize = enabled;
        console.log(`Auto-optimization: ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Show optimization notice to user
     */
    showOptimizationNotice(message) {
        // Create temporary notification
        const notice = document.createElement('div');
        notice.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(255, 150, 0, 0.9);
            color: white;
            padding: 15px 20px;
            border-radius: 5px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.3);
            z-index: 10000;
            font-family: monospace;
            font-size: 14px;
            animation: slideIn 0.3s ease;
        `;
        notice.textContent = `⚡ ${message}`;
        
        document.body.appendChild(notice);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notice.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notice.remove(), 300);
        }, 3000);
    }

    /**
     * Get optimization suggestions based on metrics
     */
    getSuggestions(metrics) {
        const suggestions = [];
        
        if (metrics.fps.avg < this.targetFPS) {
            suggestions.push({
                severity: 'high',
                message: `FPS below target (${metrics.fps.avg.toFixed(1)} < ${this.targetFPS})`,
                actions: [
                    `Reduce iterations (current: ${this.simulation.params.iterations})`,
                    'Apply "Low" or "Potato" preset',
                    'Enable auto-optimization'
                ]
            });
        }
        
        if (metrics.simulation?.stepTime > 25) {
            suggestions.push({
                severity: 'medium',
                message: 'Simulation step taking too long',
                actions: [
                    'Reduce pressure solver iterations',
                    'Increase dissipation rates'
                ]
            });
        }
        
        if (metrics.render?.renderTime > 10) {
            suggestions.push({
                severity: 'medium',
                message: 'Rendering taking too long',
                actions: [
                    'Reduce slice render resolution',
                    'Optimize shader operations'
                ]
            });
        }
        
        if (metrics.fps.avg > this.optimalFPS && this.currentPreset !== 'ultra') {
            suggestions.push({
                severity: 'low',
                message: 'Performance headroom available',
                actions: [
                    'Increase quality preset',
                    'Add more iterations for smoother flow'
                ]
            });
        }
        
        return suggestions;
    }

    /**
     * Get current optimization status
     */
    getStatus() {
        const fps = this.performanceMonitor.getCurrentFPS();
        const metrics = this.performanceMonitor.getMetrics();
        
        let status = 'optimal';
        if (fps < this.criticalFPS) status = 'critical';
        else if (fps < this.targetFPS) status = 'poor';
        else if (fps < this.optimalFPS) status = 'acceptable';
        
        return {
            fps: fps,
            status: status,
            preset: this.currentPreset,
            autoOptimize: this.autoOptimize,
            iterations: this.simulation.params.iterations,
            suggestions: this.getSuggestions(metrics)
        };
    }

    /**
     * Benchmark current settings (run for a few seconds)
     */
    async benchmark(duration = 5000) {
        console.log('🔬 Running performance benchmark...');
        
        this.performanceMonitor.reset();
        const startTime = performance.now();
        
        return new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                const elapsed = performance.now() - startTime;
                
                if (elapsed >= duration) {
                    clearInterval(checkInterval);
                    
                    const metrics = this.performanceMonitor.getMetrics();
                    const result = {
                        avgFPS: metrics.fps.avg,
                        minFPS: metrics.fps.min,
                        maxFPS: metrics.fps.max,
                        avgFrameTime: metrics.frame.avg,
                        iterations: this.simulation.params.iterations,
                        recommendation: this.getRecommendedPreset()
                    };
                    
                    console.log('📊 Benchmark results:');
                    console.log(`  Average FPS: ${result.avgFPS.toFixed(1)}`);
                    console.log(`  Min FPS: ${result.minFPS.toFixed(1)}`);
                    console.log(`  Max FPS: ${result.maxFPS.toFixed(1)}`);
                    console.log(`  Recommended preset: ${result.recommendation}`);
                    
                    resolve(result);
                }
            }, 100);
        });
    }
}

// Add CSS animation for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(400px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(400px); opacity: 0; }
    }
`;
document.head.appendChild(style);
