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

        o = s.option(form.Flag, 'ping_box', _('Show Internet Status'), _('Enable the Internet connectivity gauge.'));
        o.default = o.enabled;

        o = s.option(form.Value, 'ping_host', _('Ping Host'), _('Host to ping for internet connectivity check. Default is 8.8.8.8 (Google DNS).'));
        o.default = '8.8.8.8';
        o.datatype = 'host';
        o.depends('ping_box', '1');

        o = s.option(form.ListValue, 'refresh_rate', _('Refresh Rate'), _('How often to update the gauges (in seconds).'));
        o.value('1', _('1 Second (Fast)'));
        o.value('3', _('3 Seconds (Normal)'));
        o.value('5', _('5 Seconds (Slow)'));
        o.default = '3';

        return m.render();
    }
});
