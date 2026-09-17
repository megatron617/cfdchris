/**
 * Instructions Modal - Copy functionality and event handling
 */

export function initializeInstructionsModal() {
    const modal = document.getElementById('instructions-modal');
    const closeBtn = document.getElementById('modal-close-btn');
    const okBtn = document.getElementById('modal-ok-btn');
    const copyButtons = document.querySelectorAll('.copy-btn');
    
    // Close modal handlers
    const closeModal = () => {
        modal.classList.add('hidden');
    };
    
    closeBtn.addEventListener('click', closeModal);
    okBtn.addEventListener('click', closeModal);
    
    // Close on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });
    
    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
            closeModal();
        }
    });
    
    // Copy button handlers
    copyButtons.forEach(button => {
        button.addEventListener('click', async () => {
            const targetId = button.getAttribute('data-target');
            const codeElement = document.getElementById(targetId);
            const text = codeElement.textContent;
            
            try {
                await navigator.clipboard.writeText(text);
                
                // Visual feedback
                const originalText = button.textContent;
                button.textContent = 'Copied!';
                button.classList.add('copied');
                
                setTimeout(() => {
                    button.textContent = originalText;
                    button.classList.remove('copied');
                }, 2000);
            } catch (err) {
                console.error('Failed to copy:', err);
                
                // Fallback for older browsers
                try {
                    const textArea = document.createElement('textarea');
                    textArea.value = text;
                    textArea.style.position = 'fixed';
                    textArea.style.left = '-9999px';
                    document.body.appendChild(textArea);
                    textArea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textArea);
                    
                    button.textContent = 'Copied!';
                    button.classList.add('copied');
                    setTimeout(() => {
                        button.textContent = 'Copy';
                        button.classList.remove('copied');
                    }, 2000);
                } catch (fallbackErr) {
                    console.error('Fallback copy failed:', fallbackErr);
                    button.textContent = 'Failed';
                    setTimeout(() => {
                        button.textContent = 'Copy';
                    }, 2000);
                }
            }
        });
    });
}
