/**
 * Performance Dashboard - Real-time metrics display
 */

export class PerformanceDashboard {
    constructor(gpuProfiler) {
        this.gpuProfiler = gpuProfiler;
        this.visible = false;
        this.updateThrottle = 100; // ms
        this.lastUpdate = 0;
        
        this.createDashboard();
        this.setupEventListeners();
        
        // Get initial GPU diagnostics
        this.diagnostics = this.gpuProfiler.getDiagnostics();
    }

    createDashboard() {
        // Create dashboard container
        this.container = document.createElement('div');
        this.container.id = 'performance-dashboard';
        this.container.className = 'performance-dashboard hidden';
        
        this.container.innerHTML = `
            <div class="dashboard-header">
                <h3>Performance Monitor</h3>
                <button class="dashboard-close" title="Close (P key)">×</button>
            </div>
            
            <div class="dashboard-content">
                <!-- System Info Section -->
                <div class="dashboard-section">
                    <div class="section-header" data-section="system">
                        <span class="toggle-icon">▼</span>
                        <span>System Info</span>
                    </div>
                    <div class="section-content" id="system-content">
                        <div class="info-row">
                            <span class="label">Rendering Mode:</span>
                            <span class="value" id="render-mode">-</span>
                        </div>
                        <div class="info-row">
                            <span class="label">GPU:</span>
                            <span class="value" id="gpu-name">-</span>
                        </div>
                        <div class="info-row">
                            <span class="label">Vendor:</span>
                            <span class="value" id="gpu-vendor">-</span>
                        </div>
                        <div class="info-row">
                            <span class="label">WebGL Version:</span>
                            <span class="value" id="webgl-version">-</span>
                        </div>
                        <div class="info-row">
                            <span class="label">GPU Timing:</span>
                            <span class="value" id="gpu-timing-support">-</span>
                        </div>
                    </div>
                </div>

                <!-- Frame Metrics Section -->
                <div class="dashboard-section">
                    <div class="section-header" data-section="frame">
                        <span class="toggle-icon">▼</span>
                        <span>Frame Metrics</span>
                    </div>
                    <div class="section-content" id="frame-content">
                        <!-- Performance Score -->
                        <div class="performance-score-container">
                            <div class="score-label">Performance Score</div>
                            <div class="score-value" id="performance-score">-</div>
                            <div class="score-bar">
                                <div class="score-fill" id="score-fill"></div>
                            </div>
                        </div>
                        
                        <!-- Warnings -->
                        <div id="warnings-container" class="warnings-container">
                            <!-- Warnings will be added dynamically -->
                        </div>
                        
                        <div class="info-row">
                            <span class="label">FPS:</span>
                            <span class="value metric-fps" id="fps-current">-</span>
                        </div>
                        <div class="info-row">
                            <span class="label">Frame Time:</span>
                            <span class="value" id="frame-time">-</span>
                        </div>
                        <div class="info-row">
                            <span class="label">Avg Frame Time:</span>
                            <span class="value" id="frame-time-avg">-</span>
                        </div>
                        <div class="info-row">
                            <span class="label">Variance:</span>
                            <span class="value" id="frame-variance">-</span>
                        </div>
                        <div class="info-row">
                            <span class="label">Total Frames:</span>
                            <span class="value" id="total-frames">-</span>
                        </div>
                    </div>
                </div>

                <!-- Quality Metrics Section -->
                <div class="dashboard-section">
                    <div class="section-header" data-section="quality">
                        <span class="toggle-icon">▼</span>
                        <span>Quality Metrics</span>
                    </div>
                    <div class="section-content" id="quality-content">
                        <div class="info-row">
                            <span class="label">Dropped Frames:</span>
                            <span class="value" id="dropped-frames">-</span>
                        </div>
                        <div class="info-row">
                            <span class="label">Target Iterations:</span>
                            <span class="value" id="target-iterations">-</span>
                        </div>
                        <div class="info-row">
                            <span class="label">Actual Iterations:</span>
                            <span class="value" id="actual-iterations">-</span>
                        </div>
                        <div class="info-row">
                            <span class="label">Completion Rate:</span>
                            <span class="value" id="iteration-completion">-</span>
                        </div>
                    </div>
                </div>

                <!-- Simulation Timing Section -->
                <div class="dashboard-section">
                    <div class="section-header" data-section="simulation">
                        <span class="toggle-icon">▼</span>
                        <span>Simulation Timing</span>
                    </div>
                    <div class="section-content" id="simulation-content">
                        <div class="timing-header">
                            <span class="timing-label">Operation</span>
                            <span class="timing-cpu">CPU (ms)</span>
                            <span class="timing-gpu">GPU (ms)</span>
                        </div>
                        <div class="timing-row" data-timing="advectVelocity">
                            <span class="timing-label">Advect Velocity</span>
                            <span class="timing-cpu" id="time-advectVelocity-cpu">-</span>
                            <span class="timing-gpu" id="time-advectVelocity-gpu">-</span>
                        </div>
                        <div class="timing-row" data-timing="advectDye">
                            <span class="timing-label">Advect Dye</span>
                            <span class="timing-cpu" id="time-advectDye-cpu">-</span>
                            <span class="timing-gpu" id="time-advectDye-gpu">-</span>
                        </div>
                        <div class="timing-row" data-timing="divergence">
                            <span class="timing-label">Divergence</span>
                            <span class="timing-cpu" id="time-divergence-cpu">-</span>
                            <span class="timing-gpu" id="time-divergence-gpu">-</span>
                        </div>
                        <div class="timing-row" data-timing="pressureSolve">
                            <span class="timing-label">Pressure Solve</span>
                            <span class="timing-cpu" id="time-pressureSolve-cpu">-</span>
                            <span class="timing-gpu" id="time-pressureSolve-gpu">-</span>
                        </div>
                        <div class="timing-row" data-timing="gradient">
                            <span class="timing-label">Gradient</span>
                            <span class="timing-cpu" id="time-gradient-cpu">-</span>
                            <span class="timing-gpu" id="time-gradient-gpu">-</span>
                        </div>
                        <div class="timing-row total-row">
                            <span class="timing-label">Total Simulation</span>
                            <span class="timing-cpu" id="time-total-sim-cpu">-</span>
                            <span class="timing-gpu" id="time-total-sim-gpu">-</span>
                        </div>
                    </div>
                </div>

                <!-- Render Timing Section -->
                <div class="dashboard-section">
                    <div class="section-header" data-section="render">
                        <span class="toggle-icon">▼</span>
                        <span>Render Timing</span>
                    </div>
                    <div class="section-content" id="render-content">
                        <div class="timing-header">
                            <span class="timing-label">Operation</span>
                            <span class="timing-cpu">CPU (ms)</span>
                            <span class="timing-gpu">GPU (ms)</span>
                        </div>
                        <div class="timing-row" data-timing="display">
                            <span class="timing-label">Display Shader</span>
                            <span class="timing-cpu" id="time-display-cpu">-</span>
                            <span class="timing-gpu" id="time-display-gpu">-</span>
                        </div>
                        <div class="timing-row" data-timing="canvasCopy">
                            <span class="timing-label">Canvas Copy</span>
                            <span class="timing-cpu" id="time-canvasCopy-cpu">-</span>
                            <span class="timing-gpu" id="time-canvasCopy-gpu">-</span>
                        </div>
                    </div>
                </div>

                <!-- Memory Section -->
                <div class="dashboard-section">
                    <div class="section-header" data-section="memory">
                        <span class="toggle-icon">▼</span>
                        <span>Memory</span>
                    </div>
                    <div class="section-content" id="memory-content">
                        <div class="info-row">
                            <span class="label">Grid Size:</span>
                            <span class="value" id="grid-size">-</span>
                        </div>
                        <div class="info-row">
                            <span class="label">Texture Count:</span>
                            <span class="value" id="texture-count">-</span>
                        </div>
                        <div class="info-row">
                            <span class="label">Est. GPU Memory:</span>
                            <span class="value" id="gpu-memory">-</span>
                        </div>
                    </div>
                </div>

                <!-- Instructions Button -->
                <div class="dashboard-actions">
                    <button id="show-instructions-btn" class="dashboard-btn">
                        📖 Software Rendering Instructions
                    </button>
                    <button id="snapshot-btn" class="dashboard-btn snapshot-btn">
                        📸 Capture Snapshot
                    </button>
                    <button id="compare-btn" class="dashboard-btn compare-btn" disabled>
                        📊 Compare Snapshots (<span id="snapshot-count">0</span>)
                    </button>
                </div>

                <!-- Snapshots Section (hidden by default) -->
                <div id="snapshots-section" class="snapshots-section hidden">
                    <div class="snapshots-header">
                        <h4>Performance Snapshots</h4>
                        <div class="snapshots-actions">
                            <button id="export-snapshots-btn" class="small-btn">Export JSON</button>
                            <button id="clear-snapshots-btn" class="small-btn danger-btn">Clear All</button>
                        </div>
                    </div>
                    <div id="snapshots-list" class="snapshots-list">
                        <!-- Snapshots will be added here dynamically -->
                    </div>
                    <div id="comparison-table" class="comparison-table">
                        <!-- Comparison table will be rendered here -->
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.container);
        
        // Initialize snapshot storage
        this.snapshots = this.loadSnapshots();
        this.updateSnapshotCount();
    }

    setupEventListeners() {
        // Close button
        const closeBtn = this.container.querySelector('.dashboard-close');
        closeBtn.addEventListener('click', () => this.hide());
        
        // Collapsible sections
        const headers = this.container.querySelectorAll('.section-header');
        headers.forEach(header => {
            header.addEventListener('click', () => this.toggleSection(header));
        });
        
        // Instructions button
        const instructionsBtn = this.container.querySelector('#show-instructions-btn');
        instructionsBtn.addEventListener('click', () => this.showInstructions());
        
        // Snapshot button
        const snapshotBtn = this.container.querySelector('#snapshot-btn');
        snapshotBtn.addEventListener('click', () => this.captureSnapshot());
        
        // Compare button
        const compareBtn = this.container.querySelector('#compare-btn');
        compareBtn.addEventListener('click', () => this.toggleComparison());
        
        // Export button
        const exportBtn = this.container.querySelector('#export-snapshots-btn');
        exportBtn.addEventListener('click', () => this.exportSnapshots());
        
        // Clear button
        const clearBtn = this.container.querySelector('#clear-snapshots-btn');
        clearBtn.addEventListener('click', () => this.clearSnapshots());
    }

    toggleSection(header) {
        const section = header.dataset.section;
        const content = document.getElementById(`${section}-content`);
        const icon = header.querySelector('.toggle-icon');
        
        if (content.style.display === 'none') {
            content.style.display = 'block';
            icon.textContent = '▼';
        } else {
            content.style.display = 'none';
            icon.textContent = '▶';
        }
    }

    showInstructions() {
        const modal = document.getElementById('instructions-modal');
        if (modal) {
            modal.classList.remove('hidden');
        }
    }

    update(metrics) {
        if (!this.visible) return;
        
        // Throttle updates
        const now = performance.now();
        if (now - this.lastUpdate < this.updateThrottle) {
            return;
        }
        this.lastUpdate = now;
        
        // Update system info (only needs to be done once, but safe to repeat)
        this.updateSystemInfo();
        
        // Update frame metrics
        this.updateFrameMetrics(metrics);
        
        // Update quality metrics
        this.updateQualityMetrics(metrics);
        
        // Update timing metrics
        this.updateTimingMetrics(metrics);
        
        // Update memory info
        this.updateMemoryInfo();
    }

    updateSystemInfo() {
        const renderMode = this.diagnostics.renderMode;
        const gpuInfo = this.diagnostics.gpuInfo;
        
        // Render mode with color coding
        const modeElement = document.getElementById('render-mode');
        modeElement.textContent = renderMode.mode.toUpperCase();
        modeElement.className = 'value ' + (renderMode.mode === 'hardware' ? 'status-good' : 'status-warning');
        
        document.getElementById('gpu-name').textContent = gpuInfo.renderer;
        document.getElementById('gpu-vendor').textContent = gpuInfo.vendor;
        document.getElementById('webgl-version').textContent = gpuInfo.webglVersion;
        
        const timingElement = document.getElementById('gpu-timing-support');
        timingElement.textContent = gpuInfo.extensions.timerQuery ? 'Available' : 'Not Available';
        timingElement.className = 'value ' + (gpuInfo.extensions.timerQuery ? 'status-good' : 'status-warning');
    }

    updateFrameMetrics(metrics) {
        const fps = parseFloat(metrics.fps.current);
        const fpsElement = document.getElementById('fps-current');
        fpsElement.textContent = metrics.fps.current;
        
        // Color code FPS
        if (fps >= 55) {
            fpsElement.className = 'value metric-fps status-good';
        } else if (fps >= 30) {
            fpsElement.className = 'value metric-fps status-warning';
        } else {
            fpsElement.className = 'value metric-fps status-bad';
        }
        
        document.getElementById('frame-time').textContent = metrics.frame.lastFrameTime + ' ms';
        document.getElementById('frame-time-avg').textContent = metrics.frame.avgFrameTime + ' ms';
        document.getElementById('frame-variance').textContent = metrics.frame.variance + ' ms';
        document.getElementById('total-frames').textContent = metrics.frame.total;
        
        // Update performance score
        this.updatePerformanceScore(metrics);
        
        // Update warnings
        this.updateWarnings(metrics);
    }

    updateQualityMetrics(metrics) {
        const droppedPct = parseFloat(metrics.frame.droppedPercentage);
        const droppedElement = document.getElementById('dropped-frames');
        droppedElement.textContent = `${metrics.frame.dropped} (${metrics.frame.droppedPercentage}%)`;
        
        // Color code dropped frames
        if (droppedPct < 1) {
            droppedElement.className = 'value status-good';
        } else if (droppedPct < 5) {
            droppedElement.className = 'value status-warning';
        } else {
            droppedElement.className = 'value status-bad';
        }
        
        document.getElementById('target-iterations').textContent = metrics.quality.targetIterations;
        document.getElementById('actual-iterations').textContent = metrics.quality.actualIterations;
        
        const completionElement = document.getElementById('iteration-completion');
        completionElement.textContent = metrics.quality.avgCompletion + '%';
        
        const completion = parseFloat(metrics.quality.avgCompletion);
        if (completion >= 99) {
            completionElement.className = 'value status-good';
        } else if (completion >= 90) {
            completionElement.className = 'value status-warning';
        } else {
            completionElement.className = 'value status-bad';
        }
    }

    updateTimingMetrics(metrics) {
        const hasGpuTiming = metrics.gpu.timerAvailable;
        
        // Update individual timing rows
        const timingLabels = ['advectVelocity', 'advectDye', 'divergence', 'pressureSolve', 'gradient', 'display', 'canvasCopy'];
        
        timingLabels.forEach(label => {
            const timing = metrics.timing[label];
            if (timing) {
                const cpuElement = document.getElementById(`time-${label}-cpu`);
                const gpuElement = document.getElementById(`time-${label}-gpu`);
                
                if (cpuElement) {
                    cpuElement.textContent = timing.cpuAvg > 0 ? timing.cpuAvg.toFixed(3) : '-';
                }
                
                if (gpuElement) {
                    if (timing.hasGpuTiming && timing.gpuAvg > 0) {
                        gpuElement.textContent = timing.gpuAvg.toFixed(3);
                        gpuElement.className = 'timing-gpu';
                    } else if (hasGpuTiming) {
                        gpuElement.textContent = 'pending...';
                        gpuElement.className = 'timing-gpu status-pending';
                    } else {
                        gpuElement.textContent = 'N/A';
                        gpuElement.className = 'timing-gpu status-na';
                    }
                }
            }
        });
        
        // Update totals
        document.getElementById('time-total-sim-cpu').textContent = metrics.totals.simulationCPU;
        
        const totalGpuElement = document.getElementById('time-total-sim-gpu');
        if (parseFloat(metrics.totals.simulationGPU) > 0) {
            totalGpuElement.textContent = metrics.totals.simulationGPU;
        } else if (hasGpuTiming) {
            totalGpuElement.textContent = 'pending...';
        } else {
            totalGpuElement.textContent = 'N/A';
        }
    }

    updateMemoryInfo() {
        const memoryInfo = this.diagnostics.memoryInfo;
        document.getElementById('grid-size').textContent = memoryInfo.gridSize;
        document.getElementById('texture-count').textContent = memoryInfo.textureCount;
        document.getElementById('gpu-memory').textContent = memoryInfo.totalMB + ' MB';
    }

    updatePerformanceScore(metrics) {
        if (!metrics.performanceScore) return;
        
        const scoreValue = document.getElementById('performance-score');
        const scoreFill = document.getElementById('score-fill');
        
        if (scoreValue && scoreFill) {
            scoreValue.textContent = metrics.performanceScore;
            scoreFill.style.width = metrics.performanceScore + '%';
            
            // Color code score
            if (metrics.performanceScore >= 80) {
                scoreValue.className = 'score-value status-good';
                scoreFill.className = 'score-fill good';
            } else if (metrics.performanceScore >= 50) {
                scoreValue.className = 'score-value status-warning';
                scoreFill.className = 'score-fill warning';
            } else {
                scoreValue.className = 'score-value status-bad';
                scoreFill.className = 'score-fill bad';
            }
        }
    }

    updateWarnings(metrics) {
        const container = document.getElementById('warnings-container');
        if (!container) return;
        
        const warnings = metrics.warnings || [];
        
        if (warnings.length === 0) {
            container.innerHTML = '';
            container.style.display = 'none';
            return;
        }
        
        container.style.display = 'block';
        container.innerHTML = warnings.map(warning => {
            const severityClass = `warning-${warning.severity}`;
            const icon = warning.severity === 'high' ? '⚠️' : 
                        warning.severity === 'medium' ? '⚡' : 'ℹ️';
            
            return `
                <div class="warning-item ${severityClass}">
                    <div class="warning-header">
                        <span class="warning-icon">${icon}</span>
                        <span class="warning-message">${warning.message}</span>
                    </div>
                    <div class="warning-suggestion">${warning.suggestion}</div>
                </div>
            `;
        }).join('');
    }

    show() {
        this.visible = true;
        this.container.classList.remove('hidden');
    }

    hide() {
        this.visible = false;
        this.container.classList.add('hidden');
    }

    toggle() {
        if (this.visible) {
            this.hide();
        } else {
            this.show();
        }
    }

    isVisible() {
        return this.visible;
    }

    // Snapshot Management Methods
    
    loadSnapshots() {
        try {
            const stored = localStorage.getItem('fluidSimSnapshots');
            return stored ? JSON.parse(stored) : [];
        } catch (err) {
            console.error('Failed to load snapshots:', err);
            return [];
        }
    }

    saveSnapshots() {
        try {
            // Keep only last 10 snapshots
            const toSave = this.snapshots.slice(-10);
            localStorage.setItem('fluidSimSnapshots', JSON.stringify(toSave));
            this.snapshots = toSave;
        } catch (err) {
            console.error('Failed to save snapshots:', err);
        }
    }

    captureSnapshot() {
        if (!this.currentMetrics) {
            alert('No metrics available to capture. Wait for simulation to run.');
            return;
        }

        const diagnostics = this.gpuProfiler.getDiagnostics();
        
        const snapshot = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            label: `${diagnostics.renderMode.mode.toUpperCase()} - ${new Date().toLocaleTimeString()}`,
            renderMode: diagnostics.renderMode.mode,
            gpuInfo: {
                vendor: diagnostics.gpuInfo.vendor,
                renderer: diagnostics.gpuInfo.renderer
            },
            metrics: JSON.parse(JSON.stringify(this.currentMetrics)) // Deep clone
        };

        this.snapshots.push(snapshot);
        this.saveSnapshots();
        this.updateSnapshotCount();
        this.renderSnapshotsList();
        
        // Show success feedback
        const btn = document.getElementById('snapshot-btn');
        const originalText = btn.textContent;
        btn.textContent = '✓ Captured!';
        btn.style.background = '#2ecc71';
        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.background = '';
        }, 1500);
    }

    updateSnapshotCount() {
        const countElement = document.getElementById('snapshot-count');
        if (countElement) {
            countElement.textContent = this.snapshots.length;
        }
        
        const compareBtn = document.getElementById('compare-btn');
        if (compareBtn) {
            compareBtn.disabled = this.snapshots.length < 2;
        }
    }

    toggleComparison() {
        const section = document.getElementById('snapshots-section');
        if (section.classList.contains('hidden')) {
            section.classList.remove('hidden');
            this.renderSnapshotsList();
            this.renderComparisonTable();
        } else {
            section.classList.add('hidden');
        }
    }

    renderSnapshotsList() {
        const listContainer = document.getElementById('snapshots-list');
        if (!listContainer || this.snapshots.length === 0) {
            if (listContainer) listContainer.innerHTML = '<p class="no-snapshots">No snapshots captured yet.</p>';
            return;
        }

        listContainer.innerHTML = this.snapshots.map((snapshot, index) => `
            <div class="snapshot-item" data-index="${index}">
                <div class="snapshot-info">
                    <div class="snapshot-label">${snapshot.label}</div>
                    <div class="snapshot-meta">
                        ${snapshot.renderMode} | FPS: ${snapshot.metrics.fps.current} | 
                        Frame: ${snapshot.metrics.frame.avgFrameTime}ms
                    </div>
                </div>
                <button class="snapshot-delete" data-index="${index}" title="Delete">×</button>
            </div>
        `).join('');

        // Add delete handlers
        listContainer.querySelectorAll('.snapshot-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(btn.dataset.index);
                this.deleteSnapshot(index);
            });
        });
    }

    deleteSnapshot(index) {
        if (confirm('Delete this snapshot?')) {
            this.snapshots.splice(index, 1);
            this.saveSnapshots();
            this.updateSnapshotCount();
            this.renderSnapshotsList();
            this.renderComparisonTable();
        }
    }

    renderComparisonTable() {
        const tableContainer = document.getElementById('comparison-table');
        if (!tableContainer || this.snapshots.length < 2) {
            if (tableContainer) tableContainer.innerHTML = '';
            return;
        }

        // Use last 2 snapshots for comparison
        const snap1 = this.snapshots[this.snapshots.length - 2];
        const snap2 = this.snapshots[this.snapshots.length - 1];

        const createRow = (label, val1, val2, unit = '') => {
            const num1 = parseFloat(val1);
            const num2 = parseFloat(val2);
            const diff = num2 - num1;
            const diffPct = num1 !== 0 ? ((diff / num1) * 100) : 0;
            
            let diffClass = 'neutral';
            let diffSymbol = '';
            
            if (Math.abs(diffPct) > 5) {
                // For FPS, higher is better. For timing, lower is better.
                const isBetter = label.includes('FPS') ? diff > 0 : diff < 0;
                diffClass = isBetter ? 'better' : 'worse';
                diffSymbol = diff > 0 ? '+' : '';
            }
            
            return `
                <tr>
                    <td class="metric-label">${label}</td>
                    <td class="metric-value">${val1}${unit}</td>
                    <td class="metric-value">${val2}${unit}</td>
                    <td class="metric-diff ${diffClass}">
                        ${diffSymbol}${diff.toFixed(2)}${unit} (${diffSymbol}${diffPct.toFixed(1)}%)
                    </td>
                </tr>
            `;
        };

        tableContainer.innerHTML = `
            <h4>Comparison: Latest Two Snapshots</h4>
            <table class="comparison-table-grid">
                <thead>
                    <tr>
                        <th>Metric</th>
                        <th>${snap1.label}</th>
                        <th>${snap2.label}</th>
                        <th>Difference</th>
                    </tr>
                </thead>
                <tbody>
                    <tr class="section-row">
                        <td colspan="4"><strong>Frame Performance</strong></td>
                    </tr>
                    ${createRow('FPS', snap1.metrics.fps.current, snap2.metrics.fps.current)}
                    ${createRow('Avg Frame Time', snap1.metrics.frame.avgFrameTime, snap2.metrics.frame.avgFrameTime, 'ms')}
                    ${createRow('Frame Variance', snap1.metrics.frame.variance, snap2.metrics.frame.variance, 'ms')}
                    ${createRow('Dropped Frames', snap1.metrics.frame.dropped, snap2.metrics.frame.dropped)}
                    
                    <tr class="section-row">
                        <td colspan="4"><strong>Simulation Timing (CPU)</strong></td>
                    </tr>
                    ${createRow('Total Simulation', snap1.metrics.totals.simulationCPU, snap2.metrics.totals.simulationCPU, 'ms')}
                    ${createRow('Advect Velocity', snap1.metrics.timing.advectVelocity.cpuAvg, snap2.metrics.timing.advectVelocity.cpuAvg, 'ms')}
                    ${createRow('Advect Dye', snap1.metrics.timing.advectDye.cpuAvg, snap2.metrics.timing.advectDye.cpuAvg, 'ms')}
                    ${createRow('Divergence', snap1.metrics.timing.divergence.cpuAvg, snap2.metrics.timing.divergence.cpuAvg, 'ms')}
                    ${createRow('Pressure Solve', snap1.metrics.timing.pressureSolve.cpuAvg, snap2.metrics.timing.pressureSolve.cpuAvg, 'ms')}
                    ${createRow('Gradient', snap1.metrics.timing.gradient.cpuAvg, snap2.metrics.timing.gradient.cpuAvg, 'ms')}
                    
                    <tr class="section-row">
                        <td colspan="4"><strong>Quality Metrics</strong></td>
                    </tr>
                    ${createRow('Iteration Completion', snap1.metrics.quality.avgCompletion, snap2.metrics.quality.avgCompletion, '%')}
                </tbody>
            </table>
        `;
    }

    exportSnapshots() {
        if (this.snapshots.length === 0) {
            alert('No snapshots to export.');
            return;
        }

        const exportData = {
            exportDate: new Date().toISOString(),
            application: 'GPU Fluid Dynamics - Performance Monitor',
            snapshots: this.snapshots
        };

        const json = JSON.stringify(exportData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `fluid-sim-performance-${Date.now()}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    clearSnapshots() {
        if (this.snapshots.length === 0) return;
        
        if (confirm(`Delete all ${this.snapshots.length} snapshots?`)) {
            this.snapshots = [];
            this.saveSnapshots();
            this.updateSnapshotCount();
            this.renderSnapshotsList();
            this.renderComparisonTable();
            
            const section = document.getElementById('snapshots-section');
            section.classList.add('hidden');
        }
    }

    update(metrics) {
        if (!this.visible) return;
        
        // Store current metrics for snapshots
        this.currentMetrics = metrics;
        
        // Throttle updates
        const now = performance.now();
        if (now - this.lastUpdate < this.updateThrottle) {
            return;
        }
        this.lastUpdate = now;
        
        // Update system info (only needs to be done once, but safe to repeat)
        this.updateSystemInfo();
        
        // Update frame metrics
        this.updateFrameMetrics(metrics);
        
        // Update quality metrics
        this.updateQualityMetrics(metrics);
        
        // Update timing metrics
        this.updateTimingMetrics(metrics);
        
        // Update memory info
        this.updateMemoryInfo();
    }
}
