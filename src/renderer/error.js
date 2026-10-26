(function () {
  'use strict';

  const astra = window.astra || window.quantum;
  const params = new URLSearchParams(window.location.search);

  const isGameMode = params.get('game') === '1' || params.get('game') === 'true';
  const errorCode = isGameMode ? 'ASTRA_ARCADE_MODE' : (params.get('code') || 'ERR_CONNECTION_FAILED');
  const errorNum = isGameMode ? '001' : (params.get('num') || '-100');
  const targetUrl = isGameMode ? 'astra://game' : (params.get('url') || 'about:blank');

  const elCodeBadge = document.getElementById('error-code-text');
  const elTargetUrl = document.getElementById('target-url-text');
  const elSummary = document.getElementById('error-summary-text');
  const elTroubleList = document.getElementById('trouble-list');
  const elTelStatus = document.getElementById('tel-status');
  const elTelCode = document.getElementById('tel-code');
  const elTelTime = document.getElementById('tel-time');

  const btnRetry = document.getElementById('btn-retry');
  const btnSearch = document.getElementById('btn-search');
  const btnHome = document.getElementById('btn-home');
  const gameLaunchStrip = document.getElementById('game-launch-strip');

  const ERROR_MAP = {
    ASTRA_ARCADE_MODE: {
      status: 'ARCADE_STANDALONE',
      summary: 'Astra // Void Runner is active. Navigate the infinite cybernetic void and beat your high score.',
      tips: [
        'Press Space / Up Arrow to Boost & Double-Jump.',
        'Press Down Arrow to Dive beneath floating barriers.',
        'Collect glowing green energy orbs for bonus telemetry points.'
      ],
    },
    ERR_NAME_NOT_RESOLVED: {
      status: 'DNS_RESOLVE_FAILURE',
      summary: 'DNS address resolution failed. The remote server domain name could not be located in domain registries.',
      tips: [
        'Confirm spelling of destination hostname and protocol port.',
        'Flush local DNS cache and verify gateway DNS server settings.',
        'Verify physical network cable or Wi-Fi uplink status.'
      ],
    },
    ERR_INTERNET_DISCONNECTED: {
      status: 'UPLINK_DISCONNECTED',
      summary: 'No active network uplink detected. AstraForx cannot reach local gateway or external internet.',
      tips: [
        'Check network adapters, Wi-Fi connectivity, or Ethernet cable.',
        'Reboot gateway modem or router.',
        'Play Astra // Void Runner above while awaiting reconnection!'
      ],
    },
    ERR_CONNECTION_REFUSED: {
      status: 'PORT_CONN_REFUSED',
      summary: 'Connection rejected. The remote host actively refused the connection on target port.',
      tips: [
        'The remote web server software might be offline or undergoing maintenance.',
        'If running localhost, ensure the local web server process is running.',
        'Check local firewall and antivirus port blocking settings.'
      ],
    },
    ERR_CONNECTION_TIMED_OUT: {
      status: 'GATEWAY_TIMEOUT',
      summary: 'Connection timed out. Remote host failed to acknowledge socket connection within threshold.',
      tips: [
        'The remote host is experiencing high network latency or traffic overload.',
        'Verify your network bandwidth and proxy configuration.',
        'Retry in a few moments.'
      ],
    },
    ERR_CONNECTION_RESET: {
      status: 'CONN_RESET_BY_PEER',
      summary: 'Connection reset. The established socket was unexpectedly closed by remote host or proxy gateway.',
      tips: [
        'A proxy, VPN, or network firewall may have terminated the session.',
        'Disable active VPN tunnel or proxy and retry.',
        'Verify remote site availability.'
      ],
    },
    ERR_SSL_PROTOCOL_ERROR: {
      status: 'SSL_HANDSHAKE_FAIL',
      summary: 'SSL/TLS Handshake failure. A secure encrypted transmission channel could not be negotiated.',
      tips: [
        'Ensure system clock time and timezone are accurate.',
        'The remote server may be using an unsupported or deprecated cipher suite.',
        'Check for interception by local network proxies.'
      ],
    },
    ERR_CERT_COMMON_NAME_INVALID: {
      status: 'CERT_NAME_MISMATCH',
      summary: 'SSL Certificate Mismatch. The domain name on the presented certificate does not match the target host.',
      tips: [
        'Someone may be attempting to intercept your connection (Man-In-The-Middle).',
        'The website owner may have configured the SSL certificate incorrectly.',
        'Do not submit sensitive credentials or passwords on this site.'
      ],
    },
    ERR_TOO_MANY_REDIRECTS: {
      status: 'REDIRECT_LOOP',
      summary: 'Redirect loop detected. The server redirected the client too many times in an infinite loop.',
      tips: [
        'Clear cookies and cached data for this domain.',
        'The site configuration is caught in an internal redirection loop.'
      ],
    },
    ERR_EMPTY_RESPONSE: {
      status: 'ZERO_BYTE_RESPONSE',
      summary: 'Zero data received. The remote server closed the connection without delivering any payload.',
      tips: [
        'The remote web application crashed or terminated unexpectedly.',
        'Try reloading the page in a few moments.'
      ],
    },
  };

  const info = ERROR_MAP[errorCode] || {
    status: 'REQUEST_FAILED',
    summary: `Page request failed with error ${errorCode} (${errorNum}).`,
    tips: [
      'Check destination URL and network connection.',
      'Check firewall and proxy settings.'
    ],
  };

  if (elCodeBadge) elCodeBadge.textContent = errorCode;
  if (elTargetUrl) elTargetUrl.textContent = targetUrl;
  if (elSummary) elSummary.textContent = info.summary;
  if (elTelStatus) elTelStatus.textContent = info.status;
  if (elTelCode) elTelCode.textContent = `${errorNum} (${errorCode})`;
  if (elTelTime) elTelTime.textContent = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';

  if (elTroubleList && info.tips) {
    elTroubleList.innerHTML = '';
    info.tips.forEach((tip) => {
      const li = document.createElement('li');
      li.textContent = tip;
      elTroubleList.appendChild(li);
    });
  }

  // Button actions
  if (btnRetry) {
    btnRetry.addEventListener('click', () => {
      if (astra && astra.go) {
        astra.go(targetUrl);
      } else {
        window.location.href = targetUrl;
      }
    });
  }

  if (btnSearch) {
    btnSearch.addEventListener('click', () => {
      let query = targetUrl;
      try {
        const u = new URL(targetUrl);
        query = u.hostname || targetUrl;
      } catch (_) {}
      const searchUrl = 'https://www.google.com/search?q=' + encodeURIComponent(query);
      if (astra && astra.go) {
        astra.go(searchUrl);
      } else {
        window.location.href = searchUrl;
      }
    });
  }

  if (btnHome) {
    btnHome.addEventListener('click', () => {
      if (astra && astra.go) {
        astra.go('astra://newtab');
      } else {
        window.location.href = 'newtab.html';
      }
    });
  }

  // Initialize Minigame
  if (window.AstraRunner && window.AstraRunner.init) {
    window.AstraRunner.init();

    if (gameLaunchStrip) {
      gameLaunchStrip.addEventListener('click', () => {
        window.AstraRunner.start();
      });
    }

    if (isGameMode) {
      window.AstraRunner.start();
    }
  }
})();
