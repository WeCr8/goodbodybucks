/**
 * GoodbodyBucks Analytics Configuration
 * Centralized analytics tracking for Firebase Analytics and Google Analytics 4
 */

// Firebase Analytics instance (will be initialized after Firebase app)
let analytics = null;

/**
 * Initialize Firebase Analytics
 * Call this after Firebase app is initialized
 */
function initializeAnalytics(firebaseApp) {
  try {
    // Initialize Firebase Analytics
    analytics = firebase.analytics();
    console.log('[Analytics] ✅ Firebase Analytics initialized');
    
    // Log initial app open
    logAnalyticsEvent('app_open', {
      timestamp: new Date().toISOString(),
      url: window.location.href,
      referrer: document.referrer || 'direct'
    });
    
    // Set default user properties
    analytics.setUserProperties({
      app_version: '1.0.0',
      platform: 'web'
    });
    
    return analytics;
  } catch (error) {
    console.error('[Analytics] ❌ Failed to initialize:', error);
    return null;
  }
}

/**
 * Log custom analytics event
 * Automatically logs to both Firebase Analytics and console
 */
function logAnalyticsEvent(eventName, params = {}) {
  try {
    // Add timestamp to all events
    const eventData = {
      ...params,
      event_timestamp: new Date().toISOString(),
      page_path: window.location.pathname,
      page_url: window.location.href
    };
    
    // Log to Firebase Analytics
    if (analytics) {
      analytics.logEvent(eventName, eventData);
      console.log(`[Analytics] 📊 Event: ${eventName}`, eventData);
    } else {
      console.warn(`[Analytics] ⚠️ Analytics not initialized. Event: ${eventName}`, eventData);
    }
    
    // Also log to dataLayer for Google Analytics (if present)
    if (window.dataLayer) {
      window.dataLayer.push({
        event: eventName,
        ...eventData
      });
    }
  } catch (error) {
    console.error(`[Analytics] ❌ Error logging event ${eventName}:`, error);
  }
}

/**
 * Track page views
 */
function trackPageView(pageName, additionalParams = {}) {
  logAnalyticsEvent('page_view', {
    page_title: document.title,
    page_name: pageName,
    ...additionalParams
  });
}

/**
 * Track user login
 */
function trackLogin(method, role, userId) {
  logAnalyticsEvent('login', {
    method: method,
    role: role,
    user_id: userId
  });
  
  // Set user ID for analytics
  if (analytics && userId) {
    analytics.setUserId(userId);
  }
}

/**
 * Track user signup
 */
function trackSignup(method, role) {
  logAnalyticsEvent('sign_up', {
    method: method,
    role: role
  });
}

/**
 * Track purchases
 */
function trackPurchase(itemType, itemId, itemName, cost, currency = 'GBD') {
  logAnalyticsEvent('purchase', {
    item_type: itemType,
    item_id: itemId,
    item_name: itemName,
    value: cost,
    currency: currency,
    transaction_id: `${Date.now()}_${itemId}`
  });
}

/**
 * Track earnings/rewards
 */
function trackEarning(rewardType, rewardId, rewardName, amount) {
  logAnalyticsEvent('earn_virtual_currency', {
    virtual_currency_name: 'GoodbodyBucks',
    value: amount,
    reward_type: rewardType,
    reward_id: rewardId,
    reward_name: rewardName
  });
}

/**
 * Track consequences
 */
function trackConsequence(consequenceType, kidName, consequenceId, consequenceLabel) {
  logAnalyticsEvent('apply_consequence', {
    consequence_type: consequenceType,
    kid_name: kidName,
    consequence_id: consequenceId,
    consequence_label: consequenceLabel
  });
}

/**
 * Track family setup
 */
function trackFamilySetup(familyId, familyName, memberCount) {
  logAnalyticsEvent('family_created', {
    family_id: familyId,
    family_name: familyName,
    member_count: memberCount
  });
}

/**
 * Track errors
 */
function trackError(errorContext, errorMessage, errorCode = null) {
  logAnalyticsEvent('error_occurred', {
    error_context: errorContext,
    error_message: errorMessage,
    error_code: errorCode,
    fatal: false
  });
}

/**
 * Track session start/stop
 */
function trackSession(action, mode, duration = null) {
  logAnalyticsEvent(`session_${action}`, {
    session_mode: mode,
    duration_seconds: duration
  });
}

/**
 * Track wallet view
 */
function trackWalletView(kidName, balance, minutes, savingsBalance, spendingBalance) {
  logAnalyticsEvent('view_wallet', {
    kid_name: kidName,
    balance: balance,
    minutes: minutes,
    savings_balance: savingsBalance,
    spending_balance: spendingBalance
  });
}

/**
 * Track menu interactions
 */
function trackMenuInteraction(menuType, action) {
  logAnalyticsEvent('menu_interaction', {
    menu_type: menuType,
    action: action
  });
}

/**
 * Track navigation
 */
function trackNavigation(fromPage, toPage, navigationMethod) {
  logAnalyticsEvent('navigation', {
    from_page: fromPage,
    to_page: toPage,
    method: navigationMethod
  });
}

/**
 * Set custom user properties
 */
function setUserProperty(propertyName, value) {
  if (analytics) {
    const properties = {};
    properties[propertyName] = value;
    analytics.setUserProperties(properties);
    console.log(`[Analytics] 👤 User property set: ${propertyName} = ${value}`);
  }
}

/**
 * Track custom conversion events
 */
function trackConversion(conversionType, value = null) {
  logAnalyticsEvent('conversion', {
    conversion_type: conversionType,
    value: value
  });
}

/**
 * Screen time tracking
 */
function trackScreenTime(action, minutes, cost = null) {
  logAnalyticsEvent('screen_time', {
    action: action,
    minutes: minutes,
    cost: cost
  });
}

// Export functions for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initializeAnalytics,
    logAnalyticsEvent,
    trackPageView,
    trackLogin,
    trackSignup,
    trackPurchase,
    trackEarning,
    trackConsequence,
    trackFamilySetup,
    trackError,
    trackSession,
    trackWalletView,
    trackMenuInteraction,
    trackNavigation,
    setUserProperty,
    trackConversion,
    trackScreenTime
  };
}

