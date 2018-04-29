/* eslint-disable no-loop-func */
// helper functions
var sidebar_keys = [ 'experience_level', 'project_length', 'bounty_type', 'bounty_filter', 'network', 'idx_status' ];

var localStorage;
var dashboard = {};

dashboard.limit = 20;
dashboard.draw_distance = 5;
dashboard.bounty_offset = 0;
dashboard.finished_appending = false;
try {
  localStorage = window.localStorage;
} catch (e) {
  localStorage = {};
}

function debounce(func, wait, immediate) {
  var timeout;

  return function() {
    var context = this;
    var args = arguments;
    var later = function() {
      timeout = null;
      if (!immediate)
        func.apply(context, args);
    };
    var callNow = immediate && !timeout;

    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow)
      func.apply(context, args);
  };
}

// sets search information default
var save_sidebar_latest = function() {

  localStorage['keywords'] = $('#keywords').val();
  localStorage['sort'] = $('.sort_option.selected').data('key');
  localStorage['sort_direction'] = $('.sort_option.selected').data('direction');

  for (var i = 0; i < sidebar_keys.length; i++) {
    var key = sidebar_keys[i];
    var val = $('input[name=' + key + ']:checked').val();

    localStorage[key] = val;
  }

};

// saves search information default
var set_sidebar_defaults = function() {
  var q = getParam('q');

  if (q) {
    $('#keywords').val(q);
  } else if (localStorage['keywords']) {
    $('#keywords').val(localStorage['keywords']);
  }
  if (localStorage['sort']) {
    $('.sort_option').removeClass('selected');
    var ele = $('.sort_option[data-key=' + localStorage['sort'] + ']');

    ele.addClass('selected');
    ele.data('direction', localStorage['sort_direction']);
  }

  for (var i = 0; i < sidebar_keys.length; i++) {
    var key = sidebar_keys[i];

    if (localStorage[key]) {
      $('input[name=' + key + '][value=' + localStorage[key] + ']').prop('checked', true);
    }
  }

};

var set_filter_header = function() {
  var filter_status = $('input[name=idx_status]:checked').attr('val-ui') ? $('input[name=idx_status]:checked').attr('val-ui') : 'All';

  $('#filter').html(filter_status);
};

// TODO: Refactor function :
// Deselect option 'any' when another filter is selected
// Selects option 'any' when no filter is applied
// TODO : Disable other filters when 'any' is selected
var disableAny = function() {
  for (var i = 0; i < sidebar_keys.length; i++) {
    var key = sidebar_keys[i];
    var tag = ($('input[name=' + key + '][value]'));

    tag.map(function(index, input) {
      if ($(input).prop('checked')) {
        if (input.value === 'any') {
          $('input[name=' + key + '][value=any]').prop('checked', true);
        } else {
          $('input[name=' + key + '][value=any]').prop('checked', false);
        }
      }
    });

    if ($('input[name=' + key + ']:checked').length === 0) {
      $('input[name=' + key + '][value=any]').prop('checked', true);
    }
  }
};

var getFilters = function() {
  var _filters = [];

  for (var i = 0; i < sidebar_keys.length; i++) {
    var key = sidebar_keys[i];

    $.each($('input[name=' + key + ']:checked'), function() {
      if ($(this).attr('val-ui'))
        _filters.push('<a class=filter-tag>' + $(this).attr('val-ui') +
                  '<i class="fas fa-times" onclick="removeFilter(\'' + key + '\', \'' + $(this).attr('value') + '\')"></i></a>');
    });
  }
  $('.filter-tags').html(_filters);
};

var removeFilter = function(key, value) {
  $('input[name=' + key + '][value=' + value + ']').prop('checked', false);
  refreshBounties();
};

var get_search_URI = function() {
  var uri = '/api/v0.1/bounties/?limit=' + dashboard.limit + '&offset=' + dashboard.bounty_offset;
  var keywords = $('#keywords').val();

  if (keywords) {
    uri += '&raw_data=' + keywords;
  }

  for (var i = 0; i < sidebar_keys.length; i++) {
    var key = sidebar_keys[i];
    var filters = [];

    $.each ($('input[name=' + key + ']:checked'), function() {
      if ($(this).val()) {
        filters.push($(this).val());
      }
    });

    var val = filters.toString();

    if ((key === 'bounty_filter') && val) {
      var values = val.split(',');

      values.forEach(function(_value) {
        var _key;

        if (_value === 'createdByMe') {
          _key = 'bounty_owner_github_username';
          _value = document.contxt.github_handle;
        } else if (_value === 'startedByMe') {
          _key = 'interested_github_username';
          _value = document.contxt.github_handle;
        } else if (_value === 'fulfilledByMe') {
          _key = 'fulfiller_github_username';
          _value = document.contxt.github_handle;
        }

        if (_value !== 'any')
          uri += '&' + _key + '=' + _value;
      });

      // TODO: Check if value myself is needed for coinbase
      if (val === 'fulfilledByMe') {
        key = 'bounty_owner_address';
        val = 'myself';
      }
    }
    if (val !== 'any' &&
        key !== 'bounty_filter' &&
        key !== 'bounty_owner_address') {
      uri += '&' + key + '=' + val;
    }
  }

  if (typeof web3 != 'undefined' && web3.eth.coinbase) {
    uri += '&coinbase=' + web3.eth.coinbase;
  } else {
    uri += '&coinbase=unknown';
  }

  var selected_option = $('.sort_option.selected');
  var direction = selected_option.data('direction');
  var order_by = selected_option.data('key');

  if (order_by) {
    uri += '&order_by=' + (direction === '-' ? direction : '') + order_by;
  }

  return uri;
};

var process_stats = function(results) {
  var num = results.length;
  var worth_usdt = 0;
  var worth_eth = 0;
  var currencies_to_value = {};

  for (var i = 0; i < results.length; i++) {
    var result = results[i];

    worth_usdt += result['value_in_usdt'];
    worth_eth += result['value_in_eth'];
    var token = result['token_name'];

    if (token !== 'ETH') {
      if (!currencies_to_value[token]) {
        currencies_to_value[token] = 0;
      }
      currencies_to_value[token] += result['value_true'];
    }
  }

  worth_usdt = worth_usdt.toFixed(2);
  worth_eth = (worth_eth / Math.pow(10, 18)).toFixed(2);
  var stats = worth_usdt + ' USD, ' + worth_eth + ' ETH';

  for (var t in currencies_to_value) {
    if (Object.prototype.hasOwnProperty.call(currencies_to_value, t)) {
      stats += ', ' + currencies_to_value[t].toFixed(2) + ' ' + t;
    }
  }

  switch (num) {
    case 0:
      // $('#matches').html(gettext('No Results'));
      $('#funding-info').html('');
      break;
    case 1:
      // $('#matches').html(num + gettext(' Matching Result'));
      $('#funding-info').html("<span id='modifiers'>Funded Issue</span><span id='stats' class='font-body'>(" + stats + ')</span>');
      break;
    default:
      // $('#matches').html(num + gettext(' Matching Results'));
      $('#funding-info').html("<span id='modifiers'>Funded Issues</span><span id='stats' class='font-body'>(" + stats + ')</span>');
  }
};

var paint_bounties_in_viewport = function(start, max) {
  dashboard.is_painting_now = true;
  var num_bounties = dashboard.bounties_html.length;

  for (var i = start; i < num_bounties && i < max; i++) {
    var html = dashboard.bounties_html[i];

    dashboard.last_bounty_rendered = i;
    $('#bounties').append(html);
  }

  $('div.bounty_row.result').each(function() {
    var href = $(this).attr('href');

    if (typeof $(this).changeElementType !== 'undefined') {
      $(this).changeElementType('a'); // hack so that users can right click on the element
    }

    $(this).attr('href', href);
  });
  dashboard.is_painting_now = false;
};

var near_bottom = function(callback, buffer) {
  if (typeof dashboard.bounties_html == 'undefined' || dashboard.bounties_html.length == 0) {
    return;
  }
  var scrollPos = $(document).scrollTop();
  var last_active_bounty = $('.bounty_row.result:last-child');

  if (last_active_bounty.length == 0) {
    return;
  }
  var window_height = $(window).height();
  var have_painted_all_bounties = dashboard.bounties_html.length <= dashboard.last_bounty_rendered;
  var does_need_to_paint_more = !dashboard.is_painting_now && ((last_active_bounty.offset().top) < (scrollPos + buffer + window_height));

  var preload = ((last_active_bounty.offset().top) < (scrollPos + buffer + 1500 + window_height));

  if (does_need_to_paint_more) {
    callback();
  }
};


var trigger_scroll_for_redraw = debounce(function() {
  near_bottom(function() {
    paint_bounties_in_viewport(dashboard.last_bounty_rendered + 1, dashboard.last_bounty_rendered + dashboard.draw_distance + 1);
  }, 500);
}, 200);

var trigger_scroll_for_refresh_api = function() {
  near_bottom(function() {
    refreshBounties(true);
  }, 1500);
};

$(window).scroll(trigger_scroll_for_redraw);
$('body').bind('touchmove', trigger_scroll_for_redraw);

$(window).scroll(trigger_scroll_for_refresh_api);
$('body').bind('touchmove', trigger_scroll_for_refresh_api);
var refreshBounties = function(append) {
  // manage state
  if (append && dashboard.finished_appending) {
    return;
  }
  if (dashboard.is_loading) {
    return;
  }
  dashboard.is_loading = true;
  if (append)
    dashboard.bounty_offset += dashboard.limit;

  if (!append) {
    var keywords = $('#keywords').val();
    var title = gettext('Issue Explorer | Gitcoin');

    if (keywords) {
      title = keywords + ' | ' + title;
    }

    var currentState = history.state;

    window.history.replaceState(currentState, title, '/explorer?q=' + keywords);

    save_sidebar_latest();
    set_filter_header();
    disableAny();
    getFilters();
    if (!append) {
      $('.nonefound').css('display', 'none');
      $('.bounty_row').remove();
    }
  } // filter
  var uri = get_search_URI();

  // analytics
  var params = { uri: uri };

  if (!append) {
    mixpanel.track('Refresh Bounties', params);
  }
  // order
  $('.loading').css('display', 'block');
  $.get(uri, function(results) {
    results = sanitizeAPIResults(results);

    if (results.length < dashboard.limit) {
      if (!append) {
        $('.nonefound').css('display', 'block');
      } else {
        dashboard.finished_appending = true;
      }
    }

    dashboard.is_painting_now = false;

    if (!append) {
      dashboard.last_bounty_rendered = 0;
      dashboard.bounties_html = [];
      dashboard.bounty_offset = 0;
    }
    for (var i = 0; i < results.length; i++) {
      // setup
      var result = results[i];
      var related_token_details = tokenAddressToDetails(result['token_address']);
      var decimals = 18;

      if (related_token_details && related_token_details.decimals) {
        decimals = related_token_details.decimals;
      }

      var divisor = Math.pow(10, decimals);

      result['rounded_amount'] = Math.round(result['value_in_token'] / divisor * 100) / 100;
      var is_expired = new Date(result['expires_date']) < new Date() && !result['is_open'];

      // setup args to go into template
      if (typeof web3 != 'undefined' && web3.eth.coinbase == result['bounty_owner_address']) {
        result['my_bounty'] = '<a class="btn font-smaller-2 btn-sm btn-outline-dark" role="button" href="#">mine</span></a>';
      } else if (result['fulfiller_address'] !== '0x0000000000000000000000000000000000000000') {
        result['my_bounty'] = '<a class="btn font-smaller-2 btn-sm btn-outline-dark" role="button" href="#">' + result['status'] + '</span></a>';
      }
      result.action = result['url'];
      result['title'] = result['title'] ? result['title'] : result['github_url'];
      var timeLeft = timeDifference(new Date(result['expires_date']), new Date(), true);

      result['p'] = ((result['experience_level'] ? result['experience_level'] : 'Unknown Experience Level') + ' &bull; ');

      if (result['status'] === 'done')
        result['p'] += 'Done';
      if (result['fulfillment_accepted_on']) {
        result['p'] += ' ' + timeDifference(new Date(), new Date(result['fulfillment_accepted_on']), false, 60 * 60);
      } else if (result['status'] === 'started') {
        result['p'] += 'Started';
        result['p'] += ' ' + timeDifference(new Date(), new Date(result['fulfillment_started_on']), false, 60 * 60);
      } else if (result['status'] === 'submitted') {
        result['p'] += 'Submitted';
        if (result['fulfillment_submitted_on']) {
          result['p'] += ' ' + timeDifference(new Date(), new Date(result['fulfillment_submitted_on']), false, 60 * 60);
        }
      } else if (result['status'] == 'cancelled') {
        result['p'] += 'Cancelled';
        if (result['canceled_on']) {
          result['p'] += ' ' + timeDifference(new Date(), new Date(result['canceled_on']), false, 60 * 60);
        }
      } else if (is_expired) {
        var time_ago = timeDifference(new Date(), new Date(result['expires_date']), true);

        result['p'] += ('Expired ' + time_ago + ' ago');
      } else {
        var opened_when = timeDifference(new Date(), new Date(result['web3_created']), true);

        result['p'] += ('Opened ' + opened_when + ' ago, Expires in ' + timeLeft);
      }

      result['watch'] = 'Watch';

      // render the template
      var tmpl = $.templates('#result');
      var html = tmpl.render(result);

      dashboard.bounties_html[i + dashboard.bounty_offset] = html;
    }

    if (!append) {
      paint_bounties_in_viewport(0, 10);
    } else {
      paint_bounties_in_viewport(dashboard.last_bounty_rendered + 1, dashboard.last_bounty_rendered + 6);
    }
    process_stats(results);

  }).fail(function() {
    _alert({message: 'got an error. please try again, or contact support@gitcoin.co'}, 'error');
  }).always(function() {
    dashboard.is_loading = false;
    $('.loading').css('display', 'none');
  });
};

window.addEventListener('load', function() {
  set_sidebar_defaults();
  refreshBounties();
});

var getNextDayOfWeek = function(date, dayOfWeek) {
  var resultDate = new Date(date.getTime());

  resultDate.setDate(date.getDate() + (7 + dayOfWeek - date.getDay() - 1) % 7 + 1);
  return resultDate;
};

$(document).ready(function() {

  // TODO: DRY
  function split(val) {
    return val.split(/,\s*/);
  }
  function extractLast(term) {
    return split(term).pop();
  }
  $('#keywords')
    // don't navigate away from the field on tab when selecting an item
    .on('keydown', function(event) {
      if (event.keyCode === $.ui.keyCode.TAB &&
            $(this).autocomplete('instance').menu.active) {
        event.preventDefault();
      }
    })
    .autocomplete({
      minLength: 0,
      source: function(request, response) {
        // delegate back to autocomplete, but extract the last term
        response($.ui.autocomplete.filter(
          dashboard.keywords, extractLast(request.term)));
      },
      focus: function() {
        // prevent value inserted on focus
        return false;
      },
      select: function(event, ui) {
        var terms = split(this.value);
        // remove the current input

        terms.pop();
        // add the selected item
        terms.push(ui.item.value);
        // add placeholder to get the comma-and-space at the end
        terms.push('');
        this.value = terms.join(', ');
        return false;
      }
    });

  // sidebar clear
  $('.dashboard #clear').click(function(e) {
    for (var i = 0; i < sidebar_keys.length; i++) {
      var key = sidebar_keys[i];
      var tag = ($('input[name=' + key + '][value]'));

      for (var j = 0; j < tag.length; j++) {
        if (tag[j].value == 'any')
          $('input[name=' + key + '][value=any]').prop('checked', true);
        else
          $('input[name=' + key + '][value=' + tag[j].value + ']').prop('checked', false);
      }
    }
    refreshBounties();
    e.preventDefault();
  });

  // search bar
  $('#bounties').delegate('#new_search', 'click', function(e) {
    refreshBounties();
    e.preventDefault();
  });

  $('.search-area input[type=text]').keypress(function(e) {
    if (e.which == 13) {
      refreshBounties();
      e.preventDefault();
    }
  });

  // sidebar filters
  $('.sidebar_search input[type=radio], .sidebar_search label').change(function(e) {
    refreshBounties();
    e.preventDefault();
  });

  // sidebar filters
  $('.sidebar_search input[type=checkbox], .sidebar_search label').change(function(e) {
    refreshBounties();
    e.preventDefault();
  });

  // sort direction
  $('#bounties').delegate('.sort_option', 'click', function(e) {
    if ($(this).hasClass('selected')) {
      if ($(this).data('direction') == '-') {
        $(this).data('direction', '+');
      } else {
        $(this).data('direction', '-');
      }
    }
    $('.sort_option').removeClass('selected');
    $(this).addClass('selected');
    setTimeout(function() {
      refreshBounties();
    }, 10);
    e.preventDefault();
  });

  // email subscribe functionality
  $('.save_search').click(function(e) {
    e.preventDefault();
    $('#save').remove();
    var url = '/sync/search_save';

    setTimeout(function() {
      $.get(url, function(newHTML) {
        $(newHTML).appendTo('body').modal();
        $('#save').append("<input type=hidden name=raw_data value='" + get_search_URI() + "'>");
        $('#save_email').focus();
      });
    }, 300);
  });

  var emailSubscribe = function() {
    var email = $('#save input[type=email]').val();
    var raw_data = $('#save input[type=hidden]').val();
    var is_validated = validateEmail(email);

    if (!is_validated) {
      _alert({ message: gettext('Please enter a valid email address.') }, 'warning');
    } else {
      var url = '/sync/search_save';

      $.post(url, {
        email: email,
        raw_data: raw_data
      }, function(response) {
        var status = response['status'];

        if (status == 200) {
          _alert({message: gettext("You're in! Keep an eye on your inbox for the next funding listing.")}, 'success');
          $.modal.close();
        } else {
          _alert({message: response['msg']}, 'error');
        }
      });
    }
  };

  $('body').delegate('#save input[type=email]', 'keypress', function(e) {
    if (e.which == 13) {
      emailSubscribe();
      e.preventDefault();
    }
  });
  $('body').delegate('#save a', 'click', function(e) {
    emailSubscribe();
    e.preventDefault();
  });
});
