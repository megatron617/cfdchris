/**
 * Performance Monitor - Metrics collection and timing
 */

export class PerformanceMonitor {
    constructor(gpuProfiler) {
        this.gpuProfiler = gpuProfiler;
        this.enabled = true;
        
        // Frame metrics
        this.frameCount = 0;
        this.totalFrames = 0;
        this.droppedFrames = 0;
        this.frameStartTime = 0;
        this.lastFrameTime = 0;
        this.frameTimes = []; // Rolling window of last 60 frames
        this.maxFrameHistory = 60;
        
        // FPS tracking
        this.fpsHistory = [];
        this.fpsUpdateInterval = 500; // ms
        this.lastFpsUpdate = 0;
        
        // Timing sections
        this.timingSections = {
            advectVelocity: { cpu: [], gpu: [], active: false },
            advectDye: { cpu: [], gpu: [], active: false },
            divergence: { cpu: [], gpu: [], active: false },
            pressureSolve: { cpu: [], gpu: [], active: false },
            gradient: { cpu: [], gpu: [], active: false },
            splat: { cpu: [], gpu: [], active: false },
            display: { cpu: [], gpu: [], active: false },
            canvasCopy: { cpu: [], gpu: [], active: false }
        };
        
        // Active timings (for current frame)
        this.activeTimings = {};
        
        // Quality metrics
        this.targetIterations = 0;
        this.actualIterations = 0;
        this.iterationHistory = [];
        
        // GPU query tracking
        this.pendingQueries = [];
        
        // Target frame time (for 60 FPS)
        this.targetFrameTime = 1000 / 60; // ~16.67ms
    }

    /**
     * Start a new frame
     */
    startFrame() {
        if (!this.enabled) return;
        
        this.frameStartTime = performance.now();
        this.frameCount++;
        this.totalFrames++;
        
        // Process any pending GPU queries
        this.processPendingQueries();
    }

    /**
     * End current frame
     */
    endFrame() {
        if (!this.enabled) return;
        
        const frameEndTime = performance.now();
        const frameTime = frameEndTime - this.frameStartTime;
        
        // Track frame time
        this.frameTimes.push(frameTime);
        if (this.frameTimes.length > this.maxFrameHistory) {
            this.frameTimes.shift();
        }
        
        // Detect dropped frames (>2x target frame time)
        if (frameTime > this.targetFrameTime * 2) {
            this.droppedFrames++;
        }
        
        this.lastFrameTime = frameTime;
    }

    /**
     * Start timing a section
     */
    startTiming(label) {
        if (!this.enabled || !this.timingSections[label]) return;
        
        const timing = {
            label,
            cpuStart: performance.now(),
            gpuQuery: null
        };
        
        // Create GPU query if available
        if (this.gpuProfiler.isTimerAvailable()) {
            timing.gpuQuery = this.gpuProfiler.createTimerQuery();
            this.gpuProfiler.beginQuery(timing.gpuQuery);
        }
        
        this.activeTimings[label] = timing;
        this.timingSections[label].active = true;
    }

    /**
     * End timing a section
     */
    endTiming(label) {
        if (!this.enabled || !this.timingSections[label] || !this.activeTimings[label]) return;
        
        const timing = this.activeTimings[label];
        const cpuEnd = performance.now();
        const cpuTime = cpuEnd - timing.cpuStart;
        
        // End GPU query if active
        if (timing.gpuQuery) {
            this.gpuProfiler.endQuery();
            // Add to pending queries for async retrieval
            this.pendingQueries.push({
                label,
                query: timing.gpuQuery
            });
        }
        
        // Store CPU timing immediately
        this.timingSections[label].cpu.push(cpuTime);
        if (this.timingSections[label].cpu.length > this.maxFrameHistory) {
            this.timingSections[label].cpu.shift();
        }
        
        this.timingSections[label].active = false;
        delete this.activeTimings[label];
    }

    /**
     * Process pending GPU queries
     */
    processPendingQueries() {
        if (!this.gpuProfiler.isTimerAvailable()) return;
        
        const stillPending = [];
        
        for (const pending of this.pendingQueries) {
            const result = this.gpuProfiler.getQueryResult(pending.query);
            
            if (result !== null) {
                // Query completed, store result
                const section = this.timingSections[pending.label];
                if (section) {
                    section.gpu.push(result);
                    if (section.gpu.length > this.maxFrameHistory) {
                        section.gpu.shift();
                    }
                }
            } else if (this.gpuProfiler.isQueryResultAvailable(pending.query) === false) {
                // Query still pending, keep it
                stillPending.push(pending);
            }
            // If result is null but available is true, query was disjoint - discard it
        }
        
        this.pendingQueries = stillPending;
    }

    /**
     * Update quality metrics
     */
    updateQualityMetrics(targetIterations, actualIterations) {
        this.targetIterations = targetIterations;
        this.actualIterations = actualIterations;
        
        this.iterationHistory.push({
            target: targetIterations,
            actual: actualIterations
        });
        
        if (this.iterationHistory.length > this.maxFrameHistory) {
            this.iterationHistory.shift();
        }
    }

    /**
     * Calculate average from array
     */
    calculateAverage(arr) {
        if (arr.length === 0) return 0;
        return arr.reduce((sum, val) => sum + val, 0) / arr.length;
    }

    /**
     * Calculate standard deviation
     */
    calculateStdDev(arr) {
        if (arr.length === 0) return 0;
        const avg = this.calculateAverage(arr);
        const squareDiffs = arr.map(val => Math.pow(val - avg, 2));
        const avgSquareDiff = this.calculateAverage(squareDiffs);
        return Math.sqrt(avgSquareDiff);
    }

    /**
     * Get current FPS
     */
    getCurrentFPS() {
        if (this.frameTimes.length < 2) return 0;
        const avgFrameTime = this.calculateAverage(this.frameTimes);
        return avgFrameTime > 0 ? 1000 / avgFrameTime : 0;
    }

    /**
     * Get comprehensive metrics
     */
    getMetrics() {
        const currentFPS = this.getCurrentFPS();
        const avgFrameTime = this.calculateAverage(this.frameTimes);
        const frameTimeVariance = this.calculateStdDev(this.frameTimes);
        
        // Calculate timing breakdowns
        const timingBreakdown = {};
        for (const [label, data] of Object.entries(this.timingSections)) {
            timingBreakdown[label] = {
                cpuAvg: this.calculateAverage(data.cpu),
                cpuMin: data.cpu.length > 0 ? Math.min(...data.cpu) : 0,
                cpuMax: data.cpu.length > 0 ? Math.max(...data.cpu) : 0,
                gpuAvg: this.calculateAverage(data.gpu),
                gpuMin: data.gpu.length > 0 ? Math.min(...data.gpu) : 0,
                gpuMax: data.gpu.length > 0 ? Math.max(...data.gpu) : 0,
                hasGpuTiming: data.gpu.length > 0,
                sampleCount: data.cpu.length
            };
        }
        
        // Calculate total simulation time
        const simulationLabels = ['advectVelocity', 'advectDye', 'divergence', 'pressureSolve', 'gradient'];
        const totalSimulationCPU = simulationLabels.reduce((sum, label) => {
            return sum + (timingBreakdown[label]?.cpuAvg || 0);
        }, 0);
        
        const totalSimulationGPU = simulationLabels.reduce((sum, label) => {
            return sum + (timingBreakdown[label]?.gpuAvg || 0);
        }, 0);
        
        // Quality metrics
        const droppedFramePercentage = this.totalFrames > 0 
            ? (this.droppedFrames / this.totalFrames) * 100 
            : 0;
        
        const avgIterationCompletion = this.iterationHistory.length > 0
            ? this.iterationHistory.reduce((sum, item) => 
                sum + (item.target > 0 ? (item.actual / item.target) * 100 : 100), 0) / this.iterationHistory.length
            : 100;
        
        const metrics = {
            frame: {
                current: this.frameCount,
                total: this.totalFrames,
                dropped: this.droppedFrames,
                droppedPercentage: droppedFramePercentage.toFixed(1),
                lastFrameTime: this.lastFrameTime.toFixed(2),
                avgFrameTime: avgFrameTime.toFixed(2),
                variance: frameTimeVariance.toFixed(2),
                targetFrameTime: this.targetFrameTime.toFixed(2)
            },
            fps: {
                current: currentFPS.toFixed(1),
                target: 60,
                percentage: ((currentFPS / 60) * 100).toFixed(1)
            },
            timing: timingBreakdown,
            totals: {
                simulationCPU: totalSimulationCPU.toFixed(2),
                simulationGPU: totalSimulationGPU.toFixed(2),
                renderCPU: (timingBreakdown.display?.cpuAvg || 0) + (timingBreakdown.canvasCopy?.cpuAvg || 0),
                renderGPU: (timingBreakdown.display?.gpuAvg || 0)
            },
            quality: {
                targetIterations: this.targetIterations,
                actualIterations: this.actualIterations,
                avgCompletion: avgIterationCompletion.toFixed(1),
                iterationsSampled: this.iterationHistory.length
            },
            gpu: {
                timerAvailable: this.gpuProfiler.isTimerAvailable(),
                pendingQueries: this.pendingQueries.length
            }
        };
        
        // Generate warnings and suggestions
        metrics.warnings = this.generateWarnings(metrics);
        metrics.performanceScore = this.calculatePerformanceScore(metrics);
        
        return metrics;
    }

    /**
     * Generate performance warnings and suggestions
     */
    generateWarnings(metrics) {
        const warnings = [];
        const fps = parseFloat(metrics.fps.current);
        const droppedPct = parseFloat(metrics.frame.droppedPercentage);
        const variance = parseFloat(metrics.frame.variance);
        const completion = parseFloat(metrics.quality.avgCompletion);
        
        // Low FPS warnings
        if (fps < 30) {
            warnings.push({
                severity: 'high',
                type: 'fps',
                message: 'Low frame rate detected',
                suggestion: this.getSuggestionForLowFPS()
            });
        } else if (fps < 50) {
            warnings.push({
                severity: 'medium',
                type: 'fps',
                message: 'Frame rate below target',
                suggestion: 'Consider reducing iterations or grid size for better performance'
            });
        }
        
        // Frame time variance warnings
        if (variance > 10) {
            warnings.push({
                severity: 'medium',
                type: 'variance',
                message: 'Inconsistent frame timing detected',
                suggestion: 'Frame time is unstable. Close other applications or reduce simulation complexity'
            });
        }
        
        // Dropped frames warnings
        if (droppedPct > 5) {
            warnings.push({
                severity: 'high',
                type: 'dropped',
                message: 'Frequent frame drops detected',
                suggestion: 'Reduce iterations, grid size, or close background applications'
            });
        }
        
        // Iteration completion warnings
        if (completion < 90) {
            warnings.push({
                severity: 'medium',
                type: 'quality',
                message: 'Simulation quality reduced',
                suggestion: 'Pressure solver iterations being skipped. Reduce target iterations or accept lower quality'
            });
        }
        
        // Identify bottlenecks
        const bottleneck = this.identifyBottleneck(metrics);
        if (bottleneck) {
            warnings.push({
                severity: 'low',
                type: 'bottleneck',
                message: `Performance bottleneck: ${bottleneck.name}`,
                suggestion: bottleneck.suggestion
            });
        }
        
        return warnings;
    }

    /**
     * Get context-aware suggestion for low FPS
     */
    getSuggestionForLowFPS() {
        const diagnostics = this.gpuProfiler.getDiagnostics();
        
        if (diagnostics.renderMode.mode === 'software') {
            return 'Using software rendering. Launch browser with GPU acceleration enabled for better performance. See instructions in dashboard.';
        } else {
            return 'Try reducing iterations (currently high load) or grid size in CONFIG';
        }
    }

    /**
     * Identify performance bottleneck
     */
    identifyBottleneck(metrics) {
        const timings = metrics.timing;
        
        // Find the operation taking the most time
        let maxTime = 0;
        let maxOp = null;
        
        const operations = [
            { key: 'pressureSolve', name: 'Pressure Solver', suggestion: 'Reduce iteration count in controls' },
            { key: 'advectVelocity', name: 'Velocity Advection', suggestion: 'Consider reducing grid resolution' },
            { key: 'advectDye', name: 'Dye Advection', suggestion: 'Consider reducing grid resolution' },
            { key: 'divergence', name: 'Divergence Calculation', suggestion: 'Grid-dependent operation' },
            { key: 'gradient', name: 'Gradient Subtraction', suggestion: 'Grid-dependent operation' }
        ];
        
        for (const op of operations) {
            const time = timings[op.key]?.cpuAvg || 0;
            if (time > maxTime) {
                maxTime = time;
                maxOp = op;
            }
        }
        
        // Only report if it's taking a significant portion of frame time
        const totalSimTime = parseFloat(metrics.totals.simulationCPU);
        if (maxOp && maxTime > totalSimTime * 0.4) {
            return maxOp;
        }
        
        return null;
    }

    /**
     * Calculate overall performance score (0-100)
     */
    calculatePerformanceScore(metrics) {
        const fps = parseFloat(metrics.fps.current);
        const droppedPct = parseFloat(metrics.frame.droppedPercentage);
        const variance = parseFloat(metrics.frame.variance);
        const completion = parseFloat(metrics.quality.avgCompletion);
        
        // FPS score (0-40 points)
        let fpsScore = Math.min((fps / 60) * 40, 40);
        
        // Dropped frames score (0-25 points)
        let droppedScore = Math.max(25 - (droppedPct * 5), 0);
        
        // Variance score (0-20 points)
        let varianceScore = Math.max(20 - variance, 0);
        
        // Quality score (0-15 points)
        let qualityScore = (completion / 100) * 15;
        
        const total = fpsScore + droppedScore + varianceScore + qualityScore;
        return Math.round(Math.min(total, 100));
    }

    /**
     * Reset all metrics
     */
    reset() {
        this.frameCount = 0;
        this.totalFrames = 0;
        this.droppedFrames = 0;
        this.frameTimes = [];
        this.fpsHistory = [];
        this.iterationHistory = [];
        
        for (const section of Object.values(this.timingSections)) {
            section.cpu = [];
            section.gpu = [];
            section.active = false;
        }
        
        this.pendingQueries = [];
        this.activeTimings = {};
    }

    /**
     * Enable/disable monitoring
     */
    setEnabled(enabled) {
        this.enabled = enabled;
    }

    /**
     * Check if monitoring is enabled
     */
    isEnabled() {
        return this.enabled;
    }
}
