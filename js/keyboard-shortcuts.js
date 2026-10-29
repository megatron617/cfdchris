/**
 * KeyboardShortcuts — full-screen overlay listing all keyboard controls.
 * Toggle with ? or H.  Dismiss with the same keys or Escape.
 */
export class KeyboardShortcuts {
    constructor() {
        this.visible  = false;
        this.overlay  = null;
        this._buildOverlay();
        this._bindKeys();
    }

    _buildOverlay() {
        this.overlay = document.createElement('div');
        this.overlay.id        = 'shortcut-overlay';
        this.overlay.className = 'shortcut-overlay hidden';
        this.overlay.setAttribute('role', 'dialog');
        this.overlay.setAttribute('aria-modal', 'true');
        this.overlay.setAttribute('aria-label', 'Keyboard shortcuts');

        const shortcuts = [
            // [Key label, Description]
            ['Left drag',    'Paint fluid / add dye'],
            ['Right drag',   'Rotate camera (orbit) / Look (free-flight)'],
            ['Scroll wheel', 'Zoom (orbit mode)'],
            ['R',            'Reset camera'],
            ['F',            'Toggle orbit ↔ free-flight camera'],
            ['W / S',        'Move forward / backward (free-flight)'],
            ['A / D',        'Strafe left / right (free-flight)'],
            ['Q / E',        'Move up / down (free-flight)'],
            ['Shift',        '2× movement speed (free-flight)'],
            ['Ctrl',         '¼× movement speed (free-flight)'],
            ['V',            'Toggle SLICE ↔ VOLUMETRIC render mode'],
            ['← / →',        'Step slice depth (−5% / +5%)'],
            ['X / Y / Z',    'Set slice axis'],
            ['P',            'Toggle performance dashboard'],
            ['? / H',        'Show / hide this shortcut overlay'],
            ['Esc',          'Close overlays'],
        ];

        const rows = shortcuts.map(([key, desc]) => `
            <tr>
                <td class="shortcut-key"><kbd>${key}</kbd></td>
                <td class="shortcut-desc">${desc}</td>
            </tr>
        `).join('');

        this.overlay.innerHTML = `
            <div class="shortcut-card">
                <div class="shortcut-card-header">
                    <h2>Keyboard Shortcuts</h2>
                    <button class="shortcut-close" aria-label="Close">×</button>
                </div>
                <table class="shortcut-table">
                    <thead>
                        <tr>
                            <th>Key</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;

        document.body.appendChild(this.overlay);

        // Close button
        this.overlay.querySelector('.shortcut-close')
            .addEventListener('click', () => this.hide());

        // Click outside card to dismiss
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.hide();
        });
    }

    _bindKeys() {
        document.addEventListener('keydown', (e) => {
            const active = document.activeElement;
            if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;

            if (e.key === '?' || e.key === 'h' || e.key === 'H') {
                this.toggle();
            } else if (e.key === 'Escape' && this.visible) {
                this.hide();
            }
        });
    }

    show() {
        this.visible = true;
        this.overlay.classList.remove('hidden');
    }

    hide() {
        this.visible = false;
        this.overlay.classList.add('hidden');
    }

    toggle() {
        this.visible ? this.hide() : this.show();
    }
}
