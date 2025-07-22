function showNotification(message, type = 'success') {
    // Create notification element
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        padding: 1rem 2rem;
        background: ${type === 'success' ? 'var(--primary-color)' : '#E53E3E'};
        color: white;
        border-radius: 10px;
        box-shadow: var(--shadow-lg);
        z-index: 3000;
        animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Mobile menu
function toggleMobileMenu() {
    const menu = document.getElementById('mobileMenu');
    menu.classList.toggle('active');
}

// Utility functions
function showError(fieldId, message) {
    const errorElement = document.getElementById(fieldId);
    if (!errorElement) {
        console.error(`Error element ${fieldId} not found`);
        showNotification(message, 'error');
        return;
    }
    
    errorElement.textContent = message;
    errorElement.style.display = 'block';
    
    // Also add error styling to the input
    const inputField = errorElement.previousElementSibling;
    if (inputField && inputField.tagName === 'INPUT') {
        inputField.style.borderColor = '#E53E3E';
    }
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        errorElement.style.display = 'none';
        if (inputField && inputField.tagName === 'INPUT') {
            inputField.style.borderColor = '';
        }
    }, 5000);
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
    });
}

const qs = (sel, parent = document) => parent.querySelector(sel);

export { showNotification, toggleMobileMenu, showError, formatDate, qs };