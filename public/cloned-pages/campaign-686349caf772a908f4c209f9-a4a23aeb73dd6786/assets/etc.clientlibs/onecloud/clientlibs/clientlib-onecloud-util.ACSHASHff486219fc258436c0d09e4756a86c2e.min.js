class OneCloudUtil {
  /**
   * Get the API endpoint for the OneCloud Data Connector.
   * @param {string} path - The path to append to the API endpoint.
   * @param {string} querystring - The query string to add to the API endpoint.
   * @returns {string} - The API endpoint with the environment specific query parameters.
   */
  static getMsocapiurl = (path, querystring) => {
    let url = `${OneCloudEnvironmentConstants.DataConnector.endpoint}${path}`;

    // Add passed query string.
    if (querystring && querystring.length > 0) {
      url += `?${querystring}`;
    }

    // Add environment specific query parameters and return.
    return OneCloudUtil.addEnvironmentSpecificQueryParams(url);
  };

  /**
   * Add environment specific query parameters to the url.
   * @param {string} url - The url to add the query parameters to.
   * @returns {string} - The url with the environment specific query parameters.
   */
  static addEnvironmentSpecificQueryParams = (url) => {
    let envQueryParamKeys = Object.keys(
      OneCloudEnvironmentConstants.DataConnector.queryParams
    );
    envQueryParamKeys.forEach((key) => {
      if (url.indexOf("?") !== -1) url += "&";
      url += `${key}=${OneCloudEnvironmentConstants.DataConnector.queryParams[key]}`;
    });
    return url;
  };

  /**
   * Wait for an element to be available in the DOM, and return a promise that resolves when the element is available.
   * @param {string} selector - The selector for the element to wait for.
   * @param {HTMLElement} containerElement - The container element to search within. Defaults to document.
   * @returns {Promise} - A promise that resolves when the element is available.
   */
  static waitForElement = (selector, containerElement) => {
    containerElement = containerElement || document;
    const elementToObserve =
      containerElement === document ? document.body : containerElement;

    return new Promise((resolve) => {
      if (containerElement.querySelector(selector)) {
        return resolve(containerElement.querySelector(selector));
      }

      const observer = new MutationObserver(() => {
        if (containerElement.querySelector(selector)) {
          observer.disconnect();
          resolve(containerElement.querySelector(selector));
        }
      });

      observer.observe(elementToObserve, {
        childList: true,
        subtree: true,
      });
    });
  };

  /**
   * Send telemetry overrides for a certain component.
   *
   * @param {number} behaviorId - The behavior ID for the telemetry event.
   * @param {string} actionType - The action type for the telemetry event.
   * @param {object} contentTags - The content tags for the telemetry event.
   */
  static sendTelemetry(behaviorId, actionType, contentTags) {
    let analytics;

    if (typeof telemetry !== "undefined") {
      // AEM
      analytics = telemetry.webAnalyticsPlugin;
    }

    if (analytics !== null) {
      const overrides = {
        behavior: behaviorId,
        actionType: actionType,
        contentTags: contentTags,
      };
      analytics.capturePageAction(null, overrides);
    }
  }

  /**
   * Generates a version 4 UUID (Universally Unique Identifier).
   * @returns {string} A randomly generated version 4 UUID.
   */
  static generateUniqueIdentifier() {
    return (
      crypto.randomUUID() ||
      ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
        (
          c ^
          (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))
        ).toString(16)
      )
    );
  }

  /**
   * Converts a UTC date string into a formatted object with date, time, and time zone abbreviation.
   *
   * @param {string} utcString - The UTC date string.
   * @param {string} locale - The locale used for date/time formatting.
   * @returns {Object} - An object containing formatted date, time, timeZoneAbbr, and raw Date.
   */
  static formatUTCDateToLongDateTime(utcString, locale) {
    const date = new Date(utcString);
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const timeFormatter = new Intl.DateTimeFormat(locale, {
      timeZone,
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    });

    const formattedTime = timeFormatter.format(date);

    const tzFormatter = new Intl.DateTimeFormat(locale, {
      timeZone,
      timeZoneName: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

    const parts = tzFormatter.formatToParts(date);
    const tzAbbr = parts.find(p => p.type === 'timeZoneName')?.value || '';

    return {
      date: date.toISOString().split('T')[0],
      time: formattedTime,
      timeZoneAbbr: tzAbbr,
      raw: date,
    };
  }
}
