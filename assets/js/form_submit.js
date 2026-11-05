let website_url = window.location.href;
	
var json_device_info;
var ip_details;
var ip, iploc, iporg, ipcity;

function validateEmail(email) {
    var re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(email);
}

function validatePhone(phone) {
    // Digits only, minimum 10 digits
    var re = /^[0-9]{10,}$/;
    return re.test(phone);
}

function validateName(name) {
    // Letters and spaces only (allows names like "Mary Jane", "O Brien" etc.)
    var re = /^[A-Za-z\s]+$/;
    return name.trim().length > 0 && re.test(name);
}

// storing data inside our db
function save_data_in_optima(form_data) {
    var webhook_url_optima = "https://propstory.com/optima/Leads_data";
    form_data['json'] = json_device_info;
    form_data['page_url'] = window.location.href;
    form_data['created_time'] = new Date().toISOString().slice(0, 19).replace('T', ' ');
    // kept so the Thank You redirect can wait for this request to finish
    window.optima_request = $.ajax({
        url: webhook_url_optima,
        type: 'POST',
        data: form_data,
        dataType: "text",
        beforeSend: function() {

        },
        success: function(result) {

        },
        error: function(jqXHR, textStatus, errorThrown) {

        },
        complete: function() {

        }
    });
    return true;
}


// After a successful lead: open the Thank You page (UTMs carried over). Waits for the Optima request
// so leaving the page can't cut it off; a timer makes sure the visitor is never left waiting.
function go_to_thank_you() {
    var done = false;
    var go = function () {
        if (done) return;
        done = true;
        window.location.href = 'thank-you.html' + window.location.search;
    };
    $.when(window.optima_request).always(go);
    setTimeout(go, 2500);
}

//sending data to zapier webhook
function send_data_zapier(form_data, webhook_url) {
    $.ajax({
        url: webhook_url,
        type: 'POST',
        data: form_data,
        dataType: "text",
        beforeSend: function() {
            // no on-page thank-you message: the button shows progress, then the Thank You page opens
            $('.error_msg').hide();
            $('.submit_button').prop('disabled', true).text('Submitting…');
        },
        success: function(result) {
            go_to_thank_you();
            return false;
        },
        error: function(jqXHR, textStatus, errorThrown) {
            $('.error_msg').show();
            $('.submit_button').prop('disabled', false).text('Submit');
        }
    });
}

$(".phone, .phone_req_callback").intlTelInput({
    utilsScript: "https://propstory.com/campaign/build/js/utils.js",
    defaultCountry: "in",
    preferredCountries: ["in", "ae", "us", "gb", "sg", "sa", "qa"]
});

// Live input filtering: block invalid characters as the user types.
// Name fields: letters and spaces only.
$(document).on('input', '.enq_form .name', function () {
    var cleaned = $(this).val().replace(/[^A-Za-z\s]/g, '');
    if (cleaned !== $(this).val()) {
        $(this).val(cleaned);
    }
});

// Phone fields: digits only.
$(document).on('input', '.enq_form .phone', function () {
    var cleaned = $(this).val().replace(/[^0-9]/g, '');
    if (cleaned !== $(this).val()) {
        $(this).val(cleaned);
    }
});

//on click on submit button
$(document).on('click', '.submit_button', function(){
    let curr_elem = $(this)
    lead_submission(curr_elem);
});

function lead_submission(curr_elem){
    var webhook_url;

    var referrer_url = document.referrer;
    var form_data       = {}
    var email           = curr_elem.closest('.enq_form').find('.email').val();
    var name            = curr_elem.closest('.enq_form').find('.name').val();
    var phone           = curr_elem.closest('.enq_form').find('.phone').val();
    var countryData     = curr_elem.closest('.enq_form').find(".phone").intlTelInput("getSelectedCountryData");
   var project          = curr_elem.closest('.enq_form').find('.project').val();

    form_data['name']      = name;
    form_data['email']     = email;
    form_data['phone']     = phone;
        form_data['project']   = project;
    form_data['url']       = website_url;
    form_data['source']    = utm_source;
    form_data['campaign']  = utm_campaign;
    form_data['content']  = utm_content;
    
    form_data['referrer_url'] = referrer_url;
    form_data['country_code'] = countryData['dialCode'];
    form_data['country_name'] = countryData['name'];

    // Consent (checkbox under the form) is required; nothing is sent until it is ticked
    var consent = curr_elem.closest('.enq_form').find('.consent_chk').is(':checked');
    form_data['consent'] = consent ? 'yes' : 'no';

       if (consent && name.length !== 0 && email.length !== 0 && phone.length !== 0 && project) {

        if (validateName(name) && validateEmail(email) && (form_data['country_code'] != '91' || validatePhone(phone))) {
            save_data_in_optima(form_data);
            this.disabled = true;
            $('.form_error').hide();
            // var url = window.location.href;
            if (website_url.indexOf('Taboola') >= 0) {
                window._tfa = window._tfa || [];
                _tfa.push({ notify: 'event', name: 'lead', id: taboola_conversion_pixel });
                webhook_url = webhook_taboola;
            } else {
                webhook_url = webhook_google;
                function gtag_report_conversion(website_url) {
                  var callback = function () {
                    if (typeof(website_url) != 'undefined') {
                      window.location = website_url;
                    }
                  };
                  gtag('event', 'conversion', {
                      'send_to': google_conversion_pixel,
                      'event_callback': callback
                  });
                  return false;
                }
                gtag_report_conversion();					
            }
            send_data_zapier(form_data, webhook_url);
        } else {
            $('.form_error').show();
        }
    } else {
        $('.form_error').show();
    }
}