import Auth from '@jetbrains/ring-ui/components/auth/auth';
import HTTP from '@jetbrains/ring-ui/components/http/http';
import linkStyles from '@jetbrains/ring-ui/components/link/link.css';
import alertStyles from '@jetbrains/ring-ui/components/alert/alert.css';
import alertContainerStyles from '@jetbrains/ring-ui/components/alert/container.css';
import iconStyles from '@jetbrains/ring-ui/components/icon/icon.css';
import classNames from 'classnames';
import Websandbox from 'websandbox';
import CheckmarkIcon from '@jetbrains/icons/checkmark.svg';
import WarningIcon from '@jetbrains/icons/warning.svg';
import ExceptionIcon from '@jetbrains/icons/exception.svg';

import style from './style.css';

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
        alert('EnterConfigMode: Cannot manipulate with settings for widget in read-only mode', 'warning');
      },
      exitConfigMode: () => {
        alert('ExitConfigMode: Cannot manipulate with settings for widget in read-only mode', 'warning');
      },

      setError: () => undefined,
      clearError: () => undefined,

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

  function createAlertContainerNode() {
    const alertContainer = window.document.createElement('div');
    alertContainer.className = classNames(
      alertContainerStyles.alertContainer
    );

    document.body.appendChild(alertContainer);
    return alertContainer;
  }

  function alert(text, type, displayTimeout) {
    const alertNode = window.document.createElement('div');
    alertNode.className = classNames({
      [alertStyles.alert]: true,
      [alertContainerStyles.alertInContainer]: true,
      [alertStyles.error]: type === 'error'
    });
    const alertNodeLabel = window.document.createElement('span');
    alertNodeLabel.className = classNames(
      alertStyles.caption, style.widgetAlertCaption
    );
    alertNodeLabel.innerText = text;

    if (type === 'warning' || type === 'error' || type === 'success') {
      const iconNode = window.document.createElement('span');
      iconNode.className = classNames(
        alertStyles.icon,
        iconStyles.glyph,
        iconStyles.icon,
        style.widgetAlertIcon, {
          [iconStyles.green]: type === 'success',
          [iconStyles.red]: type === 'error',
          [iconStyles.gray]: type === 'warning'
        }
      );
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
}
