import Auth from '@jetbrains/ring-ui/components/auth/auth';
import HTTP from '@jetbrains/ring-ui/components/http/http';
import linkStyles from '@jetbrains/ring-ui/components/link/link.css';
import Websandbox from 'websandbox';

import style from './style.css';

export function init(installationProperties, config) {

  const SERVICE_FIELDS = 'id,name,applicationName,homeUrl,version';
  const DEFAULT_WIDTH = 290;
  const DEFAULT_HEIGHT = 265;

  const hubConfig = {
    reloadOnUserChange: false,
    embeddedLogin: true,
    serverUri: installationProperties.hubBaseUrl,
    clientId: installationProperties.authClientId || '0-0-0-0-0',
    scope: [installationProperties.authClientId || '0-0-0-0-0'],
    requestCredentials: 'skip',
    redirectUri: installationProperties.redirectUri ||
      `${window.location.origin}${window.location.pathname}`
  };

  const auth = new Auth(hubConfig);
  const http = new HTTP(auth, null, {
    headers: {
      'Hub-API-Version': 3
    }
  });

  let services;
  let titleNode;
  let containerNode;

  return auth.init().then(() => {
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
  });

  /*--- End of script, functions declarations ---*/

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
