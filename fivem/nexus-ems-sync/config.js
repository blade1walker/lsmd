// nexus-ems-sync — settings, shared by the server and client scripts.
//
// The website address and key are read from server.cfg, never from this file,
// so the key is not in a file that gets zipped up and shared:
//
//   set nexus_ems_url "https://your-site.example.com"
//   set nexus_ems_api_key "<the same value as FIVEM_API_KEY on the website>"
//   ensure nexus-ems-sync

globalThis.Config = {
  // "auto" detects qbx_core, qb-core or es_extended. "standalone" has no
  // framework: EMS are the players with the ace below, and /emsduty is the
  // only way on or off duty.
  Framework: "auto",

  // Jobs that count as EMS. A player holding one of these is reported as EMS;
  // with ESX's "off" convention, "offambulance" counts as off duty.
  EmsJobs: ["ambulance", "ems", "doctor"],

  // Standalone only: the ace that makes someone EMS.
  //   add_ace group.ems nexus.ems allow
  StandaloneAce: "nexus.ems",

  // How often the city reports everyone in it, in seconds (15–90). The website
  // treats three minutes without a report as the resource having stopped.
  HeartbeatSeconds: 60,

  // Command names. Set one to false to leave that command out.
  Commands: {
    duty: "emsduty", // go on or off EMS duty
    status: "unitstatus", // set your unit status on the Duty Board
    call: "emscall", // log a call in the website's Call Log
  },

  // /emscall adds on-duty EMS standing this close (metres) as responders.
  // Needs OneSync; without it only the medic logging the call is added.
  ResponderRadius: 30.0,

  // Print every request to the server console.
  Debug: false,
};
