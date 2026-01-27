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
if (!window.arwiInfoState) {
    window.arwiInfoState = {
        cpuLast: null,
        cpuPercent: 0,
        cpuText: '-',
        ramPercent: 0,
        ramText: '-',
        tempVal: 0,
        tempText: '-',
        netStatus: 'WAIT',
        netClass: 'status-text',
        netStroke: 'net-stroke-off'
    };
}

return L.view.extend({
    title: '',

    load: function () {
        return Promise.all([
            uci.load('arwi_info'),
            callSystemInfo().catch(function (e) { return null; }),
            fs.read('/proc/stat').catch(function (e) { return null; }),
            fs.exec('/bin/ping', ['-c', '1', '-W', '1', '8.8.8.8']).catch(function (e) { return null; }),
            fs.read('/proc/net/dev').catch(function (e) { return null; })
        ]);
    },

    render: function (data) {
        var uciData = uci.sections('arwi_info', 'arwi_info');
        var config = uci.sections('arwi_info')[0] || {};

        var enabled = config.enabled || '1';
        var showInternal = config.ping_box || '1';
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
			.traffic-stroke { stroke: #ffb700; filter: drop-shadow(0 0 4px rgba(255, 183, 0, 0.8)); }
			.net-stroke-on { stroke: #00ff9d; filter: drop-shadow(0 0 4px rgba(0, 255, 157, 0.8)); }
			.net-stroke-off { stroke: #ff0000; filter: drop-shadow(0 0 4px rgba(255, 0, 0, 0.8)); }
			
			.status-on { color: #00ff9d; text-shadow: 0 0 8px rgba(0, 255, 157, 0.6); }
			.status-off { color: #ff0000; text-shadow: 0 0 8px rgba(255, 0, 0, 0.6); }

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
				.percentage-text { font-size: 1.0em; }
				.status-text { font-size: 0.8em; }
				.gauge-label { font-size: 0.55em; margin-top: 2px; }
			}
		`;

        function createGaugeCard(idPrefix, label, strokeClass, initialPercent, initialText) {
            var state = window.arwiInfoState;
            var dashArray = "0, 100";
            var currentStroke = strokeClass;

            // Defaults
            if (idPrefix === 'cpu') {
                initialText = state.cpuText;
                initialPercent = state.cpuPercent;
            } else if (idPrefix === 'ram') {
                initialText = state.ramText;
                initialPercent = state.ramPercent;
            } else if (idPrefix === 'traffic') {
                initialText = state.trafficText;
                initialPercent = 100; // Traffic gauge doesn't use percentage for fill, just for visual
            } else if (idPrefix === 'net') {
                initialText = state.netStatus;
                currentStroke = state.netStroke.replace('circle ', '') || strokeClass;
                dashArray = (initialText === 'ON') ? "100, 100" : "10, 100";
            }

            if (idPrefix !== 'net' && initialPercent !== undefined) {
                dashArray = Math.max(0, Math.min(100, initialPercent)).toFixed(1) + ", 100";
            }

            // Decide class for text
            var textClass = (idPrefix === 'net') ? (state.netClass || 'status-text') : 'percentage-text';
            if (idPrefix === 'traffic') textClass = 'traffic-text';

            var card = E('div', { 'class': 'gauge-card' });
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
            return card;
        }

        var cpuCard = createGaugeCard('cpu', 'CPU Load', 'cpu-stroke');
        var ramCard = createGaugeCard('ram', 'RAM Usage', 'ram-stroke');
        var trafficCard = createGaugeCard('traffic', 'LAN Traffic', 'traffic-stroke');

        var netCard = null;
        if (showInternal === '1') {
            netCard = createGaugeCard('net', 'Internet', 'net-stroke-on');
        }

        // Gauge Order
        var gaugesList = [cpuCard, ramCard, trafficCard];
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
                fs.read('/proc/net/dev').catch(function (e) { return null; })
            ];
            if (showInternal === '1') {
                tasks.push(fs.exec('/bin/ping', ['-c', '1', '-W', '1', pingHost]).catch(function (e) { return null; }));
            }

            return Promise.all(tasks).then(function (data) {
                try {
                    var info = data[0];
                    var stat = data[1];
                    var netDev = data[2];
                    var ping = (showInternal === '1' && data.length > 3) ? data[3] : null;

                    var state = window.arwiInfoState;

                    // CPU Update
                    if (stat) {
                        var lines = stat.trim().split('\n');
                        var cpuLine = lines[0].replace(/\s+/g, ' ').split(' ');
                        var total = parseInt(cpuLine[1]) + parseInt(cpuLine[2]) + parseInt(cpuLine[3]) + parseInt(cpuLine[4]) + parseInt(cpuLine[5]) + parseInt(cpuLine[6]) + parseInt(cpuLine[7]) + parseInt(cpuLine[8]);
                        var active = total - parseInt(cpuLine[4]) - parseInt(cpuLine[5]);

                        if (state.cpuLast) {
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
                        state.cpuLast = { total: total, active: active };
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
                    if (showInternal === '1') {
                        var elNetPath = document.getElementById('net-gauge-path');
                        var elNetText = document.getElementById('net-text');
                        if (elNetPath && elNetText) {
                            var isOnline = (ping && ping.code === 0);
                            var statusStr = isOnline ? 'ON' : 'OFF';
                            var classStr = isOnline ? 'status-text status-on' : 'status-text status-off';
                            var strokeClass = isOnline ? 'circle net-stroke-on' : 'circle net-stroke-off';
                            var strokeDash = isOnline ? '100, 100' : '10, 100';

                            state.netStatus = statusStr;
                            state.netClass = classStr;
                            state.netStroke = strokeClass.replace('circle ', '');

                            elNetText.textContent = statusStr;
                            elNetText.className = classStr;
                            elNetPath.setAttribute('class', strokeClass);
                            elNetPath.setAttribute('stroke-dasharray', strokeDash);
                        }
                    }
                } catch (e) { console.error(e); }
            });
        }, refreshRate);

        return content;
    }
});
