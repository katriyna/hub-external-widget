import Auth from '@jetbrains/ring-ui/components/auth/auth';
import showAuthDialog from '@jetbrains/ring-ui/components/auth-dialog-service/auth-dialog-service';
import HTTP from '@jetbrains/ring-ui/components/http/http';
import '@jetbrains/ring-ui/components/global/variables.css';
import Websandbox from 'websandbox';

export function init(installationProperties, config) {

  var SERVICE_FIELDS = 'id,name,applicationName,homeUrl,version';

  var DEFAULT_WIDTH = 290;
  var DEFAULT_HEIGHT = 265;

  var hubConfig = {
    reloadOnUserChange: false,
    embeddedLogin: true,
    serverUri: installationProperties.hubBaseUrl,
    clientId: installationProperties.authClientId || '0-0-0-0-0',
    scope: [installationProperties.authClientId || '0-0-0-0-0'],
    requestCredentials: 'silent',
    redirectUri: `${window.location.origin}/`
  };

  var auth = new Auth(hubConfig);
  auth.setAuthDialogService(showAuthDialog);

  var http = new HTTP(auth, null, {
    headers: {
      'Hub-API-Version': 3
    }
  });

  var fetchHub = async (relativeURL, requestParams) =>
    await http.request(
      `${hubConfig.serverUri}/${relativeURL}`, requestParams
    );

  var services;
  var loadServices = async applicationName => {
    if (!services) {
      var data = await fetchHub(`api/rest/services?fields=${SERVICE_FIELDS}`);
      services = data && data.services;
    }
    return services.filter(service =>
      (!applicationName || service.applicationName === applicationName) &&
      service.homeUrl
    );
  };

  var fetch = async (serviceId, relativeURL, requestParams) => {
    var loadedServices = await loadServices();
    var currentService = (loadedServices || []).filter(
      service => service.id === serviceId
    )[0];
    if (!currentService) {
      throw new Error(`Could not find service with ID "${serviceId}". Make sure it is requested in widget's manifest.`);
    }
    return http.request(`${currentService.homeUrl}/${relativeURL}`, requestParams);
  };

  auth.init().then(function() {
    var dashboardApi = {
      setTitle: () => undefined,
      setLoadingAnimationEnabled: () => undefined,

      enterConfigMode: () => undefined,
      exitConfigMode: () => undefined,

      setError: () => undefined,
      clearError: () => undefined,

      readCache: async () => {},
      storeCache: async () => {
        throw new Error('Widget is in read-only mode');
      },

      readConfig: async () => config,
      storeConfig: async () => {
        throw new Error('Widget is in read-only mode');
      },

      fetch,
      fetchHub,

      loadServices,

      alert: () => undefined,
      removeWidget: () => undefined
    };

    return Websandbox.create(dashboardApi, {
      frameClassName: 'standalone-widget',
      frameStyle: getFrameStyle(
        installationProperties.width || DEFAULT_WIDTH,
        installationProperties.height || DEFAULT_HEIGHT
      ),
      frameContainer: installationProperties.domContainer,
      frameSrc: `${installationProperties.hubBaseUrl}/api/rest/widgets/${installationProperties.widgetName}/archive/index.html?locale=${installationProperties.locale}&editable=false`,
      sandboxAdditionalAttributes: 'allow-scripts allow-pointer-lock allow-top-navigation'
    });

    function getFrameStyle(width, height) {
      return [
        'width: ', width, 'px;',
        'height: ', height, 'px;',
        'border: 1px solid var(--ring-borders-color);',
        'border-radius: var(--ring-border-radius);',
        'padding: 1px 0;'
      ].join('');
    }
  });
};
