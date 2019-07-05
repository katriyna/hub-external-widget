import Auth from '@jetbrains/ring-ui/components/auth/auth';
import HTTP from '@jetbrains/ring-ui/components/http/http';
import linkStyles from '@jetbrains/ring-ui/components/link/link.css';
import alertStyles from '@jetbrains/ring-ui/components/alert/alert.css';
import alertContainerStyles from '@jetbrains/ring-ui/components/alert/container.css';
import iconStyles from '@jetbrains/ring-ui/components/icon/icon.css';
import classNames from 'classnames';
import Websandbox from 'websandbox';
import CheckmarkIcon from '@jetbrains/icons/checkmark.svg';
import WarningIcon from '@jetbrains/icons/warning-14px.svg';
import UpdateIcon from '@jetbrains/icons/update.svg';
import ExceptionIcon from '@jetbrains/icons/exception.svg';
import YouTrackIcon from '@jetbrains/logos/youtrack/youtrack.svg';
import TeamCityIcon from '@jetbrains/logos/teamcity/teamcity.svg';
import UpsourceIcon from '@jetbrains/logos/upsource/upsource.svg';
import HubIcon from '@jetbrains/logos/hub/hub.svg';

import style from './style.css';

const SERVICE_ICONS = {
  YouTrack: YouTrackIcon,
  Upsource: UpsourceIcon,
  TeamCity: TeamCityIcon,
  Hub: HubIcon
};

let hubConfig;
let auth;
let http;
let alertContainerNode;

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
  alertContainerNode = alertContainerNode || createAlertContainerNode();

  let services;
  let titleNode;
  let titleTextNode;
  let titleErrorNode;
  let titleLogoNode;
  let refreshControlNode;
  let containerNode;

  return auth.init().
    then(() => loadWidgetManifest()).
    then(manifest => renderWidgetNode(manifest)).
    then(widgetApi => {
      if (widgetApi.onRefresh) {
        enableWidgetRefreshControl(widgetApi.onRefresh);
      }
      return widgetApi;
    });

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


  function renderWidgetNode(manifest) {
    containerNode = createWidgetsIFrameContainer(
      installationProperties.width || DEFAULT_WIDTH,
      installationProperties.height || DEFAULT_HEIGHT
    );
    titleNode = containerNode.querySelector(`.${style.widgetTitle}`);
    titleTextNode = titleNode.querySelector(`.${style.widgetTitleTextPlaceholder}`);
    titleErrorNode = titleNode.querySelector(`.${style.widgetError}`);
    titleLogoNode = titleNode.querySelector(`.${style.widgetLogo}`);
    refreshControlNode = titleNode.querySelector(`.${style.widgetRefreshControl}`);
    const domContainer = typeof installationProperties.domContainer === 'string'
      ? document.querySelector(installationProperties.domContainer)
      : installationProperties.domContainer;
    domContainer.appendChild(containerNode);

    setLogo(manifest);

    const {capabilities = {}} = manifest;
    const sandboxAdditionalAttributes = [
      'allow-pointer-lock',
      capabilities.topNavigation && 'allow-top-navigation',
      capabilities.popups && 'allow-popups allow-popups-to-escape-sandbox'
    ].filter(it => !!it).join(' ');

    const sandbox = Websandbox.create(getDashboardApi(), {
      frameClassName: style.widgetFrame,
      frameContainer: containerNode.querySelector(`.${style.widgetBody}`),
      frameSrc: `${installationProperties.hubBaseUrl}/api/rest/widgets/${installationProperties.widgetName}/archive/index.html?locale=${installationProperties.locale}&editable=false`,
      sandboxAdditionalAttributes
    });

    return sandbox.connection.remoteMethodsWaitPromise.
      then(() => (sandbox.connection.remote || {}));
  }

  function enableWidgetRefreshControl(onRefresh) {
    refreshControlNode.className = classNames(
      style.widgetRefreshControl, style.widgetRefreshControlActive
    );
    refreshControlNode.addEventListener('click', () => onRefresh());
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
        titleTextNode.innerHTML = '';

        if (url) {
          const link = window.document.createElement('a');
          link.href = url;
          link.target = '_blank';
          link.innerText = text;
          link.className = linkStyles.link;
          titleTextNode.appendChild(link);
        } else {
          titleTextNode.innerText = text;
        }
      },

      setLoadingAnimationEnabled: isLoading => {
        containerNode.className = classNames({
          [style.widgetWrapper]: true,
          [style.widgetWrapperLoading]: isLoading
        });

        if (isActiveRefreshControlNode()) {
          refreshControlNode.className = classNames({
            [style.widgetRefreshControl]: true,
            [style.widgetRefreshControlActive]: true,
            [style.widgetRefreshControlLoading]: isLoading
          });
        }

        function isActiveRefreshControlNode() {
          return refreshControlNode.className.indexOf(
            style.widgetRefreshControlActive
          ) > -1;
        }
      },

      enterConfigMode: () => {
        alert('EnterConfigMode: Cannot manipulate with settings for widget in read-only mode', 'warning');
      },
      exitConfigMode: () => {
        alert('ExitConfigMode: Cannot manipulate with settings for widget in read-only mode', 'warning');
      },

      setError,
      clearError,

      readCache: async () => undefined,
      storeCache: async () => undefined,

      readConfig: async () => config,
      storeConfig: async () => {
        alert('StoreConfig: Cannot store config for widget in read-only mode', 'warning');
      },

      fetch,
      fetchHub,

      loadServices,

      alert,
      removeWidget: () => {
        alert('RemoveWidget: Cannot remove widget in read-only mode', 'warning');
      }
    };
  }

  function createWidgetsIFrameContainer(width, height) {
    const container = createEmptyDiv(style.widgetWrapper);
    container.style.width = `${width}px`;

    const title = createEmptyDiv(style.widgetTitle);
    const titleText = createEmptyDiv(style.widgetTitleText);
    const titleLogo = createEmptySpan(style.widgetLogo);
    const titleError = createEmptySpan(
      classNames(style.widgetError, iconStyles.red)
    );
    titleText.appendChild(titleLogo);
    titleText.appendChild(titleError);
    titleText.appendChild(createEmptySpan(style.widgetTitleTextPlaceholder));
    title.appendChild(titleText);

    const updateIconPlaceholder = createEmptySpan(style.widgetRefreshControl);
    updateIconPlaceholder.innerHTML = UpdateIcon;
    title.appendChild(updateIconPlaceholder);

    const body = createEmptyDiv(style.widgetBody);
    body.style.height = `${height}px`;
    container.appendChild(title);
    container.appendChild(body);
    container.appendChild(createEmptyDiv(style.widgetLoader));

    return container;
  }

  function createAlertContainerNode() {
    const alertContainer = window.document.createElement('div');
    alertContainer.className = classNames(
      alertContainerStyles.alertContainer
    );

    document.body.appendChild(alertContainer);
    return alertContainer;
  }

  function alert(text, type, displayTimeout) {
    const alertNode = createEmptyDiv(classNames({
      [alertStyles.alert]: true,
      [alertContainerStyles.alertInContainer]: true,
      [alertStyles.error]: type === 'error'
    }));
    const alertNodeLabel = createEmptySpan(
      classNames(alertStyles.caption, style.widgetAlertCaption)
    );
    alertNodeLabel.innerText = text;

    if (type === 'warning' || type === 'error' || type === 'success') {
      const iconNode = createEmptySpan(classNames(
        alertStyles.icon,
        iconStyles.glyph,
        iconStyles.icon,
        style.widgetAlertIcon, {
          [iconStyles.green]: type === 'success',
          [iconStyles.red]: type === 'error',
          [iconStyles.gray]: type === 'warning'
        }
      ));
      iconNode.innerHTML = {
        warning: WarningIcon,
        error: ExceptionIcon,
        success: CheckmarkIcon
      }[type];

      alertNode.append(iconNode);
    }
    alertNode.append(alertNodeLabel);
    alertContainerNode.append(alertNode);

    const defaultDisplayTimeout = 3000;
    setInterval(() => {
      alertNode.className += ` ${alertStyles.animationClosing}`;
    }, displayTimeout || defaultDisplayTimeout);
  }

  function setError(err) {
    if (err) {
      titleErrorNode.innerHTML = WarningIcon;
      titleErrorNode.title = err.data || err.message || '';
    }
  }

  function clearError() {
    titleErrorNode.innerHTML = '';
  }

  function setLogo(manifest) {
    if (manifest.iconUrl) {
      const img = new Image();
      img.src = `${installationProperties.hubBaseUrl}/api/rest/widgets/${installationProperties.widgetName}/archive/${manifest.iconUrl}`;
      img.width = 16;
      titleLogoNode.append(img);
    } else if (SERVICE_ICONS[manifest.applicationName]) {
      titleLogoNode.innerHTML = SERVICE_ICONS[manifest.applicationName];
    }
  }

  async function loadWidgetManifest() {
    const manifestUrl = `api/rest/widgets/${installationProperties.widgetName}/archive/manifest.json`;
    return await fetchHub(manifestUrl);
  }

  function createEmptyDiv(className) {
    return createEmptyNode('div', className);
  }

  function createEmptySpan(className) {
    return createEmptyNode('span', className);
  }

  function createEmptyNode(tagName, className) {
    const node = window.document.createElement(tagName);
    node.className = className;
    return node;
  }
}
