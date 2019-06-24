import Auth from '@jetbrains/ring-ui/components/auth/auth';
import HTTP from '@jetbrains/ring-ui/components/http/http';
import linkStyles from '@jetbrains/ring-ui/components/link/link.css';
import Websandbox from 'websandbox';

import style from './style.css';

let hubConfig;
let auth;
let http;

export function init(installationProperties, config) {

  const SERVICE_FIELDS = 'id,name,applicationName,homeUrl,version';
  const DEFAULT_WIDTH = 290;
  const DEFAULT_HEIGHT = 265;

  if (hubConfig) {
    const newHubConfig = makeHubConfig(installationProperties);
    const nonMatchingMessage =
      getNonMatchingPropertyError(newHubConfig, hubConfig);
    if (nonMatchingMessage) {
      throw new Error(nonMatchingMessage);
    }
  } else {
    hubConfig = makeHubConfig(installationProperties);
  }

  auth = auth || new Auth(hubConfig);
  http = http || new HTTP(auth, null, {
    headers: {
      'Hub-API-Version': 3
    }
  });

  let services;
  let titleNode;
  let containerNode;

  return auth.init().then(renderWidgetNode);

  /*--- End of script, functions declarations ---*/

  function getNonMatchingPropertyError(oldHubConfig, currentHubConfig) {
    if (oldHubConfig.serverUri !== currentHubConfig.serverUri) {
      return getErrorMessageForNonMatchingProperty(
        'serverUri', oldHubConfig.serverUri, currentHubConfig.serverUri
      );
    }
    if (oldHubConfig.clientId !== currentHubConfig.clientId) {
      return getErrorMessageForNonMatchingProperty(
        'clientId', oldHubConfig.clientId, currentHubConfig.clientId
      );
    }
    if (oldHubConfig.redirectUri !== currentHubConfig.redirectUri) {
      return getErrorMessageForNonMatchingProperty(
        'redirectUri', oldHubConfig.redirectUri, currentHubConfig.redirectUri
      );
    }
    if (oldHubConfig.scope[0] !== currentHubConfig.scope[0]) {
      return getErrorMessageForNonMatchingProperty(
        'oldHubConfig.scope', oldHubConfig.scope[0], currentHubConfig.scope[0]
      );
    }
    return null;


    function getErrorMessageForNonMatchingProperty(
      propertyName, prevValue, currentValue
    ) {
      let errorMessage = `Error for widget "${installationProperties.widgetName}": All external hub widgets on a one page should be referenced to the same HUB and request same scope.`;
      errorMessage += ` But property "${propertyName}" is different with previously initialized widget: prev value = ${prevValue}; new value = ${currentValue}`;
      return errorMessage;
    }
  }


  function renderWidgetNode() {
    containerNode = createWidgetsIFrameContainer(
      installationProperties.width || DEFAULT_WIDTH,
      installationProperties.height || DEFAULT_HEIGHT
    );
    titleNode = containerNode.querySelector(`.${style.widgetTitleText}`);
    const domContainer = typeof installationProperties.domContainer === 'string'
      ? document.querySelector(installationProperties.domContainer)
      : installationProperties.domContainer;
    domContainer.appendChild(containerNode);

    return Websandbox.create(getDashboardApi(), {
      frameClassName: style.widgetFrame,
      frameContainer: containerNode.querySelector(`.${style.widgetBody}`),
      frameSrc: `${installationProperties.hubBaseUrl}/api/rest/widgets/${installationProperties.widgetName}/archive/index.html?locale=${installationProperties.locale}&editable=false`,
      sandboxAdditionalAttributes: 'allow-scripts allow-pointer-lock allow-top-navigation'
    });
  }

  function makeHubConfig(installationProps) {
    return {
      reloadOnUserChange: false,
      embeddedLogin: true,
      serverUri: installationProps.hubBaseUrl,
      clientId: installationProps.authClientId || '0-0-0-0-0',
      scope: [installationProps.authClientId || '0-0-0-0-0'],
      requestCredentials: 'skip',
      redirectUri: installationProps.redirectUri || `${window.location.origin}${window.location.pathname}`
    };
  }

  async function fetchHub(relativeURL, requestParams) {
    return await http.request(
      `${hubConfig.serverUri}/${relativeURL}`, requestParams
    );
  }

  async function loadServices(applicationName) {
    if (!services) {
      const data = await fetchHub(`api/rest/services?fields=${SERVICE_FIELDS}`);
      services = data && data.services;
    }
    return services.filter(service =>
      (!applicationName || service.applicationName === applicationName) &&
      service.homeUrl
    );
  }

  async function fetch(serviceId, relativeURL, requestParams) {
    const loadedServices = await loadServices();
    const currentService = (loadedServices || []).filter(
      service => service.id === serviceId
    )[0];
    if (!currentService) {
      throw new Error(`Could not find service with ID "${serviceId}". Make sure it is requested in widget's manifest.`);
    }
    return await http.request(`${currentService.homeUrl}/${relativeURL}`, requestParams);
  }

  function getDashboardApi() {
    return {
      setTitle: (text, url) => {
        titleNode.innerHTML = '';

        if (url) {
          const link = window.document.createElement('a');
          link.href = url;
          link.target = '_blank';
          link.innerText = text;
          link.className = linkStyles.link;
          titleNode.appendChild(link);
        } else {
          titleNode.innerText = text;
        }
      },

      setLoadingAnimationEnabled: isLoading => {
        containerNode.className = isLoading
          ? [style.widgetWrapper, style.widgetWrapperLoading].join(' ')
          : style.widgetWrapper;
      },

      enterConfigMode: () => {
        throw new Error('EnterConfigMode: Cannot manipulate with settings for widget in read-only mode');
      },
      exitConfigMode: () => {
        throw new Error('ExitConfigMode: Cannot manipulate with settings for widget in read-only mode');
      },

      setError: () => undefined,
      clearError: () => undefined,

      readCache: async () => undefined,
      storeCache: async () => undefined,

      readConfig: async () => config,
      storeConfig: async () => {
        throw new Error('StoreConfig: Cannot store config for widget in read-only mode');
      },

      fetch,
      fetchHub,

      loadServices,

      alert: () => undefined,
      removeWidget: () => {
        throw new Error('RemoveWidget: Cannot remove widget in read-only mode');
      }
    };
  }

  function createWidgetsIFrameContainer(width, height) {
    const container = createEmptyDiv(style.widgetWrapper);
    container.style.width = `${width}px`;

    const title = createEmptyDiv(style.widgetTitle);
    const titleText = createEmptyDiv(style.widgetTitleText);
    title.appendChild(titleText);

    const body = createEmptyDiv(style.widgetBody);
    body.style.height = `${height}px`;
    container.appendChild(title);
    container.appendChild(body);
    container.appendChild(createEmptyDiv(style.widgetLoader));

    return container;

    function createEmptyDiv(className) {
      const node = window.document.createElement('div');
      node.className = className;
      return node;
    }
  }
}
