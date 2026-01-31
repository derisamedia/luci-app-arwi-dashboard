'use strict';
'require view';
'require form';
'require ui';

return view.extend({
    render: function () {
        var m, s, o;

        m = new form.Map('arwi_dashboard', _('Arwi Dashboard Settings'), _('Configure the appearance and behavior of the Arwi Dashboard widgets.'));

        s = m.section(form.NamedSection, 'general', 'arwi_dashboard', _('General Settings'));

        o = s.option(form.Flag, 'enabled', _('Enable Dashboard Widgets'), _('Show the CPU, RAM, and Internet gauges on the status page.'));
        o.default = o.enabled;

        // Widget Selection
        o = s.option(form.Flag, 'show_cpu', _('Show CPU Load'), _('Display the CPU Load gauge.'));
        o.default = o.enabled;

        o = s.option(form.Flag, 'show_ram', _('Show RAM Usage'), _('Display the RAM Usage gauge.'));
        o.default = o.enabled;

        o = s.option(form.Flag, 'show_temp', _('Show CPU Temp'), _('Display the CPU Temperature icon.'));
        o.default = o.enabled;

        o = s.option(form.Flag, 'show_traffic', _('Show LAN Traffic'), _('Display the LAN Traffic icon.'));
        o.default = o.enabled;

        o = s.option(form.Flag, 'show_net', _('Show Internet Status'), _('Display the Internet connectivity icon.'));
        o.default = o.enabled;

        o = s.option(form.Value, 'ping_host', _('Ping Host'), _('Host to ping for internet connectivity check. Default is 8.8.8.8 (Google DNS).'));
        o.default = '8.8.8.8';
        o.datatype = 'host';
        o.depends('show_net', '1');

        o = s.option(form.ListValue, 'refresh_rate', _('Refresh Rate'), _('How often to update the gauges (in seconds).'));
        o.value('1', _('1 Second (Fast)'));
        o.value('3', _('3 Seconds (Normal)'));
        o.value('5', _('5 Seconds (Slow)'));
        o.default = '3';

        return m.render();
    }
});
