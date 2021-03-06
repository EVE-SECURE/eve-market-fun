function setupLocationSelector () {

    var root_el = $(this);
    var state = {
        regionID: null,
        constellationID: null,
        solarSystemID: null
    };
    var choices = {};
    var els = {};

    // Set up each of the dropdown selectors
    _.each(state, function (ignore, name) {
        choices[name] = {};
        els[name] = root_el.find('.'+name)
            .prop('disabled', true)
            .selectpicker({
                width: '150px',
                liveSearch: true,
                showSubtext: true,
                selectedTextFormat: 'values' 
            })
            .on('change', function (ev) {
                var update = _.clone(state);
                update[name] = $(this).val();
                updateState(update);
                saveState();
            });
    });

    var resetSelector = function (name) {
        els[name].empty().prop('disabled', true).selectpicker('refresh');
        choices[name] = {};
    };

    var updateSelector = function (name) {
        if (state[name]) {
            els[name].val(state[name]).selectpicker('refresh');
        }
    };

    var loadSelectFromJSON = function (el, url, val_name, label_name, next_cb) {
        next_cb = next_cb || function () {};
        $.getJSON(url, function (items) {
            var choices = {};
            el.empty();
            el.removeAttr('disabled');
            el.append($('<option>', {value: ''}).text('---'));
            _(items).chain().sortBy(label_name).each(function (item) {
                choices[item[val_name]] = item[label_name];
                el.append($('<option>', {
                    value: item[val_name],
                }).text(item[label_name]));
            });
            el.selectpicker('refresh');
            next_cb(null, items, choices);
        });
    };

    var updateState = function (update) {
        var changed = {};
        _.each(state, function (curr_val, name) {
            var new_val = update[name];
            changed[name] = (update[name] != curr_val);
            state[name] = new_val;
        });
        async.waterfall([
            function (next) {
                if (!changed.regionID) {
                    return next(null, null, null);
                }
                updateSelector('regionID');
                resetSelector('constellationID');
                resetSelector('solarSystemID');
                if (!state.regionID) {
                    return next(null, null, null);
                }
                loadSelectFromJSON(els.constellationID,
                    '/data/mapConstellations?' + $.param({
                        regionID: state.regionID
                    }), 'constellationID', 'constellationName', next);
            }, function (data, choices_in, next) {
                if (choices_in) { choices.constellationID = choices_in; }
                if (!changed.constellationID) {
                    return next(null, null, null);
                }
                updateSelector('constellationID');
                resetSelector('solarSystemID');
                if (!state.constellationID) {
                    return next(null, null, null);
                }
                loadSelectFromJSON(els.solarSystemID,
                    '/data/mapSolarSystems?' + $.param({
                        constellationID: state.constellationID
                    }), 'solarSystemID', 'solarSystemName', next);
            }, function (data, choices_in, next) {
                if (choices_in) { choices.solarSystemID = choices_in; }
                if (!changed.solarSystemID) {
                    return next();
                }
                updateSelector('solarSystemID');
                next();
            }
        ], function (err) {
            _.each(state, function (curr_val, name) {
                if (!choices[name] || !choices[name][state[name]]) {
                    state[name] = null;
                }
            });
            hub.trigger('locationselector:change', state, changed);
        });
    };

    var saveState = function () {
        history.pushState(state, '',
            '/market/type/' + type_id + '?' + $.param(state));
    };

    hub.on('locationselector:update', function (update) {
        updateState(update);
    });
    
    // Load regions for selector
    loadSelectFromJSON(els.regionID, '/data/mapRegions',
        'regionID', 'regionName',
        function (err, data, choices_in) {
            choices.regionID = choices_in;
            hub.trigger('locationselector:load');
        });

    // Load favorites into the selector
    var location_favorites = [];
    var refreshFavorites = function () {
        $.getJSON('/data/profile/locationfavorites', function (favorites) {
            location_favorites = favorites;
            var el = root_el.find('.favorites .dropdown-menu');
            el.empty();
            _(favorites).chain().each(function (item) {
                var link = $('<a>');
                link.text([
                    item.regionName,
                    item.constellationName || '---',
                    item.solarSystemName || '---'
                ].join(" > "));
                _.each(item, function (val, name) {
                    link.data(name.toLowerCase(), val);
                });
                el.append($('<li>').append(link));
            });
            updateFaveButton(state);
        });
    };
    refreshFavorites();

    // Change to favorite location on selection click
    root_el.delegate('.favorites .dropdown-menu a', 'click', function () {
        var data = $(this).data();
        updateState(_.chain([
            'regionID', 'constellationID', 'solarSystemID'
        ]).map(function (name) {
            return [name, data[name.toLowerCase()]];
        }).object().value());
        saveState();
    });

    // Update favorite indicator on selector change
    var updateFaveButton = function (state, changed) {
        if (!state.regionID) { return; }

        var fave_selected = null;
        // HACK: I hate this code.
        _.each(location_favorites, function (favorite) {
            var match = true;
            _.each(state, function (val, name) {
                if ((name != 'regionID') && !val && !favorite[name]) {
                    return;
                }
                if (parseInt(val) != favorite[name]) {
                    match = false;
                }
            });
            if (match) { fave_selected = favorite; }
        });
        if (fave_selected) {
            fave_button
                .removeClass('btn-default').addClass('btn-success')
                .data('uuid', fave_selected.uuid);
        } else {
            fave_button
                .removeClass('btn-success').addClass('btn-default')
                .data('uuid', '');
        }
    };
    hub.on('locationselector:change', updateFaveButton);

    // Wire up AJAX delete / save on fave button.
    var fave_button = root_el.find('.favorites .action-favorite');
    fave_button.click(function () {
        var uuid = fave_button.data('uuid');
        if (uuid) {
            $.ajax({
                type: 'DELETE',
                url: '/data/profile/locationfavorites/'+uuid,
                contentType: 'application/json',
                complete: function (xhr, status) {
                    refreshFavorites();
                }
            });
        } else {
            $.ajax({
                type: 'PUT',
                url: '/data/profile/locationfavorites',
                contentType: 'application/json',
                data: JSON.stringify(state),
                complete: function (xhr, status) {
                    refreshFavorites();
                }
            });
        }
    });

    // Set up a button and event to select current location.
    var selectHere = function () {
        if (!eve_headers.trusted) { return; }
        updateState({
            regionID: eve_headers.regionid,
            constellationID: eve_headers.constellationid,
            solarSystemID: eve_headers.solarsystemid
        });
        saveState();
        return false;
    }
    hub.on('locationselector:selectHere', selectHere);
    var here_button = root_el.find('.action-here').click(selectHere);
    if (!eve_headers.trusted) { here_button.hide(); }

    // Wire up the search button to toggle between search & browse
    var search_btn = root_el.find('.action-search');
    var search_fields = root_el.find('.search-fields');
    var selectors = root_el.find('.selectors');
    function showSearch () {
        search_btn.addClass('btn-success').removeClass('btn-default');
        search_fields.removeClass('hidden');
        selectors.addClass('hidden');
        root_el.find('.locationName').val('').focus();
    }
    function showBrowse () {
        search_btn.removeClass('btn-success').addClass('btn-default');
        search_fields.addClass('hidden');
        selectors.removeClass('hidden');
    }
    search_btn.click(function () {
        if (search_btn.hasClass('btn-success')) {
            showBrowse();
        } else {
            showSearch();
        }
    });

    // Wire up the typeahead search to set browser state
    root_el.find('.locationName').typeahead({
        autoselect: true, highlight: true, minLength: 1
    }, {
        name: 'locations',
        source: function (query, cb) {
            $.getJSON('/data/mapSolarSystems', {q: query}, function (systems) {
                cb(_.map(systems, function (system) {
                    return _.defaults({
                        value: [
                            system.regionName,
                            system.constellationName || '---',
                            system.solarSystemName || '---'
                        ].join(" > ")
                    }, system);
                }))
            });
        }            
    }).bind('typeahead:selected', function (ev, system, name) {
        showBrowse();
        updateState({
            regionID: system.regionID,
            constellationID: system.constellationID,
            solarSystemID: system.solarSystemID
        });
        saveState();
    });
}

$(document).ready(function () {
    $('.locationselector').each(setupLocationSelector);
});
