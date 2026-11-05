/* =====================================================================
   CONFIG: everything an integrator needs to change lives here.
   ===================================================================== */
window.GF_CONFIG = {
    project: 'NeoLiv Grand Forest',
    /* Salesforce: POST target for every lead and booking. Point this at the SFDC middleware
       (Apex REST endpoint, MuleSoft, or a Zapier/Make "Create Lead" flow). Payload = flat
       x-www-form-urlencoded fields, see buildPayload() for the full list.
       TODO: set before launch. */
    sfdcEndpoint: '',
    /* Existing Propstory lead pipeline (same hooks as the Grand Life page). */
    zapierWebhook: 'https://hooks.zapier.com/hooks/catch/1730444/u07erne/',
    optimaEndpoint: 'https://propstory.com/optima/Leads_data',
    googleConversion: 'AW-16641316199/-GTcCK_AjsIZEOeqmf89',
    /* Video-call slots, in India time. */
    slots: { days: 7, startHour: 10, endHour: 19, minutes: 30, leadMinutes: 90, closedWeekdays: [] },
    sitePin: 'NeoLiv Grand Forest, Khopoli',  /* name shown on the page; the map pins siteLatLng only, so no Google listing label appears */
    siteMapsUrl: 'https://www.google.com/maps/dir//NeoLiv+Grand/@18.7755947,73.285141,17z/data=!4m8!4m7!1m0!1m5!1m1!1s0x3be8070010b6396b:0x1fd13ab63fdd91e2!2m2!1d73.285141!2d18.7755947',  /* directions to the client's place "NeoLiv Grand" (default map layer; the client's short link opened with terrain + traffic on); used by "Get directions" / "Open in Google Maps" */
    siteLatLng: [18.7755947, 73.285141],  /* exact pin of that Google Maps place */
    whatsapp: '919240244489'       /* VMC number for all Grand Forest CTAs */
};
