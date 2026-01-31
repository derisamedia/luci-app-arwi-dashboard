'use strict';
'require fs';
'require rpc';
'require ui';
'require uci';

var callSystemInfo = rpc.declare({
    object: 'system',
    method: 'info'
});

// Use window object to strictly persist state across view reloads/module evaluations
if (!window.arwiDashboardState) {
    window.arwiDashboardState = {
        cpuLast: null,
        cpuPercent: 0,
        cpuText: '-',
        ramPercent: 0,
        ramText: '-',
        tempVal: 0,
        tempText: '-',
        netStatus: 'WAIT',
        netClass: 'status-text',
        netStroke: 'net-stroke-off',
        trafficText: '-'
    };
}

return L.view.extend({
    title: '',

    load: function () {
        return Promise.all([
            uci.load('arwi_dashboard'),
            callSystemInfo().catch(function (e) { return null; }),
            fs.read('/proc/stat').catch(function (e) { return null; }),
            fs.read('/sys/class/thermal/thermal_zone0/temp').catch(function (e) { return null; }),
            fs.exec('/bin/ping', ['-c', '1', '-W', '1', '8.8.8.8']).catch(function (e) { return null; }),
            fs.read('/proc/net/dev').catch(function (e) { return null; })
        ]);
    },

    render: function (data) {
        var uciData = uci.sections('arwi_dashboard', 'arwi_dashboard');
        var config = uci.sections('arwi_dashboard')[0] || {};

        var enabled = config.enabled || '1';
        var showCpu = config.show_cpu || '1';
        var showRam = config.show_ram || '1';
        var showTemp = config.show_temp || '1';
        var showTraffic = config.show_traffic || '1';
        var showNet = config.show_net || '1';

        // Backwards compatibility
        if (config.ping_box) showNet = config.ping_box;
        var pingHost = config.ping_host || '8.8.8.8';
        var refreshRate = parseInt(config.refresh_rate) || 3;
        if (refreshRate < 1) refreshRate = 1;

        if (enabled !== '1') {
            return E([]);
        }

        // CSS Styles
        var css = `
			.arwi-gauges-container { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 15px; width: 100%; margin-bottom: 20px; padding: 0; }
			
			/* Card Base - Transparent with !important to force override */
			.gauge-card { 
				background: transparent !important; 
				padding: 10px; 
				flex: 1 1 0; 
				min-width: 140px;
				display: flex; 
				align-items: center; 
				justify-content: center; 
				flex-direction: column; 
				position: relative; 
				border: none !important;
				box-shadow: none !important;
			}
			
			.gauge-wrapper {
				position: relative;
				width: 100px;
				height: 100px;
				display: flex;
				align-items: center;
				justify-content: center;
			}

			.circular-chart { 
				display: block; 
				width: 100%; 
				height: 100%;
				overflow: visible;
			}
			
			/* Gauge Track - Subtle */
			.circle-bg { 
				fill: none; 
				stroke: rgba(136, 136, 136, 0.2); 
				stroke-width: 3.5; 
			}
			
			/* Gauge Fill */
			.circle { 
				fill: none; 
				stroke-width: 3.5; 
				stroke-linecap: round; 
				transition: stroke-dasharray 0.6s cubic-bezier(0.4, 0, 0.2, 1) 0s; 
				transform-origin: center; 
				transform: rotate(-90deg); 
			}
			
			.percentage-container { 
				position: absolute; 
				top: 50%; 
				left: 50%; 
				transform: translate(-50%, -50%); 
				text-align: center; 
				width: 100%; 
				pointer-events: none; 
				z-index: 10;
			}
			
			/* Typography - Theme Inheritance */
			.percentage-text { 
				font-size: 1.2em; 
				font-weight: bold; 
				color: inherit; 
				line-height: 1; 
			}
			.traffic-text { 
				font-size: 0.75em; 
				font-weight: bold; 
				color: inherit; 
				line-height: 1.3; 
				white-space: pre; 
			}
			.status-text { 
				font-size: 0.9em; 
				font-weight: bold; 
				color: inherit; 
				line-height: 1; 
			}
			.gauge-label { 
				font-size: 0.65em; 
				font-weight: 600; 
				color: inherit; 
				opacity: 0.6; 
				letter-spacing: 1px; 
				margin-top: 5px; 
				text-transform: uppercase; 
			}
			
			/* Neon Glow Colors */
			.cpu-stroke { stroke: #00f2ff; filter: drop-shadow(0 0 4px rgba(0, 242, 255, 0.8)); }
			.ram-stroke { stroke: #ff0055; filter: drop-shadow(0 0 4px rgba(255, 0, 85, 0.8)); }
			/* Text colors for icons */
			.temp-stroke { color: #ff5e00; }
			.traffic-stroke { color: #ffb700; }
			.net-stroke-on { color: #00ff9d; }
			.net-stroke-off { color: #ff0000; }
			
			.status-on { color: #00ff9d; text-shadow: 0 0 8px rgba(0, 255, 157, 0.6); }
			.status-off { color: #ff0000; text-shadow: 0 0 8px rgba(255, 0, 0, 0.6); }

			.dashboard-icon {
				width: 54px;
				height: 54px;
				fill: currentColor;
				filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.3));
				transition: all 0.3s ease;
			}

			.icon-wrapper {
				display: flex;
				align-items: center;
				justify-content: center;
				height: 70px;
				margin-bottom: 5px;
			}
			
			.value-container {
				display: flex;
				flex-direction: column;
				align-items: center;
				justify-content: center;
				min-height: 40px;
			}

			@media (max-width: 768px) {
				.arwi-gauges-container { 
					justify-content: space-between; 
					gap: 10px;
				}
				.gauge-card { 
					flex: 0 0 48%; /* Force 2 items per row with small gap */
					width: 48%; 
					min-width: unset; /* Remove min-width barrier */
					margin-bottom: 10px; 
					padding: 5px;
				}
				.gauge-wrapper {
					width: 80px; /* Slightly smaller gauges on mobile */
					height: 80px;
				}
				.dashboard-icon {
					width: 42px;
					height: 42px;
				}
				.icon-wrapper {
					height: 50px;
				}
				.percentage-text { font-size: 1.0em; }
				.status-text { font-size: 0.8em; }
				.gauge-label { font-size: 0.55em; margin-top: 2px; }
			}
		`;

        var icons = {
            temp: '<path d="M15 9H9v6h6V9zm-2 4h-2v-2h2v2zm8-2V9h-2V7c0-1.1-.9-2-2-2h-2V3h-2v2h-2V3H9v2H7c-1.1 0-2 .9-2 2v2H3v2h2v2H3v2h2v2c0 1.1.9 2 2 2h2v2h2v-2h2v2h2v-2h2c1.1 0 2-.9 2-2v-2h2v-2h-2v-2h2zm-4 6H7V7h10v10z"/>',
            traffic: '<path d="M16 17.01V10h-2v7.01h-3L15 21l4-3.99h-3zM9 3L5 6.99h3V14h2V6.99h3L9 3z"/>',
            net: '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>'
        };

        function createGaugeCard(idPrefix, label, strokeClass, initialPercent, initialText) {
            var state = window.arwiDashboardState;
            var dashArray = "0, 100";
            var currentStroke = strokeClass;
            var isGauge = (idPrefix === 'cpu' || idPrefix === 'ram');

            // Defaults
            if (idPrefix === 'cpu') {
                initialText = state.cpuText;
                initialPercent = state.cpuPercent;
            } else if (idPrefix === 'ram') {
                initialText = state.ramText;
                initialPercent = state.ramPercent;
            } else if (idPrefix === 'temp') {
                initialText = state.tempText;
                initialPercent = state.tempVal;
            } else if (idPrefix === 'traffic') {
                initialText = state.trafficText;
                initialPercent = 100;
            } else if (idPrefix === 'net') {
                initialText = state.netStatus;
                currentStroke = state.netStroke.replace('circle ', '') || strokeClass;
                // For icon, we might update the whole class on the wrapper
            }

            if (isGauge && initialPercent !== undefined) {
                dashArray = Math.max(0, Math.min(100, initialPercent)).toFixed(1) + ", 100";
            }

            // Decide class for text
            var textClass = (idPrefix === 'net') ? (state.netClass || 'status-text') : 'percentage-text';
            if (idPrefix === 'traffic') textClass = 'traffic-text';

            var card = E('div', { 'class': 'gauge-card' });

            if (isGauge) {
                card.innerHTML = `
                    <div class="gauge-wrapper">
                        <svg viewBox="0 0 36 36" class="circular-chart">
                            <path class="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                            <path class="circle ${currentStroke}" stroke-dasharray="${dashArray}" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" id="${idPrefix}-gauge-path" />
                        </svg>
                        <div class="percentage-container">
                            <div class="${textClass}" id="${idPrefix}-text">${initialText}</div>
                        </div>
                    </div>
                    <span class="gauge-label">${label}</span>
                `;
            } else {
                // Icon View
                var iconSvg = icons[idPrefix] || '';
                var iconColorClass = strokeClass.split(' ')[0]; // roughly grab the color class

                // Special handling for net icon color which needs to be dynamic
                var wrapperId = idPrefix + '-icon-wrapper';

                card.innerHTML = `
                    <div class="icon-wrapper ${iconColorClass}" id="${wrapperId}">
                        <svg viewBox="0 0 24 24" class="dashboard-icon">
                            ${iconSvg}
                        </svg>
                    </div>
                    <div class="value-container">
                         <div class="${textClass}" id="${idPrefix}-text">${initialText}</div>
                    </div>
                    <span class="gauge-label">${label}</span>
                `;
            }
            return card;
        }

        var cpuCard = (showCpu === '1') ? createGaugeCard('cpu', 'CPU Load', 'cpu-stroke') : null;
        var ramCard = (showRam === '1') ? createGaugeCard('ram', 'RAM Usage', 'ram-stroke') : null;
        var tempCard = (showTemp === '1') ? createGaugeCard('temp', 'CPU Temp', 'temp-stroke') : null;
        var trafficCard = (showTraffic === '1') ? createGaugeCard('traffic', 'LAN Traffic', 'traffic-stroke') : null;

        var netCard = null;
        if (showNet === '1') {
            netCard = createGaugeCard('net', 'Internet', 'net-stroke-on');
        }

        // Gauge Order
        var gaugesList = [];
        if (cpuCard) gaugesList.push(cpuCard);
        if (ramCard) gaugesList.push(ramCard);
        if (tempCard) gaugesList.push(tempCard);
        if (trafficCard) gaugesList.push(trafficCard);
        if (netCard) gaugesList.push(netCard);

        var content = E('div', { 'class': 'cbi-section', 'style': 'margin-bottom: 20px;' }, [
            E('div', { 'class': 'arwi-gauges-container' }, [
                E('style', css),
                ...gaugesList
            ])
        ]);

        function formatSpeed(bytes, seconds) {
            if (!bytes || bytes < 0) bytes = 0;
            if (bytes === 0) return '0 B/s';
            var speed = bytes / seconds;
            var units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
            var i = 0;
            while (speed > 1024 && i < units.length - 1) {
                speed /= 1024;
                i++;
            }
            return speed.toFixed(1) + ' ' + units[i];
        }

        L.Poll.add(function () {
            var tasks = [
                callSystemInfo().catch(function (e) { return null; }),
                fs.read('/proc/stat').catch(function (e) { return null; }),
                fs.read('/sys/class/thermal/thermal_zone0/temp').catch(function (e) { return null; }),
                fs.read('/proc/net/dev').catch(function (e) { return null; })
            ];
            if (showNet === '1') {
                tasks.push(fs.exec('/bin/ping', ['-c', '1', '-W', '1', pingHost]).catch(function (e) { return null; }));
            }

            return Promise.all(tasks).then(function (data) {
                try {
                    var now = Date.now();
                    var info = data[0];
                    var stat = data[1];
                    var tempRaw = data[2];
                    var netDev = data[3];
                    var ping = (showNet === '1' && data.length > 4) ? data[4] : null;

                    var state = window.arwiDashboardState;

                    // CPU Update
                    if (stat) {
                        var lines = stat.trim().split('\n');
                        var cpuLine = lines[0].replace(/\s+/g, ' ').split(' ');
                        var total = parseInt(cpuLine[1]) + parseInt(cpuLine[2]) + parseInt(cpuLine[3]) + parseInt(cpuLine[4]) + parseInt(cpuLine[5]) + parseInt(cpuLine[6]) + parseInt(cpuLine[7]) + parseInt(cpuLine[8]);
                        var active = total - parseInt(cpuLine[4]) - parseInt(cpuLine[5]);

                        if (state.cpuLast && state.cpuLast.total > 0) {
                            var diff_total = total - state.cpuLast.total;
                            var diff_active = active - state.cpuLast.active;
                            var percent = 0;
                            if (diff_total > 0) percent = (diff_active / diff_total) * 100;

                            state.cpuPercent = percent;
                            state.cpuText = Math.round(percent) + '%';

                            var elPath = document.getElementById('cpu-gauge-path');
                            var elText = document.getElementById('cpu-text');

                            if (elPath) elPath.setAttribute('stroke-dasharray', Math.max(0, Math.min(100, percent)).toFixed(1) + ', 100');
                            if (elText) elText.textContent = state.cpuText;
                        }
                        // Always update state, but only display if we have a valid previous state (to avoid initial 0 spin)
                        if (!state.cpuLast || total > state.cpuLast.total) {
                            state.cpuLast = { total: total, active: active };
                        }
                    }

                    // RAM Update
                    if (info && info.memory) {
                        var percent = ((info.memory.total - info.memory.free) / info.memory.total) * 100;
                        state.ramPercent = percent;
                        state.ramText = Math.round(percent) + '%';
                        var elPath = document.getElementById('ram-gauge-path');
                        var elText = document.getElementById('ram-text');
                        if (elPath) elPath.setAttribute('stroke-dasharray', Math.max(0, Math.min(100, percent)).toFixed(1) + ', 100');
                        if (elText) elText.textContent = state.ramText;
                    }

                    // Temp Update
                    if (tempRaw) {
                        var tempC = parseInt(tempRaw) / 1000;
                        state.tempVal = tempC;
                        state.tempText = Math.round(tempC) + '°C';

                        var elText = document.getElementById('temp-text');
                        if (elText) elText.textContent = state.tempText;
                    }

                    // Traffic Update
                    if (netDev) {
                        var rx = 0, tx = 0;
                        var lines = netDev.trim().split('\n');
                        for (var i = 2; i < lines.length; i++) {
                            var line = lines[i].trim();
                            if (line.indexOf(':') > -1) {
                                var parts = line.split(':');
                                var devName = parts[0].trim();
                                if (devName === 'br-lan') {
                                    var stats = parts[1].trim().split(/\s+/);
                                    rx = parseInt(stats[0]);
                                    tx = parseInt(stats[8]);
                                    break;
                                }
                            }
                        }

                        if (state.trafficLast) {
                            var dt = (now - state.trafficLast.time) / 1000;
                            if (dt > 0) {
                                var rxSpeed = formatSpeed(rx - state.trafficLast.rx, dt);
                                var txSpeed = formatSpeed(tx - state.trafficLast.tx, dt);

                                state.trafficText = '▼ ' + rxSpeed + '\n▲ ' + txSpeed;

                                var elText = document.getElementById('traffic-text');
                                if (elText) elText.textContent = state.trafficText;
                            }
                        }
                        state.trafficLast = { time: now, rx: rx, tx: tx };
                    }

                    // Internet Update
                    if (showNet === '1') {
                        var elNetWrapper = document.getElementById('net-icon-wrapper');
                        var elNetText = document.getElementById('net-text');
                        if (elNetWrapper && elNetText) {
                            var isOnline = (ping && ping.code === 0);
                            var statusStr = isOnline ? 'ON' : 'OFF';
                            var classStr = isOnline ? 'status-text status-on' : 'status-text status-off';
                            var strokeClass = isOnline ? 'icon-wrapper net-stroke-on' : 'icon-wrapper net-stroke-off';

                            state.netStatus = statusStr;
                            state.netClass = classStr;

                            elNetText.textContent = statusStr;
                            elNetText.className = classStr;
                            elNetWrapper.className = strokeClass;
                        }
                    }
                } catch (e) { console.error(e); }
            });
        }, refreshRate);

        return content;
    }
});
