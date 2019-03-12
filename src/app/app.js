import Auth from '@jetbrains/ring-ui/components/auth/auth';
import showAuthDialog from '@jetbrains/ring-ui/components/auth-dialog-service/auth-dialog-service';
import HTTP from '@jetbrains/ring-ui/components/http/http';
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
    requestCredentials: 'silent',
    redirectUri: `${window.location.origin}/`
  };

  const auth = new Auth(hubConfig);
  auth.setAuthDialogService(showAuthDialog);

  const http = new HTTP(auth, null, {
    headers: {
      'Hub-API-Version': 3
    }
  });

  let services;

  return auth.init().then(() => {
    const container = createWidgetsIFrameContainer(
      installationProperties.width || DEFAULT_WIDTH,
      installationProperties.height || DEFAULT_HEIGHT
    );
    installationProperties.domContainer.appendChild(container);

    return Websandbox.create(getDashboardApi(), {
      frameClassName: style.widgetFrame,
      frameContainer: container.querySelector(`.${style.widgetBody}`),
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
      setTitle: () => undefined,
      setLoadingAnimationEnabled: () => undefined,

      enterConfigMode: () => undefined,
      exitConfigMode: () => undefined,

      setError: () => undefined,
      clearError: () => undefined,

      readCache: async () => {},
      storeCache: async () => {
        throw new Error('Cannot store cache for widget is in read-only mode');
      },

      readConfig: async () => config,
      storeConfig: async () => {
        throw new Error('Cannot store config for widget in read-only mode');
      },

      fetch,
      fetchHub,

      loadServices,

      alert: () => undefined,
      removeWidget: () => {
        throw new Error('Cannot remove widget in read-only mode');
      }
    };
  }

  function createWidgetsIFrameContainer(width, height) {
    const container = createEmptyDiv(style.widgetWrapper);
    container.style.width = `${width}px`;
    container.style.height = `${height}px`;

    const title = createEmptyDiv(style.widgetTitle);
    const body = createEmptyDiv(style.widgetBody);
    container.appendChild(title);
    container.appendChild(body);

    return container;

    function createEmptyDiv(className) {
      const node = window.document.createElement('div');
      node.className = className;
      return node;
    }
  }
}
