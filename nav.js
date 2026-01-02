/**
 * GoodbodyBucks Navigation Components
 * Reusable navigation logic and utilities
 */

const GBNavigation = {
    /**
     * Initialize landing page navigation
     */
    initLandingNav() {
        // Smooth scroll for anchor links
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                const target = document.querySelector(this.getAttribute('href'));
                if (target) {
                    const offset = 80; // Account for fixed navbar
                    const targetPosition = target.offsetTop - offset;
                    window.scrollTo({
                        top: targetPosition,
                        behavior: 'smooth'
                    });
                }
            });
        });

        // Add scroll effect to navbar
        const navbar = document.querySelector('.landing-navbar');
        if (navbar) {
            window.addEventListener('scroll', () => {
                if (window.scrollY > 50) {
                    navbar.classList.add('scrolled');
                } else {
                    navbar.classList.remove('scrolled');
                }
            });
        }

        // Highlight active section in navigation
        this.highlightActiveSection();
    },

    /**
     * Initialize app navigation
     */
    initAppNav() {
        // Update user info in navigation if available
        this.updateAppNavUserInfo();
        
        // Listen for auth state changes
        if (typeof firebase !== 'undefined' && firebase.auth) {
            firebase.auth().onAuthStateChanged((user) => {
                this.updateAppNavUserInfo(user);
            });
        }
    },

    /**
     * Update app navigation with user information
     */
    updateAppNavUserInfo(user) {
        const userInfoElement = document.getElementById('navUserInfo');
        if (!userInfoElement) return;

        if (user) {
            const displayName = user.displayName || user.email || 'User';
            const familyId = localStorage.getItem('familyId') || '';
            
            userInfoElement.innerHTML = `
                <span class="nav-user-role">${displayName}</span>
                ${familyId ? `<span style="opacity: 0.6;"> | ${familyId.substring(0, 8)}</span>` : ''}
            `;
            userInfoElement.style.display = 'block';
        } else {
            userInfoElement.style.display = 'none';
        }
    },

    /**
     * Highlight active section in landing page navigation
     */
    highlightActiveSection() {
        const sections = document.querySelectorAll('section[id]');
        const navLinks = document.querySelectorAll('.landing-navbar .nav-link');

        if (sections.length === 0 || navLinks.length === 0) return;

        window.addEventListener('scroll', () => {
            let current = '';
            const scrollY = window.pageYOffset;

            sections.forEach(section => {
                const sectionTop = section.offsetTop - 100;
                const sectionHeight = section.clientHeight;
                if (scrollY >= sectionTop && scrollY < sectionTop + sectionHeight) {
                    current = section.getAttribute('id');
                }
            });

            navLinks.forEach(link => {
                link.classList.remove('active');
                if (link.getAttribute('href') === `#${current}`) {
                    link.classList.add('active');
                }
            });
        });
    },

    /**
     * Create navigation breadcrumb
     */
    createBreadcrumb(items) {
        const breadcrumb = document.createElement('nav');
        breadcrumb.setAttribute('aria-label', 'breadcrumb');
        breadcrumb.style.cssText = 'padding: 8px 0; font-size: 14px; color: var(--nav-text-muted);';

        const breadcrumbList = items.map((item, index) => {
            if (index === items.length - 1) {
                return `<span style="color: var(--nav-primary);">${item.label}</span>`;
            }
            return `<a href="${item.url}" style="color: var(--nav-text-muted); text-decoration: none;">${item.label}</a>`;
        }).join(' <span style="opacity: 0.5;">/</span> ');

        breadcrumb.innerHTML = breadcrumbList;
        return breadcrumb;
    },

    /**
     * Toggle mobile menu (for future mobile-specific navigation)
     */
    toggleMobileMenu() {
        const menu = document.querySelector('.nav-mobile-menu');
        if (menu) {
            menu.classList.toggle('open');
        }
    },

    /**
     * Navigate with transition
     */
    navigateTo(url, transition = true) {
        if (transition) {
            document.body.style.opacity = '0.8';
            document.body.style.transition = 'opacity 0.2s';
            setTimeout(() => {
                window.location.href = url;
            }, 200);
        } else {
            window.location.href = url;
        }
    },

    /**
     * Get current page context
     */
    getCurrentPage() {
        const path = window.location.pathname;
        if (path === '/' || path === '/landing' || path.includes('landing.html')) {
            return 'landing';
        } else if (path === '/app' || path.includes('index.html')) {
            return 'app';
        }
        return 'unknown';
    },

    /**
     * Initialize navigation based on current page
     */
    init() {
        const page = this.getCurrentPage();
        console.log('[Navigation] Initializing for page:', page);

        if (page === 'landing') {
            this.initLandingNav();
        } else if (page === 'app') {
            this.initAppNav();
        }
    }
};

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => GBNavigation.init());
} else {
    GBNavigation.init();
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GBNavigation;
}

